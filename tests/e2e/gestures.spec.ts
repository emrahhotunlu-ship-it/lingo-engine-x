import { expect, test, type Page } from '@playwright/test';
import { boot, openSettings, screen } from './fixtures';
import { answerOnly as sharedAnswerOnly, forcedPatch, planPatch } from './trainerHelpers';

// Kap. 4.5 Wischgesten, sparsam: (1) im Trainer nach der Rückmeldung nach links wischen =
// „Weiter“; nie aus der Lücke heraus, nie beim senkrechten Wischen (Bildlauf). (2) Blätter am
// Handy am Griff nach unten wischen = schließen; der Inhalt behält seinen Bildlauf. Knopf,
// Enter und Esc bleiben.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Synthetische Wischgeste (touchstart → touchend) auf einem Element. */
async function swipe(page: Page, selector: string, dx: number, dy: number, ms = 180): Promise<void> {
  await page.evaluate(
    async ({ selector, dx, dy, ms }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`kein Element ${selector}`);
      const r = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 60, Math.max(60, r.left + r.width / 2 + (dx < 0 ? 40 : -40)));
      const y = r.top + Math.min(r.height / 2, 60);
      const touch = (cx: number, cy: number) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(x, y)], changedTouches: [touch(x, y)] }));
      await new Promise((r2) => setTimeout(r2, ms));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(x + dx, y + dy)] }));
    },
    { selector, dx, dy, ms },
  );
}

async function answerOnly(page: Page): Promise<string> {
  return (await sharedAnswerOnly(page)).step;
}

test('Trainer: nach der Rückmeldung nach links wischen = „Weiter“; senkrecht und aus der Lücke nicht', async ({ page }) => {
  // Autoweiter aus, damit nur die Geste weiterschaltet.
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { ...planPatch(3), autoNext: false }, ...forcedPatch() } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');

  const step = await answerOnly(page);
  // Senkrecht (Bildlauf) und zu kurz: nichts.
  await swipe(page, '[data-testid="exercise"]', 0, -220);
  await swipe(page, '[data-testid="exercise"]', -30, 0);
  await page.waitForTimeout(300);
  await expect(page.locator(`[data-step="${step}"]`)).toHaveCount(1);
  // Aus der Lücke heraus: nichts.
  if (await page.locator('.lx-gap').count()) {
    await swipe(page, '.lx-gap', -200, 0);
    await page.waitForTimeout(300);
    await expect(page.locator(`[data-step="${step}"]`)).toHaveCount(1);
  }
  // Nach links auf der Karte: weiter.
  await swipe(page, '[data-testid="exercise"]', -200, 8);
  await expect(page.locator(`[data-step="${step}"]`)).toHaveCount(0);
  await expect(page.getByTestId('exercise')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Einstellungen am Handy: am Griff nach unten wischen schließt, kurzer Zug federt zurück, Inhalt scrollt', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openSettings(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('sheet-grip')).toBeVisible();
  // Der Inhalt behält seinen Bildlauf: kein touch-action auf dem Blatt, nur am Griff.
  expect(await dialog.evaluate((el) => getComputedStyle(el).touchAction)).toBe('auto');
  expect(await dialog.locator('[data-sheet-handle]').evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');

  const drag = async (dy: number) => {
    // Erst ziehen, wenn das Blatt steht (Öffnen bzw. Zurückfedern ist vorbei).
    await page.waitForTimeout(500);
    const grip = await dialog.getByTestId('sheet-grip').boundingBox();
    if (!grip) throw new Error('kein Griff');
    const x = grip.x + grip.width / 2;
    const y = grip.y + grip.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + dy, { steps: 12 });
    await page.mouse.up();
  };
  // Kurzer Zug: federt zurück, bleibt offen.
  await drag(30);
  await page.waitForTimeout(500);
  await expect(dialog).toBeVisible();
  await expect.poll(async () => Math.abs(Number(/translateY\((-?[\d.]+)px\)/.exec(await dialog.evaluate((el) => el.style.transform))?.[1] ?? 0))).toBeLessThan(0.5);
  // Weiter Zug: schließt.
  await drag(260);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Nachschlage-Blatt am Handy: am Griff nach unten wischen schließt', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { ...planPatch(3), autoNext: false }, ...forcedPatch() } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await answerOnly(page);
  await page.getByTestId('examples').locator('button.lx-word').first().click();
  const lookup = page.getByTestId('lookup');
  await expect(lookup).toBeVisible();
  await page.waitForTimeout(400);
  const grip = await lookup.getByTestId('sheet-grip').boundingBox();
  if (!grip) throw new Error('kein Griff');
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 3);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2, grip.y + 240, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId('lookup')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Desktop: kein Griff, Blatt nicht ziehbar (Paneel rechts)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page, { migrated: true });
  await screen(page, 'today');
  await openSettings(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('sheet-grip')).toBeHidden();
  await expect(page.locator('[data-sheet-handle]')).toHaveCount(0);
});
