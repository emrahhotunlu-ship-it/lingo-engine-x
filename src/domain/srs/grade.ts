import type { ExerciseId, Grade, Verdict } from './types';

// Bewertungsvorschlag aus Richtigkeit und Zeit (Lern-Entwurf §2.3). Der Vorschlag ist
// vorausgewählt; der Nutzer kann ändern – aber nie im Widerspruch zum angezeigten Ergebnis.

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

/** Wählbare Noten: falsch → Nochmal/Schwer; fast richtig → bis Gut; richtig → alle. */
export function allowedGrades(verdict: Verdict): Grade[] {
  if (verdict === 'wrong') return [1, 2];
  if (verdict === 'near') return [1, 2, 3];
  return [1, 2, 3, 4];
}
