import { learningDayEnd, learningDayStart } from '../date';
import { isLearningState } from '../srs/scheduler';
import type { TrainCard } from '../srs/types';

// EINE Definition je Begriff (Gesamtkonzept Kap. 4, Umbau Fokus). Keine andere Stelle rechnet „fällig“, „überfällig“, „Fest“ oder
// den Zustand einer Einheit selbst; alle Aufrufer (Heute, Wörter, Fortschritt, Runde, Tagesplan) kommen hierher.
//   fällig     = nicht ausgeblendet ∧ nicht Neu ∧ `due < learningDayEnd` (Lerntag endet um 04:00 Uhr)
//   überfällig = nicht ausgeblendet ∧ nicht Neu ∧ `due < learningDayStart` (schon gestern oder früher fällig)
//   Fest       = nicht ausgeblendet ∧ nicht Neu ∧ Stufe ≥ 4 ∧ Stabilität ≥ 21 Tage
// Reine Funktionen, nichts wird gespeichert (Zustände sind abgeleitet).

/** „Fest“: Stufe ≥ 4 und Stabilität ≥ 21 Tage (wie Anki „mature“). */
export const FEST_STAGE = 4;
export const FEST_DAYS = 21;
/** Ab dieser Stufe gilt eine gelernte Karte als „Sicher“ (noch nicht Fest). */
export const SAFE_STAGE = 3;

type DueLike = Pick<TrainCard, 'hidden' | 'isNew' | 'fsrs'>;

/** Fällig bis zum Ende des heutigen Lerntags (Lernschritte, heute und früher). */
export const isDue = (c: DueLike, nowMs: number): boolean => !c.hidden && !c.isNew && c.fsrs.due < learningDayEnd(nowMs);

/** Überfällig: schon vor dem heutigen Lerntag fällig. */
export const isOverdue = (c: DueLike, nowMs: number): boolean => !c.hidden && !c.isNew && c.fsrs.due < learningDayStart(nowMs);

/** „Fest“ nach Stufe und Stabilität allein (für den Schreibweg: `ff`, erster Fest-Tag). */
export const isFestValues = (stage: number, stability: number): boolean => stage >= FEST_STAGE && stability >= FEST_DAYS;

/** Sitzt die Karte fest? Neue und ausgeblendete Karten nie. */
export const isFest = (c: Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs'>): boolean => !c.hidden && !c.isNew && isFestValues(c.stage, c.fsrs.stability);

export type UnitState = 'new' | 'learning' | 'safe' | 'firm';
export const UNIT_STATES: readonly UnitState[] = ['new', 'learning', 'safe', 'firm'];

/** Neu · Lernt · Sicher · Fest einer Wort- oder Wendungskarte (Anzeigenamen stehen in i18n). */
export function unitState(c: Pick<TrainCard, 'isNew' | 'stage' | 'fsrs'>): UnitState {
  if (c.isNew) return 'new';
  if (c.stage >= FEST_STAGE && c.fsrs.stability >= FEST_DAYS) return 'firm';
  if (c.stage >= SAFE_STAGE && !isLearningState(c.fsrs)) return 'safe';
  return 'learning';
}

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
export function counts(cards: readonly Pick<TrainCard, 'hidden' | 'isNew' | 'stage' | 'fsrs'>[], nowMs: number): CardCounts {
  const out: CardCounts = { total: 0, new: 0, due: 0, learningDue: 0, overdue: 0, fest: 0, byState: { new: 0, learning: 0, safe: 0, firm: 0 } };
  for (const c of cards) {
    if (c.hidden) continue;
    out.total++;
    out.byState[unitState(c)]++;
    if (c.isNew) out.new++;
    if (isDue(c, nowMs)) {
      out.due++;
      if (isLearningState(c.fsrs)) out.learningDue++;
    }
    if (isOverdue(c, nowMs)) out.overdue++;
    if (isFest(c)) out.fest++;
  }
  return out;
}

export const dueCount = (cards: readonly DueLike[], nowMs: number): number => cards.filter((c) => isDue(c, nowMs)).length;
export const overdueCount = (cards: readonly DueLike[], nowMs: number): number => cards.filter((c) => isOverdue(c, nowMs)).length;
