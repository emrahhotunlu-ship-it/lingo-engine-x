import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import type { PromptTemplate, UiLang } from './types';

// mnemonic@1 (Funktionsabgleich M3): eine kurze Merkhilfe für ein hartnäckiges Wort (≥ 4-mal
// vergessen). Nur auf Knopfdruck nach dem Prüfen (sample.d.ts), `quick`, einen Tag zwischengespeichert.
// Die Merkhilfe steht in der Oberflächensprache (Sprachtreue, Kap. 10) und wird einmal an der
// Karte gespeichert (`vocab.mnemo`).

export type MnemonicVars = { word: string; meaning: string; sentence: string; uiLang: UiLang };
export type MnemonicOut = { text: string };

export const MNEMO_WORD_MAX = 60;
export const MNEMO_MEANING_MAX = 160;
export const MNEMO_SENTENCE_MAX = 240;
export const MNEMO_TEXT_MAX = 320;

export const MNEMONIC_EXAMPLE = '{"text":"…"}';

const ID = 'mnemonic';
const VERSION = 1;

const core = (w: string) => w.replace(/^to\s+/i, '').trim().toLowerCase();

/** Zu lange Merkhilfe am letzten Satzende kürzen statt verwerfen (Befund 27.09.). */
export function clipMnemo(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim();
  if (s.length <= MNEMO_TEXT_MAX) return s;
  const cut = s.slice(0, MNEMO_TEXT_MAX);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '), cut.lastIndexOf('.“'));
  return end >= 40 ? cut.slice(0, end + 1).trim() : `${cut.slice(0, MNEMO_TEXT_MAX - 1).trimEnd()}…`;
}

/** Wortanfang (≤ 5 Zeichen): auch gebeugte Formen („eventual…“, „stuck“ bei „stick“ nicht) zählen. */
const stem = (w: string): string => {
  const first = core(w).split(/\s+/)[0] ?? '';
  return first.slice(0, Math.min(first.length, 5));
};

const schemaFor = (v: MnemonicVars): z.ZodType<MnemonicOut> =>
  z
    .object({
      text: z.preprocess(
        clipMnemo,
        z
          .string()
          .min(12)
          .max(MNEMO_TEXT_MAX)
          .refine((s) => s.toLowerCase().includes(stem(v.word)), { message: 'must mention the word' }),
      ),
    })
    .superRefine(langOf(['text'], v.uiLang));

export const mnemonic: PromptTemplate<MnemonicVars, MnemonicOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You write ONE memory aid (mnemonic) for an English word that a German-speaking learner (B2, aiming for C1) keeps forgetting.',
      `Word: ${clip(v.word, MNEMO_WORD_MAX)}`,
      `Meaning: ${clip(v.meaning, MNEMO_MEANING_MAX) || '(unknown)'}`,
      `Card sentence: ${clip(v.sentence, MNEMO_SENTENCE_MAX) || '(none)'}`,
      `Language of the memory aid: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      MNEMONIC_EXAMPLE,
      'Rules:',
      '- text: one or two short sentences (max. 40 words) in the language given above that link the sound or spelling of the English word to its meaning,',
      '  e.g. a vivid image, a similar-sounding German word, or a word family. Mention the English word exactly once.',
      '- No lists, no quotes around the whole text, no translations of the whole sentence.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v),
};
