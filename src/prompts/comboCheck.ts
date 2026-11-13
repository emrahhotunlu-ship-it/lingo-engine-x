import { z } from 'zod';
import { clip, header, langName, langOf } from './common';
import { looseBool } from './produceCheck';
import { correctionRules, withFixedGate } from './fixedGate';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// combo-check@3 (Emrahs Live-Rückmeldung 05.11.2026, Befund english-teacher): die Aufgabe hat eine Situation und einen Satzanfang (`starter`), der den
// Zusammenhang der Regel erzwingt; Claude wertet einen ignorierten Satzanfang ohne nötigen Zusammenhang als Regel falsch und baut eine Idee, die die Regel
// nicht braucht, um den Satzanfang herum. Die App prüft die Korrektur selbst nach: Past Perfect ohne späteres Ereignis/Zeitpunkt und Present Perfect
// Continuous ohne for/since/… im selben Satz sind ein Schemafehler (der eine Neuversuch, A6.3). Die Regel geht englisch an den Prompt (`rule_en`).
// combo-check@4 (Befund english-teacher, 13.11.2026): Present Perfect Continuous braucht eine Zeitangabe ODER ein Ergebnis jetzt, das die Dauer erklärt
// (auch in der Nachprüfung `PPC_ANCHOR`); Zustandsverben „normally“ statt „never“ (höfliches „will be needing“, „I'm hoping“ sind richtig). Ausgabe unverändert.
// combo-check@1: „Wort + Regel im selben Satz“ im Reiter Anwenden (Plan docs/umbau/anwenden-plan.md, Übung 2, Teil B).
// Emrah schreibt EINEN eigenen Satz mit einem Wort aus seinem Wortschatz und einer Grammatikregel. Ob das Wort im Satz
// steht, prüft die App selbst (lokal); Claude beurteilt nur die Regel und die Richtigkeit des Satzes. Zwei getrennte Urteile,
// damit ein Fehler nur dem Konto zugeordnet wird, das falsch war. Britische Schreibweisen gelten als richtig (A7.3).

export type ComboCheckVars = {
  word: string;
  /** Englischer Name des Grammatikthemas. */
  topic: string;
  /** Kurzregel, englisch (`rule_en`), sonst wie im Themenblatt. */
  rule: string;
  sentence: string;
  uiLang: UiLang;
  /** Themen-ID (für die Nachprüfung des Zusammenhangs der Korrektur); fehlt bei älteren Aufrufern. */
  topicId?: string;
  /** Situation der Aufgabe (englisch) und verlangter Satzanfang; fehlen ohne Rahmen. */
  situation?: string;
  starter?: string;
};

export type ComboCheckOut = {
  /** Ist die Regel im Satz richtig angewendet? */
  ruleOk: boolean;
  /** Ist der Satz insgesamt grammatisch richtig und natürlich? */
  correct: boolean;
  /** Korrigierte Fassung (nur nötig, wenn der Satz nicht richtig ist; sonst leer). */
  fixed: string;
  why: string;
  /** Die korrigierte Fassung hat die Selbstprüfung nicht bestanden (oder fehlt): `fixed` ist leer, die App zeigt „noch nicht sicher geprüft“. */
  fixedUnsure?: boolean;
};

const ID = 'combo-check';
const VERSION = 4;
export const COMBO_SENTENCE_MAX = 300;

export const COMBO_CHECK_EXAMPLE = '{"ruleOk":false,"correct":false,"fixed":"We have been working on the proposal since March.","why":"…"}';

export const comboCheck: PromptTemplate<ComboCheckVars, ComboCheckOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: { gcTime: 86_400_000 },
  build(v) {
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1) wrote ONE sentence of his own. He had to use a given word and apply a given grammar rule in the same sentence.',
      'You judge only two things: (1) is the grammar rule applied correctly in his sentence, (2) is the whole sentence correct, natural English. American English is the standard; British spelling and British words are correct too.',
      `Word he had to use: ${clip(v.word, 40)}`,
      `Grammar topic: ${clip(v.topic, 80)}`,
      `Rule: ${clip(v.rule, 400) || '(none)'}`,
      ...(v.situation?.trim() ? [`Situation: ${clip(v.situation, 200)}`] : []),
      ...(v.starter?.trim() ? [`Required sentence start: ${clip(v.starter, 80)}`] : []),
      `His sentence: ${clip(v.sentence, COMBO_SENTENCE_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object:',
      COMBO_CHECK_EXAMPLE,
      'Rules:',
      '- ruleOk: true only if the sentence really uses the given rule in the right form. A correct sentence that avoids the rule is ruleOk false.',
      ...(v.starter?.trim()
        ? ['- If he ignored the required sentence start AND his sentence lacks the context the rule needs (e.g. past perfect without a later past event or time), ruleOk is false.']
        : []),
      '- Present perfect continuous needs a time phrase (for, since, how long, lately, recently, all morning, this week, over the past …) or a present result it explains ("I\'ve been calling him, but he doesn\'t answer").',
      '- State verbs (know, own, belong, consist, seem) normally do not take a continuous form; polite "will be needing" and "I\'m hoping" are fine. Perfect forms of state verbs need a time frame (for, since, always, never, ever) or a second past event.',
      '- correct: true only if there is no grammar, word-choice or spelling mistake anywhere in the sentence.',
      '- fixed: if correct is false or ruleOk is false, the corrected sentence in American English that keeps his idea and his word, uses the rule correctly and sounds natural to a native speaker. If the rule needs a context to make sense (e.g. past perfect needs a later past event or time: "By the time we migrated, they had lacked …"), add the shortest natural clause that provides it. Never return a sentence that uses the form without the context it needs. If correct is true and ruleOk is true, an empty string.',
      `  If his idea does not need the rule, keep his word and his topic, rebuild the sentence around the ${v.starter?.trim() ? 'required start' : 'context the rule needs'}, and say in why in one sentence which tense his own idea would need.`,
      ...correctionRules(),
      '- why: at most 3 short sentences in the explanation language: what is right, or each mistake on its own with its reason. Name the German habit if it caused the mistake.',
      '- No straight double quotes inside the strings.',
    ].join('\n');
  },
  schema: (v) => schemaFor(v, false),
  lenient: (v) => schemaFor(v, true),
};

/** Past Perfect braucht ein späteres Ereignis oder einen Zeitpunkt im selben Satz. */
const PAST_PERFECT = /\bhad(?:\s+(?:not|never|already|just|also|always|only|recently))?\s+(?:been|done|gone|made|had|got|gotten|sent|lost|spent|built|bought|brought|thought|told|sold|left|met|paid|found|kept|held|run|begun|come|become|seen|known|taken|given|written|chosen|heard|felt|won|set|put|cut|[a-z]+ed|[a-z]+en)\b/i;
const PAST_ANCHOR = /\b(by the time|by the end of|by that time|before|after|when|until|by then|already|earlier|previously|because|prior to|once|by (january|february|march|april|may|june|july|august|september|october|november|december|\d{4})|for (years|months|weeks)|for \d+)\b/i;
/** Present Perfect Continuous braucht for/since/how long/lately/recently/all day … */
const PPC = /\b(?:have|has|'ve|'s)(?:\s+(?:not|never|just|also|always))?\s+been\s+[a-z]+ing\b/i;
/** Bezug: Zeitangabe oder ein Ergebnis jetzt, das die Dauer erklärt („I've been calling him, but he doesn't answer“, „…, so I'm behind“). */
const PPC_ANCHOR = /\b(for|since|how long|lately|recently|these days|over the (past|last)|all (day|week|month|morning|afternoon|evening|year)|this (morning|afternoon|week|month|quarter|year)|that's why|which is why|which explains)\b|,\s*(but|so)\s/i;

/** Fehlt der Korrektur der Zusammenhang, den die Regel braucht? Dann die Meldung (englisch, geht beim einen Neuversuch an Claude). */
export function comboContextProblem(topicId: string | undefined, fixed: string): string | null {
  const f = fixed.replace(/[’‘]/g, "'");
  if (!f.trim()) return null;
  if (topicId === 'past-perfect' && PAST_PERFECT.test(f) && !PAST_ANCHOR.test(f)) return 'past perfect needs a later past event or time in the same sentence';
  if (topicId === 'pres-perf-cont' && PPC.test(f) && !PPC_ANCHOR.test(f)) return 'present perfect continuous needs a time phrase (for, since, how long, lately, recently, all morning, this week, over the past …) or a present result it explains in the same sentence';
  return null;
}

function schemaFor(v: ComboCheckVars, lenient: boolean): z.ZodType<ComboCheckOut> {
  return withContext(v, lenient, withFixedGate<ComboCheckOut>(
    z
      .object({
        ruleOk: z.preprocess(looseBool, z.boolean()),
        correct: z.preprocess(looseBool, z.boolean()),
        fixed: z.preprocess((x) => (x === undefined || x === null ? '' : x), clipped(0, 400)),
        why: clipped(1, 400),
      })
      .superRefine(langOf(['why'], v.uiLang)),
    // english-teacher 05.11.2026: auch „Satz richtig, Regel vermieden“ braucht eine Korrektur, die die Regel zeigt.
    { needs: (o) => !o.correct || !o.ruleOk, lenient },
  ));
}

/** Nachprüfung des Zusammenhangs: streng ein Schemafehler (der eine Neuversuch), beim Neuversuch wird die Korrektur geleert („noch nicht sicher geprüft“). */
function withContext(v: ComboCheckVars, lenient: boolean, schema: z.ZodType<ComboCheckOut>): z.ZodType<ComboCheckOut> {
  return schema.transform((o, ctx) => {
    const problem = comboContextProblem(v.topicId, o.fixed);
    if (!problem) return o;
    if (lenient) return { ...o, fixed: '', fixedUnsure: true };
    ctx.addIssue({ code: 'custom', path: ['fixed'], message: problem });
    return o;
  });
}
