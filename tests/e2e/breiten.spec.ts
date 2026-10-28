import { expect, test, type Page } from '@playwright/test';
import { boot, openRead, openSpeak, openTab, screen } from './fixtures';

// Relaunch Stufe 1, P2 S1-SHELL (docs/relaunch/stufe1-plan.md §6.2, Abnahme A3/A4): der Rahmen trägt jede Breite vom kleinen Handy
// bis zum großen Bildschirm. A3: kein waagrechtes Scrollen bei 320 … 2560 px. A4: bei 2560 × 1440 bleibt höchstens ein Viertel der Breite leer.

const WIDTHS = [320, 390, 768, 1024, 1280, 1440, 1920, 2560] as const;

const overflowX = (page: Page): Promise<number> => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of WIDTHS) {
  test(`A3 ${width} px: Hauptbildschirme, Lesen und Sprechen ohne waagrechtes Scrollen`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width, height: width >= 2560 ? 1440 : 900 }, hasTouch: width < 600 });
    const page = await ctx.newPage();
    const { errors, external } = await boot(page, { migrated: true });
    await screen(page, 'today');
    expect(await overflowX(page), 'today').toBeLessThanOrEqual(0);
    for (const id of ['vocab', 'learn', 'apply', 'progress'] as const) {
      await openTab(page, id);
      expect(await overflowX(page), id).toBeLessThanOrEqual(0);
    }
    await openRead(page);
    expect(await overflowX(page), 'read').toBeLessThanOrEqual(0);
    await openSpeak(page);
    expect(await overflowX(page), 'speak').toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });
}

test('A4 2560 × 1440: Navigation, Bühne und Kontextspalte nutzen mindestens drei Viertel der Breite', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 2560, height: 1440 } });
  const page = await ctx.newPage();
  await boot(page, { migrated: true });
  await screen(page, 'today');
  const W = 2560;
  const side = await page.getByTestId('tabbar').boundingBox();
  const stage = await page.getByTestId('stage').boundingBox();
  const col = await page.getByTestId('context-column').boundingBox();
  expect(side && stage && col).toBeTruthy();
  if (!side || !stage || !col) return;
  const used = side.width + (col.x + col.width - stage.x);
  expect(W - used, `ungenutzt ${Math.round(W - used)} px`).toBeLessThanOrEqual(W / 4);
  // Reihenfolge links → rechts ohne Überlappung.
  expect(side.x + side.width).toBeLessThanOrEqual(stage.x + 1);
  expect(stage.x + stage.width).toBeLessThanOrEqual(col.x + 1);
  expect(await overflowX(page)).toBeLessThanOrEqual(0);
  await ctx.close();
});
