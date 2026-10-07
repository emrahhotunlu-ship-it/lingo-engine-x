import { useClock } from '../../app/clock';
import { useNav } from '../../app/nav';
import { resumables, unitBlockFor, type FocusApi } from '../../app/registry';
import { loadResume } from '../../app/resume';
import type { Route } from '../../app/router/types';
import type { UnitBlockNo, UnitCtx, UnitTaskResult } from '../../app/unit/types';
import { invalidIdsOf, useLive } from '../../data/live';
import type { DutyId, StoredPlan, UnitMeta } from '../../domain/plan/types';
import { buildTrainCards } from '../../domain/metrics';
import { buildChunkCards } from '../../domain/srs/chunkCards';
import { isUnitPlan, unitActKey, unitDonePatch, unitPlanOf } from '../../domain/unit/plan';
import { unitPhrases, weakWords } from '../../domain/unit/phrases';
import { unitRows, type UnitRow } from '../../domain/unit/rows';
import { resolveBlock } from '../../domain/unit/planFor';
import { EMPTY_TARGETS, type UnitBlock, type UnitEnv, type UnitPlan } from '../../domain/unit/types';
import { selectAiAvailable } from '../../ai/scope';
import { useCapabilities } from '../../platform/capabilities';
import { logError, logWarn } from '../../platform/diagnostics';
import { unlockSpeech, useSpeech } from '../../platform/speech';
import { startFormatRound } from '../c1x/FormatRound';
import { startCheck } from '../check/session';
import { startGrammar } from '../grammar/session';
import { startAgain } from '../repair/again/session';
import { recordProfileFields, usePending } from '../progress/persist';
import { markUnitLocal } from '../today/marks';
import { todayNow } from '../today/state';
import { healDay } from '../today/store';
import { startSession } from '../vocab/session';
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
  return { day: st.day, plan, up: unitPlanOf(plan, null), rows };
}

/** Umgebung beim Blockstart: KI nur, wenn sie JETZT bereit ist (M4d); Sprachausgabe mit Stimme. */
export function envNow(): UnitEnv {
  return { ai: selectAiAvailable(useCapabilities.getState()), tts: useSpeech.getState().status === 'ready' };
}

const firstOpen = (rows: readonly UnitRow[]): UnitRow | null => rows.find((r) => r.state !== 'done') ?? null;

/** Kontext eines Blocks (Wendungen; Ergebnis von Block 3 für 4/5). Seit dem Fokus-Umbau ohne Wochenthema und Wochenziele. */
export function ctxFor(u: UnitNow, block: UnitBlock): UnitCtx {
  const run = useUnitRun.getState();
  const targets = EMPTY_TARGETS;
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
  const ctx: UnitCtx = { day: u.day, block: block.block, theme: null, targets, minutes: block.min, phrases, opts: block.opts };
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
  if (block.block === 2 || block.block === 3 || block.block === 4) {
    // Grammatikrunde (fällige Fehler und Kanal der Woche), als Pflicht (roundCtx).
    setRun({ day, watch: 'gram' });
    const first = startGrammar({ mode: 'duty', day });
    if (first === 'typed') api.focusNow();
    else api.blur();
    return { route: { name: 'grammarSession', mode: 'duty' }, via: 'grammar', watch: 'gram' };
  }
  api.blur();
  startAgain({ day, block: 5 });
  return { route: { name: 'unitAgain' }, via: 'own', watch: null };
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
    if (run !== mem) useUnitRun.setState({ ...EMPTY_RUN, ...run }, true);
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
  // Plan 3.0 (P23): Schritt 3 an einem Format-Tag. Nicht machbar (zu wenig Aufgaben, Art aus) → weiter mit dem Satzbau. Die Tempo-Runde (`mode: 'tempo'`) folgt mit P24.
  const fmt = block.block === 3 && rb.kind === 'task.order' && block.args?.mode === 'format' ? block.args.fmt : undefined;
  const fr = fmt ? startFormatRound({ fmt, day: u.day, block: block.block }) : null;
  if (fr) {
    setRun({ ...base, via: 'provider', watch: null, routeName: fr.route.name, route: fr.route });
    if (fr.first === 'typed') api.focusNow();
    else api.blur();
    useNav.getState().go(fr.route);
    return;
  }
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
 * Tipp auf der Tageskarte: der erste offene Block.
 * Ohne Plan der Einheit (Plan von Phase 1/2 von heute): `false` – dann startet der alte Weg.
 */
export function startUnit(api: FocusApi): boolean {
  const u = unitNow();
  if (!u) return false;
  const row = firstOpen(u.rows);
  if (!row) return true;
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
    setRun({ watch: null });
    markBlockDone(day, duty);
  });
}

/** Nur für Tests. */
export function resetUnitRunForTests(): void {
  useUnitRun.setState(EMPTY_RUN, true);
}
