import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { resumables, unitBlockFor, type FocusApi } from '../../app/registry';
import { loadResume } from '../../app/resume';
import type { Route } from '../../app/router/types';
import type { UnitBlockNo, UnitCtx, UnitTaskResult } from '../../app/unit/types';
import { invalidIdsOf, useLive } from '../../data/live';
import { readOnce } from '../../data/snapshot';
import type { DutyId, StoredPlan, UnitMeta } from '../../domain/plan/types';
import { sayPath, type SayItem } from '../../domain/say/sayDoc';
import { buildTrainCards } from '../../domain/srs/cards';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { isUnitPlan, lapPatch, unitActKey, unitDonePatch, unitPlanOf } from '../../domain/unit/plan';
import { unitPhrases, weakWords } from '../../domain/unit/phrases';
import { unitRows, type UnitRow } from '../../domain/unit/rows';
import { resolveBlock, themeFor, weekTargets } from '../../domain/week';
import type { UnitBlock, UnitEnv, UnitPlan } from '../../domain/week/types';
import { selectAiAvailable } from '../../ai/scope';
import { getDb, useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { unlockSpeech, useSpeech } from '../../platform/speech';
import { startCheck } from '../check/session';
import { startGrammar } from '../grammar/session';
import { recordProfileFields, usePending } from '../progress/persist';
import { markUnitLocal } from '../today/marks';
import { phoneActive } from '../today/device';
import { todayNow } from '../today/state';
import { healDay } from '../today/store';
import { startSession } from '../vocab/session';
import { weekDocNow } from '../week/store';
import { EMPTY_RUN, useUnitRun, type UnitRun, type UnitVia } from './runStore';

// Die Tageseinheit als Kette im Player (plan.md §1.5, N10; architektur.md §2.7):
// - Ein Tipp auf der Tageskarte startet den ersten offenen Block (montags erst die Bestätigungskarte).
// - Jeder Block kommt vom Anbieter im Register (`unitBlocks`); fehlt er noch oder ist er ohne KI bzw.
//   Sprachausgabe nicht machbar, läuft ein Ersatzblock über vorhandene Routen (Trainer, Sag es,
//   Grammatik, Wochen-Check) oder die eigenen Ersatzschritte (Lesen, Nochmal).
// - Rückfälle entscheidet `resolveBlock(block, env)` beim Blockstart (M4/M5). KI verzögert (noch
//   nicht bereit) gilt als „ohne KI“ (M4d): nie warten.
// - Abschluss: `unitDone(block, result?)` (Meldepunkt `app/unit/done.ts`) → `act[tag]['u-…']` über
//   `recordProfileFields`, danach Zwischenkarte. Ersatzblöcke melden sich über ihr Rundenende.


export type UnitNow = { day: string; plan: StoredPlan & { u: UnitMeta }; up: UnitPlan; rows: UnitRow[] };

/** Die Einheit von heute (oder `null`, wenn heute kein Plan der Einheit gilt). */
export function unitNow(): UnitNow | null {
  const st = todayNow();
  const plan = st.plan;
  if (!st.ready || !isUnitPlan(plan)) return null;
  const rows = unitRows(plan, st.duties.items) ?? [];
  return { day: st.day, plan, up: unitPlanOf(plan, weekDocNow()), rows };
}

/** Umgebung beim Blockstart: KI nur, wenn sie JETZT bereit ist (M4d); Sprachausgabe mit Stimme. */
export function envNow(): UnitEnv {
  return { ai: selectAiAvailable(useCapabilities.getState()), tts: useSpeech.getState().status === 'ready', phone: phoneActive() };
}

const firstOpen = (rows: readonly UnitRow[]): UnitRow | null => rows.find((r) => r.state !== 'done') ?? null;

/** Muss vor dem nächsten Block das Wochenthema bestätigt werden? (M10: erster Lerntag der Woche ohne gespeichertes Thema.) */
export function needsConfirm(u: UnitNow): boolean {
  if (useUnitRun.getState().confirmed === u.day) return false;
  return u.up.confirmTheme;
}

/** Kontext eines Blocks (Thema, Ziele, Wendungen; Ergebnis von Block 3 für 4/5). */
export function ctxFor(u: UnitNow, block: UnitBlock): UnitCtx {
  const run = useUnitRun.getState();
  const week = weekDocNow();
  const pick = themeFor(u.day, week);
  const targets = weekTargets(pick.theme, { day: u.day, week });
  const same = run.day === u.day;
  let phrases = same && run.phrases.length ? run.phrases : [];
  if (!phrases.length) {
    const live = useLive.getState();
    const now = useClock.getState().now;
    const cards = buildTrainCards(live.collections.vocab ?? new Map(), now, invalidIdsOf(live.invalid, 'vocab'));
    const chunks = buildChunkCards(live.collections.chunk ?? new Map(), now, invalidIdsOf(live.invalid, 'chunk'));
    // Dazu bis zu zwei schwache Wörter oder Wendungen: Block 3 wiederholt sie mit einer zweiten Methode (Produktion).
    phrases = unitPhrases(cards, u.day, targets, weakWords([...cards, ...chunks]));
  }
  const ctx: UnitCtx = { day: u.day, block: block.block, theme: pick.theme, targets, minutes: block.min, phrases, opts: block.opts };
  if (same && run.sentences.length) ctx.sentences = run.sentences;
  if (same && run.task) ctx.task = run.task;
  return ctx;
}

function setRun(patch: Partial<UnitRun>): void {
  useUnitRun.setState((s) => ({ ...s, ...patch }));
}

/** Anbieter sicher aufrufen: ein Fehler im Anbieter darf die Einheit nie blockieren (Ersatz übernimmt). */
function tryProvider(block: UnitBlock, ctx: UnitCtx, env: UnitEnv, kind: UnitBlock['kind']): Route | false {
  const p = unitBlockFor(kind);
  if (!p) return false;
  try {
    if (!p.feasible(env)) return false;
    return p.start(ctx);
  } catch (err) {
    logError('unit:provider', err, `${kind} (Block ${block.block})`);
    return false;
  }
}

/** Ersatzblock über vorhandene Routen bzw. eigene Ersatzschritte. SYNCHRON im Klick. */
function fallback(block: UnitBlock, kind: UnitBlock['kind'], api: FocusApi): { route: Route; via: UnitVia; watch: string | null } {
  const day = useClock.getState().today;
  if (block.block === 1 || kind === 'review') {
    const first = startSession('pflicht');
    if (first === 'typed') api.focusNow();
    return { route: { name: 'trainer', round: 'pflicht' }, via: 'trainer', watch: null };
  }
  if (kind === 'task.check') {
    const first = startCheck({ unit: true });
    if (first === 'typed') api.focusNow();
    else api.blur();
    if (first === 'empty') return { route: { name: 'unitStep', step: 'check', block: block.block }, via: 'own', watch: null };
    return { route: { name: 'check' }, via: 'check', watch: 'check' };
  }
  if (block.block === 2) {
    api.blur();
    return { route: { name: 'unitStep', step: 'input', block: 2 }, via: 'own', watch: null };
  }
  if (block.block === 3) {
    // „Sag es“ ist ohne KI erfüllbar (ungeprüft speichern) und deckt jede Aufgabe ab, bis ihr Anbieter kommt.
    api.blur();
    return { route: { name: 'say' }, via: 'say', watch: 'say' };
  }
  if (block.block === 4) {
    // Fokus: Grammatikrunde (fällige Fehler und Kanal der Woche), als Pflicht (roundCtx).
    setRun({ day, watch: 'gram' });
    const first = startGrammar({ mode: 'duty', day });
    if (first === 'typed') api.focusNow();
    else api.blur();
    return { route: { name: 'grammarSession', mode: 'duty' }, via: 'grammar', watch: 'gram' };
  }
  api.blur();
  return { route: { name: 'unitStep', step: 'again', block: 5 }, via: 'own', watch: null };
}

/**
 * Unterbrochenen Block fortsetzen statt neu starten (Fortsetzen, N04): Gehört der Lauf (im Speicher
 * oder aus `lx:resume:unit`) zu diesem Pflichtpunkt und liegt für die Übung des Blocks ein Stand
 * desselben Lerntags seit dem Blockstart vor, wird dieser hergestellt und die Übung geöffnet.
 * `false` → der Block startet neu. SYNCHRON im Klick.
 */
function resumeRow(u: UnitNow, row: UnitRow): boolean {
  const mem = useUnitRun.getState();
  let run: Partial<UnitRun> | null = mem.day === u.day && mem.duty === row.id && mem.route ? mem : null;
  if (!run) {
    const env = loadResume('unit');
    const d = env?.data as Partial<UnitRun> | null | undefined;
    if (env?.day === u.day && d?.day === u.day && d.duty === row.id && d.route) run = d;
  }
  const route = run?.route;
  if (!run || !route) return false;
  const since = run.at ?? 0;
  for (const r of resumables()) {
    // Nur die Übung selbst; die Hülle der Einheit trägt dieselbe Route.
    if (r.id === 'unit') continue;
    const env = loadResume(r.id);
    if (!env || env.v !== r.version || env.day !== u.day || env.route.name !== route.name || env.savedAt < since) continue;
    let ok = false;
    try {
      ok = r.restore(env.data);
    } catch (err) {
      logWarn('unit:resume', err, r.id);
    }
    if (!ok) continue;
    if (run !== mem) useUnitRun.setState({ ...EMPTY_RUN, ...run, confirmed: mem.confirmed ?? run.confirmed ?? null }, true);
    useNav.getState().go(route);
    return true;
  }
  return false;
}

/** Einen Block starten (Anbieter oder Ersatz); ein unterbrochener Block wird fortgesetzt. SYNCHRON im Klick (iPhone-Tastatur). */
export function startRow(u: UnitNow, row: UnitRow, api: FocusApi): void {
  unlockSpeech();
  if (resumeRow(u, row)) return;
  const block = u.up.blocks.find((b) => b.block === row.block && b.channel === row.id) ?? u.up.blocks.find((b) => b.channel === row.id);
  if (!block) {
    logWarn('unit:start', `Block ${row.id} fehlt im Plan`);
    return;
  }
  const env = envNow();
  const rb = resolveBlock(block, env);
  const ctx = ctxFor(u, block);
  const base: Partial<UnitRun> = { day: u.day, block: block.block, duty: row.id, kind: rb.kind, offline: rb.offline, at: Date.now(), phrases: ctx.phrases ?? [] };
  const route = tryProvider(block, ctx, env, rb.kind);
  if (route) {
    setRun({ ...base, via: 'provider', watch: null, routeName: route.name, route });
    useNav.getState().go(route);
    return;
  }
  // Wache zuerst setzen: `roundCtx` liest sie schon beim Aufbau der Ersatzrunde.
  setRun({ ...base, via: null, watch: null, routeName: null });
  const fb = fallback(block, rb.kind, api);
  setRun({ via: fb.via, watch: fb.watch, routeName: fb.route.name, route: fb.route });
  useNav.getState().go(fb.route);
}

/**
 * Tipp auf der Tageskarte: Bestätigungskarte (erster Lerntag der Woche) oder der erste offene Block.
 * Ohne Plan der Einheit (Plan von Phase 1/2 von heute): `false` – dann startet der alte Weg.
 */
export function startUnit(api: FocusApi): boolean {
  const u = unitNow();
  if (!u) return false;
  const row = firstOpen(u.rows);
  if (!row) return true;
  if (needsConfirm(u)) {
    api.blur();
    useNav.getState().go({ name: 'unitCard', step: 'confirm' });
    return true;
  }
  startRow(u, row, api);
  return true;
}

/** Aus einer Pflicht-Zusammenfassung („Weiter: …“): Block dieses Pflichtpunkts starten. */
export function startUnitDuty(id: DutyId, api: FocusApi): boolean {
  const u = unitNow();
  if (!u) return false;
  const row = u.rows.find((r) => r.id === id && r.state !== 'done') ?? firstOpen(u.rows);
  if (!row) {
    useNav.getState().go({ name: 'unitCard', step: 'next' });
    return true;
  }
  startRow(u, row, api);
  return true;
}

/** „Weiter“ auf der Zwischen- bzw. Bestätigungskarte. */
export function continueUnit(api: FocusApi): void {
  const u = unitNow();
  if (!u) {
    useNav.getState().back();
    return;
  }
  const row = firstOpen(u.rows);
  if (!row) {
    useNav.getState().go({ name: 'unitCard', step: 'next' });
    return;
  }
  startRow(u, row, api);
}

/** Wochenthema bestätigt (oder gewählt): die Karte erscheint heute nicht noch einmal. */
export function markConfirmed(day: string): void {
  setRun({ confirmed: day });
}

// ------------------------------------------------------------------ Abschluss

let fieldsChain: Promise<unknown> = Promise.resolve();

/** Block als erledigt zählen: sofort sichtbar, dann `act[tag]['u-…'] = 1` und Selbstheilung der Pflicht. */
export function markBlockDone(day: string, duty: string): void {
  const key = unitActKey(duty);
  if (!key) return;
  markUnitLocal(day, key);
  fieldsChain = fieldsChain
    .then(() => recordProfileFields('unit:done', (cur) => unitDonePatch(cur, day, key)))
    .then((ok) => {
      if (!ok) logWarn('unit:done', { code: 'not_saved', message: `${key} nicht gespeichert – wird nachgeholt` }, 'app/profile');
      return healDay(day);
    })
    .catch((err: unknown) => logError('unit:done', err, key));
  // Aufgabe des Tages am Laptop (nicht die Handy-Übung): für die Wochenbilanz „x von 2“ auf Heute.
  if (duty === 'ch:u-task' && !phoneActive()) {
    fieldsChain = fieldsChain.then(() => recordProfileFields('unit:lap', (cur) => lapPatch(cur, day))).catch((err: unknown) => logError('unit:lap', err, day));
  }
}

/**
 * Pflichtpunkt eines Blocks (Block-Nr. → `review`/`ch:u-*`) mit seinem Lerntag. Der Lauf gewinnt:
 * Ein Block, der vor 04:00 begonnen und danach beendet wurde, zählt für den Tag, an dem er begann.
 */
function dutyOfBlock(block: UnitBlockNo): { day: string; duty: string } | null {
  const run = useUnitRun.getState();
  if (run.day && run.block === block && run.duty) return { day: run.day, duty: run.duty };
  const u = unitNow();
  const b = u?.up.blocks.find((x) => x.block === block);
  return u && b ? { day: u.day, duty: b.channel } : null;
}

/**
 * Handler des Meldepunkts `unitDone` (app/unit/done.ts): zählt den Block, merkt das Ergebnis für
 * Block 4/5 und führt zur Zwischenkarte. Ein spätes Ergebnis von Block 3 (KI verzögert, M4d) wird nur
 * gemerkt; Block 4 hat dann schon ohne gewartet begonnen.
 */
export function handleUnitDone(block: UnitBlockNo, result?: UnitTaskResult): void {
  const target = dutyOfBlock(block);
  if (result) setRun({ task: result });
  if (!target) {
    logWarn('unit:done', `Block ${block} gehört zu keiner Einheit von heute`);
    return;
  }
  const run = useUnitRun.getState();
  const late = run.block !== null && run.block > block;
  if (!late && startNextStep(block)) return;
  if (target.duty !== 'review') markBlockDone(target.day, target.duty);
  if (late) return;
  setRun({ via: null, watch: null, routeName: 'unitCard', route: { name: 'unitCard', step: 'next' } });
  useNav.getState().go({ name: 'unitCard', step: 'next' });
}

/**
 * Mehrschrittiger Block (Block 2: Input → Nachsprechen, plan.md §1.5): Nach dem ersten Schritt startet
 * der letzte Schritt des Blocks, statt den Block zu zählen. Nur mit Anbieter und nur, wenn er JETZT
 * machbar ist (Sprachausgabe, wie der Hinweis im Input-Block); sonst zählt der Block wie bisher.
 * Die eigenen Ersatzschritte enthalten das Nachsprechen schon.
 */
function startNextStep(block: UnitBlockNo): boolean {
  const run = useUnitRun.getState();
  if (run.block !== block || run.via !== 'provider' || !run.kind) return false;
  const u = unitNow();
  const b = u && u.day === run.day ? u.up.blocks.find((x) => x.block === block && x.channel === run.duty) : undefined;
  const next = b && b.steps.length > 1 ? b.steps[b.steps.length - 1] : undefined;
  if (!u || !b || !next || next === run.kind) return false;
  const route = tryProvider(b, ctxFor(u, b), envNow(), next);
  if (!route) return false;
  setRun({ kind: next, via: 'provider', watch: null, routeName: route.name, route, at: Date.now() });
  useNav.getState().go(route);
  return true;
}

/** Ergebnis von `input.*` (Sätze, Wendungen) für die Folgeblöcke merken. */
export function rememberInput(sentences: readonly string[], phrases: readonly string[]): void {
  setRun({ sentences: [...sentences].slice(0, 6), phrases: [...phrases].slice(0, 5) });
}

// ------------------------------------------------------------------ Ersatzblöcke: Abschluss über das Rundenende

let watching = false;

/** Rundenende des beobachteten Ersatzblocks → Block erledigt (einmal installiert, aus dem Bereich). */
export function installUnitWatch(): void {
  if (watching) return;
  watching = true;
  usePending.subscribe((s, prev) => {
    const run = useUnitRun.getState();
    if (!run.watch || !run.day || !run.duty || s.rounds === prev.rounds) return;
    const added = s.rounds.filter((r) => !prev.rounds.includes(r));
    if (!added.some((r) => r.day === run.day && r.act === run.watch && !r.partial)) return;
    const duty = run.duty;
    const day = run.day;
    const via = run.via;
    setRun({ watch: null });
    markBlockDone(day, duty);
    if (via === 'say') void loadSayTask(day);
  });
}

/** Ergebnis von „Sag es“ (Ersatz für Block 3) aus `say/<Monat>` für Block 4/5 – geräteübergreifend. */
export async function loadSayTask(day: string): Promise<UnitTaskResult | null> {
  const db = getDb();
  if (!db) return null;
  const path = sayPath(day);
  try {
    const snap = await readOnce(path, () => db.doc(path).get());
    const doc = snap.exists ? (snap.data()) : undefined;
    const items = Array.isArray(doc?.items) ? (doc.items as unknown[]) : [];
    const mine = items
      .filter((x): x is SayItem => !!x && typeof x === 'object' && (x as SayItem).day === day && typeof (x as SayItem).a1 === 'string' && (x as SayItem).a1.length > 0)
      .sort((a, b) => (a.t ?? 0) - (b.t ?? 0))
      .at(-1);
    if (!mine) return null;
    const fb = mine.fb1;
    const task: UnitTaskResult = {
      kind: 'task.say',
      ref: `${path}#${mine.id}`,
      text: mine.a1,
      fixes: (fb?.corrections ?? []).slice(0, 3).map((c) => ({ kind: 'form' as const, mine: c.wrong, right: c.right, why: c.why })),
    };
    if (fb?.better) task.better = fb.better;
    if (mine.a2) task.better = task.better ?? mine.a2;
    if (useUnitRun.getState().day === day) setRun({ task });
    return task;
  } catch (err) {
    logWarn('unit:task', err, path);
    return null;
  }
}

/** Nur für Tests. */
export function resetUnitRunForTests(): void {
  useUnitRun.setState(EMPTY_RUN, true);
}
