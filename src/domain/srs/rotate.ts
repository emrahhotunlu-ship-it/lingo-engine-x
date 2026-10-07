import { chunkContext } from './chunkCards';
import { findContext } from './context';
import { crossSentences } from './crossLink';
import { storedExamples } from './examples';
import type { ContextSpan, ExerciseId, TrainCard } from './types';
import { leastRecent, sentKey, varietyOf } from './variety';

// Kontext-Wechsel (Emrah 02.10.2026, Prüfung Lernwissenschaft L2 und Englischlehrer „Transfer“): Wer ein Wort immer im
// selben Satz abfragt, lernt den Satz, nicht das Wort. Ab Stufe 3 wechseln sich bei den Satzübungen der Ursprungssatz und
// die gespeicherten Claude-Sätze (`xEx`, nur ergänzt, nie überschrieben) ab. Nur eine andere Ansicht: nichts wird geschrieben.
// V1: Aus dem Verlauf (`hist[].s`) wird der am längsten nicht gezeigte Satz gewählt, derselbe Stand zeigt denselben Satz (kein Zufall).
// Aufdecken, Prüfabfrage und Kontrolle bleiben beim Ursprungssatz (der Aufrufer reicht `origin` durch).

export const ROTATE_FROM_STAGE = 3;
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
  if (card.stage < ROTATE_FROM_STAGE || !ROTATING.has(ex)) return card.context;
  const all = contextsOf(card);
  if (all.length < 2) return card.context;
  return leastRecent(all, (c) => sentKey(c.sentence), varietyOf(card.doc).sents) ?? card.context;
}
