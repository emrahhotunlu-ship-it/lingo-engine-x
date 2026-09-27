import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// grammar-judge@1 (phase2-plan §7, D13): Urteil über eine frei formulierte Grammatikantwort
// (transform, correct), die die lokale Prüfung abgelehnt hat. Nur nach „Prüfen" (ausdrückliche
// Handlung, sample.d.ts), `quick`, 24 h zwischengespeichert. Ohne KI oder bei Fehler gilt `near`.

export type GrammarJudgeVars = {
  topic: string;
  type: 'transform' | 'correct' | 'gap' | 'mc';
  prompt: string;
  answer: string;
  accepted: readonly string[];
  given: string;
  uiLang: UiLang;
};
export type GrammarJudgeOut = { verdict: 'correct' | 'near' | 'wrong'; acceptable: boolean; corrected: string; why: string };

export const JUDGE_TASK_MAX = 300;
export const JUDGE_GIVEN_MAX = 300;
export const JUDGE_WHY_WORDS = 25;

export const GRAMMAR_JUDGE_EXAMPLE = '{"verdict":"correct","acceptable":true,"corrected":"…","why":"…"}';

const ID = 'grammar-judge';
const VERSION = 1;

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

const schemaFor = (uiLang: UiLang): z.ZodType<GrammarJudgeOut> =>
  z
    .object({
      verdict: z.enum(['correct', 'near', 'wrong']),
      acceptable: z.boolean(),
      corrected: z.string().trim().min(1).max(400),
      why: z
        .string()
        .trim()
        .min(1)
        .max(300)
        .refine((s) => words(s) <= JUDGE_WHY_WORDS + 5, { message: `at most ${JUDGE_WHY_WORDS} words` }),
    })
    .superRefine((v, ctx) => {
      // Keine Widersprüche (Kap. 2.2): „auch akzeptabel" heißt nie „falsch".
      if (v.acceptable && v.verdict === 'wrong') ctx.addIssue({ code: 'custom', path: ['verdict'], message: 'must not be "wrong" when acceptable is true' });
    })
    .superRefine(langOf(['why'], uiLang));

export const grammarJudge: PromptTemplate<GrammarJudgeVars, GrammarJudgeOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const acc = v.accepted.map((a) => clip(a, 120)).filter(Boolean);
    return [
      header({ id: ID, version: VERSION }),
      'You judge one answer to a grammar exercise by a German-speaking learner (B2, aiming for C1).',
      'American English is the standard; British spelling and British words count as correct (mention the US form in "why" as a tip, never as an error).',
      `Grammar topic: ${clip(v.topic, 80)}`,
      `Task type: ${v.type}`,
      `Exercise: ${clip(v.prompt, JUDGE_TASK_MAX)}`,
      `Expected answer: ${clip(v.answer, JUDGE_TASK_MAX)}`,
      `Also accepted: ${acc.length ? acc.join(' | ') : '(none)'}`,
      `Learner answer: ${clip(v.given, JUDGE_GIVEN_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      GRAMMAR_JUDGE_EXAMPLE,
      'Rules:',
      '- Ignore capitalization and final punctuation.',
      '- verdict: "correct" = fully correct for this task and grammar point; "near" = right grammar point, one small slip (spelling, article, word order);',
      '  "wrong" = the grammar point is wrong or the answer does not solve the task.',
      '- acceptable: true if the answer is correct English that fits the task, even if it is not the form being practiced.',
      '- corrected: the learner answer with minimal corrections (identical if nothing to fix).',
      `- why: at most ${JUDGE_WHY_WORDS} words in the explanation language: why it is right, or exactly what is wrong.`,
    ].join('\n');
  },
  schema: (v) => schemaFor(v.uiLang),
};
