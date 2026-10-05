import { learningDayEnd } from '../date';
import { cardSec, NEW_SEC } from './cost';
import { availableExercises } from './modes';
import { isLearningState, retrievability } from './scheduler';
import { themeFirst } from '../week/review';
import type { Lang, QueueItem, TrainCard } from './types';

// Runde „Wiederholen" (Lern-Entwurf §3): fällige Karten nach Dringlichkeit, dazu neue Karten
// im Tageskontingent – auch an Tagen mit vielen Fälligen (Kap. 15) – früh eingemischt.

export const NEW_PER_DAY_OPTIONS = [0, 2, 5, 10] as const;
export type NewPerDay = (typeof NEW_PER_DAY_OPTIONS)[number];
export const ROUND_SECONDS = 600;
export const ROUND_MIN = 10;
export const ROUND_MAX = 60;
const LEARNING_MAX = 15;
const NEW_COST = NEW_SEC;

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

const reviewCost = cardSec;

/**
 * Eingangskorb (anki-regeln.md §5, ersetzt `SRC_RANK`): Emrahs eigener Kontext zuerst, der
 * Startwortschatz zuletzt. Stufen: 1 Termin · 2 Lehrer (Lehrer-Feedback, frühere Preply-Importe) · 3 eigener Output/eigene Korrektur ·
 * 4 Wochenthema (`isThemeCard`, von außen) · 5 eigene Funde · 6 C1-Paket · 7 Lektion und Vorschläge ·
 * 8 Startwortschatz und Unbekanntes. Innerhalb einer Stufe die älteste zuerst.
 */
export const INBOX_TIERS: readonly (readonly string[])[] = [
  ['meeting'],
  ['teacher', 'preply'],
  ['say', 'fluency', 'scene', 'mail', 'pitch', 'biz', 'coach'],
  [],
  ['lookup', 'read', 'listen', 'translate', 'write', 'user', 'claude'],
  // C1-Paket (02.10.2026): geprüfte, geplante C1-Einträge hinter Emrahs eigenen Funden, vor allgemeinen Vorschlägen.
  ['pack'],
  ['lesson', 'ai', 'job', 'daily'],
];
const THEME_TIER = 3;
const LAST_TIER = INBOX_TIERS.length;

/** Stufe im Eingangskorb (0 = zuerst). Themenkarten landen auf Stufe 4 (Index 3), außer ihre Quelle ist höher. */
export function inboxTier(src: string | null, theme = false): number {
  const i = INBOX_TIERS.findIndex((t) => t.includes(src ?? ''));
  const own = i === -1 ? LAST_TIER : i;
  return theme ? Math.min(own, THEME_TIER) : own;
}

/**
 * Herkunft für den Korb. Wörter des täglichen Claude-Auftrags tragen `src: 'coach'` (`dailyIntake.ts`), sind aber
 * allgemeine Vorschläge und gehören wie `ai` auf Stufe 6 – nicht zu Emrahs eigenem Output (Stufe 3), sonst stünden sie vor
 * seinen eigenen Funden (Prüfung Englischlehrer 02.10.2026). Andere `coach`-Wörter (Druck-Training, Umschreiben) bleiben Stufe 3.
 */
export function tierSrc(c: Pick<TrainCard, 'src' | 'doc'>): string | null {
  if (c.src !== 'coach') return c.src;
  const o = c.doc.origin;
  return o && typeof o === 'object' && (o as { kind?: unknown }).kind === 'daily' ? 'daily' : c.src;
}

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

/** Erste Stufe, ab der der Tagesmix gilt: das C1-Paket (davor stehen Emrahs eigene Funde und Lehrer-Wörter, die bleiben vorn). */
const MIX_FROM_TIER = INBOX_TIERS.findIndex((t) => t.includes('pack'));
/** Tagesmix (Gesamtkonzept 3.3): von je drei neuen Wörtern zwei Wendungen und eins allgemein. */
export const MIX_PHRASES = 2;

/**
 * Mischt Wendungen (`chunk/…`, auch die des Pakets) und Wörter im Muster Wendung, Wendung, Wort, Wendung, Wendung, Wort …
 * Fehlt eine Sorte, bleibt die Reihenfolge der anderen unverändert. Stateless: jeden Tag beginnt das Muster neu, weil
 * eingeführte Karten die Liste verlassen.
 */
export function mixPhrases<T extends { kind: string }>(list: readonly T[]): T[] {
  const phrases = list.filter((c) => c.kind === 'chunk');
  const words = list.filter((c) => c.kind !== 'chunk');
  if (!phrases.length || !words.length) return [...list];
  const out: T[] = [];
  let p = 0;
  let w = 0;
  while (p < phrases.length || w < words.length) {
    for (let k = 0; k < MIX_PHRASES && p < phrases.length; k++) out.push(phrases[p++] as T);
    if (w < words.length) out.push(words[w++] as T);
    if (p >= phrases.length) while (w < words.length) out.push(words[w++] as T);
    if (w >= words.length) while (p < phrases.length) out.push(phrases[p++] as T);
  }
  return out;
}

/**
 * Neue Karten in Korb-Reihenfolge (§5); `isTheme` = Stufe 4 „Wochenthema“ (domain/week `isThemeCard`).
 * Eigene Funde und Lehrer-Wörter (Stufen vor dem Paket) stehen vorn; ab dem Paket gilt der Tagesmix `mixPhrases`.
 */
export function newCards(cards: readonly TrainCard[], isTheme?: (c: TrainCard) => boolean): TrainCard[] {
  const tier = new Map(cards.filter((c) => c.isNew).map((c) => [c.key, inboxTier(tierSrc(c), isTheme ? isTheme(c) : false)]));
  const sorted = cards
    .filter((c) => c.isNew)
    .sort((a, b) => (tier.get(a.key) ?? LAST_TIER) - (tier.get(b.key) ?? LAST_TIER) || (a.added < b.added ? -1 : a.added > b.added ? 1 : 0) || a.order - b.order || (a.key < b.key ? -1 : 1));
  const cut = sorted.findIndex((c) => (tier.get(c.key) ?? LAST_TIER) >= MIX_FROM_TIER);
  if (cut === -1) return sorted;
  return [...sorted.slice(0, cut), ...mixPhrases(sorted.slice(cut))];
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
  /** Stufe 4 des Eingangskorbs (Wochenthema). */
  isTheme?: (c: TrainCard) => boolean;
}): QueueItem[] {
  if (i.target <= 0) return [];
  const act = active(i.cards, i.lang).filter((c) => !i.exclude.has(c.key));
  const fresh = newCards(act, i.isTheme);
  const nNew = Math.min(Math.max(0, i.newQuotaLeft), fresh.length, i.target);
  // Block 1 (Prüfung Tageseinheit M1): fällige Karten zum Wochenthema zuerst, sonst nach Dringlichkeit.
  const urgent = capLeeches(dueCards(act, i.nowMs));
  const due = i.isTheme ? themeFirst(urgent.map((c) => ({ c, theme: i.isTheme?.(c) === true })), i.target).map((x) => x.c) : urgent;
  const reviews = due.slice(0, i.target - nNew).map((c): QueueItem => ({ key: c.key, reason: 'due', phase: 'quiz' }));
  if (reviews.length + nNew < i.target) {
    for (const c of aheadCards(act, i.nowMs).slice(0, i.target - nNew - reviews.length)) reviews.push({ key: c.key, reason: 'ahead', phase: 'quiz' });
  }
  const news = fresh.slice(0, nNew).map((c): QueueItem => ({ key: c.key, reason: 'new', phase: c.stage === 0 ? 'intro' : 'quiz' }));
  const out: QueueItem[] = [...reviews];
  news.forEach((n, k) => out.splice(Math.min(out.length, 2 + 3 * k), 0, n));
  return out;
}

/** Dauerfehler („Blutegel“): ab so vielen Vergessen-Fällen kostet eine Karte unverhältnismäßig viel Zeit. */
export const LEECH_AT = 5;
/** Höchstens so viele Dauerfehler-Karten je Runde; der Rest kommt an den nächsten Tagen (bleibt fällig, geht nie verloren). */
export const LEECH_MAX = 3;

/** Begrenzt Dauerfehler-Karten in einer Runde (Reihenfolge der übrigen bleibt). */
export function capLeeches(due: readonly TrainCard[]): TrainCard[] {
  let n = 0;
  return due.filter((c) => (c.fsrs.lapses >= LEECH_AT ? ++n <= LEECH_MAX : true));
}

/** Wiedervorlage in der Runde: frühestens drei Karten später (höchstens ans Ende). */
export const reinsertAt = (pos: number, queueLen: number): number => Math.min(queueLen, pos + 3);

