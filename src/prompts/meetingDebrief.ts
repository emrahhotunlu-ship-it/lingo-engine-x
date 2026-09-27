import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { block, clip, fenced, header, langName } from './common';
import { englishText } from './inputCommon';
import { clipped, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// meeting-debrief@1 (Lernberatung 27.09., V4 / Vorschlag 6): Nachbesprechung eines echten Termins.
// Emrah schreibt frei (auch auf Deutsch), was er sagen wollte und nicht konnte. Claude liefert je
// Punkt die beste englische Formulierung und die Kernwendung darin (mit DE-Bedeutung und kurzer
// Definition) – daraus werden sofort Wendungen mit Ursprungssatz. `default`, zwischengespeichert.

export type MeetingDebriefVars = { who: string; topic: string; want: string; uiLang: UiLang };

export type DebriefItemOut = { want: string; en: string; phrase: string; de: string; def: string; why: string };
export type MeetingDebriefOut = { items: DebriefItemOut[] };

export const MD_WANT_MAX = 600;

const ID = 'meeting-debrief';
const VERSION = 1;

export function meetingDebriefExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    items: [
      {
        want: de ? 'Höflich sagen, dass der Rabatt nur mit längerer Laufzeit geht.' : 'Say politely that the discount only works with a longer term.',
        en: "I'm happy to look at the price, but only in return for a longer commitment.",
        phrase: 'in return for',
        de: 'im Gegenzug für',
        def: 'as an exchange for something',
        why: de ? 'Verknüpft Zugeständnis und Gegenleistung, ohne hart zu klingen.' : 'Links a concession to something in return without sounding harsh.',
      },
    ],
  });
}

/** Die Kernwendung muss wörtlich im Satz stehen, sonst bleibt nur der Satz (keine Wendung ohne Ursprungssatz). */
function tidy(i: DebriefItemOut): DebriefItemOut {
  const ok = i.phrase && i.de && i.def && containsPhrase(i.en, i.phrase) && !isWrongLang(i.def, 'en');
  return ok ? i : { ...i, phrase: '', de: '', def: '' };
}

export function meetingDebriefSchema(vars: Pick<MeetingDebriefVars, 'uiLang'>): z.ZodType<MeetingDebriefOut> {
  const opt = (max: number) => z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().trim().max(max));
  const msg = `must be written in ${langName(vars.uiLang)}`;
  return z
    .object({
      items: sliced(z.object({ want: clipped(1, 240), en: englishText(3, 300), phrase: opt(80), de: opt(120), def: opt(160), why: clipped(1, 240) }).transform(tidy), 1, 5),
    })
    .superRefine((v, ctx) => {
      v.items.forEach((it, i) => {
        if (isWrongLang(it.want, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['items', i, 'want'], message: msg });
        if (isWrongLang(it.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['items', i, 'why'], message: msg });
      });
    });
}

export const meetingDebrief: PromptTemplate<MeetingDebriefVars, MeetingDebriefOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English coach. Your German-speaking learner (B2, aiming for C1) just had a real meeting.',
      'He wrote down what he wanted to say but could not say in English – partly in German, partly in broken English.',
      `Meeting with: ${clip(v.who, 120)}`,
      `Topic: ${clip(v.topic, 300)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'What he wanted to say:',
      fenced(block(v.want, MD_WANT_MAX)),
      'Reply with only one JSON object, no other text, exactly this shape:',
      meetingDebriefExample(v.uiLang),
      'Rules:',
      '- items: one item per point he wanted to make (1–5, in his order). Do not add points he did not mention.',
      '- want = his point restated in one short sentence in the explanation language.',
      '- en = the best way to say it in this meeting: one natural, polite American English sentence at C1 level.',
      '- phrase = the key expression (2–8 words) that appears word for word in "en", de = its German meaning, def = a short English definition.',
      '- why = one short sentence in the explanation language why this wording works.',
    ].join('\n');
  },
  schema: (vars) => meetingDebriefSchema(vars),
};
