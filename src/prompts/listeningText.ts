import { z } from 'zod';
import { clip, header } from './common';
import { britishCount, englishText, germanText, glossInText, glossSchema, QUESTION_RULES, questionsSchema, words, type CefrValue } from './inputCommon';
import type { PromptTemplate } from './types';

// listening-text@1 (Plan §5, Kap. 6.8): ein sprechbarer Hörtext im Altformat von `lpool/*`
// mit vier Verständnisfragen und fünf Wörtern zur Vorbereitung. Der Text wird von der
// Sprachausgabe vorgelesen – deshalb keine Überschriften, Listen, Sprechernamen oder Klammern.

export const LISTEN_GENRES = ['voicemail', 'briefing', 'podcast', 'news', 'announcement', 'update'] as const;
export type ListenGenre = (typeof LISTEN_GENRES)[number];

export type ListeningTextVars = {
  level: CefrValue;
  domain: 'work' | 'life';
  genre: ListenGenre;
  avoid: readonly string[];
  context: string;
};

export type ListeningTextOut = {
  title: string;
  genre: string;
  topic_de: string;
  topic_en: string;
  text: string;
  questions: Array<{ q: string; options: string[]; answer: string; type: 'gist' | 'detail' | 'inference'; explain_de: string; explain_en: string }>;
  vocab: Array<{ w: string; de: string; def: string }>;
};

export const LISTEN_WORDS = { min: 140, max: 360 } as const;

const ID = 'listening-text';
const VERSION = 1;

export const LISTENING_TEXT_EXAMPLE = JSON.stringify({
  title: 'A Quick Update Before the Client Call',
  genre: 'briefing',
  topic_de: 'Kurze Abstimmung vor dem Kundentermin',
  topic_en: 'A short sync before a client call',
  text: '<one spoken monologue, 170–300 words>',
  questions: [
    { q: 'What is the main purpose of the message?', options: ['<A>', '<B>', '<C>', '<D>'], answer: '<A>', type: 'gist', explain_de: '<German sentence>', explain_en: '<English sentence>' },
  ],
  vocab: [{ w: 'heads-up', de: 'Vorwarnung', def: 'a short warning so someone can prepare' }],
});

export const listeningTextShape = z.object({
  title: z.string(),
  genre: z.string(),
  topic_de: z.string(),
  topic_en: z.string(),
  text: z.string(),
  questions: z.array(z.object({ q: z.string(), options: z.array(z.string()), answer: z.string(), type: z.string(), explain_de: z.string(), explain_en: z.string() })),
  vocab: z.array(z.object({ w: z.string(), de: z.string(), def: z.string() })),
});

const schema: z.ZodType<ListeningTextOut> = z
  .object({
    title: englishText(3, 90),
    genre: z.enum(LISTEN_GENRES),
    topic_de: germanText(2, 80),
    topic_en: englishText(2, 80),
    text: englishText(200, 3000),
    questions: questionsSchema,
    vocab: glossSchema(5, 5),
  })
  .superRefine((v, ctx) => {
    const n = words(v.text);
    if (n < LISTEN_WORDS.min || n > LISTEN_WORDS.max) ctx.addIssue({ code: 'custom', path: ['text'], message: `must have 170–300 words (has ${n})` });
    if (/^\s*[A-Z][\w .'-]{0,30}:/m.test(v.text)) ctx.addIssue({ code: 'custom', path: ['text'], message: 'no speaker names or labels at the start of a line' });
    if (/[*#[\]()]/.test(v.text)) ctx.addIssue({ code: 'custom', path: ['text'], message: 'no markdown, headings, lists or brackets' });
    if (britishCount(v.text) > 2) ctx.addIssue({ code: 'custom', path: ['text'], message: 'use American spelling' });
    glossInText(v.vocab, v.text, ctx, 'vocab');
  });

export const listeningText: PromptTemplate<ListeningTextVars, ListeningTextOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(vars) {
    const avoid = vars.avoid.slice(0, 20).map((a) => clip(a, 80)).filter(Boolean);
    return [
      header({ id: ID, version: VERSION }),
      'You write a listening exercise for a German-speaking professional (CEFR B2, aiming for C1).',
      'The text will be read aloud by a text-to-speech voice (American English). Write natural spoken American English.',
      `Learner context: ${clip(vars.context, 1500) || '(none)'}`,
      `Target level: ${vars.level}`,
      `Domain: ${vars.domain === 'work' ? 'work life' : 'everyday life'}`,
      `Genre: ${vars.genre}`,
      avoid.length ? `Do not repeat these earlier texts: ${avoid.join(' | ')}` : 'Earlier texts: (none)',
      'Reply with only one JSON object, no other text, in exactly this shape (placeholders in <…> stand for real content):',
      LISTENING_TEXT_EXAMPLE,
      'Rules:',
      '- text: ONE speaker, 170–300 words, one or two paragraphs. No headings, no lists, no speaker names, no brackets,',
      '  no symbols; write numbers the way they are spoken where that helps (e.g. "two thirty").',
      '- genre: repeat the genre given above.',
      '- topic_de: the topic in German (short phrase); topic_en: the same in English.',
      '- vocab: exactly 5 words or phrases from the text (any inflection), each with de (German) and def (short English definition).',
      ...QUESTION_RULES,
    ].join('\n');
  },
  schema: () => schema,
};
