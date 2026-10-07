import { z } from 'zod';
import { PatternId, TaskWhySchema } from '../grammar/patternTypes';
import type { C1Item } from './types';

// zod-Schemas des Aufgabensystems c1x (Lernplattform 3.0 §3.2, c1-aufgaben.md §2.3/§3). Was zod schlecht ausdrückt
// (Lösung an genau einer Stelle, Muster und Thema existieren, jede falsche Option hat eine Begründung …), prüft `checkContent.ts`.

const t = z.string().trim().min(1);
const bi = z.object({ de: t, en: t });
/** Genau eine Lücke aus drei oder mehr Unterstrichen. */
const oneGap = t.refine((s) => (s.match(/_{3,}/g) ?? []).length === 1, 'genau eine Lücke');
const word = z.string().regex(/^[A-Za-z']+$/);

const KIND_PREFIX = '(mcc|ocl|wf|kwt|err|pair|cnet|reg|para)';
/** `kwt-0042` (Seed), `kwt-v2-17` (LP2-Adapter), `kwt-ai-1a2b3c4d` (Claude-Aufgabe, Inhalts-Hash). */
const idRe = new RegExp(`^${KIND_PREFIX}-(\\d{4}|v2-\\d{1,4}|ai-[0-9a-f]{6,16})$`);

const base = z.object({
  id: z.string().regex(idRe),
  area: z.enum(['gram', 'lex']),
  pat: PatternId,
  topic: z.string().optional(),
  lex: z.array(t).max(3).optional(),
  trap: z.string().regex(/^f\d{2}$/).optional(),
  level: z.enum(['B2', 'B2+', 'C1']),
  dom: z.enum(['biz', 'life']),
  why: TaskWhySchema,
  src: z.enum(['seed', 'ai']),
  set: z.string().optional(),
  seq: z.number().int().min(1).optional(),
  probe: z.literal(true).optional(),
  form: z.string().regex(/^[A-L]$/).optional(),
  pool: z.enum(['gate', 'place']).optional(),
  b: z.number().optional(),
});

const mcc = base.extend({
  kind: z.literal('mcc'),
  text: oneGap,
  options: z.tuple([t, t, t, t]),
  answer: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

const ocl = base.extend({
  kind: z.literal('ocl'),
  text: oneGap,
  accept: z.array(word).min(1),
  cls: z.enum(['art', 'aux', 'prep', 'pron', 'rel', 'conj', 'det', 'adv', 'part']),
  chips: z.tuple([word, word, word]),
});

const wf = base.extend({
  kind: z.literal('wf'),
  text: oneGap,
  stem: z.string().regex(/^[A-Z-]+$/),
  accept: z.array(t).min(1),
  pos: z.enum(['noun', 'verb', 'adj', 'adv']),
  parts: z.object({ pre: t.optional(), base: t, suf: z.array(t).optional(), change: t.optional() }),
  family: z.array(t).min(2),
});

const kwt = base.extend({
  kind: z.literal('kwt'),
  lead: t,
  key: z.string().regex(/^[A-Z']+$/),
  before: z.string(),
  after: t,
  keys: z.array(z.object({ a: z.array(t).min(1), b: z.array(t).min(1) })).min(1),
  tiles: z.array(t).min(1),
  extra: z.array(t).max(4),
  traps: z.array(t).optional(),
  words: z.tuple([z.number().int().min(1), z.number().int().max(6)]).optional(),
});

const err = base.extend({
  kind: z.literal('err'),
  text: t,
  bad: z
    .object({ span: t, nth: z.number().int().min(1).optional(), fix: z.array(z.string()).min(1), choices: z.tuple([t, t, t]).optional() })
    .nullable(),
});

const pair = base.extend({
  kind: z.literal('pair'),
  sa: t,
  sb: t,
  means: z.tuple([bi, bi, bi]),
  transfer: z.object({ text: oneGap, cue: t, accept: z.array(t).min(1) }).optional(),
});

const cnet = base.extend({
  kind: z.literal('cnet'),
  hub: t,
  slot: z.enum(['V+N', 'Adj+N', 'N+prep', 'Adv+Adj']),
  right: z.array(z.object({ w: t, de: t, ex: t })).min(3).max(4),
  wrong: z.array(z.object({ w: t, calque: z.boolean().optional() })).min(3).max(4),
  also: z.array(z.object({ w: t, note: bi })).optional(),
});

const reg = base.extend({
  kind: z.literal('reg'),
  ctx: bi,
  from: z.enum(['casual', 'neutral', 'direct']),
  to: z.enum(['neutral', 'formal', 'diplomatic']),
  text: t,
  segs: z.array(z.object({ span: t, accept: z.array(t).min(1), choices: z.tuple([t, t, t]), why: bi })).min(1).max(3),
  answers: z.array(t).min(1),
});

const para = base.extend({
  kind: z.literal('para'),
  focus: z.enum(['nominal', 'passive', 'cleft', 'inversion', 'participle', 'verb-pattern', 'reported']),
  a: t,
  start: t,
  answers: z.array(t).min(1),
  options: z.tuple([t, t, t, t]),
  answer: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export const c1Item = z.discriminatedUnion('kind', [mcc, ocl, wf, kwt, err, pair, cnet, reg, para]);

/** Eine Inhaltsdatei: `{ v: 1, items }`. */
export const c1File = z.object({ v: z.literal(1), items: z.array(c1Item) });

// Der Vertrag (`types.ts`) und das Schema müssen dasselbe beschreiben: ein Auseinanderlaufen bricht die Typprüfung.
const _contract: z.ZodType<C1Item> = c1Item;
void _contract;
const _inverse = (x: z.infer<typeof c1Item>): C1Item => x;
void _inverse;

export type C1ItemParsed = z.infer<typeof c1Item>;
