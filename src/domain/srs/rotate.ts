import { chunkContext } from './chunkCards';
import { findContext } from './context';
import { crossSentences } from './crossLink';
import { storedExamples } from './examples';
import { readWx } from '../tutor/acceptWordCtx';
import type { ContextSpan, ExerciseId, TrainCard } from './types';
import { leastRecent, sentKey, varietyOf } from './variety';

// Kontext-Wechsel (Emrah 02.10.2026, Prüfung Lernwissenschaft L2 und Englischlehrer „Transfer“): Wer ein Wort immer im
// selben Satz abfragt, lernt den Satz, nicht das Wort. Ab Stufe 3 wechseln sich bei den Satzübungen der Ursprungssatz und
// die gespeicherten Claude-Sätze (`xEx`, nur ergänzt, nie überschrieben) ab. Nur eine andere Ansicht: nichts wird geschrieben.
// V1: Aus dem Verlauf (`hist[].s`) wird der am längsten nicht gezeigte Satz gewählt, derselbe Stand zeigt denselben Satz (kein Zufall).
// Aufdecken, Prüfabfrage und Kontrolle bleiben beim Ursprungssatz (der Aufrufer reicht `origin` durch).

export const ROTATE_FROM_STAGE = 3;
/**
 * Lernplattform 3.0 P52 (KI-Tutor T3): die neuen Claude-Sätze schwacher Wörter (`wx`, nicht gemeldet) wechseln schon ab Stufe 2 mit dem Ursprungssatz ab –
 * auch bei „Wort zuordnen“ (`match`, Stufe 2). Die übrigen Quellen (`xEx`, Wortpartner, feste Sätze) bleiben bei Stufe 3.
 */
export const WX_FROM_STAGE = 2;
/** Auf Stufe 2 wechseln höchstens so viele Claude-Sätze (die neuesten, nicht gemeldeten) mit dem Ursprungssatz: zusammen höchstens 3 Kontexte. */
export const WX_ROTATE_MAX = 2;
const ROTATING_WX: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['match', 'cloze_hint', 'cloze', 'tiles', 'speed', 'dictation', 'wordfam']);
/** Satzübungen mit Lücke im Satz, die den Satz wechseln dürfen (Erkennen auf Stufe 1–2 bleibt im Ursprungssatz). */
export const ROTATING: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['cloze_hint', 'cloze', 'tiles', 'speed', 'dictation', 'wordfam']);

/** Stelle des Worts (bzw. der Wendung) in einem Satz, sonst `null`. */
function locateIn(card: Pick<TrainCard, 'word' | 'kind'>, sentence: string): ContextSpan | null {
  // Wendungen (Lernplattform 2.0 §4.8): die Stelle der Wendung über `locateChunk`, Vokabeln über das Wort (auch gebeugt).
  return card.kind === 'chunk' ? chunkContext(sentence, card.word) : findContext(sentence, card.word);
}

/**
 * Ursprungssatz zuerst, danach jeder gespeicherte Satz, in dem das Wort (auch gebeugt) vorkommt. Quellen (V1, „Mehrfachkombination“):
 * `xEx` (Claude, einmal gespeichert), die Beispielsätze der Wortpartner (`col[].ex`) und feste, geprüfte Sätze aus c1x-Aufgaben
 * (mcc/ocl/err/kwt), dem Satzbau-Pool und dem C1-Paket, in denen dieselbe Lexik vorkommt (`crossLink.ts`).
 */
export function contextsOf(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>): ContextSpan[] {
  const out: ContextSpan[] = card.context ? [card.context] : [];
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
 * Satz für diese Übung: bei Rotation der am längsten nicht gezeigte Satz (V1). Der zuletzt gezeigte kommt nie, solange es einen anderen gibt;
 * unter gleich lange nicht gezeigten gilt die Reihenfolge der Liste (Ursprungssatz zuerst, dann reihum wie bisher). Ohne Satz-Verlauf
 * (neue Karten, alte Karten vor V1) beginnt es mit dem Ursprungssatz.
 */
export function rotatedContext(card: TrainCard, ex: ExerciseId): ContextSpan | null {
  const all = card.stage >= ROTATE_FROM_STAGE && ROTATING.has(ex) ? contextsOf(card) : card.stage >= WX_FROM_STAGE && ROTATING_WX.has(ex) ? wxContexts(card) : [];
  if (all.length < 2) return card.context;
  return leastRecent(all, (c) => sentKey(c.sentence), varietyOf(card.doc).sents) ?? card.context;
}

/** Ursprungssatz und die neuesten (≤ 2) nicht gemeldeten Claude-Sätze des Wörter-Tutors (`wx`), in denen das Wort steht (P52, ab Stufe 2). */
export function wxContexts(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>): ContextSpan[] {
  const out: ContextSpan[] = card.context ? [card.context] : [];
  const have = new Set(out.map((c) => c.sentence.toLowerCase()));
  let taken = 0;
  for (const x of [...readWx(card.doc)].sort((a, b) => b.t - a.t)) {
    if (taken >= WX_ROTATE_MAX) break;
    const c = locateIn(card, x.en);
    if (!c || have.has(c.sentence.toLowerCase())) continue;
    have.add(c.sentence.toLowerCase());
    out.push(c);
    taken++;
  }
  return out;
}
