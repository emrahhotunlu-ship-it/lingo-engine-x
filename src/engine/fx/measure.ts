import { logInfo } from '../../platform/diagnostics';
import { effectiveLevel } from './level';

// Messung der Momente (Lernplattform 3.0 P56/P60, §6): Jeder Moment setzt `html[data-moment]` für seine Dauer (Tests und CSS lesen es), misst die
// Bildabstände und schreibt danach EINE Zeile in die Diagnose: „Tag geschafft · 58 fps · längstes Bild 22 ms · Stufe full“. Die letzten 20 Zeilen
// stehen zusätzlich hier bereit, damit Emrah sie unter „Momente ansehen“ kopieren kann. Gemessen wird nur, solange der Moment läuft (≤ 1,4 s).

export type MomentName = 'round' | 'day' | 'level' | 'stack';

/** Namen in der Diagnose (Protokolltext wie die übrigen Diagnosezeilen, keine Oberfläche). */
export const MOMENT_LABEL: Readonly<Record<MomentName, string>> = { round: 'Runde geschafft', day: 'Tag geschafft', level: 'Aufstieg', stack: 'Kartenwechsel' };

/** Längste erlaubte Dauer eines Moments (EE1). */
export const MOMENT_MAX_MS = 1400;
/** So viele Zeilen bleiben zum Kopieren. */
export const LINES_MAX = 20;

let lines: readonly string[] = [];
const listeners = new Set<() => void>();

export type MomentStats = { fps: number; maxMs: number; frames: number };

/** Bildrate und längstes Bild aus Bildabständen (rein). */
export function momentStats(deltas: readonly number[]): MomentStats | null {
  if (deltas.length === 0) return null;
  const total = deltas.reduce((a, b) => a + b, 0);
  return { fps: Math.round((deltas.length * 1000) / Math.max(1, total)), maxMs: Math.round(Math.max(...deltas)), frames: deltas.length };
}

/** Diagnosezeile (rein): „Tag geschafft · 58 fps · längstes Bild 22 ms · Stufe calm“. */
export function momentLine(label: string, s: MomentStats | null, level: string): string {
  return s ? `${label} · ${s.fps} fps · längstes Bild ${s.maxMs} ms · Stufe ${level}` : `${label} · keine Messung · Stufe ${level}`;
}

export function pushLine(line: string): void {
  // Immer eine neue Liste: `useSyncExternalStore` erkennt die Änderung am Verweis.
  lines = [...lines, line].slice(-LINES_MAX);
  for (const l of [...listeners]) l();
}

export const momentLines = (): readonly string[] => lines;

export function subscribeMomentLines(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

let active = 0;

/**
 * Einen Moment beginnen: `data-moment` setzen, Bildabstände bis `ms` messen, dann Zeile schreiben und das Attribut entfernen.
 * Liefert eine Funktion zum vorzeitigen Beenden (Bildschirmwechsel, Überspringen).
 */
export function startMoment(name: MomentName, ms: number = MOMENT_MAX_MS): () => void {
  if (typeof document === 'undefined' || typeof requestAnimationFrame !== 'function') return () => undefined;
  const root = document.documentElement;
  const run = ++active;
  root.dataset.moment = name;
  root.dataset.momentLast = name;
  const level = effectiveLevel();
  const deltas: number[] = [];
  let last = 0;
  let raf = 0;
  let t0 = 0;
  let done = false;
  const finish = (): void => {
    if (done) return;
    done = true;
    cancelAnimationFrame(raf);
    if (active === run) delete root.dataset.moment;
    const line = momentLine(MOMENT_LABEL[name], momentStats(deltas), level);
    pushLine(line);
    logInfo('fx:moment', line);
  };
  const step = (t: number): void => {
    if (done) return;
    if (!t0) t0 = t;
    if (last) deltas.push(t - last);
    last = t;
    if (t - t0 >= ms) finish();
    else raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  // Sicherheitsnetz, falls keine Bilder kommen (Hintergrund-Tab): spätestens nach `ms` + 200 ms beenden.
  const guard = setTimeout(finish, ms + 200);
  return () => {
    clearTimeout(guard);
    finish();
  };
}

/** Nur für Tests. */
export function resetMeasure(): void {
  lines = [];
  active = 0;
}
