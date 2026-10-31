import { dayKey, logError, logWarn, type Writer } from '../shared';
import { Catalog } from '../domain/catalog';
import { findDupes, type DupeInput, type DupePair } from '../domain/dupes';
import { type Converted, convertDoc, kindOf, type LogEntry, spreadBacklog } from '../domain/migrate';
import { hash32 } from '../domain/rand';
import type { Lex } from '../domain/types';
import type { VlogTuple } from '../domain/vlog';
import { VOCAB_LOCK_PATH } from '../registry';
import { lexWriteSchema, vocabModuleMarkSchema } from './schemas';
import { writeVlog } from './store';

// Wörter-Modul V1: Umrechnung der heutigen Daten (plan.md §9; Kap. 9; A6 Nr. 12, 15). Ablauf:
//  1. Trockenlauf (`dryRun`): rechnet alles, schreibt nichts; Bericht je Lexem, Doppel-Vorschläge, Übersprungenes mit Grund.
//  2. Erst nach Emrahs Knopf „Übernehmen“ (`confirmed`) UND geschriebener Sicherung (`backupWritten`) schreibt `runMigration`.
//  3. Sperren statt raten: `app/profile` ungültig oder eine Abfrage vielleicht gekappt → gesperrt.
//  4. Kooperative Sperre (`acquire` auf `vmod/lock`) gegen zwei Tabs; Versionsmarke `app/schema.vocabModule` per `transform`.
//  5. Je Dokument EIN `transform` auf dem frischen Stand: schreibt NUR `lex`; ein Dokument mit `lex.mig` wird übersprungen (idempotent,
//     ein Abbruch hinterlässt keinen Mischstand). Alte Felder bleiben bytegleich. Kein Löschen, kein Schreiben nach daily/* oder feed/*.
//  6. Verlauf: nachgespielte Antworten mit Flag „umgerechnet“ in `vlog/*`, feste Schlüssel → ein zweiter Lauf ändert nichts.

type Doc = Record<string, unknown>;

export type DryRow = { path: string; lv: number; uDue: number | null; bDue: number | null; h: number; full: 0 | 1 };
export type MigrationReport = {
  rows: DryRow[];
  skipped: { path: string; why: string }[];
  dupes: DupePair[];
  /** Tage, an denen `log/<Tag>` die Kappung von 300 Einträgen erreicht hat (Verlauf dort unvollständig). */
  logDaysCapped: number;
  /** Karten mit vollem `hist` (12) und mehr Wiederholungen. */
  histFull: number;
  lexemes: number;
  cards: number;
  vlogEntries: number;
};

export type MigrationInput = {
  docs: ReadonlyMap<string, Doc>;
  logs: ReadonlyMap<string, readonly LogEntry[]>;
  nowMs: number;
  /** Von Emrah bestätigte Doppel: [führend, Doppel]. */
  confirmedPairs?: readonly (readonly [string, string])[];
};

const LOG_CAP = 300;
const isCard = (p: string) => /^(vocab|chunk)\/[^/]+$/.test(p);

/** Doppel zusammenführen (nur bestätigte Paare): Verlauf beider Dokumente nach `t` sortiert, gemeinsam nachgespielt (§9.2 Schritt 2). */
function mergedDoc(lead: Doc, other: Doc): Doc {
  const arr = (v: unknown): unknown[] => (Array.isArray(v) ? (v as unknown[]) : []);
  const h = [...arr(lead.hist), ...arr(other.hist)].filter((x): x is Doc => !!x && typeof x === 'object' && typeof (x as Doc).t === 'number');
  const byT = new Map<number, Doc>();
  for (const x of h) byT.set(x.t as number, x);
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return { ...lead, hist: [...byT.values()].sort((a, b) => (a.t as number) - (b.t as number)), reps: num(lead.reps) + num(other.reps) };
}

/** Alles rechnen, nichts schreiben. */
export function convertAll(inp: MigrationInput): { converted: Converted[]; report: MigrationReport; lexByPath: Map<string, Lex> } {
  const pairs = new Map<string, string>(); // Doppel → führend
  for (const [lead, other] of inp.confirmedPairs ?? []) if (lead !== other && inp.docs.has(lead) && inp.docs.has(other)) pairs.set(other, lead);
  for (const [o, l] of pairs) if (pairs.has(l)) pairs.delete(o); // keine Ketten: `of` zeigt nie auf ein Doppel
  const converted: Converted[] = [];
  const skipped: MigrationReport['skipped'] = [];
  let histFull = 0;
  let cards = 0;
  const dupeIn: DupeInput[] = [];
  for (const [path, doc] of inp.docs) {
    if (!isCard(path)) continue;
    cards++;
    const isLead = [...pairs.values()].includes(path);
    const src = isLead ? mergedDoc(doc, inp.docs.get([...pairs].find(([, l]) => l === path)![0]) ?? {}) : doc;
    const c = convertDoc(path, src, inp.nowMs, inp.logs);
    if (c.report.histFull) histFull++;
    if (!c.lex) {
      skipped.push({ path, why: c.skip ?? 'invalid' });
      continue;
    }
    const lead = pairs.get(path);
    if (lead) c.lex = { ...c.lex, of: lead };
    converted.push(c);
    const head = path.startsWith('chunk/') ? doc.en : doc.word;
    if (typeof head === 'string')
      dupeIn.push({ path, head, k: kindOf(path, doc), de: typeof doc.de === 'string' ? doc.de : null, pos: typeof doc.pos === 'string' ? doc.pos : null, reps: typeof doc.reps === 'number' ? doc.reps : 0, last: typeof doc.last === 'number' ? doc.last : 0 });
  }
  // Rückstand beim Umstieg über 7 Lerntage (F4) – nur `due` der Spuren.
  const cat = new Catalog(converted.map((c, i) => ({ path: c.path, lex: c.lex as Lex, order: i })));
  for (const [p, lex] of spreadBacklog(cat, inp.nowMs, {})) {
    const c = converted.find((x) => x.path === p);
    if (c) c.lex = lex;
  }
  const lexByPath = new Map(converted.map((c) => [c.path, c.lex as Lex]));
  const logDaysCapped = [...inp.logs.values()].filter((l) => l.length >= LOG_CAP).length;
  const report: MigrationReport = {
    rows: converted.map((c) => ({ path: c.path, lv: c.lex!.lv, uDue: c.lex!.intro ? c.lex!.u.due : null, bDue: c.lex!.b?.due ?? null, h: c.report.h, full: c.report.full })),
    skipped,
    dupes: findDupes(dupeIn),
    logDaysCapped,
    histFull,
    lexemes: converted.filter((c) => !c.lex!.of).length,
    cards,
    vlogEntries: converted.reduce((a, c) => a + c.log.length, 0),
  };
  return { converted, report, lexByPath };
}

export function dryRun(inp: MigrationInput): MigrationReport {
  return convertAll(inp).report;
}

export type RunGuards = { confirmed: boolean; backupWritten: boolean; profileValid: boolean; possiblyTruncated: boolean; holder: string };
export type RunOutcome = { state: 'blocked' | 'busy' | 'done' | 'already'; why?: string; written: number; skipped: number; vlogDocs: number };

/** Schreibt die Umrechnung. Idempotent: ein zweiter Lauf (auch aus einem zweiten Tab) ändert nichts. */
export async function runMigration(writer: Writer, inp: MigrationInput, g: RunGuards): Promise<RunOutcome> {
  const none = (state: RunOutcome['state'], why?: string): RunOutcome => ({ state, ...(why ? { why } : {}), written: 0, skipped: 0, vlogDocs: 0 });
  if (!g.profileValid) return none('blocked', 'profile_invalid');
  if (g.possiblyTruncated) return none('blocked', 'possibly_truncated');
  if (!g.confirmed) return none('blocked', 'not_confirmed');
  if (!g.backupWritten) return none('blocked', 'no_backup');
  const lock = await writer.acquire(VOCAB_LOCK_PATH, { holder: g.holder, ttlMs: 120_000 });
  if (!lock.acquired) return none('busy');
  let done = false;
  await writer.transform('app/schema', (cur) => {
    const mark = cur && typeof cur.vocabModule === 'object' ? vocabModuleMarkSchema.safeParse(cur.vocabModule) : null;
    if (mark?.success && mark.data.state === 'done') {
      done = true;
      return null;
    }
    const next = { v: 1 as const, t: inp.nowMs, state: 'running' as const };
    return cur ? { update: { vocabModule: next } } : null;
  });
  if (done) return none('already');
  const { converted } = convertAll(inp);
  let written = 0;
  let skipped = 0;
  for (const c of converted) {
    const parsed = lexWriteSchema.safeParse(c.lex);
    if (!parsed.success) {
      logError('vocab:migrate', parsed.error, c.path);
      skipped++;
      continue;
    }
    const before = inp.docs.get(c.path);
    const r = await writer.transform(c.path, (cur) => {
      if (!cur) return null;
      if (cur.lex && typeof cur.lex === 'object') return null; // schon umgerechnet (oder künftige Version): nie anfassen
      // Hat sich das Dokument seit dem Trockenlauf geändert (alter Bereich hat geantwortet), wird es aus dem FRISCHEN Stand neu gerechnet.
      if (before && (cur.last !== before.last || cur.reps !== before.reps)) {
        const fresh = convertDoc(c.path, cur, inp.nowMs, inp.logs);
        if (!fresh.lex) return null;
        return { update: { lex: { ...fresh.lex, of: c.lex!.of } } };
      }
      return { update: { lex: parsed.data } };
    });
    if (r === 'updated') written++;
    else skipped++;
  }
  // Verlauf übertragen: feste Schlüssel (Zeit + Kennung aus dem Pfad), je Halbmonat ein Schreibvorgang.
  const tuples: VlogTuple[] = converted.flatMap((c) => c.log);
  let vlogDocs = 0;
  try {
    vlogDocs = await writeVlog({ writer, device: 'migr' }, tuples, (tp) => `m${(hash32(tp[1]) % 46_656).toString(36).padStart(3, '0')}`);
  } catch (err) {
    logWarn('vocab:migrate', err, 'vlog');
  }
  await writer.transform('app/schema', (cur) => (cur ? { update: { vocabModule: { v: 1, t: inp.nowMs, state: 'done' } } } : null));
  logWarn('vocab:migrate', null, `umgerechnet ${written}, übersprungen ${skipped}, vlog ${vlogDocs} (${dayKey(inp.nowMs)})`);
  return { state: 'done', written, skipped, vlogDocs };
}
