import dictRaw from '../../content/legacy/dict.json?raw';
import { logError } from '../../platform/diagnostics';
import { isIrregularForm, lemmaCandidates, usSpelling } from '../text/lemma';
import { normalizeWord } from '../text/tokenize';
import type { LexDeps } from '../text/types';
import { hasIpa } from './pron';

// Eingebautes Wörterbuch der alten App (4.226 Einträge, britisch geschrieben).
// Eingebettet als Text, geparst beim ersten Gebrauch (Entwurf §10.2).
// Indiziert über die US-Schreibweise: color findet colour, organize findet organise (Lerndesign §0).
// Angezeigt wird die US-Form (`word`), der Schlüssel der alten App bleibt als `headword` erhalten.

export type DictSense = { pos: string; de: string; def: string };
export type DictEntry = {
  /** US-Schreibweise zur Anzeige (color) */
  word: string;
  /** Schlüssel in dict.json (colour) */
  headword: string;
  senses: readonly DictSense[];
};

type Index = {
  /** US-Schlüssel → Schlüssel in dict.json (meist genau einer; practise und practice teilen sich einen) */
  byKey: Map<string, string[]>;
  senses: Map<string, DictSense[]>;
  /** Schlüssel in der Reihenfolge von dict.json */
  order: string[];
};

let index: Index | null = null;
const byPosCache = new Map<string, readonly string[]>();

function toSense(raw: unknown): DictSense | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const [pos, de, def] = raw as unknown[];
  return typeof pos === 'string' && typeof de === 'string' && typeof def === 'string' ? { pos, de, def } : null;
}

function load(): Index {
  if (index) return index;
  const idx: Index = { byKey: new Map(), senses: new Map(), order: [] };
  try {
    const parsed: unknown = JSON.parse(dictRaw);
    if (parsed && typeof parsed === 'object') {
      for (const [headword, list] of Object.entries(parsed)) {
        const senses = Array.isArray(list) ? list.map(toSense).filter((s): s is DictSense => s !== null) : [];
        if (!senses.length) continue;
        const hw = normalizeWord(headword);
        idx.senses.set(hw, senses);
        idx.order.push(hw);
        const key = usSpelling(hw);
        const group = idx.byKey.get(key);
        if (group) group.push(hw);
        else idx.byKey.set(key, [hw]);
      }
    }
  } catch (err) {
    logError('lexicon:dict', err, 'dict.json nicht lesbar');
  }
  index = idx;
  return idx;
}

/** Nachschlage-Form: normalisiert, bei Wendungen ohne führendes „to" und ohne Auslassungszeichen. */
function lookupForm(word: string): string {
  const n = normalizeWord(word)
    .replace(/(\s*(…|\.\.\.))+$/u, '')
    .trim();
  return n.includes(' ') ? n.replace(/^to /, '') : n;
}

/**
 * Eintrag im Wörterbuch, Schreibweise britisch oder amerikanisch, ohne Grundform-Suche
 * (dafür `lemmaCandidates`). Mit `posHint` stehen die Bedeutungen dieser Wortart vorn.
 */
export function dictLookup(word: string, posHint?: string | null): DictEntry | null {
  const n = lookupForm(word);
  if (!n) return null;
  const idx = load();
  const key = usSpelling(n);
  const group = idx.byKey.get(key);
  if (!group) return null;
  const headword = group.includes(n) ? n : (group[0] ?? n);
  const ordered = [headword, ...group.filter((h) => h !== headword)];
  let senses = ordered.flatMap((h) => idx.senses.get(h) ?? []);
  if (posHint) senses = [...senses.filter((s) => s.pos === posHint), ...senses.filter((s) => s.pos !== posHint)];
  return { word: key, headword, senses };
}

/** Einzelwort (ohne Leerzeichen, Bindestrich erlaubt) im Wörterbuch? */
export function isDictWord(word: string): boolean {
  const n = lookupForm(word);
  return n.length > 0 && !n.includes(' ') && load().byKey.has(usSpelling(n));
}

/** Mehrwort-Wendung im Wörterbuch (carry out, look forward to)? „to rely on" zählt wie „rely on". */
export function isDictPhrase(phrase: string): boolean {
  const n = lookupForm(phrase);
  return n.includes(' ') && load().byKey.has(usSpelling(n));
}

/**
 * Alle Wörterbuch-Einträge einer Wortart (verb, noun, adj, adv, prep, pron, conj, phrasal, phrase)
 * in US-Schreibweise und Reihenfolge von dict.json, z. B. für Ablenker.
 */
export function dictWordsByPos(pos: string): readonly string[] {
  const cached = byPosCache.get(pos);
  if (cached) return cached;
  const idx = load();
  const seen = new Set<string>();
  for (const hw of idx.order) {
    if (idx.senses.get(hw)?.some((s) => s.pos === pos)) seen.add(usSpelling(hw));
  }
  const list = Object.freeze([...seen]);
  byPosCache.set(pos, list);
  return list;
}

/**
 * Ist das ein echtes englisches Wort? Wörterbuch (auch über die US-Form), in CMU belegte Formen
 * aus der Lautschrift-Liste (on, the, went, occurred) und unregelmäßige Formen. Absichtlich ohne
 * Endungsregeln: sonst wäre „occured" über „occur" ein echtes Wort und kein Tippfehler.
 */
function isKnownWord(word: string): boolean {
  const n = normalizeWord(word);
  if (!n) return false;
  if (n === 'a' || n === 'i') return true;
  if (n.length < 2) return false;
  return isDictWord(n) || hasIpa(n) || isIrregularForm(n);
}

/** Erste Bedeutung des Worts oder, falls es selbst fehlt, seiner Grundform (went → go). */
function dictMeaning(word: string): DictSense | null {
  for (const cand of lemmaCandidates(word)) {
    const sense = dictLookup(cand)?.senses[0];
    if (sense) return { pos: sense.pos, de: sense.de, def: sense.def };
  }
  return null;
}

/** Wörterbuch-Zugriff für die Lern-Domäne (Entwurf §5.0 `LexDeps`). */
export function lexDeps(): LexDeps {
  return { isKnownWord, dictMeaning, wordsByPos: dictWordsByPos };
}
