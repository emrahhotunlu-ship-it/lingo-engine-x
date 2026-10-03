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
  /** Lernpfad-Stufe, auf der geantwortet wurde (1–5); fehlt bei alten Antworten (= 5). */
  lv?: number;
  /** Stufe 1–2: Anteil richtig zugeordneter Schritte (0..1). */
  part?: number;
  /** Genutzte Hilfe (Satzanfänge auf Stufe 4). */
  hint?: 0 | 1 | 2;
  /** Stufe 1–2: gewählter Schritt je Platz (für den Rückblick). */
  pick?: (Move | null)[];
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

// ------------------------------------------------------------------ Lernpfad (docs/lernpfad-plan.md, 03.10.2026)
// Stufe 1 Vorbild (Sätze den Schritten zuordnen) · 2 gelenkt (je Schritt den passenden Satz aus 3 wählen) · 3 Satzanfänge ·
// 4 frei (Satzanfänge auf Abruf) · 5 unter Zeitdruck (nur Anzeige, nie automatisches Abgeben).

export const LEVEL_NAMES = ['', 'model', 'guided', 'starters', 'free', 'pressure'] as const;
/** Zeitziel auf Stufe 5 (Sprechen bzw. Diktieren, 35–45 Wörter): nur Anzeige. */
export const PRESSURE_ANSWER_MS = 45_000;

/** Satzanfang eines Mustersatzes: die ersten Wörter bis zum ersten Komma, höchstens 4 Wörter, mit „…“. */
export function starterOf(sentence: string): string {
  const head = sentence.split(/[,;:]/)[0] ?? sentence;
  const words = head.trim().split(/\s+/).slice(0, 4);
  return `${words.join(' ')} …`;
}

/** Satzanfang zum Weiterschreiben (ohne „…“, mit Leerzeichen am Ende). */
export const starterPrefill = (sentence: string): string => `${starterOf(sentence).replace(/\s*…$/, '')} `;

/** Feste Mischung (gleiche Eingabe → gleiche Reihenfolge, kein Würfeln beim Neuzeichnen). */
function seeded<T>(xs: readonly T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Stufe 1: die vier Mustersätze gemischt (nie in Musterreihenfolge). */
export function orderPool(o: Objection): { move: Move; text: string }[] {
  const list = MOVES.map((k) => ({ move: k, text: o.model[k] }));
  const mixed = seeded(list, o.id);
  return mixed.every((x, i) => x.move === MOVES[i]) ? [...mixed.slice(1), mixed[0] as { move: Move; text: string }] : mixed;
}

/** Stufe 2: je Schritt der eigene Mustersatz und zwei Sätze desselben Schritts aus Einwänden anderer Art (passen inhaltlich nicht). */
export function choiceOptions(o: Objection, all: readonly Objection[], move: Move): { text: string; ok: boolean }[] {
  const others = seeded(all.filter((x) => x.id !== o.id && x.kind !== o.kind), `${o.id}|${move}`).slice(0, 2);
  return seeded([{ text: o.model[move], ok: true }, ...others.map((x) => ({ text: x.model[move], ok: false }))], `${o.id}|${move}|mix`);
}

/** Anteil richtig zugeordneter Schritte (Stufe 1: Reihenfolge, Stufe 2: Wahl je Schritt). */
export function structuredPart(picked: readonly (Move | null)[]): number {
  return picked.filter((m, i) => m === MOVES[i]).length / MOVES.length;
}
