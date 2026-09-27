import { z } from 'zod';
import { block, clip, fenced, header } from './common';
import { britishCount, englishText, germanText, glossInText, glossSchema, paras, QUESTION_RULES, questionsSchema, words, type CefrValue } from './inputCommon';
import type { PromptTemplate } from './types';

// reading-text@1 (Plan §5, Kap. 6.8): ein Lesetext knapp über Emrahs Niveau (i+1) mit
// Kernaussagen, Glossar und vier Verständnisfragen. Zwei Arten (M16):
// - „erzeugen": Claude schreibt den Text selbst (Thema aus den Themen-Chips, M12),
// - „aus Text": Emrah hat einen eigenen Text eingefügt; Claude liefert nur Titel, Kernaussagen,
//   Glossar und Fragen dazu – der Text selbst bleibt unverändert (kein `text` in der Antwort).
// `default`, `cache: false` („Neuen Text erzeugen" soll wirklich Neues liefern, sample.d.ts).

export type ReadingTextVars = {
  level: CefrValue;
  domain: 'work' | 'life';
  /** Themenwunsch (Chip) oder '' für „Überrasch mich". */
  topicHint: string;
  /** Titel bisheriger Texte, die sich nicht wiederholen sollen. */
  avoid: readonly string[];
  /** Berufskontext (ohne persönliche Daten). */
  context: string;
  /** Eigener Text (M16) – dann nur Aufbereitung, kein neuer Text. */
  sourceText?: string;
};

export type ReadingTextOut = {
  title: string;
  topic: string;
  topic_de: string;
  topic_en: string;
  teaser: string;
  text?: string;
  keypoints: string[];
  glossary: Array<{ w: string; de: string; def: string }>;
  questions: Array<{ q: string; options: string[]; answer: string; type: 'gist' | 'detail' | 'inference'; explain_de: string; explain_en: string }>;
};

export const TOPIC_HINT_MAX = 80;
export const AVOID_MAX = 20;
export const CONTEXT_MAX = 1500;
export const SOURCE_TEXT_MAX = 8000;
export const TEXT_WORDS = { min: 300, max: 800 } as const;

const ID = 'reading-text';
const VERSION = 1;

/** Aufbau-Beispiel im Prompt (lange Felder als Platzhalter; der Test prüft es gegen `readingTextShape`). */
export const READING_TEXT_EXAMPLE = JSON.stringify({
  title: 'Why Small Firms Are Moving Their Archives to the Cloud',
  topic: 'business',
  topic_de: 'Cloud-Archive für kleine Firmen',
  topic_en: 'Cloud archives for small firms',
  teaser: 'Paper archives are expensive and risky, so more small companies are switching.',
  text: '<paragraph 1>\n\n<paragraph 2>\n\n<paragraph 3>\n\n<paragraph 4>',
  keypoints: ['<key point 1>', '<key point 2>', '<key point 3>', '<key point 4>'],
  glossary: [{ w: 'retention period', de: 'Aufbewahrungsfrist', def: 'how long documents must legally be kept' }],
  questions: [
    { q: 'What is the main idea of the text?', options: ['<A>', '<B>', '<C>', '<D>'], answer: '<B>', type: 'gist', explain_de: '<German sentence>', explain_en: '<English sentence>' },
  ],
});

/** Nur der Aufbau (Typen und Felder), ohne Längen- und Sprachregeln – dafür gilt das Beispiel. */
export const readingTextShape = z.object({
  title: z.string(),
  topic: z.string(),
  topic_de: z.string(),
  topic_en: z.string(),
  teaser: z.string(),
  text: z.string().optional(),
  keypoints: z.array(z.string()),
  glossary: z.array(z.object({ w: z.string(), de: z.string(), def: z.string() })),
  questions: z.array(z.object({ q: z.string(), options: z.array(z.string()), answer: z.string(), type: z.string(), explain_de: z.string(), explain_en: z.string() })),
});

const base = {
  title: englishText(3, 90),
  topic: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z][a-z-]{1,29}$/),
  topic_de: germanText(2, 80),
  topic_en: englishText(2, 80),
  teaser: englishText(10, 200),
  keypoints: z.array(englishText(10, 220)).min(4).max(6),
  glossary: glossSchema(6, 10),
  questions: questionsSchema,
};

function schemaFor(vars: ReadingTextVars): z.ZodType<ReadingTextOut> {
  const own = !!vars.sourceText?.trim();
  if (own) {
    const source = vars.sourceText ?? '';
    return z.object(base).superRefine((v, ctx) => glossInText(v.glossary, source, ctx, 'glossary'));
  }
  return z
    .object({ ...base, text: englishText(200, 7000) })
    .superRefine((v, ctx) => {
      const n = words(v.text);
      if (n < TEXT_WORDS.min || n > TEXT_WORDS.max) ctx.addIssue({ code: 'custom', path: ['text'], message: `must have 380–650 words (has ${n})` });
      const p = paras(v.text).length;
      if (p < 3 || p > 8) ctx.addIssue({ code: 'custom', path: ['text'], message: `must have 4–7 paragraphs separated by a blank line (has ${p})` });
      if (britishCount(v.text) > 2) ctx.addIssue({ code: 'custom', path: ['text'], message: 'use American spelling (color, organize, center, traveled)' });
      glossInText(v.glossary, v.text, ctx, 'glossary');
    });
}

export const readingText: PromptTemplate<ReadingTextVars, ReadingTextOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(vars) {
    const own = vars.sourceText?.trim();
    const avoid = vars.avoid.slice(0, AVOID_MAX).map((a) => clip(a, 80)).filter(Boolean);
    const lines = [
      header({ id: ID, version: VERSION }),
      'You prepare a reading lesson for a German-speaking professional (CEFR B2, aiming for C1).',
      'American English is the standard: US spelling and US vocabulary in everything you write.',
      `Learner context: ${clip(vars.context, CONTEXT_MAX) || '(none)'}`,
      `Target level: ${vars.level} (slightly above the learner's current level)`,
    ];
    if (own) {
      lines.push(
        'Mode: FROM TEXT. The learner pasted the text below. Do NOT rewrite it and do NOT return a "text" field.',
        'Write title, topic, teaser, key points, glossary and questions for exactly this text.',
        fenced(block(own, SOURCE_TEXT_MAX)),
      );
    } else {
      lines.push(
        `Domain: ${vars.domain === 'work' ? 'work life (business, technology, the workplace)' : 'everyday life (culture, travel, science, sports, society)'}`,
        `Topic wish: ${clip(vars.topicHint, TOPIC_HINT_MAX) || 'surprise me – pick something interesting and current-sounding'}`,
        avoid.length ? `Do not repeat these earlier texts: ${avoid.join(' | ')}` : 'Earlier texts: (none)',
      );
    }
    lines.push(
      'Reply with only one JSON object, no other text, in exactly this shape (placeholders in <…> stand for real content):',
      READING_TEXT_EXAMPLE,
      'Rules:',
      own ? '- Leave out "text" entirely.' : '- text: an original magazine-style article, 380–650 words, 4–7 paragraphs separated by a blank line (\\n\\n), no headings, no lists, no markdown.',
      '- title ≤ 90 characters; teaser: one sentence ≤ 200 characters; topic: one lowercase English slug (e.g. business, tech, sports, travel, science, film).',
      '- topic_de: the topic in German (short phrase); topic_en: the same in English.',
      '- keypoints: 4–6 short English sentences, each one key statement of the text.',
      '- glossary: 6–10 useful words or phrases that appear in the text exactly (any inflection), each with de (German translation) and def (short English definition).',
      ...QUESTION_RULES,
    );
    return lines.join('\n');
  },
  schema: (vars) => schemaFor(vars),
};
