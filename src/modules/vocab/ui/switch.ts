import { logError, logWarn, type Writer } from '../shared';
import { dryRun, runMigration, type MigrationInput, type MigrationReport, type RunGuards, type RunOutcome } from '../data/migrate';
import { isFutureLex, lexOf, lexPatch } from '../data/lex';
import { lexWriteSchema, vcfgSchema, vocabModuleMarkSchema } from '../data/schemas';
import { PROFILE_PATH } from '../data/settings';
import { catchUp, convertDoc, type LogEntry } from '../domain/migrate';
import type { DupePair } from '../domain/dupes';
import { DEFAULT_CFG } from '../domain/types';
import { deviceId } from './device';
import { VOCAB_LOCK_PATH } from '../registry';

// „Neue Wörter-App einschalten“ (plan.md §9.1–9.4): der Kleber zwischen Einstellungen › Wortschatz und der Umrechnung. Nachgeladen
// (api.loadSwitch), nie in der Einstiegsdatei. Lesen und Sicherung macht der Aufrufer (src/features/settings), hier wird nur gerechnet und
// über den einen Schreibweg geschrieben:
//  - Probelauf: Eingabe aus einem VOLLEN Lesen bauen, `dryRun`, Bericht in Gruppen wie die Übersicht (Erkennst du / Auf dem Weg / Bildest du selbst).
//  - Übernehmen: `runMigration` mit echten Wächtern; erst bei `done`/`already` den Schalter `app/profile.vcfg.mod = 1` (transform, nur `vcfg`).
//  - Rückweg (§9.4): `mod = 0`; wieder an ohne neue Umrechnung, vorher Nachholen über `lex.sync` (Antworten des alten Bereichs in der Zwischenzeit).

type Doc = Record<string, unknown>;
export type Skip = { path: string; why: string };

const CARD = /^(vocab|chunk)\/[^/]+$/;
const LOG = /^log\/([^/]+)$/;
/** Sammlungen, deren vollständiges Lesen die Umrechnung braucht (gekappt → gesperrt, A6 Nr. 15). */
export const SWITCH_COLLECTIONS: readonly string[] = ['vocab', 'chunk', 'log'];
const isObj = (v: unknown): v is Doc => !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Eingabe der Umrechnung aus einem vollständigen Lesen (Pfad → Inhalt, wie gespeichert). Dokumente, die das Schema der App nicht lesen kann,
 * werden nie angefasst: sie bleiben draußen und stehen im Bericht als übersprungen (Karten) bzw. fehlen im Verlauf (Tagesprotokolle).
 */
export function buildInput(raw: ReadonlyMap<string, Doc>, invalid: Iterable<string>, nowMs: number): { input: MigrationInput; skipped: Skip[] } {
  const bad = new Set(invalid);
  const docs = new Map<string, Doc>();
  const logs = new Map<string, LogEntry[]>();
  const skipped: Skip[] = [];
  for (const [path, doc] of raw) {
    if (CARD.test(path)) {
      if (bad.has(path)) skipped.push({ path, why: 'invalid' });
      else docs.set(path, doc);
      continue;
    }
    const m = LOG.exec(path);
    if (!m || bad.has(path) || !Array.isArray(doc.entries)) continue;
    logs.set(m[1]!, (doc.entries as unknown[]).filter((e): e is LogEntry => isObj(e) && typeof e.t === 'number'));
  }
  return { input: { docs, logs, nowMs }, skipped };
}

/** Was der Aufrufer aus einem vollen Lesen mitbringt (Form von `DataSnapshot`, ohne Abhängigkeit nach außen). */
export type SwitchRead = {
  raw: ReadonlyMap<string, Doc>;
  valid: ReadonlyMap<string, Doc>;
  invalid: ReadonlyArray<{ path: string }>;
  possiblyTruncated: readonly string[];
};
export type SwitchState = { input: MigrationInput; skipped: Skip[]; profileValid: boolean; truncated: boolean; schema: Doc | null };

/**
 * Probelauf-Eingabe plus echte Wächter aus EINEM vollen Lesen: Profil gültig (gelesen und vom Schema der App angenommen), keine der
 * Sammlungen `vocab`/`chunk`/`log` vielleicht gekappt (sonst gesperrt statt raten, A6 Nr. 15).
 */
export function fromRead(r: SwitchRead, nowMs: number): SwitchState {
  const { input, skipped } = buildInput(r.raw, r.invalid.map((x) => x.path), nowMs);
  return {
    input,
    skipped,
    profileValid: r.valid.has(PROFILE_PATH),
    truncated: r.possiblyTruncated.some((c) => SWITCH_COLLECTIONS.includes(c)),
    schema: r.raw.get('app/schema') ?? null,
  };
}

// Kennung der Sperre beim Einschalten: Gerät + Tab. Derselbe Halter verlängert eine Sperre nur, zwei Tabs eines Geräts brauchen verschiedene.
const TAB = Math.random().toString(36).slice(2, 8);
export const lockHolder = (): string => `${deviceId()}-${TAB}`;

export type SwitchSummary = {
  cards: number;
  /** Wörter und Wendungen danach (bestätigte Doppel zählen einmal). */
  words: number;
  fresh: number;
  recognize: number;
  onway: number;
  produce: number;
  /** Davon mit unvollständigem Verlauf (starten aus dem gespeicherten Stand). */
  partial: number;
  skipped: Skip[];
  dupes: DupePair[];
  logDaysCapped: number;
  histFull: number;
};

type Pair = readonly [string, string];

/**
 * Zusammenlegen nur für Paare der Art „gleiches Wort“ (Vorschlag aus `findDupes`); britische Schreibung, Artikel und „jemanden/etwas“ werden
 * nur gemeldet (plan.md §9.2). Alles andere fällt hier heraus, auch wenn es als bestätigt ankommt. `dupes` = Lauf OHNE Bestätigung.
 */
export function proposedOnly(dupes: readonly DupePair[], pairs: readonly Pair[]): Pair[] {
  const ok = new Set(dupes.filter((d) => d.kind === 'propose').map((d) => `${d.lead}|${d.other}`));
  return pairs.filter(([l, o]) => ok.has(`${l}|${o}`));
}

/** Probelauf mit den bestätigten Doppeln (nur „gleiches Wort“ bekommt `of`); nichts wird geschrieben. */
export function preview(input: MigrationInput, pairs: readonly Pair[], extraSkipped: readonly Skip[]): { report: MigrationReport; summary: SwitchSummary } {
  // Die Vorschläge kommen aus dem Lauf ohne Bestätigung, damit ein bestätigtes Paar in der Liste stehen bleibt (sonst ließe es sich nicht
  // wieder trennen).
  const base = dryRun({ ...input, confirmedPairs: [] });
  const keep = proposedOnly(base.dupes, pairs);
  const report = keep.length ? dryRun({ ...input, confirmedPairs: keep }) : base;
  // Doppel, die in ein führendes Wort gehen, zählen in den Gruppen nicht extra (wie report.lexemes).
  const merged = new Set(keep.filter(([l, o]) => l !== o && input.docs.has(l) && input.docs.has(o)).map(([, o]) => o));
  const s: SwitchSummary = { cards: report.cards + extraSkipped.length, words: report.lexemes, fresh: 0, recognize: 0, onway: 0, produce: 0, partial: 0, skipped: [...extraSkipped, ...report.skipped], dupes: base.dupes, logDaysCapped: report.logDaysCapped, histFull: report.histFull };
  for (const r of report.rows) {
    if (merged.has(r.path)) continue;
    if (r.uDue === null) s.fresh++;
    else if (r.lv <= 2) s.recognize++;
    else if (r.lv <= 5) s.onway++;
    else s.produce++;
    if (r.full === 0) s.partial++;
  }
  return { report, summary: s };
}

const MAX_LIST = 40;
/** Bericht für das Diagnose-Protokoll (Einstellungen › Daten › Diagnose): Zahlen, Übersprungenes mit Grund, Doppel (je höchstens 40). */
export function summaryText(s: SwitchSummary, pairs: readonly Pair[]): string {
  const skip = s.skipped.slice(0, MAX_LIST).map((x) => `${x.path}(${x.why})`);
  const confirmed = new Set(pairs.map(([l, o]) => `${l}|${o}`));
  const dupes = s.dupes.slice(0, MAX_LIST).map((d) => `${d.lead}|${d.other}(${d.why},${confirmed.has(`${d.lead}|${d.other}`) ? 'zusammen' : 'getrennt'})`);
  return [
    `Karten ${s.cards} → Wörter ${s.words}: neu ${s.fresh}, erkennen ${s.recognize}, unterwegs ${s.onway}, selbst ${s.produce}`,
    `Verlauf unvollständig ${s.partial}, hist voll ${s.histFull}, Log-Tage gekappt ${s.logDaysCapped}`,
    `übersprungen ${s.skipped.length}${skip.length ? `: ${skip.join(', ')}` : ''}${s.skipped.length > MAX_LIST ? ' …' : ''}`,
    `Doppel ${s.dupes.length}${dupes.length ? `: ${dupes.join(', ')}` : ''}${s.dupes.length > MAX_LIST ? ' …' : ''}`,
  ].join(' · ');
}

/**
 * Rückweg-Schalter `app/profile.vcfg.mod` (plan.md §9.4) über den einen Schreibweg: ein `transform` auf dem frischen Profil, nur `vcfg`.
 * Fehlt `vcfg` (Modul nie eingeschaltet), entsteht es mit den Standardwerten; ein ungültiges `vcfg` wird nie still überschrieben.
 * Liefert, ob der Schalter jetzt so steht (auch: stand schon so).
 */
export async function setModuleSwitch(writer: Writer, mod: 0 | 1): Promise<boolean> {
  let ok = false;
  try {
    await writer.transform(PROFILE_PATH, (cur) => {
      if (!cur) return null;
      const had = cur.vcfg !== undefined && cur.vcfg !== null;
      const base = had ? vcfgSchema.safeParse(cur.vcfg) : vcfgSchema.safeParse({ min: DEFAULT_CFG.min, ret: DEFAULT_CFG.ret, mod: 0 });
      if (!base.success) return null;
      ok = true;
      if (base.data.mod === mod && (had || mod === 0)) return null;
      return { update: { vcfg: vcfgSchema.parse({ ...base.data, mod }) } };
    });
  } catch (err) {
    logError('vocab:switch', err, `mod ${mod}`);
    return false;
  }
  if (!ok) logWarn('vocab:switch', { message: 'Schalter nicht gesetzt' }, `app/profile fehlt oder vcfg ungültig (mod ${mod})`);
  return ok;
}

export type CatchUpResult = { docs: number; applied: number; added: number; incomplete: string[] };

/**
 * Nachholen beim Wiedereinschalten (plan.md §9.4): Hat der alte Bereich in der Zwischenzeit geantwortet (`doc.last > lex.sync`), spielt das
 * Modul NUR diese Antworten nach (`catchUp`, auf dem FRISCHEN Dokument, entdoppelt über `t`). Fehlt ein Teil (Kappung), wird es gemeldet,
 * nicht geraten. Karten, die der alte Bereich in der Zwischenzeit neu angelegt hat (ohne `lex`), werden wie bei der Umrechnung umgerechnet.
 * Schreibt nur `lex`.
 */
export async function catchUpAll(writer: Writer, docs: ReadonlyMap<string, Doc>, logs: ReadonlyMap<string, readonly LogEntry[]>, nowMs: number): Promise<CatchUpResult> {
  const out: CatchUpResult = { docs: 0, applied: 0, added: 0, incomplete: [] };
  for (const [path, doc] of docs) {
    if (!CARD.test(path)) continue;
    const lex0 = lexOf(doc);
    const fresh = !isObj(doc.lex);
    if (!fresh && !(lex0 && typeof doc.last === 'number' && doc.last > lex0.sync)) continue;
    let applied = 0;
    let gap = false;
    const r = await writer.transform(path, (cur) => {
      if (!cur || isFutureLex(cur)) return null;
      if (!isObj(cur.lex)) {
        // Neu im alten Bereich (seit der Umrechnung): eigenes Lexem, keine Doppel-Zusammenlegung (das bestätigt nur Emrah im Probelauf).
        const c = convertDoc(path, cur, nowMs, logs);
        const parsed = c.lex ? lexWriteSchema.safeParse(c.lex) : null;
        if (!parsed?.success) {
          if (parsed) logError('vocab:catchup', parsed.error, path);
          return null;
        }
        return { update: { lex: parsed.data } };
      }
      const lex = lexOf(cur);
      if (!lex) return null;
      const c = catchUp(lex, cur, path, logs);
      if (c.lex.sync === lex.sync && c.applied === 0) return null;
      const parsed = lexWriteSchema.safeParse(c.lex);
      if (!parsed.success) {
        logError('vocab:catchup', parsed.error, path);
        return null;
      }
      applied = c.applied;
      gap = c.incomplete;
      return { update: { lex: lexPatch(cur.lex, parsed.data) } };
    });
    if (r !== 'updated') continue;
    if (fresh) out.added++;
    else out.docs++;
    out.applied += applied;
    if (gap) out.incomplete.push(path);
  }
  if (out.docs || out.added)
    logWarn('vocab:catchup', { message: 'Nachgeholt' }, `${out.docs} Wörter, ${out.applied} Antworten, ${out.added} neu umgerechnet${out.incomplete.length ? `; Verlauf unvollständig: ${out.incomplete.slice(0, MAX_LIST).join(', ')}` : ''}`);
  return out;
}

/** Ist die Umrechnung fertig (`app/schema.vocabModule.state = 'done'`)? */
export function migrationDone(schema: Doc | null | undefined): boolean {
  const m = schema && isObj(schema.vocabModule) ? vocabModuleMarkSchema.safeParse(schema.vocabModule) : null;
  return !!m?.success && m.data.state === 'done';
}

export type EnableResult = { state: RunOutcome['state'] | 'switch_failed'; why?: string; run?: RunOutcome; caught?: CatchUpResult };

/**
 * „Übernehmen und einschalten“: Umrechnung mit echten Wächtern, danach nachholen und der Schalter. Nachgeholt wird nach `done` und `already`
 * (anderer Tab war schneller, oder ein früherer Lauf endete `partial` und der alte Bereich hat seitdem geantwortet); ohne Offenes ein Leerlauf. `busy`/`blocked`/`partial`: nichts einschalten, kein automatisches Wiederholen (der Aufrufer zeigt den Grund;
 * `partial` darf per Knopf erneut laufen, die Umrechnung ist idempotent).
 */
export async function enableModule(writer: Writer, input: MigrationInput, g: RunGuards): Promise<EnableResult> {
  // Wächter am Schreibweg: nur „gleiches Wort“ darf zusammengelegt werden, egal was die Oberfläche schickt.
  const pairs = input.confirmedPairs?.length ? proposedOnly(dryRun({ ...input, confirmedPairs: [] }).dupes, input.confirmedPairs) : [];
  const run = await runMigration(writer, { ...input, confirmedPairs: pairs }, g);
  if (run.state !== 'done' && run.state !== 'already') return { state: run.state, ...(run.why ? { why: run.why } : {}), run };
  const caught = await catchUpAll(writer, input.docs, input.logs, input.nowMs);
  const on = await setModuleSwitch(writer, 1);
  return { state: on ? run.state : 'switch_failed', run, caught };
}

export type ReenableGuards = { schema: Doc | null; profileValid: boolean; possiblyTruncated: boolean };

/**
 * Wieder einschalten ohne neue Umrechnung (Umrechnung ist `done`): Antworten des alten Bereichs nachholen, dann `mod = 1`. Gesperrt, wenn die
 * Umrechnung nicht fertig ist, das Profil ungültig ist oder ein Lesen vielleicht gekappt wurde (sonst fehlten Antworten still).
 */
export async function reenableModule(writer: Writer, input: Pick<MigrationInput, 'docs' | 'logs' | 'nowMs'>, g: ReenableGuards): Promise<EnableResult> {
  if (!migrationDone(g.schema)) return { state: 'blocked', why: 'not_migrated' };
  if (!g.profileValid) return { state: 'blocked', why: 'profile_invalid' };
  if (g.possiblyTruncated) return { state: 'blocked', why: 'possibly_truncated' };
  const caught = await catchUpAll(writer, input.docs, input.logs, input.nowMs);
  const on = await setModuleSwitch(writer, 1);
  return { state: on ? 'done' : 'switch_failed', caught };
}

export type AutoResult = EnableResult | { state: 'skipped'; why: 'no_profile' | 'decided' };

/**
 * Automatisch einschalten (Emrah 02.11.2026: „schalte die neue Wörter-App einfach live, warum muss ich da noch manuell was machen“):
 * einmal je App-Start, wenn `app/profile` da ist und `vcfg` FEHLT (Modul nie entschieden). Ein vorhandenes `vcfg` – auch `mod = 0` über den
 * Rückweg – wird nie überstimmt. Dieselben Wächter wie von Hand (Profil gültig, nichts gekappt, Sperre); keine Doppel-Zusammenlegung (die
 * bestätigt nur Emrah im Probelauf). Ohne Datei-Sicherung, weil die Umrechnung nur ergänzt (`lex`, Verlauf, Marke) und alte Felder stehen
 * lässt (Entscheidung 02.11.2026). Kein Wiederholen in einer Schleife: scheitert es, gilt die alte Ansicht bis zum nächsten Start.
 */
export async function autoEnable(writer: Writer, read: () => Promise<SwitchRead>, nowMs: number): Promise<AutoResult> {
  const snap = await read();
  const profile = snap.raw.get(PROFILE_PATH);
  if (!profile) return { state: 'skipped', why: 'no_profile' };
  if (profile.vcfg !== undefined && profile.vcfg !== null) return { state: 'skipped', why: 'decided' };
  const st = fromRead(snap, nowMs);
  if (migrationDone(st.schema)) return reenableModule(writer, st.input, { schema: st.schema, profileValid: st.profileValid, possiblyTruncated: st.truncated });
  logWarn('vocab:switch', { message: 'Automatisch übernehmen' }, summaryText(preview(st.input, [], st.skipped).summary, []));
  return enableModule(writer, { ...st.input, confirmedPairs: [] }, { confirmed: true, backupWritten: true, profileValid: st.profileValid, possiblyTruncated: st.truncated, holder: lockHolder() });
}

/**
 * Nachholen bei JEDEM App-Start mit eingeschalteter Wörter-App (Emrah 04.11.2026: am Vormittag in der alten App gelernt, die neue App
 * plante dieselben Wörter noch einmal): Hat der alte Bereich geantwortet (`doc.last > lex.sync`), übernimmt `catchUpAll` genau diese
 * Antworten (FSRS, „heute erledigt“ über `lex.day`). Dieselben Wächter wie beim Wiedereinschalten (Umrechnung fertig, Profil gültig, nichts
 * gekappt); ohne Offenes ein Leerlauf (nur Lesen). `null` = nicht gelaufen.
 */
export async function startCatchUp(writer: Writer, read: () => Promise<SwitchRead>, nowMs: number): Promise<CatchUpResult | null> {
  const snap = await read();
  const profile = snap.raw.get(PROFILE_PATH);
  const vcfg = profile && isObj(profile.vcfg) ? profile.vcfg : null;
  if (!vcfg || vcfg.mod !== 1) return null;
  const st = fromRead(snap, nowMs);
  if (!migrationDone(st.schema) || !st.profileValid || st.truncated) return null;
  // Nur bei Offenem die kurze Sperre holen (data-guard 04.11.2026): zwei Tabs/Geräte zugleich buchten dieselben alten Antworten sonst doppelt.
  let open = false;
  for (const [path, doc] of st.input.docs) {
    if (!CARD.test(path)) continue;
    const lex = lexOf(doc);
    if (!isObj(doc.lex) || (lex && typeof doc.last === 'number' && doc.last > lex.sync)) {
      open = true;
      break;
    }
  }
  if (!open) return null;
  const lock = await writer.acquire(VOCAB_LOCK_PATH, { holder: lockHolder(), ttlMs: 30_000 });
  if (!lock.acquired) return null;
  return catchUpAll(writer, st.input.docs, st.input.logs, nowMs);
}
