import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { block, clip, fenced, header, langName, langOf } from './common';
import { ERROR_CAT_VALUES, englishText } from './inputCommon';
import { cefrLoose, clipped, inputCatLoose, intIn, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// reading-check@2 (Plan §5, F17): prüft Emrahs Zusammenfassung eines Lesetexts. Altform
// `reading.res` der alten App {score, covered, misunderstood, language, feedback, model_summary}.

export type ReadingCheckVars = { title: string; text: string; keypoints: readonly string[]; summary: string; uiLang: UiLang };

export type ReadingCheckOut = {
  score: number;
  covered: string[];
  misunderstood: string[];
  language: { cefr: string; errors: Array<{ orig: string; fix: string; cat: string; why: string }>; tips: string[] };
  feedback: string;
  model_summary: string;
};

export const CHECK_TEXT_MAX = 8000;
export const SUMMARY_MAX = 2000;

const ID = 'reading-check';
const VERSION = 2;
const CEFR_ALL = ['A2', 'B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+', 'C2'] as const;

export const READING_CHECK_EXAMPLE = JSON.stringify({
  score: 4,
  covered: ['retention is cheaper than acquisition'],
  misunderstood: [],
  language: { cefr: 'B2', errors: [{ orig: 'customers who stays', fix: 'customers who stay', cat: 'grammar', why: '…' }], tips: ['…'] },
  feedback: '…',
  model_summary: 'Keeping customers costs less than winning new ones, so subscription companies invest in onboarding and support.',
});

const schemaFor = (uiLang: UiLang): z.ZodType<ReadingCheckOut> =>
  z
    .object({
      // Tolerant gelesen (Prüfbefund W3): „4"/3.5 → Zahl, „B2-C1" → B2, „agreement" → grammar,
      // zu lange Angaben gekürzt, überzählige Einträge abgeschnitten.
      score: intIn(1, 5),
      covered: sliced(clipped(1, 200), 0, 8),
      misunderstood: sliced(clipped(1, 200), 0, 6),
      language: z.object({
        cefr: cefrLoose(CEFR_ALL),
        errors: sliced(z.object({ orig: clipped(1, 300), fix: clipped(1, 300), cat: inputCatLoose, why: clipped(1, 240) }), 0, 8),
        tips: sliced(clipped(1, 200), 0, 3),
      }),
      feedback: clipped(1, 400),
      model_summary: englishText(20, 700),
    })
    .superRefine((v, ctx) => {
      langOf(['feedback'], uiLang)(v, ctx);
      const msg = `must be written in ${langName(uiLang)}`;
      v.language.errors.forEach((e, i) => {
        if (isWrongLang(e.why, uiLang)) ctx.addIssue({ code: 'custom', path: ['language', 'errors', i, 'why'], message: msg });
      });
      v.language.tips.forEach((tip, i) => {
        if (isWrongLang(tip, uiLang)) ctx.addIssue({ code: 'custom', path: ['language', 'tips', i], message: msg });
      });
    });

export const readingCheck: PromptTemplate<ReadingCheckVars, ReadingCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(vars) {
    return [
      header({ id: ID, version: VERSION }),
      'You check a short summary that a German-speaking professional (B2, aiming for C1) wrote about an English text.',
      'American English is the standard. British spelling in the learner summary is always correct: never list it as an error.',
      `Text title: ${clip(vars.title, 120)}`,
      'Text:',
      fenced(block(vars.text, CHECK_TEXT_MAX)),
      `Key points of the text: ${vars.keypoints.slice(0, 6).map((k) => clip(k, 220)).join(' | ') || '(none)'}`,
      'Learner summary:',
      fenced(block(vars.summary, SUMMARY_MAX)),
      `Explanation language: ${langName(vars.uiLang)}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      READING_CHECK_EXAMPLE,
      'Rules:',
      '- score: 1–5 for how well the summary captures the main ideas.',
      '- covered: short English labels of the key points the summary gets right; misunderstood: short English notes on what it gets wrong.',
      '- language: cefr estimate of the summary, up to 8 language errors (orig = exact words from the summary, fix, cat = one of ' + ERROR_CAT_VALUES.join(', ') + ', why in the explanation language),',
      '  tips: up to 3 short tips in the explanation language.',
      '- feedback: 1–2 encouraging, concrete sentences in the explanation language.',
      '- model_summary: a model summary in American English, 2–4 sentences.',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars.uiLang),
};
