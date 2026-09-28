import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// E2E-Helfer des Bereichs „Heute & Tageseinheit“ – Besitz: Paket P1 (docs/neubau/architektur.md §5.3).
// Gemeinsame Navigation (openTab, openEntry, openProfile, bootAt …) steht in `fixtures.ts` (WP0).

type Doc = Record<string, unknown>;
type Docs = Record<string, Doc>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;

/** Montag nach dem Stichtag der Testdaten (Kalenderwoche 2026-W39), 09:00 in Berlin. */
export const MON = '2026-09-21';
export const MON_9 = '2026-09-21T09:00:00+02:00';
export const TUE_9 = '2026-09-22T09:00:00+02:00';
export const SUN_9 = '2026-09-27T09:00:00+02:00';

/** `app/week` mit bestätigtem Thema für KW 39 (keine Bestätigungskarte). */
export const WEEK_W39 = { 'app/week': { v: 1, cur: { wk: '2026-W39', theme: 't01', by: 'user', at: 1 } } };

/** Zwei beantwortete Wiederholungen von heute (`ctx:'rev'`) – mit `goal.review = 2` ist Block 1 erledigt. */
export const reviewedLog = (day: string): Docs => ({
  [`log/${day}`]: {
    date: day,
    entries: [
      { t: 1, ok: true, lang: 'de', k: 'v', id: 'avoid', m: 'tr-type', given: 'avoid', ans: 'avoid', g: 3, ms: 1000, ctx: 'rev' },
      { t: 2, ok: true, lang: 'de', k: 'v', id: 'handle', m: 'tr-type', given: 'handle', ans: 'handle', g: 3, ms: 1000, ctx: 'rev' },
    ],
  },
});

const MON_BLOCKS: Array<[number, string, number]> = [
  [1, 'review', 8],
  [2, 'input.read', 5],
  [3, 'task.say', 9],
  [4, 'focus', 3],
  [5, 'again', 2],
];

/** Gespeicherter Tagesplan der Einheit für einen Montag mit `goal.review = 2`. */
export function mondayPlan(day = MON): Doc {
  return {
    d: day,
    v: 1,
    ids: [],
    why: [],
    duty: ['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again'],
    goal: { review: 2, due: 2, new: 0, ahead: 0 },
    lesson: null,
    at: 1,
    u: { v: 1, shape: 'full', goalMin: 25, theme: 't01', min: 27, b: MON_BLOCKS },
  };
}

/** `app/profile` aus dem Seed mit Plan, den genannten erledigten Blöcken (`u-*`) und `answers` Antworten heute. */
export function profileWith(day: string, plan: Doc, done: string[] = [], over: Doc = {}, answers = 2): Docs {
  const profile = SEED['app/profile'] as Doc;
  const act = { ...(profile.act as Record<string, Doc>) };
  act[day] = { ...(act[day] ?? {}), ...Object.fromEntries(done.map((k) => [k, 1])) };
  const days = { ...(profile.days as Doc), ...(answers > 0 ? { [day]: answers } : {}) };
  return { 'app/profile': { plan, act, days, ...over } };
}

/** Wartet, bis die Tageskarte steht, und liefert ihren Zähler. */
export async function unitStatus(page: Page): Promise<{ done: number; total: number }> {
  const s = page.getByTestId('today-status');
  await expect(s).toBeVisible();
  return { done: Number(await s.getAttribute('data-done')), total: Number(await s.getAttribute('data-total')) };
}
