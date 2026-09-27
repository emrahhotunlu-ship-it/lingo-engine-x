import { useMemo } from 'react';
import { useClock } from '../../app/clock';
import { useLive } from '../../data/live';
import { deriveToday, mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import type { DutyId, TodayState } from '../../domain/plan/types';
import type { Ctx, DutyChannel } from '../../domain/learn/types';
import { pflichtMarked } from '../../domain/plan/pflicht';
import { usePending } from '../progress/persist';
import { useTodayPlan } from './store';

// Der Stand von „Heute" aus EINER Ableitung (`deriveToday`, phase2-plan §6.2): Statuszeile,
// Zähler, Häkchen, Heldenkarte, Reiter-Zahl und „Weiter: nächster Pflichtschritt" lesen alle
// dasselbe (Kap. 2.2). Live-Daten ⊕ noch nicht bestätigter Puffer.

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const EMPTY: DayEntry[] = [];

type Sources = {
  day: string;
  plan: ReturnType<typeof useTodayPlan.getState>['plan'];
  exhausted: boolean;
  profile: Obj | null | undefined;
  course: Obj | null | undefined;
  liveEntries: readonly DayEntry[];
  pending: ReturnType<typeof usePending.getState>;
};

function derive(s: Sources): TodayState {
  const entries = mergeEntries(
    s.liveEntries,
    s.pending.entries.filter((e) => e.day === s.day),
  );
  const minutes = Number(obj(obj(s.profile).minutes)[s.day] ?? 0) + (s.pending.minutes[s.day] ?? 0);
  return deriveToday({
    day: s.day,
    plan: s.plan,
    entries,
    minutes: Number.isFinite(minutes) ? minutes : 0,
    pflichtMarked: pflichtMarked(s.profile, s.day),
    exhausted: s.exhausted,
    course: s.course ?? null,
    act: obj(s.profile).act,
    pending: { lessonDays: s.pending.lessonDays, rounds: s.pending.rounds },
  });
}

function liveEntriesOf(day: string): DayEntry[] {
  const live = useLive.getState().day;
  return live?.key === day && live.doc && Array.isArray(live.doc.entries) ? (live.doc.entries as DayEntry[]) : EMPTY;
}

/** Stand für einen Lerntag, ohne Hook (für Klick-Handler und den Pflicht-Resolver). */
export function computeToday(day: string): TodayState {
  const p = useTodayPlan.getState();
  const live = useLive.getState();
  return derive({
    day,
    plan: p.day === day ? p.plan : null,
    exhausted: p.exhausted === day,
    profile: live.docs['app/profile'],
    course: live.docs['app/course'],
    liveEntries: liveEntriesOf(day),
    pending: usePending.getState(),
  });
}

/**
 * B1: Stand eines Lerntags mit ausdrücklich gegebenem Plan – auch für den Vortag, wenn der
 * Sammel-Stapel erst nach 04:00 ankommt. `entries` = zuletzt bekannte Live-Einträge dieses Tages
 * (das Live-Abo zeigt nach dem Tageswechsel schon den neuen Tag).
 */
export function computeDayWith(i: { day: string; plan: ReturnType<typeof useTodayPlan.getState>['plan']; exhausted: boolean; entries?: readonly DayEntry[] }): TodayState {
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
  });
}

/** Stand von „Heute" als Hook. */
export function useToday(): TodayState & { ready: boolean; dayLoaded: boolean } {
  const today = useClock((s) => s.today);
  const plan = useTodayPlan((s) => (s.day === today ? s.plan : null));
  const planStatus = useTodayPlan((s) => (s.day === today ? s.status : 'idle'));
  const exhausted = useTodayPlan((s) => s.exhausted === today);
  const profile = useLive((s) => s.docs['app/profile']);
  const course = useLive((s) => s.docs['app/course']);
  const day = useLive((s) => s.day);
  const pending = usePending();
  const liveEntries = day?.key === today && day.doc && Array.isArray(day.doc.entries) ? (day.doc.entries as DayEntry[]) : EMPTY;
  const dayLoaded = day?.key === today && day.doc !== undefined;
  const state = useMemo(
    () => derive({ day: today, plan, exhausted, profile, course, liveEntries, pending }),
    [today, plan, exhausted, profile, course, liveEntries, pending],
  );
  return { ...state, ready: planStatus === 'ready' || planStatus === 'local', dayLoaded };
}

/** Kanal-Kennung eines Pflichtpunkts `ch:<id>`. */
export const dutyChannel = (id: DutyId): DutyChannel | null => (id.startsWith('ch:') ? (id.slice(3) as DutyChannel) : null);

/**
 * `ctx` einer Runde (D9): Eine Lektion bzw. eine Kanal-Runde, die gestartet wird, solange der
 * Punkt heute Pflicht und offen ist, läuft mit `ctx:'duty'` – egal von wo aus sie gestartet wird.
 */
export function roundCtx(kind: 'lesson' | DutyChannel, day: string): Ctx {
  const st = computeToday(day);
  const id: DutyId = kind === 'lesson' ? 'lesson' : `ch:${kind}`;
  return st.duties.items.some((d) => d.id === id && d.state === 'open') ? 'duty' : 'xtra';
}

/** Erster offener Pflichtpunkt (Heldenkarte, „Weiter: …", M11). */
export function firstOpenDuty(st: TodayState): DutyId | null {
  return st.duties.items.find((d) => d.state === 'open')?.id ?? null;
}
