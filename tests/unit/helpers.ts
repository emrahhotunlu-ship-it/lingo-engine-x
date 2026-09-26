import { readFileSync } from 'node:fs';

export type Doc = Record<string, unknown>;

export function loadSeed(): Record<string, Doc> {
  return JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;
}

/** Zeitpunkt in Europe/Berlin (Sommerzeit, UTC+2) – der Stichtag der Testdaten ist der 20.09.2026. */
export const berlin = (key: string, hour: number, min = 0): number =>
  Date.parse(`${key}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00+02:00`);

export const SEED_ANCHOR = '2026-09-20';
