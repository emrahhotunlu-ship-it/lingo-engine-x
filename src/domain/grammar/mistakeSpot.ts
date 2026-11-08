import { alignKey, alignWords, splitWords } from '../answer/align';

// Neustart E1 (Emrah 08.11.2026): „Du: will sign → richtig: signs“. Die abweichende Stelle zwischen eigener Antwort und Lösung, rein und testbar.
// Von der ersten bis zur letzten abweichenden Wortstelle; sind es mehr als sechs Wörter auf einer Seite, steht die ganze Antwort da.

export type MistakeSpot = { du: string; richtig: string };

const MAX = 6;

export function mistakeSpot(given: string, answer: string): MistakeSpot | null {
  const g = given.trim();
  const a = answer.trim();
  if (!g || !a) return null;
  const ops = alignWords(g, a);
  const first = ops.findIndex((o) => o.op !== 'eq');
  if (first < 0) return null;
  let last = ops.length - 1;
  while (last > first && ops[last]?.op === 'eq') last--;
  const span = ops.slice(first, last + 1);
  const du = span.flatMap((o) => (o.given !== undefined ? [o.given] : [])).join(' ');
  const richtig = span.flatMap((o) => (o.expected !== undefined ? [o.expected] : [])).join(' ');
  if (splitWords(du).length > MAX || splitWords(richtig).length > MAX) return { du: g, richtig: a };
  return { du, richtig };
}

const CONTRACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'cannot'],
  [/\bcan not\b/g, 'cannot'],
  [/\bshan't\b/g, 'shall not'],
  [/\b(\w+)n't\b/g, '$1 not'],
  [/\b(i|you|we|they)'ve\b/g, '$1 have'],
  [/\b(i|you|we|they|he|she|it)'ll\b/g, '$1 will'],
  [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\bi'm\b/g, 'i am'],
];
const key = (s: string): string => {
  let k = splitWords(s).map(alignKey).filter(Boolean).join(' ');
  for (const [re, to] of CONTRACTIONS) k = k.replace(re, to);
  return k;
};

/** „Gleich nochmal“: dieselbe Vereinheitlichung wie beim Wortvergleich (Groß/klein, Apostrophe, Satzzeichen am Rand), Kurzformen ausgeschrieben. */
export function sameGapAnswer(given: string, answer: string, accepted: readonly string[] = []): boolean {
  const g = key(given);
  return g !== '' && [answer, ...accepted].some((a) => key(a) === g);
}
