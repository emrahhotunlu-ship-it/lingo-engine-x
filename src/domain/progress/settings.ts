// Einstellungen normalisieren (Plan §9, E11–E13): gelesene Werte können aus der alten App, von
// einem anderen Gerät oder unvollständig sein – angezeigt und verwendet wird immer ein gültiger Wert.

export const GOAL_MIN_OPTIONS = [10, 15, 20, 25, 30, 40] as const;
export const GOAL_MIN_DEFAULT = 25;
export const NEW_PER_DAY_OPTIONS = [0, 2, 5, 10] as const;
export const RATE_OPTIONS = [0.8, 0.9, 1, 1.1] as const;

const nearest = (v: number, opts: readonly number[]): number => opts.reduce((best, o) => (Math.abs(o - v) < Math.abs(best - v) ? o : best), opts[0] ?? v);

/** Tagesziel in Minuten; fehlt = 25. */
export function normGoalMin(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? nearest(v, GOAL_MIN_OPTIONS) : GOAL_MIN_DEFAULT;
}

/** Neue Wörter pro Tag; fehlt = 5 (wie die alte App). */
export function normNewPerDay(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? nearest(v, NEW_PER_DAY_OPTIONS) : 5;
}

/** Sprechtempo auf die Stufen 0,8–1,1; fehlt = 1. */
export function normRate(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? nearest(v, RATE_OPTIONS) : 1;
}

/** Ton an? Standard aus (Kap. 4.7). */
export const normSound = (v: unknown): boolean => v === true;

/**
 * Stimme für dieses Gerät (Plan E13): die gespeicherte, wenn sie es gibt, sonst die beste en-US-Stimme.
 * `missing` = gespeichert, aber auf diesem Gerät nicht vorhanden (Hinweis in den Einstellungen).
 */
export function resolveVoice(saved: unknown, available: ReadonlyArray<{ name: string; lang: string }>, best: string | null): { name: string | null; missing: boolean } {
  const want = typeof saved === 'string' && saved.trim() ? saved : null;
  if (want && available.some((v) => v.name === want)) return { name: want, missing: false };
  return { name: best, missing: !!want };
}
