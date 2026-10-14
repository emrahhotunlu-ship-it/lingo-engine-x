import type { ArticleItem, Check, KeyWord, ReadView } from '../schemas';
import { VIEWS } from '../schemas';
import { containsWord } from './accept';

// Reine Hilfen des Lesers (docs/umbau/lesen-plan.md §2.2): Sätze, Ansichten, Aufdeck-Zustand je Satz, Schlüsselwörter.
// Kein React, keine Datenbank: alles hier ist ohne Oberfläche testbar.

/** Ein Satz des Artikels mit laufender Nummer (ab 1, über alle Absätze) und Fundstelle `[Absatz, Satz]`. */
export type ReaderSentence = { n: number; p: number; s: number; e: string; d: string };

export type ReaderModel = {
  sentences: ReaderSentence[];
  /** Sätze je Absatz, leere Absätze fehlen. */
  paragraphs: ReaderSentence[][];
  total: number;
};

/** Artikel in Sätze zerlegen. Leere Absätze (aufgeräumter Artikel) und leere Sätze fallen weg. */
export function buildModel(article: Pick<ArticleItem, 'paras'>): ReaderModel {
  const sentences: ReaderSentence[] = [];
  const paragraphs: ReaderSentence[][] = [];
  article.paras.forEach((para, p) => {
    const row: ReaderSentence[] = [];
    para.forEach((x, s) => {
      if (!x.e.trim()) return;
      const sent: ReaderSentence = { n: sentences.length + 1, p, s, e: x.e, d: x.d };
      sentences.push(sent);
      row.push(sent);
    });
    if (row.length) paragraphs.push(row);
  });
  return { sentences, paragraphs, total: sentences.length };
}

/** Ansicht aus einem gespeicherten Wert; unbekannt = B (Standard, Entscheidung 13.10.2026). */
export function viewOf(value: unknown): ReadView {
  return VIEWS.find((v) => v === value) ?? 'b';
}

/**
 * Was ist zu Beginn einer Ansicht schon „aufgedeckt“? Aufgedeckt = die jeweils ANDERE Sprache ist sichtbar:
 * A zeigt Deutsch unter dem Englischen sofort, B zeigt Deutsch erst auf Tipp, C zeigt das Englische erst auf Tipp.
 */
export function initialRevealed(view: ReadView, total: number): Set<number> {
  if (view !== 'a') return new Set();
  return new Set(Array.from({ length: total }, (_, i) => i + 1));
}

/** Satz an- oder abwählen (neue Menge, die alte bleibt unverändert). */
export function toggleSentence(set: ReadonlySet<number>, n: number): Set<number> {
  const next = new Set(set);
  if (next.has(n)) next.delete(n);
  else next.add(n);
  return next;
}

/** Alle Sätze auf einmal: sind schon alle aufgedeckt, werden alle zugedeckt, sonst alle aufgedeckt. */
export function toggleAll(set: ReadonlySet<number>, total: number): Set<number> {
  return set.size >= total ? new Set() : new Set(Array.from({ length: total }, (_, i) => i + 1));
}

export type SentenceView = {
  /** Englisch sichtbar (und antippbar). */
  showEn: boolean;
  /** Deutsch sichtbar. */
  showDe: boolean;
  /** Das Deutsche steht zuerst (Ansicht C). */
  deFirst: boolean;
};

/** Was zeigt ein Satz in einer Ansicht, je nachdem ob er aufgedeckt ist? */
export function sentenceState(view: ReadView, revealed: boolean): SentenceView {
  if (view === 'c') return { showEn: revealed, showDe: true, deFirst: true };
  return { showEn: true, showDe: revealed, deFirst: false };
}

/** Wie viele Sätze hat der Leser selbst aufgedeckt (ohne die, die Ansicht A von Anfang an offen zeigt)? */
export function userRevealCount(view: ReadView, revealed: ReadonlySet<number>, total: number): number {
  return view === 'a' ? Math.max(0, total - revealed.size) : revealed.size;
}

// ---------------------------------------------------------------- Schlüsselwörter

export type KeyWordPick = {
  kw: KeyWord;
  /** Der Satz des Artikels, in dem das Wort steht (Ursprungssatz der Karte); `null`, wenn es in keinem Satz vorkommt. */
  sentence: ReaderSentence | null;
  /** Die Wortform, wie sie im Satz steht (z. B. „headcounts“ für „headcount“). */
  surface: string | null;
  /** Stelle der Wortform im Satz (für die Hervorhebung). */
  span: [number, number] | null;
};

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Wortform samt Stelle im Satz: Wortanfang genau, Endungen erlaubt („headcount“ → „headcounts“), Groß/Klein egal. */
export function findSurface(sentence: string, word: string): { surface: string; span: [number, number] } | null {
  const parts = word.trim().split(/\s+/).filter(Boolean).map(esc);
  if (!parts.length) return null;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('\\s+')}[\\p{L}\\p{N}]*`, 'iu');
  const m = re.exec(sentence);
  if (!m) return null;
  return { surface: m[0], span: [m.index, m.index + m[0].length] };
}

/**
 * Satz zu einem Schlüsselwort: erst die Fundstelle `i`, dann der erste Satz, der das Wort enthält. Das Wort MUSS im Satz stehen,
 * sonst wäre die Karte ohne gültigen Ursprungssatz (Kap. 15); dann ist `sentence` null und der Knopf bleibt aus.
 */
export function pickKeyWord(model: ReaderModel, kw: KeyWord): KeyWordPick {
  const direct = model.paragraphs[kw.i[0]]?.find((x) => x.s === kw.i[1]) ?? null;
  const candidates = direct ? [direct, ...model.sentences] : model.sentences;
  for (const sent of candidates) {
    if (!containsWord(sent.e, kw.w)) continue;
    const hit = findSurface(sent.e, kw.w);
    if (hit) return { kw, sentence: sent, surface: hit.surface, span: hit.span };
  }
  return { kw, sentence: null, surface: null, span: null };
}

/** Die Schlüsselwörter eines Artikels (höchstens 5), doppelte Wörter nur einmal. */
export function pickKeyWords(model: ReaderModel, list: readonly KeyWord[] | null | undefined): KeyWordPick[] {
  const seen = new Set<string>();
  const out: KeyWordPick[] = [];
  for (const kw of list ?? []) {
    const key = kw.w.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(pickKeyWord(model, kw));
    if (out.length >= 5) break;
  }
  return out;
}

/** Hervorhebung im Satz: erste Fundstelle eines Schlüsselworts je Satz (Satznummer → Stelle). */
export function highlightMap(picks: readonly KeyWordPick[]): Map<number, [number, number]> {
  const map = new Map<number, [number, number]>();
  for (const p of picks) if (p.sentence && p.span && !map.has(p.sentence.n)) map.set(p.sentence.n, p.span);
  return map;
}

/** Stufe für die Karte: nur ein gültiger Wert wie „C1“, sonst nichts (die Karte bekommt dann ihre Voreinstellung). */
export function cardLevel(level: string | null | undefined): string | null {
  const m = /^([abc])([12])$/i.exec((level ?? '').trim());
  return m ? `${(m[1] ?? '').toUpperCase()}${m[2]}` : null;
}

/** Prüffragen: höchstens die ersten drei (der Artikel hat sie schon geprüft, hier nur die Obergrenze). */
export function pickChecks(list: readonly Check[] | null | undefined): Check[] {
  return (list ?? []).slice(0, 3);
}

/** Nummer des obersten sichtbaren Satzes aus den Unterkanten (px) der Satzzeilen und der Höhe der festen Kopfleiste. */
export function topVisibleSentence(rows: ReadonlyArray<{ n: number; bottom: number }>, headerPx: number): number {
  for (const r of rows) if (r.bottom > headerPx + 4) return r.n;
  return rows.length ? (rows[rows.length - 1]?.n ?? 1) : 1;
}
