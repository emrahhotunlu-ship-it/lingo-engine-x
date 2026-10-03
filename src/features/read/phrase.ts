import type { Token } from '../../domain/text/types';

// Wendung markieren im Leser (Neubau N57, LingQ/Readlang): erstes und letztes Wort antippen, die
// Stelle dazwischen wird als EIN Eintrag nachgeschlagen (Wortblatt mit „+ Wortschatz“). Rein und getestet.

export const PHRASE_MAX_WORDS = 8;

type Tap = { start: number; end: number };

/**
 * Stelle der Wendung zwischen zwei angetippten Wörtern desselben Texts (Reihenfolge egal).
 * `null`, wenn es nur ein Wort ist oder die Wendung mehr als `PHRASE_MAX_WORDS` Wörter hätte.
 */
export function phraseSpan(text: string, tokens: readonly Token[], a: Tap, b: Tap): { start: number; end: number; index: number; surface: string } | null {
  const start = Math.min(a.start, b.start);
  const end = Math.max(a.end, b.end);
  const words = tokens.filter((t) => t.kind === 'word' && t.start >= start && t.end <= end);
  if (words.length < 2 || words.length > PHRASE_MAX_WORDS) return null;
  const index = tokens.findIndex((t) => t.kind === 'word' && t.start === start);
  return { start, end, index: index < 0 ? 0 : index, surface: text.slice(start, end) };
}
