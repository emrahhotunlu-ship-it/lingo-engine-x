import { hash32 } from '../random';

// Samstags-Kapitel-Mix (Lernplattform 3.0 §2.1/§2.2, P15): alle Plätze aus Mustern von möglichst vielen Kapiteln, fälligste zuerst.
// Rein; die Kandidaten kommen sortiert nach Fälligkeit (ältester `last` zuerst) mit ihrem Kapitel.

export type MixCand = { pat: string; chapter: number; last: number };

/** Mindestzahl verschiedener Kapitel im Mix (wenn die Kandidaten sie hergeben). */
export const MIX_MIN_CHAPTERS = 3;

/**
 * `n` Muster: zuerst je Kapitel das fälligste (reihum nach Fälligkeit), bis `MIX_MIN_CHAPTERS` Kapitel erreicht sind; der Rest nach Fälligkeit.
 * Kein Muster doppelt, solange es genug gibt. Stabil: gleiche Fälligkeit entscheidet `seed`.
 */
export function mixPick(cands: readonly MixCand[], n: number, seed: string): string[] {
  const sorted = [...cands].sort((a, b) => a.last - b.last || hash32(`${seed}|${a.pat}`) - hash32(`${seed}|${b.pat}`));
  const out: MixCand[] = [];
  const chapters = new Set<number>();
  for (const c of sorted) {
    if (out.length >= n || chapters.size >= MIX_MIN_CHAPTERS) break;
    if (chapters.has(c.chapter)) continue;
    out.push(c);
    chapters.add(c.chapter);
  }
  for (const c of sorted) {
    if (out.length >= n) break;
    if (!out.includes(c)) out.push(c);
  }
  // Fälligste zuerst in der Ausgabe.
  return out.sort((a, b) => a.last - b.last).map((c) => c.pat);
}
