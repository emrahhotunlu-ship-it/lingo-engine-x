import { learningDayEnd } from '../date';
import { availableExercises } from './modes';
import { isLearningState, retrievability } from './scheduler';
import type { Lang, QueueItem, TrainCard } from './types';

// Runde „Wiederholen" (Lern-Entwurf §3): fällige Karten nach Dringlichkeit, dazu neue Karten
// im Tageskontingent – auch an Tagen mit vielen Fälligen (Kap. 15) – früh eingemischt.

export const NEW_PER_DAY_OPTIONS = [0, 2, 5, 10] as const;
export type NewPerDay = (typeof NEW_PER_DAY_OPTIONS)[number];
export const ROUND_SECONDS = 600;
export const ROUND_MIN = 10;
export const ROUND_MAX = 60;
const LEARNING_MAX = 15;
const NEW_COST = 50;

/** Gespeicherter Wert → erlaubter Wert (nächster, bei Gleichstand der kleinere); fehlt er, 5. */
export function normalizeNewPerDay(v: unknown): NewPerDay {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 5;
  let best: NewPerDay = 5;
  let bestD = Infinity;
  for (const o of NEW_PER_DAY_OPTIONS) {
    const d = Math.abs(o - v);
    if (d < bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

const reviewCost = (c: TrainCard) => (c.stage <= 2 ? 12 : c.stage <= 4 ? 20 : 35);

/** Quellen mit Emrahs eigenem Kontext zuerst, Startwortschatz zuletzt. */
const SRC_RANK = ['lookup', 'read', 'translate', 'lesson', 'coach', 'preply', 'claude', 'ai', 'user', 'listen', 'write', 'job', 'seed'];
const srcRank = (s: string | null) => {
  const i = SRC_RANK.indexOf(s ?? '');
  return i === -1 ? SRC_RANK.length - 1 : i;
};

/** Kann die Karte in dieser Sprache überhaupt abgefragt werden? */
export const quizzable = (c: TrainCard, lang: Lang, poolSize: number): boolean => availableExercises(c, lang, poolSize).length > 0;

function active(cards: readonly TrainCard[], lang: Lang): TrainCard[] {
  const pool = cards.filter((c) => !c.hidden);
  return pool.filter((c) => quizzable(c, lang, pool.length - 1));
}

/** Fällige Karten nach Dringlichkeit: Lernschritte zuerst, dann geringste Abrufwahrscheinlichkeit. */
export function dueCards(cards: readonly TrainCard[], nowMs: number): TrainCard[] {
  const end = learningDayEnd(nowMs);
  return cards
    .filter((c) => !c.isNew && c.fsrs.due < end)
    .map((c) => ({ c, learning: isLearningState(c.fsrs), r: retrievability(c.fsrs, nowMs) }))
    .sort((a, b) => Number(b.learning) - Number(a.learning) || (a.learning ? a.c.fsrs.due - b.c.fsrs.due : a.r - b.r) || a.c.fsrs.due - b.c.fsrs.due || (a.c.key < b.c.key ? -1 : 1))
    .map((x) => x.c);
}

export function newCards(cards: readonly TrainCard[]): TrainCard[] {
  return cards
    .filter((c) => c.isNew)
    .sort((a, b) => srcRank(a.src) - srcRank(b.src) || a.order - b.order || (a.added < b.added ? -1 : a.added > b.added ? 1 : 0) || (a.key < b.key ? -1 : 1));
}

function aheadCards(cards: readonly TrainCard[], nowMs: number): TrainCard[] {
  const end = learningDayEnd(nowMs);
  return cards
    .filter((c) => !c.isNew && c.fsrs.due >= end)
    .map((c) => ({ c, r: retrievability(c.fsrs, nowMs) }))
    .sort((a, b) => a.r - b.r || (a.c.key < b.c.key ? -1 : 1))
    .map((x) => x.c);
}

/** W2: Anteil neuer Karten am Zeitbudget, wenn Wiederholungen fällig sind. */
const NEW_SHARE = 0.4;
/** W2: So viele fällige Karten passen mindestens in die Runde (wenn so viele fällig sind). */
const DUE_MIN = 10;

/**
 * W2: Wiederholungen haben Vorrang. Neue Karten bekommen höchstens etwa 40 % des Zeitbudgets und
 * lassen Platz für mindestens 10 fällige Karten; die Untergrenze `min(2, Kontingent)` bleibt
 * (Kap. 15: neue Wörter auch an Tagen mit vielen Wiederholungen). Ohne Fällige: volles Kontingent.
 */
function newShare(wanted: number, due: readonly TrainCard[]): number {
  if (!due.length || wanted <= 0) return Math.max(0, wanted);
  const floor = Math.min(2, wanted);
  const dueAll = due.reduce((a, c) => a + reviewCost(c), 0);
  const reserve = due.slice(0, DUE_MIN).reduce((a, c) => a + reviewCost(c), 0);
  const byShare = Math.round((ROUND_SECONDS - Math.min(dueAll, ROUND_SECONDS * (1 - NEW_SHARE))) / NEW_COST);
  const byReserve = Math.floor(Math.max(0, ROUND_SECONDS - reserve) / NEW_COST);
  return Math.max(floor, Math.min(wanted, byShare, byReserve));
}

export type RoundPlan = { target: number; due: number; new: number; ahead: number };

/**
 * Restliches Kontingent neuer Karten heute (phase2-plan D17): Lektionswörter zählen zu
 * `newPerDay`, aber das Wiederholen behält mindestens `min(2, newPerDay)` andere neue Karten –
 * so verdrängt eine Lektion nie die eigenen neuen Wörter (Kap. 15).
 */
export function newQuotaLeft(newPerDay: unknown, introducedToday: number, introducedLessonToday = 0): number {
  const n = normalizeNewPerDay(newPerDay);
  const other = Math.max(0, introducedToday - introducedLessonToday);
  return Math.max(0, n - introducedToday, Math.min(2, n) - other);
}

/** Umfang der heutigen Pflichtrunde: etwa 10 Minuten, mindestens 10, höchstens 60 Karten. */
export function planRound(i: { cards: readonly TrainCard[]; nowMs: number; newPerDay: number; introducedToday: number; introducedLessonToday?: number; lang: Lang }): RoundPlan {
  const act = active(i.cards, i.lang);
  if (!act.length) return { target: 0, due: 0, new: 0, ahead: 0 };
  const quotaLeft = newQuotaLeft(i.newPerDay, i.introducedToday, i.introducedLessonToday ?? 0);
  const due = dueCards(act, i.nowMs);
  const nNew = newShare(Math.min(quotaLeft, newCards(act).length), due);
  let budget = ROUND_SECONDS - nNew * NEW_COST;
  let nDue = 0;
  let learning = 0;
  for (const c of due) {
    const cost = reviewCost(c);
    if (isLearningState(c.fsrs) && learning < LEARNING_MAX) {
      learning++;
      nDue++;
      budget -= cost;
      continue;
    }
    if (budget - cost < 0) break;
    budget -= cost;
    nDue++;
  }
  let nAhead = 0;
  if (nNew + nDue < ROUND_MIN) nAhead = Math.min(ROUND_MIN - nNew - nDue, aheadCards(act, i.nowMs).length);
  const target = Math.min(ROUND_MAX, nNew + nDue + nAhead);
  return { target, due: nDue, new: nNew, ahead: nAhead };
}

/**
 * Reihenfolge der Runde: Wiederholungen nach Dringlichkeit, neue Karten an den Stellen 2, 5, 8, …
 * `exclude` = heute schon beantwortete Karten. Neue Karten beginnen mit der Einführung.
 */
export function buildQueue(i: {
  cards: readonly TrainCard[];
  nowMs: number;
  target: number;
  newQuotaLeft: number;
  exclude: ReadonlySet<string>;
  lang: Lang;
}): QueueItem[] {
  if (i.target <= 0) return [];
  const act = active(i.cards, i.lang).filter((c) => !i.exclude.has(c.key));
  const fresh = newCards(act);
  const nNew = Math.min(Math.max(0, i.newQuotaLeft), fresh.length, i.target);
  const due = dueCards(act, i.nowMs);
  const reviews = due.slice(0, i.target - nNew).map((c): QueueItem => ({ key: c.key, reason: 'due', phase: 'quiz' }));
  if (reviews.length + nNew < i.target) {
    for (const c of aheadCards(act, i.nowMs).slice(0, i.target - nNew - reviews.length)) reviews.push({ key: c.key, reason: 'ahead', phase: 'quiz' });
  }
  const news = fresh.slice(0, nNew).map((c): QueueItem => ({ key: c.key, reason: 'new', phase: c.stage === 0 ? 'intro' : 'quiz' }));
  const out: QueueItem[] = [...reviews];
  news.forEach((n, k) => out.splice(Math.min(out.length, 2 + 3 * k), 0, n));
  return out;
}

/** Wiedervorlage in der Runde: frühestens drei Karten später (höchstens ans Ende). */
export const reinsertAt = (pos: number, queueLen: number): number => Math.min(queueLen, pos + 3);

