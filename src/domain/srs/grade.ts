import type { CheckResult, ExerciseId, Grade, Verdict } from './types';

// Note aus Richtigkeit, Zeit und genutzter Hilfe (Lern-Entwurf §2.3, CLAUDE.md A7
// „Emrahs Rückmeldung zum Trainer"): Die App stuft allein ein, es gibt keine Bewertungsknöpfe.

/** Auswahl: bis zu dieser Zeit (ms bis zur Wahl) „Gut", darüber „Schwer". Nie „Leicht" (Ratechance 25 %). */
const CHOICE_GOOD: Partial<Record<ExerciseId, number>> = { mc_en: 8000, spot: 8000, listen_mc: 8000, mc_de: 9000, match: 9000, colloc: 11000 };
/** Tippen: Zeit bis zum ersten Zeichen (Diktat: ab Tonende, + 1,2 s je Wiederholung). */
const TYPED: Partial<Record<ExerciseId, { good: number; easy: number }>> = {
  cloze_hint: { good: 6000, easy: 2500 },
  cloze: { good: 8000, easy: 3000 },
  type: { good: 8000, easy: 3000 },
  situation: { good: 10000, easy: 4000 },
  dictation: { good: 6000, easy: 2500 },
};
/** Bausteine: Zeit bis „Prüfen“ minus 600 ms je Baustein. Nie „Leicht“: Buchstaben oder Wörter sind vorgegeben. */
const TILES = { good: 9000, perTile: 600 };
const REPLAY_MS = 1200;

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
  /** Zahl der Bausteine (tiles). */
  tiles?: number;
  /** Wiederholungen des Vorlesens (listen_mc, dictation). */
  replays?: number;
  /** Zeitgrenze (speed) und ob sie abgelaufen war. */
  limitMs?: number;
  timedOut?: boolean;
};

export function suggestGrade(ex: ExerciseId, verdict: Verdict, timing: Timing): Grade {
  if (verdict === 'wrong') return 1;
  if (verdict === 'near') return 2;
  const choice = CHOICE_GOOD[ex];
  if (choice !== undefined) return timing.submitMs <= choice + REPLAY_MS * (timing.replays ?? 0) ? 3 : 2;
  if (ex === 'tiles') {
    // Rekonstruktion aus vorgegebenen Teilen ist kein freier Abruf: höchstens „Gut“ (Prüfung Lernwissenschaft 02.10.2026),
    // sonst wüchse die Stabilität schneller, als der Nachweis trägt.
    const T = timing.submitMs - TILES.perTile * (timing.tiles ?? 0);
    return T <= TILES.good ? 3 : 2;
  }
  if (ex === 'speed') {
    // Abgelaufen: richtig gilt nur als „Schwer“. Sonst gegen die Grenze G: ≤ 0,6·G Leicht, ≤ G Gut.
    const G = timing.limitMs ?? 10_000;
    if (timing.timedOut || timing.submitMs > G) return 2;
    return timing.submitMs <= 0.6 * G ? 4 : 3;
  }
  if (ex === 'produce') return 3;
  const t = TYPED[ex] ?? { good: 8000, easy: 3000 };
  const L = (timing.firstKeyMs ?? timing.submitMs) - (ex === 'dictation' ? REPLAY_MS * (timing.replays ?? 0) : 0);
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
/**
 * Eigener Satz (produce): Note aus Claudes Prüfung – richtig → Gut, kleiner Fehler → Schwer,
 * falsch oder Wort/Wendung nicht verwendet → Nochmal (phase1-plan §4.7). Nie „Leicht".
 */
export function produceGrade(verdict: 'correct' | 'minor' | 'wrong', usesTarget: boolean): Grade {
  if (!usesTarget || verdict === 'wrong') return 1;
  return verdict === 'minor' ? 2 : 3;
}

export function autoGrade(ex: ExerciseId, result: Pick<CheckResult, 'verdict'>, timing: Timing): Grade {
  if (result.verdict !== 'correct') return suggestGrade(ex, result.verdict, timing);
  const g = suggestGrade(ex, 'correct', timing);
  const hint = timing.hintLevel ?? 0;
  if (hint >= 2) return Math.min(g, 2) as Grade;
  if (hint === 1) return Math.min(g, 3) as Grade;
  return g;
}
