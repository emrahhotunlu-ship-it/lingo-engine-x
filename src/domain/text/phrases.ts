import { lemmaCandidates } from './lemma';
import { normalizeWord } from './tokenize';
import type { PhraseMatch, Token } from './types';

// Wendungen um ein angetipptes Wort erkennen (Entwurf §8 Schritt 1).
// Geprüft werden zusammenhängende Wortfolgen mit 4 bis 2 Wörtern, die das Wort enthalten.
// Satzzeichen trennen, Leerraum verbindet. Verglichen wird über die Grundform des ersten
// Worts (carried out → carry out) und, falls nötig, des letzten Worts (living rooms → living room).
// Die längste Wendung gewinnt, bei gleicher Länge die weiter links beginnende.

const MAX_WORDS = 4;

/** Schreibweisen einer Wortfolge: Oberfläche zuerst, dann Grundformen von erstem und letztem Wort. */
function variants(words: readonly string[]): string[] {
  const lower = words.map(normalizeWord);
  const firsts = lemmaCandidates(lower[0] ?? '');
  const lasts = lower.length > 1 ? lemmaCandidates(lower[lower.length - 1] ?? '') : [''];
  const middle = lower.slice(1, -1);
  const out: string[] = [];
  for (const f of firsts) {
    for (const l of lasts) {
      const phrase = [f, ...middle, l].join(' ');
      if (!out.includes(phrase)) out.push(phrase);
    }
  }
  return out;
}

/**
 * Sucht die Wendung, zu der das Wort `tokens[index]` gehört.
 * `isPhrase` bekommt klein geschriebene Kandidaten mit einfachen Leerzeichen („carry out")
 * und entscheidet, was als Wendung gilt (Wörterbuch, eigene Karten, Chunks).
 */
export function findPhrase(
  tokens: readonly Token[],
  index: number,
  isPhrase: (phrase: string) => boolean,
): PhraseMatch | null {
  const tapped = tokens[index];
  if (!tapped || tapped.kind !== 'word') return null;

  // Wörter links und rechts, solange nur Leerraum dazwischen steht.
  const run: number[] = [index];
  for (let k = index - 1, n = 1; k >= 0 && n < MAX_WORDS; k--) {
    const t = tokens[k];
    if (!t || t.kind === 'punct' || t.kind === 'num') break;
    if (t.kind === 'word') {
      run.unshift(k);
      n++;
    }
  }
  for (let k = index + 1, n = 1; k < tokens.length && n < MAX_WORDS; k++) {
    const t = tokens[k];
    if (!t || t.kind === 'punct' || t.kind === 'num') break;
    if (t.kind === 'word') {
      run.push(k);
      n++;
    }
  }
  const pos = run.indexOf(index);

  for (let size = Math.min(MAX_WORDS, run.length); size >= 2; size--) {
    for (let s = Math.max(0, pos - size + 1); s <= Math.min(pos, run.length - size); s++) {
      const idx = run.slice(s, s + size);
      const words = idx.map((i) => tokens[i]?.text ?? '');
      const phrase = variants(words).find((v) => isPhrase(v));
      if (phrase === undefined) continue;
      const first = idx[0] ?? index;
      const last = idx[idx.length - 1] ?? index;
      const start = tokens[first]?.start ?? tapped.start;
      const end = tokens[last]?.end ?? tapped.end;
      const surface = tokens
        .slice(first, last + 1)
        .map((t) => t.text)
        .join('');
      return { phrase, surface, first, last, start, end };
    }
  }
  return null;
}
