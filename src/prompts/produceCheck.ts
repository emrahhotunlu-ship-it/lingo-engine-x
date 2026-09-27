import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// produce-check@1: Prüft einen eigenen Satz mit dem Zielwort (Abfrageart „produce").
// `quick` statt `default` (Abweichung von Kap. 10, begründet im Architektur-Entwurf §0):
// Es geht um einen einzelnen Satz mitten in einer Runde; `default` denkt 5–60 s nach.
// Britische Formen gelten als richtig, die US-Form kommt als Hinweis (A7.3).

export type ProduceCheckVars = {
  target: string;
  meaning: string;
  sentence: string;
  uiLang: UiLang;
  kind: 'word' | 'phrase';
};
export type ProduceVerdict = 'correct' | 'minor' | 'wrong';
export type ProduceCheckOut = {
  verdict: ProduceVerdict;
  usesTarget: boolean;
  fixed: string;
  why: string;
  better: string;
};

export const TARGET_MAX = 80;
export const MEANING_MAX = 120;
export const LEARNER_SENTENCE_MAX = 300;

/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const PRODUCE_CHECK_EXAMPLE = '{"verdict":"correct","usesTarget":true,"fixed":"…","why":"…","better":""}';

const ID = 'produce-check';
const VERSION = 1;

const VERDICT_ALIASES: ReadonlyArray<[RegExp, ProduceVerdict]> = [
  [/^(correct|right|good|ok|okay|natural|perfect)$/, 'correct'],
  [/^(minor|small|almost|mostly[\s_-]?correct|minor[\s_-]?(error|issue|mistake)s?|(partly|partially)[\s_-]?correct|partial)$/, 'minor'],
  [/^(wrong|incorrect|error|false|missing|misused|major)$/, 'wrong'],
];

/** Tolerant: „Correct", „minor error", „incorrect" → die drei Werte; Unbekanntes bleibt (Neuversuch). */
export function produceVerdict(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  for (const [re, out] of VERDICT_ALIASES) if (re.test(s)) return out;
  return v;
}

/** Tolerant: `"true"`/`"yes"` bzw. `"false"`/`"no"` als Wahrheitswert. */
export function looseBool(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (s === 'true' || s === 'yes') return true;
  if (s === 'false' || s === 'no') return false;
  return v;
}

const schemaFor = (uiLang: UiLang): z.ZodType<ProduceCheckOut> =>
  z
    .object({
      verdict: z.preprocess(produceVerdict, z.enum(['correct', 'minor', 'wrong'])),
      usesTarget: z.preprocess(looseBool, z.boolean()),
      // Bei „correct“ darf „fixed“ leer sein (nichts zu verbessern); sonst Pflicht (unten).
      fixed: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 400)),
      why: clipped(1, 400),
      // Fehlt „better" oder ist es null, gibt es keine natürlichere Fassung.
      better: z.preprocess((v) => (v === undefined || v === null ? '' : v), clipped(0, 400)),
    })
    .superRefine((v, ctx) => {
      if (v.verdict !== 'correct' && !v.fixed.trim()) ctx.addIssue({ code: 'custom', path: ['fixed'], message: 'fixed must contain the corrected sentence' });
      // Keine Widersprüche (Kap. 2): „richtig" setzt voraus, dass das Zielwort vorkommt.
      if (v.verdict !== 'wrong' && !v.usesTarget) {
        ctx.addIssue({ code: 'custom', path: ['verdict'], message: 'must be "wrong" when usesTarget is false' });
      }
    })
    .superRefine(langOf(['why'], uiLang));

export const produceCheck: PromptTemplate<ProduceCheckVars, ProduceCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: true,
  build(vars) {
    const label = vars.kind === 'phrase' ? 'phrase' : 'word';
    return [
      header({ id: ID, version: VERSION }),
      'You check one sentence written by a German-speaking learner (B2, aiming for C1).',
      'American English is the standard; British spelling and British words count as correct',
      '(then mention the US form in "why" as a tip, never as an error).',
      `Target ${label}: ${clip(vars.target, TARGET_MAX)} (meaning: ${clip(vars.meaning, MEANING_MAX)})`,
      `Learner sentence: ${clip(vars.sentence, LEARNER_SENTENCE_MAX)}`,
      `Explanation language: ${langName(vars.uiLang)}`,
      'Reply with only one JSON object:',
      PRODUCE_CHECK_EXAMPLE,
      'Rules:',
      '- verdict: "correct" = grammatical, natural, target used correctly; "minor" = target used correctly',
      '  but a small error or slightly unnatural wording elsewhere; "wrong" = target missing or misused,',
      '  or the sentence is ungrammatical.',
      '- usesTarget: true if the target (any inflected form) is used with the right meaning.',
      '- fixed: the sentence corrected with minimal changes (identical if nothing to fix).',
      '- why: one or two sentences in the explanation language: what is right or wrong and why. Always explain, also when correct.',
      '- better: a more natural C1 version, or "".',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars.uiLang),
};
