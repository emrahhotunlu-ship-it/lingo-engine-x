import type { AnalysisSlot, Turn } from './types';

// Fester Teil des Abschlussberichts (Plan §5.4), ohne KI: Tatsachen statt Punktestand.

export type ReportStats = {
  /** Eigene Züge. */
  turns: number;
  ms: number;
  minutes: number;
  /** Analysierte Sätze und davon saubere. */
  analysed: number;
  clean: number;
  /** Fehlerkategorie → Anzahl. */
  errs: Record<string, number>;
  /** Häufigste Kategorien (höchstens 3). */
  topCats: string[];
  /** Fokuswörter, die richtig benutzt wurden. */
  targets: string[];
  /** Eigene Züge, in die eine vorgeschlagene Wendung per Tipp eingefügt wurde. */
  chipTurns: number;
  taken: string[];
};

export function reportStats(turns: readonly Turn[], analyses: Readonly<Record<number, AnalysisSlot>>, taken: readonly string[], startedAt: number, endedAt: number): ReportStats {
  let n = 0;
  let analysed = 0;
  let clean = 0;
  let chipTurns = 0;
  const errs: Record<string, number> = {};
  const targets = new Set<string>();
  turns.forEach((t, i) => {
    if (t.role !== 'me') return;
    n++;
    if (t.usedChip) chipTurns++;
    const a = analyses[i];
    if (a?.state !== 'done' || !a.data) return;
    analysed++;
    if (a.data.verdict === 'clean') clean++;
    for (const e of a.data.errors) errs[e.cat] = (errs[e.cat] ?? 0) + 1;
    for (const w of a.data.targets) targets.add(w);
  });
  const ms = Math.max(0, Math.round(endedAt - startedAt));
  const topCats = Object.entries(errs)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([c]) => c);
  return { turns: n, ms, minutes: Math.max(1, Math.round(ms / 60_000)), analysed, clean, errs, topCats, targets: [...targets], chipTurns, taken: [...new Set(taken)] };
}
