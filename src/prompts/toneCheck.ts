import { z } from 'zod';
import { TONE_REGISTERS, type ToneRegister } from '../content/tones/messages';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import type { ToneCorrection, ToneFeedback, ToneVerdict, ToneVersion } from '../domain/tones/tones';
import { block, clip, fenced, header, langName, langOf } from './common';
import { englishText } from './inputCommon';
import { clipped, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// tone-check@1 (Lernberatung 27.09., Vorschlag 8 „Eine Botschaft, drei Tonlagen“): prüft drei
// Fassungen desselben Sachverhalts – Slack an einen Kollegen, Mail an den CFO des Kunden, Satz im
// Meeting – auf den TON (zu direkt, zu steif, passend) mit kurzer Begründung und Musterfassung je
// Tonlage. Dazu nur ECHTE Fehler (Grammatik, Wortwahl) als `corrections`; die gehen als
// Reparatur-Sätze in die Wiederholung. Britische Formen sind richtig (A7.3). `default`,
// zwischengespeichert. Die Anführungszeichen-Regel hängt das KI-Tor an (QUOTE_RULE).

export type ToneCheckVars = {
  /** Sachverhalt auf Englisch (Datenzeile). */
  message: string;
  texts: Readonly<Record<ToneRegister, string>>;
  uiLang: UiLang;
};

export type ToneCheckOut = ToneFeedback;

export const TONE_CHECK_TEXT_MAX = 900;
export const TONE_MESSAGE_MAX = 300;
export const TONE_WHY_MAX = 240;

const ID = 'tone-check';
const VERSION = 1;

/** Beschreibung der Tonlage im Prompt (englisch, fest). */
export const REGISTER_BRIEF: Readonly<Record<ToneRegister, string>> = {
  slack: 'a Slack message to a colleague on the same team (casual, short, friendly)',
  cfo: "an email to the customer's CFO (formal but warm, clear, diplomatic, no slang)",
  meeting: 'one or two sentences said out loud in a meeting with the customer (spoken, clear, confident, polite)',
};

export function toneCheckExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    versions: [
      { reg: 'slack', tone: 'fits', why: de ? 'Locker und knapp – genau richtig unter Kollegen.' : 'Casual and short – just right between colleagues.', model: "Heads-up: the archive migration is slipping by two weeks – the export is taking longer than planned. I'll update the timeline today." },
      { reg: 'cfo', tone: 'too_direct', why: de ? 'Die Nachricht kommt ohne Einleitung und ohne Lösung; das wirkt schroff.' : 'The news comes without any lead-in or solution, which feels abrupt.', model: 'Dear Ms. Keller, I am writing to let you know that the archive migration will take about two weeks longer than planned, as the export from the legacy system needs more time. We have adjusted the plan so that your year-end closing is not affected. I would be happy to walk you through the new timeline this week.' },
      { reg: 'meeting', tone: 'too_stiff', why: de ? 'Im Gespräch klingt der Mailstil zu förmlich.' : 'The email style sounds too formal when spoken.', model: "Quick update on the migration: we're looking at about two extra weeks, mainly because the export is slower than expected." },
    ],
    corrections: [{ reg: 'cfo', wrong: 'will delay for two weeks', right: 'will be delayed by two weeks', why: de ? 'Verschieben um: „be delayed by“.' : 'Postponed by a period: “be delayed by”.' }],
    tip: de ? 'Gleiche Fakten, anderer Rahmen: Beim CFO zuerst Wirkung und Lösung, bei Kollegen direkt zur Sache.' : 'Same facts, different frame: with the CFO lead with impact and solution, with colleagues get straight to the point.',
  });
}

const TONE_ALIASES: ReadonlyArray<[RegExp, ToneVerdict]> = [
  [/^(too[\s_-]?direct|direct|blunt|too[\s_-]?blunt|rude|harsh|too[\s_-]?casual|too[\s_-]?informal)$/, 'too_direct'],
  [/^(too[\s_-]?stiff|stiff|too[\s_-]?formal|formal|wooden|bureaucratic)$/, 'too_stiff'],
  [/^(fits|fit|appropriate|good|ok|okay|right|suitable|fine|just[\s_-]?right)$/, 'fits'],
];
/** Tonurteil tolerant lesen („too formal“ → too_stiff, „appropriate“ → fits). */
export function toneVerdict(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  return TONE_ALIASES.find(([re]) => re.test(s))?.[1] ?? v;
}
/** Tonlage tolerant lesen („Slack“, „email“, „CFO email“, „spoken“). */
export function toneReg(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if ((TONE_REGISTERS as readonly string[]).includes(s)) return s;
  if (/slack|chat|colleague/.test(s)) return 'slack';
  if (/cfo|mail|e-mail|email/.test(s)) return 'cfo';
  if (/meeting|spoken|oral|said/.test(s)) return 'meeting';
  return v;
}

/** `versions` als Liste oder als Objekt je Tonlage (`{slack: {...}, cfo: {...}}`). */
const asVersionList = (v: unknown): unknown => {
  if (Array.isArray(v) || !v || typeof v !== 'object') return v;
  return Object.entries(v as Record<string, unknown>).map(([reg, x]) => (x && typeof x === 'object' && !Array.isArray(x) ? { reg, ...(x as Record<string, unknown>) } : x));
};

export function toneCheckSchema(vars: Pick<ToneCheckVars, 'texts' | 'uiLang'>): z.ZodType<ToneCheckOut> {
  const msg = `must be written in ${langName(vars.uiLang)}`;
  const reg = z.preprocess(toneReg, z.enum(TONE_REGISTERS));
  const version = z.object({ reg, tone: z.preprocess(toneVerdict, z.enum(['too_direct', 'too_stiff', 'fits'])), why: clipped(1, TONE_WHY_MAX), model: englishText(1, 900) });
  const correction = z.object({ reg, wrong: clipped(1, 300), right: englishText(1, 400), why: clipped(1, TONE_WHY_MAX) });
  return z
    .object({
      versions: z.preprocess(asVersionList, z.array(version).min(1).max(6)),
      corrections: z.preprocess((v) => (v == null ? [] : v), sliced(correction, 0, 6)),
      tip: clipped(1, TONE_WHY_MAX),
    })
    .superRefine((v, ctx) => {
      for (const r of TONE_REGISTERS) {
        if (!v.versions.some((x) => x.reg === r)) ctx.addIssue({ code: 'custom', path: ['versions'], message: `missing the "${r}" version` });
      }
      v.versions.forEach((x, i) => {
        if (isWrongLang(x.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['versions', i, 'why'], message: msg });
      });
      v.corrections.forEach((c, i) => {
        if (isWrongLang(c.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['corrections', i, 'why'], message: msg });
      });
      langOf(['tip'], vars.uiLang)(v, ctx);
    })
    .transform((v): ToneCheckOut => {
      // Je Tonlage genau eine Fassung, in fester Reihenfolge.
      const versions = TONE_REGISTERS.map((r) => v.versions.find((x) => x.reg === r)).filter((x): x is ToneVersion => !!x);
      // Nur echte Fehler, die wörtlich in der jeweiligen Fassung stehen (nie raten); kein Neuversuch dafür.
      const corrections: ToneCorrection[] = v.corrections.filter((c) => c.wrong.trim().toLowerCase() !== c.right.trim().toLowerCase() && containsPhrase(vars.texts[c.reg] ?? '', c.wrong));
      return { versions, corrections, tip: v.tip };
    });
}

export const toneCheck: PromptTemplate<ToneCheckVars, ToneCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(v) {
    const parts = TONE_REGISTERS.flatMap((r, i) => [`Version ${i + 1} – ${r}: ${REGISTER_BRIEF[r]}`, fenced(block(v.texts[r] ?? '', TONE_CHECK_TEXT_MAX))]);
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English coach. Your learner is a German-speaking head of business development at a cloud provider',
      'for document management (B2, aiming for C1). German speakers often sound too direct or too formal in English. He wrote the SAME',
      'message three times for three audiences. Judge mainly the TONE of each version for its audience.',
      'American English is the standard. British spelling and British words are ALWAYS correct: never list them as corrections.',
      `Message: ${clip(v.message, TONE_MESSAGE_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      ...parts,
      'Reply with only one JSON object, no other text, exactly this shape:',
      toneCheckExample(v.uiLang),
      'Rules:',
      '- versions: exactly one item per version, reg = "slack", "cfo" or "meeting".',
      '  tone = "too_direct" (blunt, abrupt, too casual or pushy for this audience), "too_stiff" (too formal, wordy or bureaucratic for this audience) or "fits".',
      '  why = one short sentence in the explanation language about the tone; model = a natural American English model version for this audience with the same facts',
      '  (Slack: 1–2 short sentences; email: a short email of 2–4 sentences with greeting; meeting: 1–2 spoken sentences).',
      '- corrections: 0–6 real mistakes only (grammar, word choice, collocation, word order), not tone or style. reg = the version it is in;',
      '  wrong = the exact words from that version (copy them character for character, a short excerpt), right = the corrected excerpt, why = one short sentence in the explanation language.',
      '- tip: one short sentence in the explanation language: the most useful lesson about switching tone.',
    ].join('\n');
  },
  schema: (v) => toneCheckSchema(v),
};
