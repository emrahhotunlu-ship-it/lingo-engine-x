import { z } from 'zod';
import { toUS } from '../domain/answer/spelling';
import { isWrongLang } from '../domain/lang/detect';
import { usesChunk } from '../domain/input/chunkMatch';

// Gemeinsame Bausteine der Phase-4-Vorlagen (Plan §5): Fragen im Altformat, Glossar, Zählen,
// Sprachtreue je Feld und britische Schreibweisen im erzeugten Text.

export const CEFR_VALUES = ['B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'] as const;
export type CefrValue = (typeof CEFR_VALUES)[number];

export const ERROR_CAT_VALUES = ['grammar', 'vocabulary', 'collocation', 'spelling', 'punctuation', 'register', 'coherence', 'word-order', 'other'] as const;

export const words = (s: string): number => (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
export const paras = (s: string): string[] =>
  s
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** Anzahl britischer Schreibweisen (colour, organise, travelled …) in einem englischen Text. */
export function britishCount(text: string): number {
  let n = 0;
  for (const w of text.toLowerCase().match(/[a-z]+/g) ?? []) if (toUS(w) !== w) n++;
  return n;
}

export const englishText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

export const germanText = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !isWrongLang(s, 'de'), { message: 'must be written in German' });

export const uiText = (lang: 'de' | 'en', min: number, max: number) => (lang === 'de' ? germanText(min, max) : englishText(min, max));

export const questionSchema = z
  .object({
    q: englishText(8, 220),
    options: z.array(englishText(1, 160)).length(4),
    answer: z.string().trim().min(1).max(160),
    type: z.enum(['gist', 'detail', 'inference']),
    explain_de: germanText(8, 300),
    explain_en: englishText(8, 300),
  })
  .superRefine((q, ctx) => {
    const lower = q.options.map((o) => o.toLowerCase());
    if (new Set(lower).size !== lower.length) ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be distinct' });
    if (!lower.includes(q.answer.toLowerCase())) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'answer must be exactly one of the options' });
  });

export const questionsSchema = z
  .array(questionSchema)
  .length(4)
  .superRefine((qs, ctx) => {
    if (qs.filter((q) => q.type === 'gist').length !== 1) ctx.addIssue({ code: 'custom', message: 'exactly one question must have type "gist"' });
  });

export const glossSchema = (min: number, max: number) =>
  z
    .array(
      z.object({
        w: englishText(2, 60),
        de: z.string().trim().min(1).max(80),
        def: englishText(3, 160),
      }),
    )
    .min(min)
    .max(max);

/** Jedes Glossarwort muss im Text vorkommen (Groß/klein egal, Grundform-tolerant). */
export function glossInText(gloss: ReadonlyArray<{ w: string }>, text: string, ctx: z.RefinementCtx, path: string): void {
  gloss.forEach((g, i) => {
    if (!usesChunk(text, g.w)) ctx.addIssue({ code: 'custom', path: [path, i, 'w'], message: `"${g.w}" does not appear in the text` });
  });
}

export const QUESTION_RULES = [
  '- questions: exactly 4 multiple-choice questions in English, each with exactly 4 distinct options;',
  '  "answer" repeats the correct option word for word; exactly one question has type "gist" (main idea),',
  '  the others "detail" or "inference"; wrong options must be plausible but clearly contradicted by the text.',
  '- explain_de: one German sentence why the answer is right, quoting the key words from the text;',
  '  explain_en: the same in English.',
];
