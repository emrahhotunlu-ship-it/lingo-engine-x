import { isThemeCard } from '../week/cards';
import { block1Order, NEW_MIN } from '../week/review';
import type { WeekTheme } from '../week/types';
import { CARD_SEC, NEW_SEC, plannedCardSec, REPAIR_SEC } from '../srs/cost';
import { capLeeches, dueCards, newCards, quizzable } from '../srs/queue';
import { isLearningState } from '../srs/scheduler';
import type { Lang, TrainCard } from '../srs/types';
import { forecast } from '../srs/forecast';
import { backlogBraked, backlogBudget, capacityNew, catchUpOn, overdueCount } from './backlog';
import type { ReviewGoal } from './plan';

// Umfang von Block 1 „Wiederholen“ für den Tagesplan (Prüfung M1, M2; anki-regeln §5): fällige
// Reparatur-Sätze → fällige Karten (Wochenthema zuerst) → neue Karten eingestreut, im Budget der
// Einheit (`unitPlanFor(...).reviewSec`). Lernkarten liegen innerhalb des Budgets, nichts wird
// vorgezogen. Das Ergebnis wird als `goal.review` eingefroren; Block 1 endet dort, nicht nach Zeit.
// Rückstand (02.10.2026, `backlog.ts`): Je überfälliger Karte wächst das Budget (höchstens +50 %), und ab 15
// überfälligen Karten kommt nur die Mindestzahl neuer Wörter – sonst wächst der Berg fälliger Karten immer weiter.
// Geschätzte Sekunden je Karte: `domain/srs/cost.ts` (eine Quelle für Plan und Anzeige).

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
  const overdue = overdueCount(act, i.nowMs);
  const base = {
    repairs: Array.from({ length: Math.max(0, Math.floor(i.repairs)) }, () => ({ item: null, sec: REPAIR_SEC })),
    due: capLeeches(dueCards(act, i.nowMs)).map((c) => ({ item: c, sec: plannedCardSec(c, catchUpOn(overdue)), theme: i.theme ? isThemeCard(c, i.theme) : false })),
    fresh: newCards(act).map((c) => ({ item: c, sec: NEW_SEC })),
  };
  // Plan ohne Rückstand-Zuschlag: bei Rückstand wächst die Zeit nur für Wiederholungen. Der Anteil neuer Wörter wird
  // immer vom Grundbudget gerechnet, damit er mit dem Rückstand nie steigt (Prüfung Lernwissenschaft 02.10.2026).
  const calm = block1Order<TrainCard | null>({ ...base, budgetSec: i.budgetSec, quotaLeft: i.quotaLeft });
  const r =
    overdue === 0
      ? calm
      : block1Order<TrainCard | null>({
          ...base,
          budgetSec: backlogBudget(i.budgetSec, overdue),
          quotaLeft: backlogBraked(overdue) ? Math.min(i.quotaLeft, NEW_MIN) : Math.min(i.quotaLeft, calm.fresh),
        });
  // Kapazitätsregel: ist mehr Platz, als der 40-%-Anteil zulässt, kommen bis zu `capacityNew` neue Wörter (nie bei Bremse).
  // Nur ohne Rückstand: wer Karten schuldet, bekommt nicht noch mehr Neues.
  if (overdue === 0) {
    const dueToday = dueCards(act, i.nowMs).filter((c) => !isLearningState(c.fsrs)).length;
    const next = forecast(act, i.nowMs, 6).reduce((a, d) => a + d.n, 0);
    // Ein voller heutiger Tag bremst genauso wie ein dauerhaft voller: es zählt der höhere Wert.
    const loadSec = Math.max(dueToday, (dueToday + next) / 7) * CARD_SEC.mid;
    const target = Math.min(i.quotaLeft, capacityNew(loadSec), base.fresh.length);
    if (target > r.fresh) {
      const extra = (target - r.fresh) * NEW_SEC;
      const wide = block1Order<TrainCard | null>({ ...base, budgetSec: i.budgetSec + extra, quotaLeft: target, floorNew: target });
      return { goal: wide.goal, due: wide.due, fresh: wide.fresh, repairs: wide.repairs, sec: Math.round(wide.sec), overdue };
    }
  }
  return { goal: r.goal, due: r.due, fresh: r.fresh, repairs: r.repairs, sec: Math.round(r.sec), overdue };
}
