import { normalize } from '../domain/answer/normalize';
import { toUS } from '../domain/answer/spelling';

// Grammatik-Formen müssen EXAKT stimmen (keine Tippfehler-Toleranz): „has been working" ist
// nicht „have been working". Gleich gelten nur: Leerzeichen, Groß-/Kleinschreibung, Satzzeichen
// am Ende, Kurz-/Langformen (hasn't = has not) und US-/UK-Schreibweise.

const CONTRACTIONS: ReadonlyArray<[RegExp, string]> = [
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bwon't\b/g, 'will not'],
  [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'],
  [/'ve\b/g, ' have'],
  [/'re\b/g, ' are'],
  [/'ll\b/g, ' will'],
  [/'m\b/g, ' am'],
];

/** Kanonische Form für den exakten Vergleich. */
export function canonGrammar(s: string): string {
  let x = normalize(s);
  for (const [re, to] of CONTRACTIONS) x = x.replace(re, to);
  return toUS(x.replace(/\s+/g, ' ').trim());
}

/** Richtig, wenn die Eingabe nach Normalisierung gleich `answer` oder einer akzeptierten Form ist; bei „correct" darf sie nicht der unveränderte Originalsatz sein. */
export function gradeGrammar(given: string, task: { type: string; prompt: string; answer: string; accepted?: readonly string[] }): boolean {
  const g = canonGrammar(given);
  if (!g) return false;
  if (task.type === 'correct' && g === canonGrammar(task.prompt)) return false;
  return [task.answer, ...(task.accepted ?? [])].some((a) => canonGrammar(a) === g);
}
