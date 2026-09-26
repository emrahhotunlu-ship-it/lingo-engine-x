import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// phrase-adapt@1 (Plan D9): passt die Wendungen eines Baukasten-Blatts an Emrahs konkrete
// Lage an – nur auf Wunsch („Auf meine Lage anpassen“). `quick`, nie zwischengespeichert.

export type PhraseAdaptVars = { question: string; phrases: readonly string[]; situation: string; uiLang: UiLang };
export type PhraseAdaptOut = { phrases: Array<{ en: string; de: string; def: string; ex: string; why: string }> };

export const PA_SITUATION_MAX = 300;

const ID = 'phrase-adapt';
const VERSION = 1;

const en = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

export function phraseAdaptSchema(uiLang: UiLang): z.ZodType<PhraseAdaptOut> {
  return z.object({
    phrases: z
      .array(
        z
          .object({ en: en(90), de: z.string().trim().min(1).max(120), def: en(160), ex: en(240), why: z.string().trim().min(1).max(200) })
          .superRefine((p, ctx) => {
            if (!containsPhrase(p.ex, p.en)) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'ex must contain en word for word' });
          })
          .superRefine(langOf(['why'], uiLang)),
      )
      .length(3),
  });
}

export function phraseAdaptExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    phrases: [
      { en: 'what we can offer instead is', de: 'was wir stattdessen anbieten können, ist', def: 'introduces an alternative offer', ex: 'What we can offer instead is a pilot with your finance team.', why: de ? 'Lenkt sofort auf eine Lösung.' : 'Moves straight to a solution.' },
      { en: 'I want to be upfront with you', de: 'ich möchte offen zu Ihnen sein', def: 'signals that you will speak honestly', ex: 'I want to be upfront with you about the timeline.', why: de ? 'Schafft Vertrauen vor der schlechten Nachricht.' : 'Builds trust before the bad news.' },
      { en: 'would it help if', de: 'würde es helfen, wenn', def: 'suggests an option as a question', ex: 'Would it help if we split the rollout into two phases?', why: de ? 'Macht aus dem Nein eine Frage.' : 'Turns the no into a question.' },
    ],
  });
}

export const phraseAdapt: PromptTemplate<PhraseAdaptVars, PhraseAdaptOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: false,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You help a German-speaking business professional (B2, aiming for C1) find the right words for a real situation.',
      `Situation type: ${clip(v.question, 160)}`,
      `Standard phrases: ${v.phrases.slice(0, 6).map((p) => clip(p, 80)).join(' | ')}`,
      `Their situation: ${clip(v.situation, PA_SITUATION_MAX)}`,
      `Explanation language (why): ${langName(v.uiLang)}. English in American English.`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      phraseAdaptExample(v.uiLang),
      'Rules:',
      '- exactly 3 phrases (2–10 words) adapted to their situation; ex = one example sentence for their situation that contains en word for word.',
      '- de = natural German translation; def = short English definition; why = one short reason why it fits.',
      "- Never invent facts about the learner's company.",
    ].join('\n');
  },
  schema: (v) => phraseAdaptSchema(v.uiLang),
};
