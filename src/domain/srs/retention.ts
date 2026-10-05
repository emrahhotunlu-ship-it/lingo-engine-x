import { isFest } from '../metrics/definitions';
import { expectedKnown, retention28 } from '../metrics/vocab';
import { confidenceOf } from './confidence';
import { isLearningState } from './scheduler';
import type { TrainCard } from './types';

// Wortschatz-Statistik (plan.md N27, Platz `stand`): Erinnerungsquote, Karten je Zustand, Median-Stabilität und sichere Einträge.
// Rein berechnet, nichts gespeichert. Erinnerungsquote, „Fest“ und „Erwartet gekonnt“ kommen aus `domain/metrics` (eine Quelle je Zahl).

export type VocabStatistics = {
  /** Behaltensquote der letzten 28 Tage (`retention28`: erste Antwort je Karte und Lerntag nach mindestens 7 Tagen Pause); `null` ohne Antworten. */
  retention: number | null;
  answers: number;
  byState: { new: number; learning: number; young: number; mature: number };
  /** Median der Stabilität (Tage) aller gelernten Karten; `null` ohne gelernte Karten. */
  medianStability: number | null;
  /** Sicher und sehr sicher (Punkte ≥ 4 von 5). */
  sure: number;
  total: number;
  /** „Aktiv fest“: frei getippt belegt (Stufe ≥ 4) und Stabilität ≥ 21 Tage. Aufdecken zählt nie (es hebt höchstens bis Stufe 2). */
  active: number;
  /** „Übt“: Stufe ≥ 3, noch nicht aktiv fest. */
  practicing: number;
  /** Erwartete Zahl gekonnter Karten heute: Summe der Abrufwahrscheinlichkeiten aller gelernten Karten (sinkt, wenn Wiederholungen ausbleiben). */
  expected: number;
};

export function median(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function vocabStatistics(cards: readonly TrainCard[], nowMs: number): VocabStatistics {
  const out: VocabStatistics = { retention: null, answers: 0, byState: { new: 0, learning: 0, young: 0, mature: 0 }, medianStability: null, sure: 0, total: 0, active: 0, practicing: 0, expected: 0 };
  const stab: number[] = [];
  for (const c of cards) {
    if (c.hidden) continue;
    out.total++;
    if (c.isNew) out.byState.new++;
    else if (isLearningState(c.fsrs)) out.byState.learning++;
    else if (isFest(c)) out.byState.mature++;
    else out.byState.young++;
    if (!c.isNew) {
      stab.push(c.fsrs.stability);
      if (isFest(c)) out.active++;
      else if (c.stage >= 3) out.practicing++;
    }
    if (confidenceOf(c, nowMs) >= 3) out.sure++;
  }
  const r = retention28(cards, nowMs);
  out.retention = r.rate;
  out.answers = r.n;
  out.expected = expectedKnown(cards, nowMs);
  const m = median(stab);
  out.medianStability = m === null ? null : Math.round(m * 10) / 10;
  return out;
}
