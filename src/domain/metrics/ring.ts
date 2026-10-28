import type { DutyState } from '../plan/types';

// Tagesring (P5 S1-ZAHL, aus `ui/DayRing.tsx` hierher verlegt): Füllanteile je Pflichtschritt aus derselben Quelle wie „x von 4“
// (`duties.items`, Kap. 2 Nr. 2). Rein, ohne React, nichts wird gespeichert. Die Anzeige (`DayRing`) zeichnet nur noch.

type RingItem = Pick<DutyState, 'state' | 'progress'>;

/** Offen bleibt sichtbar offen: höchstens 95 %, damit „fast fertig“ nie wie „erledigt“ aussieht. */
export const RING_OPEN_MAX = 0.95;

/** Füllanteile je Pflichtschritt aus dem Pflichtzustand: erledigt = 1, offen mit Fortschritt = Anteil (unter 1), sonst 0. */
export function ringFills(items: readonly RingItem[]): number[] {
  return items.map((d) => {
    if (d.state === 'done') return 1;
    const p = d.progress;
    if (!p || p.total <= 0 || p.done <= 0) return 0;
    return Math.min(RING_OPEN_MAX, p.done / p.total);
  });
}

/**
 * Ein Wert für den ganzen Ring (0–1): 1 nur, wenn jeder Pflichtschritt erledigt ist; sonst der Mittelwert der Bogen, gedeckelt auf 95 %.
 * Ohne Pflichtschritte 0. Neu mit P5 als Einzelzahl für `app/today` (P6); die Bogen selbst zeichnen weiter `ringFills`.
 */
export function ringShare(items: readonly RingItem[]): number {
  if (!items.length) return 0;
  if (items.every((d) => d.state === 'done')) return 1;
  const fills = ringFills(items);
  return Math.min(RING_OPEN_MAX, fills.reduce((s, f) => s + f, 0) / fills.length);
}
