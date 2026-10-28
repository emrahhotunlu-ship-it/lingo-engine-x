import { getWriter } from '../../data';
import { useLive } from '../../data/live';
import { TODAY_DOC_V, writeTodayDoc, type TodayDoc, type TodayDocBlock } from '../../data/todayDoc';
import { jsonEqual } from '../../domain/equal';
import { todaySummary } from '../../domain/metrics';
import { legacyDutyMinutes, readPlan } from '../../domain/plan/buildPlan';
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
    return { st, ...progressOf(st, d.progress), k: d.id === 'review' ? 'review' : 'legacy', bl: 0, m: legacyDutyMinutes(d.id), id: d.id };
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

/**
 * Ist der verwendete Plan schon gespeichert, d. h. steht in `app/profile.plan` (Live-Store) für `day` genau dieser Plan? Sonst zeigte das
 * Startbild einen Plan, den die Datenbank (noch) nicht kennt – etwa direkt nach dem Bau, bevor das Speichern zurückkommt (data-guard Soll 3).
 * Beide Seiten gehen durch `readPlan` (gleiche Normalform).
 */
const planStored = (day: string, plan: StoredPlan): boolean => {
  const stored = readPlan(useLive.getState().docs['app/profile']?.plan, day);
  const mine = readPlan(plan, day);
  return !!stored && !!mine && jsonEqual(stored, mine);
};

/** Bedingungen, unter denen das Startbild für `day` geschrieben werden darf (ohne Schreiber und ohne Fehlerstand des Sammel-Puffers). */
const syncReady = (day: string): boolean => {
  const p = useTodayPlan.getState();
  return p.day === day && p.status === 'ready' && !!p.plan && dayLoaded(day) && planStored(day, p.plan);
};

let chain: Promise<unknown> = Promise.resolve();

type SyncResult = 'created' | 'updated' | 'unchanged' | 'skipped';

/**
 * Startbild für `day` jetzt ableiten und – nur bei Änderung ohne `at` – ersetzen. Nur mit gespeichertem Plan (`status: 'ready'` UND derselbe
 * Plan steht schon in `app/profile.plan`; ein lokaler Plan bleibt lokal), geladenem Tagesprotokoll und ohne fehlgeschlagenes Speichern im
 * Sammel-Puffer (sonst wäre der Stand nur optimistisch, Tarek S5). Liefert, was geschehen ist (Tests).
 */
export function syncTodayDoc(day: string, reason: 'day' | 'block' | 'round' | 'plan'): Promise<SyncResult> {
  const run = async (): Promise<SyncResult> => {
    const writer = getWriter();
    if (!writer || !syncReady(day) || usePending.getState().failed) return 'skipped';
    const p = useTodayPlan.getState();
    if (!p.plan) return 'skipped';
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

/** Der eine Wartende je Lerntag (Tarek S1): weitere `ensureDay`-Aufrufe desselben Tages hängen sich an ihn, statt neue anzulegen. */
let waiting: { day: string; promise: Promise<SyncResult>; end: (r: SyncResult) => void } | null = null;

/**
 * `ensureDay` (und die Kapitelwahl, deren neuer Plan erst gespeichert zurückkommen muss): Tagesprotokoll oder gespeicherter Plan können noch
 * unterwegs sein. Dann wartet der Anlass auf GENAU diesen ersten Stand und schreibt einmal. Das ist ein einmaliger, AUFGESCHOBENER Anlass
 * (stufe1-plan §4.3, Ausnahme), kein snapshot-getriebenes Schreiben: Der Wartende entsteht nur aus `ensureDay` bzw. der Nutzeraktion,
 * höchstens einer je Lerntag, schreibt höchstens einmal und meldet sich danach ab; spätere Snapshots lösen nichts mehr aus. Kein Zeitgeber,
 * keine Schleife. Wechselt inzwischen der Lerntag, endet er mit `'skipped'` (der neue Tag bekommt seinen eigenen Wartenden).
 */
export function syncTodayDocForDay(day: string, reason: 'day' | 'plan' = 'day'): Promise<SyncResult> {
  if (waiting?.day === day) return waiting.promise;
  // Ein Wartender eines anderen (alten) Lerntags endet sicher.
  waiting?.end('skipped');
  if (syncReady(day)) return syncTodayDoc(day, reason);
  let stop: () => void = () => undefined;
  let end: (r: SyncResult) => void = () => undefined;
  const promise = new Promise<SyncResult>((resolve) => {
    end = (r) => {
      stop();
      if (waiting?.promise === promise) waiting = null;
      resolve(r);
    };
  });
  const check = (): void => {
    const p = useTodayPlan.getState();
    // Anderer Lerntag, oder der Plan bleibt lokal bzw. ist gescheitert: hier wird nie gespeichert → Warten sicher beenden.
    if (p.day !== day || p.status === 'local' || p.status === 'error') {
      end('skipped');
      return;
    }
    if (!syncReady(day)) return;
    stop();
    if (waiting?.promise === promise) waiting = null;
    void syncTodayDoc(day, reason).then(end);
  };
  waiting = { day, promise, end };
  const offLive = useLive.subscribe(check);
  const offPlan = useTodayPlan.subscribe(check);
  stop = () => {
    offLive();
    offPlan();
  };
  return promise;
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
  waiting?.end('skipped');
  waiting = null;
}
