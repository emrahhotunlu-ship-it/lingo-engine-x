import { isoWeek } from '../date';
import type { StoredPlan } from './types';

// Kurzer Tag (Emrahs Entscheidung 2A, 04.11.2026): An einem vollen Tag lässt sich der Tagesweg von heute EINMAL auf ca. 10 Minuten verkürzen –
// nur solange an diesem Tag noch nichts erledigt ist (danach steht er fest, Kap. 15: kein springender Zähler), höchstens zweimal je
// Kalenderwoche. Die Pflichtschritte bleiben dieselben (Wörter · Grammatik · Anwenden bzw. Wochen-Check), nur ihre Größe sinkt; die Serie hält,
// sobald der kurze Tagesweg erledigt ist (dieselbe Pflicht-Regel). Rein; der Aufrufer schreibt.

type Raw = Record<string, unknown>;

export const SHORT_DAY_GOAL = 10;
export const SHORT_WEEK_MAX = 2;
/** Minuten je Schritt am kurzen Tag (Wörter, Grammatik, Anwenden). Der Wochen-Check behält seine Minuten. */
export const SHORT_MIN = { 1: 5, 2: 3, 3: 2 } as const;

/** Wie viele kurze Tage in der Kalenderwoche von `today` schon genommen wurden (`app/profile.kt = {Tag: 1}`), heute eingeschlossen. */
export function shortDaysInWeek(kt: unknown, today: string): number {
  if (!kt || typeof kt !== 'object' || Array.isArray(kt)) return 0;
  const week = isoWeek(today);
  return Object.entries(kt as Raw).filter(([d, v]) => v === 1 && /^\d{4}-\d{2}-\d{2}$/.test(d) && isoWeek(d) === week).length;
}

export type ShortDayCheck = {
  plan: StoredPlan | null;
  today: string;
  /** `app/profile.kt` */
  kt: unknown;
  /** An diesem Tag ist noch nichts erledigt oder angefangen (kein Schritt, keine Aktivität, keine offene Runde). */
  untouched: boolean;
};

/** Darf der Tagesweg von heute verkürzt werden? Nur ein Tagesweg-Plan (drei Schritte), noch nicht kurz, kein C1-Check-Tag, unberührt, Wochengrenze. */
export function shortDayAllowed(c: ShortDayCheck): boolean {
  const u = c.plan?.u;
  if (!u || u.tw !== 1 || u.kt === 1 || u.c1 === 'check') return false;
  if (!c.untouched) return false;
  if (u.min <= SHORT_DAY_GOAL) return false;
  return shortDaysInWeek(c.kt, c.today) < SHORT_WEEK_MAX;
}

/** Noch verfügbare kurze Tage in dieser Woche (für den Hinweis „noch n× diese Woche“). */
export const shortDaysLeft = (kt: unknown, today: string): number => Math.max(0, SHORT_WEEK_MAX - shortDaysInWeek(kt, today));

/**
 * Neuer roher Plan: Minuten der drei Schritte verkleinert (`u.b`), `u.goalMin` = 10 (daraus folgt die kleinste Grammatik-Runde), `u.min`
 * neu, `u.kt = 1`; die Wortzahl des alten Wörter-Wegs (`goal.review`) im selben Verhältnis. Pflichtschritte, Themen, Muster und unbekannte
 * Felder bleiben erhalten (Datenregel: nie strippen). `null`, wenn der Plan keine Tageseinheit hat.
 */
export function shortDayPlan<T extends Raw>(plan: T): T | null {
  const u = plan.u;
  if (!u || typeof u !== 'object' || Array.isArray(u) || !Array.isArray((u as Raw).b)) return null;
  const blocks = (u as Raw).b as unknown[];
  let wordsWas = 0;
  const b = blocks.map((x): unknown => {
    if (!Array.isArray(x) || x.length < 3) return x;
    const arr = x as unknown[];
    const [n, kind, m] = arr;
    if (n === 1 && typeof m === 'number') wordsWas = m;
    const keep = kind === 'task.check';
    const want = n === 1 || n === 2 || n === 3 ? SHORT_MIN[n] : null;
    if (keep || want === null || typeof m !== 'number' || m <= want) return arr;
    const next: unknown[] = [...arr];
    next[2] = want;
    return next;
  });
  const min = b.reduce<number>((a, x) => a + (Array.isArray(x) && typeof x[2] === 'number' ? x[2] : 0), 0);
  const nextU: Raw = { ...(u as Raw), b, goalMin: SHORT_DAY_GOAL, min, kt: 1 };
  const out: Raw = { ...plan, u: nextU };
  const goal = plan.goal;
  if (goal && typeof goal === 'object' && !Array.isArray(goal) && typeof (goal as Raw).review === 'number' && wordsWas > SHORT_MIN[1]) {
    const r = (goal as Raw).review as number;
    out.goal = { ...(goal as Raw), review: Math.max(Math.min(r, 3), Math.round((r * SHORT_MIN[1]) / wordsWas)) };
  }
  return out as T;
}
