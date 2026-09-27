import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
import { block, clip, fenced, header, langName, langOf } from './common';
import { ERROR_CAT_VALUES, englishText } from './inputCommon';
import type { PromptTemplate, UiLang } from './types';

// apply-check@1 (Plan §5, Kap. 6.9 „Anwenden"): prüft Emrahs eigenen Text zu einem Beitrag –
// Urteil in Worten, je Kernwendung „genutzt/natürlich" mit Hinweis, Stellen, verbesserte Fassung.

export type ApplyCheckVars = { task_en: string; chunks: readonly string[]; gist: string; text: string; uiLang: UiLang; topics: readonly string[] };

export type ApplyCheckOut = {
  verdict: 'good' | 'ok' | 'revise';
  chunks: Array<{ chunk: string; used: boolean; natural: boolean; note: string }>;
  errors: Array<{ orig: string; fix: string; cat: (typeof ERROR_CAT_VALUES)[number]; topic: string | null; why: string }>;
  improved: string;
  tip: string;
};

export const APPLY_TEXT_MAX = 2000;

const ID = 'apply-check';
const VERSION = 1;

export const APPLY_CHECK_EXAMPLE = JSON.stringify({
  verdict: 'ok',
  chunks: [{ chunk: 'price stability', used: true, natural: true, note: '…' }],
  errors: [{ orig: 'the inflation are high', fix: 'inflation is high', cat: 'grammar', topic: null, why: '…' }],
  improved: 'Inflation is still high, so the central bank wants to deliver price stability first.',
  tip: '…',
});

const CATS: readonly string[] = ERROR_CAT_VALUES;
/** Fehlerkategorie tolerant: bekannte Kennung (Groß/klein, Leerzeichen → „-“), sonst „other“. */
function catOf(raw: string): string {
  const c = raw.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return CATS.includes(c) ? c : 'other';
}

const schemaFor = (vars: ApplyCheckVars): z.ZodType<ApplyCheckOut> =>
  z
    .object({
      verdict: z.enum(['good', 'ok', 'revise']),
      chunks: z.array(z.object({ chunk: z.string().trim().min(1).max(120), used: z.boolean(), natural: z.boolean(), note: z.string().trim().min(1).max(240) })).max(8),
      errors: z
        .array(
          z.object({
            orig: z.string().trim().min(1).max(200),
            fix: z.string().trim().min(1).max(200),
            // Unbekannte Kategorie („word choice“, „article“) → „other“ statt Ablehnung.
            cat: z.preprocess((c) => (typeof c === 'string' ? catOf(c) : c), z.enum(ERROR_CAT_VALUES)),
            // Fehlt das Thema oder ist es leer, gilt „keins“ (null).
            topic: z.preprocess((t) => (t === undefined || t === '' ? null : t), z.string().trim().max(40).nullable()),
            why: z.string().trim().min(1).max(240),
          }),
        )
        .max(6),
      improved: englishText(1, 3000),
      tip: z.string().trim().min(1).max(300),
    })
    .superRefine((v, ctx) => {
      langOf(['tip'], vars.uiLang)(v, ctx);
      const msg = `must be written in ${langName(vars.uiLang)}`;
      v.chunks.forEach((c, i) => {
        if (isWrongLang(c.note, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['chunks', i, 'note'], message: msg });
      });
      v.errors.forEach((e, i) => {
        if (isWrongLang(e.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['errors', i, 'why'], message: msg });
      });
    });

export const applyCheck: PromptTemplate<ApplyCheckVars, ApplyCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(vars) {
    return [
      header({ id: ID, version: VERSION }),
      'You give feedback on a short text a German-speaking professional (B2, aiming for C1) wrote after reading or listening to a piece.',
      'American English is the standard. British spelling and words in the learner text are always correct: never list them as errors.',
      `Task: ${clip(vars.task_en, 600)}`,
      `Phrases the learner should try to use: ${vars.chunks.slice(0, 8).map((c) => clip(c, 80)).join(' | ') || '(none)'}`,
      'Summary of the piece:',
      fenced(block(vars.gist, 2000)),
      'Learner text:',
      fenced(block(vars.text, APPLY_TEXT_MAX)),
      `Explanation language: ${langName(vars.uiLang)}`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      APPLY_CHECK_EXAMPLE,
      'Rules:',
      '- verdict: good (task done, natural), ok (task done, some issues), revise (task missed or many errors).',
      '- chunks: one entry per phrase listed above: used (in any form), natural (used correctly and naturally), note (one short sentence in the explanation language).',
      '- errors: up to 6 real mistakes; orig = exact words from the learner text, fix, cat = one of ' + ERROR_CAT_VALUES.join(', ') + ',',
      `  topic = one of these grammar topic ids if it fits, else null: ${vars.topics.join(', ')}, why in the explanation language.`,
      '- improved: the learner text improved to C1 level in American English, same content.',
      '- tip: one concrete tip in the explanation language.',
    ].join('\n');
  },
  schema: (vars) => schemaFor(vars),
};
