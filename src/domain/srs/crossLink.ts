import { allC1Items } from '../c1x/preload';
import type { C1Item } from '../c1x/types';
import { packSentences } from '../c1pack/packFields';
import { orderPool } from '../drills/orderPool';
import { lemmaOf } from './context';
import type { TrainCard } from './types';

// Mehrfachkombination (V1): dieselbe Lexik soll auch in den festen, geprüften Sätzen der c1x-Aufgaben (mcc, ocl, err, kwt) vorkommen und dort
// als frischer Satz für die Karten-Abfrage dienen. Nur Lesen und nur, was im Speicher steht (`preloadC1x`); nichts wird geschrieben, keine neuen Inhalte.
// Treffer: die Aufgabe nennt die Karte in `lex[]` (genau) oder der Satz enthält das Wort (nur bei Wörtern ab 5 Buchstaben, sonst zu viele Zufallstreffer).

export const CROSS_MAX = 3;
const MIN_STEM = 5;

const norm = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Der ganze, ausgefüllte Satz einer Aufgabe (ohne Lücke) oder `null`, wenn die Art/der Eintrag keinen sauberen Satz hat. */
export function filledSentence(item: C1Item): string | null {
  switch (item.kind) {
    case 'mcc': {
      const a = item.options[item.answer];
      return a && item.text.split('___').length === 2 ? item.text.replace('___', a) : null;
    }
    case 'ocl': {
      const a = item.accept[0];
      return a && item.text.split('___').length === 2 ? item.text.replace('___', a) : null;
    }
    case 'err':
      return item.bad === null ? item.text : null;
    case 'kwt':
      return item.lead;
    default:
      return null;
  }
}

export type Entry = { id: string; kind: string; sentence: string; lower: string; lex: string[] };
let cache: { n: number; entries: Entry[] } | null = null;

/** Alle festen Sätze, die als frischer Satz für Karten dienen können (c1x, Satzbau-Pool, C1-Paket); für Tests und den Dublettenwächter. */
export function entries(): readonly Entry[] {
  const all = allC1Items();
  if (cache && cache.n === all.length) return cache.entries;
  const list: Entry[] = [];
  for (const it of all) {
    if (it.probe || it.pool || it.src !== 'seed') continue;
    const s = filledSentence(it);
    if (s) list.push({ id: it.id, kind: it.kind, sentence: s, lower: norm(s), lex: (it.lex ?? []).map(norm) });
  }
  // Feste Satz-Pools: der Satzbau-Pool (57 C1-Sätze) und die Beispielsätze des C1-Pakets (jeder Satz einmal).
  const have = new Set(list.map((e) => e.lower));
  const more = (id: string, kind: string, sentence: string): void => {
    const lower = norm(sentence);
    if (have.has(lower) || sentence.split(/\s+/).length < 5) return;
    have.add(lower);
    list.push({ id, kind, sentence, lower, lex: [] });
  };
  for (const e of orderPool()) more(`order-${e.en.slice(0, 24)}`, 'order', e.en);
  for (const e of packSentences()) more(`pack-${e.id}`, 'pack', e.sentence);
  list.sort((a, b) => (a.id < b.id ? -1 : 1));
  cache = { n: all.length, entries: list };
  return list;
}

/** Nur für Tests: Zwischenspeicher leeren. */
export const resetCrossLink = (): void => {
  cache = null;
};

/** Stämme, die ein Satz enthalten muss (Wörter ab 4 Buchstaben ohne Platzhalter `sb`/`sth`/Klammern). */
function stemsOf(card: Pick<TrainCard, 'word' | 'kind'>): string[] {
  const words = norm(card.word)
    .replace(/\([^)]*\)/g, ' ')
    .split(/[^a-z']+/)
    .filter((w) => w.length >= 3 && w !== 'sth' && w !== 'sb' && w !== 'the' && w !== 'and');
  return words.map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w));
}

/**
 * Feste Sätze aus c1x-Aufgaben, die zur Karte passen (höchstens `CROSS_MAX`, nach Aufgaben-ID sortiert, damit der Stand stabil bleibt).
 * Das Ergebnis sind Kandidaten; ob die Stelle im Satz sauber zu finden ist, prüft der Aufrufer (`findContext`/`chunkContext`).
 */
export function crossSentences(card: Pick<TrainCard, 'word' | 'kind'>): string[] {
  const list = entries();
  if (!list.length) return [];
  const word = norm(card.word);
  const stems = stemsOf(card);
  const exact = list.filter((e) => e.lex.includes(word));
  const loose =
    card.kind === 'chunk'
      ? stems.length >= 1
        ? list.filter((e) => stems.every((s) => e.lower.includes(s)) && !exact.includes(e))
        : []
      : lemmaOf(card.word).length >= MIN_STEM
        ? list.filter((e) => !exact.includes(e) && stems.length > 0 && stems.every((s) => e.lower.includes(s)))
        : [];
  return [...exact, ...loose].slice(0, CROSS_MAX).map((e) => e.sentence);
}
