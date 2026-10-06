import { alignWords, splitWords } from '../answer/align';
import type { WordOp } from '../learn/types';

// Fehlerstelle eines falschen Satzes (Lernplattform 2.0 §4.7, §5.7): Die falsche Fassung wird mit der richtigen Wort für Wort
// verglichen (`alignWords`). Abweichungen, die direkt aufeinander folgen, bilden einen Bereich. Am Handy tippt Emrah die
// Stelle an und ersetzt nur sie. Indizes zählen die Wörter des falschen Satzes (`splitWords`, Satzzeichen hängen am Wort).

export type Span = [from: number, to: number];

export const SPAN_MAX_WORDS = 4;
export const SPANS_MAX = 3;

/** Alle Bereiche in der Reihenfolge des Satzes (ohne Längenprüfung). */
function regions(wrong: string, right: string): Span[] | null {
  const nWrong = splitWords(wrong).length;
  if (!nWrong) return null;
  const ops: WordOp[] = alignWords(wrong, right);
  const out: Span[] = [];
  let pos = 0; // Index des nächsten Worts der falschen Fassung
  let cur: { from: number; to: number } | null = null;
  const close = () => {
    if (!cur) return;
    // Fehlen nur Wörter (kein Wort der falschen Fassung beteiligt), steht die Stelle am folgenden Wort (sonst am vorigen).
    let { from, to } = cur;
    if (to < from) {
      if (from < nWrong) to = from;
      else {
        from = nWrong - 1;
        to = nWrong - 1;
      }
    }
    out.push([from, to]);
    cur = null;
  };
  for (const op of ops) {
    if (op.op === 'eq') {
      close();
      pos++;
      continue;
    }
    cur ??= { from: pos, to: pos - 1 };
    if (op.op !== 'del') {
      cur.to = pos;
      pos++;
    }
  }
  close();
  return out;
}

/** Genau ein Bereich mit höchstens 4 Wörtern, sonst `null`. */
export function errorSpan(wrong: string, right: string): Span | null {
  const r = regions(wrong, right);
  if (!r || r.length !== 1) return null;
  const [s] = r as [Span];
  return s[1] - s[0] + 1 <= SPAN_MAX_WORDS ? s : null;
}

/** Bis zu drei Bereiche mit je höchstens 4 Wörtern, sonst `null` (kein Bereich = gleiche Sätze = `null`). */
export function errorSpans(wrong: string, right: string): Span[] | null {
  const r = regions(wrong, right);
  if (!r || !r.length || r.length > SPANS_MAX) return null;
  return r.every((s) => s[1] - s[0] + 1 <= SPAN_MAX_WORDS) ? r : null;
}
