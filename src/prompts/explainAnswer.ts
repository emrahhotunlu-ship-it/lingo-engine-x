import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, shortenText } from './common';
import type { PromptTemplate, UiLang } from './types';

// explain-answer@1 (Lernplattform 2.0 §4.7, §8 Nr. 11): „Erklär mir meine Antwort“. Nur auf Antippen (Menü ⋯), `quick`, 24 h
// zwischengespeichert, nie automatisch wiederholt (A6.3). Eingabe: Aufgabe, richtige Lösung, Antwort des Lernenden und das Muster
// der Aufgabe. Ausgabe: eine kurze Erklärung in beiden Sprachen (höchstens 60 Wörter je Sprache); angezeigt wird die der
// Oberflächensprache, gekennzeichnet als „von Claude, kann Fehler enthalten“.

export type ExplainAnswerVars = {
  topic: string;
  /** Aufgabentext (bei Lücken mit `___`). */
  prompt: string;
  /** Richtige Lösung. */
  answer: string;
  /** Antwort des Lernenden (bei Auswahl: die gewählte Option). */
  given: string;
  /** Name und Formel des Musters der Aufgabe (leer, wenn unbekannt). */
  pattern: { name: string; form: string } | null;
  uiLang: UiLang;
};
export type ExplainAnswerOut = { de: string; en: string };

export const EXPLAIN_WORDS = 60;
export const EXPLAIN_TASK_MAX = 300;
export const EXPLAIN_ANSWER_EXAMPLE = '{"de":"…","en":"…"}';

const ID = 'explain-answer';
const VERSION = 1;

/** Zu lange Erklärungen werden gekürzt statt abgelehnt. */
const text = z
  .string()
  .trim()
  .min(1)
  .transform((s) => shortenText(s, EXPLAIN_WORDS, 600));

const schema: z.ZodType<ExplainAnswerOut> = z
  .object({ de: text, en: text })
  .superRefine((v, ctx) => {
    if (isWrongLang(v.de, 'de')) ctx.addIssue({ code: 'custom', path: ['de'], message: 'must be written in German' });
    if (isWrongLang(v.en, 'en')) ctx.addIssue({ code: 'custom', path: ['en'], message: 'must be written in English' });
  });

export const explainAnswer: PromptTemplate<ExplainAnswerVars, ExplainAnswerOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You explain one wrong answer in a grammar exercise to a German-speaking learner (B2, aiming for C1, business English).',
      'American English is the standard. Be concrete and short: say exactly why THIS answer does not fit THIS sentence, name the signal in the sentence, and say what the correct form means. Do not repeat the whole rule.',
      `Grammar topic: ${clip(v.topic, 80)}`,
      `Pattern: ${v.pattern ? `${clip(v.pattern.name, 120)} (${clip(v.pattern.form, 120)})` : '(unknown)'}`,
      `Exercise: ${clip(v.prompt, EXPLAIN_TASK_MAX)}`,
      `Correct answer: ${clip(v.answer, EXPLAIN_TASK_MAX)}`,
      `Learner answer: ${clip(v.given, EXPLAIN_TASK_MAX)}`,
      'Reply with only one JSON object with the same explanation in both languages:',
      EXPLAIN_ANSWER_EXAMPLE,
      'Rules:',
      `- "de" is written in German, "en" in English; each at most ${EXPLAIN_WORDS} words, no lists.`,
      '- Quote English example words in the text only with typographic quotes, never with straight quotes.',
      '- Never invent grammar rules. If the learner answer is actually correct English for the sentence, say so and name the difference in meaning.',
    ].join('\n');
  },
  schema: () => schema,
};
