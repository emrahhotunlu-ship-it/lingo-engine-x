import { learningDayEnd, learningDayStart } from '../date';
import { isLearningState } from '../srs/scheduler';
import type { TrainCard } from '../srs/types';
import { cardStatus, isFestCard, type UnitState } from './cardStatus';

// EINE Definition je Begriff (Gesamtkonzept Kap. 4, Umbau Fokus). Keine andere Stelle rechnet „fällig“, „überfällig“, „Fest“ oder
// den Zustand einer Einheit selbst; alle Aufrufer (Heute, Wörter, Fortschritt, Runde, Tagesplan) kommen hierher.
//   fällig     = nicht ausgeblendet ∧ nicht Neu ∧ `due < learningDayEnd` (Lerntag endet um 04:00 Uhr)
//   überfällig = nicht ausgeblendet ∧ nicht Neu ∧ `due < learningDayStart` (schon gestern oder früher fällig)
//   Zustand/Fest/Sicher/Wackelt: `cardStatus.ts` (Paket ST: abgeleitet aus Verlauf und FSRS, nie gespeichert)
// Reine Funktionen, nichts wird gespeichert (Zustände sind abgeleitet).

export { FEST_DAYS, FEST_STAGE, UNIT_RANK, UNIT_STATES, isFestState, type UnitState } from './cardStatus';

type DueLike = Pick<TrainCard, 'hidden' | 'isNew' | 'fsrs'>;

/** Fällig bis zum Ende des heutigen Lerntags (Lernschritte, heute und früher). */
export const isDue = (c: DueLike, nowMs: number): boolean => !c.hidden && !c.isNew && c.fsrs.due < learningDayEnd(nowMs);

/** Überfällig: schon vor dem heutigen Lerntag fällig. */
export const isOverdue = (c: DueLike, nowMs: number): boolean => !c.hidden && !c.isNew && c.fsrs.due < learningDayStart(nowMs);

/** Sitzt die Karte fest? Die ganze Regel steht in `cardStatus.ts` (Stufe 5, 21 Tage Haltbarkeit, in einem anderen Satz gekonnt, kein offener Fehler). Neue und ausgeblendete Karten nie. */
export const isFest = (c: Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs' | 'doc'>, nowMs?: number): boolean => isFestCard(c, nowMs);

/** Neu · Lernt · Wackelt · Sicher · Fest einer Wort- oder Wendungskarte (Anzeigenamen stehen in i18n). */
export const unitState = (c: Pick<TrainCard, 'isNew' | 'stage' | 'fsrs' | 'doc'>, nowMs: number): UnitState => cardStatus(c, nowMs).tier;

export type CardCounts = {
  /** Sichtbare (nicht ausgeblendete) Karten. */
  total: number;
  new: number;
  /** Fällig bis Lerntagsende, davon in Lernschritten. */
  due: number;
  learningDue: number;
  overdue: number;
  fest: number;
  byState: Record<UnitState, number>;
};

/** Alle Kartenzahlen auf einmal, aus denselben Definitionen. */
export function counts(cards: readonly Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs' | 'doc'>[], nowMs: number): CardCounts {
  const out: CardCounts = { total: 0, new: 0, due: 0, learningDue: 0, overdue: 0, fest: 0, byState: { new: 0, learning: 0, wobbly: 0, safe: 0, firm: 0 } };
  for (const c of cards) {
    if (c.hidden) continue;
    out.total++;
    out.byState[unitState(c, nowMs)]++;
    if (c.isNew) out.new++;
    if (isDue(c, nowMs)) {
      out.due++;
      if (isLearningState(c.fsrs)) out.learningDue++;
    }
    if (isOverdue(c, nowMs)) out.overdue++;
    if (isFest(c, nowMs)) out.fest++;
  }
  return out;
}

export const dueCount = (cards: readonly DueLike[], nowMs: number): number => cards.filter((c) => isDue(c, nowMs)).length;
export const overdueCount = (cards: readonly DueLike[], nowMs: number): number => cards.filter((c) => isOverdue(c, nowMs)).length;
