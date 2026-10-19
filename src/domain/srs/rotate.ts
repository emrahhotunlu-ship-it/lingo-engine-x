import { chunkContext } from './chunkCards';
import { findContext, senseFits } from './context';
import { gapUsable, lemmaFor } from './gapFit';
import { crossSentences } from './crossLink';
import { storedExamples } from './examples';
import { readWx } from '../tutor/acceptWordCtx';
import type { ContextSpan, ExerciseId, TrainCard } from './types';
import { hash32 } from '../random';
import { isFirstDay, leastRecent, sentKey, shownSentences } from './variety';

// Kontext-Wechsel (Emrah 02.10.2026, Prüfung Lernwissenschaft L2 und Englischlehrer „Transfer“): Wer ein Wort immer im selben Satz abfragt, lernt den Satz,
// nicht das Wort. Seit WL (19.10.2026, Befund: 97 % der Auswahlfragen und 61 von 102 Karten immer im selben Satz) wechselt der Satz ab der ersten Wiederholung
// an einem anderen Tag, bei JEDER Satzübung (auch Erkennen, Zuordnen, Hören, Aufdecken). Tag 1 bleibt der Ursprungssatz der Anker. Der Satz der letzten Antwort
// kommt nie noch einmal, solange es einen anderen gibt. Nur eine andere Ansicht: nichts wird geschrieben.
// V1: Aus dem Verlauf (`hist[].s`) wird der am längsten nicht gezeigte Satz gewählt, derselbe Stand zeigt denselben Satz (kein Zufall).
// Prüfabfrage und Kontrolle bleiben beim Ursprungssatz (der Aufrufer reicht `origin` durch).

export const ROTATE_FROM_STAGE = 1;
/** Satzübungen, die den Satz wechseln dürfen. Ohne Satz (Wortbedeutung, Wortpartner, eigener Satz) gibt es nichts zu wechseln. */
export const ROTATING: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['mc_en', 'ctx_mc', 'listen_mc', 'match', 'flip', 'cloze_hint', 'cloze', 'tiles', 'speed', 'dictation', 'wordfam']);

/** Satzübungen mit Lücke: Der Satz muss die Lücke fair verdecken (`gapFit.ts`). */
const GAP_EX: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['cloze_hint', 'cloze', 'tiles', 'speed', 'dictation', 'wordfam']);

/** Der Satz bricht ab oder beginnt mittendrin („… and then we left“, „We use it to …“): aus einem Lesetext geschnitten. */
export const isTruncated = (sentence: string): boolean => /^\s*(…|\.\.\.)/.test(sentence) || /(…|\.\.\.)\s*$/.test(sentence);

/** Der Ursprungssatz ist als Lücke brauchbar (sonst wechselt er nicht mit, `gapFit.ts`). */
const originUsable = (card: Pick<TrainCard, 'context' | 'word' | 'kind'>): boolean => !!card.context && !isTruncated(card.context.sentence) && gapUsable(card.context, lemmaFor({ word: card.word, kind: card.kind, lemma: '' }));

/** Stelle des Worts (bzw. der Wendung) in einem Satz, sonst `null`. */
function locateIn(card: Pick<TrainCard, 'word' | 'kind' | 'doc'>, sentence: string): ContextSpan | null {
  // Wendungen (Lernplattform 2.0 §4.8): die Stelle der Wendung über `locateChunk`, Vokabeln über das Wort (auch gebeugt).
  const hit = card.kind === 'chunk' ? chunkContext(sentence, card.word) : findContext(sentence, card.word);
  // Audit 12.10.2026: Nur Sätze, in denen das Wort in der Bedeutung der Karte steht (Nomen-Karte „decline“ nicht im Satz „started to decline“)
  // und deren Lücke genau das Wort verdeckt (kein zweites Vorkommen, kein beliebiges Objekt) wechseln mit dem Ursprungssatz ab.
  if (!hit) return null;
  if (card.kind !== 'chunk' && !senseFits(hit, card.doc.pos)) return null;
  return gapUsable(hit, lemmaFor({ word: card.word, kind: card.kind, lemma: '' })) ? hit : null;
}

/**
 * Ursprungssatz zuerst, danach jeder gespeicherte Satz, in dem das Wort (auch gebeugt) vorkommt. Quellen (V1, „Mehrfachkombination“):
 * `xEx` (Claude, einmal gespeichert), die Beispielsätze der Wortpartner (`col[].ex`) und feste, geprüfte Sätze aus c1x-Aufgaben
 * (mcc/ocl/err/kwt), dem Satzbau-Pool und dem C1-Paket, in denen dieselbe Lexik vorkommt (`crossLink.ts`).
 */
export function contextsOf(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>): ContextSpan[] {
  const out: ContextSpan[] = originUsable(card) ? [card.context as ContextSpan] : [];
  const have = new Set(out.map((c) => c.sentence.toLowerCase()));
  const push = (sentence: string): void => {
    const c = locateIn(card, sentence);
    if (!c || have.has(c.sentence.toLowerCase())) return;
    have.add(c.sentence.toLowerCase());
    out.push(c);
  };
  for (const x of storedExamples(card.doc)) push(x.en);
  for (const x of readWx(card.doc)) push(x.en);
  // Sätze der Wortpartner: die Klammern markieren dort die Wendung, nicht das Wort, deshalb werden sie entfernt.
  if (Array.isArray(card.doc.col)) for (const c of card.doc.col) if (c && typeof c === 'object' && typeof (c as Record<string, unknown>).ex === 'string') push((c as { ex: string }).ex.replace(/\[|\]/g, ''));
  for (const sentence of crossSentences(card)) push(sentence);
  return out;
}

/**
 * Satz für diese Übung. Tag 1 (noch keine Antwort an einem früheren Tag): der Ursprungssatz als Anker. Danach der am längsten nicht gezeigte Satz (V1);
 * der zuletzt gezeigte kommt nie, solange es einen anderen gibt. Gleichstand unter nie gezeigten Sätzen entscheidet ein fester Wert aus Karte und
 * Verlaufslänge (kein Zufall, aber auch nicht immer der erste). Ältere Einträge ohne `s` gelten als Ursprungssatz (`shownSentences`).
 * Ein abgeschnittener Ursprungssatz (mit „…“) wechselt mit, sobald es einen anderen Satz gibt. `day`: der Lerntag (aus dem Seed der Übung).
 */
export function rotatedContext(card: TrainCard, ex: ExerciseId, day?: string): ContextSpan | null {
  if (card.stage < ROTATE_FROM_STAGE || !ROTATING.has(ex)) return card.context;
  const origin = card.context;
  const originOk = originUsable(card);
  // Erkennen, Zuordnen, Hören und Aufdecken zeigen den Satz nur; er muss dort keine faire Lücke sein, aber auch nicht abgeschnitten.
  const showable = !!origin && !isTruncated(origin.sentence) && (originOk || !GAP_EX.has(ex));
  const all = showable && !originOk && origin ? [origin, ...contextsOf(card)] : contextsOf(card);
  // Tag 1: der Ursprungssatz ist der Anker.
  if (showable && isFirstDay(card.doc, day)) return origin;
  if (all.length < (showable ? 2 : 1)) return origin;
  const used = shownSentences(card.doc, origin ? sentKey(origin.sentence) : null);
  return leastRecent(all, (c) => sentKey(c.sentence), used, hash32(`${card.key}|${used.length}`)) ?? origin;
}
