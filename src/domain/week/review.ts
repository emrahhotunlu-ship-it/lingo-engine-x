// Reihenfolge und Umfang von Block 1 „Wiederholen“ (Prüfung Tageseinheit M1, M2; anki-regeln §5).
// Generisch über die Karten-Art, damit P3 die eigenen Typen (`TrainCard`, Reparatur-Einträge) einsetzt.
// - fällige Reparatur-Sätze zuerst (≤ 3, ≤ 120 s),
// - dann fällige Karten, Wochenthema zuerst (stabil, sonst nach Dringlichkeit wie übergeben),
// - neue Karten (Korb-Reihenfolge wie übergeben) eingestreut an Stelle 2, 5, 8 … (wie `buildQueue`),
//   etwa 40 % der Kartenzeit, Untergrenze min(2, Kontingent). Themenkarten werden nie vorgezogen:
//   hier stehen nur fällige und neue Karten.
// Das Budget wirkt bei der Planung; Block 1 endet bei `goal` (M2), nicht nach Zeit.

export const REPAIR_MAX = 3;
export const REPAIR_SEC_MAX = 120;
export const NEW_SHARE = 0.4;
export const NEW_MIN = 2;

export type ReviewCandidate<T> = { item: T; sec: number; theme?: boolean };
export type ReviewReason = 'repair' | 'due' | 'new';
export type ReviewEntry<T> = { item: T; reason: ReviewReason };
export type ReviewOrder<T> = {
  order: ReviewEntry<T>[];
  /** `goal.review` = Reparatur + fällig + neu (fest im Tagesplan). 0 → Block 1 entfällt. */
  goal: number;
  repairs: number;
  due: number;
  fresh: number;
  /** Geplante Sekunden. */
  sec: number;
};

const cost = (s: number): number => (Number.isFinite(s) && s > 0 ? s : 0);

export function block1Order<T>(i: {
  repairs: readonly ReviewCandidate<T>[];
  due: readonly ReviewCandidate<T>[];
  fresh: readonly ReviewCandidate<T>[];
  budgetSec: number;
  quotaLeft: number;
  /** Mindestzahl neuer Karten unabhängig vom 40-%-Anteil (Kapazitätsregel `unit/backlog.ts`); sonst `NEW_MIN`. */
  floorNew?: number;
}): ReviewOrder<T> {
  const budget = Math.max(0, cost(i.budgetSec));
  const quota = Math.max(0, Math.floor(i.quotaLeft));

  const repairs: ReviewCandidate<T>[] = [];
  let repairSec = 0;
  for (const r of i.repairs) {
    if (repairs.length >= REPAIR_MAX) break;
    if (repairSec + cost(r.sec) > Math.min(REPAIR_SEC_MAX, budget)) break;
    repairs.push(r);
    repairSec += cost(r.sec);
  }
  let left = budget - repairSec;

  // Neue Karten: bis etwa 40 % der Kartenzeit, mindestens min(2, Kontingent).
  const floor = Math.min(Math.max(NEW_MIN, Math.floor(i.floorNew ?? 0)), quota, i.fresh.length);
  const fresh: ReviewCandidate<T>[] = [];
  let newSec = 0;
  for (const c of i.fresh) {
    if (fresh.length >= quota) break;
    const within = newSec + cost(c.sec) <= NEW_SHARE * left;
    if (!within && fresh.length >= floor) break;
    fresh.push(c);
    newSec += cost(c.sec);
  }
  left -= newSec;

  // Fällige Karten: Wochenthema zuerst, sonst in der übergebenen Dringlichkeit.
  const dueSorted = [...i.due.filter((c) => c.theme), ...i.due.filter((c) => !c.theme)];
  const due: ReviewCandidate<T>[] = [];
  for (const c of dueSorted) {
    if (left - cost(c.sec) < 0) break;
    due.push(c);
    left -= cost(c.sec);
  }

  // Restzeit: weitere neue Karten im Rahmen des Kontingents.
  for (const c of i.fresh.slice(fresh.length)) {
    if (fresh.length >= quota || left - cost(c.sec) < 0) break;
    fresh.push(c);
    left -= cost(c.sec);
  }

  const cards: ReviewEntry<T>[] = due.map((c) => ({ item: c.item, reason: 'due' }));
  fresh.forEach((c, k) => cards.splice(Math.min(cards.length, 2 + 3 * k), 0, { item: c.item, reason: 'new' }));
  const order: ReviewEntry<T>[] = [...repairs.map((r): ReviewEntry<T> => ({ item: r.item, reason: 'repair' })), ...cards];
  return { order, goal: order.length, repairs: repairs.length, due: due.length, fresh: fresh.length, sec: budget - left };
}
