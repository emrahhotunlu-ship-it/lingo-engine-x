import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { looseBool } from './produceCheck';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// repair-check@1 (Lernberatung 27.09., V2 „Nochmal, aber besser"): Emrah formuliert einen
// eigenen, früher falschen Satz neu. Nur wenn die lokale Prüfung nein sagt, fragt die App hier
// nach: Ist der Fehler behoben und der Satz richtig? `quick` – ein einzelner Satz mitten in einer
// Runde. Britische Formen gelten als richtig (A7.3). Keine Selbstbewertung.

export type RepairCheckVars = {
  /** Emrahs alter, falscher Satz. */
  wrong: string;
  /** Die bessere Fassung. */
  right: string;
  /** Kurzer Grund der Korrektur (Oberflächensprache), darf leer sein. */
  why: string;
  /** Der neu formulierte Satz. */
  given: string;
  uiLang: UiLang;
  /**
   * `retry` (LP3 P51 „Sag’s nochmal“ im Rollenspiel): Emrah hat die Korrektur NICHT gesehen, der Satz kann gesprochen sein (Spracherkennung).
   * Dann: gesprochene Formen sind kein Fehler, alle genannten Fehler müssen behoben sein, und die Notiz bei „nein“ gibt nur einen Hinweis, wo es hakt,
   * nie die richtigen Wörter. Ohne Angabe (Fehlersatz-Wiederholung): unverändert, dort steht die Lösung danach ohnehin da.
   */
  mode?: 'retry';
};

export type RepairCheckOut = { ok: boolean; note: string };

export const RC_SENTENCE_MAX = 300;
export const RC_WHY_MAX = 200;

const ID = 'repair-check';
const VERSION = 1;

export const REPAIR_CHECK_EXAMPLE = '{"ok":true,"note":"…"}';

export const repairCheck: PromptTemplate<RepairCheckVars, RepairCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const retry = v.mode === 'retry';
    return [
      header({ id: ID, version: VERSION }),
      retry
        ? 'A German-speaking learner (B2, aiming for C1) made a mistake in his own sentence and now tries to fix it without seeing the correction. The rewrite may be spoken (speech-to-text).'
        : 'A German-speaking learner (B2, aiming for C1) made a mistake in one of his own sentences and now rewrites it from memory.',
      'Decide whether the rewrite fixes the mistake and is a correct, natural English sentence with the same meaning.',
      'It does not have to match the model answer word for word. American English is the standard; British spelling and British words are correct too.',
      `Original sentence: ${clip(v.wrong, RC_SENTENCE_MAX)}`,
      `Model answer: ${clip(v.right, RC_SENTENCE_MAX)}`,
      `Reason for the correction: ${clip(v.why, RC_WHY_MAX) || '(none)'}`,
      `Learner rewrite: ${clip(v.given, RC_SENTENCE_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      REPAIR_CHECK_EXAMPLE,
      'Rules:',
      ...(retry
        ? [
            '- ok: true only if every mistake named in the reason is fixed AND the rewrite has no new grammar mistake. Small wording differences, contractions, spoken fragments, and missing punctuation or capitalization are fine.',
            '- note: one short sentence in the explanation language. If ok is true, say briefly what is right now. If ok is false, give a hint where the problem is (e.g. "Check the verb tense after “since”."), but never the corrected words. Neutral tone, no praise.',
          ]
        : [
            '- ok: true only if the original mistake is fixed AND the rewrite has no new grammar mistake. Small wording differences are fine.',
            '- note: one short sentence in the explanation language: what is right, or what is still wrong.',
          ]),
    ].join('\n');
  },
  schema: (v) =>
    z
      .object({
        ok: z.preprocess(looseBool, z.boolean()),
        note: clipped(1, 240),
      })
      .superRefine(langOf(['note'], v.uiLang)),
};
