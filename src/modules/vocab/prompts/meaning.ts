import { z } from 'zod';
import { clip, clipped, header, langName, type PromptTemplate, type UiLang } from '../shared';
import { checkLang, EXAMPLE_MAX, looseBool, MEANING_MAX, WHY_MAX, WORD_MAX } from './common';

// vocab-meaning@1 (Großpaket A Schritt 5; plan.md §7): die zweite Meinung zu einer Antwort, die die lokale Prüfung nicht anerkannt hat – nur auf Antippen
// („War das auch richtig?“), nie automatisch. Zwei Fälle:
//  - `meaning`: Bedeutung frei nennen (Verstehen-Spur): trifft die eigene Erklärung den Sinn des Worts in DIESEM Satz? Wortlaut und Rechtschreibung zählen nicht.
//  - `gap`: anderes Wort in der Lücke: ist es hier gleichwertig richtig (Synonym, gleichwertige Form)?
// `quick`, 24 h zwischengespeichert (gleiche Eingabe, gleiches Urteil). Ein Neuversuch nur bei Schemaverletzung (A6.3).

export type MeaningMode = 'meaning' | 'gap';

export type MeaningVars = {
  mode: MeaningMode;
  /** Stichwort (Englisch). */
  word: string;
  /** Gelernte Bedeutung in der Oberflächensprache. */
  meaning: string;
  /** Satz der Karte (bei `gap` mit der Lücke als „___“). */
  sentence: string;
  given: string;
  uiLang: UiLang;
};

export type MeaningOut = { ok: boolean; why: string };

export const GIVEN_MAX = 120;
export const MEANING_EXAMPLE = '{"ok":true,"why":"…"}';

const ID = 'vocab-meaning';
const VERSION = 1;

const schemaFor = (v: MeaningVars): z.ZodType<MeaningOut> =>
  z.object({ ok: z.preprocess(looseBool, z.boolean()), why: clipped(1, WHY_MAX) }).superRefine((o, ctx) => checkLang(o.why, v.uiLang, ['why'], ctx));

export const meaning: PromptTemplate<MeaningVars, MeaningOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const task =
      v.mode === 'meaning'
        ? [
            'A German-speaking learner (B2, aiming for C1, business English) was asked what the English word means in this sentence and answered in their own words. Decide whether the answer captures the meaning in this sentence.',
            'Wording, spelling and grammar of the answer do not matter; a close paraphrase, a fitting translation or a correct explanation counts. A meaning that fits the word in general but not in this sentence does not count; a much wider or vaguer meaning does not count.',
          ]
        : [
            'A German-speaking learner (B2, aiming for C1, business English) typed a word in the gap that differs from the expected word. Decide whether it is equally correct in this sentence.',
            'ok only if the answer is grammatical and natural in the gap AND means the same here (a true synonym or an equivalent form). American English is the standard; British spelling and words count as correct.',
          ];
    return [
      header({ id: ID, version: VERSION }),
      ...task,
      `Word: ${clip(v.word, WORD_MAX)} (learned meaning: ${clip(v.meaning, MEANING_MAX)})`,
      `Sentence: ${clip(v.sentence, EXAMPLE_MAX)}`,
      `Learner answer: ${clip(v.given, GIVEN_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object in this format:',
      MEANING_EXAMPLE,
      '- why: one or two short sentences in the explanation language: why it fits, or what is different (meaning, register or collocation). Quote English words in "…". No generic praise.',
    ].join('\n');
  },
  schema: schemaFor,
};
