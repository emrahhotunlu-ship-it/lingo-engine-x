import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { looseBool } from './produceCheck';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// grammar-fit@1: „Ist diese Antwort im ganzen Satz auch richtig?“ Genau ein Aufruf nach „Prüfen“, wenn die lokale Prüfung eine Lücken- oder
// Ersetzen-Antwort abgelehnt hat (Emrah 19.10.2026: „had“ statt „used to have“ war grammatisch richtig und galt als Fehler). `quick`, 24 h
// zwischengespeichert, nie automatisch wiederholt (A6.3: nur ein Schemaverstoß darf einmal neu gefragt werden, das macht das KI-Tor).
// Nur bei `fits && certain` wird aus „falsch“ „Auch richtig“. Regeln der Lernprüfung: im Zweifel nein, kein Wohlwollen, keine Selbstbewertung.

export type GrammarFitVars = {
  topic: string;
  /** Name des geübten Musters (nur Kontext) oder `null`. */
  pattern: string | null;
  /** `gap`: Lücke füllen; `replace`: markierte Stelle ersetzen. */
  mode: 'gap' | 'replace';
  /** Der Satz so, wie die Aufgabe ihn zeigt (Lücke `___` bzw. fehlerhafter Satz). */
  task: string;
  /** Der ganze Satz mit der Antwort des Lernenden. */
  sentence: string;
  /** Der ganze Satz mit der erwarteten Lösung. */
  expected: string;
  given: string;
  uiLang: UiLang;
};
export type GrammarFitOut = { fits: boolean; certain: boolean; why: string };

export const GRAMMAR_FIT_EXAMPLE = '{"fits":true,"certain":true,"why":"…"}';

const ID = 'grammar-fit';
const VERSION = 1;

const schemaFor = (uiLang: UiLang): z.ZodType<GrammarFitOut> =>
  z
    .object({ fits: z.preprocess(looseBool, z.boolean()), certain: z.preprocess(looseBool, z.boolean()), why: clipped(1, 300) })
    .superRefine(langOf(['why'], uiLang));

export const grammarFit: PromptTemplate<GrammarFitVars, GrammarFitOut> = {
  id: ID,
  version: VERSION,
  tier: 'quick',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1) answered a grammar exercise differently from the expected answer. Decide whether the learner’s COMPLETE sentence is also correct.',
      'American English is the standard; British spelling and British words count as correct.',
      `Grammar topic: ${clip(v.topic, 80)}${v.pattern ? ` (practiced pattern: ${clip(v.pattern, 80)})` : ''}`,
      `Exercise (${v.mode === 'gap' ? 'fill the gap' : 'replace the marked part'}): ${clip(v.task, 240)}`,
      `Expected sentence: ${clip(v.expected, 240)}`,
      `Learner sentence: ${clip(v.sentence, 240)}`,
      `Learner answer only: ${clip(v.given, 80)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      GRAMMAR_FIT_EXAMPLE,
      'Rules:',
      '- fits: true only if the learner sentence is fully grammatical AND natural in American English AND says what the context says (small shades of meaning, such as simple past instead of used to, are fine; a different time, person, number, polarity or fact is not).',
      '- certain: true only if you have no real doubt. If it is borderline, regional, stilted or depends on context you do not have, set certain to false.',
      '- Do not be generous: a wrong form, a missing or extra word, a wrong tense for the context or an unnatural collocation means fits is false.',
      '- why: one or two short sentences in the explanation language: why it works (or what is wrong).',
    ].join('\n');
  },
  schema: (v) => schemaFor(v.uiLang),
};
