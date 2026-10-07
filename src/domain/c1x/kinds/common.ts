import { toUS } from '../../answer/spelling';
import { alignKey, splitWords } from '../../answer/align';
import type { WhyRule } from '../../explain/types';
import { langScores } from '../../lang/detect';
import { legacyNorm } from '../../grammar/key';
import type { C1Item } from '../types';

// Gemeinsame Hilfen der neun Arten (rein): Vergleichsform, US-Hinweis, Begründungsregeln, Wortzählung.

/** Vergleichsform einer Antwort: Kurzformen aufgelöst, ohne Satzzeichen, klein, britisch → amerikanisch (A7.3). */
export const cmp = (s: string): string => toUS(legacyNorm(s));
/** Wie `cmp`, aber ohne die US-Umrechnung (zeigt, ob britisch geschrieben wurde). */
export const plain = (s: string): string => legacyNorm(s);

/** US-Hinweis: wurde britisch geantwortet, steht hier die erwartete Form (sonst `undefined`). */
export function usHint(given: string, expected: readonly string[]): string | undefined {
  const g = cmp(given);
  const hit = expected.find((e) => cmp(e) === g);
  if (hit === undefined) return undefined;
  return plain(given) === plain(hit) ? undefined : hit;
}

/** Wörter eines Satzes wie angezeigt (an Leerzeichen getrennt). */
export const wordsOf = (s: string): string[] => splitWords(s);
/** Wortzahl für Längenregeln. */
export const wordCount = (s: string): number => wordsOf(s).length;
/** Wort ohne Satzzeichen am Rand, klein. */
export const keyOf = (w: string): string => alignKey(w);

/** Nur Wörter mit Buchstaben zählen als Wort (Auslassungspunkte, Gedankenstriche nicht). */
export const hasLetters = (s: string): boolean => /[A-Za-z]/.test(s);

const has = (hay: string, needle: string): boolean => {
  const n = legacyNorm(needle);
  return n !== '' && hay.includes(` ${n} `);
};

/** Passt die Begründungsregel zur Eingabe? Gleiche Bedeutung wie in `domain/grammar/patterns.ts` (LP2 §3.1). */
export function ruleMatches(rule: WhyRule, input: { given?: string; picked?: string; tapped?: string }): boolean {
  const cond = rule.opt !== undefined || rule.tap !== undefined || rule.if !== undefined || rule.not !== undefined;
  if (!cond) return true;
  const same = (a: string, b: string): boolean => a.trim().toLowerCase() === b.trim().toLowerCase();
  if (rule.opt !== undefined) return input.picked !== undefined && same(input.picked, rule.opt);
  if (rule.tap !== undefined) {
    if (input.tapped === undefined) return false;
    if (rule.tap === '*') return input.tapped !== 'none';
    return same(String(input.tapped), rule.tap);
  }
  const given = ` ${legacyNorm(input.given ?? '')} `;
  if (rule.if && !rule.if.every((w) => has(given, w))) return false;
  if (rule.not && rule.not.some((w) => has(given, w))) return false;
  return true;
}

/** Die erste passende Begründungsregel der Aufgabe. */
export const whyRuleFor = (item: C1Item, input: { given?: string; picked?: string; tapped?: string }): WhyRule | null =>
  item.why.wrong.find((r) => ruleMatches(r, input)) ?? null;

/** Britische Schreibweisen, die in Inhalten nicht vorkommen dürfen (US ist Standard, A7.3). */
export const BRITISH = /\b(colour|programme|centre|licence|cheque|whilst|learnt|behaviour|favour|catalogue|labour|honour|enquir|towards|amongst)\w*|\b(organis|realis|recognis|prioritis|minimis|customis|summaris|finalis|optimis|analys)(e|ed|es|ing|ation|ations|er|ers)\b/i;

/**
 * Liegt eine Begründung erkennbar in der falschen Sprache? Milder als `isWrongLang`: deutsche Hinweise zitieren oft englische Beispielsätze
 * („blame braucht on: The delay was blamed …“), das ist erlaubt. Abgelehnt wird nur ein ganzer Text in der anderen Sprache
 * (erwartete Sprache 0 Treffer und andere ≥ 6, oder erwartet 1 und andere ≥ 9). Deutsche Zitate in „…“ zählen im Englischen nicht mit.
 */
export function wrongLang(text: string, expected: 'de' | 'en'): boolean {
  const s = langScores(expected === 'en' ? text.replace(/[“„][^”“]*[”“]/g, ' ') : text);
  const own = expected === 'de' ? s.de : s.en;
  const other = expected === 'de' ? s.en : s.de;
  return (own === 0 && other >= 6) || (own === 1 && other >= 9);
}

/** Ergebnis-Bausteine. */
export const verdictOfPoints = (got: number, max: number): 'correct' | 'near' | 'wrong' => (got >= max ? 'correct' : got > 0 ? 'near' : 'wrong');

/** Kontext der Inhaltsprüfung. Rein: die App reicht `defaultCheckCtx()` (checkContext.ts) hinein, Tests dürfen eigene Werte nutzen. */
export type CheckCtx = {
  /** Thema des Musters oder `null`, wenn es das Muster nicht gibt; `undefined` = nicht prüfbar (z. B. Thema ohne Musterdatei). */
  patternTopic?: (pat: string, topic: string | undefined) => string | null | undefined;
  /** Eines der 47 Themen? */
  topicKnown?: (topic: string) => boolean;
};

/** Ein Befund der Inhaltsprüfung; leere Liste = in Ordnung. */
export type Problems = string[];

/** Wörter in einem Text (nur Buchstaben und Apostrophe, klein). */
export const lowerWords = (s: string): string[] => (s.toLowerCase().match(/[a-z']+/g) ?? []).filter(Boolean);

/** Wörter (ohne Satzzeichen) eines Satzes als Folge. */
export const tokens = (s: string): string[] => wordsOf(s).map(keyOf);

/** Kommt die Wortfolge `seq` in `hay` vor? Rückgabe: Index des `nth` Treffers (1-basiert) oder -1. */
export function findSeq(hay: readonly string[], seq: readonly string[], nth = 1): number {
  if (seq.length === 0) return -1;
  let seen = 0;
  for (let i = 0; i + seq.length <= hay.length; i++) {
    if (seq.every((w, j) => hay[i + j] === w)) {
      seen++;
      if (seen === nth) return i;
    }
  }
  return -1;
}
