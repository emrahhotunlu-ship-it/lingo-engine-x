import type { ApplyKind, WriteKind } from './count';

// Längen und Dauer je Disziplin (F3, anwenden-plan.md Tabelle und Nachtrag learning-scientist „Sollte“): Handy kürzer und gegliedert (40–80 Wörter; Antwort mit
// einem Feld je Pflichtpunkt und Gruß; Zusammenfassung 3 Sätze, ≤ 70 Wörter), Laptop wie die Wochen-Mail. Rein, ohne Importe außer Typen.

export type Device = 'touch' | 'keys';

export type LengthGoal = {
  /** Zielbereich der Wörter. */
  words: readonly [number, number];
  /** Darunter lohnt die Prüfung nicht (der Knopf bleibt mit Grund gesperrt). */
  minSubmit: number;
  /** Nur Zusammenfassung: Zielbereich der Sätze. */
  sentences?: readonly [number, number];
};

const GOALS: Record<WriteKind, Record<Device, LengthGoal>> = {
  reply: { touch: { words: [40, 80], minSubmit: 30 }, keys: { words: [100, 160], minSubmit: 60 } },
  write: { touch: { words: [40, 80], minSubmit: 30 }, keys: { words: [120, 180], minSubmit: 60 } },
  summary: { touch: { words: [30, 70], minSubmit: 20, sentences: [3, 3] }, keys: { words: [50, 120], minSubmit: 35, sentences: [3, 5] } },
};

export const lengthGoal = (kind: WriteKind, device: Device): LengthGoal => GOALS[kind][device];

/** Ungefähre Minuten je Disziplin (Zeile auf der Seite „Anwenden“). */
export const APPLY_MINUTES: Readonly<Record<ApplyKind, number>> = { combo: 5, reply: 8, write: 10, summary: 10 };

const WORD_RE = /[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu;

/** Wörter eines Textes (Buchstaben- und Zahlfolgen, Apostroph und Bindestrich im Wort). */
export const countWords = (text: string): number => (text.match(WORD_RE) ?? []).length;

/** Sätze eines Textes: Abschnitte mit mindestens zwei Wörtern, getrennt durch . ! ? oder Zeilenumbruch. */
export function countSentences(text: string): number {
  return text
    .split(/[.!?]+(?:\s|$)|\n+/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) >= 2).length;
}

export type LengthState = 'short' | 'ok' | 'long';

/** Länge im Ziel? Wörter zuerst, bei der Zusammenfassung dazu die Satzzahl. */
export function lengthState(text: string, goal: LengthGoal): { words: number; sentences: number; state: LengthState } {
  const words = countWords(text);
  const sentences = countSentences(text);
  let state: LengthState = words < goal.words[0] ? 'short' : words > goal.words[1] ? 'long' : 'ok';
  if (state === 'ok' && goal.sentences) state = sentences < goal.sentences[0] ? 'short' : sentences > goal.sentences[1] ? 'long' : 'ok';
  return { words, sentences, state };
}

/** Handy-Antwort aus Feldern zusammensetzen: je Pflichtpunkt ein Absatz, dann der Gruß; leere Felder fallen weg. */
export function joinParts(parts: readonly string[]): string {
  return parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join('\n\n');
}
