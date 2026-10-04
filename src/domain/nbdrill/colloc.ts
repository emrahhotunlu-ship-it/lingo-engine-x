import type { Colloc } from '../../content/nb/schemas';
import { matchVerb } from './check';
import { normText } from '../week/text';

// Kollokationen tippen (Lehrer W3, Plan N101): In der Mitte steht ein Nomen, Emrah tippt passende
// Verben – eines nach dem anderen, nie Auswahl (Generierungseffekt). Ablauf je Aufgabe:
// Treffer → Chip; die typische deutsche Lehnübersetzung („keep a deadline“) → Hinweis mit Grund
// und neuer Versuch; ein anderes falsches Verb → erst Hinweis (Anfangsbuchstabe), dann Lösung.
// Danach zeigt die App immer die Lehnübersetzung als Kontrast.

/** So viele Verben soll Emrah finden (höchstens so viele, wie es gibt). */
export const COLLOC_NEED = 2;
/** Nach so vielen Fehlversuchen kommt die Lösung. */
export const COLLOC_MISSES = 2;

export type CollocState = {
  found: string[];
  misses: number;
  /** Getippte Fehlversuche (für Protokoll und Rückmeldung). */
  tried: string[];
  hinted: boolean;
  /** Lehnübersetzung getippt. */
  calque: boolean;
  /** Lösung gezeigt (Aufgabe beendet ohne alle Treffer). */
  solved: boolean;
};

export const newCollocState = (): CollocState => ({ found: [], misses: 0, tried: [], hinted: false, calque: false, solved: false });

export type CollocStep =
  | { kind: 'hit'; verb: string }
  | { kind: 'dup'; verb: string }
  | { kind: 'calque' }
  | { kind: 'hint'; first: string }
  | { kind: 'solution' }
  | { kind: 'empty' };

export const collocNeed = (c: Colloc): number => Math.min(COLLOC_NEED, c.verbs.length);

/** Verb der Lehnübersetzung („finish a deal“ → „finish“). */
export function calqueVerb(c: Colloc): string {
  const noun = normText(c.noun);
  const phrase = normText(c.wrong.phrase);
  const cut = phrase.split(' ').filter((w) => !['a', 'an', 'the', ...noun.split(' ')].includes(w));
  return cut.join(' ');
}

export function collocDone(c: Colloc, s: CollocState): boolean {
  return s.solved || s.found.length >= collocNeed(c);
}

/** Ein getippter Versuch → neuer Zustand und was die Oberfläche zeigt (rein). */
export function collocTry(c: Colloc, s: CollocState, given: string): { state: CollocState; step: CollocStep } {
  const g = given.trim();
  if (!g || collocDone(c, s)) return { state: s, step: { kind: 'empty' } };
  const hit = matchVerb(g, c.verbs.map((v) => v.v));
  if (hit) {
    if (s.found.includes(hit)) return { state: s, step: { kind: 'dup', verb: hit } };
    return { state: { ...s, found: [...s.found, hit] }, step: { kind: 'hit', verb: hit } };
  }
  const tried = [...s.tried, g];
  const calque = calqueVerb(c);
  if (calque && matchVerb(g, [calque]) && !s.calque) {
    // Die typische Falle: eigener Hinweis mit Grund, zählt nicht als Fehlversuch.
    return { state: { ...s, tried, calque: true }, step: { kind: 'calque' } };
  }
  const misses = s.misses + 1;
  if (misses >= COLLOC_MISSES) return { state: { ...s, tried, misses, solved: true }, step: { kind: 'solution' } };
  const missing = c.verbs.find((v) => !s.found.includes(v.v));
  return { state: { ...s, tried, misses, hinted: true }, step: { kind: 'hint', first: (missing?.v ?? '').slice(0, 1) } };
}

/** Ergebnis einer Aufgabe: richtig ohne Hilfe, mit Hilfe oder Lösung gezeigt. */
export function collocVerdict(c: Colloc, s: CollocState): 'ok' | 'close' | 'wrong' {
  if (s.solved && s.found.length < collocNeed(c)) return 'wrong';
  return s.misses > 0 || s.calque ? 'close' : 'ok';
}

/** Aufgabe aufgeben („Weiß ich nicht“): Lösung zeigen. */
export const collocGiveUp = (s: CollocState): CollocState => ({ ...s, solved: true });
