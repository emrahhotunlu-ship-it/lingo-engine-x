import { usesTarget } from './produce';
import type { Grade, TrainCard } from './types';

// Wort-Lernen 2: „Sag es“ (`say_it`). Emrah sieht die deutsche Absicht und sagt den Satz auf Englisch – am Handy mit der Diktiertaste der Tastatur
// (die App greift nie selbst aufs Mikrofon). Geprüft wird lokal und ohne KI nur, ob das Zielwort (gebeugt bzw. die Wendung) im Satz steht:
//  - Zielwort da, mindestens 3 Wörter: „Gut“, zählt als freier Abruf.
//  - Zielwort fehlt oder zu kurz: „Schwer“ und ungeprüft (`u: 1`) – die Spracherkennung kann das Wort verhört haben; kein Rückfall, kein freier Beleg.
//  - leer bzw. „Weiß ich nicht“: „Nochmal“.

export const SAY_IT_MIN_WORDS = 3;

export type SayItCheck = { found: boolean; longEnough: boolean; grade: Grade; verified: boolean };

const wordCount = (s: string): number => s.trim().split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

export function checkSayIt(text: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma'>): SayItCheck {
  if (!text.trim()) return { found: false, longEnough: false, grade: 1, verified: true };
  const found = usesTarget(text, card);
  const longEnough = wordCount(text) >= SAY_IT_MIN_WORDS;
  return found && longEnough ? { found, longEnough, grade: 3, verified: true } : { found, longEnough, grade: 2, verified: false };
}
