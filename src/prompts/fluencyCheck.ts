import { z } from 'zod';
import { containsPhrase } from '../domain/chunks/newChunk';
import { isWrongLang } from '../domain/lang/detect';
import { block, clip, fenced, header, langName, langOf } from './common';
import { englishText } from './inputCommon';
import { clipped, sliced } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// fluency-check@1 (Lernberatung 27.09., V6 / Vorschlag 5 „Flüssigkeit 90 – 60 – 45“): dieselbe
// Antwort auf eine Berufsfrage dreimal, jedes Mal kürzer (90 s, 60 s, 45 s). Claude beschreibt in
// Worten, was von Runde zu Runde flüssiger bzw. knapper wurde (kein Punktestand, Kap. 2.3), nennt
// zwei Wendungen, die gefehlt haben (mit Beispielsatz = Ursprungssatz der Wendung), und höchstens
// drei echte Fehler (Emrahs Ausschnitt → richtig, Grund). Britische Formen gelten als richtig
// (A7.3). `default`, zwischengespeichert wie say-check. Die Anführungszeichen-Regel hängt das KI-Tor an.

export type FluencyRoundVar = { sec: number; text: string };
export type FluencyCheckVars = { question: string; rounds: readonly FluencyRoundVar[]; uiLang: UiLang };

export type FluencyPhraseOut = { phrase: string; de: string; def: string; example: string };
export type FluencyCorrectionOut = { wrong: string; right: string; why: string };
export type FluencyCheckOut = { progress: string; missing: FluencyPhraseOut[]; corrections: FluencyCorrectionOut[] };

export const FLUENCY_ROUND_TEXT_MAX = 1500;
export const FLUENCY_QUESTION_MAX = 300;

const ID = 'fluency-check';
const VERSION = 1;

export function fluencyCheckExample(uiLang: UiLang): string {
  const de = uiLang === 'de';
  return JSON.stringify({
    progress: de
      ? 'In Runde 3 kommst du ohne Umwege zum Kern: erst der Nutzen, dann ein Beispiel. Die Füllwörter aus Runde 1 sind fast weg.'
      : 'In round 3 you get straight to the point: benefit first, then one example. Most of the fillers from round 1 are gone.',
    missing: [
      { phrase: 'the bottom line is', de: 'unterm Strich', def: 'the most important point or result', example: 'The bottom line is that you save time on every single invoice.' },
      { phrase: 'pay for itself', de: 'sich rechnen, sich amortisieren', def: 'to save as much money as it costs', example: 'In most cases the archive will pay for itself within a year.' },
    ],
    corrections: [{ wrong: 'we are doing this since ten years', right: "we've been doing this for ten years", why: de ? 'Dauer bis heute: Present Perfect Continuous und „for“.' : 'A duration up to now: present perfect continuous with "for".' }],
  });
}

/** Wendung, die nicht wörtlich im Beispielsatz steht oder ohne Bedeutung kommt, fällt weg (kein Neuversuch dafür). */
const usable = (p: FluencyPhraseOut): boolean => !!(p.phrase && p.de && p.def && p.example && containsPhrase(p.example, p.phrase) && !isWrongLang(p.def, 'en'));

export function fluencyCheckSchema(vars: Pick<FluencyCheckVars, 'uiLang'>): z.ZodType<FluencyCheckOut> {
  const msg = `must be written in ${langName(vars.uiLang)}`;
  return z
    .object({
      progress: clipped(1, 500),
      missing: z
        .preprocess(
          (v) => (v == null ? [] : v),
          sliced(z.object({ phrase: clipped(1, 80), de: clipped(1, 120), def: clipped(1, 160), example: englishText(1, 240) }), 0, 4),
        )
        .transform((list) => list.filter(usable).slice(0, 2)),
      corrections: z.preprocess((v) => (v == null ? [] : v), sliced(z.object({ wrong: clipped(1, 300), right: englishText(1, 400), why: clipped(1, 240) }), 0, 3)),
    })
    .superRefine((v, ctx) => {
      langOf(['progress'], vars.uiLang)(v, ctx);
      v.corrections.forEach((c, i) => {
        if (isWrongLang(c.why, vars.uiLang)) ctx.addIssue({ code: 'custom', path: ['corrections', i, 'why'], message: msg });
      });
    });
}

export const fluencyCheck: PromptTemplate<FluencyCheckVars, FluencyCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: true,
  build(vars) {
    const rounds = vars.rounds.slice(0, 3).flatMap((r, i) => [`Round ${i + 1} (${Math.round(r.sec)} seconds):`, fenced(block(r.text, FLUENCY_ROUND_TEXT_MAX) || '(no answer)')]);
    return [
      header({ id: ID, version: VERSION }),
      'You are an experienced Business English teacher and C1 examiner. Your learner is a German-speaking head of business development',
      'at a cloud provider for document management (B2, aiming for C1). He did a 4-3-2 fluency exercise: he answered the same question',
      'three times, first in 90 seconds, then in 60, then in 45, spoken (speech recognition, so ignore missing punctuation and capitalization) or typed.',
      'American English is the standard. British spelling and British words are ALWAYS correct: never list them as corrections.',
      `Question: ${clip(vars.question, FLUENCY_QUESTION_MAX)}`,
      `Explanation language: ${langName(vars.uiLang)}`,
      ...rounds,
      'Reply with only one JSON object, no other text, exactly this shape:',
      fluencyCheckExample(vars.uiLang),
      'Rules:',
      '- progress: 2–3 short sentences in the explanation language: what became more fluent or more concise from round to round',
      '  (structure, fillers, repetitions, getting to the point). Be specific and honest, no score, no grades.',
      '- missing: exactly 2 useful expressions (2–8 words) that would have made this answer stronger and that he did not use.',
      '  phrase = the expression, de = its German meaning, def = a short English definition,',
      '  example = one natural American English sentence for this question that contains the phrase word for word.',
      '- corrections: 0–3 real mistakes (grammar, word choice, collocation, word order), most important first. No style-only corrections.',
      '  wrong = the exact words from one of the rounds (copy them character for character, a short excerpt),',
      '  right = the corrected excerpt in American English, why = one short sentence in the explanation language.',
    ].join('\n');
  },
  schema: (vars) => fluencyCheckSchema(vars),
};
