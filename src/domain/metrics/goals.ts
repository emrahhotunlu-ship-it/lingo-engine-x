import { festForecast, festGrowthUnits } from './vocab';

// Nächstes Ziel (Motivation §4.1): genau EIN Ziel, nah genug, um zu tragen. Rein, nichts wird gespeichert. Die Kennung wird beim Anlegen
// des Tagesplans eingefroren (`u.nx`, P23); die Zahlen sind live.

/** Wort-Marken (MO5): Wörter und Wendungen fest, zusammen. */
export const FEST_MARKS: readonly number[] = [100, 250, 500, 750, 1000, 1500];

export type GoalId = `fest${number}` | `ch${number}` | 'c1check';

export type NextGoal = {
  id: GoalId;
  have: number;
  need: number;
  /** Zeitraum in Wochen (nur Fest-Marken, nur bei ≥ 21 Tagen Daten und Zuwachs); sonst `null`. */
  weeks: [number, number] | null;
};

/** Ein Kandidat neben der Fest-Marke: Kapitel (Muster sicher von Mustern des Kapitels) oder nächster C1-Check (Tage seit dem letzten von Abstand). */
export type GoalCandidate = { id: GoalId; have: number; need: number; from?: number };

type Cand = { id: GoalId; have: number; need: number; from: number; weeks: [number, number] | null };

/** Die nächste Wort-Marke über `n`, samt der Marke davor; `null` nach der letzten. */
export function nextMark(n: number): { mark: number; from: number } | null {
  for (let i = 0; i < FEST_MARKS.length; i++) {
    const m = FEST_MARKS[i] as number;
    if (n < m) return { mark: m, from: i === 0 ? 0 : (FEST_MARKS[i - 1] as number) };
  }
  return null;
}

/**
 * Gewählt wird der Kandidat mit dem kleinsten relativen Restweg: (need − have) geteilt durch den Abstand zwischen letzter und nächster
 * Marke. Bei Gleichstand gewinnt die Fest-Marke (a), dann Kapitel (b), dann Check (c).
 */
export function nextGoal(i: {
  /** Wörter und Wendungen fest (`festUnits`). */
  festUnits: number;
  /** Nur Vokabeln fest (für den Zuwachs, solange `vu` noch keine 28 Tage hat). */
  vocabFest?: number;
  history?: unknown;
  today: string;
  chapter?: GoalCandidate | null;
  check?: GoalCandidate | null;
}): NextGoal | null {
  const cands: Cand[] = [];
  const m = nextMark(i.festUnits);
  if (m) {
    const g = festForecast(i.festUnits, festGrowthUnits({ vocabFest: i.vocabFest ?? i.festUnits, unitsFest: i.festUnits, history: i.history, today: i.today }), m.mark);
    cands.push({ id: `fest${m.mark}`, have: i.festUnits, need: m.mark, from: m.from, weeks: g ? [g.weeksLo, g.weeksHi] : null });
  }
  for (const c of [i.chapter, i.check]) if (c && c.need > c.have) cands.push({ id: c.id, have: c.have, need: c.need, from: c.from ?? 0, weeks: null });
  if (!cands.length) return null;
  const rel = (c: Cand): number => (c.need - c.have) / Math.max(1, c.need - c.from);
  let best = cands[0] as Cand;
  for (const c of cands) if (rel(c) < rel(best) - 1e-9) best = c;
  return { id: best.id, have: best.have, need: best.need, weeks: best.weeks };
}
