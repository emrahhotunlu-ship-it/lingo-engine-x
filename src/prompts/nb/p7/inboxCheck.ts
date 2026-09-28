import { z } from 'zod';
import { block, clip, fenced, header, langName, langOf } from '../../common';
import { looseBool } from '../../produceCheck';
import { clipped, sliced } from '../../tolerant';
import type { PromptTemplate, UiLang } from '../../types';

// inbox-check@1 (Plan §3.2, N104, Lehrer L2): Posteingang. Emrah hat eine Kundenmail mit
// verstecktem Anliegen gelesen, das Anliegen in einem Satz benannt (Deutsch erlaubt) und
// geantwortet. Geprüft: Anliegen getroffen? Pflichtpunkte erfüllt? Ton? Höchstens 3 Korrekturen,
// eine bessere Fassung (US-Englisch). `default`: eine ganze Mail.

export type InboxCheckVars = {
  subject: string;
  body: string;
  /** Das eigentliche Anliegen (Englisch, verdeckt). */
  hidden: string;
  /** Was die Antwort leisten muss (Englisch, 2–4 Punkte). */
  must: string[];
  /** Emrahs Satz zum Anliegen (Deutsch oder Englisch). */
  gist: string;
  reply: string;
  uiLang: UiLang;
};

export type InboxTone = 'fits' | 'too_formal' | 'too_casual' | 'too_direct';
export type InboxFix = { mine: string; right: string; why: string };
export type InboxCheckOut = {
  gist: boolean;
  gistNote: string;
  must: boolean[];
  tone: InboxTone;
  effect: string;
  fixes: InboxFix[];
  better: string;
};

export const IC_BODY_MAX = 2000;
export const IC_REPLY_MAX = 1500;
const ID = 'inbox-check';
const VERSION = 1;

export const INBOX_CHECK_EXAMPLE =
  '{"gist":true,"gistNote":"…","must":[true,false],"tone":"fits","effect":"…","fixes":[{"mine":"…","right":"…","why":"…"}],"better":"…"}';

const fix = z.object({ mine: clipped(1, 200), right: clipped(1, 200), why: clipped(1, 200) });

const TONES = ['fits', 'too_formal', 'too_casual', 'too_direct'] as const;
const toneLoose = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'ok' || s === 'good' || s === 'fine' || s === 'appropriate') return 'fits';
  return s;
}, z.enum(TONES).catch('fits'));

export const inboxCheck: PromptTemplate<InboxCheckVars, InboxCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    const must = v.must.map((m, i) => `${i + 1}. ${clip(m, 160)}`);
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking salesperson (B2, aiming for C1) practices business email in English.',
      'He read a customer email with a hidden concern, wrote one sentence about what the customer really wants (German or English is fine), and then wrote a reply.',
      'Judge his work. American English is the standard; British spelling and British words are correct too.',
      `Subject: ${clip(v.subject, 160)}`,
      'Customer email:',
      fenced(block(v.body, IC_BODY_MAX)),
      `The customer's real concern: ${clip(v.hidden, 300)}`,
      'The reply must do these things:',
      ...must,
      `Learner's sentence about the concern: ${clip(v.gist, 300)}`,
      'Learner reply:',
      fenced(block(v.reply, IC_REPLY_MAX)),
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      INBOX_CHECK_EXAMPLE,
      'Rules:',
      '- gist: true if his sentence captures the real concern (the idea counts, not the wording). gistNote: one short sentence in the explanation language.',
      `- must: exactly ${v.must.length} booleans in the order above, true if the reply clearly does that point.`,
      '- tone: fits, too_formal, too_casual or too_direct (for a US business customer).',
      '- effect: one short sentence in the explanation language: how the reply will land with the customer.',
      '- fixes: at most 3 real mistakes, most important first (meaning > German-English trap > tone > form). mine = the exact words from the reply, right = the corrected words (English), why = one short reason in the explanation language. Empty list if there are none.',
      '- better: his reply rewritten as a natural, polite US business email that does all the points, keeping his ideas, at most 150 words, without subject line.',
    ].join('\n');
  },
  schema: (v) =>
    z
      .object({
        gist: z.preprocess(looseBool, z.boolean()),
        gistNote: clipped(1, 240),
        must: z.preprocess(
          (x) => (Array.isArray(x) ? v.must.map((_, i) => x[i] ?? false) : x),
          z.array(z.preprocess(looseBool, z.boolean())),
        ),
        tone: toneLoose,
        effect: clipped(1, 240),
        fixes: sliced(fix, 0, 3).catch([]),
        better: clipped(1, IC_REPLY_MAX),
      })
      .superRefine(langOf(['effect', 'gistNote'], v.uiLang)),
};
