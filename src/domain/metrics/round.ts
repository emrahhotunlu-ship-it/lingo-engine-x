import { dayKey } from '../date';
import { isLearningState } from '../srs/scheduler';
import type { TrainCard } from '../srs/types';
import { UNIT_STATES, unitState, type UnitState } from './definitions';

// Wachstum einer Runde statt Antwortzahl (Motivation §4.7): Was ist aufgestiegen, wie lange hält das Gedächtnis jetzt, was kommt morgen
// wieder. Die Runde hält den Stand vom Start (`before`), der Stand danach ist live (`after`). Rein, nichts wird geschrieben.

const DAY_MS = 86_400_000;
/** Mindestzahl Karten für die Gedächtnis-Zeit (darunter keine Zeile). */
export const MEMORY_MIN_CARDS = 5;
/** Höchstzahl der genannten Namen (Rest nur als Zahl). */
export const GROWTH_NAMES_MAX = 6;

export type RoundUp = { id: string; word: string; to: UnitState };
export type RoundGrowth = {
  /** Aufgestiegene Karten (Zustand höher als zum Start), in Reihenfolge des Starts. */
  up: RoundUp[];
  /** Gedächtnis-Zeit (Mediane in Tagen, „geschätzt“); `null`, wenn n < 5 oder der Median nicht gestiegen ist. */
  memory: { n: number; before: number; after: number } | null;
  /** Karten, die einen Zustand zurückgefallen sind (z. B. Fest → Lernt); sie kommen morgen wieder. */
  down: number;
};

const rank = (s: UnitState): number => UNIT_STATES.indexOf(s);

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
};
const round1 = (x: number): number => Math.round(x * 10) / 10;

/**
 * Gedächtnis-Zeit: nur Karten, die vorher im FSRS-Zustand „Review“ waren (keine Lernschritte, keine neuen) und in dieser Runde ihre erste
 * Antwort des Tages bekamen. vorher = `due − last` vor der Runde, nachher = `due` nach der Runde minus Antwortzeit, je in Tagen.
 */
export function roundGrowth(before: readonly TrainCard[], after: readonly TrainCard[]): RoundGrowth {
  const was = new Map(before.map((c) => [c.key, c]));
  const up: RoundUp[] = [];
  let down = 0;
  const b: number[] = [];
  const a: number[] = [];
  for (const c of after) {
    const o = was.get(c.key);
    if (!o || c.hidden || o.hidden) continue;
    const from = unitState(o);
    const to = unitState(c);
    if (rank(to) > rank(from)) up.push({ id: c.key, word: c.word, to });
    else if (rank(to) < rank(from) && !o.isNew) down++;
    const lastBefore = o.fsrs.last;
    const lastAfter = c.fsrs.last;
    if (o.isNew || isLearningState(o.fsrs) || isLearningState(c.fsrs) || c.isNew) continue;
    if (lastBefore === null || lastAfter === null || lastAfter <= lastBefore) continue;
    if (dayKey(lastBefore) === dayKey(lastAfter)) continue;
    b.push((o.fsrs.due - lastBefore) / DAY_MS);
    a.push((c.fsrs.due - lastAfter) / DAY_MS);
  }
  const n = b.length;
  const mb = n ? median(b) : 0;
  const ma = n ? median(a) : 0;
  const memory = n >= MEMORY_MIN_CARDS && ma > mb ? { n, before: round1(mb), after: round1(ma) } : null;
  return { up, memory, down };
}
