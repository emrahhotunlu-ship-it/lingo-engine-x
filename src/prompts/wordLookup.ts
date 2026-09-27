import { z } from 'zod';
import { cefrOrEmpty, clip, header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// word-lookup@2: Bedeutung eines angetippten Worts im Satz (Kap. 6, Wort-Antippen).
// `quick`, denn die Antwort ist klein und soll sofort kommen (Kap. 10). Die Antwort wird in
// `app/lookup` gespeichert; der 24-h-Zwischenspeicher von `sample` schont zusätzlich das Abo.

export type WordLookupVars = { word: string; sentence: string; uiLang: UiLang };
export type WordLookupOut = {
  lemma: string;
  pos: string;
  ipa: string;
  level: string;
  de: string;
  def: string;
  ex: string;
  sense: string;
  note: string;
};

export const WORD_MAX = 60;
export const SENTENCE_MAX = 400;

/** Beispielantwort im Prompt; muss selbst das Schema bestehen (Test). */
export const WORD_LOOKUP_EXAMPLE =
  '{"lemma":"reliable","pos":"adj","ipa":"rɪˈlaɪəbəl","level":"B2","de":"zuverlässig","def":"able to be trusted to work or behave well","ex":"Our new archive system has proven highly reliable.","sense":"…","note":"…"}';

const ID = 'word-lookup';
const VERSION = 2;

const schemaFor = (uiLang: UiLang): z.ZodType<WordLookupOut> =>
  z
    .object({
      lemma: z.string().trim().min(1).max(60),
      pos: z.string().trim().toLowerCase().min(1).max(20),
      ipa: z
        .string()
        .trim()
        .max(80)
        .transform((s) => s.replace(/^\/|\/$/g, '')),
      // W3: „B2–C1“, „N/A“, null oder "" (Namen, Zahlen) nicht ablehnen: erste Stufe oder "".
      level: z.preprocess(cefrOrEmpty, z.string()),
      de: z.string().trim().min(1).max(120),
      def: z.string().trim().min(1).max(200),
      ex: z.string().trim().min(3).max(240),
      sense: z.string().trim().min(1).max(240),
      note: z.preprocess((v) => (v === undefined || v === null ? '' : v), z.string().trim().max(200)),
    })
    .superRefine((v, ctx) => {
      langOf(['sense', 'note'], uiLang)(v, ctx);
      // `ex` und `def` werden gespeichert (`ex` kann zum Kartensatz werden): nur Englisch (Kap. 15).
      langOf(['ex', 'def'], 'en')(v, ctx);
    });

export const wordLookup: PromptTemplate<WordLookupVars, WordLookupOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(vars) {
    const sentence = clip(vars.sentence, SENTENCE_MAX);
    return [
      header({ id: ID, version: VERSION }),
      "You are a precise learner's dictionary for a German-speaking professional (CEFR B2, aiming for C1).",
      'American English is the standard: US spelling, General American pronunciation.',
      'Task: explain the English word or phrase as it is used in the sentence.',
      `Word: ${clip(vars.word, WORD_MAX)}`,
      `Sentence: ${sentence || '(none)'}`,
      `Explanation language: ${langName(vars.uiLang)}`,
      'Reply with only one JSON object, no other text, exactly these keys:',
      WORD_LOOKUP_EXAMPLE,
      'Rules:',
      '- lemma: dictionary form, no "to" before verbs, lowercase unless a proper noun.',
      '- pos: one of noun, verb, adj, adv, phrase, prep, conj, pron, det, other.',
      '- ipa: General American IPA, no slashes.',
      '- level: CEFR level of the word (A1, A2, B1, B2, C1 or C2), or "" if not applicable (names, numbers, non-English words).',
      '- de: 1–3 German translations that fit THIS sentence, comma-separated.',
      '- def: short English definition, max 15 words.',
      '- ex: one new natural example sentence in American English (business context if it fits), max 18 words, containing the word.',
      '- sense: what the word means in THIS sentence, written in the explanation language, max 25 words.',
      '- note: one usage tip in the explanation language (typical preposition, collocation or register), max 20 words, or "" if there is nothing useful to add.',
      '- In German texts, put English words and phrases in “…”.',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars.uiLang),
};
