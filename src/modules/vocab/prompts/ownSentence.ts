import { z } from 'zod';
import { clip, clipped, correctionRules, header, langName, withFixedGate, type PromptTemplate, type UiLang } from '../shared';
import { asRecheck, blank, falseFriendRule, flat, hasTarget, recheckLines, sharedRules, SPOKEN_RULE, targetLine, verdictRules, type FirstVerdict, type VocabTarget } from './common';
import { checkExtra, checkFixed, isError, judgeOne, rawExtra, rawJudgement, type ExtraFix, type WordJudgement } from './judge';

// vocab-own-sentence@1 (Großpaket A Schritt 5; synthese.md M33 und §2.5): eigener Satz mit einem Zielwort. Stufe 5 gelenkt (eine Lage auf Deutsch:
// „Sag dem Kunden, dass …“), Stufe 6 frei. Urteil wie im Transfer (✓ ok · ~ odd · ✕ wrong · thin · unused) mit einem Satz Begründung, höchstens ein weiterer
// Fehler, minimal korrigierte Fassung und eine verdeckte Vergleichsfassung (`better`) für „Nochmal selbst schreiben“. Die Note rechnet die App.
// `default`, kein Zwischenspeicher; Einspruch = `ownSentenceRecheck`. Ein Neuversuch nur bei Schemaverletzung (A6.3).

export const OWN_SENTENCE_MAX = 400;
export const OWN_TASK_MAX = 240;
export const OWN_BETTER_MAX_WORDS = 25;

export type OwnSentenceVars = {
  target: VocabTarget;
  sentence: string;
  /** Stufe 5: Lage, wie die App sie zeigt (Oberflächensprache); `null` = freier Satz (Stufe 6). */
  task: string | null;
  spoken: boolean;
  uiLang: UiLang;
  /** Einspruch: das erste Urteil (zweite, unabhängige Prüfung; `sample` hat kein Gedächtnis). */
  first?: Omit<FirstVerdict, 'key'>;
};

export type OwnSentenceOut = Omit<WordJudgement, 'key'> & {
  extra: ExtraFix | null;
  /** Minimal korrigierte Fassung; "" wenn nichts zu korrigieren ist. */
  fixed: string;
  fixedUnsure?: boolean;
  /**
   * Verdeckte Vergleichsfassung: die eigene Idee, so wie ein flüssiger amerikanischer Profi sie sagen würde, mit dem Zielwort im selben Sinn
   * (english-teacher Befund 6; erst nach „Nochmal selbst schreiben“ aufgedeckt); "" ohne.
   */
  better: string;
};

export const OWN_SENTENCE_EXAMPLE = '{"v":"odd","err":"prep","at":"…","why":"…","extra":null,"fixed":"…","better":"…"}';

const ID = 'vocab-own-sentence';
const VERSION = 1;
const KEY = 'w1';

const needsFix = (o: Pick<OwnSentenceOut, 'v' | 'extra'>): boolean => isError(o) || o.extra !== null;
const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

function schemaFor(v: OwnSentenceVars, lenient: boolean): z.ZodType<OwnSentenceOut> {
  const t: VocabTarget = { ...v.target, key: KEY };
  const opts = (path: PropertyKey[]) => ({ text: v.sentence, lang: v.uiLang, lenient, spoken: v.spoken, path });
  const inner = z
    .object({
      ...rawJudgement,
      extra: rawExtra,
      fixed: z.preprocess(blank, clipped(0, OWN_SENTENCE_MAX * 2)),
      better: z.preprocess(blank, clipped(0, 300)),
    })
    .transform((raw, ctx): OwnSentenceOut => {
      const w = judgeOne(t, raw, ctx, opts([]));
      const extra = checkExtra(raw.extra, [w], ctx, opts(['extra']));
      const fixed = checkFixed(raw.fixed, [t], [w], needsFix({ v: w.v, extra }), ctx, opts(['fixed']));
      // Vergleichsfassung: muss das Wort enthalten, kurz sein und darf weder der eigene Satz noch der Beispielsatz sein; sonst leer (kein Neuversuch nötig).
      const b = raw.better.trim();
      const better = b && hasTarget(b, t) && wordCount(b) <= OWN_BETTER_MAX_WORDS && flat(b) !== flat(v.sentence) && flat(b) !== flat(t.example ?? '') ? b : '';
      return { v: w.v, err: w.err, at: w.at, why: w.why, extra, fixed, better };
    });
  return withFixedGate<OwnSentenceOut>(inner, { needs: needsFix, lenient });
}

export const ownSentence: PromptTemplate<OwnSentenceVars, OwnSentenceOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const t: VocabTarget = { ...v.target, key: KEY };
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1, business English) wrote their own sentence with the target word below. Judge how the word is used.',
      ...(v.task
        ? [`Situation (shown to the learner in ${langName(v.uiLang)}; the sentence should fit it): ${clip(v.task, OWN_TASK_MAX)}`]
        : ['The learner chose the situation freely.']),
      `Target: ${targetLine(t)}`,
      `Learner sentence: ${clip(v.sentence, OWN_SENTENCE_MAX)}`,
      ...(v.spoken ? [SPOKEN_RULE] : []),
      ...(v.first ? recheckLines([{ key: KEY, ...v.first }]) : []),
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object in this format:',
      OWN_SENTENCE_EXAMPLE,
      'Rules:',
      ...verdictRules('sentence'),
      ...(v.task
        ? ['- The situation is only a frame: if the sentence does not address the situation at all, it is "thin" (the word was not used for the task). Never judge the opinion or the decision the learner chose.']
        : []),
      '- extra: at most one other clear error in the sentence (not at the target word) as {"from": exact words from the sentence, "to": the correction, "why": one sentence}; null if there is none or if v is "odd" or "wrong".',
      '- fixed: "" if v is not "odd" or "wrong" and extra is null. Otherwise the learner sentence with the errors fixed:',
      ...correctionRules(),
      '  Keep the target word if the learner used it correctly. Do not rewrite the sentence in your own style and do not add new or rarer words. Besides the errors you explain, fix only clear errors; never change style, and do not report these extra fixes anywhere.',
      `- better: the learner's own idea, rewritten as a fluent American professional would say it in this situation, using the target word in the meaning given (at most ${OWN_BETTER_MAX_WORDS} words). Use only the learner's words, the target and very common words; never a word rarer than the target. Give it also when v is "ok".`,
      falseFriendRule(),
      ...sharedRules(),
    ].join('\n');
  },
  schema: (v) => schemaFor(v, false),
  lenient: (v) => schemaFor(v, true),
};

/** Einspruch „War das auch richtig?“: einmal, nur auf Antippen, `complex`, ohne Zwischenspeicher; das erste Urteil (`first`) ist Pflicht. */
export const ownSentenceRecheck = asRecheck<OwnSentenceVars, OwnSentenceOut, Omit<FirstVerdict, 'key'>>(ownSentence);
