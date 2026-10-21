import { chunkAlternatives } from '../chunks/alternatives';
import { usesTarget } from './produce';
import type { Grade, TrainCard } from './types';

// Wort-Lernen 2: „Sag es“ (`say_it`). Emrah sieht die deutsche Absicht und sagt den Satz auf Englisch – am Handy mit der Diktiertaste der Tastatur
// (die App greift nie selbst aufs Mikrofon). Geprüft wird lokal und ohne KI nur, ob das Zielwort (gebeugt bzw. die Wendung oder eine ihrer
// gleichwertigen Fassungen aus `content/chunkAlt.ts`) im Satz steht:
//  - Zielwort da, mindestens 3 Wörter: „Gut“, zählt als freier Abruf. Die Oberfläche sagt dazu, dass nur das Zielwort geprüft ist.
//  - Zielwort da, aber zu kurz: „Schwer“ und ungeprüft (`u: 1`).
//  - Zielwort fehlt (oder der Satz ist praktisch der deutsche Text): NUR ein Verlaufseintrag `u: 1`, keine Änderung der Planung (`noteOnly`,
//    Lernwissenschaft S7) – die Spracherkennung kann das Wort verhört haben; kein Rückfall, kein freier Beleg.
//  - leer bzw. „Weiß ich nicht“: „Nochmal“.

export const SAY_IT_MIN_WORDS = 3;
/** Ab diesem Anteil an Wörtern, die auch in der deutschen Absicht stehen, gilt der Satz als „praktisch der deutsche Text“. */
export const SAY_IT_GERMAN_SHARE = 0.6;

export type SayItCheck = {
  found: boolean;
  longEnough: boolean;
  grade: Grade;
  verified: boolean;
  /** Zielwort nicht erkannt: nur Verlaufseintrag, Planung unverändert. */
  noteOnly?: true;
  /** Der Satz ist praktisch der deutsche Text (Tastatur bzw. Diktat auf Deutsch). */
  german?: true;
};

const wordCount = (s: string): number => s.trim().split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const tokens = (s: string): string[] =>
  s
    .toLowerCase()
    .normalize('NFC')
    .split(/[^\p{L}\p{N}']+/u)
    .filter(Boolean);

/** Praktisch der deutsche Text: mindestens 60 % der Wörter (ab 2 Wörtern) stehen auch in der deutschen Absicht. */
export function looksGerman(text: string, de: string): boolean {
  const t = tokens(text);
  if (t.length < 2 || !de.trim()) return false;
  const D = new Set(tokens(de));
  return t.filter((w) => D.has(w)).length / t.length >= SAY_IT_GERMAN_SHARE;
}

/** Zielwort bzw. Wendung (auch eine gleichwertige Fassung der ganzen Wendung) im Satz? */
function hasTarget(text: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma'>): boolean {
  if (usesTarget(text, card)) return true;
  if (card.kind !== 'chunk') return false;
  // Jede Fassung auch ohne „to“ („The bank will raise interest rates“, „will hike rates“).
  const forms = [card.word, ...chunkAlternatives(card.word)].flatMap((f) => [f, f.replace(/^to\s+/i, '')]);
  return forms.some((f) => usesTarget(text, { kind: 'chunk', word: f, lemma: f }));
}

export function checkSayIt(text: string, card: Pick<TrainCard, 'kind' | 'word' | 'lemma'>, de = ''): SayItCheck {
  if (!text.trim()) return { found: false, longEnough: false, grade: 1, verified: true };
  const german = looksGerman(text, de);
  const found = !german && hasTarget(text, card);
  const longEnough = wordCount(text) >= SAY_IT_MIN_WORDS;
  if (!found) return { found, longEnough, grade: 2, verified: false, noteOnly: true, ...(german ? { german: true as const } : {}) };
  return longEnough ? { found, longEnough, grade: 3, verified: true } : { found, longEnough, grade: 2, verified: false };
}
