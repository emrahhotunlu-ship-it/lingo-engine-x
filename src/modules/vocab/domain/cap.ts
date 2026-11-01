import type { Lex } from './types';

// Abstands-Deckel 1 / 3 / 7 / 21 Tage nach der Zahl der Lerntage mit freiem Abruf NACH dem Einführungstag (M77, wie heute
// `domain/srs/spacing.ts:23`, hier neu geschrieben). Ab Stufe 6 („bildest du selbst“, b.s ≥ 21) hat der Deckel nichts mehr zu beweisen.

export const CAP_STEPS = [1, 3, 7, 21] as const;
export const EV_F_MAX = 8;

export function capDays(lex: Pick<Lex, 'ev' | 'lv'>): number | null {
  if (lex.lv >= 6) return null;
  const n = lex.ev.f.length;
  return CAP_STEPS[Math.min(n, CAP_STEPS.length - 1)] as number;
}
