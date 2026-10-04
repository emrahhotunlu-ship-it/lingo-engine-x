import { TRAPS, type Trap } from '../../content/nb/traps';
import { hash32 } from '../random';
import { matchTraps } from './traps';
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

// ------------------------------------------------------------------ Startsatz (plan.md N43, lehrer.md W9)

/** Ein Satz einer Falle aus dem Startsatz (`content/nb/traps.ts`). Zählt nie in den Trend (nur eigene). */
export type StartTask = { kind: 'trap'; trapId: string; wrong: string; right: readonly string[] };
export type MixedTask = DrillTask | StartTask;

/** Sätze aus dem Startsatz im Drill (lehrer.md W9: „mischt drei Fallen mit seinen eigenen Sätzen“). */
export const START_MIX = 3;

/**
 * Drei Startsatz-Fallen für ein Muster: zuerst Fallen, die in den Beispielen des Musters stecken,
 * dann die Fallen der Woche, dann der Startsatz ab einer Stelle je Tag (fest je Tag, Kap. 15).
 */
export function startTraps(p: Pick<Pattern, 'examples'> | null, day: string, weekTraps: readonly string[] = [], traps: readonly Trap[] = TRAPS): Trap[] {
  const out: Trap[] = [];
  const add = (t: Trap | undefined) => {
    if (t && !out.some((x) => x.id === t.id) && out.length < START_MIX) out.push(t);
  };
  for (const ex of p?.examples ?? []) for (const hit of matchTraps(ex.wrong, traps)) add(traps.find((t) => t.id === hit.id));
  for (const id of weekTraps) add(traps.find((t) => t.id === id));
  const start = traps.length ? hash32(day) % traps.length : 0;
  for (const t of [...traps.slice(start), ...traps.slice(0, start)]) add(t);
  return out;
}

/** Eigene Aufgaben, dazwischen je ein Satz von 3 Startsatz-Fallen (an Stelle 2, 4, 6 – verschachtelt). */
export function mixStartSet(own: readonly DrillTask[], traps: readonly Trap[], day: string): MixedTask[] {
  const start: StartTask[] = traps.slice(0, START_MIX).map((t) => {
    const d = t.drills[hash32(`${day}|${t.id}`) % Math.max(1, t.drills.length)] ?? { wrong: t.wrong, right: [t.right] };
    return { kind: 'trap', trapId: t.id, wrong: d.wrong, right: d.right };
  });
  const out: MixedTask[] = [];
  let k = 0;
  for (let i = 0; i < own.length; i++) {
    out.push(own[i]!);
    if (i % 2 === 0 && k < start.length) out.push(start[k++]!);
  }
  while (k < start.length) out.push(start[k++]!);
  return out;
}

/** Drill nur aus dem Startsatz (ohne eigene Muster, auch ohne KI): die 3 Sätze einer Falle. */
export function startSetDrill(trap: Trap): StartTask[] {
  return trap.drills.slice(0, START_MIX).map((d) => ({ kind: 'trap', trapId: trap.id, wrong: d.wrong, right: d.right }));
}
