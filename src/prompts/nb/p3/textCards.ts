import { z } from 'zod';
import { isWrongLang } from '../../../domain/lang/detect';
import { block, fenced, header, lenientArray } from '../../common';
import type { PromptTemplate } from '../../types';
import { exampleHasWord } from '../../wordGen';

// text-cards@1 (plan.md N34, Soll): „Aus Text“ – 5–15 Kartenvorschläge aus einem eingefügten
// englischen Text, jeweils mit dem Satz aus dem Text als Ursprungssatz (Kap. 15). Nur auf
// Knopfdruck (sample.d.ts), nie im Hintergrund. Die Anführungszeichen-Regel hängt das KI-Tor an.

export type TextCardsVars = { text: string; known: readonly string[] };
export type TextCard = { word: string; pos: string; de: string; def: string; ex: string };
export type TextCardsOut = { cards: TextCard[] };

const ID = 'text-cards';
const VERSION = 1;
export const TEXT_CARDS_MIN = 5;
export const TEXT_CARDS_MAX = 15;
export const TEXT_MAX_CHARS = 6000;

const EXAMPLE = '{"cards":[{"word":"phase out","pos":"phrasal verb","de":"auslaufen lassen","def":"to stop using something gradually","ex":"The vendor will phase out legacy fees next year."}]}';

const norm = (s: string) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

const cardSchema = (text: string) =>
  z
    .object({
      word: z.string().trim().min(1).max(60),
      pos: z.string().trim().min(1).max(20),
      de: z.string().trim().min(1).max(120),
      def: z.string().trim().min(3).max(200),
      ex: z.string().trim().min(8).max(300),
    })
    .superRefine((c, ctx) => {
      if (!exampleHasWord(c.ex, c.word)) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'the sentence must contain the word' });
      if (!norm(text).includes(norm(c.ex).replace(/[.!?]$/, ''))) ctx.addIssue({ code: 'custom', path: ['ex'], message: 'ex must be a sentence copied from the text' });
      if (isWrongLang(c.def, 'en')) ctx.addIssue({ code: 'custom', path: ['def'], message: 'must be written in English' });
    });

export const textCards: PromptTemplate<TextCardsVars, TextCardsOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You pick vocabulary cards from a text for ONE learner: German native speaker, English B2 aiming for C1, working in business development (B2B software).',
      `Pick ${TEXT_CARDS_MIN}–${TEXT_CARDS_MAX} words or fixed phrases from the text that are useful at B2–C1 and that the learner probably does not know yet. Prefer collocations and phrases over single common words.`,
      `Do not pick: ${v.known.slice(0, 200).join(', ') || '(none)'}`,
      'Reply with only one JSON object of this shape (one item shown):',
      EXAMPLE,
      'Rules:',
      '- word: base form as used (verbs without "to"), or the fixed phrase. pos: noun, verb, adjective, adverb, phrase or phrasal verb.',
      '- de: short German translation(s), comma-separated. def: short English definition (American English).',
      '- ex: the complete sentence from the text that contains the word, copied exactly.',
      fenced(block(v.text, TEXT_MAX_CHARS)),
    ].join('\n');
  },
  schema: (v) => z.object({ cards: lenientArray(cardSchema(v.text), 1, TEXT_CARDS_MAX) }),
};
