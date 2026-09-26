import { slug } from '../content';
import { isDocPath } from '../../data/paths';

// Neue Wendung „mitnehmen“ (Plan §3.3, D6): ein Dokument `chunk/c-<slug>` im Format der alten
// App plus Ergänzungen (`def`, `whyLang`, `origin`, `src.kind`). Der Kontext ist Pflicht: die
// Wendung muss im aufgewerteten Satz stehen (Kap. 15: keine Karte ohne Ursprungssatz).
// Gibt es die Wendung schon, wird nie geschrieben – auch nicht bei `hidden` (dort bietet die
// Oberfläche „Wieder aufnehmen“ an, ein eigener, ausdrücklicher Schreibvorgang).

type Doc = Record<string, unknown>;

export type ChunkSource =
  | { kind: 'scene'; scene: string; sceneTitle: string; utterance: string; upgraded: string; turn: number }
  | { kind: 'mail' | 'pitch' | 'biz'; ref: string; title: string; utterance: string; upgraded: string };

export type NewChunkInput = {
  en: string;
  de: string;
  def: string;
  kind: 'collocation' | 'frame' | 'phrase';
  register: 'formal' | 'neutral' | 'informal';
  why: string;
  whyLang: 'de' | 'en';
  level?: string | null;
  src: ChunkSource;
  nowMs: number;
};

export const CHUNK_MAX_WORDS = 8;

/** Wörter für den Vergleich: klein, typografische Zeichen vereinheitlicht, ohne „…“ und Satzzeichen. */
export function chunkTokens(s: string): string[] {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/…|\.\.\./g, ' ')
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** Steht `phrase` (Wortfolge) in `text`? Leere Wendung nie. */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = chunkTokens(text);
  const p = chunkTokens(phrase);
  if (!p.length || p.length > t.length) return false;
  for (let i = 0; i + p.length <= t.length; i++) {
    if (p.every((w, k) => t[i + k] === w)) return true;
  }
  return false;
}

export const wordCountOf = (s: string): number => chunkTokens(s).length;

/** `c-` + Kurzform; `null`, wenn keine gültige Kennung entsteht. */
export function chunkId(en: string): string | null {
  const core = slug(en.replace(/…|\.\.\./g, ' '));
  if (!core) return null;
  const id = `c-${core}`;
  return isDocPath(`chunk/${id}`) ? id : null;
}

/** `null`, wenn `en` nicht im aufgewerteten Satz steht, zu lang ist oder `de`/`def` fehlen. */
export function newChunkDoc(i: NewChunkInput): { id: string; doc: Doc } | null {
  const en = i.en.replace(/\s+/g, ' ').trim();
  const de = i.de.trim();
  const def = i.def.trim();
  if (!en || !de || !def) return null;
  const words = wordCountOf(en);
  if (words < 1 || words > CHUNK_MAX_WORDS) return null;
  if (!containsPhrase(i.src.upgraded, en)) return null;
  const id = chunkId(en);
  if (!id) return null;
  const t = Math.floor(i.nowMs);
  const src: Doc = { ...i.src, ts: t };
  const origin: Doc =
    i.src.kind === 'scene'
      ? { v: 1, kind: 'scene', ref: `scene/${i.src.scene}`, title: i.src.sceneTitle, t }
      : { v: 1, kind: i.src.kind, ref: i.src.ref, title: i.src.title, t };
  return {
    id,
    doc: {
      id,
      en,
      de,
      def,
      kind: i.kind,
      register: i.register,
      why: i.why.trim(),
      whyLang: i.whyLang,
      src,
      level: i.level ?? 'C1',
      created: t,
      also: [],
      state: 'new',
      S: 0,
      D: 5,
      due: 0,
      last: 0,
      reps: 0,
      lapses: 0,
      stage: 0,
      modes: {},
      origin,
    },
  };
}

/** Schreibvorgang aus dem frischen Stand: nur anlegen, wenn die Wendung fehlt. Nie `update`. */
export function takeChunkOp(cur: Doc | undefined, made: { doc: Doc }): { set: Doc } | null {
  if (cur) return null;
  return { set: made.doc };
}

export type ChunkPresence = 'absent' | 'present' | 'hidden';

/** Zustand einer Wendung in der Datenbank (für „Schon in deinen Wendungen“ / „Wieder aufnehmen“). */
export function chunkPresence(doc: Doc | undefined | null): ChunkPresence {
  if (!doc) return 'absent';
  return doc.hidden === true ? 'hidden' : 'present';
}
