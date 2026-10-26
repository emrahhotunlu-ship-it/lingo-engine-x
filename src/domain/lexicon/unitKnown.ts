import packText from '../../content/c1/pack.json?raw';
import charge1 from '../../content/col/charge1.json';
import vocabJson from '../../content/legacy/vocab.json';
import unitsJson from '../../content/lexicon/units.json';
import collocText from '../../content/nb/collocations.json?raw';
import { logError } from '../../platform/diagnostics';
import { atlasEntries } from '../atlas/atlas';
import { normalizeWord } from '../text/tokenize';
import { dictPosOf, isDictPhrase } from './dict';
import { lexicalUnitWith, phraseShapeWith, singular, unitKey, type PhraseShape, type UPos, type UnitDeps, type UnitVerdict } from './unit';

// Wissen für `lexicalUnit`: alle in den Inhalten belegten Wortgruppen (C1-Paket mit Alternativen und Wortpartnern, Wortpartner-Charge,
// Kollokationen der Business-Suite, Wortpartner der Startvokabeln, `content/lexicon/units.json`) und die Wortarten aus Wörterbuch und
// Atlas. Wird beim ersten Gebrauch gebaut (kein Start-Kosten). `UnitSource` erlaubt dem Audit, die geprüfte Quelle selbst auszunehmen.

export type UnitSource = 'pack' | 'col' | 'nb' | 'legacy' | 'units';

type Index = { bySource: Map<string, Set<UnitSource>>; byFirst: Map<string, string[]> };
let index: Index | null = null;

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : typeof v === 'string' ? [v] : []);
const recs = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);

function build(): Index {
  const bySource = new Map<string, Set<UnitSource>>();
  const add = (phrase: string, src: UnitSource): void => {
    const k = unitKey(phrase);
    if (!k.includes(' ')) return;
    const set = bySource.get(k) ?? new Set<UnitSource>();
    set.add(src);
    bySource.set(k, set);
  };
  try {
    const pack = JSON.parse(packText) as { items?: unknown };
    for (const e of recs(pack.items)) {
      for (const s of [...strs(e.en), ...strs(e.alt)]) add(s, 'pack');
      for (const c of recs(e.col)) for (const s of strs(c.en)) add(s, 'pack');
    }
  } catch (e) {
    logError('lexicon.unitKnown.pack', e);
  }
  for (const it of recs((charge1 as { items?: unknown }).items)) for (const c of recs(it.col)) for (const s of strs(c.p)) add(s, 'col');
  try {
    for (const c of recs(JSON.parse(collocText))) {
      const noun = strs(c.noun)[0];
      if (noun) for (const v of recs(c.verbs)) for (const s of strs(v.v)) add(`${s} ${noun}`, 'nb');
      const wrong = c.wrong as Record<string, unknown> | undefined;
      if (wrong) for (const s of strs(wrong.right)) add(s, 'nb');
    }
  } catch (e) {
    logError('lexicon.unitKnown.nb', e);
  }
  for (const w of recs(vocabJson.seedVocab)) for (const s of strs(w.w)) add(s, 'legacy');
  for (const list of Object.values(vocabJson.colloc as Record<string, unknown>)) for (const c of recs(list)) for (const s of strs(c.p)) add(s, 'legacy');
  for (const s of strs((unitsJson as { items?: unknown }).items)) add(s, 'units');

  const byFirst = new Map<string, string[]>();
  for (const k of bySource.keys()) {
    const first = k.split(' ')[0] ?? '';
    const list = byFirst.get(first) ?? [];
    list.push(k);
    byFirst.set(first, list);
  }
  return { bySource, byFirst };
}

const load = (): Index => (index ??= build());

type AtlasInfo = { w: string; pos: UPos[]; de: string; r: number };
let atlasMap: Map<string, AtlasInfo> | null = null;
const ATLAS_POS: Readonly<Record<string, UPos>> = { noun: 'noun', verb: 'verb', adjective: 'adj', adverb: 'adv' };
const DICT_POS: Readonly<Record<string, UPos>> = { noun: 'noun', verb: 'verb', adj: 'adj', adv: 'adv', prep: 'prep', phrasal: 'verb' };

/** Atlas-Eintrag eines Worts (auch Mehrzahl): Wortarten, deutsche Bedeutung, Häufigkeitsrang. */
export function atlasInfo(word: string): AtlasInfo | null {
  if (!atlasMap) {
    atlasMap = new Map();
    for (const e of atlasEntries()) {
      const p = ATLAS_POS[e.p];
      const hit = atlasMap.get(e.w);
      if (hit) {
        if (p && !hit.pos.includes(p)) hit.pos.push(p);
        continue;
      }
      atlasMap.set(e.w, { w: e.w, pos: p ? [p] : [], de: e.d, r: e.r });
    }
  }
  const w = normalizeWord(word);
  return atlasMap.get(w) ?? atlasMap.get(singular(w)) ?? null;
}

const atlasPosOf = (w: string): readonly UPos[] => atlasInfo(w)?.pos ?? [];

const posCache = new Map<string, readonly UPos[]>();
function posOf(word: string): readonly UPos[] {
  const w = normalizeWord(word);
  const hit = posCache.get(w);
  if (hit) return hit;
  const fromDict = dictPosOf(w).map((p) => DICT_POS[p] ?? 'other');
  const out = fromDict.length ? [...new Set(fromDict)] : atlasPosOf(w);
  if (posCache.size > 5000) posCache.clear();
  posCache.set(w, out);
  return out;
}

/** Wissen aus allen Quellen; `exclude` nimmt eine Quelle aus (Audit: ein Eintrag belegt sich nicht selbst). */
export function unitDeps(exclude?: UnitSource): UnitDeps {
  const idx = load();
  const ok = (k: string): boolean => {
    const s = idx.bySource.get(k);
    return !!s && (!exclude || [...s].some((x) => x !== exclude));
  };
  return {
    known: ok,
    startingWith: (first) => (idx.byFirst.get(first) ?? []).filter(ok),
    pos: posOf,
    dictPhrase: (p) => isDictPhrase(p),
  };
}

const shapeCache = new Map<string, PhraseShape>();
/** Bauform eines Kartenworts (für Ablenker), zwischengespeichert; braucht nur Wörterbuch und Atlas, nicht den Index der Gruppen. */
export function phraseShape(phrase: string): PhraseShape {
  const k = phrase.trim().toLowerCase();
  const hit = shapeCache.get(k);
  if (hit) return hit;
  const s = phraseShapeWith(k, { pos: posOf });
  if (shapeCache.size > 5000) shapeCache.clear();
  shapeCache.set(k, s);
  return s;
}

/** Ist die Wortgruppe eine feste Einheit? Nur Urteil („ok“ oder „prüfen“), löscht und ändert nichts. */
export function lexicalUnit(phrase: string, exclude?: UnitSource): UnitVerdict {
  return lexicalUnitWith(phrase, unitDeps(exclude));
}
