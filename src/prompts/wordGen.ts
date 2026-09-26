import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header } from './common';
import type { PromptTemplate } from './types';

// word-gen@1 (Funktionsabgleich M2): neue Wörter auf Knopfdruck – „Neue Wörter von Claude"
// (allgemein, B2–C1) und „Fachwörter für meinen Beruf" – sowie das Ergänzen eines selbst
// eingegebenen Worts (Bedeutung, Wortart, Beispielsatz). Nie im Hintergrund (sample.d.ts).
// Jede Karte bekommt einen Beispielsatz mit dem Wort (Kap. 15: keine Karte ohne Ursprungssatz).
// `de` ist Deutsch, `def` Englisch – in beiden Oberflächensprachen gleich gespeichert wie bisher.

export type WordGenMode = 'general' | 'job' | 'fill';
export type WordGenVars = {
  mode: WordGenMode;
  count: number;
  /** Bekannte Wörter (≤ 200), die nicht vorkommen dürfen. */
  known: readonly string[];
  /** Nur bei `fill`: das Wort, das ergänzt werden soll. */
  word?: string;
};
export type GenWord = { word: string; pos: string; de: string; def: string; ex: string; level: string };
export type WordGenOut = { words: GenWord[] };

export const GEN_KNOWN_MAX = 200;
export const GEN_WORD_MAX = 60;

export const WORD_GEN_EXAMPLE =
  '{"words":[{"word":"stakeholder","pos":"noun","de":"Interessengruppe, Beteiligte(r)","def":"a person or group with an interest in a project or business","ex":"We invited every stakeholder to the kickoff meeting on Monday.","level":"B2"}]}';

const ID = 'word-gen';
const VERSION = 1;

const core = (w: string) =>
  w
    .replace(/^to\s+/i, '')
    .replace(/\b(something|someone|sth|sb)\b/gi, '')
    .trim()
    .toLowerCase();
const stem = (w: string) => w.replace(/(ies|es|s|ed|ing|e|y)$/, '');

const wordSchema = z
  .object({
    word: z.string().trim().min(1).max(GEN_WORD_MAX),
    pos: z.string().trim().min(1).max(20),
    de: z.string().trim().min(1).max(120),
    def: z.string().trim().min(3).max(200),
    ex: z.string().trim().min(12).max(220),
    level: z.enum(['B1', 'B2', 'C1', 'C2']),
  })
  .superRefine((w, ctx) => {
    const first = stem(core(w.word).split(' ')[0] ?? '');
    if (first && !w.ex.toLowerCase().includes(first)) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'the example must contain the word' });
    if (isWrongLang(w.ex, 'en')) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'must be written in English' });
    if (isWrongLang(w.def, 'en')) ctx.addIssue({ code: 'custom', path: ['def'], message: 'must be written in English' });
  });

const schemaFor = (v: WordGenVars): z.ZodType<WordGenOut> =>
  z.object({ words: z.array(wordSchema).min(1).max(Math.max(1, v.count) + 2) }).superRefine((out, ctx) => {
    if (v.mode === 'fill' && v.word && core(out.words[0]?.word ?? '') !== core(v.word)) {
      ctx.addIssue({ code: 'custom', path: ['words', 0, 'word'], message: `must be exactly "${v.word}"` });
    }
  });

export const wordGen: PromptTemplate<WordGenVars, WordGenOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const known = v.known.slice(0, GEN_KNOWN_MAX).map((k) => clip(k, 40));
    const task =
      v.mode === 'fill'
        ? `Complete the card for the word: ${clip(v.word ?? '', GEN_WORD_MAX)} (exactly this word, 1 item).`
        : v.mode === 'job'
          ? `Suggest ${v.count} useful words or fixed phrases for the learner's job (B2–C1): business development and sales of cloud software for documents and processes (DMS/ECM), meetings with partners and customers.`
          : `Suggest ${v.count} useful general words or fixed phrases at B2–C1 level for everyday and work conversations.`;
    return [
      header({ id: ID, version: VERSION }),
      'You create vocabulary cards for ONE learner: German native speaker, English level B2 aiming for C1, head of business development at a German DMS/ECM cloud vendor.',
      'American English only (US spelling). Invented names only, never facts about a real company.',
      task,
      `Mode: ${v.mode}`,
      `Do not suggest: ${known.join(', ') || '(none)'}`,
      'Reply with only one JSON object of this shape (one item shown):',
      WORD_GEN_EXAMPLE,
      'Rules:',
      '- word: base form (verbs without "to"), or a fixed phrase. pos: noun, verb, adjective, adverb, phrase or phrasal verb.',
      '- de: short German translation(s), comma-separated. def: short English definition.',
      '- ex: one natural sentence (10–18 words) that contains the word; work or everyday context.',
      '- level: CEFR level of the word.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
