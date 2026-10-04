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
  // `fluency` / `meeting`: Flüssigkeit 90 – 60 – 45 und „Mein nächster Termin“ (Lernberatung V6/V4).
  // `pack`: C1-Paket (`domain/c1pack`, 02.10.2026): fertige, geprüfte Einträge; `utterance` bleibt leer (Emrah hat es nicht gesagt).
  | { kind: 'mail' | 'pitch' | 'biz' | 'say' | 'fluency' | 'meeting' | 'pack'; ref: string; title: string; utterance: string; upgraded: string };

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

// Kurzformen werden für den Vergleich ausgeschrieben (W7): „we're“ = „we are“, „can't“ = „cannot“.
const NEG_IRREGULAR: Readonly<Record<string, readonly string[]>> = { "can't": ['can', 'not'], "won't": ['will', 'not'], "shan't": ['shall', 'not'], "ain't": ['is', 'not'] };
const CLITICS: ReadonlyArray<readonly [string, string]> = [
  ["'re", 'are'],
  ["'m", 'am'],
  ["'ll", 'will'],
  ["'d", 'would'],
  ["'ve", 'have'],
];

function expand(w: string): string[] {
  if (w === "let's") return ['let', 'us'];
  if (w === 'cannot') return ['can', 'not'];
  const neg = NEG_IRREGULAR[w];
  if (neg) return [...neg];
  if (w.endsWith("n't") && w.length > 3) return [w.slice(0, -3), 'not'];
  for (const [suf, full] of CLITICS) if (w.endsWith(suf) && w.length > suf.length) return [w.slice(0, -suf.length), full];
  return [w];
}

/** Wörter für den Vergleich: klein, typografische Zeichen vereinheitlicht, ohne „…“ und Satzzeichen, Kurzformen ausgeschrieben. */
export function chunkTokens(s: string): string[] {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/…|\.\.\./g, ' ')
    .split(/[^a-z0-9']+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean)
    .flatMap(expand);
}

/** Platzhalter in Wendungen („meet sb halfway“, „go up to [X]%“): stehen für 1–4 beliebige Wörter. */
const PLACEHOLDERS = new Set(['sb', 'sth', 'someone', 'something', 'somebody', "one's", "someone's", 'x']);
const WILDCARD_MAX = 4;

/** Steht `phrase` (Wortfolge) in `text`? Platzhalter passen auf 1–4 Wörter. Leere Wendung nie. */
export function containsPhrase(text: string, phrase: string): boolean {
  const t = chunkTokens(text);
  const p = chunkTokens(phrase.replace(/\[[^\]]*\]/g, ' x '));
  if (!p.length || p.every((w) => PLACEHOLDERS.has(w))) return false;
  const bracketX = /\[[^\]]*\]/.test(phrase);
  const isPh = (w: string) => PLACEHOLDERS.has(w) && (w !== 'x' || bracketX);
  const match = (i: number, k: number): boolean => {
    if (k === p.length) return true;
    const w = p[k] as string;
    if (isPh(w)) {
      // Auch wörtlich („something“ im Text) – das ist ein beliebiges Wort wie jedes andere.
      for (let n = 1; n <= WILDCARD_MAX && i + n <= t.length; n++) if (match(i + n, k + 1)) return true;
      return false;
    }
    return t[i] === w && match(i + 1, k + 1);
  };
  for (let i = 0; i < t.length; i++) if (match(i, 0)) return true;
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
