import { findContext } from './context';
import { storedExamples } from './examples';
import type { ContextSpan, ExerciseId, TrainCard } from './types';

// Kontext-Wechsel (Emrah 02.10.2026, Prüfung Lernwissenschaft L2 und Englischlehrer „Transfer“): Wer ein Wort immer im
// selben Satz abfragt, lernt den Satz, nicht das Wort. Ab Stufe 3 wechseln sich bei den Satzübungen der Ursprungssatz und
// die gespeicherten Claude-Sätze (`xEx`, nur ergänzt, nie überschrieben) ab. Nur eine andere Ansicht: nichts wird geschrieben.
// Fest je Wiederholung (`reps % n`): derselbe Stand zeigt denselben Satz, jede neue Antwort den nächsten.
// Aufdecken, Prüfabfrage und Kontrolle bleiben beim Ursprungssatz (der Aufrufer reicht `origin` durch).

export const ROTATE_FROM_STAGE = 3;
/** Satzübungen mit Lücke im Satz, die den Satz wechseln dürfen (Erkennen auf Stufe 1–2 bleibt im Ursprungssatz). */
export const ROTATING: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['cloze_hint', 'cloze', 'tiles', 'speed', 'dictation']);

/** Ursprungssatz zuerst, danach jeder gespeicherte Satz, in dem das Wort (auch gebeugt) vorkommt. */
export function contextsOf(card: Pick<TrainCard, 'context' | 'doc' | 'word' | 'kind'>): ContextSpan[] {
  const out: ContextSpan[] = card.context ? [card.context] : [];
  if (card.kind !== 'vocab') return out;
  const have = new Set(out.map((c) => c.sentence.toLowerCase()));
  for (const x of storedExamples(card.doc)) {
    const c = findContext(x.en, card.word);
    if (!c || have.has(c.sentence.toLowerCase())) continue;
    have.add(c.sentence.toLowerCase());
    out.push(c);
  }
  return out;
}

/** Satz für diese Übung: bei Rotation der `reps % n`-te Satz, sonst der Ursprungssatz. */
export function rotatedContext(card: TrainCard, ex: ExerciseId): ContextSpan | null {
  if (card.kind !== 'vocab' || card.stage < ROTATE_FROM_STAGE || !ROTATING.has(ex)) return card.context;
  const all = contextsOf(card);
  if (all.length < 2) return card.context;
  const reps = typeof card.doc.reps === 'number' && Number.isFinite(card.doc.reps) ? Math.max(0, Math.floor(card.doc.reps)) : 0;
  return all[reps % all.length] ?? card.context;
}
