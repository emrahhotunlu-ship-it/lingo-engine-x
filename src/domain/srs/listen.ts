import { isDue } from '../metrics/definitions';
import { stageOf } from './ladder';
import { supports, type ExerciseEnv } from './modes';
import type { ExerciseId, Lang, TrainCard } from './types';

// Hör-Modus und Hörschleife (plan.md N35, markt CM4/GL1): rein und getestet.

/**
 * Abfrage im Hör-Modus (Aa „Hören“): Die Sprachausgabe spricht den Satz, getippt wird in die Lücke
 * (`dictation`). Ohne Ursprungssatz: junge Karten (Stufe ≤ 2) nach Gehör auswählen (`listen_mc`).
 * `null` = die gewöhnliche Leiter (ohne Sprachausgabe oder ohne passende Daten).
 */
export function listenExercise(card: TrainCard, lang: Lang, poolSize: number, env: ExerciseEnv): ExerciseId | null {
  if (!env.tts) return null;
  // Der Hör-Modus ist ausdrücklich gewählt (freiwillig, Kennzeichen „Kopfhörer“): er gilt auch am Handy.
  const on: ExerciseEnv = { ...env, listen: true };
  if (supports(card, 'dictation', lang, poolSize, on)) return 'dictation';
  if (card.stage <= 2 && supports(card, 'listen_mc', lang, poolSize, on)) return 'listen_mc';
  return null;
}

export type LoopItem = { key: string; word: string; sentence: string };

/** Sätze der Hörschleife. */
export const LOOP_SIZE = 10;

const lastOf = (c: TrainCard): number => (typeof c.doc.last === 'number' ? c.doc.last : 0);

/**
 * Hörschleife (Extra-Runde): bis zu 10 Ursprungssätze, zuerst fällige Karten (früheste Fälligkeit),
 * dann gefestigte (höchste Stufe, zuletzt geübt). Nur Karten mit Satz, nie ausgeblendete oder neue.
 * Jeder Satz höchstens einmal. Schreibt nichts – die Schleife zählt nicht als Wiederholung.
 */
export function loopItems(cards: readonly TrainCard[], nowMs: number, size: number = LOOP_SIZE): LoopItem[] {
  const usable = cards.filter((c) => !c.hidden && !c.isNew && !!c.context?.sentence);
  const due = usable.filter((c) => isDue(c, nowMs)).sort((a, b) => a.fsrs.due - b.fsrs.due || a.key.localeCompare(b.key));
  const rest = usable
    .filter((c) => !isDue(c, nowMs))
    .sort((a, b) => stageOf(b.doc) - stageOf(a.doc) || lastOf(b) - lastOf(a) || a.key.localeCompare(b.key));
  const out: LoopItem[] = [];
  const seen = new Set<string>();
  for (const c of [...due, ...rest]) {
    const sentence = (c.context?.sentence ?? '').trim();
    if (!sentence || seen.has(sentence)) continue;
    seen.add(sentence);
    out.push({ key: c.key, word: c.word, sentence });
    if (out.length >= size) break;
  }
  return out;
}
