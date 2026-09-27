import { validateDoc } from '../../data/validate';
import { learningDayEnd } from '../date';
import { legacyToFsrs } from './legacyFsrs';
import { FSRS_VERSION, readFsrs } from './scheduler';
import type { TrainCard } from './types';
import { CATALOG } from './modes';
import { clampStage, stageOf } from './ladder';

// Wortschatz-Bereich (Funktionsabgleich M1, M2, M9): Liste mit Suche, Filtern und Sortierung,
// Stapel der freien Runde und die Aktionen am Wort. Rein und testbar; geschrieben wird im
// Writer per `transform` auf dem frischen Stand. Nie gelöscht: „Ausblenden" setzt `hidden`,
// „Zurücksetzen" betrifft nur das Zusatzfeld `fsrs` (die Felder der alten App bleiben stehen).

type Doc = Record<string, unknown>;

export const VOCAB_FILTERS = ['all', 'due', 'new', 'shaky', 'helped', 'solid', 'job', 'phrases', 'hidden'] as const;
export type VocabFilter = (typeof VOCAB_FILTERS)[number];
export type VocabSort = 'stage' | 'az';

/** Freie Runde (M9): Stapel und Größe. */
export const DECKS = ['all', 'hard', 'job', 'phrases'] as const;
export type Deck = (typeof DECKS)[number];
export const DECK_SIZES = [10, 20, 30] as const;

const DAY = 86_400_000;
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const low = (s: string | null | undefined) => (s ?? '').toLowerCase();

export const isPhraseCard = (c: Pick<TrainCard, 'word' | 'pos'>): boolean => /\s/.test(c.word.replace(/^to\s+/i, '').trim()) || /phras/i.test(c.pos ?? '');
export const isJobCard = (c: Pick<TrainCard, 'src'>): boolean => c.src === 'job';
/** Schwierig: oft vergessen oder noch unsicher (Stufe 1–2). */
export const isHardCard = (c: TrainCard): boolean => !c.isNew && (num(c.doc.lapses) >= 2 || c.stage <= 2);

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
      return !c.isNew && c.fsrs.due < learningDayEnd(nowMs);
    case 'new':
      return c.isNew;
    case 'shaky':
      return !c.isNew && c.stage >= 1 && c.stage <= 2;
    case 'helped':
      return c.stage === 3;
    case 'solid':
      return c.stage >= 4;
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

/** „Kenne ich schon" nach bestandener Probeabfrage (M2): Stufe 4, fällig in 30 Tagen. */
export const KNOWN_DAYS = 30;

export function knownOp(cur: Readonly<Doc> | undefined, path: string, seed: Readonly<Doc> | null, nowMs: number, day: string): CardOp {
  const base = cur ?? seed;
  if (!base) return null;
  if (cur && (cur.hidden === true || !validateDoc(path, cur).ok)) return null;
  const prev = readFsrs(base, nowMs);
  const due = nowMs + KNOWN_DAYS * DAY;
  const S = Math.max(num(base.S), KNOWN_DAYS);
  const D = Math.min(10, Math.max(1, num(base.D) || 5));
  const reps = Math.max(0, Math.round(num(base.reps))) + 1;
  const fsrs = { v: FSRS_VERSION, due, stability: S, difficulty: D, state: 2, reps: Math.max(prev.reps, 0) + 1, lapses: prev.lapses, last: nowMs, scheduledDays: KNOWN_DAYS, learningSteps: 0, src: 'lx' };
  const hist = Array.isArray(base.hist) ? (base.hist as unknown[]) : [];
  const patch: Doc = {
    S,
    D,
    due,
    last: nowMs,
    state: 'review',
    reps,
    stage: Math.max(stageOf(base), clampStage(4)),
    hist: [...hist, { t: nowMs, m: 'type', g: 4 }].slice(-12),
    fsrs,
  };
  if (base.state === 'new' && (typeof base.intro !== 'string' || !base.intro)) patch.intro = day;
  return cur ? { update: patch } : { set: { ...base, ...patch } };
}
