import { z } from 'zod';
import { block, header, langName, lenientArray } from '../../common';
import { englishText, uiText } from '../../inputCommon';
import { clipped, intIn } from '../../tolerant';
import type { PromptTemplate, UiLang } from '../../types';

// followup-check@1 (Backlog B6, Lehrer H4): Prüft die Follow-up-Mail nach dem Hör-Meeting –
// sind alle Vereinbarungen drin (je Punkt ja/teilweise/nein mit Beleg), höchstens 3 sprachliche
// Korrekturen und eine bessere Fassung. Die Stichworte gehen nur als Kontext mit.

export type FollowupCheckVars = { points: readonly string[]; notes: string; mail: string; uiLang: UiLang };
export type Coverage = 'yes' | 'partly' | 'no';
export type FollowupCheckOut = {
  points: Array<{ i: number; covered: Coverage; note: string }>;
  effect: string;
  fixes: Array<{ mine: string; right: string; why: string }>;
  better: string;
};

const ID = 'followup-check';
const VERSION = 1;

/** Abdeckung tolerant: true/„covered“/„fully“ → yes, „partial(ly)“ → partly, sonst no. */
export function coverageOf(v: unknown): unknown {
  if (v === true) return 'yes';
  if (v === false) return 'no';
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (/^(yes|covered|fully|complete|met|true)/.test(s)) return 'yes';
  if (/^(partly|partial|partially|somewhat)/.test(s)) return 'partly';
  return 'no';
}

export const followupCheck: PromptTemplate<FollowupCheckVars, FollowupCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 24 * 60 * 60 * 1000 },
  build(vars) {
    const L = langName(vars.uiLang);
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking professional (CEFR B2, aiming for C1) listened to a meeting, took notes and wrote a short follow-up email (about 80 words).',
      'Agreements from the meeting:',
      ...vars.points.map((p, i) => `${i + 1}. ${p}`),
      'Their notes (context only):',
      block(vars.notes || '(none)', 800),
      'Their email:',
      block(vars.mail, 2000),
      'Check:',
      `- points: for every agreement (i = its number minus 1) say whether the email covers it: "yes", "partly" or "no", with a short ${L} note.`,
      `- effect: one short ${L} sentence on how the email comes across (clear, polite, complete?).`,
      `- fixes: at most 3 real language mistakes: "mine" = the words as written, "right" = the corrected words, "why" = one short ${L} sentence. Empty list if there are none. British spellings are correct, never a mistake.`,
      '- better: an improved version of the email in American English, same length, with all agreements.',
      'Reply with only one JSON object, no other text: {"points": [{"i": 0, "covered": "yes|partly|no", "note": "<note>"}], "effect": "<sentence>", "fixes": [{"mine": "<as written>", "right": "<correct>", "why": "<reason>"}], "better": "<email>"}',
    ].join('\n');
  },
  schema: (vars) =>
    z
      .object({
        points: lenientArray(z.object({ i: intIn(0, 9), covered: z.preprocess(coverageOf, z.enum(['yes', 'partly', 'no'])), note: uiText(vars.uiLang, 2, 240) }), 1, 4),
        effect: uiText(vars.uiLang, 3, 240),
        fixes: z.preprocess((v) => (Array.isArray(v) ? v.slice(0, 3) : v ?? []), z.array(z.object({ mine: z.string().trim().min(1).max(200), right: z.string().trim().min(1).max(200), why: uiText(vars.uiLang, 2, 240) })).max(3)),
        better: clipped(10, 1500).pipe(englishText(10, 1500)),
      })
      .superRefine((v, ctx) => {
        v.points.forEach((p, k) => {
          if (p.i >= vars.points.length) ctx.addIssue({ code: 'custom', path: ['points', k, 'i'], message: 'i must be the number of an agreement minus 1' });
        });
      }),
};
