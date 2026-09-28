import { z } from 'zod';
import { clip, header, langName, langOf } from '../../common';
import { looseBool } from '../../produceCheck';
import { clipped, sliced } from '../../tolerant';
import type { PromptTemplate, UiLang } from '../../types';

// pressure-check@1 (Plan §3.2, N103, Lehrer I3): Einwand-Training. Emrah hatte 30 s für eine
// Antwort auf einen Kunden-Einwand. Geprüft wird das Muster anerkennen · nachfragen · antworten ·
// absichern, dazu höchstens 3 Korrekturen und eine bessere Fassung seiner Antwort (US-Englisch).
// `quick`: eine kurze Antwort mitten in einer Serie; die Serie läuft ohne Warten weiter.

export type PressureCheckVars = {
  /** Einwand des Kunden (Englisch). */
  objection: string;
  /** Emrahs Antwort. */
  answer: string;
  /** Musterantwort (Englisch) als Orientierung. */
  model: string;
  uiLang: UiLang;
};

export type PressureFix = { mine: string; right: string; why: string };
export type PressureCheckOut = {
  acknowledge: boolean;
  ask: boolean;
  answer: boolean;
  secure: boolean;
  effect: string;
  fixes: PressureFix[];
  better: string;
};

export const PC_TEXT_MAX = 600;
const ID = 'pressure-check';
const VERSION = 1;

export const PRESSURE_CHECK_EXAMPLE =
  '{"acknowledge":true,"ask":false,"answer":true,"secure":false,"effect":"…","fixes":[{"mine":"…","right":"…","why":"…"}],"better":"…"}';

const fix = z.object({ mine: clipped(1, 200), right: clipped(1, 200), why: clipped(1, 200) });

export const pressureCheck: PromptTemplate<PressureCheckVars, PressureCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking salesperson (B2, aiming for C1) practices handling customer objections in English under time pressure (30 seconds per answer).',
      'The pattern he should follow has four moves: 1) acknowledge the concern, 2) ask a clarifying question, 3) answer with a benefit or fact, 4) secure a next step or agreement.',
      'Judge his answer. American English is the standard; British spelling and British words are correct too. Spoken style and short sentences are fine.',
      `Customer objection: ${clip(v.objection, 300)}`,
      `Model answer (orientation only, he does not have to copy it): ${clip(v.model, PC_TEXT_MAX)}`,
      `Learner answer: ${clip(v.answer, PC_TEXT_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      PRESSURE_CHECK_EXAMPLE,
      'Rules:',
      '- acknowledge, ask, answer, secure: true only if the move is clearly present in the learner answer.',
      '- effect: one short sentence in the explanation language: how the answer sounds to the customer.',
      '- fixes: at most 3 real mistakes (grammar, word choice, German-English traps, tone), most important first. mine = the exact words from the learner answer, right = the corrected words (English), why = one short reason in the explanation language. Empty list if there are none.',
      '- better: the learner answer rewritten as natural, polite US business English with all four moves, 2 to 4 sentences, keeping his ideas.',
    ].join('\n');
  },
  schema: (v) =>
    z
      .object({
        acknowledge: z.preprocess(looseBool, z.boolean()),
        ask: z.preprocess(looseBool, z.boolean()),
        answer: z.preprocess(looseBool, z.boolean()),
        secure: z.preprocess(looseBool, z.boolean()),
        effect: clipped(1, 240),
        fixes: sliced(fix, 0, 3).catch([]),
        better: clipped(1, PC_TEXT_MAX),
      })
      .superRefine(langOf(['effect'], v.uiLang)),
};
