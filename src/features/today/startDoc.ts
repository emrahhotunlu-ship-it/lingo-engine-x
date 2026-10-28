import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { TODAY_DOC_V, writeTodayDoc, type TodayDoc, type TodayDocBlock } from '../../data/todayDoc';
import { todaySummary } from '../../domain/metrics';
import type { DutyState, StoredPlan } from '../../domain/plan/types';
import { unitRows } from '../../domain/unit/rows';
import { logError } from '../../platform/diagnostics';
import { topicName } from '../grammar/topicUi';
import { usePending } from '../progress/persist';
import { viewPlan } from './device';
import { computeToday } from './state';
import { useTodayPlan } from './store';

// Startbild `app/today` ableiten und schreiben (Relaunch Stufe 1 P6, stufe1-plan §4.3). Die Zahlen kommen aus DEMSELBEN
// `metrics.todaySummary` wie die Tageskarte (Auflage 1); Blöcke aus `unitRows` (alter Plan: Pflichtpunkte in Reihenfolge).
//
// Schreibanlässe (W1, contract/db.d.ts 279–286): NUR
//  - `ensureDay` (Lerntag festgelegt bzw. neu: einmal je Lerntag eine echte Zustandsänderung; Uhr-Ticks im selben Lerntag rufen das nicht auf),
//  - Nutzeraktionen: Block abgeschlossen (`markBlockDone`), Runde beendet (`recordRoundEnd` → Sammel-Puffer), Plan angepasst (Kapitelwahl).
// Nie aus einem Snapshot-Rückruf der Datenbank, nie aus einem Zeitgeber, nie beim Zeichnen.

type Items = readonly DutyState[];

/** Das Startbild eines Lerntags aus Plan und Pflichtzustand (rein). Ohne Plan oder ohne Pflichtschritte: `null` (nichts zu zeigen). */
export function deriveTodayDoc(i: { day: string; plan: StoredPlan | null; items: Items; at: number }): TodayDoc | null {
  const { plan, items } = i;
  if (!plan || !items.length) return null;
  const sum = todaySummary({ plan, items });
  const rows = unitRows(plan, items);
  const blocks: TodayDocBlock[] = rows
    ? rows.map((r) => ({ st: r.state, ...progressOf(r.state, r.progress), k: String(r.kind), bl: r.block, m: r.min, ...(r.fmt ? { f: r.fmt } : {}), id: r.id }))
    : legacyBlocks(items);
  const b: Record<string, TodayDocBlock> = {};
  blocks.forEach((x, k) => {
    b[`b${k + 1}`] = x;
  });
  const now = blocks.find((x) => x.st === 'now');
  const doc: TodayDoc = { v: TODAY_DOC_V, d: i.day, b, rest: sum.rest, ring: round3(sum.ring) };
  const th = themeOf(plan);
  if (th) doc.th = th;
  if (now) doc.go = { k: now.k, id: now.id };
  doc.at = i.at;
  return doc;
}

const round3 = (x: number): number => Math.round(x * 1000) / 1000;

function progressOf(state: TodayDocBlock['st'], p: DutyState['progress']): { n: number; of: number } {
  if (p && p.total > 0) return { n: Math.max(0, Math.min(p.done, p.total)), of: p.total };
  return state === 'done' ? { n: 1, of: 1 } : { n: 0, of: 1 };
}

function legacyBlocks(items: Items): TodayDocBlock[] {
  let nowSet = false;
  return items.map((d) => {
    const st: TodayDocBlock['st'] = d.state === 'done' ? 'done' : nowSet ? 'open' : 'now';
    if (d.state !== 'done') nowSet = true;
    return { st, ...progressOf(st, d.progress), k: d.id === 'review' ? 'review' : 'legacy', bl: 0, m: 0, id: d.id };
  });
}

/** Thema des Tages aus dem eingefrorenen `u.gt` (wie der Titel der Tageskarte): Kapitel, neues Thema oder Thema. */
function themeOf(plan: StoredPlan): TodayDoc['th'] | null {
  const gt = plan.u?.gt;
  if (!gt) return null;
  const head = gt.intro ?? gt.topics[0] ?? null;
  if (!head) return null;
  const k: NonNullable<TodayDoc['th']>['k'] = gt.ch ? 'ch' : gt.intro ? 'intro' : 'topic';
  return { k, id: head, nm: { de: topicName(head, 'de'), en: topicName(head, 'en') }, ...(gt.ch ? { ch: gt.ch } : {}) };
}

// ------------------------------------------------------------------ Schreiben (nur aus den erlaubten Anlässen)

/** Ist `log/<day>` geladen (sonst wären erledigte Blöcke noch „offen“ und das Bild falsch)? */
const dayLoaded = (day: string): boolean => {
  const d = useLive.getState().day;
  return d?.key === day && d.doc !== undefined;
};

let chain: Promise<unknown> = Promise.resolve();

/**
 * Startbild für `day` jetzt ableiten und – nur bei Änderung ohne `at` – ersetzen. Nur mit gespeichertem Plan (`status: 'ready'`, ein
 * lokaler Plan bleibt lokal) und geladenem Tagesprotokoll. Liefert, was geschehen ist (Tests).
 */
export function syncTodayDoc(day: string, reason: 'day' | 'block' | 'round' | 'plan'): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> {
  const run = async (): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> => {
    const p = useTodayPlan.getState();
    const writer = getWriter();
    if (!writer || p.day !== day || p.status !== 'ready' || !p.plan || !dayLoaded(day)) return 'skipped';
    const st = computeToday(day);
    const next = deriveTodayDoc({ day, plan: viewPlan(p.plan) ?? p.plan, items: st.duties.items, at: Date.now() });
    if (!next) return 'skipped';
    return writeTodayDoc(writer, next);
  };
  const out = chain.then(run).catch((err: unknown) => {
    logError('today:doc', err, reason);
    return 'skipped' as const;
  });
  chain = out;
  return out;
}

/**
 * `ensureDay`: Das Tagesprotokoll kann nach einem Tageswechsel noch unterwegs sein. Dann wartet der Anlass auf GENAU dieses erste
 * Laden (kein Zeitgeber, keine Schleife) und schreibt einmal; wechselt inzwischen der Lerntag, entfällt er.
 */
export function syncTodayDocForDay(day: string): Promise<'created' | 'updated' | 'unchanged' | 'skipped'> {
  if (dayLoaded(day)) return syncTodayDoc(day, 'day');
  return new Promise((resolve) => {
    const stop = useLive.subscribe((s) => {
      if (useTodayPlan.getState().day !== day) {
        stop();
        resolve('skipped');
        return;
      }
      if (s.day?.key !== day || s.day.doc === undefined) return;
      stop();
      resolve(syncTodayDoc(day, 'day'));
    });
  });
}

let roundsInstalled = false;

/**
 * Runde beendet (Nutzeraktion): Rundenenden landen im Sammel-Puffer (`usePending.rounds`, lokal, nicht aus der Datenbank). Einmal
 * installiert; jede neue, vollständige Runde des laufenden Lerntags ersetzt danach das Startbild, falls es sich geändert hat.
 */
export function installTodayDocRounds(): void {
  if (roundsInstalled) return;
  roundsInstalled = true;
  usePending.subscribe((s, prev) => {
    if (s.rounds === prev.rounds) return;
    const day = useTodayPlan.getState().day;
    if (!day) return;
    const added = s.rounds.filter((r) => !prev.rounds.includes(r));
    if (added.some((r) => r.day === day)) void syncTodayDoc(day, 'round');
  });
}

/** Nur für Tests. */
export function resetStartDocForTests(): void {
  chain = Promise.resolve();
}
