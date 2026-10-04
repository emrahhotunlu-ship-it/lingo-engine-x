import { z } from 'zod';
import { usesChunk } from '../domain/text/chunkMatch';
import { ERROR_CAT_VALUES } from './inputCommon';

// Tolerantes Lesen von KI-Antworten: Was sich sinnvoll normalisieren lässt (kürzen, abbilden,
// filtern), wird normalisiert statt abgelehnt. Abgelehnt wird nur, was wirklich unbrauchbar ist –
// jede Ablehnung kostet einen Neuversuch oder endet im Fehlerzustand (A6.3).

/** Kürzt auf höchstens `max` Zeichen (Codepunkte), mit „…" am Ende; Zeilenumbrüche bleiben. */
export function cut(s: string, max: number): string {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  return chars.slice(0, Math.max(0, max - 1)).join('').trimEnd() + '…';
}

/** Text, der zu lang sein darf: wird gekürzt statt abgelehnt. */
export const clipped = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((s) => cut(s, max))
    .pipe(z.string().min(min));

/** Liste, die zu lang sein darf: überzählige Einträge fallen weg. */
export const sliced = <T extends z.ZodType>(item: T, min: number, max: number) =>
  z.preprocess((v) => (Array.isArray(v) ? v.slice(0, max) : v), z.array(item).min(min).max(max));

/** Zahl, die auch als Text kommen darf („4"), gerundet und in die Grenzen gelegt. */
export const intIn = (min: number, max: number) =>
  z.preprocess((v) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : v;
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : n;
  }, z.number().int());

const CEFR_RE = /(A1|A2|B1\+?|B2\+?|C1\+?|C2)/;

/**
 * Erste gültige GER-Stufe aus einer Angabe wie „B2 (B2+ in places)", „B2-C1", „B2/C1".
 * „B2-" (schwaches B2) wird zu „B2", „C1+" ohne C1+ in `allowed` zu „C1". Nur die in `allowed`
 * genannten Stufen gelten; sonst bleibt der Wert stehen (und das Schema meldet ihn).
 */
export function firstCefr(v: unknown, allowed: readonly string[]): unknown {
  if (typeof v !== 'string') return v;
  const hit = v.trim().toUpperCase().match(CEFR_RE)?.[1];
  if (!hit) return v;
  if (allowed.includes(hit)) return hit;
  const base = hit.replace('+', '');
  return allowed.includes(base) ? base : v;
}

export const cefrLoose = <T extends string>(allowed: readonly [T, ...T[]]) => z.preprocess((v) => firstCefr(v, allowed), z.enum(allowed));

type InputCat = (typeof ERROR_CAT_VALUES)[number];

const CAT_ALIASES: ReadonlyArray<[RegExp, InputCat]> = [
  [/^(word[\s_-]?order|syntax|sentence structure)$/, 'word-order'],
  [/^(collocations?|idioms?|phrasal verbs?)$/, 'collocation'],
  [/^(vocab|vocabulary|word choice|lexis|lexical|word[\s_-]?form|wrong word|false friends?)$/, 'vocabulary'],
  [/^(spelling|typo|capitali[sz]ation)$/, 'spelling'],
  [/^(punctuation|commas?)$/, 'punctuation'],
  [/^(register|style|tone|formality|politeness)$/, 'register'],
  [/^(coherence|cohesion|linking|linkers?|structure|organi[sz]ation|clarity)$/, 'coherence'],
  [
    /^(grammar|tenses?|verb tenses?|verb forms?|agreement|subject[\s-]verb agreement|prepositions?|articles?|determiners?|plurals?|pronouns?|conditionals?|passive|modals?|gerunds?|infinitives?|relative clauses?|reported speech|comparatives?|adjectives?|adverbs?|countability|quantifiers?)$/,
    'grammar',
  ],
];

/** Fehlerkategorie der Phase-4-Listen tolerant: „prepositions", „tense", „agreement" → grammar; Unbekanntes → other. */
export function inputCat(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if ((ERROR_CAT_VALUES as readonly string[]).includes(s)) return s;
  for (const [re, cat] of CAT_ALIASES) if (re.test(s)) return cat;
  return 'other';
}

export const inputCatLoose = z.preprocess(inputCat, z.enum(ERROR_CAT_VALUES));

/** Schweregrad tolerant: „major/serious/severe/high/critical" → major, sonst („moderate", „low" …) → minor. */
export const sevLoose = z.preprocess(
  (v) => (typeof v !== 'string' ? v : /^(major|serious|severe|high|critical|important)$/.test(v.trim().toLowerCase()) ? 'major' : 'minor'),
  z.enum(['minor', 'major']),
);

const ABBREV = /(?:^|[\s(])(?:mr|mrs|ms|dr|prof|st|jr|sr|inc|ltd|corp|co|vs|etc|approx|no|e\.g|i\.e|u\.s|u\.k|a\.m|p\.m)$/i;

/**
 * Sätze zählen wie beim Zerlegen der E-Mail (domain/business/mailCompose.ts): Ein Satz endet
 * nur, wo nach dem Satzzeichen Leerraum oder das Ende folgt (2.5 und 1,000 bleiben ganz); nach
 * Abkürzungen wie „Mr." oder „e.g." endet kein Satz.
 */
export function countSentences(s: string): number {
  const text = s.trim();
  if (!text) return 0;
  let n = 0;
  for (const m of text.matchAll(/[.!?]+["'’”)\]]*(?=\s|$)/g)) {
    if (m[0] === '.' && ABBREV.test(text.slice(0, m.index))) continue;
    n++;
  }
  // Ein letzter Satz ohne Schlusszeichen zählt mit.
  return /[.!?]["'’”)\]]*$/.test(text) ? n : n + 1;
}

const TOPIC_CAT_ALIASES: Readonly<Record<string, string>> = {
  preposition: 'prepositions',
  article: 'articles',
  vocabulary: 'vocab',
  'word choice': 'vocab',
  'word-choice': 'vocab',
  lexis: 'vocab',
  collocations: 'collocation',
  'word order': 'word-order',
  style: 'register',
  tone: 'register',
  formality: 'register',
  typo: 'spelling',
  conditional: 'conditionals',
  'gerund/infinitive': 'gerund-inf',
  'reported speech': 'reported',
  'relative clauses': 'relative',
  'passive voice': 'passive',
};

/**
 * Fehlerkategorie aus Grammatik-IDs und Zusatzkategorien (`ERROR_CATS` der drei Schichten)
 * tolerant: „preposition" → prepositions, „word choice" → vocab, Unbekanntes wie „grammar" → other.
 */
export function topicCat(v: unknown, cats: readonly string[]): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (cats.includes(s)) return s;
  const alias = TOPIC_CAT_ALIASES[s];
  if (alias && cats.includes(alias)) return alias;
  return cats.includes('other') ? 'other' : v;
}

/**
 * Enthält der Beispielsatz die Wendung? Beugungstolerant wie beim eigenen Text (usesChunk:
 * „hinge on" in „It all hinges on …"), dazu ohne einleitendes „that/it/this/to" („that hinges on"
 * in „That really hinges on …" ist dieselbe Wendung).
 */
export function phraseIn(ex: string, phrase: string): boolean {
  if (usesChunk(ex, phrase)) return true;
  const core = phrase.trim().replace(/^(?:that|it|this|to)\s+/i, '');
  return core !== phrase.trim() && core.length > 1 && usesChunk(ex, core);
}

/** Satzzeichen und Groß/klein egal: zum Abgleich kopierter Angaben. */
export const loose = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
