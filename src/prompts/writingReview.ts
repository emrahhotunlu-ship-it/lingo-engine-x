import { z } from 'zod';
import { block, clip, fenced, header, langName, langOf } from './common';
import { isWrongLang } from '../domain/lang/detect';
import { ERROR_CAT_VALUES, englishText, words } from './inputCommon';
import type { PromptTemplate, UiLang } from './types';

// writing-review@1 (Plan §5, Kap. 6.8): Korrektur eines eigenen Texts mit Begründung je Stelle.
// Altform `res` der alten App. Erklärungen in der Oberflächensprache, alles Englische in US-Form.
// Britische Schreibweise ist bei Emrah richtig (A7.3); meldet Claude sie trotzdem, macht die
// Nachbearbeitung daraus einen Hinweis (usHints.ts) – kein Schemafehler, kein Neuversuch.

export type WritingReviewVars = {
  title_en: string;
  task_en: string;
  genre: string;
  level: string;
  words: [number, number];
  focus_en: string;
  useful: readonly string[];
  text: string;
  uiLang: UiLang;
  /** Die 16 Kennungen der Grammatikthemen (für `topic`). */
  topics: readonly string[];
};

export type ReviewError = { orig: string; fix: string; cat: (typeof ERROR_CAT_VALUES)[number]; topic: string | null; sev: 'minor' | 'major'; why: string };

export type WritingReviewOut = {
  cefr: string;
  scores: { task: number; grammar: number; vocabulary: number; coherence: number; register: number };
  summary: string;
  strengths: string[];
  errors: ReviewError[];
  improved: string;
  upgrades: string[];
  phrases: string[];
  next: string;
};

export const REVIEW_TEXT_MAX = 6000;
export const REVIEW_TASK_MAX = 600;

const ID = 'writing-review';
const VERSION = 1;

export const WRITING_REVIEW_EXAMPLE = JSON.stringify({
  cefr: 'B2',
  scores: { task: 4, grammar: 3, vocabulary: 4, coherence: 4, register: 3 },
  summary: '…',
  strengths: ['…'],
  errors: [{ orig: 'we are working on it since March', fix: 'we have been working on it since March', cat: 'grammar', topic: 'pres-perf-cont', sev: 'major', why: '…' }],
  improved: 'Dear Ms. Walker, we have been working on the migration since March …',
  upgrades: ['…'],
  phrases: ['…'],
  next: '…',
});

const score = z.number().int().min(1).max(5);

const schemaFor = (vars: WritingReviewVars): z.ZodType<WritingReviewOut> => {
  const ui = (min: number, max: number) => z.string().trim().min(min).max(max);
  const textLen = Array.from(vars.text).length;
  return z
    .object({
      cefr: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^(A2|B1\+?|B2\+?|C1\+?|C2)$/),
      scores: z.object({ task: score, grammar: score, vocabulary: score, coherence: score, register: score }),
      summary: ui(1, 300),
      strengths: z.array(ui(1, 200)).min(1).max(3),
      errors: z
        .array(
          z.object({
            orig: z.string().trim().min(1).max(120),
            fix: z.string().trim().min(1).max(200),
            cat: z.enum(ERROR_CAT_VALUES),
            topic: z.string().trim().max(40).nullable(),
            sev: z.enum(['minor', 'major']),
            why: ui(1, 240),
          }),
        )
        .max(12),
      improved: englishText(1, Math.max(400, Math.round(textLen * 1.4) + 200)),
      upgrades: z.array(z.string().trim().min(1).max(160)).max(5),
      phrases: z.array(z.string().trim().min(1).max(160)).max(5),
      next: ui(1, 300),
    })
    .superRefine((v, ctx) => {
      langOf(['summary', 'next'], vars.uiLang)(v, ctx);
      const wrong = (s: string) => isWrongLang(s, vars.uiLang);
      const msg = `must be written in ${langName(vars.uiLang)}`;
      v.strengths.forEach((s, i) => {
        if (wrong(s)) ctx.addIssue({ code: 'custom', path: ['strengths', i], message: msg });
      });
      v.errors.forEach((e, i) => {
        if (wrong(e.why)) ctx.addIssue({ code: 'custom', path: ['errors', i, 'why'], message: msg });
      });
    });
};

export const writingReview: PromptTemplate<WritingReviewVars, WritingReviewOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(vars) {
    const [min, max] = vars.words;
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced, encouraging English writing coach for a German-speaking professional (B2, aiming for C1).',
      'American English is the standard. British spelling and British words are ALWAYS correct in the learner text: never list them as errors.',
      `Task title: ${clip(vars.title_en, 90)}`,
      `Task: ${clip(vars.task_en, REVIEW_TASK_MAX)}`,
      `Genre: ${clip(vars.genre, 20)} · Target level: ${clip(vars.level, 4)} · Target length: ${min}–${max} words (the text has ${words(vars.text)})`,
      `Focus: ${clip(vars.focus_en, 300) || '(none)'}`,
      `Useful phrases offered: ${vars.useful.slice(0, 6).map((u) => clip(u, 80)).join(' | ') || '(none)'}`,
      `Explanation language: ${langName(vars.uiLang)}`,
      'Learner text:',
      fenced(block(vars.text, REVIEW_TEXT_MAX)),
      'Reply with only one JSON object, no other text, exactly this shape:',
      WRITING_REVIEW_EXAMPLE,
      'Rules:',
      '- cefr: your honest estimate of THIS text (A2, B1, B1+, B2, B2+, C1, C1+).',
      '- scores: 1–5 each for task fulfillment, grammar, vocabulary, coherence, register (tone).',
      '- summary: 1–2 sentences in the explanation language; strengths: 1–3 short points in the explanation language.',
      '- errors: up to 12 real mistakes, most important first. orig = the exact words from the text (copy them character for character),',
      '  fix = the corrected words, cat = one of ' + ERROR_CAT_VALUES.join(', ') + ',',
      `  topic = one of these grammar topic ids if it fits, else null: ${vars.topics.join(', ')},`,
      '  sev = major (changes meaning or looks unprofessional) or minor; why = one sentence in the explanation language.',
      '- improved: the whole text rewritten at C1 level in American English, same content, similar length.',
      '- upgrades: up to 5 more precise English phrases the learner could have used; phrases: up to 5 good phrases from the text worth keeping.',
      '- next: one concrete tip for the next text, in the explanation language.',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars),
};
