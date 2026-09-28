import type { Objection } from '../../content/nb/schemas';

// Einwand-Training als Druck-Serie (Lehrer I3, Plan N103): 5 Einwände, je 10 s Bedenkzeit und
// 30 s Antwort. Das Muster steht sichtbar da: anerkennen · nachfragen · antworten · absichern.
// Mit KI prüft `pressure-check@1` die vier Schritte; ohne KI hakt Emrah selbst ab und sieht die
// Musterantwort. Die Zeit ist Druck, kein Abbruch: Nach 30 s wird gespeichert, was dasteht.

export const PRESSURE_N = 5;
export const THINK_MS = 10_000;
export const ANSWER_MS = 30_000;
/** Höchstlänge einer Antwort (Eingabefeld und Speicher). */
export const PRESSURE_TEXT_MAX = 600;

export const MOVES = ['acknowledge', 'ask', 'answer', 'secure'] as const;
export type Move = (typeof MOVES)[number];
export type Moves = Record<Move, boolean>;

export const noMoves = (): Moves => ({ acknowledge: false, ask: false, answer: false, secure: false });

export const movesScore = (m: Moves | null | undefined): number => (m ? MOVES.filter((k) => m[k]).length : 0);

/** Musterantwort als ein Text (für Anzeige, Sprachausgabe und „bessere Fassung“). */
export const modelText = (o: Objection): string => MOVES.map((k) => o.model[k]).join(' ');

export type PressureAnswer = {
  /** Kennung des Einwands. */
  id: string;
  text: string;
  /** Aktive Antwortzeit in ms. */
  ms: number;
  /** Selbstcheck (ohne KI) oder KI-Urteil. */
  moves: Moves | null;
  /** Bessere Fassung der KI (Englisch). */
  better?: string;
  by: 'self' | 'ai' | null;
};

/** Beste Antwort der Serie: meiste Schritte, dann längster Text; `null` ohne Text. */
export function bestAnswer(list: readonly PressureAnswer[]): PressureAnswer | null {
  let best: PressureAnswer | null = null;
  for (const a of list) {
    if (!a.text.trim()) continue;
    const sa = movesScore(a.moves);
    const sb = best ? movesScore(best.moves) : -1;
    if (!best || sa > sb || (sa === sb && a.text.length > best.text.length)) best = a;
  }
  return best;
}

/** Erster Satz eines Texts (für „Merken“ als Wendung), höchstens `max` Zeichen. */
export function firstSentence(text: string, max = 110): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  const m = /^(.+?[.?!])(\s|$)/.exec(flat);
  const s = (m?.[1] ?? flat).trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 20)).trim();
}
