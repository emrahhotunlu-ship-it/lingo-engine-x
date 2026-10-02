import { learningDayEnd } from '../date';
import type { TrainCard } from './types';

// Geschätzte Sekunden je Karte – EINE Quelle für den Tagesplan (`unit/review.ts`), die ältere Rundenplanung
// (`queue.ts`) und die Zeitanzeige im Wortschatz (vorher drei verschiedene Annahmen: 8 s, 12/20/35 s und 27 s je Karte,
// dadurch standen auf einem Bildschirm zwei sich widersprechende Minutenangaben).
// Frische Stufen gehen schneller (Antippen), frei Getipptes dauert länger, „Sicher anwenden“ am längsten.

export const CARD_SEC = { early: 12, mid: 20, late: 35 } as const;
/** Neue Karte: Einführung + erste Abfrage. */
export const NEW_SEC = 50;
/** Reparatur-Satz. */
export const REPAIR_SEC = 40;
/** Aufdecken (Anki-Modus): Antwort im Kopf, aufdecken, Knopf – deutlich schneller als Tippen. */
export const FLIP_SEC = 8;
export const FLIP_NEW_SEC = 40;

/** Sekunden für eine fällige Karte nach Lernstufe. */
export const cardSec = (c: Pick<TrainCard, 'stage'>): number => (c.stage <= 2 ? CARD_SEC.early : c.stage <= 4 ? CARD_SEC.mid : CARD_SEC.late);

/**
 * Minuten für alle fälligen (und lernenden) Karten plus höchstens `newCap` neue – für die Anzeige im Wortschatz.
 * Im Modus „Aufdecken“ rechnet es mit den kürzeren Zeiten, sonst wie der Tagesplan.
 */
export function estimateRoundMinutes(cards: readonly TrainCard[], nowMs: number, newCap: number, flip: boolean): number {
  const end = learningDayEnd(nowMs);
  let sec = 0;
  let fresh = 0;
  for (const c of cards) {
    if (c.hidden) continue;
    if (c.isNew) fresh++;
    else if (c.fsrs.due < end) sec += flip ? FLIP_SEC : cardSec(c);
  }
  sec += Math.min(fresh, Math.max(0, newCap)) * (flip ? FLIP_NEW_SEC : NEW_SEC);
  return sec <= 0 ? 0 : Math.max(1, Math.round(sec / 60));
}

/** Reife Karten (Stufe 5, Stabilität ≥ 21 Tage) kommen nur bei jeder dritten Wiederholung in voller Form (`session.ts`). */
const MAINT_S = 21;
const CATCHUP_S = 7;

/**
 * Geplante Sekunden einer fälligen Karte: wie `cardSec`, aber mit der billigeren Wartung reifer Karten (zwei Drittel freies Tippen,
 * ein Drittel volle Form) und im Aufholmodus (drei Viertel Aufdecken) für reife Karten ab Stufe 3.
 */
export function plannedCardSec(c: Pick<TrainCard, 'stage' | 'fsrs'>, catchUp: boolean): number {
  const base = cardSec(c);
  const s = c.fsrs.stability;
  if (catchUp && c.stage >= 3 && s >= CATCHUP_S) return 0.75 * FLIP_SEC + 0.25 * base;
  if (c.stage >= 5 && s >= MAINT_S) return (2 / 3) * CARD_SEC.mid + (1 / 3) * base;
  return base;
}
