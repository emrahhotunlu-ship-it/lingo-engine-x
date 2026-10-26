import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { clipped } from './tolerant';
import { looseBool } from './produceCheck';
import type { PromptTemplate, UiLang } from './types';

// lexical-unit-check@1 (Kartenqualität 26.10.2026, docs/umbau/card-quality.md): Ist eine Wortgruppe aus einem Artikel eine feste Einheit
// (Kollokation, Fachbegriff, Wendung), die sich als Karte lohnt – oder ein zufälliger Ausschnitt wie „adaptive attempts“? Nur auf
// Knopfdruck („Als Karte“), nur wenn die reine Prüfung `lexicalUnit` unsicher ist, `quick`, 24 h zwischengespeichert, Tutor-Tagesbremse.
// `better`: die übliche Fassung („adaptive attacks“) oder null. `why`: ein kurzer Grund in der Oberflächensprache. Nie automatisch wiederholt.

export type LexicalUnitVars = { phrase: string; sentence: string; uiLang: UiLang };
export type LexicalUnitOut = { isUnit: boolean; better: string | null; why: string };

export const LEXICAL_UNIT_EXAMPLE = '{"isUnit":false,"better":"adaptive attacks","why":"…"}';

const ID = 'lexical-unit-check';
const VERSION = 1;

const betterSchema = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() && !/^(?:null|none|-|n\/a)$/i.test(v.trim()) ? v.trim() : null),
  z.string().max(60).nullable(),
);

const schemaFor = (v: LexicalUnitVars): z.ZodType<LexicalUnitOut> =>
  z
    .object({ isUnit: z.preprocess(looseBool, z.boolean()), better: betterSchema, why: clipped(1, 300) })
    .transform((o) => ({ ...o, better: o.isUnit || (o.better && o.better.toLowerCase() === v.phrase.trim().toLowerCase()) ? null : o.better }))
    .superRefine(langOf(['why'], v.uiLang));

export const lexicalUnitCheck: PromptTemplate<LexicalUnitVars, LexicalUnitOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1, business English) wants to save a word group from an article as a vocabulary card.',
      'Decide whether it is a lexical unit worth learning as a whole: a fixed expression, a strong collocation (e.g. "weak link", "close a deal", "concerted effort"), a phrasal verb, or a technical term (e.g. "prompt injection").',
      'It is NOT a unit if it is a free combination that only happens to stand together in this sentence (e.g. "adaptive attempts", "cheap hardware", "recent changes"): each word keeps its normal meaning and native speakers would not store it as one chunk.',
      'American English is the standard; British spelling counts as correct.',
      `Word group: ${clip(v.phrase, 60)}`,
      `Sentence: ${clip(v.sentence, 300)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      LEXICAL_UNIT_EXAMPLE,
      'Rules:',
      '- isUnit: true only if the word group is an established unit in English (you would find it in a collocation dictionary or as a term), not just grammatical.',
      '- better: if isUnit is false and a closely related established unit exists that fits this sentence (often the usual wording, e.g. "adaptive attacks" instead of "adaptive attempts"), give it in base form; otherwise null. Never invent a phrase.',
      '- why: one short sentence in the explanation language: why it is or is not a unit. Do not translate the word group.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
