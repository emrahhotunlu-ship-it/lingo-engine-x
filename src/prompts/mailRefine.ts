import { z } from 'zod';
import { MAIL_MAX } from '../domain/business/mailCompose';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { clip, header, langName, langOf } from './common';
import { intIn, phraseIn } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// mail-refine@2 (Plan §5.5, §6.2): bewertet eine selbst geschriebene E-Mail Satz für Satz und
// schlägt je schwachem Satz 2–3 Fassungen vor. Die Mail wird lokal zerlegt und nummeriert
// (domain/business/mailCompose.ts); die Antwort nennt jeden Baustein genau einmal – so ergibt
// das Zusammensetzen immer den Eingabetext (Abdeckungsregel per Aufbau). `default`, zwischengespeichert.

export type MailRefineVars = {
  segments: ReadonlyArray<{ i: number; text: string }>;
  recipient: string;
  intent: string;
  uiLang: UiLang;
};

export type MailOption = { text: string; register: 'formal' | 'neutral' | 'informal'; why: string; phrase: string; de: string; def: string };
export type MailSegmentOut = { i: number; status: 'ok' | 'stiff' | 'unclear' | 'wrong'; options: MailOption[] };
export type MailRefineOut = { segments: MailSegmentOut[]; tone: string };

/**
 * Höchstlänge eines Bausteins im Prompt. So lang wie die ganze Mail (MAIL_MAX): Bei mehr als 25 Sätzen
 * fasst mailCompose den Rest zu EINEM Baustein zusammen – gekürzt würde seine Fassung den Schluss verlieren.
 */
export const MAIL_SEG_MAX = MAIL_MAX;

const ID = 'mail-refine';
const VERSION = 2;
/** Obergrenze einer Fassung; ein zusammengefasster Schluss-Baustein (> 25 Sätze, mailCompose) darf länger sein. */
export const MAIL_OPTION_MAX = 500;

const en = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((s) => !isWrongLang(s, 'en'), { message: 'must be written in English' });

export function mailRefineSchema(v: Pick<MailRefineVars, 'segments' | 'uiLang'>): z.ZodType<MailRefineOut> {
  const ids = v.segments.map((s) => s.i);
  // Längster Baustein (im Prompt auf MAIL_SEG_MAX gekürzt) → Fassungen dürfen etwas länger sein.
  const longest = Math.max(0, ...v.segments.map((s) => Math.min(Array.from(s.text).length, MAIL_SEG_MAX)));
  const optionMax = Math.max(MAIL_OPTION_MAX, Math.round(longest * 1.5) + 100);
  // Tolerant (Prüfhinweis): Nummer auch als Text, fehlendes phrase/de/def = "", Wendung beugungstolerant.
  const str = (max: number) => z.string().trim().max(max).default('');
  return z
    .object({
      segments: z.array(
        z
          .object({
            i: intIn(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
            status: z.enum(['ok', 'stiff', 'unclear', 'wrong']),
            options: z.array(
              z
                .object({
                  text: en(optionMax),
                  register: z.enum(['formal', 'neutral', 'informal']),
                  why: z.string().trim().min(1).max(200),
                  phrase: str(80),
                  de: str(120),
                  def: str(160),
                })
                .superRefine((o, ctx) => {
                  if (o.phrase && !containsPhrase(o.text, o.phrase) && !phraseIn(o.text, o.phrase)) ctx.addIssue({ code: 'custom', path: ['phrase'], message: 'phrase must appear word for word in text' });
                  if (o.phrase && (!o.de || !o.def)) ctx.addIssue({ code: 'custom', path: ['de'], message: 'give de and def for every phrase' });
                  if (o.def && isWrongLang(o.def, 'en')) ctx.addIssue({ code: 'custom', path: ['def'], message: 'must be written in English' });
                })
                .superRefine(langOf(['why'], v.uiLang)),
            ).max(3),
          })
          .superRefine((s, ctx) => {
            if (s.status !== 'ok' && (s.options.length < 2 || s.options.length > 3)) ctx.addIssue({ code: 'custom', path: ['options'], message: 'give 2–3 options unless status is "ok"' });
          }),
      ),
      tone: z.string().trim().min(1).max(240),
    })
    .superRefine((o, ctx) => {
      const got = o.segments.map((s) => s.i);
      const missing = ids.filter((i) => !got.includes(i));
      const extra = got.filter((i, k) => !ids.includes(i) || got.indexOf(i) !== k);
      if (missing.length || extra.length) ctx.addIssue({ code: 'custom', path: ['segments'], message: `list every segment number exactly once: ${ids.join(', ')}` });
    })
    .superRefine(langOf(['tone'], v.uiLang));
}

export function mailRefineExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    segments: [
      { i: 0, status: 'ok', options: [] },
      {
        i: 1,
        status: 'stiff',
        options: [
          { text: "I'm afraid the scanners will arrive two weeks later than planned.", register: 'formal', why: de ? 'Kündigt die schlechte Nachricht höflich an.' : 'Breaks the bad news politely.', phrase: "I'm afraid", de: 'leider', def: 'used to say something unwelcome politely' },
          { text: 'The scanners are running two weeks behind schedule.', register: 'neutral', why: de ? 'Sachlich und kurz.' : 'Factual and short.', phrase: 'behind schedule', de: 'im Verzug', def: 'later than planned' },
        ],
      },
    ],
    tone: de ? 'Freundlich, aber an zwei Stellen zu direkt für einen Kunden.' : 'Friendly, but too direct for a client in two places.',
  });
}

export const mailRefine: PromptTemplate<MailRefineVars, MailRefineOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'You edit a business email written by a German-speaking professional (B2, aiming for C1).',
      `Recipient: ${clip(v.recipient, 40)}`,
      `Intent: ${clip(v.intent, 40)}`,
      'The email, split into numbered segments:',
      ...v.segments.map((s) => `[${s.i}] ${clip(s.text, MAIL_SEG_MAX)}`),
      `Explanation language (why, tone): ${langName(v.uiLang)}. Every "text" is American English.`,
      'Reply with only one JSON object, no other text, exactly this shape:',
      mailRefineExample(v.uiLang),
      'Rules:',
      '- segments: every segment number exactly once, in order.',
      '- status: "ok" (keep as is, options = []), "stiff" (unnatural or too direct), "unclear", or "wrong" (grammar or meaning).',
      '- For every segment that is not "ok": 2–3 options that replace the WHOLE segment, keep its meaning and fit recipient and intent.',
      '- register: formal, neutral or informal. why: one short reason. phrase: the reusable phrase from the option (word for word) or "".',
    '- de: German translation of phrase; def: short English definition of phrase (both "" when phrase is "").',
      '- Greetings and sign-offs count as segments too. British spelling is never "wrong".',
      '- tone: one sentence about the overall tone for this recipient.',
    ].join('\n');
  },
  schema: (v) => mailRefineSchema(v),
};
