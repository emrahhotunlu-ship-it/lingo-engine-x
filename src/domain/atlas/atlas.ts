import atlasText from '../../content/atlas/atlas.json?raw';
import { slug } from '../content';
import { newVocabDoc, saveCardOp } from '../srs/newCard';

// Atlas, Teil 2 (Gesamtkonzept 3.3): Wortliste aus offenen Quellen (`scripts/atlas/build_atlas.py`, Quellen und Lizenzen in
// `docs/atlas-quellen.md`), von Claude auf Sinn und Eignung durchgesehen. Als Text eingebettet und erst beim ersten Öffnen
// des Atlas geparst (kein Start-Kosten). Nur Lesen; ein Eintrag wird erst auf Tipp zur Karte (nie automatisch).

export type AtlasEntry = {
  /** Wort in Grundform */
  w: string;
  /** noun | verb | adjective | adverb */
  p: string;
  /** deutsche Bedeutung */
  d: string;
  /** englische Erklärung */
  g: string;
  /** Beispielsatz (Tatoeba) und seine deutsche Übersetzung */
  x: string;
  xd: string;
  /** Häufigkeitsrang (wordfreq) */
  r: number;
  /** Ausgeblendet (`scripts/atlas/clean_atlas.py`: britisches Stichwort, Wortart passt nicht zur Definition); bleibt in der Datei. */
  hidden?: 1;
  /** Grundwortschatz (kein C1-Ziel). */
  basic?: 1;
  /** Beispielsatz schwach (Vorname, britisches Wort): beim Kartenanlegen lieber einen neuen Satz holen. */
  exWeak?: 1;
};

export const ATLAS_BANDS = ['core', 'plus', 'c1', 'rare'] as const;
export type AtlasBand = (typeof ATLAS_BANDS)[number];
const LIMITS: Record<Exclude<AtlasBand, 'rare'>, number> = { core: 4500, plus: 7500, c1: 12000 };

export const bandOf = (e: AtlasEntry): AtlasBand => (e.r < LIMITS.core ? 'core' : e.r < LIMITS.plus ? 'plus' : e.r < LIMITS.c1 ? 'c1' : 'rare');

let cache: readonly AtlasEntry[] | null = null;
/** Alle Einträge nach Häufigkeit (häufigste zuerst); beim ersten Aufruf geparst. */
export function atlasEntries(): readonly AtlasEntry[] {
  if (!cache) {
    const raw = JSON.parse(atlasText) as { items?: AtlasEntry[] };
    cache = (raw.items ?? []).filter((e) => e.w && e.d && e.x && !e.hidden).sort((a, b) => a.r - b.r);
  }
  return cache;
}

export const atlasId = (e: AtlasEntry): string => slug(e.w);

/** Kartendokument zum Eintrag (noch nicht geschrieben); `null`, wenn es die Regeln der Karte nicht besteht. */
export function atlasDoc(e: AtlasEntry, today: string, nowMs: number): { id: string; doc: Record<string, unknown> } | null {
  return newVocabDoc({
    word: e.w,
    de: e.d,
    pos: e.p,
    def: e.g,
    level: 'C1',
    ex: e.x,
    surface: null,
    src: 'pack',
    origin: { v: 1, kind: 'pack', ref: `atlas/${e.w}`, title: 'Atlas', t: nowMs },
    today,
  });
}

export { saveCardOp as atlasOp };
