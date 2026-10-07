import { gradeAnswer, type GradeInput } from '../grade';
import type { CheckResult, ExerciseId, Grade, Verdict } from './types';

// Note aus Richtigkeit, Zeit und genutzter Hilfe (Lern-Entwurf §2.3, CLAUDE.md A7
// „Emrahs Rückmeldung zum Trainer"): Die App stuft allein ein, es gibt keine Bewertungsknöpfe. Die Tabelle selbst steht in `domain/grade`.

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
  /** Eingabeprofil der Runde (`touch` dehnt die Zeitgrenzen getippter Formen, §4.10). */
  profile?: 'touch' | 'keys';
  /** Nur `complete`: Claude hat den Satz bestätigt (sonst höchstens „Schwer“). */
  aiChecked?: boolean;
};

const inputOf = (ex: ExerciseId, verdict: Verdict, timing: Timing, help: 0 | 1 | 2): GradeInput => ({
  key: ex,
  verdict,
  timeMs: timing.submitMs,
  firstKeyMs: timing.firstKeyMs,
  chars: timing.chars,
  deletions: timing.deletions,
  units: timing.tiles,
  replays: timing.replays,
  limitMs: timing.limitMs,
  timedOut: timing.timedOut,
  help,
  ...(timing.profile ? { profile: timing.profile } : {}),
  ...(timing.aiChecked ? { aiChecked: true } : {}),
});

/** Note ohne Hilfe-Deckel (Tabelle `domain/grade`). */
export const suggestGrade = (ex: ExerciseId, verdict: Verdict, timing: Timing): Grade => gradeAnswer(inputOf(ex, verdict, timing, 0));

/**
 * Eigener Satz (produce): Note aus Claudes Prüfung – richtig → Gut, kleiner Fehler → Schwer,
 * falsch oder Wort/Wendung nicht verwendet → Nochmal (phase1-plan §4.7). Nie „Leicht".
 */
export function produceGrade(verdict: 'correct' | 'minor' | 'wrong', usesTarget: boolean): Grade {
  if (!usesTarget || verdict === 'wrong') return 1;
  return verdict === 'minor' ? 2 : 3;
}

/**
 * Endgültige Note einer Antwort:
 * - falsch → Nochmal (1),
 * - Tippfehler oder falsche Form (fast richtig) → Schwer (2),
 * - richtig → nach Zeit Schwer/Gut/Leicht (`suggestGrade`), gedeckelt durch genutzte Hilfe.
 */
export const autoGrade = (ex: ExerciseId, result: Pick<CheckResult, 'verdict'>, timing: Timing): Grade => gradeAnswer(inputOf(ex, result.verdict, timing, timing.hintLevel ?? 0));
