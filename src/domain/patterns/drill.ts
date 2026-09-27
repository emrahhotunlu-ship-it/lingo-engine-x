import { repairNorm } from '../repair/repair';
import type { Mistake } from './mistakes';
import { matchPattern, type Pattern } from './patterns';

// Kurzdrill einer Deutsch-Falle (Lernberatung 27.09., V3): etwa 6 Aufgaben – zuerst bis zu 4
// eigene Sätze korrigieren (Beispiele des Musters, dann weitere zugeordnete Fehler, neueste
// zuerst), dann 2–3 neue Sätze frei bilden. Rein und getestet.

export const DRILL_SIZE = 6;
export const DRILL_FIX_MAX = 4;
export const DRILL_FREE_MIN = 2;
export const DRILL_FREE_MAX = 3;

export type DrillTask = { kind: 'fix'; wrong: string; right: string } | { kind: 'free'; task: string };

export function drillTasks(p: Pattern, mistakes: readonly Mistake[], all: readonly Pattern[]): DrillTask[] {
  const seen = new Set<string>();
  const fix: DrillTask[] = [];
  const add = (wrong: string, right: string) => {
    const k = repairNorm(wrong);
    if (!k || seen.has(k) || repairNorm(right) === k || fix.length >= DRILL_FIX_MAX) return;
    seen.add(k);
    fix.push({ kind: 'fix', wrong, right });
  };
  for (const ex of p.examples) add(ex.wrong, ex.right);
  for (const m of mistakes) if (matchPattern(m, all) === p.id) add(m.wrong, m.right);
  // Mindestens 2 freie Sätze (wenn vorhanden), zusammen etwa 6 Aufgaben.
  const freeN = Math.min(p.tasks.length, DRILL_FREE_MAX, Math.max(DRILL_FREE_MIN, DRILL_SIZE - fix.length));
  const free: DrillTask[] = p.tasks.slice(0, freeN).map((task) => ({ kind: 'free', task }));
  return [...fix, ...free];
}
