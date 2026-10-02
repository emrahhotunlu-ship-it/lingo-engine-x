import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header } from './common';
import type { PromptTemplate } from './types';

// card-examples@2: zwei bis drei natürliche Beispielsätze für eine Karte, deren eigene
// Beispiele nicht reichen (CLAUDE.md A7), und seit @2 (Englischlehrer 02.10.2026) bis zu zwei typische Wortpartner
// (`collocations`, Format der alten App `{p, de, gap, opts, ex}`). `quick`, klein, 24 h zwischengespeichert.
// Nur Englisch (amerikanisch), keine Erklärung – so entsteht keine Mischsprache.
// Die Sätze werden als `xEx`, die Wortpartner als `col` (mit `ai: 1`) an der Karte gespeichert und danach nie wieder
// angefragt. Das Schema prüft die Wortpartner bewusst NICHT einzeln: jeder wird mit `acceptCollocations`
// (domain/srs/collocs.ts) geprüft, ein schlechter reißt weder die Beispielsätze noch die anderen mit.

export type CardExamplesVars = { word: string; pos: string; meaning: string; sentence: string };
export type CardExamplesOut = { examples: string[]; collocations: unknown[] };

export const EX_WORD_MAX = 60;
export const EX_MEANING_MAX = 160;
export const EX_SENTENCE_MAX = 300;

/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const CARD_EXAMPLES_EXAMPLE =
  '{"examples":["Our supplier has always been reliable, even during the holidays.","We need reliable data before we present the numbers to the board.","She is one of the most reliable people on the team."],"collocations":[{"p":"highly reliable","de":"äußerst zuverlässig","gap":"highly","opts":["strongly","heavily","deeply"],"ex":"The new archive system has proven [highly reliable] in daily use."}]}';

const ID = 'card-examples';
const VERSION = 2;

/** Tolerant lesen: `{en: "…"}` statt Text, mehr als vier Sätze (die ersten vier zählen). */
function looseExamples(v: unknown): unknown {
  if (!Array.isArray(v)) return v;
  return (v as unknown[])
    .map((x): unknown => {
      if (!x || typeof x !== 'object' || Array.isArray(x)) return x;
      const o = x as Record<string, unknown>;
      return o.en ?? o.text ?? o.sentence ?? x;
    })
    .slice(0, 4);
}

const schema: z.ZodType<CardExamplesOut> = z.object({
  examples: z.preprocess(looseExamples, z
    .array(
      z
        .string()
        .trim()
        .min(12)
        .max(220)
        .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' }),
    )
    .min(2)
    .max(4)),
  // Wortpartner: nur als Liste lesen (≤ 4); jeder Eintrag wird danach einzeln geprüft. Fehlt das Feld: leer.
  collocations: z.preprocess((v) => (Array.isArray(v) ? (v as unknown[]).slice(0, 4) : []), z.array(z.unknown())),
});

export const cardExamples: PromptTemplate<CardExamplesVars, CardExamplesOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(vars) {
    return [
      header({ id: ID, version: VERSION }),
      "You write example sentences for a German-speaking professional's vocabulary card (CEFR B2, aiming for C1).",
      'American English only: US spelling and US vocabulary.',
      `Word: ${clip(vars.word, EX_WORD_MAX)}`,
      `Part of speech: ${clip(vars.pos, 20) || '(unknown)'}`,
      `Meaning: ${clip(vars.meaning, EX_MEANING_MAX) || '(unknown)'}`,
      `Card sentence: ${clip(vars.sentence, EX_SENTENCE_MAX) || '(none)'}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      CARD_EXAMPLES_EXAMPLE,
      'Rules:',
      '- examples: exactly 3 new, natural sentences, each 8–18 words, each containing the word (inflected forms are fine).',
      '- Use the word with the same meaning as on the card. Mix work and everyday contexts.',
      '- Do not repeat the card sentence. No brackets, no quotes, no translations in the examples.',
      '- collocations: 0 to 2 typical collocations of the word (verb + noun, adjective + noun, noun + preposition, adverb + adjective) that German speakers often get wrong. Only give one if you are sure it is natural American English; otherwise use an empty list.',
      '  - p: the collocation in base form, 2 to 5 words, containing the word. de: its German meaning in 2 to 6 words.',
      '  - ex: one natural sentence (8 to 18 words) with the collocation marked by exactly ONE pair of square brackets, for example We [meet the deadline] every quarter. The brackets contain the card word and the gap word.',
      '  - gap: ONE partner word of the collocation that is removed for the exercise (never the card word itself), spelled exactly as inside the brackets.',
      '  - opts: exactly 3 wrong options for the gap: single words a German speaker might choose by literal translation. They must NOT work in this collocation. Never give an option that is also correct.',
    ].join('\n');
  },
  schema: () => schema,
};
