import type { WeekTargets } from '../week/types';

// `UnitCtx.phrases` (Prüfbefund M8): Die Wendungen, die Block 3 benutzen soll. Geräteübergreifend
// aus den Daten: Karten mit Herkunft Lesen/Hören von heute, sonst die 5 Wendungen der Woche.

export type PhraseCardLike = { word: string; src: string | null; added: string; hidden?: boolean };

const INPUT_SRC = new Set(['read', 'listen']);
export const PHRASES_MAX = 5;

export function unitPhrases(cards: readonly PhraseCardLike[], day: string, targets: WeekTargets): string[] {
  const today = cards
    .filter((c) => !c.hidden && c.src !== null && INPUT_SRC.has(c.src) && c.added.slice(0, 10) === day && c.word.trim())
    .map((c) => c.word.trim());
  const uniq = [...new Set(today)].slice(0, PHRASES_MAX);
  return uniq.length ? uniq : targets.phrases.slice(0, PHRASES_MAX);
}
