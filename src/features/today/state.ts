import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { useLive } from '../../data/live';
import { deriveToday, mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import type { DutyId, StoredPlan, TodayState } from '../../domain/plan/types';
import type { Ctx, DutyChannel } from '../../domain/learn/types';
import { pflichtMarked } from '../../domain/plan/pflicht';
import { usePending } from '../progress/persist';
import { useUnitRun } from '../unit/runStore';
import { viewPlan } from './device';
import { useUnitMarks } from './marks';
import { useTodayPlan } from './store';

// Der Stand von „Heute" aus EINER Ableitung (`deriveToday`, phase2-plan §6.2): Statuszeile,
// Zähler, Häkchen, Tageskarte, Reiter-Zahl und „Weiter: nächster Pflichtschritt" lesen alle
// dasselbe (Kap. 2.2). Live-Daten ⊕ noch nicht bestätigter Puffer ⊕ optimistisch erledigte Blöcke.
//
// Neubau (leistung.md §4 Nr. 7, Anhang A Nr. 7): Die Ableitung läuft EINMAL in einem Store
// (`useTodayStore`), nicht in jeder Komponente; Hooks lesen sie nur mit Selektor.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const EMPTY: DayEntry[] = [];
const NO_KEYS: readonly string[] = [];

type Pending = Pick<ReturnType<typeof usePending.getState>, 'entries' | 'minutes' | 'lessonDays' | 'rounds'>;

type Sources = {
  day: string;
  plan: StoredPlan | null;
  exhausted: boolean;
  profile: Obj | null | undefined;
  course: Obj | null | undefined;
  liveEntries: readonly DayEntry[];
  pending: Pending;
  marks: readonly string[];
};

function derive(s: Sources): TodayState {
  const entries = mergeEntries(
    s.liveEntries,
    s.pending.entries.filter((e) => e.day === s.day),
  );
  const minutes = Number(obj(obj(s.profile).minutes)[s.day] ?? 0) + (s.pending.minutes[s.day] ?? 0);
  const rounds = s.marks.length ? [...s.pending.rounds, ...s.marks.map((act) => ({ day: s.day, act, partial: false }))] : s.pending.rounds;
  return deriveToday({
    day: s.day,
    plan: s.plan,
    entries,
    minutes: Number.isFinite(minutes) ? minutes : 0,
    pflichtMarked: pflichtMarked(s.profile, s.day),
    exhausted: s.exhausted,
    course: s.course ?? null,
    act: obj(s.profile).act,
    pending: { lessonDays: s.pending.lessonDays, rounds },
  });
}

function liveEntriesOf(day: string): DayEntry[] {
  const live = useLive.getState().day;
  return live?.key === day && live.doc && Array.isArray(live.doc.entries) ? (live.doc.entries as DayEntry[]) : EMPTY;
}

const marksOf = (day: string): readonly string[] => useUnitMarks.getState().done[day] ?? NO_KEYS;

/** Stand für einen Lerntag, ohne Hook (für Klick-Handler und den Pflicht-Resolver). */
export function computeToday(day: string): TodayState {
  const p = useTodayPlan.getState();
  const live = useLive.getState();
  return derive({
    day,
    plan: viewPlan(p.day === day ? p.plan : null),
    exhausted: p.exhausted === day,
    profile: live.docs['app/profile'],
    course: live.docs['app/course'],
    liveEntries: liveEntriesOf(day),
    pending: usePending.getState(),
    marks: marksOf(day),
  });
}

/**
 * B1: Stand eines Lerntags mit ausdrücklich gegebenem Plan – auch für den Vortag, wenn der
 * Sammel-Stapel erst nach 04:00 ankommt. `entries` = zuletzt bekannte Live-Einträge dieses Tages
 * (das Live-Abo zeigt nach dem Tageswechsel schon den neuen Tag).
 */
export function computeDayWith(i: { day: string; plan: StoredPlan | null; exhausted: boolean; entries?: readonly DayEntry[] }): TodayState {
  const live = useLive.getState();
  const current = liveEntriesOf(i.day);
  return derive({
    day: i.day,
    plan: i.plan,
    exhausted: i.exhausted,
    profile: live.docs['app/profile'],
    course: live.docs['app/course'],
    liveEntries: live.day?.key === i.day ? current : (i.entries ?? EMPTY),
    pending: usePending.getState(),
    marks: marksOf(i.day),
  });
}

// ------------------------------------------------------------------ abgeleiteter Store

export type TodayView = TodayState & {
  /** Plan des Lerntags steht (gespeichert oder lokal). */
  ready: boolean;
  /** `log/<heute>` ist geladen (Zähler aus dem Protokoll sind verlässlich). */
  dayLoaded: boolean;
  plan: StoredPlan | null;
  planStatus: ReturnType<typeof useTodayPlan.getState>['status'];
};

type Inputs = {
  today: string;
  plan: StoredPlan | null;
  planStatus: TodayView['planStatus'];
  exhausted: boolean;
  profile: Obj | null | undefined;
  course: Obj | null | undefined;
  day: ReturnType<typeof useLive.getState>['day'];
  entries: Pending['entries'];
  minutes: Pending['minutes'];
  lessonDays: Pending['lessonDays'];
  rounds: Pending['rounds'];
  marks: readonly string[];
};

function readInputs(): Inputs {
  const today = useClock.getState().today;
  const p = useTodayPlan.getState();
  const live = useLive.getState();
  const pend = usePending.getState();
  return {
    today,
    // Handy-Ansicht (Emrah 01.10.2026): am Handy ohne die Aufgabe des Tages; sonst der Plan wie gespeichert.
    plan: viewPlan(p.day === today ? p.plan : null),
    planStatus: p.day === today ? p.status : 'idle',
    exhausted: p.exhausted === today,
    profile: live.docs['app/profile'],
    course: live.docs['app/course'],
    day: live.day,
    entries: pend.entries,
    minutes: pend.minutes,
    lessonDays: pend.lessonDays,
    rounds: pend.rounds,
    marks: marksOf(today),
  };
}

function view(i: Inputs): TodayView {
  const liveEntries = i.day?.key === i.today && i.day.doc && Array.isArray(i.day.doc.entries) ? (i.day.doc.entries as DayEntry[]) : EMPTY;
  const state = derive({
    day: i.today,
    plan: i.plan,
    exhausted: i.exhausted,
    profile: i.profile,
    course: i.course,
    liveEntries,
    pending: { entries: i.entries, minutes: i.minutes, lessonDays: i.lessonDays, rounds: i.rounds },
    marks: i.marks,
  });
  return {
    ...state,
    ready: i.planStatus === 'ready' || i.planStatus === 'local',
    dayLoaded: i.day?.key === i.today && i.day.doc !== undefined,
    plan: i.plan,
    planStatus: i.planStatus,
  };
}

const sameInputs = (a: Inputs, b: Inputs): boolean => (Object.keys(a) as Array<keyof Inputs>).every((k) => a[k] === b[k]);

let lastInputs: Inputs | null = null;
let installed = false;

// Anfangswert ohne Zugriff auf andere Stores (Import-Schleife mit `store.ts`); `install` füllt ihn.
const EMPTY_VIEW: TodayView = {
  day: '',
  status: 'noPlan',
  duties: { done: 0, total: 0, missing: [], items: [] },
  review: { done: 0, total: 0 },
  extra: 0,
  balance: { answers: 0, correct: 0, minutes: 0, talks: 0, biz: 0, repaired: 0 },
  ready: false,
  dayLoaded: false,
  plan: null,
  planStatus: 'idle',
};

export const useTodayStore = create<TodayView>(() => EMPTY_VIEW);

function refresh(): void {
  const next = readInputs();
  if (lastInputs && sameInputs(lastInputs, next)) return;
  lastInputs = next;
  useTodayStore.setState(view(next), true);
}

/** Abos der Quellen einmal anlegen (erst beim ersten Gebrauch: keine Import-Schleife mit `store.ts`). */
function install(): void {
  if (installed) return;
  installed = true;
  lastInputs = readInputs();
  useTodayStore.setState(view(lastInputs), true);
  useClock.subscribe(refresh);
  useTodayPlan.subscribe(refresh);
  useLive.subscribe(refresh);
  usePending.subscribe(refresh);
  useUnitMarks.subscribe(refresh);
  // Einstellungen (z. B. Sprache): die Ansicht sofort nachziehen.
  useSettings.subscribe(refresh);
}

/** Stand von „Heute" als Hook – nur mit Selektor (ohne Selektor: der ganze, stabile Stand). */
export function useToday(): TodayView;
export function useToday<T>(sel: (s: TodayView) => T): T;
export function useToday<T>(sel?: (s: TodayView) => T): T | TodayView {
  install();
  return useTodayStore((sel ?? ((s: TodayView) => s)) as (s: TodayView) => T | TodayView);
}

/** Aktueller abgeleiteter Stand ohne Hook. */
export function todayNow(): TodayView {
  install();
  return useTodayStore.getState();
}

/** Kanal-Kennung eines Pflichtpunkts `ch:<id>`. */
export const dutyChannel = (id: DutyId): DutyChannel | null => (id.startsWith('ch:') ? (id.slice(3) as DutyChannel) : null);

/**
 * `ctx` einer Runde (D9): Eine Lektion bzw. eine Kanal-Runde, die gestartet wird, solange der
 * Punkt heute Pflicht und offen ist, läuft mit `ctx:'duty'` – egal von wo aus sie gestartet wird.
 */
export function roundCtx(kind: 'lesson' | DutyChannel, day: string): Ctx {
  // Neubau: Ein Ersatzblock der Tageseinheit (z. B. Fokus als Grammatikrunde) ist Pflicht, kein Extra.
  const run = useUnitRun.getState();
  if (run.day === day && run.watch === kind) return 'duty';
  const st = computeToday(day);
  const id: DutyId = kind === 'lesson' ? 'lesson' : `ch:${kind}`;
  return st.duties.items.some((d) => d.id === id && d.state === 'open') ? 'duty' : 'xtra';
}

/** Erster offener Pflichtpunkt (Tageskarte, „Weiter: …", M11). */
export function firstOpenDuty(st: Pick<TodayState, 'duties'>): DutyId | null {
  return st.duties.items.find((d) => d.state === 'open')?.id ?? null;
}
