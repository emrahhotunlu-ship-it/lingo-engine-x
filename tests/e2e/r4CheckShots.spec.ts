import { expect, test } from '@playwright/test';
import { SAT_9, WED, WED_9, answerCheckItem, bootCheck, checkDayPatch, donePatch } from './c1CheckHelpers';

// Bildschirmfotos für den Design-Vergleich (R4 C1-Check, P40) nach `docs/umbau/design-vergleich/r4-check-*.png`, 390 px, dunkel.
// Läuft nur auf Zuruf (`LX_SHOTS=1`), sonst übersprungen: Bilder sind Belege für Emrah und den ux-reviewer, keine Prüfung.

const OUT = 'docs/umbau/design-vergleich';
const on = !!process.env.LX_SHOTS;

test.describe('Fotos C1-Check 390 dunkel', () => {
  test.skip(!on, 'nur mit LX_SHOTS=1');
  test.setTimeout(150_000);
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Karte, Einleitung, Aufgaben, Ergebnis', async ({ page }) => {
    await bootCheck(page, { now: WED_9, patch: donePatch(WED), touch: true, theme: 'dark' });
    await page.getByTestId('ck-card').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/r4-check-01-karte.png` });
    await page.getByTestId('ck-start').click();
    await expect(page.getByTestId('ck-intro')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/r4-check-02-einleitung.png` });
    await page.getByTestId('ck-go').click();
    const shot = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const kind = (await page.getByTestId('ck-item').getAttribute('data-kind')) ?? '';
      if (!shot.has(kind)) {
        shot.add(kind);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${OUT}/r4-check-03-${kind}.png` });
      }
      await answerCheckItem(page, kind === 'kwt' || i % 4 === 0 ? 'skip' : kind === 'wf' && i % 2 ? 'wrong' : 'right');
    }
    await expect(page.getByTestId('ck-result')).toBeVisible();
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-state', 'saved');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/r4-check-04-ergebnis.png` });
    await page.getByTestId('ck-res-weak').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/r4-check-05-ergebnis-muster.png` });
  });

  test('Check-Tag im Tagesablauf', async ({ page }) => {
    await bootCheck(page, { now: SAT_9, patch: checkDayPatch(), touch: true, theme: 'dark' });
    await page.getByTestId('start').click();
    await expect(page.getByTestId('unit-c1check')).toBeVisible();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/r4-check-06-check-tag.png` });
  });
});
