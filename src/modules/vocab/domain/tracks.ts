import { createEmptyCard, fsrs, generatorParameters, type Card, type FSRS } from 'ts-fsrs';
import type { Grade, Track } from './types';

// Wörter-Modul V1: FSRS je Spur (M1, M7; plan.md §4.1–4.2). ts-fsrs ist auf exakt 5.4.2 festgelegt (Unit-Test).
// `enable_fuzz: false` (die Streuung macht `fuzz.ts` mit Lastausgleich), `enable_short_term: false` (Lernschritte macht das Modul, §4.3):
// jeder Termin liegt also mindestens einen Tag in der Zukunft.

export const MAX_INTERVAL = 365;
const DAY = 86_400_000;
const round4 = (v: number) => Math.round(v * 10_000) / 10_000;

const schedulers = new Map<number, FSRS>();
function scheduler(ret: number): FSRS {
  let s = schedulers.get(ret);
  if (!s) {
    s = fsrs(generatorParameters({ request_retention: ret, maximum_interval: MAX_INTERVAL, enable_fuzz: false, enable_short_term: false }));
    schedulers.set(ret, s);
  }
  return s;
}

export function toCard(t: Track, nowMs: number): Card {
  const last = t.last ?? undefined;
  return {
    due: new Date(t.due),
    stability: t.s,
    difficulty: t.d,
    elapsed_days: last ? Math.max(0, Math.floor((nowMs - last) / DAY)) : 0,
    scheduled_days: t.sd,
    learning_steps: t.ls,
    reps: t.reps,
    lapses: t.lapses,
    state: t.st,
    last_review: last ? new Date(last) : undefined,
  };
}

export function fromCard(c: Card, nowMs: number): Track {
  return { due: Math.round(c.due.getTime()), s: round4(c.stability), d: round4(c.difficulty), st: c.state, reps: c.reps, lapses: c.lapses, last: nowMs, sd: c.scheduled_days, ls: c.learning_steps };
}

/** Neue, leere Spur (fällig sofort). */
export function newTrack(nowMs: number): Track {
  const c = createEmptyCard(new Date(nowMs));
  return { due: nowMs, s: 0, d: 0, st: c.state, reps: 0, lapses: 0, last: null, sd: 0, ls: 0 };
}

/** Eine FSRS-Buchung. Liefert die neue Spur und das rohe Intervall in Tagen (vor Deckel, Fuzz und Lastausgleich). */
export function book(t: Track, g: Grade, nowMs: number, ret: number): { track: Track; ivl: number } {
  const next = scheduler(ret).next(toCard(t, nowMs), new Date(nowMs), g);
  const track = fromCard(next.card, nowMs);
  return { track, ivl: Math.max(1, next.card.scheduled_days) };
}

/**
 * Großpaket A S6: Faktor der Abstände beim Wechsel der Ziel-Behaltensrate `from` → `to` (FSRS-Intervall bei gleicher Stabilität).
 * Kleiner als 1 heißt: kürzere Abstände, also mehr Wiederholungen (Wiederholungsminuten wachsen um 1/Faktor).
 */
export function ivlFactor(from: number, to: number): number {
  const ref = 100;
  return scheduler(to).next_interval(ref, 0) / scheduler(from).next_interval(ref, 0);
}

/** Abrufwahrscheinlichkeit der Spur zum Zeitpunkt `nowMs` (0 bei neuer Spur). */
export function retr(t: Track | null, nowMs: number): number {
  if (!t || t.st === 0 || !(t.s > 0) || t.last === null) return 0;
  return scheduler(0.9).get_retrievability(toCard(t, nowMs), new Date(nowMs), false);
}

/** Stabilität in Tagen nach den Regeln von FSRS für ein gewünschtes Intervall (Umrechnung: S aus altem Stand übernehmen). */
export function trackFrom(o: { s: number; d: number; last: number; due: number; reps: number; lapses: number; st?: number }): Track {
  const sd = Math.max(1, Math.round((o.due - o.last) / DAY));
  return { due: o.due, s: round4(Math.max(0.1, o.s)), d: round4(Math.min(10, Math.max(1, o.d))), st: o.st ?? 2, reps: Math.max(1, o.reps), lapses: Math.max(0, o.lapses), last: o.last, sd, ls: 0 };
}
