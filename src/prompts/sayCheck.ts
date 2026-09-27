import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { block, clip, fenced, header, langName, langOf } from './common';
import { englishText } from './inputCommon';
import { clipped, phraseIn, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// say-check@1 (Lernberatung 27.09., V1/V2 „Sag es“): prüft eine frei formulierte Antwort von
// 3–6 Sätzen auf eine Situation. Drei Schichten: Korrekturen (Emrahs Ausschnitt → richtig, Grund),
// höchstens zwei C1-Aufwertungen (Ton, Abschwächung, Präzision) und die ganze Antwort in
// natürlichem US-Englisch auf C1. Dieselbe Vorlage prüft auch den zweiten Durchgang.
// Britische Formen gelten als richtig (A7.3). `default`, zwischengespeichert wie writing-review.
// Die Anführungszeichen-Regel hängt das KI-Tor an (QUOTE_RULE).

export type SayCheckVars = {
  /** Die Situation auf Englisch (Datenzeile). */
  situation: string;
  kind: 'job' | 'life';
  text: string;
  uiLang: UiLang;
};

export type SayCorrectionOut = { wrong: string; right: string; why: string };
export type SayUpgradeOut = { from: string; to: string; why: string; phrase: string; de: string; def: string };
export type SayCheckOut = { corrections: SayCorrectionOut[]; upgrades: SayUpgradeOut[]; better: string; praise: string };

export const SAY_CHECK_TEXT_MAX = 1500;
export const SAY_SITUATION_MAX = 300;

const ID = 'say-check';
const VERSION = 1;

export function sayCheckExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    corrections: [
      { wrong: 'we are working with them since 2019', right: 'we have been working with them since 2019', why: de ? 'Seit einem Zeitpunkt bis heute: Present Perfect Continuous.' : 'From a point in the past until now: present perfect continuous.' },
    ],
    upgrades: [
      { from: 'This is too expensive for us.', to: 'I understand the price may seem high at first glance.', why: de ? 'Abgeschwächt und verständnisvoll statt direkt.' : 'Softer and more understanding than a blunt statement.', phrase: 'at first glance', de: 'auf den ersten Blick', def: 'when you first look at something' },
    ],
    better: 'I understand the price may seem high at first glance. However, …',
    praise: de ? 'Klarer Aufbau und ein guter Vorschlag am Ende.' : 'Clear structure and a good suggestion at the end.',
  });
}

/** Wendung leeren, wenn sie nicht wörtlich in `to` steht oder `de`/`def` fehlen – kein Neuversuch dafür. */
function tidyUpgrade(u: SayUpgradeOut): SayUpgradeOut {
  const ok = u.phrase && u.de && u.def && (containsPhrase(u.to, u.phrase) || phraseIn(u.to, u.phrase)) && !isWrongLang(u.def, 'en');
  return ok ? u : { ...u, phrase: '', de: '', def: '' };
}

export function sayCheckSchema(vars: Pick<SayCheckVars, 'text' | 'uiLang'>): z.ZodType<SayCheckOut> {
  const textLen = Array.from(vars.text).length;
  const opt = (max: number) => z.preprocess((v) => (typeof v === 'string' ? v : ''), z.string().trim().max(max));
  const msg = `must be written in ${langName(vars.uiLang)}`;
  return z
    .object({
      corrections: z.preprocess(
        (v) => (v == null ? [] : v),
        sliced(z.object({ wrong: clipped(1, 300), right: englishText(1, 400), why: clipped(1, 240) }), 0, 4),
      ),
      upgrades: z.preprocess(
        (v) => (v == null ? [] : v),
        sliced(
          z.object({ from: clipped(1, 300), to: englishText(1, 400), why: clipped(1, 240), phrase: opt(80), de: opt(120), def: opt(160) }).transform(tidyUpgrade),
          0,
          2,
        ),
      ),
      better: englishText(1, Math.max(600, Math.round(textLen * 1.6) + 200)),
      praise: clipped(1, 240),
    })
    .superRefine((v, ctx) => {
      langOf(['praise'], vars.uiLang)(v, ctx);
      v.corrections.forEach((c, i) => {
        if (isWrongLang(c.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['corrections', i, 'why'], message: msg });
      });
      v.upgrades.forEach((u, i) => {
        if (isWrongLang(u.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['upgrades', i, 'why'], message: msg });
      });
    });
}

export const sayCheck: PromptTemplate<SayCheckVars, SayCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(vars) {
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English teacher and C1 examiner. Your learner is a German-speaking head of business development',
      'at a cloud provider for document management (B2, aiming for C1). He answered a short situation freely in 3–6 sentences.',
      'American English is the standard. British spelling and British words are ALWAYS correct: never list them as corrections.',
      `Situation (${vars.kind === 'job' ? 'work' : 'everyday life'}): ${clip(vars.situation, SAY_SITUATION_MAX)}`,
      `Explanation language: ${langName(vars.uiLang)}`,
      'Learner answer:',
      fenced(block(vars.text, SAY_CHECK_TEXT_MAX)),
      'Reply with only one JSON object, no other text, exactly this shape:',
      sayCheckExample(vars.uiLang),
      'Rules:',
      '- corrections: 0–4 real mistakes (grammar, word choice, collocation, word order), most important first.',
      '  wrong = the exact words from the learner answer (copy them character for character, a short excerpt, not the whole answer),',
      '  right = the corrected excerpt in American English, why = one short sentence in the explanation language. No corrections for style only.',
      '- upgrades: 0–2 C1 upgrades of tone, hedging/diplomacy or precision for sentences that are correct but plain.',
      '  from = the learner\'s words, to = the upgraded sentence, why = one short sentence in the explanation language,',
      '  phrase = the key expression (2–8 words) that appears word for word in "to", de = its German meaning, def = a short English definition.',
      '- better: the whole answer rewritten in natural American English at C1 level, same content and roughly the same length, suitable for the situation.',
      '- praise: one short, specific sentence in the explanation language about what was good.',
    ].join('\n');
  },
  schema: (vars) => sayCheckSchema(vars),
};
