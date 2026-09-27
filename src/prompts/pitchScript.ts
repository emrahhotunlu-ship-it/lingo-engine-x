import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header } from './common';
import { intIn, phraseIn, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// pitch-script@2 (Plan §5.5): aus Folieninhalt eine Sprechfassung – Kernpunkte, Sätze mit
// markierten Überleitungen, Kernwendungen zum Mitnehmen. `default`, zwischengespeichert.

export type PitchScriptVars = { slide: string; audience: string; minutes: number; uiLang: UiLang };
export type PitchScriptOut = {
  points: string[];
  script: Array<{ en: string; signpost: boolean }>;
  keyPhrases: Array<{ en: string; de: string; def: string; ex: string }>;
  seconds: number;
};

export const PS_SLIDE_MAX = 1500;

const ID = 'pitch-script';
const VERSION = 2;

const en = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

export const pitchScriptSchema: z.ZodType<PitchScriptOut> = z.object({
  // Tolerant (Prüfhinweis): Listen gekappt, Sekunden gerundet, Wendung im Beispiel beugungstolerant.
  points: sliced(en(2, 120), 1, 8),
  script: sliced(z.object({ en: en(3, 300), signpost: z.boolean() }), 2, 20),
  keyPhrases: sliced(
    z.object({ en: en(2, 80), de: z.string().trim().min(1).max(120), def: en(3, 160), ex: en(5, 240) }).superRefine((p, ctx) => {
      if (!containsPhrase(p.ex, p.en) && !phraseIn(p.ex, p.en)) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'ex must contain en word for word' });
    }),
    0,
    5,
  ),
  seconds: intIn(20, 400),
});

export const PITCH_SCRIPT_EXAMPLE = JSON.stringify({
  points: ['Cloud archive for small businesses', 'Setup in one day', 'GDPR-compliant retention'],
  script: [
    { en: "Let me start with the problem we're solving.", signpost: true },
    { en: 'Small businesses still archive invoices on paper or in shared folders.', signpost: false },
    { en: 'Our cloud archive changes that in a single day of setup.', signpost: false },
    { en: 'To wrap up, retention rules are built in from day one.', signpost: true },
  ],
  keyPhrases: [{ en: 'built in from day one', de: 'von Anfang an eingebaut', def: 'included from the very start', ex: 'Retention rules are built in from day one.' }],
  seconds: 60,
});

export const pitchScript: PromptTemplate<PitchScriptVars, PitchScriptOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    const minutes = Math.min(5, Math.max(1, Math.round(v.minutes)));
    return [
      header({ id: ID, version: VERSION }),
      'You turn slide notes into a spoken script for a German-speaking professional (B2, aiming for C1) who will present in English.',
      `Audience: ${clip(v.audience, 40)}`,
      `Speaking time: ${minutes} minute(s)`,
      `Slide content: ${clip(v.slide, PS_SLIDE_MAX)}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      PITCH_SCRIPT_EXAMPLE,
      'Rules (all text in American English):',
      '- points: the 1–8 key points of the slide, short.',
      `- script: 2–20 spoken sentences for about ${minutes} minute(s); signpost = true for transitions ("Let me start with", "Moving on to", "To wrap up").`,
      '- keyPhrases: up to 5 reusable presentation phrases from the script; de = German; def = short English definition; ex contains en word for word.',
      '- seconds: estimated speaking time.',
      '- Keep facts from the slide; do not invent numbers.',
    ].join('\n');
  },
  schema: () => pitchScriptSchema,
};
