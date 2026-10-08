import { expect, test, type Page } from '@playwright/test';
import { openDiagnose } from './diagnoseHelpers';
import { openReview } from './wochenrueckblickHelpers';

// Bildschirmfotos für den Design-Vergleich (R5-b: P49 Wochen-Diagnose, P50 Wochenrückblick 3.0) nach `docs/umbau/design-vergleich/r5-b-*.png`:
// Handy 390 dunkel und hell, Laptop 1440. Läuft nur auf Zuruf (`LX_SHOTS=1`), sonst übersprungen: Bilder sind Belege für Emrah und den ux-reviewer, keine Prüfung.

const OUT = 'docs/umbau/design-vergleich';
const on = !!process.env.LX_SHOTS;

async function card(page: Page, name: string): Promise<void> {
  const el = page.getByTestId('dx-card');
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/r5-b-${name}.png`, fullPage: false });
}

test.describe('Fotos P49', () => {
  test.skip(!on, 'nur mit LX_SHOTS=1');
  test.setTimeout(120_000);

  for (const [label, width, height, theme] of [
    ['390-dark', 390, 844, 'dark'],
    ['390-light', 390, 844, 'light'],
    ['1440-dark', 1440, 900, 'dark'],
  ] as const) {
    test(`Diagnose ${label}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
      const page = await ctx.newPage();
      await openDiagnose(page, { theme });
      await expect(page.getByTestId('dx-ask')).toBeVisible();
      await card(page, `p49-${label}-vorher`);
      await page.getByTestId('dx-ask').click();
      await expect(page.getByTestId('dx-claude')).toBeVisible();
      await card(page, `p49-${label}`);
      await ctx.close();
    });
  }

  test('Diagnose ohne Claude 390 dunkel', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const page = await ctx.newPage();
    await openDiagnose(page, { theme: 'dark', fake: { capabilities: { sample: false } } });
    await expect(page.getByTestId('dx-pair')).toHaveCount(1);
    await card(page, 'p49-390-dark-ohne-claude');
    await ctx.close();
  });
});

test.describe('Fotos P50', () => {
  test.skip(!on, 'nur mit LX_SHOTS=1');
  test.setTimeout(120_000);

  for (const [label, width, height, theme] of [
    ['390-dark', 390, 844, 'dark'],
    ['390-light', 390, 844, 'light'],
    ['1440-dark', 1440, 900, 'dark'],
  ] as const) {
    test(`Wochenrückblick ${label}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: width < 600, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
      const page = await ctx.newPage();
      await openReview(page, { theme });
      await expect(page.getByTestId('weekly-text')).toBeVisible();
      await page.waitForTimeout(700);
      // Ganze Seite in der Höhe zeigen (Handy: lang, Laptop: zwei Spalten).
      const h = await page.getByTestId('weekly-page').evaluate((el) => el.scrollHeight + 140);
      await page.setViewportSize({ width, height: Math.max(height, Math.min(h, 3400)) });
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/r5-b-p50-${label}.png` });
      await ctx.close();
    });
  }

  test('Wochenrückblick ohne Claude 390 dunkel', async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const page = await ctx.newPage();
    await openReview(page, { theme: 'dark', fake: { capabilities: { sample: false } } });
    await page.waitForTimeout(700);
    const h = await page.getByTestId('weekly-page').evaluate((el) => el.scrollHeight + 140);
    await page.setViewportSize({ width: 390, height: Math.min(h, 3400) });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/r5-b-p50-390-dark-ohne-claude.png` });
    await ctx.close();
  });
});
