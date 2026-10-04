import { expect, test } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Emrahs App-Kommentar (03.10.2026, „Neues Wort“): „Text auf Text“ – Beschriftung und Inhalt der Einführungskarte überlappten am Handy.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('Einführungskarte am Handy: Beschriftungen überlappen nie den Inhalt', async ({ page }) => {
  const { patch } = ankiPatch(0);
  const card = { word: 'reduce manual effort', de: 'manuellen Aufwand reduzieren', def: 'to make a task need less work by hand', ex: 'We want to [reduce manual effort] in invoice handling.', pos: 'verb', level: 'C1', state: 'new', stage: 0, S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, src: 'lookup', added: '2026-09-20' };
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...patch, 'app/profile': { ...planPatch(1), newPerDay: 2 }, 'vocab/reduce-manual-effort': card } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  const intro = page.getByTestId('intro');
  await expect(intro).toBeVisible();
  const rows = await intro.locator('dl > div').evaluateAll((els) =>
    els.map((el) => {
      const dt = el.querySelector('dt')!.getBoundingClientRect();
      const dd = el.querySelector('dd')!.getBoundingClientRect();
      const side = dt.right <= dd.left + 1;
      const stacked = dt.bottom <= dd.top + 1;
      return { ok: side || stacked, dt: [dt.left, dt.top, dt.right, dt.bottom], dd: [dd.left, dd.top, dd.right, dd.bottom] };
    }),
  );
  expect(rows.length).toBeGreaterThan(1);
  for (const r of rows) expect(r.ok, JSON.stringify(r)).toBe(true);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});
