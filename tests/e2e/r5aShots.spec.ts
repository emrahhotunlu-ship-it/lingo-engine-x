import { expect, test, type Page } from '@playwright/test';
import { boot, openTab, screen, type Theme } from './fixtures';

// Bildschirmfotos für den Design-Vergleich (R5 „Dein Lehrer“, Spur A: P46 Satz-Klinik und P47 Schreibwerkstatt) nach `docs/umbau/design-vergleich/r5-a-*.png`.
// Handy 390 px (dunkel und hell), Laptop 1440 px (dunkel und hell). Läuft nur auf Zuruf (`LX_SHOTS=1`), sonst übersprungen: Bilder sind Belege für Emrah
// und den ux-reviewer, keine Prüfung.

const OUT = 'docs/umbau/design-vergleich';
const on = !!process.env.LX_SHOTS;
const SENTENCE = 'We discussed about the budget yesterday.';
const MAIL = `Dear Ms Weber,

thank you for your message. We discussed about the budget yesterday and the team agreed on a first plan. I will tell you the details next week, because we still need more informations from the finance department. In the meantime, please let me know if you have any questions about the timeline or the next steps we have planned.

Best regards
Emrah`;

async function start(page: Page, theme: Theme, touch: boolean): Promise<void> {
  await boot(page, { migrated: true, theme, localStorage: { 'lx:input': touch ? 'touch' : 'keys' } });
  await screen(page, 'today');
}

test.describe('Fotos R5 Spur A', () => {
  test.skip(!on, 'nur mit LX_SHOTS=1');
  test.setTimeout(120_000);

  test.describe('Handy 390', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    for (const theme of ['dark', 'light'] as const) {
      test(`Satz-Klinik ${theme}`, async ({ page }) => {
        await start(page, theme, true);
        await openTab(page, 'apply');
        await page.getByTestId('hub-clinic').scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        if (theme === 'dark') await page.screenshot({ path: `${OUT}/r5-a-01-anwenden-handy.png` });
        await page.getByTestId('hub-clinic').click();
        await expect(page.getByTestId('cl-flow')).toBeVisible();
        await page.getByTestId('cl-input').fill(SENTENCE);
        await page.waitForTimeout(500);
        if (theme === 'dark') await page.screenshot({ path: `${OUT}/r5-a-02-klinik-eingabe-handy.png` });
        await page.getByTestId('cl-go').click();
        await expect(page.getByTestId('cl-repairs')).toBeVisible();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/r5-a-03-klinik-ergebnis-handy-${theme === 'dark' ? 'dunkel' : 'hell'}.png` });
        if (theme === 'dark') {
          await page.getByTestId('cl-done').click();
          await page.getByTestId('open-settings').first().click();
          await expect(page.getByTestId('settings-work-profile')).toBeVisible();
          await page.getByTestId('settings-work-profile').scrollIntoViewIfNeeded();
          await page.waitForTimeout(600);
          await page.screenshot({ path: `${OUT}/r5-a-04-arbeitsalltag-handy.png` });
        }
      });
    }
  });

  test.describe('Laptop 1440', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    for (const theme of ['dark', 'light'] as const) {
      test(`Schreibwerkstatt ${theme}`, async ({ page }) => {
        await start(page, theme, false);
        await openTab(page, 'apply');
        await page.getByTestId('hub-write').click();
        await expect(page.getByTestId('ws-flow')).toBeVisible();
        await page.getByTestId('ws-input').fill(MAIL);
        await page.waitForTimeout(500);
        if (theme === 'dark') await page.screenshot({ path: `${OUT}/r5-a-05-werkstatt-eingabe-laptop.png` });
        await page.getByTestId('ws-go').click();
        await expect(page.getByTestId('ws-repairs')).toBeVisible();
        await page.waitForTimeout(700);
        await page.screenshot({ path: `${OUT}/r5-a-06-werkstatt-ergebnis-laptop-${theme === 'dark' ? 'dunkel' : 'hell'}.png` });
      });
    }
  });

  test.describe('Handy 390 Werkstatt', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test('Karte „Am Laptop schreiben“', async ({ page }) => {
      await start(page, 'dark', true);
      await openTab(page, 'apply');
      await page.getByTestId('ws-phone-card').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/r5-a-07-werkstatt-handy-karte.png` });
    });
  });
});
