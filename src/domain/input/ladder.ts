// Tempo-Leiter beim Hören (Neubau N54, Lehrer H2): erstes Hören 0,9–1,0, zweites Hören schneller.
// Das Tempo ist über die gespeicherten Hör-Ergebnisse (`app/profile.listen[]`, Feld `rate`) gemerkt:
// Nach einem Durchgang ohne Fehler steigt das erste Tempo auf 1,0, nach einem mit Fehlern sinkt es
// wieder auf 0,9. Die Sprachausgabe erlaubt höchstens 1,1 (`platform/speech` RATE_MAX).

export const LADDER_SLOW = 0.9;
export const LADDER_BASE = 1;
/** Zweites Hören (Plan: 1,1–1,2; die Plattform deckelt bei 1,1). */
export const LADDER_FAST = 1.1;

export type LadderRow = { n: number; ok: number; rate: number; t: number };
export type Ladder = { first: number; second: number };

/** Leiter aus den Hör-Ergebnissen (neueste zuerst oder beliebig sortiert). */
export function ladderFor(rows: readonly LadderRow[]): Ladder {
  const last = [...rows].filter((r) => r.n > 0 && r.t > 0).sort((a, b) => b.t - a.t)[0];
  const first = last && last.ok >= last.n && last.rate >= LADDER_SLOW ? LADDER_BASE : LADDER_SLOW;
  return { first, second: LADDER_FAST };
}

/** Tempo für den n-ten Durchgang (1-basiert): 1. = first, ab 2. = second. */
export function ladderRate(l: Ladder, pass: number): number {
  return pass <= 1 ? l.first : l.second;
}
