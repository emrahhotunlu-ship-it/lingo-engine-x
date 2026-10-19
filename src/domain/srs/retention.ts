import { UNIT_STATES, type UnitState } from '../metrics/definitions';
import { wordTier } from '../tutor/learnerWords';
import { expectedKnown, retention28 } from '../metrics/vocab';
import type { TrainCard } from './types';

// Wortschatz-Statistik (plan.md N27, Platz `stand`): Behaltensquote, Karten je Zustand, Median-Stabilität und sichere Einträge.
// Rein berechnet, nichts gespeichert. Zustände, Behaltensquote und „Erwartet gekonnt“ kommen aus `domain/metrics` (eine Quelle je Zahl, Paket ST).

export type VocabStatistics = {
  /** Behaltensquote der letzten 28 Tage bei FREIEM Abruf (`retention28`); `null` ohne Antworten. */
  retention: number | null;
  answers: number;
  /** Zum Vergleich, eingeklappt: Behalten beim Erkennen (Auswahl, Aufdecken). */
  recognition: { rate: number | null; n: number };
  /** Karten je Zustand (dieselbe Rechnung wie Liste, Wortblatt und Übung). */
  byState: Record<UnitState, number>;
  /** Median der Stabilität (Tage) aller gelernten Karten; `null` ohne gelernte Karten. */
  medianStability: number | null;
  /** Sicher und Fest. */
  sure: number;
  total: number;
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
  const byState = Object.fromEntries(UNIT_STATES.map((k) => [k, 0])) as Record<UnitState, number>;
  const out: VocabStatistics = { retention: null, answers: 0, recognition: { rate: null, n: 0 }, byState, medianStability: null, sure: 0, total: 0, expected: 0 };
  const stab: number[] = [];
  for (const c of cards) {
    if (c.hidden) continue;
    out.total++;
    const st = wordTier(c, nowMs);
    byState[st]++;
    if (!c.isNew) stab.push(c.fsrs.stability);
    if (st === 'safe' || st === 'firm') out.sure++;
  }
  const r = retention28(cards, nowMs);
  out.retention = r.rate;
  out.answers = r.n;
  out.recognition = r.recognition;
  out.expected = expectedKnown(cards, nowMs);
  const m = median(stab);
  out.medianStability = m === null ? null : Math.round(m * 10) / 10;
  return out;
}
