import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { clipped } from './tolerant';
import { looseBool } from './produceCheck';
import type { PromptTemplate, UiLang } from './types';

// synonym-check@1 (Lernplattform 2.0 §4.8): „War das auch richtig?“ – nur auf Antippen (Menü der Erklär-Karte), `quick`, 24 h
// zwischengespeichert (Schlüssel = Kartenwort und Antwort), nie automatisch wiederholt (A6.3). Eingabe: Lösung, Bedeutung, Satz
// und die eigene Antwort. Ausgabe: ob die Antwort im Satz gleichwertig passt, und ein kurzer Grund in der Oberflächensprache.
// Britische Formen gelten als richtig. Gekennzeichnet als „von Claude, kann Fehler enthalten“.

export type SynonymCheckVars = { target: string; meaning: string; sentence: string; given: string; uiLang: UiLang };
export type SynonymCheckOut = { ok: boolean; why: string };

export const SYNONYM_EXAMPLE = '{"ok":true,"why":"…"}';

const ID = 'synonym-check';
const VERSION = 1;

const schemaFor = (uiLang: UiLang): z.ZodType<SynonymCheckOut> =>
  z
    .object({ ok: z.preprocess(looseBool, z.boolean()), why: clipped(1, 300) })
    .superRefine(langOf(['why'], uiLang));

export const synonymCheck: PromptTemplate<SynonymCheckVars, SynonymCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1, business English) typed a word that differs from the expected word. Decide whether it is equally correct in this sentence.',
      'American English is the standard; British spelling and words count as correct.',
      `Expected word: ${clip(v.target, 60)} (meaning: ${clip(v.meaning, 120)})`,
      `Sentence with a gap: ${clip(v.sentence, 240)}`,
      `Learner answer: ${clip(v.given, 60)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      SYNONYM_EXAMPLE,
      'Rules:',
      '- ok: true only if the learner answer is grammatical and natural in the gap AND means the same in this sentence (a true synonym or equivalent form).',
      '- why: one or two short sentences in the explanation language: why it fits or what is different (meaning, register or collocation).',
    ].join('\n');
  },
  schema: (v) => schemaFor(v.uiLang),
};
