import type { FluencyQuestion } from '../../content/fluency/questions';
import { sentenceSplit, wordCount } from '../text/textStats';
import { hash32 } from '../random';

// Flüssigkeit 90 – 60 – 45 (Lernberatung 27.09., V6 / Vorschlag 5): reine Logik ohne KI –
// Frage des Tages, Zeitbalken und die ruhigen Kennzahlen je Runde (Wörter, Wörter pro Minute,
// Anteil vollständiger Sätze). Kein Punktestand.

/** Dauer der drei Runden in Sekunden (4-3-2-Methode, verkürzt). */
export const FLUENCY_ROUNDS = [90, 60, 45] as const;
export type RoundIndex = 0 | 1 | 2;

/** Frage des Lerntags: fest je Tag (gleiche Wahl bei jedem Neuzeichnen), `shift` = „Andere Frage“. */
export function questionFor(list: readonly FluencyQuestion[], day: string, shift = 0): FluencyQuestion | null {
  if (!list.length) return null;
  const base = hash32(`fluency|${day}`) % list.length;
  return list[(base + Math.max(0, Math.floor(shift))) % list.length] ?? null;
}

/** Zeitbalken: verbleibende ms und Anteil 0–1 aus Start und jetzt (monotone Uhr). */
export function timeLeft(startMs: number, nowMs: number, totalMs: number): { leftMs: number; share: number; over: boolean } {
  const leftMs = Math.max(0, totalMs - Math.max(0, nowMs - startMs));
  return { leftMs, share: totalMs > 0 ? leftMs / totalMs : 0, over: leftMs <= 0 };
}

/**
 * Gesprochenes Stück an den Text hängen: Die Spracherkennung liefert ein Stück je Sprechpause,
 * meist ohne Satzzeichen. Jedes Stück beginnt groß und endet mit einem Punkt – so zählt eine
 * Pause als Satzgrenze, und die Kennzahl „vollständige Sätze“ bleibt auch beim Sprechen sinnvoll.
 */
export function appendSpoken(cur: string, heard: string): string {
  const h = heard.replace(/\s+/g, ' ').trim();
  if (!h) return cur;
  const cap = h.charAt(0).toUpperCase() + h.slice(1);
  const piece = /[.!?]["'’”)]*$/.test(cap) ? cap : `${cap}.`;
  const base = cur.trimEnd();
  return base ? `${base} ${piece}` : piece;
}

/** Wörter, mit denen ein vollständiger Satz nicht endet (abgebrochen, „and …“). */
const DANGLING = new Set(['and', 'but', 'or', 'so', 'because', 'the', 'a', 'an', 'to', 'of', 'with', 'for', 'that', 'which', 'if', 'in', 'on', 'at', 'is', 'are', 'we', 'i', 'you', 'our', 'my', 'their', 'um', 'uh']);

/** Ist ein Satz vollständig? Mindestens drei Wörter, Satzschlusszeichen, kein hängendes Wort am Ende. */
export function isCompleteSentence(s: string): boolean {
  const t = s.trim();
  if (!/[.!?]["'’”)\]]*$/.test(t)) return false;
  const words = t.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
  if (words.length < 3) return false;
  const last = (words[words.length - 1] ?? '').toLowerCase();
  return !DANGLING.has(last);
}

export type RoundStats = {
  /** Wörter der Runde. */
  words: number;
  /** Wörter pro Minute (gerundet) über die tatsächlich genutzte Zeit. */
  wpm: number;
  /** Sätze (nach Satzzeichen getrennt). */
  sentences: number;
  /** davon vollständig. */
  full: number;
  /** Anteil vollständiger Sätze 0–1 (0 ohne Sätze). */
  fullShare: number;
};

/** Kennzahlen einer Runde. `usedMs` = genutzte Zeit (höchstens die Rundendauer, mindestens 5 s). */
export function roundStats(text: string, usedMs: number): RoundStats {
  const words = wordCount(text);
  // `;` und `:` trennen hier keine Sätze (sentenceSplit trennt dort für die Sprachausgabe).
  const sentences = sentenceSplit(text.replace(/[;:](?=\s)/g, ','))
    .map((s) => s.text)
    .filter((s) => wordCount(s) > 0);
  const full = sentences.filter(isCompleteSentence).length;
  const minutes = Math.max(5_000, usedMs) / 60_000;
  return { words, wpm: words ? Math.round(words / minutes) : 0, sentences: sentences.length, full, fullShare: sentences.length ? full / sentences.length : 0 };
}

/** Tendenz zwischen zwei Runden für die ruhige Anzeige: höher, gleich (±5 %), niedriger. */
export function trend(prev: number, next: number): 'up' | 'same' | 'down' {
  if (prev <= 0) return next > 0 ? 'up' : 'same';
  const r = next / prev;
  return r > 1.05 ? 'up' : r < 0.95 ? 'down' : 'same';
}
