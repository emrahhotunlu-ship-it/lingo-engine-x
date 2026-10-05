import { capacityNew } from '../unit/backlog';
import { CARD_SEC } from '../srs/cost';
import { dueCards } from '../srs/queue';
import { forecast } from '../srs/forecast';
import { isLearningState } from '../srs/scheduler';
import type { TrainCard } from '../srs/types';

// Kapazitätswächter für „Als Karte“ im Atlas (Gesamtkonzept 3.3, Datenleitplanken `07`): Die Datenbank liefert höchstens
// 5.000 Dokumente je Abfrage, ein Abo darf nie still gekappt werden. Deshalb Warnung ab 3.500 Karten (Vokabeln + Wendungen),
// Sperre ab 4.500 und je Tag nur so viele Atlas-Karten, wie die Kapazitätsregel für neue Wörter zulässt.

/** Ab so vielen Karten (vocab + chunk) zeigt die Diagnose eine Warnzeile. */
export const CARD_WARN = 3500;
/** Ab so vielen Karten legt der Atlas keine weiteren an. */
export const CARD_CAP = 4500;

export type AtlasGate = {
  /** `ok` = anlegen erlaubt · `full` = Kartenzahl erreicht · `enough` = heute genug neue Wörter */
  state: 'ok' | 'full' | 'enough';
  total: number;
  addedToday: number;
  limit: number;
};

const atlasRef = (c: Pick<TrainCard, 'doc'>): boolean => {
  const o = c.doc.origin;
  const ref = o && typeof o === 'object' ? (o as { ref?: unknown }).ref : null;
  return typeof ref === 'string' && ref.startsWith('atlas/');
};

/** Mittlere Wiederholzeit je Tag (Sekunden) heute und in den nächsten sechs Tagen – dieselbe Rechnung wie die Kapazitätsregel in `unit/review.ts`. */
export function reviewLoadSec(cards: readonly TrainCard[], nowMs: number): number {
  const act = cards.filter((c) => !c.hidden);
  const dueToday = dueCards(act, nowMs).filter((c) => !isLearningState(c.fsrs)).length;
  const next = forecast(act, nowMs, 6).reduce((a, d) => a + d.n, 0);
  return Math.max(dueToday, (dueToday + next) / 7) * CARD_SEC.mid;
}

/** Darf der Atlas jetzt noch eine Karte anlegen? */
export function atlasGate(i: { cards: readonly TrainCard[]; today: string; nowMs: number }): AtlasGate {
  const total = i.cards.filter((c) => c.inDb).length;
  const addedToday = i.cards.filter((c) => c.added === i.today && atlasRef(c)).length;
  const limit = capacityNew(reviewLoadSec(i.cards, i.nowMs));
  const state = total >= CARD_CAP ? 'full' : addedToday >= limit ? 'enough' : 'ok';
  return { state, total, addedToday, limit };
}
