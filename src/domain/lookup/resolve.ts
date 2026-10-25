import { dictLookup, dictPosOf } from '../lexicon/dict';
import { ipaOf } from '../lexicon/pron';
import { lemmaCandidates, usSpelling } from '../text/lemma';
import { normalizeWord } from '../text/tokenize';
import type { Token } from '../text/types';
import { lookupKey, readEntry, type LookupEntry } from './cache';
import { guessPos, rankSenses, type PosGuess, type SenseCand, type SenseFit, type TargetPart } from './sense';

// Angetipptes Wort auflösen (Plan §5.6, synchron). Der erste Grundform-Kandidat, den es als
// eigene Karte, im Zwischenspeicher oder im Wörterbuch gibt, gewinnt. Die Bedeutung kommt
// dann in dieser Reihenfolge: eigene Karte → Zwischenspeicher → Wörterbuch – mit Satzbezug (`context`) aber zuerst die Bedeutung,
// deren Wortart zur Verwendung im Satz passt (`sense.ts`, Emrahs Meldung 25.10.2026 „decline · Nomen“ bei „declined to commit“).

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
  /** Wie sicher die gezeigte Bedeutung zur Verwendung passt (`sense.ts`). */
  fit: SenseFit;
  /** Eine weitere Bedeutung mit anderer Wortart („Auch: Nomen – Rückgang“). */
  also: SenseCand | null;
  /** Das Wort ist Teil der Ziel-Wendung des Satzes (nur außerhalb offener Aufgaben). */
  part: TargetPart | null;
};

export type ResolveDeps = {
  /** Eigene Karten nach normalisierter Grundform. */
  cards: ReadonlyMap<string, CardInfo>;
  /** `app/lookup` (einmal gelesen) oder `undefined`. */
  cache: Readonly<Record<string, unknown>> | undefined;
  uiLang: 'de' | 'en';
  /** Satz und Stelle des Worts: Wortart aus der Satzstellung (`guessPos`). */
  context?: { tokens: readonly Token[]; index: number } | null;
  /** Ziel-Wendung/-Karte des Satzes, die das Wort enthält (`targetPart`). */
  target?: TargetPart | null;
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

type Hit = { c: string; card: CardInfo | null; cached: Partial<LookupEntry> | null; dict: ReturnType<typeof dictLookup> };

export function resolveWord(surface: string, hint: string | null, deps: ResolveDeps): Resolved {
  const cands = lemmaCandidates(surface);
  const part = deps.target ?? null;
  const base: Resolved = { surface, headword: usSpelling(cands[0] ?? surface), pos: null, de: null, def: null, ipa: null, level: null, note: null, card: null, source: 'none', fit: 'none', also: null, part: part && !part.single ? part : null };
  const hits: Hit[] = [];
  for (const c of cands) {
    const card = deps.cards.get(c) ?? deps.cards.get(usSpelling(c)) ?? null;
    const key = lookupKey(c);
    const cached: Partial<LookupEntry> | null = key ? readEntry(deps.cache, key) : null;
    const dict = dictLookup(c);
    if (card || cached || dict) hits.push({ c, card, cached, dict });
    // Ohne Satzbezug gewinnt wie bisher der erste Treffer; mit Satzbezug zählen auch spätere Grundformen („used“ → use, „lives“ → live).
    if (hits.length && !deps.context) break;
  }
  const first = hits[0];
  if (!first) return { ...base, ipa: ipaOf(surface) };
  const sensesOf = (h: Hit): SenseCand[] => {
    const out: SenseCand[] = [];
    // Einzelwort-Karte dieses Satzes: ihre Bedeutung ist die im Satz gemeinte.
    if (part?.single) out.push({ pos: part.pos, de: part.de, def: part.def, from: 'target' });
    if (h.card) out.push({ pos: h.card.pos, de: h.card.de, def: h.card.def, from: 'card' });
    if (h.cached) out.push({ pos: h.cached.pos ?? null, de: h.cached.de ?? null, def: h.cached.def ?? null, from: 'cache' });
    for (const d of h.dict?.senses ?? []) out.push({ pos: d.pos, de: d.de, def: d.def, from: 'dict' });
    return out;
  };
  const posOfHit = (h: Hit): string[] => [...new Set(sensesOf(h).map((x) => x.pos).filter((p): p is string => !!p))].map((p) => (p.startsWith('adj') ? 'adj' : p.startsWith('adv') ? 'adv' : p));
  const allowed = [...new Set(hits.flatMap(posOfHit))];
  const guessed: PosGuess | null = deps.context ? guessPos(deps.context.tokens, deps.context.index, dictPosOf, allowed.length ? allowed : undefined) : null;
  // Gerundium („Drinking is harmful“, „the handling of …“): ohne eigenen -ing-Eintrag meint es die Tätigkeit, also die Verb-Bedeutung –
  // nicht das Hauptwort der Grundform („Getränk“, „Griff“).
  const gerund = !!guessed && guessed.pos === 'noun' && /[a-z]{2,}ing$/i.test(surface) && first.c !== normalizeWord(surface) && allowed.includes('verb');
  const guess: PosGuess | null = guessed
    ? gerund
      ? { ...guessed, pos: 'verb' }
      : guessed
    : hint
      ? { pos: hint === 'noun' || hint === 'verb' || hint === 'adj' || hint === 'adv' ? hint : null, strength: 'weak', attributive: false, scores: { noun: 0, verb: 0, adj: 0, adv: 0 } }
      : null;
  // Die Grundform, deren Wortarten zur Verwendung passen; sonst die erste. Die Karte gehört immer zur gezeigten Grundform.
  const want = guess?.pos ?? null;
  const hit = (want && !posOfHit(first).includes(want) ? hits.find((h) => posOfHit(h).includes(want)) : undefined) ?? first;
  const { c, card, cached, dict } = hit;
  const headword = dict?.word ?? usSpelling(c);
  const note = cached ? ((deps.uiLang === 'de' ? cached.note_de : cached.note_en) ?? null) : null;
  const rank = rankSenses(sensesOf(hit), guess);
  const shown = rank.primary;
  const from = shown?.from ?? rank.also?.from ?? null;
  return {
    surface,
    headword,
    pos: shown?.pos ?? (rank.fit === 'mismatch' ? null : (card?.pos ?? cached?.pos ?? null)),
    de: shown?.de ?? null,
    def: shown?.def ?? null,
    ipa: ipaOf(headword) ?? ipaOf(surface) ?? cached?.ipa ?? null,
    level: cached?.level ?? null,
    note: shown?.from === 'cache' || !shown ? note : null,
    card,
    source: from === 'target' || from === 'card' ? (card || part ? 'card' : 'dict') : from === 'cache' ? 'cache' : from === 'dict' ? 'dict' : 'card',
    fit: rank.fit,
    also: rank.also,
    part: base.part,
  };
}
