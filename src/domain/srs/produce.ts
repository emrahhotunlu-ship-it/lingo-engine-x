import { containsPhrase } from '../chunks/newChunk';
import { locateChunk } from './chunkCards';
import { locate } from './context';
import { cardExamples, type StoredExample } from './examples';
import { contextsOf } from './rotate';
import type { Brief, FormId } from './brief';
import type { Grade, TrainCard } from './types';

// Eigener Satz ohne Claude (phase1-plan §4.10) und Vorprüfung vor jedem Claude-Aufruf (Wörter aktivieren, Stufe 1).
// Keine Selbstbewertung (CLAUDE.md A7): die Note folgt aus nachprüfbaren Punkten – Wort bzw. Wendung kommt vor, ein ganzer Satz
// (≥ 4 Wörter, kurze Sätze sind erlaubt), nicht aus einem gezeigten Satz abgeschrieben.
// Die Vorprüfung (`precheckProduce`) arbeitet rein lokal: fällt der Satz durch, gibt es sofort eine Rückmeldung OHNE KI-Aufruf und einmal die Chance
// nachzubessern. Typische Deutsch-Fehler (`germanHints`) sind sichere Muster, keine Vermutung.

export type SelfCheck = { containsTarget: boolean; longEnough: boolean; notCopied: boolean; grade: Grade };

export const PRODUCE_MIN_WORDS = 4;
/** Jaccard-Schwelle gegen JEDEN gezeigten Beispielsatz und den Ursprungssatz: ab hier gilt der Satz als abgeschrieben. */
export const COPY_LIMIT = 0.6;

const wordsOf = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .split(/[^a-z0-9']+/)
    .filter(Boolean);

export function jaccard(a: string, b: string): number {
  const A = new Set(wordsOf(a));
  const B = new Set(wordsOf(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Steht das Wort (auch gebeugt) bzw. die Wendung im Satz? */
export function usesTarget(sentence: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma'>): boolean {
  if (card.kind === 'chunk') return containsPhrase(sentence, card.word) || !!locateChunk(sentence, card.word);
  return !!locate(sentence, card.lemma) || containsPhrase(sentence, card.lemma);
}

/**
 * Alle Sätze, die Emrah zu dieser Karte gesehen hat und nicht abschreiben soll: Ursprungssatz, Beispielsätze (Paket, Wortpartner, Claude) und
 * die Sätze der Rotation (`contextsOf`). Eigene frühere Sätze werden nicht gespeichert und fehlen hier (Stufe 2: Sammelakte `act/…`).
 * `extra` = zusätzlich geladene Claude-Beispiele der Ansicht.
 */
export function shownSentences(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>, extra: readonly StoredExample[] = []): string[] {
  const out = new Set<string>();
  if (card.context?.sentence) out.add(card.context.sentence);
  for (const x of cardExamples(card, null, extra)) out.add(x.en);
  for (const c of contextsOf(card)) out.add(c.sentence);
  return [...out];
}

/** Der ähnlichste gezeigte Satz und seine Ähnlichkeit (Jaccard über die Wörter), `null` ohne Satz. */
export function closestShown(sentence: string, shown: readonly string[]): { sentence: string; score: number } | null {
  let best: { sentence: string; score: number } | null = null;
  for (const s of shown) {
    const score = jaccard(sentence, s);
    if (!best || score > best.score) best = { sentence: s, score };
  }
  return best;
}

export function selfCheckProduce(sentence: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma' | 'context'>, shown: readonly string[] = []): SelfCheck {
  const containsTarget = usesTarget(sentence, card);
  const longEnough = wordsOf(sentence).length >= PRODUCE_MIN_WORDS;
  const refs = card.context?.sentence ? [card.context.sentence, ...shown] : shown;
  const notCopied = (closestShown(sentence, refs)?.score ?? 0) < COPY_LIMIT;
  const grade: Grade = !containsTarget ? 1 : longEnough && notCopied ? 3 : 2;
  return { containsTarget, longEnough, notCopied, grade };
}

// ------------------------------------------------------------------ Typische Deutsch-Fehler (lokal, sicher erkennbar)

export type GermanHintId = 'discuss_about' | 'depend_from' | 'since_duration' | 'informations' | 'want_that' | 'in_the_end_of' | 'if_will' | 'explain_me' | 'am_agree' | 'become_get';

const GERMAN_PATTERNS: ReadonlyArray<[GermanHintId, RegExp]> = [
  ['discuss_about', /\bdiscuss(?:es|ed|ing)?\s+about\b/i],
  ['depend_from', /\bdepend(?:s|ed|ing)?\s+(?:from|of)\b/i],
  ['since_duration', /\bsince\s+(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|several|many|a\s+few)\s+(?:years?|months?|weeks?|days?|hours?)\b/i],
  ['informations', /\b(?:informations|advices|equipments|furnitures|knowledges|feedbacks)\b/i],
  ['want_that', /\bwant(?:s|ed)?\s+that\s+(?:you|he|she|we|they|i)\b/i],
  ['in_the_end_of', /\bin\s+the\s+end\s+of\b/i],
  ['if_will', /\bif\s+(?:i|you|we|they|he|she|it|[a-z]+)\s+will\b/i],
  ['explain_me', /\b(?:explain|say|describe)\s+(?:me|us)\b(?!\s+(?:to|about))/i],
  ['am_agree', /\b(?:am|is|are|was|were)\s+agree\b/i],
  ['become_get', /\bI\s+(?:will\s+)?become\s+(?:a\s+)?(?:gift|present|offer|bill)\b/i],
];

/** Beschreibung für den Prompt (englisch, kurz): Claude bestätigt, ob der Fehler wirklich vorliegt. */
export const GERMAN_HINT_EN: Readonly<Record<GermanHintId, string>> = {
  discuss_about: '"discuss about" (discuss takes no preposition)',
  depend_from: '"depend from/of" (should be "depend on")',
  since_duration: '"since" with a period of time (should be "for")',
  informations: 'plural of an uncountable noun (informations, advices, equipments)',
  want_that: '"want that you ..." (should be "want you to ...")',
  in_the_end_of: '"in the end of" (should be "at the end of")',
  if_will: '"will" in the if-clause',
  explain_me: '"explain/say me" without "to"',
  am_agree: '"I am agree" (should be "I agree")',
  become_get: '"become" used for German "bekommen" (should be "get/receive")',
};

/** Typische Deutsch-Fehler im Satz, in fester Reihenfolge; höchstens `max` Treffer. */
export function germanHints(sentence: string, max = 2): GermanHintId[] {
  return GERMAN_PATTERNS.filter(([, re]) => re.test(sentence)).slice(0, max).map(([id]) => id);
}

// ------------------------------------------------------------------ Vorgaben der Aufgabe prüfen

const NEG = /\b(?:not|never|no|nobody|nothing|neither|nor|none|without|hardly|barely|cannot|can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|hadn't|wouldn't|couldn't|shouldn't|mustn't|needn't)\b|n't\b/i;
const COND = /\b(?:if|unless|provided|as\s+long\s+as|in\s+case)\b/i;

/** Hält der Satz die gewählte Satzform ein? Aussage und Zeitform werden nicht lokal geprüft (Claude sieht die Vorgabe). */
export function fitsForm(sentence: string, form: FormId): boolean {
  const s = sentence.trim();
  switch (form) {
    case 'q':
      return /\?\s*["”']?$/.test(s);
    case 'n':
      return NEG.test(s);
    case 'i':
      return COND.test(s);
    case 's':
      return true;
  }
}

export type PrecheckIssue = 'target' | 'short' | 'copied' | 'form' | 'german';
export type Precheck = {
  /** Erster Mangel, `null` = darf zu Claude. */
  issue: PrecheckIssue | null;
  /** Bei `copied`: der Satz, dem der eigene zu ähnlich ist. */
  closest?: string;
  /** Bei `german`: die gefundenen Muster. */
  hints: GermanHintId[];
};

/** Mängel, bei denen der Satz auch nach dem Nachbessern lokal als „Noch nicht“ endet; Form und Deutsch-Fehler gehen danach zu Claude. */
export const HARD_ISSUES: ReadonlySet<PrecheckIssue> = new Set<PrecheckIssue>(['target', 'short', 'copied']);

/**
 * Vorprüfung in fester Reihenfolge: Wort/Wendung fehlt → zu kurz → abgeschrieben (Jaccard ≥ 0,6 gegen irgendeinen gezeigten Satz) →
 * Satzform nicht eingehalten → typischer Deutsch-Fehler. Rein, ohne KI.
 */
export function precheckProduce(sentence: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma' | 'context'>, shown: readonly string[], brief?: Pick<Brief, 'form'> | null): Precheck {
  const hints = germanHints(sentence);
  if (!usesTarget(sentence, card)) return { issue: 'target', hints };
  if (wordsOf(sentence).length < PRODUCE_MIN_WORDS) return { issue: 'short', hints };
  const refs = card.context?.sentence ? [card.context.sentence, ...shown] : shown;
  const near = closestShown(sentence, refs);
  if (near && near.score >= COPY_LIMIT) return { issue: 'copied', closest: near.sentence, hints };
  if (brief && !fitsForm(sentence, brief.form)) return { issue: 'form', hints };
  if (hints.length) return { issue: 'german', hints };
  return { issue: null, hints };
}
