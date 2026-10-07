import type { Verdict } from '../learn/types';
import { hash32, mulberry32, shuffle } from '../random';
import { poolNorm, segment, type OrderTrap, type PoolEntry } from './orderPool';

// Satzbau (phase2-plan §5.6, neu 02.10.2026): einen englischen Satz aus 5–9 Bausteinen legen, dessen deutsche
// Bedeutung vorab dasteht. Alle Bausteine gehören dazu (keine Ablenker), feste Wendungen sind ein Baustein. Die
// Mischung ist nie gleich der Lösung oder einer gültigen Umstellung. Wertung gegen alle gültigen Reihenfolgen;
// genau ein versetzter Baustein ist „fast richtig". Keine BKT-Schreibvorgänge (D12).

export type Tile = { id: number; text: string; distractor: boolean };
export type OrderItem = {
  key: string;
  sentence: string;
  /** Satzzeichen am Ende (wird nicht gelegt). */
  end: string;
  /** Deutsche Bedeutung (steht vorab da). */
  de: string;
  /** Lösung als Baustein-Texte. */
  solution: string[];
  /** Weitere gültige Reihenfolgen. */
  accepted: string[][];
  /** Weitere gültige Sätze (Anzeige „Auch richtig“). */
  alts: string[];
  /** Warum-Zeile zum Satz. */
  why: { de: string; en: string };
  /** Typische falsche Fassung (optional). */
  bad: string | null;
  /** Gemischte Bausteine. */
  tiles: Tile[];
  /** Neuer, von Claude erzeugter Satz (geprüft), nicht aus dem festen Pool. */
  ai?: boolean;
  /** Muster des Satzes (Grammatik-Muster-Kennung), wenn bekannt. */
  pat?: string | null;
  /** Fallen-Baustein dieses Satzes (nur gesetzt, wenn er als Ablenker im Vorrat liegt). */
  trap?: OrderTrap | null;
};

/** Ab dieser Beherrschung des Themas liegt ein Fallen-Baustein im Vorrat (Lernplattform 2.0 §5.8). */
export const TRAP_FROM_P = 0.4;

export const ORDER_ROUND = 6;

const key = (t: string) => poolNorm(t);

/** Satzzeichen am Ende des Satzes. */
const endOf = (s: string): string => /([.!?]+)["”']?$/.exec(s.trim())?.[0] ?? '';

/** Aufgabe aus einem Pool-Eintrag. Die Mischung hängt nur von `seed` und dem Satz ab. */
export function buildOrder(entry: PoolEntry, opts: { seed: string; topicRef?: string; /** Beherrschung des Themas (`topicP`); ab 0,4 kommt der Fallen-Baustein dazu. */ p?: number | null }): OrderItem {
  const solution = [...entry.chunks];
  const accepted = entry.alt.map((a) => segment(a, entry.chunks)).filter((s): s is string[] => s !== null);
  const rng = mulberry32(hash32(`${opts.seed}|${entry.en}`));
  const all: Tile[] = solution.map((text, id) => ({ id, text, distractor: false }));
  const trap = entry.trap && typeof opts.p === 'number' && opts.p >= TRAP_FROM_P ? entry.trap : null;
  if (trap) all.push({ id: all.length, text: trap.instead, distractor: true });
  let tiles = shuffle(all, rng);
  // Nie gleich der Lösung oder einer gültigen Umstellung: Liegen die Bausteine so, wird rotiert.
  for (let guard = 0; guard < all.length && isSolved(tiles.filter((t) => !t.distractor).map((t) => t.text), solution, accepted); guard++) {
    tiles = [...tiles.slice(1), tiles[0] as Tile];
  }
  return {
    key: `order:${hash32(entry.en)}|${opts.topicRef ?? `rules/${entry.topic}`}`,
    sentence: entry.en,
    end: endOf(entry.en),
    de: entry.de,
    solution,
    accepted,
    alts: [...entry.alt],
    why: entry.why,
    bad: entry.bad,
    tiles,
    ...(entry.ai ? { ai: true } : {}),
    ...(entry.pat ? { pat: entry.pat } : {}),
    ...(trap ? { trap } : {}),
  };
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
