import { dictLookup } from '../lexicon/dict';
import { ipaOf } from '../lexicon/pron';
import { lemmaCandidates, usSpelling } from '../text/lemma';
import { normalizeWord } from '../text/tokenize';
import type { Token } from '../text/types';
import { lookupKey, readEntry, type LookupEntry } from './cache';

// Angetipptes Wort auflösen (Plan §5.6, synchron). Der erste Grundform-Kandidat, den es als
// eigene Karte, im Zwischenspeicher oder im Wörterbuch gibt, gewinnt. Die Bedeutung kommt
// dann in dieser Reihenfolge: eigene Karte → Zwischenspeicher → Wörterbuch.

export type CardInfo = { id: string; word: string; de: string | null; def: string | null; pos: string | null; stage: number; hidden: boolean };

export type Resolved = {
  surface: string;
  /** Grundform in US-Schreibweise (Anzeige). */
  headword: string;
  pos: string | null;
  de: string | null;
  def: string | null;
  ipa: string | null;
  level: string | null;
  /** Nutzungshinweis aus dem Zwischenspeicher, nur in der Oberflächensprache. */
  note: string | null;
  card: CardInfo | null;
  source: 'card' | 'cache' | 'dict' | 'none';
};

export type ResolveDeps = {
  /** Eigene Karten nach normalisierter Grundform. */
  cards: ReadonlyMap<string, CardInfo>;
  /** `app/lookup` (einmal gelesen) oder `undefined`. */
  cache: Readonly<Record<string, unknown>> | undefined;
  uiLang: 'de' | 'en';
};

const NOUN_BEFORE = new Set(['a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'some', 'any', 'no', 'every', 'each']);
const VERB_BEFORE = new Set(['to', 'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must', 'i', 'you', 'we', 'they', 'he', 'she', 'it']);

/** Wortart-Vermutung aus dem Vorgängerwort (für die Reihenfolge der Wörterbuch-Bedeutungen). */
export function posHint(tokens: readonly Token[], index: number): string | null {
  const w = tokens[index];
  if (w && /ly$/i.test(w.text)) return 'adv';
  const before = hintFromBefore(tokens, index);
  if (before) return before;
  // „avoid driving", „we finished": Endung -ing/-ed ohne Artikel davor → zuerst das Verb (H5).
  if (w && /[a-z]{2,}(ing|ed)$/i.test(w.text)) return 'verb';
  return null;
}

function hintFromBefore(tokens: readonly Token[], index: number): string | null {
  for (let i = index - 1; i >= 0; i--) {
    const t = tokens[i];
    if (!t || t.kind === 'space') continue;
    if (t.kind !== 'word') return null;
    const p = normalizeWord(t.text);
    if (NOUN_BEFORE.has(p)) return 'noun';
    if (VERB_BEFORE.has(p)) return 'verb';
    return null;
  }
  return null;
}

export function resolveWord(surface: string, hint: string | null, deps: ResolveDeps): Resolved {
  const cands = lemmaCandidates(surface);
  const base: Resolved = { surface, headword: usSpelling(cands[0] ?? surface), pos: null, de: null, def: null, ipa: null, level: null, note: null, card: null, source: 'none' };
  for (const c of cands) {
    const card = deps.cards.get(c) ?? deps.cards.get(usSpelling(c)) ?? null;
    const key = lookupKey(c);
    const cached: Partial<LookupEntry> | null = key ? readEntry(deps.cache, key) : null;
    const dict = dictLookup(c, hint);
    if (!card && !cached && !dict) continue;
    const sense = dict?.senses[0] ?? null;
    const headword = dict?.word ?? usSpelling(c);
    const note = cached ? ((deps.uiLang === 'de' ? cached.note_de : cached.note_en) ?? null) : null;
    return {
      surface,
      headword,
      pos: card?.pos ?? cached?.pos ?? sense?.pos ?? null,
      de: card?.de ?? cached?.de ?? sense?.de ?? null,
      def: card?.def ?? cached?.def ?? sense?.def ?? null,
      ipa: ipaOf(headword) ?? ipaOf(surface) ?? cached?.ipa ?? null,
      level: cached?.level ?? null,
      note,
      card,
      source: card && (card.de || card.def) ? 'card' : cached ? 'cache' : dict ? 'dict' : 'card',
    };
  }
  return { ...base, ipa: ipaOf(surface) };
}
