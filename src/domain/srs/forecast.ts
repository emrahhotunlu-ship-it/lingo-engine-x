import { addDays, dayKey } from '../date';
import type { TrainCard } from './types';

// Prognose (plan.md N27): fällige Karten je Lerntag für die nächsten 7 Tage – rein berechnet
// aus `fsrs.due` (04:00-Regel). Heute und Überfälliges zählen nicht hier, sondern auf der Hauptkarte.

export type ForecastDay = { day: string; n: number };

export function forecast(cards: readonly TrainCard[], nowMs: number, days = 7): ForecastDay[] {
  const today = dayKey(nowMs);
  const keys = Array.from({ length: days }, (_, i) => addDays(today, i + 1));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const out = keys.map((day) => ({ day, n: 0 }));
  for (const c of cards) {
    if (c.hidden || c.isNew) continue;
    const i = idx.get(dayKey(c.fsrs.due));
    if (i !== undefined) (out[i] as ForecastDay).n++;
  }
  return out;
}
