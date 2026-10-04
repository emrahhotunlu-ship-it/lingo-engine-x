import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { looseBool } from './produceCheck';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// combo-check@1: „Wort + Regel im selben Satz“ im Reiter Anwenden (Plan docs/umbau/anwenden-plan.md, Übung 2, Teil B).
// Emrah schreibt EINEN eigenen Satz mit einem Wort aus seinem Wortschatz und einer Grammatikregel. Ob das Wort im Satz
// steht, prüft die App selbst (lokal); Claude beurteilt nur die Regel und die Richtigkeit des Satzes. Zwei getrennte Urteile,
// damit ein Fehler nur dem Konto zugeordnet wird, das falsch war. Britische Schreibweisen gelten als richtig (A7.3).

export type ComboCheckVars = {
  word: string;
  /** Englischer Name des Grammatikthemas. */
  topic: string;
  /** Kurzregel (deutsch oder englisch, wie im Themenblatt). */
  rule: string;
  sentence: string;
  uiLang: UiLang;
};

export type ComboCheckOut = {
  /** Ist die Regel im Satz richtig angewendet? */
  ruleOk: boolean;
  /** Ist der Satz insgesamt grammatisch richtig und natürlich? */
  correct: boolean;
  /** Korrigierte Fassung (nur nötig, wenn der Satz nicht richtig ist; sonst leer). */
  fixed: string;
  why: string;
};

const ID = 'combo-check';
const VERSION = 1;
export const COMBO_SENTENCE_MAX = 300;

export const COMBO_CHECK_EXAMPLE = '{"ruleOk":false,"correct":false,"fixed":"We have been working on the deadline since March.","why":"…"}';

export const comboCheck: PromptTemplate<ComboCheckVars, ComboCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1) wrote ONE sentence of his own. He had to use a given word and apply a given grammar rule in the same sentence.',
      'You judge only two things: (1) is the grammar rule applied correctly in his sentence, (2) is the whole sentence correct, natural English. American English is the standard; British spelling and British words are correct too.',
      `Word he had to use: ${clip(v.word, 40)}`,
      `Grammar topic: ${clip(v.topic, 80)}`,
      `Rule: ${clip(v.rule, 400) || '(none)'}`,
      `His sentence: ${clip(v.sentence, COMBO_SENTENCE_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      COMBO_CHECK_EXAMPLE,
      'Rules:',
      '- ruleOk: true only if the sentence really uses the given rule in the right form. A correct sentence that avoids the rule is ruleOk false.',
      '- correct: true only if there is no grammar, word-choice or spelling mistake anywhere in the sentence.',
      '- fixed: if correct is false, the corrected sentence in American English that keeps his idea and his word; keep it close to his sentence. If correct is true, an empty string.',
      '- why: one or two short sentences in the explanation language: what is right, or what exactly was wrong and why. Name the German habit if it caused the mistake.',
      '- No straight double quotes inside the strings.',
    ].join('\n');
  },
  schema: (v) =>
    z
      .object({
        ruleOk: z.preprocess(looseBool, z.boolean()),
        correct: z.preprocess(looseBool, z.boolean()),
        fixed: z.preprocess((x) => (x === undefined || x === null ? '' : x), clipped(0, 400)),
        why: clipped(1, 400),
      })
      .superRefine(langOf(['why'], v.uiLang))
      .superRefine((o, ctx) => {
        if (!o.correct && !o.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'give the corrected sentence when correct is false' });
      }),
};
