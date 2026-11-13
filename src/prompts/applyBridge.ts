import { z } from 'zod';
import { isWrongLang } from '../domain/lang/detect';
// Dritte Tür des Wörter-Moduls (tests/unit/vocab/isolation.test.ts): EIN Wortlaut der Urteilsregeln je Zielwort für die Wörter-App und für Anwenden.
import {
  blank,
  checkExtra,
  checkFixed,
  falseFriendRule,
  hasTarget,
  isError,
  judgeOne,
  rawExtra,
  rawJudgement,
  sharedRules,
  targetLine,
  verdictRules,
  WHY_MAX,
  type ExtraFix,
  type VocabTarget,
  type WordJudgement,
} from '../modules/vocab/prompts';
import { comboContextProblem } from './comboCheck';
import { clip, header, langName } from './common';
import { correctionRules, withFixedGate } from './fixedGate';
import { clipped } from './tolerant';
import type { PromptTemplate, UiLang } from './types';

// apply-bridge@1 (Großpaket P „Politur“, P4 „Anwenden als Brücke“; Entscheidung E2 vom 13.11.2026): EIN eigener Satz mit einem Zielwort aus der
// Wörter-App und einem Grammatik-Muster. Zwei getrennte Urteile, damit ein Fehler nur dem Konto zugeordnet wird, das falsch war:
//  - `word`: Urteil am Zielwort wie beim eigenen Satz der Wörter-App (✓ ok · ~ odd · ✕ wrong · thin · unused; Fehlerklasse, Fundstelle, ein Satz
//    Warum) mit derselben lokalen Gegenprüfung (`judgeOne`): gelernte Bedeutung und Kartensatz gehen mit, ein Satz zu nah am Kartensatz zählt nicht.
//  - `pat`: Urteil am Muster (ok · wrong · avoided = richtiger Satz ohne das Muster · unsure = nicht entscheidbar, nie geraten) mit Fundstelle und Warum.
//  - `extra`: höchstens ein weiterer klarer Fehler; `fixed`: kleinste richtige Fassung (nur bei Fehler); `better`: Profi-Fassung mit Wort UND Muster;
//    `keep`: „Merk dir“, ein Satz mit höchstens 12 Wörtern.
// Die App rechnet daraus Belege und Noten selbst (nie Claude). Stufe `default`, kein Zwischenspeicher (jede Prüfung ist neu), nur auf Antippen;
// ein Neuversuch ausschließlich bei Schemaverletzung (A6.3), dann gilt `lenient` (Unsicheres fällt weg, statt die Antwort zu verwerfen).
// `combo-check@3` (Vorgänger, ein Urteil für Regel und Satz) bleibt als Datei für den alten Bildschirm „Eigener Satz“.

export type BridgePatVars = {
  id: string;
  /** Englischer Name („third conditional · missed chance“). */
  name: string;
  /** Englische Formel („if + Past Perfect, would have + participle“). */
  form: string;
  /** Wofür (englisch, 1–2 Sätze). */
  use: string;
  /** Ein Beispielsatz des Musters. */
  example: string;
  /** Typischer Fehler Deutscher mit richtiger Fassung. */
  trap?: { bad: string; good: string } | null;
};

export type BridgeVars = {
  word: Omit<VocabTarget, 'key'>;
  pat: BridgePatVars;
  /** Situation der Aufgabe (englisch) und vorgeschlagener Satzanfang; fehlen ohne Rahmen. */
  situation?: string;
  starter?: string;
  sentence: string;
  uiLang: UiLang;
  /** Berufsprofil-Zeile (`tutorCtx`), ≤ 200. */
  ctx?: string;
};

export type PatVerdict = 'ok' | 'wrong' | 'avoided' | 'unsure';
export const PAT_VERDICTS: readonly PatVerdict[] = ['ok', 'wrong', 'avoided', 'unsure'];

export type BridgeOut = {
  word: Omit<WordJudgement, 'key'>;
  pat: { v: PatVerdict; at: string; why: string };
  extra: ExtraFix | null;
  /** Kleinste richtige Fassung; "" wenn nichts zu korrigieren ist. */
  fixed: string;
  fixedUnsure?: boolean;
  /** Profi-Fassung mit Zielwort und Muster; "" ohne. */
  better: string;
  /** „Merk dir“ (ein Satz, höchstens 12 Wörter); "" wenn Claude keinen brauchbaren geliefert hat. */
  keep: string;
};

const ID = 'apply-bridge';
const VERSION = 1;
const KEY = 'w1';
export const BRIDGE_SENTENCE_MAX = 400;
export const BRIDGE_BETTER_MAX_WORDS = 25;
export const BRIDGE_KEEP_WORDS = 12;
/** Etwas Luft über der genannten Grenze, bevor die App nachfragt (zusammengesetzte deutsche Wörter, zitierte Formen). */
const KEEP_HARD_WORDS = 15;
const AT_MAX = 120;

export const BRIDGE_EXAMPLE =
  '{"word":{"v":"ok","err":null,"at":"…","why":"…"},"pat":{"v":"wrong","at":"…","why":"…"},"extra":null,"fixed":"…","better":"…","keep":"…"}';

const PAT_ALIASES: ReadonlyArray<[RegExp, PatVerdict]> = [
  [/^(ok|correct|right|good|yes|used|✓|✔)$/, 'ok'],
  [/^(wrong|incorrect|error|false|no|✕|✗|x)$/, 'wrong'],
  [/^(avoided|avoid|unused|missing|not[\s_-]?used|absent|none|other)$/, 'avoided'],
  [/^(unsure|unclear|unknown|uncertain|cannot[\s_-]?tell|n\/a)$/, 'unsure'],
];

/** Tolerant: „correct“, „not used“, „unclear“ → die vier Werte; Unbekanntes bleibt stehen (das Schema lehnt es ab). */
export function patVerdictOf(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  for (const [re, out] of PAT_ALIASES) if (re.test(s)) return out;
  return v;
}

const flat = (s: string): string => s.toLowerCase().replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim();
const inText = (text: string, part: string): boolean => !!part.trim() && flat(text).includes(flat(part));
const wordCount = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Muster, deren Korrektur einen Bezugspunkt im selben Satz braucht (Nachprüfung wie in `combo-check@3`). */
const CONTEXT_TOPIC: Readonly<Record<string, string>> = {
  'pp.earlier': 'past-perfect',
  'pp.duration': 'past-perfect',
  'pc.duration': 'pres-perf-cont',
  'pc.since-for': 'pres-perf-cont',
  'pc.form': 'pres-perf-cont',
  'pc.recent': 'pres-perf-cont',
};

/** Fehlt der Korrektur der Zusammenhang, den das Muster braucht? Dann die Meldung (englisch, geht beim einen Neuversuch an Claude). */
export const bridgeContextProblem = (patId: string, fixed: string): string | null => comboContextProblem(CONTEXT_TOPIC[patId], fixed);

/** Steht das Zielwort im Satz (gebeugt, britisch geschrieben, Kollokation mit Einschüben)? Lokale Prüfung für den Punkt „steht im Satz“. */
export const bridgeWordInText = (sentence: string, word: Pick<VocabTarget, 'word' | 'kind'>): boolean => hasTarget(sentence, word);

/** Braucht das Ergebnis eine korrigierte Fassung? Fehler am Wort, falsches Muster oder ein weiterer Fehler. */
export const bridgeNeedsFix = (o: Pick<BridgeOut, 'word' | 'pat' | 'extra'>): boolean => isError(o.word) || o.pat.v === 'wrong' || o.extra !== null;

function schemaFor(v: BridgeVars, lenient: boolean): z.ZodType<BridgeOut> {
  const t: VocabTarget = { ...v.word, key: KEY };
  const sentence = clip(v.sentence, BRIDGE_SENTENCE_MAX);
  const opts = (path: PropertyKey[]) => ({ text: sentence, lang: v.uiLang, lenient, path });
  const patEnum = z.enum(PAT_VERDICTS as unknown as [PatVerdict, ...PatVerdict[]]);
  const inner = z
    .object({
      word: z.object(rawJudgement),
      pat: z.object({ v: z.preprocess(patVerdictOf, patEnum), at: z.preprocess(blank, clipped(0, AT_MAX)), why: z.preprocess(blank, clipped(0, WHY_MAX)) }),
      extra: rawExtra,
      fixed: z.preprocess(blank, clipped(0, BRIDGE_SENTENCE_MAX * 2)),
      better: z.preprocess(blank, clipped(0, 300)),
      keep: z.preprocess(blank, clipped(0, 200)),
    })
    .transform((raw, ctx): BridgeOut => {
      const issue = (path: PropertyKey[], message: string) => ctx.addIssue({ code: 'custom', path, message });
      const w = judgeOne(t, raw.word, ctx, opts(['word']));
      // Muster: Fundstelle nur wörtlich; „richtig“ und „falsch“ brauchen einen Beleg im Satz.
      let pv = raw.pat.v;
      const pAt = pv !== 'avoided' && pv !== 'unsure' && raw.pat.at && inText(sentence, raw.pat.at) ? raw.pat.at : '';
      if ((pv === 'ok' || pv === 'wrong') && !pAt) {
        if (!lenient) issue(['pat', 'at'], 'copy into "at" the exact words of the learner sentence that carry the pattern or the failed attempt; if there are none, use "avoided"');
        // Im Neuversuch: ein unbelegtes „richtig“ zählt nicht (kein Beleg ohne Fundstelle); ein unbelegtes „falsch“ bleibt mit seiner Begründung stehen.
        else if (pv === 'ok') pv = 'unsure';
      }
      let pWhy = raw.pat.why;
      if (!pWhy && !lenient) issue(['pat', 'why'], 'give one short reason for the pattern verdict');
      if (pWhy && isWrongLang(pWhy, v.uiLang)) {
        if (!lenient) issue(['pat', 'why'], `must be written in ${langName(v.uiLang)}`);
        else pWhy = '';
      }
      // Nie mehr als zwei Korrekturen auf einmal: ein weiterer Fehler fällt weg, sobald Wort oder Muster falsch sind (`checkExtra` regelt das Wort).
      const extra = pv === 'wrong' ? null : checkExtra(raw.extra, [w], ctx, opts(['extra']));
      const needs = bridgeNeedsFix({ word: w, pat: { v: pv, at: pAt, why: pWhy }, extra });
      const fixed = checkFixed(raw.fixed, [t], [w], needs, ctx, opts(['fixed']));
      // Profi-Fassung: muss das Zielwort enthalten, kurz sein und darf weder der eigene Satz noch der Kartensatz sein; sonst leer (kein Neuversuch).
      const b = raw.better.trim();
      const better = b && hasTarget(b, t) && wordCount(b) <= BRIDGE_BETTER_MAX_WORDS && flat(b) !== flat(sentence) && flat(b) !== flat(t.example ?? '') ? b : '';
      let keep = raw.keep.trim();
      if (!keep && !lenient) issue(['keep'], 'give one takeaway');
      if (keep && wordCount(keep) > KEEP_HARD_WORDS) {
        if (!lenient) issue(['keep'], `at most ${BRIDGE_KEEP_WORDS} words`);
        else keep = '';
      }
      if (keep && isWrongLang(keep, v.uiLang)) {
        if (!lenient) issue(['keep'], `must be written in ${langName(v.uiLang)}`);
        else keep = '';
      }
      return { word: { v: w.v, err: w.err, at: w.at, why: w.why }, pat: { v: pv, at: pAt, why: pWhy }, extra, fixed, better, keep };
    });
  const gated = withFixedGate<BridgeOut>(inner, { needs: bridgeNeedsFix, lenient });
  // Nachprüfung des Zusammenhangs (Past Perfect ohne späteres Ereignis, Present Perfect Continuous ohne for/since …): streng ein Schemafehler
  // (der eine Neuversuch), beim Neuversuch wird die Korrektur geleert („noch nicht sicher geprüft“).
  return gated.transform((o, ctx) => {
    const problem = bridgeContextProblem(v.pat.id, o.fixed);
    if (!problem) return o;
    if (lenient) return { ...o, fixed: '', fixedUnsure: true };
    ctx.addIssue({ code: 'custom', path: ['fixed'], message: problem });
    return o;
  });
}

export const applyBridge: PromptTemplate<BridgeVars, BridgeOut> = {
  id: ID,
  version: VERSION,
  tier: 'default',
  cache: false,
  build(v) {
    const t: VocabTarget = { ...v.word, key: KEY };
    const p = v.pat;
    return [
      header({ id: ID, version: VERSION }),
      'A German-speaking learner (B2, aiming for C1, business English) wrote ONE sentence of his own. The task: use the target word in the meaning he learned AND apply the target grammar pattern in the same sentence.',
      'Give two separate verdicts, one for the word and one for the pattern, so that an error is counted only for the part that was wrong. American English is the standard; British spelling, British words and British grammar are correct too.',
      ...(v.ctx?.trim() ? [`Learner work context: ${clip(v.ctx, 200)}`] : []),
      `Target word: ${targetLine(t)}`,
      `Target pattern: ${clip(p.id, 40)}: ${clip(p.name, 100)} | form: ${clip(p.form, 160)} | use: ${clip(p.use, 240)} | example: ${clip(p.example, 200)}`,
      ...(p.trap?.bad.trim() && p.trap.good.trim() ? [`Typical error of German speakers with this pattern: ${clip(p.trap.bad, 160)} → ${clip(p.trap.good, 160)}`] : []),
      ...(v.situation?.trim() ? [`Situation (shown to the learner; the sentence should fit it loosely): ${clip(v.situation, 200)}`] : []),
      ...(v.starter?.trim() ? [`Suggested sentence start (a help, not required): ${clip(v.starter, 80)}`] : []),
      `Learner sentence: ${clip(v.sentence, BRIDGE_SENTENCE_MAX)}`,
      `Explanation language: ${langName(v.uiLang)}`,
      'Reply with only one JSON object in this format:',
      BRIDGE_EXAMPLE,
      'Rules for "word" (the target word):',
      ...verdictRules('sentence'),
      'Rules for "pat" (the target pattern):',
      '- v: "ok" = the sentence really uses the target pattern, in the right form and with the context it needs. "wrong" = the learner tried to use the pattern, but the form or its use is wrong (wrong tense or verb form, a missing part, wrong word order, or the pattern does not fit what the sentence says). "avoided" = the sentence does not use the target pattern at all (a different structure), whether or not it is correct otherwise. "unsure" = you cannot decide whether this is the target pattern or whether it is correct; never guess.',
      '- A different pattern of the same family (e.g. second conditional when the target is third conditional) is "avoided" if it is correct on its own, and "wrong" if it is a failed attempt at the target form.',
      '- If the pattern needs a context to make sense (past perfect needs a later past event or time in the same sentence; present perfect continuous needs for, since, how long, lately or recently), a sentence without that context is "wrong", and "why" names the missing part.',
      '- State verbs (lack, know, own, need, belong, consist, seem) never take a continuous form; with perfect forms they need for/since/until or a second past event.',
      '- at: the exact words of the learner sentence that carry the pattern or the failed attempt, copied character by character; "" for "avoided" and "unsure".',
      '- why: one short sentence in the explanation language. ok: name the form he built and why it fits here. wrong: give the right form in "…" and the reason; name the German habit if it caused the error. avoided: say which structure he used instead and show in "…" how the target pattern would look in his sentence. unsure: say what is unclear.',
      '- Judge the pattern independently of the word: a wrong word never makes the pattern wrong, and a wrong pattern never makes the word wrong.',
      'Other rules:',
      '- extra: at most one other clear error in the sentence (neither at the target word nor in the pattern) as {"from": exact words from the sentence, "to": the correction, "why": one sentence}; null if there is none, or if the word is "odd"/"wrong", or if the pattern is "wrong".',
      '- fixed: "" if the word is not "odd" or "wrong", the pattern is not "wrong", and extra is null. Otherwise the learner sentence with the errors fixed; if the pattern is "wrong", the fixed sentence uses the target pattern correctly:',
      ...correctionRules(),
      '  Keep the target word if the learner used it correctly, and keep his idea. Do not rewrite the sentence in your own style and do not add new or rarer words. If the pattern needs a context, add the shortest natural clause that provides it; never return a sentence that uses the form without the context it needs.',
      `- better: the learner's own idea as a fluent American professional would say it in this situation, using the target word in the meaning given AND the target pattern (at most ${BRIDGE_BETTER_MAX_WORDS} words). Use only the learner's words, the target and very common words; never a word rarer than the target. Give it also when both verdicts are "ok".`,
      `- keep: ONE takeaway for next time, one sentence in the explanation language with at most ${BRIDGE_KEEP_WORDS} words: the most important error if there is one (name the form, the pattern part or the partner word), otherwise the specific thing he did well and should keep doing. Never generic praise.`,
      falseFriendRule(),
      ...sharedRules(),
    ].join('\n');
  },
  schema: (v) => schemaFor(v, false),
  lenient: (v) => schemaFor(v, true),
};
