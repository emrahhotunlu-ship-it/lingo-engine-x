import { z } from 'zod';
import { clip, fenced, header } from './common';
import { englishText, germanText, type CefrValue } from './inputCommon';
import { firstCefr, sliced } from './tolerant';
import type { PromptTemplate } from './types';

// writing-prompt@2 (Plan §5, M12): eine neue Schreibaufgabe im Altformat von `wprompt/<tag>.p`.
// „Andere Aufgabe" oder „Eigenes Thema" (Freitext ≤ 120 Zeichen). `quick`, `cache: false`.

export const WRITE_GENRES = ['email', 'proposal', 'summary', 'report', 'message', 'opinion', 'complaint', 'story'] as const;
export type WriteGenre = (typeof WRITE_GENRES)[number];

export type WritingPromptVars = {
  level: CefrValue;
  domain: 'work' | 'life';
  genre: WriteGenre;
  avoid: readonly string[];
  context: string;
  /** Eigenes Thema (M12), sonst ''. */
  ownTopic: string;
};

export type WritingPromptOut = {
  genre: WriteGenre;
  level: CefrValue;
  title_de: string;
  title_en: string;
  task_en: string;
  task_de: string;
  words: [number, number];
  focus_de: string;
  focus_en: string;
  useful: string[];
};

export const OWN_TOPIC_MAX = 120;

const ID = 'writing-prompt';
const VERSION = 2;

export const WRITING_PROMPT_EXAMPLE = JSON.stringify({
  genre: 'email',
  level: 'B2+',
  title_de: 'Einen Termin verschieben',
  title_en: 'Moving a meeting',
  task_en: 'Write a short email to a partner to move next week’s meeting. Explain why, suggest two new times and keep the tone friendly.',
  task_de: 'Schreibe eine kurze E-Mail an einen Partner, um das Treffen nächste Woche zu verschieben. Nenne den Grund, schlage zwei neue Termine vor und bleib freundlich.',
  words: [80, 130],
  focus_de: 'Nutze höfliche Formulierungen für Bitten, z. B. „Would it be possible to …“.',
  focus_en: 'Use polite phrases for requests, e.g. "Would it be possible to …".',
  useful: ['I’m afraid I need to…', 'Would it be possible to…', 'I’d suggest…', 'Please let me know what works for you.'],
});

const LEVELS = ['B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+'] as const;
const GENRE_ALIASES: Readonly<Record<string, WriteGenre>> = { 'e-mail': 'email', mail: 'email', letter: 'email', memo: 'message', note: 'message', essay: 'opinion', review: 'opinion', narrative: 'story' };

/**
 * Umfang tolerant (Prüfhinweis): Zahlen auch als Text, auch `{min, max}`, gerundet. Die Grenzen
 * (60 ≤ min < max ≤ 220, mindestens 30 auseinander) prüft weiterhin das Schema.
 */
export function wordRange(v: unknown): unknown {
  const pair = Array.isArray(v) ? v : v && typeof v === 'object' ? [(v as Record<string, unknown>).min, (v as Record<string, unknown>).max] : v;
  if (!Array.isArray(pair) || pair.length !== 2) return v;
  const nums = (pair as unknown[]).map((x) => (typeof x === 'string' && x.trim() !== '' ? Number(x.trim()) : x));
  if (!nums.every((x): x is number => typeof x === 'number' && Number.isFinite(x))) return v;
  return nums.map((x) => Math.round(x));
}

const schemaFor = (vars: Pick<WritingPromptVars, 'genre'>): z.ZodType<WritingPromptOut> =>
  z
    .object({
      // Groß geschrieben, „letter" → email, sonst Unbekanntes → die bestellte Gattung.
      genre: z.preprocess((g) => {
        const s = typeof g === 'string' ? g.trim().toLowerCase() : '';
        return (WRITE_GENRES as readonly string[]).includes(s) ? s : (GENRE_ALIASES[s] ?? vars.genre);
      }, z.enum(WRITE_GENRES)),
      level: z.preprocess((l) => firstCefr(l, LEVELS), z.enum(LEVELS)),
      title_de: germanText(3, 80),
      title_en: englishText(3, 80),
      task_en: englishText(20, 600),
      task_de: germanText(20, 600),
      words: z.preprocess(wordRange, z.tuple([z.number().int(), z.number().int()])),
      focus_de: germanText(5, 300),
      focus_en: englishText(5, 300),
      useful: sliced(englishText(2, 80), 4, 6),
    })
    .superRefine((v, ctx) => {
      const [min, max] = v.words;
      if (!(min >= 60 && min < max && max <= 220 && max - min >= 30)) ctx.addIssue({ code: 'custom', path: ['words'], message: 'words must be [min, max] with 60 ≤ min < max ≤ 220 and max − min ≥ 30' });
    });

export const writingPrompt: PromptTemplate<WritingPromptVars, WritingPromptOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: false,
  build(vars) {
    const avoid = vars.avoid.slice(0, 20).map((a) => clip(a, 80)).filter(Boolean);
    const own = clip(vars.ownTopic, OWN_TOPIC_MAX);
    return [
      header({ id: ID, version: VERSION }),
      'You create one writing task for a German-speaking professional (CEFR B2, aiming for C1).',
      'American English is the standard for all English fields.',
      `Learner context: ${clip(vars.context, 1500) || '(none)'}`,
      `Target level: ${vars.level}`,
      own ? 'Topic: the learner chose the topic below. Build a realistic task around it.' : `Domain: ${vars.domain === 'work' ? 'work life' : 'everyday life'}`,
      own ? fenced(own) : `Genre: ${vars.genre}`,
      avoid.length ? `Do not repeat these earlier tasks: ${avoid.join(' | ')}` : 'Earlier tasks: (none)',
      'Reply with only one JSON object, no other text, exactly this shape:',
      WRITING_PROMPT_EXAMPLE,
      'Rules:',
      `- genre: one of ${WRITE_GENRES.join(', ')}${own ? ' (the one that fits the topic best)' : ' (use the genre given above)'}.`,
      '- title_de/task_de/focus_de in German, title_en/task_en/focus_en in English; both say the same.',
      '- words: [min, max] target length, 60 ≤ min < max ≤ 220, at least 30 apart.',
      '- focus: one concrete language goal for this text.',
      '- useful: 4–6 English phrases that fit the task; mark open ends with "…".',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars),
};
