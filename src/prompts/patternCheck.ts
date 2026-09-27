import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { looseBool, produceVerdict, type ProduceVerdict } from './produceCheck';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// pattern-check@1 (Lernberatung 27.09., V3 „Deutsch-Fallen“): prüft einen NEU gebildeten Satz
// im Kurzdrill eines Musters. Ist der Satz richtig, und ist Emrah der Falle ausgewichen?
// `quick` – ein einzelner Satz mitten in einer Runde (wie produce-check@1). Britische Formen
// gelten als richtig (A7.3). Keine Selbstbewertung: das Urteil bestimmt allein die Prüfung.

export type PatternCheckVars = {
  /** Englischer Titel des Musters, z. B. „“since” with the present tense“. */
  pattern: string;
  /** Ein eigener Beispielsatz mit Korrektur (Hinweis für Claude), darf leer sein. */
  example: string;
  /** Die Aufgabe (Englisch). */
  task: string;
  sentence: string;
  uiLang: UiLang;
};

export type PatternCheckOut = { verdict: ProduceVerdict; avoided: boolean; fixed: string; why: string };

export const PC_SENTENCE_MAX = 300;
export const PATTERN_CHECK_EXAMPLE = '{"verdict":"correct","avoided":true,"fixed":"","why":"…"}';

const ID = 'pattern-check';
const VERSION = 1;

export const patternCheck: PromptTemplate<PatternCheckVars, PatternCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1) practices one of his recurring error patterns by writing a new sentence for a short task.',
      'Decide whether the sentence is correct, natural English and whether it avoids the trap. American English is the standard; British spelling and British words are correct too.',
      `Error pattern: ${clip(v.pattern, 120)}`,
      `His earlier mistake: ${clip(v.example, 300) || '(none)'}`,
      `Task: ${clip(v.task, 200)}`,
      `Learner sentence: ${clip(v.sentence, PC_SENTENCE_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      PATTERN_CHECK_EXAMPLE,
      'Rules:',
      '- verdict: "correct" (no mistake), "minor" (small slip, trap avoided) or "wrong" (the trap or another real mistake).',
      '- avoided: true if the sentence does NOT contain the error pattern (false also if the task was ignored).',
      '- fixed: the corrected sentence in American English; empty if verdict is "correct".',
      '- why: one short sentence in the explanation language.',
    ].join('\n');
  },
  schema: (v) =>
    z
      .object({
        verdict: z.preprocess(produceVerdict, z.enum(['correct', 'minor', 'wrong'])),
        avoided: z.preprocess(looseBool, z.boolean()),
        fixed: z.preprocess((x) => (x == null ? '' : x), clipped(0, 400)),
        why: clipped(1, 300),
      })
      .superRefine((o, ctx) => {
        if (o.verdict !== 'correct' && !o.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must contain the corrected sentence' });
        // Keine Widersprüche (Kap. 2): in die Falle getappt heißt nicht richtig.
        if (o.verdict !== 'wrong' && !o.avoided) ctx.addIssue({ code: 'custom', path: ['verdict'], message: 'must be "wrong" when avoided is false' });
      })
      .superRefine(langOf(['why'], v.uiLang)),
};
