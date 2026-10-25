import type { ContextSpan } from './types';

// Satz einer Lückenaufgabe (Emrahs Meldung 25.10.2026, live v83: „…technique and ____. Their recommendations were based on … the system had obvious…“):
// Eine Lücke ist nur lösbar, wenn sie in EINEM vollständigen, kurzen Satz steht. Aus einem Lesetext übernommene Auszüge (mehrere Sätze, links und
// rechts mit „…“ abgeschnitten) werden deshalb auf den Satz der Lücke gekürzt. Ist genau dieser Satz abgeschnitten (er beginnt oder endet mit „…“)
// oder länger als GAP_SENTENCE_MAX_WORDS Wörter, taugt er nicht als Lücke: dann kommt ein anderer Satz der Karte oder eine Aufgabe ohne Satz.
// Rein und deterministisch (kein Zufall, nichts wird geschrieben); dieselbe Eingabe ergibt immer denselben Satz.

/** Höchstens so viele Wörter hat der Satz einer Lückenaufgabe. */
export const GAP_SENTENCE_MAX_WORDS = 22;

/** Ein Satz eines Texts mit Lage im Text und Merkmalen. */
export type SentencePiece = {
  text: string;
  start: number;
  end: number;
  /** Der Satz beginnt mittendrin (Auszug beginnt mit „…“). */
  cutStart: boolean;
  /** Der Satz bricht ab (endet mit „…“). */
  cutEnd: boolean;
  words: number;
};

/** Warum ein Satz als Lücke nicht taugt (für Audit und Tests). */
export type GapSentenceIssue = 'cut_start' | 'cut_end' | 'too_long' | 'multi' | 'ellipsis_inside' | 'across';

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;
export const countWords = (s: string): number => (s.match(WORD_RE) ?? []).length;

const LEAD_ELLIPSIS = /^\s*(?:…|\.{3,})\s*/;
const TAIL_ELLIPSIS = /\s*(?:…|\.{3,})\s*$/;
/** Satzende: . ! ? (oder ein Auslassungszeichen) mit schließenden Anführungszeichen/Klammern, danach Leerraum und ein Satzanfang (Großbuchstabe, Ziffer, öffnendes Zeichen). */
const BOUNDARY = /(?:[.!?]+|…)["'’”)\]]*(?=\s+["'‘“(]?[A-Z0-9])/g;
/** Abkürzungen beenden keinen Satz („Mr. Smith“, „U.S. companies“, „e.g. The“ kommt praktisch nicht vor). */
const ABBREV_END = /(?:\b(?:[A-Z]\.){2,}|\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc|e\.g|i\.e|approx|No|Inc|Ltd|Co|Jr|Sr)\.)$/;
const INNER_ELLIPSIS = /…|\.{3,}/;

/**
 * Sätze eines Texts mit Lage. Ein „…“ am Anfang bzw. Ende des Texts markiert den ersten bzw. letzten Satz als abgeschnitten; ein Satz, der selbst
 * mit „…“ endet, ebenfalls. Rein.
 */
export function sentencePieces(text: string): SentencePiece[] {
  const lead = LEAD_ELLIPSIS.exec(text);
  const from = lead ? lead[0].length : 0;
  const tail = TAIL_ELLIPSIS.exec(text.slice(from));
  const to = tail ? from + tail.index : text.length;
  const inner = text.slice(from, to);
  const cuts: number[] = [];
  for (const m of inner.matchAll(BOUNDARY)) {
    const endAt = m.index + m[0].length;
    if (m[0].startsWith('.') && !m[0].startsWith('..') && ABBREV_END.test(inner.slice(0, m.index + 1))) continue;
    cuts.push(endAt);
  }
  const out: SentencePiece[] = [];
  let pos = 0;
  const bounds = [...cuts, inner.length];
  bounds.forEach((b, i) => {
    const raw = inner.slice(pos, b);
    const lt = raw.length - raw.trimStart().length;
    const t = raw.trim();
    const start = from + pos + lt;
    pos = b;
    if (!t) return;
    const first = out.length === 0;
    const last = i === bounds.length - 1;
    out.push({
      text: t,
      start,
      end: start + t.length,
      cutStart: first && !!lead,
      cutEnd: (last && !!tail) || /(?:…|\.{3,})["'’”)\]]*$/.test(t),
      words: countWords(t),
    });
  });
  return out;
}

/** Mängel des Satzes, in dem die Lücke steht (leer = brauchbar). `multi`: der Text hatte mehrere Sätze (kein Mangel, nur Hinweis fürs Audit). */
export function gapSentenceIssues(ctx: Pick<ContextSpan, 'sentence' | 'start' | 'end'>): GapSentenceIssue[] {
  const pieces = sentencePieces(ctx.sentence);
  const hit = pieces.find((p) => ctx.start >= p.start && ctx.end <= p.end);
  if (!hit) return ['across'];
  const out: GapSentenceIssue[] = [];
  if (pieces.length > 1) out.push('multi');
  if (hit.cutStart) out.push('cut_start');
  if (hit.cutEnd) out.push('cut_end');
  // Ein „…“ mitten im Satz (ausgelassene Stelle) macht ihn ebenfalls unvollständig.
  const body = hit.text.replace(/(?:…|\.{3,})["'’”)\]]*$/, '');
  if (INNER_ELLIPSIS.test(body)) out.push('ellipsis_inside');
  if (hit.words > GAP_SENTENCE_MAX_WORDS) out.push('too_long');
  return out;
}

/**
 * Kurzer, vollständiger Mini-Kontext aus mehreren Sätzen („The license fee is higher. ____, the total cost is lower.“): kein Satz ist abgeschnitten,
 * keiner enthält „…“, zusammen höchstens GAP_SENTENCE_MAX_WORDS Wörter. Bindewörter („that said“, „hence“) brauchen den Satz davor; solche bewusst
 * kurz geschriebenen Beispiele bleiben ganz.
 */
function shortWhole(ctx: ContextSpan, pieces: readonly SentencePiece[]): boolean {
  return pieces.length > 1 && countWords(ctx.sentence) <= GAP_SENTENCE_MAX_WORDS && pieces.every((p) => !p.cutStart && !p.cutEnd && !INNER_ELLIPSIS.test(p.text));
}

/**
 * Mögliche Lückensätze zu `ctx`, bester zuerst: der ganze Text, wenn er ein sauberer Satz oder ein kurzer vollständiger Mini-Kontext ist, danach der
 * Satz der Lücke allein (mit neu berechneter Lage). Leer, wenn der Satz der Lücke abgeschnitten ist, ein „…“ enthält, länger als
 * GAP_SENTENCE_MAX_WORDS Wörter ist oder die Lücke über eine Satzgrenze reicht. Rein und deterministisch.
 */
export function gapSentenceCandidates(ctx: ContextSpan | null | undefined): ContextSpan[] {
  if (!ctx) return [];
  if (gapSentenceIssues(ctx).some((x) => x !== 'multi')) return [];
  const pieces = sentencePieces(ctx.sentence);
  const hit = pieces.find((p) => ctx.start >= p.start && ctx.end <= p.end);
  if (!hit) return [];
  if (hit.start === 0 && hit.end === ctx.sentence.length) return [ctx];
  const own: ContextSpan = { sentence: hit.text, start: ctx.start - hit.start, end: ctx.end - hit.start, gap: ctx.gap };
  return shortWhole(ctx, pieces) ? [ctx, own] : [own];
}

/** Der Satz, den eine Lückenaufgabe zu `ctx` zeigt (erster Kandidat), sonst `null`. Ein sauberer Text kommt unverändert zurück (dasselbe Objekt). */
export function gapSentence(ctx: ContextSpan | null | undefined): ContextSpan | null {
  return gapSentenceCandidates(ctx)[0] ?? null;
}

/** Darf `ctx` genau so als Lückensatz erscheinen (ein kurzer vollständiger Satz oder ein kurzer vollständiger Mini-Kontext)? */
export function isCleanGapSentence(ctx: ContextSpan | null | undefined): boolean {
  return !!ctx && gapSentenceCandidates(ctx).some((g) => g.sentence === ctx.sentence);
}
