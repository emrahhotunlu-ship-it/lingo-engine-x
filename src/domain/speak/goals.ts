// Ziel-Checkliste im Rollenspiel (N72): Zustände je Ziel zusammenführen. Rein und getestet.
// Ein einmal erreichtes Ziel bleibt erreicht (eine spätere, strengere Antwort nimmt keinen Haken
// weg – Kap. 2.2: kein Häkchen, das wieder verschwindet). Das Zitat kommt vom besten Zustand.

export type GoalState = 'met' | 'partly' | 'open';
export type GoalMark = { i: number; state: GoalState; quote: string };

const RANK: Record<GoalState, number> = { open: 0, partly: 1, met: 2 };

/** Führt neue Markierungen in die bisherigen ein (je Ziel der bessere Zustand). */
export function mergeGoalMarks(prev: readonly GoalMark[], next: readonly GoalMark[], n: number): GoalMark[] {
  const out: GoalMark[] = [];
  for (let i = 0; i < n; i++) {
    const a = prev.find((m) => m.i === i);
    const b = next.find((m) => m.i === i);
    const best = !a ? b : !b ? a : RANK[b.state] > RANK[a.state] ? b : a;
    out.push(best ? { i, state: best.state, quote: best.state === 'open' ? '' : best.quote } : { i, state: 'open', quote: '' });
  }
  return out;
}

/** Zahl der erreichten Ziele (für „2 von 3“). */
export const metCount = (marks: readonly GoalMark[]): number => marks.filter((m) => m.state === 'met').length;

/** Gespeicherte Markierungen tolerant lesen (Fortsetzen nach Neuladen). */
export function readGoalMarks(v: unknown): GoalMark[] {
  if (!Array.isArray(v)) return [];
  const out: GoalMark[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const m = x as Record<string, unknown>;
    const state = m.state === 'met' || m.state === 'partly' || m.state === 'open' ? m.state : null;
    if (typeof m.i !== 'number' || !Number.isInteger(m.i) || m.i < 0 || m.i > 4 || !state) continue;
    out.push({ i: m.i, state, quote: typeof m.quote === 'string' ? m.quote.slice(0, 200) : '' });
  }
  return out;
}
