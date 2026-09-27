import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header } from './common';
import { countSentences, firstCefr, sliced } from './tolerant';
import type { PromptTemplate } from './types';

// scene-gen@2 (Plan §6.2, Kap. 2.5): neue Rollenspiel-Szene im Format der alten App, passend
// zu Emrahs Berufswelt, optional mit Wunsch, Grammatik-Fokus und fälligen Wörtern
// (kombinierte Aufgaben). `default`, nie zwischengespeichert (jedes „Erstellen“ ist neu).

export type SceneGenVars = {
  ctx: string;
  level: string;
  wish: string;
  grammar: string | null;
  words: readonly string[];
  existingTitles: readonly string[];
};

export type SceneGenOut = {
  title: string;
  title_de: string;
  situation: string;
  situation_de: string;
  goal: string;
  goal_de: string;
  persona: { name: string; role: string; org: string; traits: string };
  stake: string;
  objection: string;
  opening: string;
  useful: Array<{ en: string; de: string }>;
  level: string;
};

export const SG_CTX_MAX = 300;
export const SG_WISH_MAX = 200;

const ID = 'scene-gen';
const VERSION = 2;

const en = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });
const de = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !isWrongLang(s, 'de'), { message: 'must be written in German' });

const SCENE_LEVELS = ['B2', 'B2+', 'C1'] as const;

export const sceneGenSchema: z.ZodType<SceneGenOut> = z.object({
  title: en(4, 90),
  title_de: de(4, 90),
  situation: en(40, 700),
  situation_de: de(40, 800),
  goal: en(10, 200),
  goal_de: de(10, 220),
  persona: z.object({ name: z.string().trim().min(2).max(60), role: z.string().trim().min(2).max(80), org: en(3, 120), traits: en(10, 300) }),
  stake: en(10, 300),
  objection: en(10, 300),
  // Tolerant (Prüfhinweis): „Mr." und „2.5" beenden keinen Satz (Zählung wie beim E-Mail-Zerlegen).
  // Mehr als sechs Wendungen: die ersten sechs. „C1+" → C1.
  opening: en(10, 400).refine((s) => countSentences(s) <= 3, { message: 'opening: 1–3 sentences' }),
  useful: sliced(z.object({ en: en(2, 60), de: z.string().trim().min(2).max(80) }), 4, 6),
  level: z.preprocess((l) => firstCefr(l, SCENE_LEVELS), z.enum(SCENE_LEVELS)),
});

export const SCENE_GEN_EXAMPLE = JSON.stringify({
  title: 'Renegotiating the support contract',
  title_de: 'Den Supportvertrag neu verhandeln',
  situation: 'Your largest reseller wants to cut the support fee by a third after two slow ticket responses last quarter. Their head of operations has asked for a call before the renewal deadline on Friday.',
  situation_de: 'Euer größter Vertriebspartner will die Supportgebühr um ein Drittel senken, weil im letzten Quartal zwei Tickets langsam bearbeitet wurden. Sein Leiter Operations hat vor der Verlängerungsfrist am Freitag um ein Gespräch gebeten.',
  goal: 'Keep the fee and offer a concrete service improvement instead.',
  goal_de: 'Die Gebühr halten und stattdessen eine konkrete Verbesserung anbieten.',
  persona: { name: 'Sandra Whitfield', role: 'Head of Operations', org: 'a regional IT reseller', traits: 'Friendly but tough, keeps a list of every missed deadline and quotes it.' },
  stake: 'She needs a visible saving to show her management.',
  objection: 'She thinks your support team is understaffed and the fee pays for nothing.',
  opening: 'Thanks for making time. I will be honest with you: my team is asking why we pay premium rates for standard response times.',
  useful: [
    { en: 'I hear you', de: 'Ich verstehe Sie' },
    { en: 'what I can offer is', de: 'was ich anbieten kann, ist' },
    { en: 'in return for', de: 'im Gegenzug für' },
    { en: 'let me put that in context', de: 'lassen Sie mich das einordnen' },
  ],
  level: 'C1',
});

export const sceneGen: PromptTemplate<SceneGenVars, SceneGenOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You design one spoken business role-play for a German-speaking professional (B2, aiming for C1).',
      `Learner's job: ${clip(v.ctx, SG_CTX_MAX)}`,
      `Level: ${clip(v.level, 10) || 'C1'}`,
      `Learner wish: ${clip(v.wish, SG_WISH_MAX) || '(none – choose a realistic, demanding situation from their job)'}`,
      `Grammar focus to make natural in the scene: ${v.grammar ? clip(v.grammar, 80) : '(none)'}`,
      `Words the learner should get a chance to use: ${v.words.slice(0, 8).map((w) => clip(w, 40)).join(', ') || '(none)'}`,
      `Avoid these existing scene titles: ${v.existingTitles.slice(0, 30).map((t) => clip(t, 80)).join(' | ') || '(none)'}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      SCENE_GEN_EXAMPLE,
      'Rules:',
      '- English fields in American English; the *_de fields in natural German.',
      '- persona: a realistic counterpart with a name, role, organization type (no real company names except those in the learner job) and traits that create pressure.',
      '- stake: what the counterpart wants; objection: the doubt the learner must overcome.',
      '- opening: the counterpart\'s first spoken line, 1–3 sentences, direct and in character.',
      '- useful: 4–6 short phrases (2–8 words) that help in this scene, with German translations.',
      '- level: B2, B2+ or C1.',
      '- Never invent facts about the learner\'s own company beyond the job description.',
    ].join('\n');
  },
  schema: () => sceneGenSchema,
};
