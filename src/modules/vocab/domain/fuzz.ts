// Fuzz-Korridor nach Ankis Formel (M10; Anki `rslib/src/scheduler/states/fuzz.rs`), ab 2,5 Tagen.
// Ist ein Abstands-Deckel aktiv, ist der Korridor einseitig: von Deckel minus Fuzz-Breite bis zum Deckel (plan.md §4.2 Nr. 5).

const RANGES: ReadonlyArray<{ start: number; end: number; factor: number }> = [
  { start: 2.5, end: 7, factor: 0.15 },
  { start: 7, end: 20, factor: 0.1 },
  { start: 20, end: Infinity, factor: 0.05 },
];

/** Halbe Breite des Korridors in Tagen (Anki: 1 Tag Grundbreite + Faktoren je Abschnitt). */
export function fuzzDelta(ivl: number): number {
  if (ivl < 2.5) return 0;
  let delta = 1;
  for (const r of RANGES) delta += r.factor * Math.max(0, Math.min(ivl, r.end) - r.start);
  return delta;
}

/** Korridor [lo, hi] in ganzen Tagen. Anki-Testwerte: 7 → 5–9, 17 → 14–20, 37 → 33–41. */
export function fuzzRange(ivl: number, max = 36_500): [number, number] {
  const delta = fuzzDelta(ivl);
  let lo = Math.round(ivl - delta);
  let hi = Math.round(ivl + delta);
  lo = Math.max(1, Math.min(lo, max));
  hi = Math.max(lo, Math.min(hi, max));
  if (ivl >= 2.5 && lo === Math.round(ivl) && hi === lo) hi = lo + 1;
  return [lo, hi];
}

/**
 * Korridor mit Deckel: liegt das Intervall auf oder über dem Deckel, gilt [Deckel − Breite, Deckel]; bei Deckel 1 Tag keine Streuung.
 * Liegt es darunter, gilt der normale Korridor, oben am Deckel abgeschnitten. Kein Tag liegt je über dem Deckel.
 */
export function corridor(ivl: number, cap: number | null): [number, number] {
  if (cap === null) return fuzzRange(ivl);
  if (cap <= 1) return [1, 1];
  if (ivl >= cap) {
    const w = Math.max(1, Math.round(fuzzDelta(cap)));
    return [Math.max(1, cap - w), cap];
  }
  const [lo, hi] = fuzzRange(ivl);
  return [Math.min(lo, cap), Math.min(hi, cap)];
}
