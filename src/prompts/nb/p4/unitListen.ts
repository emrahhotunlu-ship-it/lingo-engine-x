import { z } from 'zod';
import { clip, header } from '../../common';
import { britishCount, englishText, germanText, words } from '../../inputCommon';
import { hasSpeakerLabels } from '../../listeningText';
import { intIn } from '../../tolerant';
import type { PromptTemplate } from '../../types';

// unit-listen@1 (Neubau N53, Prüfung Tageseinheit M7, M9, S1): der Hörtext für Block 2 der
// Tageseinheit – zum Wochenthema (Di) oder als kurzer Dialog (Do), 150–180 Wörter (60–75 s).
// Format wie ein Themen-Text (P7a): Kernfrage und Frage „zwischen den Zeilen“ mit wörtlicher
// Belegstelle und Grund in beiden Sprachen, 2–3 Wendungen zum Merken, 3 Sätze zum Nachsprechen.
// Erzeugt wird nur nach „Los“ auf der Tageskarte, im Hintergrund während Block 1.

export type UnitListenVars = {
  level: string;
  kind: 'theme' | 'dialog';
  domain: 'work' | 'life';
  themeTitle: string;
  themeTask: string;
  phrases: readonly string[];
  context: string;
};

export type UnitListenQuestion = { q_de: string; q_en: string; options: string[]; answer: number; quote: string; why_de: string; why_en: string };

export type UnitListenOut = {
  title: string;
  text: string;
  core: UnitListenQuestion;
  between: UnitListenQuestion;
  notice: string[];
  shadow: string[];
};

const ID = 'unit-listen';
const VERSION = 1;

/** Toleranz um die erbetenen 150–180 Wörter. */
export const UNIT_LISTEN_WORDS = { min: 110, max: 240 } as const;

const EXAMPLE = JSON.stringify({
  title: 'A quick call before the demo',
  text: '<spoken text, 150–180 words>',
  core: { q_de: '<Frage auf Deutsch>', q_en: '<the same question in English>', options: ['<A>', '<B>', '<C>', '<D>'], answer: 0, quote: '<exact words copied from the text>', why_de: '<ein Satz>', why_en: '<one sentence>' },
  between: { q_de: '<…>', q_en: '<…>', options: ['<A>', '<B>', '<C>', '<D>'], answer: 2, quote: '<exact words from the text>', why_de: '<…>', why_en: '<…>' },
  notice: ['<phrase from the text>', '<phrase from the text>'],
  shadow: ['<sentence from the text>', '<sentence from the text>', '<sentence from the text>'],
});

const low = (s: string): string => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Antwort als Index, Buchstabe oder Optionstext → Index. */
function answerIndex(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const q = raw as Record<string, unknown>;
  const options = Array.isArray(q.options) ? (q.options as unknown[]).map((o) => (typeof o === 'string' ? o : '')) : [];
  const a = q.answer;
  if (typeof a === 'string') {
    const t = a.trim();
    const byText = options.findIndex((o) => low(o) === low(t));
    if (byText >= 0) return { ...q, answer: byText };
    const letter = /^\(?([A-Da-d])\)?$/.exec(t)?.[1];
    if (letter) return { ...q, answer: letter.toLowerCase().charCodeAt(0) - 97 };
  }
  return raw;
}

const question = z.preprocess(
  answerIndex,
  z
    .object({
      q_de: germanText(6, 220),
      q_en: englishText(6, 220),
      options: z.array(englishText(1, 160)).min(3).max(4),
      answer: intIn(0, 3),
      quote: z.string().trim().min(3).max(300),
      why_de: germanText(6, 300),
      why_en: englishText(6, 300),
    })
    .superRefine((q, ctx) => {
      if (q.answer >= q.options.length) ctx.addIssue({ code: 'custom', path: ['answer'], message: 'answer must be the index of one option' });
    }),
);

/** Nur Wendungen bzw. Sätze, die wörtlich im Text stehen (der Rest fällt weg statt abzulehnen). */
const inText = (text: string, list: unknown): string[] =>
  (Array.isArray(list) ? list : []).filter((x): x is string => typeof x === 'string' && !!x.trim() && low(text).includes(low(x).replace(/[.!?]+$/, ''))).map((x) => x.trim());

const schema = (): z.ZodType<UnitListenOut> =>
  z
    .preprocess(
      (raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
        const o = raw as Record<string, unknown>;
        const text = typeof o.text === 'string' ? o.text : '';
        return { ...o, notice: inText(text, o.notice).slice(0, 3), shadow: inText(text, o.shadow).slice(0, 3) };
      },
      z.object({
        title: englishText(3, 90),
        text: englishText(200, 2000),
        core: question,
        between: question,
        notice: z.array(z.string()).min(2).max(3),
        shadow: z.array(z.string()).min(2).max(3),
      }),
    )
    .superRefine((v, ctx) => {
      const n = words(v.text);
      if (n < UNIT_LISTEN_WORDS.min || n > UNIT_LISTEN_WORDS.max) ctx.addIssue({ code: 'custom', path: ['text'], message: `must have 150–180 words (has ${n})` });
      if (hasSpeakerLabels(v.text)) ctx.addIssue({ code: 'custom', path: ['text'], message: 'no speaker names or labels at the start of a line' });
      if (/[*#[\]()]/.test(v.text)) ctx.addIssue({ code: 'custom', path: ['text'], message: 'no markdown, headings, lists or brackets' });
      if (britishCount(v.text) > 2) ctx.addIssue({ code: 'custom', path: ['text'], message: 'use American spelling' });
    });

export const unitListen: PromptTemplate<UnitListenVars, UnitListenOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(vars) {
    const phrases = vars.phrases.slice(0, 5).map((p) => clip(p, 80));
    return [
      header({ id: ID, version: VERSION }),
      'You write a short listening text for a German-speaking professional (CEFR B2, aiming for C1).',
      'A text-to-speech voice (American English) reads it aloud. Write natural spoken American English.',
      `Learner context: ${clip(vars.context, 1200) || '(none)'}`,
      `Target level: ${vars.level}. At most 5 % of the words may be above this level.`,
      `Topic of the week: ${clip(vars.themeTitle, 120)} (${clip(vars.themeTask, 200)})`,
      `Domain: ${vars.domain === 'work' ? 'work life' : 'everyday life'}`,
      vars.kind === 'dialog'
        ? 'Form: a short phone call or meeting excerpt between two people. Each turn is its own paragraph. Never start a line with a name or label; make clear who speaks through the words ("Thanks, Maria.").'
        : 'Form: one speaker (a voicemail, a briefing or part of a call).',
      phrases.length ? `Use at least 3 of these phrases naturally, word for word: ${phrases.join(' | ')}` : '',
      'Reply with only one JSON object, no other text, in exactly this shape (placeholders in <…> stand for real content):',
      EXAMPLE,
      'Rules:',
      '- text: 150–180 words (about 60–75 seconds). No headings, lists, brackets or symbols.',
      '- core: one question about the main point. between: one question "between the lines" (an attitude or intention that is only implied).',
      '- Each question: 4 short English options, answer = index (0–3) of the correct one, quote = the exact words from the text that prove it,',
      '  why_de / why_en = one sentence explaining the answer in German / English.',
      '- notice: 2–3 useful phrases copied word for word from the text. shadow: 3 short sentences (6–18 words) copied word for word from the text.',
    ]
      .filter(Boolean)
      .join('\n');
  },
  schema: () => schema(),
};
