import type { CheckResult, ExerciseId, Grade, Verdict } from './types';

// Note aus Richtigkeit, Zeit und genutzter Hilfe (Lern-Entwurf §2.3, CLAUDE.md A7
// „Emrahs Rückmeldung zum Trainer"): Die App stuft allein ein, es gibt keine Bewertungsknöpfe.

/** Auswahl: bis zu dieser Zeit (ms bis zur Wahl) „Gut", darüber „Schwer". Nie „Leicht" (Ratechance 25 %). */
const CHOICE_GOOD: Partial<Record<ExerciseId, number>> = { mc_en: 8000, mc_de: 9000, colloc: 11000 };
/** Tippen: Zeit bis zum ersten Zeichen. */
const TYPED: Partial<Record<ExerciseId, { good: number; easy: number }>> = {
  cloze_hint: { good: 6000, easy: 2500 },
  cloze: { good: 8000, easy: 3000 },
  type: { good: 8000, easy: 3000 },
};

export type Timing = {
  /** ms bis zur Wahl bzw. bis „Prüfen". */
  submitMs: number;
  /** ms bis zum ersten getippten Zeichen (nur Tippen). */
  firstKeyMs?: number;
  /** Länge der Lösung in Zeichen (nur Tippen). */
  chars?: number;
  /** Gelöschte Zeichen (Rücktaste) – drei und mehr: höchstens „Gut". */
  deletions?: number;
  /**
   * Genutzte Hilfe in freien Stufen („Tipp"): 1 = Platzhalter aufgedeckt (Länge sichtbar) →
   * höchstens „Gut"; 2 = auch der erste Buchstabe → höchstens „Schwer".
   */
  hintLevel?: 0 | 1 | 2;
};

export function suggestGrade(ex: ExerciseId, verdict: Verdict, timing: Timing): Grade {
  if (verdict === 'wrong') return 1;
  if (verdict === 'near') return 2;
  const choice = CHOICE_GOOD[ex];
  if (choice !== undefined) return timing.submitMs <= choice ? 3 : 2;
  const t = TYPED[ex] ?? { good: 8000, easy: 3000 };
  const L = timing.firstKeyMs ?? timing.submitMs;
  let g: Grade = L <= t.easy ? 4 : L <= t.good ? 3 : 2;
  const slowTyping = timing.submitMs > L + 1000 * (timing.chars ?? 0) + 5000;
  if (g === 4 && ((timing.deletions ?? 0) >= 3 || slowTyping)) g = 3;
  return g;
}

/**
 * Endgültige Note einer Antwort:
 * - falsch → Nochmal (1),
 * - Tippfehler oder falsche Form (fast richtig) → Schwer (2),
 * - richtig → nach Zeit Schwer/Gut/Leicht (`suggestGrade`), gedeckelt durch genutzte Hilfe.
 */
export function autoGrade(ex: ExerciseId, result: Pick<CheckResult, 'verdict'>, timing: Timing): Grade {
  if (result.verdict !== 'correct') return suggestGrade(ex, result.verdict, timing);
  const g = suggestGrade(ex, 'correct', timing);
  const hint = timing.hintLevel ?? 0;
  if (hint >= 2) return Math.min(g, 2) as Grade;
  if (hint === 1) return Math.min(g, 3) as Grade;
  return g;
}
