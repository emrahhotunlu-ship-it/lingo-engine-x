import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { clipped } from './tolerant';
import { looseBool } from './produceCheck';
import type { PromptTemplate, UiLang } from './types';

// lexical-unit-check@1 (Kartenqualität 26.10.2026, docs/umbau/card-quality.md): Ist eine Wortgruppe aus einem Artikel eine feste Einheit
// (Kollokation, Fachbegriff, Wendung), die sich als Karte lohnt – oder ein zufälliger Ausschnitt wie „adaptive attempts“? Nur auf
// Knopfdruck („Als Karte“), nur wenn die reine Prüfung `lexicalUnit` unsicher ist, `quick`, 24 h zwischengespeichert, Tutor-Tagesbremse.
// `better`: die feste Einheit in der Gruppe („adapt to“) oder die übliche Fassung („adaptive attack“), Wörterbuchform, sonst null. `why`: höchstens
// 15 Wörter in der Oberflächensprache, nennt richtiges Englisch nie falsch. Regeln nach der Lehrer-Gegenlesung (26.10.2026). Nie automatisch wiederholt.

export type LexicalUnitVars = { phrase: string; sentence: string; uiLang: UiLang };
export type LexicalUnitOut = { isUnit: boolean; better: string | null; why: string };

export const LEXICAL_UNIT_EXAMPLE = '{"isUnit":false,"better":"adaptive attack","why":"…"}';

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
      '- Judge the dictionary form: ignore inflection, articles and possessives ("adds up" = "add up", "punch above their weight" = "punch above one\'s weight").',
      '- isUnit: true if it is a collocation, phrasal verb, idiom, fixed frame or discourse marker ("that said", "it remains to be seen whether"), or an established technical or business term, including industry jargon (e.g. "audit trail", "retention period"). Not just grammatical.',
      '- better: only if isUnit is false. Either the fixed unit contained in the group ("adapt to" from "adapt to unfamiliar hardware") or the usual wording with the same meaning in this sentence ("adaptive attacks" for "adaptive attempts"). Dictionary form; plural only if the unit is normally plural ("billable hours"). Never invent a phrase; otherwise null.',
      '- why: max. 15 words in the explanation language. The phrase may be perfectly correct English: never call it wrong; say it is a free combination. Do not translate the word group.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
