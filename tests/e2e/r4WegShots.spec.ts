import { expect, test, type Page } from '@playwright/test';
import { boot, openOverview } from './fixtures';
import { C1_THREE, C1_TWO, openWay } from './wayHelpers';

// Bildschirmfotos für den Design-Vergleich (R4 „Weg zu C1“, P44/P45) nach `docs/umbau/design-vergleich/r4-weg-*.png`, Handy 390, dunkel.
// Läuft nur auf Zuruf (`LX_SHOTS=1`), sonst übersprungen: Bilder sind Belege für Emrah und den ux-reviewer, keine Prüfung.

const OUT = 'docs/umbau/design-vergleich';
const on = !!process.env.LX_SHOTS;

async function full(page: Page, name: string) {
  // Das Blatt scrollt in sich: für das Foto die ganze Höhe zeigen.
  await page.waitForTimeout(600);
  const h = await page.getByTestId('way-sheet').evaluate((el) => el.scrollHeight + 200);
  await page.setViewportSize({ width: 390, height: Math.max(844, Math.min(h, 3200)) });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/r4-weg-${name}.png` });
}

test.describe('Fotos 390 dunkel', () => {
  test.skip(!on, 'nur mit LX_SHOTS=1');
  test.setTimeout(120_000);
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Fortschritt mit Kopfzeile', async ({ page }) => {
    await boot(page, { migrated: true, theme: 'dark', localStorage: { 'lx:flags': 'way' }, fake: { patch: { 'app/c1': C1_THREE } } });
    await openOverview(page);
    await expect(page.getByTestId('way-head')).toBeVisible();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/r4-weg-01-kopfzeile.png` });
  });

  test('Blatt mit Urteil von Claude und Prognose', async ({ page }) => {
    await openWay(page, { theme: 'dark', fake: { patch: { 'app/c1': C1_THREE } } });
    await expect(page.getByTestId('way-status')).toBeVisible();
    await full(page, '02-blatt');
  });

  test('Kriterium aufgeklappt und Messwerte', async ({ page }) => {
    await openWay(page, { theme: 'dark', fake: { patch: { 'app/c1': C1_THREE } } });
    await expect(page.getByTestId('way-status')).toBeVisible();
    await page.getByTestId('way-crit-row').nth(3).locator('button').click();
    await page.getByTestId('way-more-toggle').click();
    await full(page, '03-detail');
  });

  test('ohne Claude, zwei Checks', async ({ page }) => {
    await openWay(page, { theme: 'dark', fake: { capabilities: { sample: false }, patch: { 'app/c1': C1_TWO } } });
    await expect(page.getByTestId('way-fixed')).toBeVisible();
    await full(page, '04-ohne-claude');
  });

  test('Leerzustand', async ({ page }) => {
    await openWay(page, { theme: 'dark', fake: { seed: 'empty' } });
    await full(page, '05-leer');
  });
});
