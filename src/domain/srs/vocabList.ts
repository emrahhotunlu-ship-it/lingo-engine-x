import { validateDoc } from '../../data/validate';
import { isDue } from '../metrics/definitions';
import { wordTier } from '../tutor/learnerWords';
import { legacyToFsrs } from './legacyFsrs';
import { FSRS_VERSION, readFsrs } from './scheduler';
import type { TrainCard } from './types';
import { CATALOG } from './modes';
import { clampStage, stageOf } from './ladder';
import { lapsesOf } from './lapses';
import { addDays } from '../date';
import { dayStartOf } from './spacing';

// Wortschatz-Bereich (Funktionsabgleich M1, M2, M9): Liste mit Suche, Filtern und Sortierung,
// Stapel der freien Runde und die Aktionen am Wort. Rein und testbar; geschrieben wird im
// Writer per `transform` auf dem frischen Stand. Nie gelöscht: „Ausblenden" setzt `hidden`,
// „Zurücksetzen" betrifft nur das Zusatzfeld `fsrs` (die Felder der alten App bleiben stehen).

type Doc = Record<string, unknown>;

export const VOCAB_FILTERS = ['all', 'due', 'new', 'learning', 'wobbly', 'safe', 'firm', 'job', 'phrases', 'hidden'] as const;
export type VocabFilter = (typeof VOCAB_FILTERS)[number];
export type VocabSort = 'stage' | 'az';

/** Freie Runde (M9): Stapel und Größe. */
export const DECKS = ['all', 'hard', 'job', 'phrases'] as const;
export type Deck = (typeof DECKS)[number];
export const DECK_SIZES = [10, 20, 30] as const;

const DAY = 86_400_000;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const low = (s: string | null | undefined) => (s ?? '').toLowerCase();

/** Wendung: eigene Wendungskarte (`chunk/*`) oder Mehrwort-Vokabel („take over“, Wortart „phrase“). */
export const isPhraseCard = (c: Pick<TrainCard, 'word' | 'pos'> & Partial<Pick<TrainCard, 'kind'>>): boolean =>
  c.kind === 'chunk' || /\s/.test(c.word.replace(/^to\s+/i, '').trim()) || /phras/i.test(c.pos ?? '');
export const isJobCard = (c: Pick<TrainCard, 'src'>): boolean => c.src === 'job';
/**
 * Wort aus einem Lesetext ohne Kernwort-Marke (`core`): passt vermutlich nicht zum Beruf (Auswertung 15.10.2026: shores, sturdier, strait kosten Wiederholungszeit).
 * Nur ein Hinweis in der Karten-Ansicht; die Karte bleibt unverändert und wird nie ausgeblendet oder anders eingeplant.
 */
export const isReadOffTopic = (c: Pick<TrainCard, 'src' | 'doc'>): boolean => c.src === 'read' && c.doc.core !== true;
/** Schwierig: oft vergessen oder noch unsicher (Stufe 1–2). */
export const isHardCard = (c: TrainCard): boolean => !c.isNew && (lapsesOf(c.doc) >= 2 || c.stage <= 2);

export function inDeck(c: TrainCard, deck: Deck): boolean {
  switch (deck) {
    case 'all':
      return true;
    case 'hard':
      return isHardCard(c);
    case 'job':
      return isJobCard(c);
    case 'phrases':
      return isPhraseCard(c);
  }
}

export function matchesFilter(c: TrainCard, f: VocabFilter, nowMs: number): boolean {
  if (f === 'hidden') return c.hidden;
  if (c.hidden) return false;
  switch (f) {
    case 'all':
      return true;
    case 'due':
      return isDue(c, nowMs);
    case 'new':
      return c.isNew;
    // Zustände: dieselbe Rechnung wie Wortblatt, Übung, Hub und Fortschritt (`metrics/cardStatus.ts`).
    case 'learning':
    case 'wobbly':
    case 'safe':
    case 'firm':
      return wordTier(c, nowMs) === f;
    case 'job':
      return isJobCard(c);
    case 'phrases':
      return isPhraseCard(c);
  }
}

export function filterCards(cards: readonly TrainCard[], o: { filter: VocabFilter; query: string; sort: VocabSort; nowMs: number }): TrainCard[] {
  const q = o.query.trim().toLowerCase();
  const out = cards.filter((c) => matchesFilter(c, o.filter, o.nowMs) && (!q || low(c.word).includes(q) || low(c.lemma).includes(q) || low(c.de).includes(q) || low(c.def).includes(q)));
  return out.sort((a, b) =>
    o.sort === 'az' ? a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }) : a.stage - b.stage || a.fsrs.due - b.fsrs.due || a.word.localeCompare(b.word, 'en'),
  );
}

export type VocabStats = { total: number; due: number; newToday: number; quota: number; stockEmpty: boolean };

export function vocabStats(cards: readonly TrainCard[], nowMs: number, today: string, newPerDay: number): VocabStats {
  const visible = cards.filter((c) => !c.hidden);
  return {
    total: visible.length,
    due: visible.filter((c) => matchesFilter(c, 'due', nowMs)).length,
    newToday: visible.filter((c) => c.intro === today).length,
    quota: newPerDay,
    stockEmpty: !visible.some((c) => c.isNew),
  };
}

/**
 * Bilanz je Abfrageart: neue Werte je Übungsart (`xs`) und die älteren Werte der alten App je
 * Modus (`modes`, {modus: {c, w}}). Die App zählt neue Antworten in beiden Feldern mit; deshalb
 * erscheint je Modus nur der Rest `modes − Summe(xs)` als eigene Zeile (`legacy`), nie doppelt.
 */
export function exerciseBalance(c: Pick<TrainCard, 'xs'> & Partial<Pick<TrainCard, 'modes'>>): Array<{ ex: string; c: number; w: number; legacy: boolean }> {
  const rows = Object.entries(c.xs)
    .map(([ex, v]) => ({ ex, c: v.c, w: v.w, legacy: false }))
    .filter((x) => x.c + x.w > 0);
  for (const [mode, v] of Object.entries(c.modes ?? {})) {
    const own = CATALOG.filter((d) => d.mode === mode).reduce((acc, d) => ({ c: acc.c + (c.xs[d.ex]?.c ?? 0), w: acc.w + (c.xs[d.ex]?.w ?? 0) }), { c: 0, w: 0 });
    const rest = { c: Math.max(0, v.c - own.c), w: Math.max(0, v.w - own.w) };
    if (rest.c + rest.w > 0) rows.push({ ex: mode, ...rest, legacy: true });
  }
  return rows.sort((a, b) => b.c + b.w - (a.c + a.w));
}

// ------------------------------------------------------------------ Aktionen am Wort

export type CardOp = { set: Doc } | { update: Doc } | null;

/** Ausblenden bzw. wieder aufnehmen (`hidden`, nie löschen). Startvokabel ohne Dokument: angelegt. */
export function hiddenOp(cur: Readonly<Doc> | undefined, path: string, seed: Readonly<Doc> | null, hidden: boolean): CardOp {
  if (!cur) return seed && hidden ? { set: { ...seed, hidden: true } } : null;
  if (!validateDoc(path, cur).ok) return null;
  if ((cur.hidden === true) === hidden) return null;
  return { update: { hidden } };
}

/**
 * Zurücksetzen: nur das Zusatzfeld `fsrs` beginnt neu (Zustand „neu", heute fällig). `last`
 * bleibt gleich, damit der neue Stand gilt; `S`, `D`, `due`, `stage` & Co. der alten App bleiben stehen.
 */
export function resetOp(cur: Readonly<Doc> | undefined, path: string, nowMs: number): CardOp {
  if (!cur || cur.hidden === true || !validateDoc(path, cur).ok) return null;
  const last = typeof cur.last === 'number' && cur.last > 0 ? cur.last : null;
  const fresh = legacyToFsrs({ state: 'new', due: nowMs }, nowMs);
  return { update: { fsrs: { ...fresh, v: FSRS_VERSION, src: 'lx', last } } };
}

/**
 * „Kenne ich“ (Lernplattform 2.0 §4.8): Stabilität 10 Tage, in `hist` steht `m:'known'` – nichts Erfundenes. Die Karte ist danach nicht „Fest“.
 * - Aus der Wortliste (Behauptung): Stufe 3, fällig in 10 Tagen.
 * - Nach bestandener Prüffrage in der Einführung (`pending`, Wort-Lernen 2, 21.10.2026): Die Prüffrage kam direkt nach dem Zeigen und prüft nur das
 *   Kurzzeitgedächtnis. Sie zählt deshalb erst am nächsten Lerntag: fällig um 04:00 Uhr des nächsten Lerntags, Stufe bleibt (mindestens 1). Gelingt dort
 *   der freie Abruf, steigt die Karte auf Stufe 3 (`applyReview.ts`, `knownConfirmed`); sonst lernt sie wie jede andere.
 * - `keepFar` (Wortliste, Datenprüfer K5): Steht die Karte schon auf Stufe ≥ 3 und ist erst nach dem nächsten Lerntag fällig, wird der Abstand nicht
 *   verkürzt – nur der Verlaufseintrag `m:'known'` kommt dazu.
 */
export const KNOWN_DAYS = 10;
export const KNOWN_STAGE = 3;
/** Fälligkeit nach bestandener Prüffrage in der Einführung: Beginn des nächsten Lerntags (04:00 Uhr). */
export const knownPendingDue = (day: string): number => dayStartOf(addDays(day, 1));

export function knownOp(cur: Readonly<Doc> | undefined, path: string, seed: Readonly<Doc> | null, nowMs: number, day: string, opts: { pending?: boolean; keepFar?: boolean } = {}): CardOp {
  const base = cur ?? seed;
  if (!base) return null;
  if (cur && (cur.hidden === true || !validateDoc(path, cur).ok)) return null;
  const prev = readFsrs(base, nowMs);
  const pending = opts.pending === true;
  const due = pending ? knownPendingDue(day) : nowMs + KNOWN_DAYS * DAY;
  const hist0 = Array.isArray(base.hist) ? (base.hist as unknown[]) : [];
  if (pending && opts.keepFar && cur && stageOf(cur) >= KNOWN_STAGE && prev.due > due) return { update: { hist: [...hist0, { t: nowMs, m: 'known', g: 3 }].slice(-12) } };
  const S = Math.max(num(base.S), KNOWN_DAYS);
  const D = Math.min(10, Math.max(1, num(base.D) || 5));
  const reps = Math.max(0, Math.round(num(base.reps))) + 1;
  const fsrs = { v: FSRS_VERSION, due, stability: S, difficulty: D, state: 2, reps: Math.max(prev.reps, 0) + 1, lapses: prev.lapses, last: nowMs, scheduledDays: pending ? 1 : KNOWN_DAYS, learningSteps: 0, src: 'lx' };
  const hist = hist0;
  const patch: Doc = {
    S,
    D,
    due,
    last: nowMs,
    state: 'review',
    reps,
    stage: Math.max(stageOf(base), pending ? 1 : clampStage(KNOWN_STAGE)),
    hist: [...hist, { t: nowMs, m: 'known', g: 3 }].slice(-12),
    fsrs,
  };
  if (base.state === 'new' && (typeof base.intro !== 'string' || !base.intro)) patch.intro = day;
  return cur ? { update: patch } : { set: { ...base, ...patch } };
}
