import { addDays, dayKey } from '../shared';
import type { Pos, Teach } from './card';
import type { Check } from './check';
import { letterDiff, type DiffPart } from './diff';
import { type AnswerResult, mayVoid, STEP_OVERRIDE } from './planner';
import type { Lex, Outcome } from './types';

// Wörter-Modul V3: das Band nach jeder Antwort (v3-bau.md §2, Bilder s1-08…s1-13), rein gerechnet. Feste Reihenfolge: Urteil · Lösungszeile ·
// Warum · Wortpartner · Kommt wieder · Knöpfe. Texte stehen in src/i18n/parts/vm.*.ts; hier nur Schlüssel und Werte.
// „Kommt wieder“ kommt aus dem GESPEICHERTEN Ergebnis (`AnswerResult.lex`), nie neu gerechnet (Kap. 2 Nr. 2).

export type Verdict = 'ok' | 'syn' | 'almost' | 'infl' | 'spell' | 'evade' | 'colloc' | 'notYet' | 'dunno';
export type Tone = 'ok' | 'almost' | 'no' | 'info';

export type Line =
  | { kind: 'ok'; given: string }
  | { kind: 'syn'; given: string; answer: string }
  | { kind: 'diff'; parts: DiffPart[]; answer: string }
  | { kind: 'swap'; given: string; answer: string }
  | { kind: 'answer'; answer: string };

/** Warum-Zeile: Lehrer-Zeile (Deutsch) oder Regel-Zeile (Schlüssel `vmWhy…` mit Werten; `pos` wird in der Oberfläche übersetzt). */
export type Why = { kind: 'teach'; text: string } | { kind: 'rule'; key: string; vars: Record<string, string> };

export type Next =
  /** Lernschritt heute: gleich noch einmal (`mode`: im selben Satz, in einem neuen Satz, ohne Satz), `thenTomorrow` = Termin morgen. */
  | { kind: 'step'; mode: 'same' | 'sentence' | 'nosent' | 'later'; thenTomorrow: boolean }
  /** gebuchter Termin (`day` = dayKey des gespeicherten `due`), Zusatz knapp/neuer Satz. */
  | { kind: 'date'; day: string; extra: 'tight' | 'newSent' | null }
  /** Übung ohne Planwirkung, `day` = nächster Termin. */
  | { kind: 'practice'; day: string | null };

export type Band = {
  verdict: Verdict;
  tone: Tone;
  line: Line;
  why: Why;
  partners: { p: string; de: string }[];
  next: Next;
  /** „War das auch richtig?“ */
  alsoRight: boolean;
  /** „Das wusste ich eigentlich“ */
  knewIt: boolean;
};

export type BandIn = {
  check: Check;
  /** Eingabe wie getippt. */
  given: string;
  answer: string;
  de: string;
  pos: Pos | null;
  teach: Teach;
  lang: 'de' | 'en';
  /** Lexem VOR der Antwort (für „Das wusste ich eigentlich“). */
  before: Lex;
  /** gespeichertes Ergebnis der Antwort. */
  result: AnswerResult;
  /** Antwort mit Planwirkung (Pflicht/geplant)? */
  planned: boolean;
  t: number;
  /** mehr als ein nutzbarer Satz vorhanden? */
  moreSentences: boolean;
  /** Wortpartner aus `col` des Wort-Dokuments. */
  col?: unknown;
  /** Bedeutung des getippten Worts (Wörterbuch von außen), für „anderes Wort“. */
  meaningOf?: (w: string) => string | null;
  /** Bedeutungskarte: `answer` = deutsche Bedeutung, `de` = englisches Wort. Eigene Warum-Sätze (ux-reviewer W7 Nr. 2). */
  meaning?: boolean;
  /** Holt die Runde das Wort noch zurück? `false` → „heute später“ statt „gleich noch einmal“. */
  soon?: boolean;
};

const HARD_GRADE = 2;

export function verdictOf(o: Outcome, note: string | undefined, grade: number | null): Verdict | null {
  switch (o) {
    case 'ok':
      return 'ok';
    case 'syn':
      return 'syn';
    case 'typo':
    case 'hyph':
    case 'odd':
      return 'almost';
    case 'infl':
      return note === 'article' ? 'almost' : 'infl';
    case 'spell':
      return 'spell';
    case 'evade':
      return 'evade';
    case 'colloc':
      return 'colloc';
    case 'prep':
    case 'plural':
    case 'order':
      return grade === null || grade >= HARD_GRADE ? 'almost' : 'notYet';
    case 'pos':
    case 'other':
    case 'wrong':
      return 'notYet';
    case 'dunno':
      return 'dunno';
    default:
      return null; // unfair, asr: keine Abfrage
  }
}

const TONE: Record<Verdict, Tone> = { ok: 'ok', syn: 'ok', almost: 'almost', infl: 'almost', spell: 'almost', evade: 'almost', colloc: 'almost', notYet: 'no', dunno: 'info' };

const DIFF_OUTCOMES: ReadonlySet<Outcome> = new Set(['typo', 'spell', 'infl', 'hyph']);

function lineOf(o: Outcome, given: string, answer: string, hit: string | undefined): Line {
  if (o === 'ok') return { kind: 'ok', given: given.trim() || answer };
  if (o === 'syn') return { kind: 'syn', given: hit ?? given.trim(), answer };
  if (o === 'dunno') return { kind: 'answer', answer };
  if (DIFF_OUTCOMES.has(o)) {
    const parts = letterDiff(given, answer);
    if (parts) return { kind: 'diff', parts, answer };
  }
  return { kind: 'swap', given: given.trim(), answer };
}

const rule = (key: string, vars: Record<string, string>): Why => ({ kind: 'rule', key, vars });

/**
 * Warum (auch bei richtig, Kap. 2 Nr. 4). Vorrang: Formfehler und Auch richtig → Regel-Zeile (sie erklärt genau diesen Fehler); richtig,
 * falscher Freund → Lehrer-Zeile der Charge, wenn vorhanden (nur Deutsch); anderes Wort → was das getippte Wort heißt (Kap. 5 Nr. 11);
 * sonst Bedeutungszeile.
 */
export function whyOf(x: Pick<BandIn, 'check' | 'given' | 'answer' | 'de' | 'pos' | 'teach' | 'lang' | 'meaningOf' | 'meaning'>): Why {
  const { check, answer, de, pos, teach } = x;
  const given = check.hit ?? x.given.trim();
  const v = { answer, de, given, ...(pos ? { pos } : {}) };
  // Bedeutungskarte (Emrah 05.11.2026 „Erklärung und Logik schlecht“): kein „passt nicht in diesen Satz“ – ein deutsches Wort gehört nie in
  // den englischen Satz. Gesagt wird, was das englische Wort hier bedeutet.
  if (x.meaning) {
    const mv = { word: de, de: answer, given, ...(pos ? { pos } : {}) };
    if (check.outcome === 'dunno') return rule('vmWhyMeanDunno', mv);
    if (check.outcome === 'wrong' || check.outcome === 'other') return rule(pos ? 'vmWhyMeanWrong' : 'vmWhyMeanWrongNoPos', mv);
    if (check.note === 'dict') return rule('vmWhyMeanAlt', mv);
    return rule(pos ? 'vmWhyMeanOk' : 'vmWhyMeanOkNoPos', mv);
  }
  const teachWhy = x.lang === 'de' && teach.why ? ({ kind: 'teach', text: teach.why } as const) : null;
  const meaning = pos ? rule('vmWhyMeaning', v) : rule('vmWhyMeaningNoPos', v);
  switch (check.outcome) {
    case 'ok':
      if (check.note === 'gap') return rule('vmWhyGap', v);
      if (check.note === 'article') return rule('vmWhyArticleOk', v);
      if (check.note === 'uk') return rule('vmWhyUk', v);
      if (check.note === 'hyphen') return rule('vmWhyHyphen', v);
      return teachWhy ?? meaning;
    case 'syn':
      return rule(check.note === 'uk' ? 'vmWhySynUk' : 'vmWhySyn', v);
    case 'typo':
      return rule(check.note === 'an' ? 'vmWhyTypoAn' : 'vmWhyTypo', v);
    case 'spell':
      return rule('vmWhySpell', v);
    case 'infl':
      return rule(check.note === 'article' ? 'vmWhyInflArticle' : 'vmWhyInfl', v);
    case 'hyph':
      return rule(pos ? 'vmWhyHyphPos' : 'vmWhyHyphNoPos', v);
    case 'pos':
      return rule(pos ? 'vmWhyPos' : 'vmWhyPosNoPos', v);
    case 'evade':
      return rule('vmWhyEvade', v);
    case 'colloc':
      return rule('vmWhyColloc', v);
    case 'prep':
      return rule('vmWhyPrep', v);
    case 'plural':
      return rule('vmWhyPlural', v);
    case 'order':
      return rule('vmWhyOrder', v);
    case 'other': {
      if (check.note === 'ff') return teachWhy ?? rule('vmWhyOtherFf', { ...v, pair: given });
      if (check.note === 'pair') return rule('vmWhyOtherPair', { ...v, pair: given });
      if (check.note === 'particle') return rule('vmWhyOtherParticle', v);
      const gde = x.meaningOf?.(given) ?? null;
      return gde ? rule('vmWhyOtherMeans', { ...v, gde }) : rule('vmWhyOther', v);
    }
    case 'wrong': {
      const gde = x.meaningOf?.(given) ?? null;
      if (gde) return rule('vmWhyOtherMeans', { ...v, gde });
      return rule(pos ? 'vmWhyWrong' : 'vmWhyWrongNoPos', v);
    }
    case 'dunno':
      return rule(pos ? 'vmWhyDunno' : 'vmWhyDunnoNoPos', v);
    default:
      return meaning;
  }
}

/** Bis zu zwei Wortpartner aus `col` (`{p, de}`). */
export function partnersOf(col: unknown, max = 2): { p: string; de: string }[] {
  if (!Array.isArray(col)) return [];
  const out: { p: string; de: string }[] = [];
  for (const c of col) {
    if (out.length >= max) break;
    if (!c || typeof c !== 'object') continue;
    const r = c as Record<string, unknown>;
    // Gemeldete Wortpartner (Wortseite „Melden“, Großpaket W) bleiben gespeichert, werden aber nie mehr gezeigt.
    if (r.bad === 1) continue;
    const p = typeof r.p === 'string' ? r.p.trim() : '';
    if (p) out.push({ p, de: typeof r.de === 'string' ? r.de.trim() : '' });
  }
  return out;
}

/** Wie geht der Lernschritt weiter (gleiche Zuordnung wie die Runde, session.ts `stepSlot`)? */
export function stepMode(n: number, moreSentences: boolean): 'same' | 'sentence' | 'nosent' {
  const sentence = n >= STEP_OVERRIDE || n === 2 || (n >= 10 && n % 2 === 1);
  if (n === 1) return 'same';
  if (!sentence) return 'nosent';
  return moreSentences ? 'sentence' : 'same';
}

/** „Kommt wieder“ aus dem gespeicherten Lexem. */
export function nextOf(r: AnswerResult, planned: boolean, t: number, moreSentences: boolean, soon = true): Next {
  const l = r.lex;
  const day = dayKey(t);
  const tomorrow = addDays(day, 1);
  const due = (k: 'b' | 'u'): number | null => (k === 'b' ? (l.b?.due ?? null) : l.u.due);
  const nextDue = (): number => Math.min(...[l.u.due, l.b?.due ?? Infinity]);
  if (l.step && dayKey(l.step.at) === day) {
    const d = r.booked.length ? due(r.booked[0]!) : nextDue();
    // Schritt B kommt mit Abstand (≥ 8 Karten und 3 Min.), oft erst in der nächsten Runde des Lerntags: „heute später“, nicht „gleich“.
    // `soon === false`: die Runde holt das Wort nicht mehr zurück (höchstens 3 Abfragen je Runde, keine anderen Karten mehr) – dann nie „gleich“
    // versprechen, sondern „heute später“ (learning-scientist W7, Kap. 2 Nr. 2).
    return { kind: 'step', mode: l.step.n === 2 || !soon ? 'later' : stepMode(l.step.n, moreSentences), thenTomorrow: d !== null && dayKey(d) === tomorrow };
  }
  // Politur P1 (Kap. 2 Nr. 2): nie ein Termin in der Vergangenheit („Kommt am 3. Nov. wieder“ am 13. Nov.). Ein überfälliger Termin der
  // anderen Spur heißt: ab heute fällig.
  const notBefore = (k: string): string => (k < day ? day : k);
  if (!planned || !r.booked.length) return { kind: 'practice', day: l.intro === null ? null : notBefore(dayKey(nextDue())) };
  const d = due(r.booked[0]!) ?? nextDue();
  return { kind: 'date', day: notBefore(dayKey(d)), extra: r.grade === HARD_GRADE ? 'tight' : moreSentences ? 'newSent' : null };
}

/** Band nach einer Antwort. `null` bei einer Abfrage, die nicht zählt (unfair, Spracherkennung abgelehnt). */
export function bandOf(x: BandIn): Band | null {
  const verdict = verdictOf(x.check.outcome, x.check.note, x.result.grade);
  if (!verdict) return null;
  const notYet = verdict === 'notYet';
  return {
    verdict,
    tone: TONE[verdict],
    line: lineOf(x.check.outcome, x.given, x.answer, x.check.hit),
    why: whyOf(x),
    partners: partnersOf(x.col),
    next: nextOf(x.result, x.planned, x.t, x.moreSentences, x.soon ?? true),
    alsoRight: verdict !== 'ok' && verdict !== 'syn' && verdict !== 'dunno' && verdict !== 'evade',
    knewIt: notYet && x.planned && mayVoid(x.before, x.t),
  };
}
