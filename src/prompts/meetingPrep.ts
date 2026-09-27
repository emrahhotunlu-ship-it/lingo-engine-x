import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { block, clip, fenced, header, langName } from './common';
import { englishText } from './inputCommon';
import { SCENE_GEN_EXAMPLE, sceneGenSchema, type SceneGenOut } from './sceneGen';
import { clipped, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// meeting-prep@1 (Lernberatung 27.09., V4 / Vorschlag 6 „Mein nächster Termin“): aus Emrahs
// eigener Beschreibung eines echten Termins eine 10-Minuten-Vorbereitung – 6–8 Schlüsselwendungen
// genau für diesen Termin (mit DE-Bedeutung und Beispielsatz = Ursprungssatz), die drei
// wahrscheinlichsten Einwände oder Fragen mit Antwortbausteinen und eine Generalprobe-Szene im
// Format von scene-gen@2 (so startet sie im vorhandenen Rollenspiel). `complex`, nie
// zwischengespeichert (jeder Termin ist neu). Die Anführungszeichen-Regel hängt das KI-Tor an.

export type MeetingPrepVars = {
  /** Emrahs Beruf (Kontext-Feld). */
  ctx: string;
  who: string;
  topic: string;
  tricky: string;
  notes: string;
  uiLang: UiLang;
};

export type MeetingPhraseOut = { en: string; de: string; def: string; example: string };
export type MeetingObjectionOut = { q: string; why: string; answers: string[] };
export type MeetingPrepOut = { phrases: MeetingPhraseOut[]; objections: MeetingObjectionOut[]; scene: SceneGenOut };

export const MP_CTX_MAX = 300;
export const MP_FIELD_MAX = { who: 120, topic: 300, tricky: 300, notes: 800 } as const;

const ID = 'meeting-prep';
const VERSION = 1;

export function meetingPrepExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  const scene = JSON.parse(SCENE_GEN_EXAMPLE) as unknown;
  return JSON.stringify({
    phrases: [
      { en: 'in return for', de: 'im Gegenzug für', def: 'as an exchange for something', example: 'We can offer a lower rate in return for a three-year commitment.' },
      { en: "I'd be open to", de: 'ich wäre offen für', def: 'willing to consider something', example: "I'd be open to a longer payment period if that helps your budget." },
    ],
    objections: [
      {
        q: 'Why should we commit for three years when the market changes so fast?',
        why: de ? 'Wer Rabatt will, scheut meist die lange Bindung.' : 'Someone who wants a discount usually avoids a long commitment.',
        answers: ['That is a fair point.', 'A longer term lets us lock in the price for you.', 'We can add an exit clause after year one.'],
      },
    ],
    scene,
  });
}

/** Wendung ohne sich selbst im Beispielsatz fällt weg (sie wäre eine Karte ohne Ursprungssatz). */
const inExample = (p: MeetingPhraseOut): boolean => containsPhrase(p.example, p.en);

export function meetingPrepSchema(vars: Pick<MeetingPrepVars, 'uiLang'>): z.ZodType<MeetingPrepOut> {
  const msg = `must be written in ${langName(vars.uiLang)}`;
  return z
    .object({
      phrases: sliced(z.object({ en: englishText(2, 80), de: clipped(1, 120), def: englishText(2, 160), example: englishText(8, 240) }), 4, 10)
        .transform((list) => list.filter(inExample).slice(0, 8))
        .pipe(z.array(z.object({ en: z.string(), de: z.string(), def: z.string(), example: z.string() })).min(4)),
      objections: sliced(z.object({ q: englishText(8, 240), why: clipped(1, 240), answers: sliced(englishText(2, 200), 1, 4) }), 1, 3),
      scene: sceneGenSchema,
    })
    .superRefine((v, ctx) => {
      v.objections.forEach((o, i) => {
        if (isWrongLang(o.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['objections', i, 'why'], message: msg });
      });
      v.phrases.forEach((p, i) => {
        if (isWrongLang(p.de, 'de')) ctx.addIssue({ code: 'custom', path: ['phrases', i, 'de'], message: 'must be written in German' });
      });
    });
}

export const meetingPrep: PromptTemplate<MeetingPrepVars, MeetingPrepOut> = {
  id: ID,
  version: VERSION,
  tier: 'complex',
  cache: false,
  build(v) {
    const meeting = [`With whom: ${clip(v.who, MP_FIELD_MAX.who)}`, `What it is about: ${clip(v.topic, MP_FIELD_MAX.topic)}`, `What is tricky: ${clip(v.tricky, MP_FIELD_MAX.tricky) || '(not given)'}`, 'Free notes:', block(v.notes, MP_FIELD_MAX.notes) || '(none)'].join('\n');
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English coach. Your learner is a German-speaking professional (B2, aiming for C1) with a REAL meeting coming up.',
      'He described it himself, partly in German. Build a 10-minute preparation for exactly this meeting.',
      `Learner's job: ${clip(v.ctx, MP_CTX_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'The meeting, as described by the learner:',
      fenced(meeting),
      'Reply with only one JSON object, no other text, exactly this shape:',
      meetingPrepExample(v.uiLang),
      'Rules:',
      '- American English for all English fields.',
      '- phrases: 6–8 key expressions (2–8 words) for exactly this meeting: opening, positioning, handling the tricky point, proposing, closing.',
      '  en = the expression, de = its German meaning, def = a short English definition, example = one natural sentence for this meeting that contains "en" word for word.',
      '- objections: the 3 most likely objections or questions from this counterpart, most likely first.',
      '  q = what the counterpart would actually say (English), why = one short sentence in the explanation language why it is likely,',
      '  answers = 2–3 short English answer building blocks (half sentences or sentences he can combine).',
      '- scene: a spoken dress rehearsal with exactly this counterpart, in the same shape and with the same rules as a scene-gen@2 scene:',
      '  English fields in American English, *_de fields in natural German, persona = this counterpart (a realistic name if none is given),',
      '  stake = what the counterpart wants, objection = the tricky point, opening = the counterpart\'s first line (1–3 sentences),',
      '  useful = 4–6 short phrases with German translations, level = B2, B2+ or C1.',
      '- Use only facts from the description and the job; never invent numbers, names of real companies or promises the learner did not mention.',
    ].join('\n');
  },
  schema: (vars) => meetingPrepSchema(vars),
};
