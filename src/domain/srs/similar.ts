import { packExtraOf } from '../c1pack/packFields';
import type { TrainCard } from './types';

// Wort-Lernen 2, Paket „Kern“ (docs/umbau/wort-fest-plan.md, „Menge“): keine zwei Wörter mit ähnlicher Bedeutung am selben Einführungstag –
// ähnliche neue Wörter stören sich gegenseitig beim Einprägen (Interferenz). Rein und deterministisch.
//
// Einfache Faustregel (keine KI, keine Wortnetz-Daten): Zwei Karten gelten als ähnlich, wenn
//  1. die gleichwertigen Varianten aus dem C1-Paket (`alt`, auch an der Karte) das andere Wort enthalten oder sich überschneiden
//     („address concerns“ ↔ „tackle concerns“), oder
//  2. sie ein englisches Inhaltswort teilen (ab 4 Buchstaben, ohne leichte Verben und Füllwörter: „raise concerns“ ↔ „address concerns“), oder
//  3. ihre deutschen Bedeutungen ein Inhaltswort teilen (ab 5 Buchstaben, ohne „etwas“, „jemanden“ …: „angehen“ in „tackle“ und „address“).
// Grenzen: Synonyme ohne gemeinsames Wort in Bedeutung oder Varianten (z. B. „huge“ ↔ „enormous“ mit „riesig“ ↔ „gewaltig“) erkennt die Regel nicht;
// umgekehrt sperrt ein gemeinsames Wort auch Paare, die nur ähnlich klingen. Gesperrt wird nie ganz: Reicht der Vorrat nicht, füllt die Runde mit den
// zurückgestellten Karten auf (die Untergrenze neuer Wörter bleibt).

type Card = Pick<TrainCard, 'word' | 'lemma' | 'de' | 'doc'>;

const EN_STOP = new Set([
  'make', 'take', 'have', 'keep', 'give', 'come', 'goes', 'going', 'into', 'with', 'about', 'from', 'over', 'that', 'this', 'than', 'then', 'them', 'they', 'their',
  'been', 'were', 'will', 'would', 'should', 'could', 'some', 'something', 'someone', 'somebody', 'your', 'yours', 'what', 'when', 'where', 'which', 'while',
  'more', 'most', 'very', 'just', 'only', 'also', 'such', 'each', 'other', 'well', 'back', 'down', 'onto', 'upon', 'off', 'out', 'through', 'under', 'after', 'before',
  'get', 'gets', 'getting', 'made', 'taken', 'kept', 'given', 'does', 'done', 'doing', 'thing', 'things', 'part',
]);
const DE_STOP = new Set([
  'etwas', 'jemand', 'jemanden', 'jemandem', 'jemandes', 'werden', 'haben', 'machen', 'einem', 'einer', 'eines', 'einen', 'sich', 'nicht', 'durch', 'gegen',
  'ohne', 'unter', 'zwischen', 'wegen', 'während', 'darauf', 'damit', 'davon', 'dafür', 'dabei', 'daran', 'darüber', 'sein', 'seine', 'seinen', 'ihren', 'ihre',
  'bringen', 'geben', 'nehmen', 'lassen', 'kommen', 'stellen', 'setzen', 'halten', 'gehen', 'sehr', 'mehr', 'viel', 'vielen', 'andere', 'anderen', 'anderer',
  'gewisse', 'gewissen', 'gewisser', 'bestimmte', 'bestimmten', 'jeweils', 'sowie', 'beziehungsweise',
]);

const norm = (s: string): string => s.toLowerCase().replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim().replace(/^to /, '');
/** Einfache Grundform: Mehrzahl-s ab 5 Buchstaben weg („concerns“ = „concern“). */
const stem = (w: string): string => (w.length >= 5 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

function enWords(s: string): string[] {
  return norm(s)
    .split(/[^a-z']+/)
    .filter((w) => w.length >= 4 && !EN_STOP.has(w) && !/^(sb|sth)$/.test(w))
    .map(stem);
}

function deWords(s: string | null): string[] {
  if (!s) return [];
  return s
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[^a-zäöüß]+/)
    .filter((w) => w.length >= 5 && !DE_STOP.has(w));
}

function altsOf(c: Card): string[] {
  const own = Array.isArray(c.doc.alt) ? (c.doc.alt as unknown[]).filter((a): a is string => typeof a === 'string') : [];
  const pack = packExtraOf({ word: c.word, doc: c.doc })?.alt ?? [];
  return [...own, ...pack].map(norm).filter(Boolean);
}

/** Merkmale einer Karte für den Vergleich (einmal je Karte berechnen). */
export type SimilarKey = { head: string; alts: ReadonlySet<string>; en: ReadonlySet<string>; de: ReadonlySet<string> };
export function similarKey(c: Card): SimilarKey {
  const head = norm(c.word);
  return { head, alts: new Set(altsOf(c)), en: new Set([...enWords(c.word), ...(c.lemma && norm(c.lemma) !== head ? enWords(c.lemma) : [])]), de: new Set(deWords(c.de)) };
}

const overlaps = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean => [...a].some((x) => b.has(x));

/** Ähnliche Bedeutung nach der Faustregel oben (symmetrisch). Dieselbe Karte bzw. dasselbe Stichwort ist nicht „ähnlich“ (das regelt `headwordOf`). */
export function similarKeys(a: SimilarKey, b: SimilarKey): boolean {
  if (!a.head || !b.head || a.head === b.head) return false;
  if (a.alts.has(b.head) || b.alts.has(a.head) || overlaps(a.alts, b.alts)) return true;
  return overlaps(a.en, b.en) || overlaps(a.de, b.de);
}

export const similarMeaning = (a: Card, b: Card): boolean => similarKeys(similarKey(a), similarKey(b));

/**
 * Wählt `n` neue Karten aus `fresh` (in dieser Reihenfolge), von denen keine einer anderen gewählten oder einer heute schon eingeführten Karte (`today`)
 * ähnlich ist. Reicht das nicht, wird mit den zurückgestellten Karten in ihrer Reihenfolge aufgefüllt – die Zahl neuer Karten sinkt nie.
 * `accept` (z. B. „dasselbe Wort nur einmal“) entscheidet zusätzlich über jede Karte; nur angenommene Karten zählen.
 */
export function pickDissimilar<T extends Card>(fresh: readonly T[], n: number, today: readonly Card[], accept: (c: T) => boolean = () => true): T[] {
  const out: T[] = [];
  if (n <= 0) return out;
  const keys = new Map<T, SimilarKey>();
  const keyOf = (c: T): SimilarKey => {
    let k = keys.get(c);
    if (!k) keys.set(c, (k = similarKey(c)));
    return k;
  };
  const held: SimilarKey[] = today.map(similarKey);
  const skipped: T[] = [];
  for (const c of fresh) {
    if (out.length >= n) break;
    const k = keyOf(c);
    if (held.some((h) => similarKeys(h, k))) {
      skipped.push(c);
      continue;
    }
    if (!accept(c)) continue;
    out.push(c);
    held.push(k);
  }
  for (const c of skipped) {
    if (out.length >= n) break;
    if (accept(c)) out.push(c);
  }
  return out;
}
