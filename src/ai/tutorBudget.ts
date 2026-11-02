import { dayKey } from '../domain/date';
import { local } from '../platform/storage';

// Tagesbremse für Tutor-Aufrufe (KI-Tutor-MVP, docs/umbau/ki-tutor.md §3.3): höchstens 20 je Tag und Gerät.
// Nur `localStorage` (Bequemlichkeit, keine Datenbank). Tageswechsel um 04:00 (dayKey). Gezählt wird, wenn ein
// Aufruf gestartet wird; ein Fehler gibt ihn nicht zurück (sonst wäre „Erneut versuchen“ eine Hintertür).

// UX-Neuanfang (Prüfung learning-scientist 02.11.2026): die automatische Erklärung bei falscher Antwort hat einen eigenen Topf
// (`explain`, 30 je Tag), damit sie die Zweitmeinung („Sicher?“, Satzprüfung, Aufgaben erzeugen) nie aufbraucht.

export const TUTOR_PER_DAY = 20;
export const EXPLAIN_PER_DAY = 30;
export type TutorPool = 'main' | 'explain';
const KEYS: Record<TutorPool, string> = { main: 'lx:tutor-day', explain: 'lx:tutor-explain-day' };
const LIMIT: Record<TutorPool, number> = { main: TUTOR_PER_DAY, explain: EXPLAIN_PER_DAY };

type Day = { d: string; n: number };

function read(now: number, pool: TutorPool = 'main'): Day {
  const v = local.getJson<Partial<Day>>(KEYS[pool]);
  const d = dayKey(now);
  if (v && v.d === d && typeof v.n === 'number' && v.n >= 0) return { d, n: Math.floor(v.n) };
  return { d, n: 0 };
}

export function tutorUsedToday(now: number = Date.now(), pool: TutorPool = 'main'): number {
  return read(now, pool).n;
}

export const tutorLeft = (now: number = Date.now(), pool: TutorPool = 'main'): number => Math.max(0, LIMIT[pool] - read(now, pool).n);

/** Zählt einen Aufruf im Topf `pool`. `false` = Tageslimit erreicht, nichts gezählt. */
export function takeTutorCall(now: number = Date.now(), pool: TutorPool = 'main'): boolean {
  const cur = read(now, pool);
  if (cur.n >= LIMIT[pool]) return false;
  local.set(KEYS[pool], JSON.stringify({ d: cur.d, n: cur.n + 1 }));
  return true;
}
