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
// nachzubessern. Typische Deutsch-Fehler (`germanHints`): nur die eindeutigen Muster (`BLOCKING_HINTS`) sperren lokal, die übrigen sind Hinweise an Claude.

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
  if (locate(sentence, card.lemma) || containsPhrase(sentence, card.lemma)) return true;
  // Getrennte Verben („follow it up“, „carry the plan out“): erstes Wort, dann bis zu vier Wörter, dann der Rest.
  const parts = card.lemma.trim().split(/\s+/);
  return parts.length >= 2 && !!locateChunk(sentence, `${parts[0]} sth ${parts.slice(1).join(' ')}`);
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

// Funktionswörter zählen bei der Abschreibprüfung nicht mit: sie machen kurze Sätze künstlich ähnlich (Lernwissenschaft N4).
const STOP = new Set(
  `a an the and or but of to in on at for with by from as is are was were be been being am do does did have has had i you he she it we they me my your his her our their this that these those not no if so than then there here what which who will would can could should may might must just very also too into about over up out its it's i'm i'd i'll we're we'll you're you'll don't doesn't didn't isn't aren't wasn't can't won't there's that's`.split(/\s+/),
);

/** Wörter des Zielworts (und seine Beugungen, am Wortstamm erkannt) – sie zählen bei der Ähnlichkeit nicht mit. */
export function targetSkip(card: Pick<TrainCard, 'word' | 'lemma'>): ReadonlySet<string> {
  const out = new Set<string>();
  for (const w of wordsOf(`${card.word} ${card.lemma}`)) if (w.length >= 3) out.add(w.length > 4 ? w.slice(0, w.length - 2) : w);
  return out;
}

const contentOf = (s: string, skip: ReadonlySet<string>): Set<string> => new Set(wordsOf(s).filter((w) => !STOP.has(w) && ![...skip].some((k) => w.startsWith(k))));

/** Ähnlichkeit über die Inhaltswörter ohne Zielwort und Funktionswörter; `novel` = neue Inhaltswörter gegenüber dem Vergleichssatz. */
function contentSimilarity(a: string, b: string, skip: ReadonlySet<string>): { score: number; novel: number; shared: number } {
  const A = contentOf(a, skip);
  const B = contentOf(b, skip);
  let shared = 0;
  for (const w of A) if (B.has(w)) shared++;
  const union = A.size + B.size - shared;
  return { score: union ? shared / union : 0, novel: A.size - shared, shared };
}

/**
 * Der ähnlichste gezeigte Satz und seine Ähnlichkeit, `null` ohne Satz. Ohne `skip` zählt Jaccard über alle Wörter (alt); mit `skip` (Zielwort-Formen,
 * `targetSkip`) über die Inhaltswörter, und als abgeschrieben gilt auch, wer nur Wörter des Vorbilds benutzt und höchstens ein neues Inhaltswort dazugibt.
 */
export function closestShown(sentence: string, shown: readonly string[], skip?: ReadonlySet<string>): { sentence: string; score: number; copied: boolean } | null {
  let best: { sentence: string; score: number; copied: boolean } | null = null;
  for (const s of shown) {
    let score: number;
    let copied: boolean;
    if (skip) {
      const c = contentSimilarity(sentence, s, skip);
      score = c.score;
      copied = score >= COPY_LIMIT || (c.shared > 0 && c.novel < 2);
    } else {
      score = jaccard(sentence, s);
      copied = score >= COPY_LIMIT;
    }
    if (!best || (copied && !best.copied) || (copied === best.copied && score > best.score)) best = { sentence: s, score, copied };
  }
  return best;
}

export function selfCheckProduce(sentence: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma' | 'context'>, shown: readonly string[] = []): SelfCheck {
  const containsTarget = usesTarget(sentence, card);
  const longEnough = wordsOf(sentence).length >= PRODUCE_MIN_WORDS;
  const refs = card.context?.sentence ? [card.context.sentence, ...shown] : shown;
  const notCopied = !closestShown(sentence, refs, targetSkip(card))?.copied;
  const grade: Grade = !containsTarget ? 1 : longEnough && notCopied ? 3 : 2;
  return { containsTarget, longEnough, notCopied, grade };
}

// ------------------------------------------------------------------ Typische Deutsch-Fehler (lokal, sicher erkennbar)

export type GermanHintId = 'discuss_about' | 'depend_from' | 'since_duration' | 'informations' | 'want_that' | 'in_the_end_of' | 'if_will' | 'explain_me' | 'am_agree' | 'become_get';

const GERMAN_PATTERNS: ReadonlyArray<[GermanHintId, RegExp]> = [
  ['discuss_about', /\bdiscuss(?:es|ed|ing)?\s+about\b/i],
  // „It depends of course on …“ ist richtig.
  ['depend_from', /\bdepend(?:s|ed|ing)?\s+(?:from\b|of\b(?!\s+course\b))/i],
  // „since“ im Sinn von „da/weil“ steht nie mit Zeitspanne + Prädikat („Since two weeks have passed …“) und „two years ago“ gehört zu „since“ im Sinn von „seit“ + Zeitpunkt.
  [
    'since_duration',
    /\bsince\s+(?:(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|several|many|a\s+few)\s+(?:years?|months?|weeks?|days?|hours?)\b(?!\s+(?:ago|have|has|had|is|are|was|were|of|later|before|left)\b)|(?:years|months|weeks|ages)\b)/i,
  ],
  // „payment/remittance advices“ sind echte Dokumentarten (zählbar), „this evidences …“ ist ein Verb.
  ['informations', /\b(?:informations|(?<!\b(?:payment|remittance|shipping|credit|debit)\s+)advices|equipments|furnitures|knowledges|feedbacks|softwares|hardwares|(?<!\b(?:this|that|it|which|he|she|study|data|report|result|results)\s+)evidences)\b/i],
  // „Is there anything else you want that we haven’t covered?“ ist ein Relativsatz und richtig.
  ['want_that', /(?<!\b(?:anything|something|everything|nothing|what|whatever|all|anyone|someone|everyone)\b[^.?!]{0,30})\b(?:want(?:s|ed)?|would\s+like)\s+that\s+(?:you|he|she|we|they|i)\b/i],
  ['in_the_end_of', /\bin\s+the\s+end\s+of\b/i],
  // Bedingung („if you call“); „if“ im Sinn von „ob“ (I’m not sure if he will come) und das höfliche „if you will follow me“ sind richtig.
  [
    'if_will',
    /(?<!\b(?:know|sure|ask|asked|asking|wonder|wondering|check|checking|see|tell|confirm|clear|unclear|decide|doubt|certain|out|say)\s+)\bif\s+(?:(?:i|you|we|they|he|she|it|there)|(?:the|a|an|my|our|your|his|her|their|this|that)\s+\w+)\s+will\b(?!\s+(?:please|kindly|follow|come\s+this|bear)\b)/i,
  ],
  ['explain_me', /\b(?:explain|say)\s+(?:me|us)\b(?!\s+(?:to|about|as)\b)/i],
  ['am_agree', /(?:\b(?:am|is|are|was|were)|['’](?:m|re)|(?<!\blet)['’]s)\s+agree\b/i],
  ['become_get', /\b(?:I|we)\s+(?:will\s+|'ll\s+)?bec(?:o|a)me\s+(?:an?\s+|the\s+)?(?:gift|present|offer|bill|invoice|email|mail|message|reply|discount|refund)\b/i],
];

/**
 * Nur diese Muster sperren lokal („Noch nicht“ nach dem zweiten Versuch). Die übrigen sind erkennbar, aber nicht immer ein Fehler
 * (if_will, want_that, since_duration, explain_me): sie gehen nur als Hinweis an Claude, der es im Zusammenhang beurteilt.
 */
export const BLOCKING_HINTS: ReadonlySet<GermanHintId> = new Set<GermanHintId>(['discuss_about', 'depend_from', 'informations', 'am_agree', 'become_get']);

/** Beschreibung für den Prompt (englisch, kurz): Claude bestätigt, ob der Fehler wirklich vorliegt. */
export const GERMAN_HINT_EN: Readonly<Record<GermanHintId, string>> = {
  discuss_about: '"discuss about" (discuss takes no preposition)',
  depend_from: '"depend from/of" (should be "depend on")',
  since_duration: '"since" with a period of time (should be "for"; "since" meaning "because" is fine)',
  informations: 'plural of an uncountable noun (informations, advices, equipments, softwares)',
  want_that: '"want that you ..." (should be "want you to ..."; a relative clause like "anything you want that ..." is fine)',
  in_the_end_of: '"in the end of" (should be "at the end of")',
  if_will: '"will" in the if-clause (only an error for a condition; "if" meaning "whether" is fine)',
  explain_me: '"explain/say me" without "to" (should be "explain it to me" / "tell me")',
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
  /** Alle gefundenen Muster (gehen als Hinweis an Claude). */
  hints: GermanHintId[];
  /** Davon die, die lokal sperren (`BLOCKING_HINTS`); nur sie lösen `german` aus. */
  block: GermanHintId[];
};

/** Mängel, bei denen der Satz auch nach dem Nachbessern lokal als „Noch nicht“ endet; Form und Deutsch-Fehler gehen danach zu Claude. */
export const HARD_ISSUES: ReadonlySet<PrecheckIssue> = new Set<PrecheckIssue>(['target', 'short', 'copied']);

/**
 * Vorprüfung in fester Reihenfolge: Wort/Wendung fehlt → zu kurz → abgeschrieben (Jaccard ≥ 0,6 über Inhaltswörter ohne Zielwort gegen irgendeinen gezeigten Satz, oder weniger als 2 neue Inhaltswörter) →
 * Satzform nicht eingehalten → typischer Deutsch-Fehler. Rein, ohne KI.
 */
export function precheckProduce(sentence: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma' | 'context'>, shown: readonly string[], brief?: Pick<Brief, 'form'> | null): Precheck {
  const hints = germanHints(sentence, 10);
  const block = hints.filter((h) => BLOCKING_HINTS.has(h));
  if (!usesTarget(sentence, card)) return { issue: 'target', hints, block };
  if (wordsOf(sentence).length < PRODUCE_MIN_WORDS) return { issue: 'short', hints, block };
  const refs = card.context?.sentence ? [card.context.sentence, ...shown] : shown;
  const near = closestShown(sentence, refs, targetSkip(card));
  if (near?.copied) return { issue: 'copied', closest: near.sentence, hints, block };
  if (brief && !fitsForm(sentence, brief.form)) return { issue: 'form', hints, block };
  if (block.length) return { issue: 'german', hints, block };
  return { issue: null, hints, block };
}
