import { z } from 'zod';
import type { Metrics } from '../domain/compare/compare';
import { block, clip, header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// compare@1 (Backlog B1, lehrer.md X1): Claude vergleicht dieselbe Sprech- und Schreibaufgabe mit der
// Fassung von vor etwa 4 Wochen und beschreibt den Fortschritt in Worten – mit den lokal gemessenen
// Werten als Belegen. Die CEFR-Stufe steht nur hier, und nur als Satz (lehrer.md Lücke 4). `default`,
// einen Tag zwischengespeichert; die Texte stehen in der Oberflächensprache (Sprachtreue, Kap. 10).

export type CompareSideVars = { speak: string; write: string; speakM: Metrics; writeM: Metrics; month: string };
export type CompareVars = { uiLang: UiLang; speakTask: string; writeTask: string; before: CompareSideVars; now: CompareSideVars };
export type CompareOut = { summary: string; better: string[]; next: string; level: string };

export const CMP_TEXT_MAX = 1_500;
export const CMP_SUMMARY_MAX = 900;
const ID = 'compare';
const VERSION = 1;

export const COMPARE_EXAMPLE = '{"summary":"…","better":["…","…"],"next":"…","level":"…"}';

const metricsLine = (m: Metrics): string =>
  [`${m.words} words`, m.wpm !== undefined ? `${m.wpm} words/min` : null, `${m.per100} German-English traps per 100 words`, `${m.phrases.length} own phrases used freely${m.phrases.length ? ` (${m.phrases.slice(0, 6).join('; ')})` : ''}`]
    .filter(Boolean)
    .join(', ');

const side = (label: string, s: CompareSideVars): string[] => [
  `${label} (${s.month}):`,
  `Speaking (45 s): ${metricsLine(s.speakM)}`,
  '<<<',
  block(s.speak, CMP_TEXT_MAX) || '(empty)',
  '>>>',
  `Writing: ${metricsLine(s.writeM)}`,
  '<<<',
  block(s.write, CMP_TEXT_MAX) || '(empty)',
  '>>>',
];

const clipTo = (max: number) => (v: unknown) => (typeof v === 'string' && v.trim().length > max ? `${v.trim().slice(0, max - 1)}…` : v);

const schemaFor = (v: CompareVars): z.ZodType<CompareOut> =>
  z
    .object({
      summary: z.preprocess(clipTo(CMP_SUMMARY_MAX), z.string().min(20).max(CMP_SUMMARY_MAX)),
      better: z.preprocess((x) => (Array.isArray(x) ? x.slice(0, 3) : x), z.array(z.preprocess(clipTo(240), z.string().min(3).max(240))).max(3)),
      next: z.preprocess(clipTo(300), z.string().min(3).max(300)),
      level: z.preprocess(clipTo(300), z.string().min(3).max(300)),
    })
    .superRefine(langOf(['summary', 'next', 'level'], v.uiLang));

export const compare: PromptTemplate<CompareVars, CompareOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced English teacher. A German-speaking professional (B2, aiming for C1) did the SAME speaking and writing task about 4 weeks ago and again today.',
      'Compare both versions and describe the progress in words, like a teacher talking to the learner. Use the measured values as evidence; do not invent other numbers.',
      `Speaking task: ${clip(v.speakTask, 300)}`,
      `Writing task: ${clip(v.writeTask, 400)}`,
      '',
      ...side('BEFORE', v.before),
      '',
      ...side('NOW', v.now),
      '',
      `Write all fields in ${langName(v.uiLang)}. Quote English examples from the texts in "quotes".`,
      'Reply with only one JSON object:',
      COMPARE_EXAMPLE,
      'Rules:',
      '- summary: 3–5 sentences: what is clearly better, what stayed the same, what got worse (if anything). Honest and specific.',
      '- better: up to 3 short concrete improvements, each with a quoted example from NOW.',
      '- next: one sentence – the one thing to work on until next month.',
      '- level: one sentence with the CEFR level of NOW compared to BEFORE (e.g. "B2 in both, NOW closer to C1 in range"). Only as a sentence, never a score.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
