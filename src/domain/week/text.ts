// Gemeinsame Textnormalisierung für Wendungen, Ziele und Themenkarten (rein).

const CONTRACTIONS: readonly [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\b(i|you|we|they|he|she|it|that|there|who)'ll\b/g, '$1 will'],
  [/\b(i|you|we|they|who)'ve\b/g, '$1 have'],
  [/\b(i|you|we|they|he|she|it|that|there|who)'d\b/g, '$1 would'],
  [/\bi'm\b/g, 'i am'],
  [/\b(you|we|they|who)'re\b/g, '$1 are'],
  [/\blet's\b/g, 'let us'],
  [/\b(it|that|what|there|here|he|she|who|how|where)'s\b/g, '$1 is'],
];

/** Klein, gerade Apostrophe, ohne Satzzeichen und Auslassungspunkte, Kurzformen ausgeschrieben. */
export function normText(s: string): string {
  let t = s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/…|\.\.\./g, ' ');
  for (const [re, rep] of CONTRACTIONS) t = t.replace(re, rep);
  return t
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Kern einer Wendung: der Teil vor „…“ (bzw. die ganze Wendung), normalisiert. */
export function phraseCore(phrase: string): string {
  const cut = phrase.split(/…|\.\.\./)[0] ?? phrase;
  return normText(cut.trim() ? cut : phrase);
}

/** Enthält der normalisierte Text die Wortfolge (an Wortgrenzen)? */
export function hasWords(normed: string, words: string): boolean {
  if (!words) return false;
  return ` ${normed} `.includes(` ${words} `);
}
