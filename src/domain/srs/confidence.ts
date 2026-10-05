import { FEST_DAYS } from '../metrics/definitions';
import { isLearningState, retrievability } from './scheduler';
import type { TrainCard } from './types';

// Sicherheit einer Karte für die Statuszeile (CLAUDE.md A7 „Emrahs Rückmeldung zum Trainer"):
// fünf Punkte und ein Wort. Abgeleitet aus Stufe der Leiter und FSRS (Abrufwahrscheinlichkeit
// jetzt, Stabilität in Tagen). Nur Anzeige, nichts davon wird gespeichert.

export type Confidence = 0 | 1 | 2 | 3 | 4;

/** i18n-Schlüssel je Sicherheit: neu · unsicher · wird fester · sicher · sehr sicher. */
export const CONFIDENCE_KEYS = ['confNew', 'confShaky', 'confGrowing', 'confSolid', 'confStrong'] as const;

/** Gefüllte Punkte (von fünf). */
export const confidenceDots = (c: Confidence): number => c + 1;

const DAY_MS = 86_400_000;

export function confidenceOf(card: Pick<TrainCard, 'isNew' | 'stage' | 'fsrs'>, nowMs: number): Confidence {
  if (card.isNew || card.stage === 0) return 0;
  // Gerade falsch beantwortet (FSRS lernt neu): höchstens „unsicher" – auch wenn die
  // Abrufwahrscheinlichkeit direkt nach der Wiederholung bei 1 liegt (B4).
  if (isLearningState(card.fsrs)) return 1;
  // Die Abrufwahrscheinlichkeit sagt erst nach mindestens einem Tag Abstand etwas aus.
  const last = card.fsrs.last;
  const r = typeof last === 'number' && nowMs - last < DAY_MS ? null : retrievability(card.fsrs, nowMs);
  const s = card.fsrs.stability;
  if (card.stage <= 1 || (r !== null && r < 0.7)) return 1;
  if (card.stage <= 3 || s < 7) return 2;
  if (card.stage >= 5 && s >= FEST_DAYS && (r === null || r >= 0.85)) return 4;
  return 3;
}
