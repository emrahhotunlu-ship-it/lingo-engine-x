import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Plan 3.0 (Lernplattform 3.0 §2.1, P23): Schritt 3 hängt vom Wochentag ab. Testuhr = fester Tag; der Plan wird beim ersten Öffnen angelegt und eingefroren.
// Standard der Schalter: ocl, mcc, kwt und Tempo (P24) an, wf aus – eine nicht angebotene Art bleibt Satzbau.

type Doc = Record<string, unknown>;
const DAYS: Array<[string, string]> = [
  ['Mo', '2026-09-21T09:00:00+02:00'],
  ['Di', '2026-09-22T09:00:00+02:00'],
  ['Mi', '2026-09-23T09:00:00+02:00'],
  ['Do', '2026-09-24T09:00:00+02:00'],
  ['Fr', '2026-09-25T09:00:00+02:00'],
  ['Sa', '2026-09-26T09:00:00+02:00'],
  ['So', '2026-09-27T09:00:00+02:00'],
];

type Plan = { d: string; duty: string[]; v: number; u: { v: number; rv?: number; c1?: string; nx?: string; b: Array<[number, string, number, Doc?]> } };

async function planOf(page: Page, day: string): Promise<Plan> {
  await screen(page, 'today');
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as Doc | undefined)?.d).toBe(day);
  return (await dump(page))['app/profile']?.plan as Plan;
}
const step3 = (p: Plan): Doc | undefined => p.u.b.find(([n]) => n === 3)?.[3];

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  const EXPECT: Record<string, Doc | undefined> = { Mo: undefined, Di: { mode: 'format', fmt: 'ocl' }, Mi: undefined, Do: { mode: 'format', fmt: 'kwt' }, Fr: { mode: 'format', fmt: 'mcc' }, Sa: { mode: 'tempo' } };
  const NAME: Record<string, string> = { Mo: 'Satzbau', Di: 'Kleines Wort', Mi: 'Satzbau', Do: 'Umformen', Fr: 'Passendes Wort', Sa: 'Satzbau' };

  for (const [wd, now] of DAYS) {
    if (wd === 'So') continue;
    test(`${wd}: Schritt 3 = ${NAME[wd]}; Blockart, Pflicht und Minuten wie immer; Planversion bleibt 1`, async ({ page }) => {
      const { errors } = await boot(page, { migrated: true, now });
      const day = now.slice(0, 10);
      const plan = await planOf(page, day);
      expect(plan.v).toBe(1);
      expect(plan.u.v).toBe(1);
      expect(plan.u.rv).toBe(2);
      expect(plan.duty).toEqual(['review', 'ch:u-focus', 'ch:u-task', 'ch:u-again']);
      expect(plan.u.b.find(([n]) => n === 3)?.[1]).toBe('task.order');
      expect(step3(plan)).toEqual(EXPECT[wd]);
      await expect(page.locator('[data-testid="duty"][data-duty="ch:u-task"]')).toContainText(NAME[wd] ?? '');
      expect(plan.u.nx === undefined || /^[a-z0-9]{1,24}$/.test(plan.u.nx)).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test('Schalter Tempo aus: Samstag fällt auf Satzbau zurück', async ({ page }) => {
    await boot(page, { migrated: true, now: DAYS[5]![1], localStorage: { 'lx:flags': '{"tempo":false}' } });
    const plan = await planOf(page, '2026-09-26');
    expect(plan.u.b.find(([n]) => n === 3)?.[1]).toBe('task.order');
    expect(step3(plan)).toBeUndefined();
    await expect(page.locator('[data-testid="duty"][data-duty="ch:u-task"]')).toContainText('Satzbau');
  });

  test('So: kein Schritt 3, kein Format', async ({ page }) => {
    await boot(page, { migrated: true, now: DAYS[6]![1] });
    const plan = await planOf(page, '2026-09-27');
    expect(plan.u.b.some(([n, k]) => n === 3 && k === 'task.order')).toBe(false);
    expect(plan.u.b.every((x) => x[3] === undefined || !('mode' in x[3]))).toBe(true);
  });

  test('Schalter wf an: Mittwoch ist „Wort umbauen“; Schalter Tempo an: Samstag trägt {mode: tempo}', async ({ page }) => {
    await boot(page, { migrated: true, now: DAYS[2]![1], localStorage: { 'lx:flags': '{"c1xKinds":{"wf":true},"tempo":true}' } });
    expect(step3(await planOf(page, '2026-09-23'))).toEqual({ mode: 'format', fmt: 'wf' });
    await expect(page.locator('[data-testid="duty"][data-duty="ch:u-task"]')).toContainText('Wort umbauen');
  });

  test('Der gespeicherte Plan von heute bleibt, auch wenn danach andere Schalter gelten', async ({ page }) => {
    await boot(page, { migrated: true, now: DAYS[1]![1], fake: { persist: true } });
    const first = await planOf(page, '2026-09-22');
    expect(step3(first)).toEqual({ mode: 'format', fmt: 'ocl' });
    await page.evaluate(() => window.localStorage.setItem('lx:flags', '{"c1xKinds":{"ocl":false}}'));
    await page.reload();
    const again = await planOf(page, '2026-09-22');
    expect(step3(again)).toEqual({ mode: 'format', fmt: 'ocl' });
    expect(again).toEqual(first);
  });
});
