import { CHUNK_ALT } from '../../content/chunkAlt';
import { normalize } from '../answer/normalize';
import { typedForm } from './situation';

// Gleichwertige Fassungen einer ganzen Wendung (`content/chunkAlt.ts`). Rein, schreibt nie.

const keyOf = (en: string): string => normalize(typedForm(en));

/** Gleichwertige Fassungen der Wendung `en` (ohne die Wendung selbst); leer, wenn keine bekannt sind. */
export function chunkAlternatives(en: string): string[] {
  const k = keyOf(en);
  return (CHUNK_ALT[k] ?? []).filter((a) => keyOf(a) !== k);
}

/**
 * Lösungen einer Abfrage: `answer` zuerst (angezeigt), dazu die gleichwertigen Fassungen – aber nur, wenn die Lücke die GANZE Wendung ist
 * (ein einzelnes Wort der Wendung oder eine gebeugte Satzform bekommt keine fremde Fassung).
 */
export function acceptedWithAlternatives(word: string, answer: string): string[] {
  if (keyOf(answer) !== keyOf(word)) return [answer];
  return [answer, ...chunkAlternatives(word)];
}
