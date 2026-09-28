import { isThemeCard } from '../week/cards';
import { block1Order } from '../week/review';
import type { WeekTheme } from '../week/types';
import { dueCards, newCards, quizzable } from '../srs/queue';
import type { Lang, TrainCard } from '../srs/types';
import type { ReviewGoal } from './plan';

// Umfang von Block 1 „Wiederholen“ für den Tagesplan (Prüfung M1, M2; anki-regeln §5): fällige
// Reparatur-Sätze → fällige Karten (Wochenthema zuerst) → neue Karten eingestreut, im Budget der
// Einheit (`unitPlanFor(...).reviewSec`). Lernkarten liegen innerhalb des Budgets, nichts wird
// vorgezogen. Das Ergebnis wird als `goal.review` eingefroren; Block 1 endet dort, nicht nach Zeit.

/** Geschätzte Sekunden je Karte (wie der Trainer: frische Stufen schneller). */
const reviewSec = (c: TrainCard): number => (c.stage <= 2 ? 12 : c.stage <= 4 ? 20 : 35);
const NEW_SEC = 50;
const REPAIR_SEC = 40;

export function unitReviewGoal(i: {
  cards: readonly TrainCard[];
  /** Fällige Reparatur-Sätze (Anzahl, schon ohne heute beantwortete). */
  repairs: number;
  nowMs: number;
  lang: Lang;
  budgetSec: number;
  /** Restliches Kontingent neuer Karten heute (`newQuotaLeft`). */
  quotaLeft: number;
  theme: WeekTheme | null;
}): ReviewGoal {
  const pool = i.cards.filter((c) => !c.hidden);
  const act = pool.filter((c) => quizzable(c, i.lang, pool.length - 1));
  const r = block1Order<TrainCard | null>({
    repairs: Array.from({ length: Math.max(0, Math.floor(i.repairs)) }, () => ({ item: null, sec: REPAIR_SEC })),
    due: dueCards(act, i.nowMs).map((c) => ({ item: c, sec: reviewSec(c), theme: i.theme ? isThemeCard(c, i.theme) : false })),
    fresh: newCards(act).map((c) => ({ item: c, sec: NEW_SEC })),
    budgetSec: i.budgetSec,
    quotaLeft: i.quotaLeft,
  });
  return { goal: r.goal, due: r.due, fresh: r.fresh, repairs: r.repairs };
}
