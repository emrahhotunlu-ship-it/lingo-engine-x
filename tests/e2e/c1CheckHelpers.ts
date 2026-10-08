import { readdirSync, readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { boot, screen, type Theme } from './fixtures';
import { VG_BLOCKS, profileWith, reviewedLog, vgPlan } from './heuteHelpers';

// Gemeinsame Helfer des C1-Checks (c1Check.spec.ts, r4CheckShots.spec.ts; Lernplattform 3.0 §4.3, P40).

export type Doc = Record<string, unknown>;
type Item = { id: string; kind: 'mcc' | 'ocl' | 'wf' | 'kwt'; answer?: number; options?: string[]; accept?: string[]; keys?: Array<{ a: string[]; b: string[] }> };

const DIR = new URL('../../src/content/c1x/src/check/', import.meta.url);
export const CHECK_ITEMS = readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => (JSON.parse(readFileSync(new URL(f, DIR), 'utf8')) as { items: Item[] }).items);
export const BY_ID = new Map(CHECK_ITEMS.map((i) => [i.id, i]));

/** Mittwoch im Check-Fenster (letzte 7 Tage des Oktobers, Winterzeit). */
export const WED = '2026-10-28';
export const WED_9 = '2026-10-28T09:00:00+01:00';
/** Letzter Samstag des Oktobers: Check-Tag im Plan. */
export const SAT = '2026-10-31';
export const SAT_9 = '2026-10-31T09:00:00+01:00';

export const FLAGS = { 'lx:flags': JSON.stringify({ c1check: true }) };
export const emptyC1 = (): Doc => ({ v: 1, checks: [], gates: [], prod: [], bad: [] });

/** Tag geschafft (alle Pflichtpunkte erledigt), C1-Programm gestartet. */
export function donePatch(day: string, extra: Record<string, Doc> = {}): Record<string, Doc> {
  const plan = { ...vgPlan(day), u: { ...(vgPlan(day).u as Doc), b: VG_BLOCKS } };
  return { 'app/c1': emptyC1(), ...profileWith(day, plan, ['u-focus', 'u-task', 'u-again'], {}), ...reviewedLog(day), ...extra };
}

/** Check-Tag: Plan des letzten Samstags mit `u.c1 = 'check'` (wie P23 ihn einfriert); Schritt 1 erledigt, Schritt 2 und 3 offen. */
export function checkDayPatch(extra: Record<string, Doc> = {}): Record<string, Doc> {
  // So friert `buildUnitStored({ …, day: SAT, c1: 'check', rv: 2 })` den Samstag ein (tests/unit/planV3.test.ts prüft den Bau).
  const plan: Doc = {
    d: SAT,
    ids: [],
    why: [],
    v: 1,
    duty: ['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again'],
    goal: { review: 2, due: 2, new: 0, ahead: 0 },
    lesson: null,
    at: Date.parse(SAT_9),
    u: { v: 1, shape: 'sat', goalMin: 25, theme: '', min: 23, b: [[1, 'review', 8, { repairs: 0 }], [2, 'grammar', 7, { errs: 0 }], [3, 'task.order', 5], [5, 'again', 3, { limit: 6 }]], rv: 2, c1: 'check' },
  };
  return { 'app/c1': emptyC1(), ...profileWith(SAT, plan, [], {}), ...reviewedLog(SAT), ...extra };
}

export async function bootCheck(page: Page, o: { now: string; patch: Record<string, Doc>; touch?: boolean; theme?: Theme; ls?: Record<string, string> }) {
  const booted = await boot(page, {
    migrated: true,
    now: o.now,
    ...(o.theme ? { theme: o.theme } : {}),
    localStorage: { ...FLAGS, ...(o.touch ? { 'lx:input': 'touch' } : { 'lx:input': 'keys' }), ...(o.ls ?? {}) },
    fake: { patch: o.patch },
  });
  await screen(page, 'today');
  return booted;
}

/** Die aktuelle Aufgabe beantworten: richtig (aus dem Vorrat), falsch („zzz“ bzw. falsche Option) oder „Weiß ich nicht“. */
export async function answerCheckItem(page: Page, how: 'right' | 'wrong' | 'skip'): Promise<{ id: string; kind: string }> {
  const el = page.getByTestId('ck-item');
  await expect(el).toBeVisible();
  const id = (await el.getAttribute('data-id')) ?? '';
  const it = BY_ID.get(id);
  if (!it) throw new Error(`Aufgabe ${id} nicht im Vorrat`);
  if (how === 'skip') {
    await page.getByTestId('ck-dontknow').click();
    return { id, kind: it.kind };
  }
  if (it.kind === 'mcc') {
    const n = how === 'right' ? (it.answer ?? 0) : ((it.answer ?? 0) + 1) % (it.options?.length ?? 4);
    await page.getByTestId('ck-option').nth(n).click();
  } else if (it.kind === 'kwt') {
    const k = it.keys?.[0];
    await page.getByTestId('ck-input').fill(how === 'right' ? `${k?.a[0] ?? ''} ${k?.b[0] ?? ''}` : `${k?.a[0] ?? ''} zzz`);
  } else {
    await page.getByTestId('ck-input').fill(how === 'right' ? (it.accept?.[0] ?? '') : 'zzz');
  }
  await page.getByTestId('ck-next').click();
  return { id, kind: it.kind };
}

/** Den ganzen Check durchspielen; `how(i, kind)` bestimmt die Antwort. Liefert die Kennungen in Reihenfolge. */
export async function runCheck(page: Page, how: (i: number, kind: string) => 'right' | 'wrong' | 'skip'): Promise<string[]> {
  await page.getByTestId('ck-go').click();
  const ids: string[] = [];
  for (let i = 0; i < 30; i++) {
    const el = page.getByTestId('ck-item');
    await expect(el).toBeVisible();
    const kind = (await el.getAttribute('data-kind')) ?? '';
    ids.push((await answerCheckItem(page, how(i, kind))).id);
  }
  await expect(page.getByTestId('ck-result')).toBeVisible();
  return ids;
}
