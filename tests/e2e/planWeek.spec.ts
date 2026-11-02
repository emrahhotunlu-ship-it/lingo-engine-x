import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Tagesplan je Wochentag. Testuhr = fester Tag; der Plan wird beim ersten Öffnen angelegt und eingefroren.
// Früher (Plan 3.0, P23) hing Schritt 3 vom Wochentag ab; seit UX-Neuanfang C ist der Tagesweg jeden Tag gleich.

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

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  // Seit UX-Neuanfang C (Emrah 02.11.2026) hat jeder Tag denselben Tagesweg: Wörter · Grammatik · Anwenden. Die Format-Tage (Plan 3.0, P23)
  // gibt es in der Pflicht nicht mehr; Satzbau und „Fehler korrigieren“ sind freiwillig. Planversion bleibt 1, das Planfeld `tw` = 1 sagt es.
  for (const [wd, now] of DAYS) {
    test(`${wd}: Tagesweg Wörter · Grammatik · Anwenden; Planversion bleibt 1`, async ({ page }) => {
      const { errors } = await boot(page, { migrated: true, now });
      const day = now.slice(0, 10);
      const plan = await planOf(page, day);
      expect(plan.v).toBe(1);
      expect(plan.u.v).toBe(1);
      expect(plan.u.rv).toBe(2);
      expect((plan.u as Doc)['tw']).toBe(1);
      expect(plan.duty).toEqual(['review', 'ch:u-focus', 'ch:u-task']);
      expect(plan.u.b.map(([n, k]) => [n, k])).toEqual([
        [1, 'review'],
        [2, 'grammar'],
        [3, 'task.apply'],
      ]);
      expect(plan.u.b.every((x) => x[3] === undefined || !('mode' in x[3]))).toBe(true);
      await expect(page.locator('[data-testid="duty"][data-duty="ch:u-task"]')).toContainText('Anwenden');
      expect(plan.u.nx === undefined || /^[a-z0-9]{1,24}$/.test(plan.u.nx)).toBe(true);
      expect(errors).toEqual([]);
    });
  }

  test('Der gespeicherte Plan von heute bleibt, auch wenn danach andere Schalter gelten', async ({ page }) => {
    await boot(page, { migrated: true, now: DAYS[1]![1], fake: { persist: true } });
    const first = await planOf(page, '2026-09-22');
    await page.evaluate(() => window.localStorage.setItem('lx:flags', '{"c1xKinds":{"ocl":false},"tempo":false}'));
    await page.reload();
    const again = await planOf(page, '2026-09-22');
    expect(again).toEqual(first);
  });
});
