import { z } from 'zod';
import { normalize } from '../domain/answer/normalize';
import { toUS } from '../domain/answer/spelling';
import { containsPhrase, wordCountOf } from '../domain/chunks/newChunk';
import { TOPICS } from '../domain/content';
import { isWrongLang } from '../domain/lang/detect';
import type { AnalysisView } from '../domain/speak/types';
import { langName, langOf } from './common';
import type { UiLang } from './types';

// Die drei Schichten einer Satz-Analyse (Plan §5.3, §6.2), gemeinsam für Rollenspiel-Analyse,
// Pitch-Rückmeldung und andere Vorlagen: 1. Korrektheit, 2. C1-Fassung mit Änderungen,
// 3. „Landet besser, weil …“ – dazu höchstens 3 Wendungen zum Mitnehmen.
// Jede Verfeinerung ist ein eigener Unit-Test (Plan §6.2, Nr. 1–8).

export const EXTRA_CATS = ['vocab', 'collocation', 'register', 'word-order', 'spelling', 'other'] as const;
export const ERROR_CATS: readonly string[] = [...TOPICS.map((t) => t.id), ...EXTRA_CATS];

export const LANDS_MAX = 160;
export const WHY_MAX = 200;
export const UPGRADED_MAX = 400;

export type ThreeLayersOut = AnalysisView;

export type ThreeLayersCtx = { sentence: string; focusWords: readonly string[]; uiLang: UiLang; upgradedMax?: number };

const english = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

const errorSchema = (uiLang: UiLang) =>
  z
    .object({
      wrong: z.string().trim().min(1).max(200),
      right: english(200),
      cat: z.string().trim(),
      why: z.string().trim().min(1).max(WHY_MAX),
    })
    .superRefine((e, ctx) => {
      if (!ERROR_CATS.includes(e.cat)) ctx.addIssue({ code: 'custom', path: ['cat'], message: `cat must be one of: ${ERROR_CATS.join(', ')}` });
    })
    .superRefine(langOf(['why'], uiLang));

const changeSchema = (uiLang: UiLang) =>
  z
    .object({ from: z.string().trim().min(1).max(200), to: english(200), why: z.string().trim().min(1).max(WHY_MAX) })
    .superRefine(langOf(['why'], uiLang));

const chunkSchema = (uiLang: UiLang) =>
  z
    .object({
      en: english(80).refine((s) => wordCountOf(s) >= 1 && wordCountOf(s) <= 8, { message: 'en must have 1–8 words' }),
      de: z.string().trim().min(1).max(120),
      def: english(160),
      kind: z.enum(['collocation', 'frame', 'phrase']),
      register: z.enum(['formal', 'neutral', 'informal']),
      why: z.string().trim().min(1).max(WHY_MAX),
    })
    .superRefine(langOf(['why'], uiLang));

/** zod-Schema der drei Schichten für einen bestimmten eigenen Satz. */
export function threeLayersSchema(c: ThreeLayersCtx): z.ZodType<ThreeLayersOut> {
  const focus = new Set(c.focusWords.map((w) => w.toLowerCase().trim()).filter(Boolean));
  return z
    .object({
      verdict: z.enum(['clean', 'minor', 'errors']),
      english: z.boolean(),
      errors: z.array(errorSchema(c.uiLang)).max(6),
      upgraded: english(c.upgradedMax ?? UPGRADED_MAX),
      changes: z.array(changeSchema(c.uiLang)).max(6),
      lands: z.string().trim().min(1).max(LANDS_MAX),
      chunks: z.array(chunkSchema(c.uiLang)).max(3),
      targets: z.array(z.string().trim().min(1)).max(8),
    })
    .superRefine((v, ctx) => {
      // 1. Keine Widersprüche (Kap. 2.2).
      if (v.english) {
        if ((v.verdict === 'clean') !== (v.errors.length === 0)) {
          ctx.addIssue({ code: 'custom', path: ['verdict'], message: 'verdict "clean" if and only if errors is empty' });
        }
      } else {
        if (v.errors.length) ctx.addIssue({ code: 'custom', path: ['errors'], message: 'must be empty when english is false' });
        if (v.verdict !== 'errors') ctx.addIssue({ code: 'custom', path: ['verdict'], message: 'must be "errors" when english is false' });
      }
      v.errors.forEach((e, i) => {
        // 2. Der Fehler steht wirklich im eigenen Satz.
        if (!containsPhrase(c.sentence, e.wrong)) ctx.addIssue({ code: 'custom', path: ['errors', i, 'wrong'], message: 'must be quoted exactly from the learner sentence' });
        // 4. Britisch ist kein Fehler (A7.3).
        const w = normalize(e.wrong);
        const r = normalize(e.right);
        if (w === r || toUS(w) === r) ctx.addIssue({ code: 'custom', path: ['errors', i], message: 'British spelling or identical text is not an error; mention the US form in "lands" instead' });
      });
      // 5. Jede Wendung steckt im aufgewerteten Satz.
      v.chunks.forEach((ch, i) => {
        if (!containsPhrase(v.upgraded, ch.en)) ctx.addIssue({ code: 'custom', path: ['chunks', i, 'en'], message: 'must appear word for word in "upgraded"' });
      });
      // 8. Nur übergebene Fokuswörter.
      v.targets.forEach((t, i) => {
        if (!focus.has(t.toLowerCase().trim())) ctx.addIssue({ code: 'custom', path: ['targets', i], message: 'must be one of the focus words' });
      });
    })
    // 6. Erklärtexte in der Oberflächensprache.
    .superRefine(langOf(['lands'], c.uiLang));
}

/** Beispielantwort (besteht das Schema für EXAMPLE_SENTENCE, Test). */
export const EXAMPLE_SENTENCE = 'We must delay the start, the exposure is for you.';
export function threeLayersExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    verdict: 'minor',
    english: true,
    errors: [
      {
        wrong: 'the exposure is for you',
        right: 'the exposure is yours',
        cat: 'prepositions',
        why: de ? 'Besitz drückt man mit „yours“ aus, nicht mit „for you“.' : 'Ownership is expressed with "yours", not "for you".',
      },
    ],
    upgraded: 'If we push back the go-live, the exposure is yours, not ours.',
    changes: [{ from: 'must delay the start', to: 'push back the go-live', why: de ? 'Klingt nach Planung statt nach Versäumnis.' : 'It sounds like planning, not like a failure.' }],
    lands: de ? 'Die Bedingung mit „if“ macht das Risiko für ihn greifbar.' : 'The "if" clause makes the risk concrete for him.',
    chunks: [
      {
        en: 'push back the go-live',
        de: 'den Go-live verschieben',
        def: 'to move the launch to a later date',
        kind: 'collocation',
        register: 'neutral',
        why: de ? 'Übliche Wendung für Terminverschiebungen im Projekt.' : 'A common way to talk about moving a project date.',
      },
    ],
    targets: [],
  });
}

/** Gemeinsame Regeln für jede Vorlage mit drei Schichten. */
export function threeLayersRules(uiLang: UiLang): string[] {
  return [
    `Explanation language for "why" and "lands": ${langName(uiLang)}. Every English field (upgraded, right, to, chunks.en, chunks.def) is American English.`,
    'American English is the standard. British spelling or British words are NOT errors: never list them in "errors"; you may mention the US form in "lands".',
    '- english: false if the sentence is mostly not English; then errors = [], verdict = "errors", and upgraded is the sentence in natural English.',
    '- verdict: "clean" = no errors (then errors = []); "minor" = small slips; "errors" = errors that affect meaning or grammar.',
    '- errors: at most 6. "wrong" is copied word for word from the learner sentence; "right" is the corrected phrase.',
    `- cat: one of ${ERROR_CATS.join(', ')}.`,
    '- why: at most one short sentence each.',
    '- upgraded: the whole sentence as a confident C1 speaker would say it here (keep the meaning).',
    '- changes: what you changed from the learner sentence to "upgraded", each with a short reason.',
    `- lands: ONE line (max ${LANDS_MAX} characters) why the upgraded version lands better with this listener. Always give it, also when the sentence is clean.`,
    '- chunks: 0 to 3 reusable phrases (1–8 words) that appear word for word in "upgraded"; de = German translation; def = short English definition.',
    '- targets: focus words the learner used correctly (only from the given list), else [].',
  ];
}
