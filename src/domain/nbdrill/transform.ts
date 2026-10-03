import type { Transform } from '../../content/nb/schemas';
import { checkAnswer, hasKeyword, wordCount, type AnswerCheck } from './check';

// Satz-Umformung mit Schlüsselwort (Lehrer G3, Cambridge C1, Plan N102): Satz A, ein
// Schlüsselwort, Satz B mit Lücke; Emrah ergänzt 3–6 Wörter mit dem Schlüsselwort. Lokal gegen
// mehrere Musterlösungen. Erst Hinweis, dann zweiter Versuch, dann Lösung mit Grund (Kap. 2.4).

export const TRANSFORM_MIN_WORDS = 2;
export const TRANSFORM_MAX_WORDS = 6;

export type TransformHint = 'keyword' | 'length' | 'start' | null;

export type TransformCheck = AnswerCheck & {
  /** Warum (noch) nicht richtig: Schlüsselwort fehlt, zu viele Wörter oder Anfang zeigen. */
  hint: TransformHint;
};

/** Satz B mit der Füllung (für die Anzeige der Lösung). */
export const fillGap = (t: Transform, fill: string): string => t.gap.replace('___', fill.trim());

export function checkTransform(t: Transform, given: string): TransformCheck {
  const res = checkAnswer(given, t.answers);
  if (res.verdict === 'ok') return { ...res, hint: null };
  if (!hasKeyword(given, t.key)) return { ...res, hint: 'keyword' };
  const n = wordCount(given);
  if (n > TRANSFORM_MAX_WORDS + 1) return { ...res, hint: 'length' };
  return { ...res, hint: 'start' };
}

/** Anfang der Musterlösung für den Hinweis („may not …“): die ersten zwei Wörter. */
export function transformStart(t: Transform): string {
  const first = t.answers[0] ?? '';
  const words = first.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.min(2, Math.max(1, words.length - 1))).join(' ');
}
