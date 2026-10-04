import { bank, wordId } from '../bank/words';
import { normalize, withoutTo } from '../domain/answer/normalize';
import { introducedCard, knownCard } from './session';
import type { CardRec, CardSource } from './types';

// „Mein Wortschatz": die Liste aller Karten (Bank, alte App, eigene) mit Suche, Filtern und
// Sortierung, dazu die Aktionen am einzelnen Wort und das Anlegen eigener Wörter. Reine Logik.

const DAY = 86_400_000;

/** Kleinbuchstaben ohne Akzente: „überlastet" findet auch „uberlastet". */
const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const key = (s: string): string => withoutTo(normalize(s));

export type VocabRow = {
  id: string;
  word: string;
  de: string;
  src: CardSource;
  /** Sicherheit 0–4 (wie `Certainty`). */
  lv: number;
  hide: boolean;
  /** FSRS-Zustand (0 = noch nie geübt) und Termin. */
  state: number;
  due: number;
  /** Zuletzt geübt, sonst angelegt (ms). */
  recent: number;
  bad: number;
  stability: number;
  /** Suchtext und Sortierschlüssel, einmal berechnet. */
  hay: string;
  sortKey: string;
};

export function rowOf(id: string, rec: CardRec): VocabRow {
  const b = bank().byId.get(id);
  const word = b?.w ?? rec.w ?? id;
  const de = b?.de ?? rec.de ?? '';
  return {
    id,
    word,
    de,
    src: rec.src,
    lv: Math.max(0, Math.min(4, Math.round(rec.lv))),
    hide: rec.hide === 1,
    state: rec.f.state,
    due: rec.f.due,
    recent: rec.f.last ?? rec.add,
    bad: rec.bad ?? 0,
    stability: rec.f.stability,
    hay: fold(`${word} ${de}`),
    sortKey: fold(withoutTo(word.toLowerCase())),
  };
}

export const vocabRows = (cards: ReadonlyMap<string, CardRec>): VocabRow[] => [...cards].map(([id, rec]) => rowOf(id, rec));

export type VocabLevel = 'all' | 0 | 1 | 2 | 3 | 4;
export type VocabOrigin = 'all' | CardSource;
export type VocabSort = 'recent' | 'alpha' | 'weak';

export type VocabFilter = {
  query: string;
  level: VocabLevel;
  /** Nur Karten, die jetzt fällig sind. */
  due: boolean;
  /** true = nur gesperrte Karten, false = nur die übrigen. */
  hidden: boolean;
  origin: VocabOrigin;
  sort: VocabSort;
};

export const defaultFilter = (): VocabFilter => ({ query: '', level: 'all', due: false, hidden: false, origin: 'all', sort: 'recent' });

export const isDueRow = (r: VocabRow, nowMs: number): boolean => r.state !== 0 && r.due <= nowMs;

export function filterRows(rows: readonly VocabRow[], f: VocabFilter, nowMs: number): VocabRow[] {
  const q = fold(f.query.trim());
  return rows.filter(
    (r) => r.hide === f.hidden && (f.level === 'all' || r.lv === f.level) && (f.origin === 'all' || r.src === f.origin) && (!f.due || isDueRow(r, nowMs)) && (!q || r.hay.includes(q)),
  );
}

const alpha = (a: VocabRow, b: VocabRow): number => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0);

export function sortRows(rows: readonly VocabRow[], sort: VocabSort): VocabRow[] {
  const out = [...rows];
  if (sort === 'alpha') return out.sort(alpha);
  if (sort === 'weak') return out.sort((a, b) => a.lv - b.lv || b.bad - a.bad || a.stability - b.stability || alpha(a, b));
  return out.sort((a, b) => b.recent - a.recent || alpha(a, b));
}

export type VocabStats = { total: number; solid: number; due: number; hidden: number };

/** Zähler oben: gesperrte Karten zählen nicht mit. */
export function vocabStats(rows: readonly VocabRow[], nowMs: number): VocabStats {
  const s: VocabStats = { total: 0, solid: 0, due: 0, hidden: 0 };
  for (const r of rows) {
    if (r.hide) {
      s.hidden++;
      continue;
    }
    s.total++;
    if (r.lv >= 3) s.solid++;
    if (isDueRow(r, nowMs)) s.due++;
  }
  return s;
}

export type NextLabel = { kind: 'none' | 'due' | 'today' | 'tomorrow' } | { kind: 'days'; n: number };

/** Nächster Termin einer Karte für die Anzeige in der Liste. */
export function nextLabel(r: Pick<VocabRow, 'state' | 'due'>, nowMs: number): NextLabel {
  if (r.state === 0) return { kind: 'none' };
  if (r.due <= nowMs) return { kind: 'due' };
  const n = Math.round((r.due - nowMs) / DAY);
  return n <= 0 ? { kind: 'today' } : n === 1 ? { kind: 'tomorrow' } : { kind: 'days', n };
}

// --- Aktionen am einzelnen Wort ---

/** „Als bekannt markieren": Stufe und Planung wie beim Sortieren (`knownCard`), nichts Besseres wird verschlechtert. */
export function markedKnown(rec: CardRec, nowMs: number): CardRec {
  const k = knownCard(nowMs);
  const keepPlan = rec.f.state !== 0 && rec.f.stability >= k.f.stability;
  return { ...rec, f: keepPlan ? rec.f : k.f, lv: Math.max(rec.lv, k.lv), known: 1, ok: (rec.ok ?? 0) + 1 };
}

/** „Nicht mehr üben" und Rückgängig: `hide` wird immer ausdrücklich geschrieben (Teile eines Dokuments werden nur ergänzt). */
export const hiddenCard = (rec: CardRec, hide: boolean): CardRec => ({ ...rec, hide: hide ? 1 : 0 });

/** Neue Karte für ein Bank-Wort, das noch nicht im Training ist. */
export const bankCard = (nowMs: number, opts: { known?: boolean; hide?: boolean } = {}): CardRec => {
  const base = opts.known ? knownCard(nowMs) : introducedCard(nowMs);
  return opts.hide ? { ...base, hide: 1 } : base;
};

// --- Eigene Wörter ---

export type OwnWord = { en: string; de: string; ex?: string };
export type Duplicate = { kind: 'card' | 'bank'; id: string };

const squash = (s: string, max: number): string => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** Kennung und Karte für ein eigenes Wort, `null` ohne Englisch, Deutsch oder verwertbare Kennung. */
export function ownCard(w: OwnWord, nowMs: number): [string, CardRec] | null {
  const en = squash(w.en, 80);
  const de = squash(w.de, 160);
  const id = wordId(en);
  if (!id || !de) return null;
  const rec: CardRec = { ...introducedCard(nowMs), src: 'user', w: en, de };
  const ex = squash(w.ex ?? '', 300);
  if (ex) rec.ex = ex;
  return [id, rec];
}

/**
 * Ist das Wort schon da? „card" = schon in deinen Karten, „bank" = steckt in der Wortbank und
 * kommt von selbst dran. Gefunden wird über die Kennung und über den Wortlaut (auch bei Karten
 * der alten App mit anderer Kennung und bei Wendungen der Bank).
 */
export function duplicateFinder(cards: ReadonlyMap<string, CardRec>): (word: string) => Duplicate | null {
  const b = bank();
  const byText = new Map<string, string>();
  for (const [id, rec] of cards) if (rec.w) byText.set(key(rec.w), id);
  const phraseByText = new Map<string, string>();
  for (const p of b.phrasal) phraseByText.set(key(p.w), p.i);
  return (word) => {
    const id = wordId(word);
    const k = key(word);
    if (!id || !k) return null;
    const phraseId = phraseByText.get(k);
    const cardId = cards.has(id) ? id : (byText.get(k) ?? (phraseId && cards.has(phraseId) ? phraseId : undefined));
    if (cardId) return { kind: 'card', id: cardId };
    if (b.byId.has(id)) return { kind: 'bank', id };
    if (phraseId) return { kind: 'bank', id: phraseId };
    return null;
  };
}

export type OwnPlan = {
  create: Array<[string, CardRec]>;
  duplicates: Array<{ word: string; dup: Duplicate }>;
  /** Einträge ohne Englisch oder Deutsch. */
  invalid: string[];
};

/** Mehrere eigene Wörter auf einmal planen: Duplikate (auch innerhalb der Eingabe) werden gemeldet, nichts doppelt angelegt. */
export function planOwnWords(words: readonly OwnWord[], cards: ReadonlyMap<string, CardRec>, nowMs: number): OwnPlan {
  const find = duplicateFinder(cards);
  const plan: OwnPlan = { create: [], duplicates: [], invalid: [] };
  const seen = new Map<string, string>();
  for (const w of words) {
    const made = ownCard(w, nowMs);
    if (!made) {
      plan.invalid.push(w.en || w.de);
      continue;
    }
    const [id, rec] = made;
    const k = key(rec.w ?? '');
    const dup = find(rec.w ?? '') ?? (seen.has(k) ? ({ kind: 'card', id: seen.get(k)! } as const) : null);
    if (dup) {
      plan.duplicates.push({ word: rec.w ?? '', dup });
      continue;
    }
    seen.set(k, id);
    plan.create.push(made);
  }
  return plan;
}

/** Trennzeichen zwischen Wort und Bedeutung: „ – ", „ - ", „–", „=", „:" (mit Leerzeichen), „;", Tabulator. */
const SEPARATOR = /\s+-\s+|\s*[–—]\s*|\s*[=;\t]\s*|\s*:\s+/;
const BULLET = /^\s*(?:[-*•·]|\d+[.)])\s+/;

export type ParsedLines = { words: OwnWord[]; bad: string[] };

/** Zeilen der Form `Wort – Bedeutung` lesen. Zeilen ohne Bedeutung kommen in `bad` (nie still verworfen). */
export function parseWordLines(text: string): ParsedLines {
  const out: ParsedLines = { words: [], bad: [] };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(BULLET, '').trim();
    if (!line) continue;
    const m = SEPARATOR.exec(line);
    const en = m ? line.slice(0, m.index).trim() : '';
    const de = m ? line.slice(m.index + m[0].length).trim() : '';
    if (en && de && /[A-Za-z]/.test(en) && en.length <= 80) out.words.push({ en, de });
    else out.bad.push(line.slice(0, 80));
  }
  return out;
}
