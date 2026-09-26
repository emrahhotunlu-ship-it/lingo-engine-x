import { isDictWord } from '../lexicon/dict';
import type { Verdict } from '../learn/types';
import { hash32, mulberry32, shuffle } from '../random';

// Satzbau (phase2-plan §5.6): einen Satz aus 7–14 Bausteinen legen. Feste Wendungen bleiben
// ein Baustein, dazu 1–2 Ablenker mit Grammatikbezug (did, do, is …). Die Mischung ist nie
// gleich der Lösung. Wertung gegen alle gültigen Reihenfolgen; genau ein versetzter Baustein
// ist „fast richtig", ein benutzter Ablenker „falsch". Keine BKT-Schreibvorgänge (D12).

export type Tile = { id: number; text: string; distractor: boolean };
export type OrderItem = {
  key: string;
  sentence: string;
  /** Satzzeichen am Ende (wird nicht gelegt). */
  end: string;
  /** Lösung als Baustein-Texte. */
  solution: string[];
  /** Weitere gültige Reihenfolgen. */
  accepted: string[][];
  /** Gemischte Bausteine inkl. Ablenker. */
  tiles: Tile[];
};

export const ORDER_ROUND = 6;
export const TILES_MIN = 7;
export const TILES_MAX = 14;

/** Feste Wendungen, die ein Baustein bleiben. */
const FIXED = ['as soon as', 'as well as', 'in order to', 'at the moment', 'at the end of', 'in front of', 'as long as', 'even though', 'so far', 'used to', 'going to', 'have to', 'had to', 'has to', 'next week', 'last week', 'last year', 'next year', 'right now', 'by the time'];

function splitSentence(sentence: string, isPhrase?: (p: string) => boolean): { tiles: string[]; end: string } {
  const m = /([.!?]+)["”']?$/.exec(sentence.trim());
  const end = m ? m[0] : '';
  const body = end ? sentence.trim().slice(0, -end.length) : sentence.trim();
  const words = body.split(/\s+/).filter(Boolean);
  const tiles: string[] = [];
  for (let i = 0; i < words.length; ) {
    let took = 0;
    for (const len of [4, 3, 2]) {
      if (i + len > words.length) continue;
      const cand = words
        .slice(i, i + len)
        .join(' ')
        .toLowerCase()
        .replace(/[,;:]$/, '');
      if (FIXED.includes(cand) || isPhrase?.(cand)) {
        took = len;
        break;
      }
    }
    if (took) {
      tiles.push(words.slice(i, i + took).join(' '));
      i += took;
    } else {
      tiles.push(words[i] as string);
      i++;
    }
  }
  // Der Großbuchstabe am Anfang verrät den ersten Baustein – außer bei „I" und Namen.
  const first = tiles[0];
  if (first && first !== 'I' && !/^I'/.test(first) && isDictWord(first.toLowerCase().replace(/[^a-z'-]/g, ''))) tiles[0] = first.charAt(0).toLowerCase() + first.slice(1);
  return { tiles, end };
}

const DISTRACTORS_Q = ['did', 'do', 'does'];
const DISTRACTORS_S = ['is', 'did', 'does', 'was', 'have'];
const key = (t: string) => t.toLowerCase().replace(/[,;:]$/, '');

export function buildOrder(sentence: string, opts: { seed: string; accepted?: readonly string[]; isPhrase?: (p: string) => boolean }): OrderItem | null {
  const { tiles: solution, end } = splitSentence(sentence, opts.isPhrase);
  if (solution.length < TILES_MIN - 1 || solution.length > TILES_MAX - 1) return null;
  const lower = new Set(solution.map(key));
  const pool = (end.startsWith('?') ? DISTRACTORS_Q : DISTRACTORS_S).filter((d) => !lower.has(d));
  const nDis = Math.min(solution.length >= 11 ? 1 : 2, TILES_MAX - solution.length, pool.length);
  const rng = mulberry32(hash32(`${opts.seed}|${sentence}`));
  const distractors = shuffle(pool, rng).slice(0, Math.max(1, nDis));
  const all: Tile[] = [...solution.map((text, id) => ({ id, text, distractor: false })), ...distractors.map((text, k) => ({ id: solution.length + k, text, distractor: true }))];
  const accepted = (opts.accepted ?? []).map((a) => splitSentence(a, opts.isPhrase).tiles).filter((t) => t.length === solution.length);
  let tiles = shuffle(all, rng);
  // Nie gleich der Lösung: Liegen die echten Bausteine in Lösungsreihenfolge, wird rotiert.
  for (let guard = 0; guard < all.length && isSolved(tiles.filter((t) => !t.distractor).map((t) => t.text), solution, accepted); guard++) {
    tiles = [...tiles.slice(1), tiles[0] as Tile];
  }
  return { key: `order:${hash32(sentence)}`, sentence, end, solution, accepted, tiles };
}

function sameSeq(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((x, i) => key(x) === key(b[i] ?? ''));
}

function isSolved(seq: readonly string[], solution: readonly string[], accepted: readonly (readonly string[])[]): boolean {
  return sameSeq(seq, solution) || accepted.some((a) => sameSeq(seq, a));
}

/** Liegt genau ein Baustein an falscher Stelle (herausnehmen und woanders einsetzen löst den Satz)? */
function oneMoved(seq: readonly string[], target: readonly string[]): number | null {
  if (seq.length !== target.length) return null;
  for (let i = 0; i < seq.length; i++) {
    const rest = [...seq.slice(0, i), ...seq.slice(i + 1)];
    for (let j = 0; j <= rest.length; j++) {
      if (j === i) continue;
      const tryout = [...rest.slice(0, j), seq[i] as string, ...rest.slice(j)];
      if (sameSeq(tryout, target)) return i;
    }
  }
  return null;
}

export type OrderCheck = { verdict: Verdict; usedDistractor: boolean; /** Positionen (in der Eingabe) falsch gesetzter Bausteine. */ misplaced: number[] };

/** Prüfen einer gelegten Reihenfolge (Baustein-Kennungen in Legereihenfolge). */
export function checkOrder(item: OrderItem, placed: readonly number[]): OrderCheck {
  const byId = new Map(item.tiles.map((t) => [t.id, t]));
  const tiles = placed.map((id) => byId.get(id)).filter((t): t is Tile => !!t);
  const usedDistractor = tiles.some((t) => t.distractor);
  const seq = tiles.map((t) => t.text);
  const targets = [item.solution, ...item.accepted];
  if (!usedDistractor && targets.some((t) => sameSeq(seq, t))) return { verdict: 'correct', usedDistractor, misplaced: [] };
  const best = item.solution;
  const misplaced = seq.map((t, i) => (key(t) === key(best[i] ?? '') ? -1 : i)).filter((i) => i >= 0);
  if (usedDistractor) return { verdict: 'wrong', usedDistractor, misplaced };
  for (const t of targets) {
    const moved = oneMoved(seq, t);
    if (moved !== null) return { verdict: 'near', usedDistractor, misplaced: [moved] };
  }
  return { verdict: 'wrong', usedDistractor, misplaced };
}
