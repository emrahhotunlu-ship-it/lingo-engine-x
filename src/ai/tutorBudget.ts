import { dayKey } from '../domain/date';
import { local } from '../platform/storage';

// Tagesbremse für Tutor-Aufrufe (KI-Tutor-MVP, docs/umbau/ki-tutor.md §3.3): höchstens 20 je Tag und Gerät.
// Nur `localStorage` (Bequemlichkeit, keine Datenbank). Tageswechsel um 04:00 (dayKey). Gezählt wird, wenn ein
// Aufruf gestartet wird; ein Fehler gibt ihn nicht zurück (sonst wäre „Erneut versuchen“ eine Hintertür).

export const TUTOR_PER_DAY = 20;
const KEY = 'lx:tutor-day';

type Day = { d: string; n: number };

function read(now: number): Day {
  const v = local.getJson<Partial<Day>>(KEY);
  const d = dayKey(now);
  if (v && v.d === d && typeof v.n === 'number' && v.n >= 0) return { d, n: Math.floor(v.n) };
  return { d, n: 0 };
}

export function tutorUsedToday(now: number = Date.now()): number {
  return read(now).n;
}

export const tutorLeft = (now: number = Date.now()): number => Math.max(0, TUTOR_PER_DAY - read(now).n);

/** Zählt einen Aufruf. `false` = Tageslimit erreicht, nichts gezählt. */
export function takeTutorCall(now: number = Date.now()): boolean {
  const cur = read(now);
  if (cur.n >= TUTOR_PER_DAY) return false;
  local.set(KEY, JSON.stringify({ d: cur.d, n: cur.n + 1 }));
  return true;
}
