import { dayKey } from '../date';
import { confidenceOf } from './confidence';
import { histOf } from './flip';
import { isLearningState, retrievability } from './scheduler';
import type { TrainCard } from './types';

// Wortschatz-Statistik (plan.md N27, Platz `stand`): Erinnerungsquote der letzten 30 Tage,
// Karten je Zustand, Median-Stabilität und sichere Einträge. Rein berechnet, nichts gespeichert.

const DAY_MS = 86_400_000;
/** „Gefestigt“ ab 21 Tagen Stabilität (wie Anki „mature“). */
export const MATURE_DAYS = 21;

export type VocabStatistics = {
  /** Anteil richtiger Antworten (Note ≥ 2) an den ersten Antworten je Karte und Lerntag, 30 Tage; `null` ohne Antworten. */
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

export function vocabStatistics(cards: readonly TrainCard[], nowMs: number, windowDays = 30): VocabStatistics {
  const from = nowMs - windowDays * DAY_MS;
  const out: VocabStatistics = { retention: null, answers: 0, byState: { new: 0, learning: 0, young: 0, mature: 0 }, medianStability: null, sure: 0, total: 0, active: 0, practicing: 0, expected: 0 };
  const stab: number[] = [];
  let ok = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    out.total++;
    if (c.isNew) out.byState.new++;
    else if (isLearningState(c.fsrs)) out.byState.learning++;
    else if (c.fsrs.stability >= MATURE_DAYS) out.byState.mature++;
    else out.byState.young++;
    if (!c.isNew) {
      stab.push(c.fsrs.stability);
      out.expected += retrievability(c.fsrs, nowMs);
      if (c.stage >= 4 && c.fsrs.stability >= MATURE_DAYS) out.active++;
      else if (c.stage >= 3) out.practicing++;
    }
    if (confidenceOf(c, nowMs) >= 3) out.sure++;
    const seen = new Set<string>();
    for (const h of histOf(c.doc)) {
      if (h.t < from || h.t > nowMs || h.g === null) continue;
      const d = dayKey(h.t);
      if (seen.has(d)) continue;
      seen.add(d);
      out.answers++;
      if (h.g >= 2) ok++;
    }
  }
  out.retention = out.answers ? ok / out.answers : null;
  out.expected = Math.round(out.expected);
  const m = median(stab);
  out.medianStability = m === null ? null : Math.round(m * 10) / 10;
  return out;
}
