import { expect, test, type Page } from '@playwright/test';
import { boot, openSettings, screen } from './fixtures';
import { answerCurrent, dump, forcedPatch, planPatch } from './trainerHelpers';

// Kap. 4.3 / A7.4: leichte Vibration beim Prüfen in Lücke und Auswahl – nur nach
// Merkmalserkennung (iPhone ohne `navigator.vibrate` → rein sichtbar, kein Fehler), einmal je
// Prüfen, abschaltbar in den Einstellungen („Vibration“, `app/profile.haptic`).

type Win = { __vib: unknown[] };

async function recordVibrate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as Win).__vib = [];
    Object.defineProperty(Navigator.prototype, 'vibrate', {
      configurable: true,
      value: (p: unknown) => {
        (window as unknown as Win).__vib.push(p);
        return true;
      },
    });
  });
}

async function removeVibrate(page: Page): Promise<void> {
  await page.addInitScript(() => {
    delete (Navigator.prototype as unknown as { vibrate?: unknown }).vibrate;
  });
}

const vibs = (page: Page): Promise<unknown[]> => page.evaluate(() => [...(window as unknown as Win).__vib]);

async function startTrainer(page: Page, profile: Record<string, unknown> = {}) {
  const booted = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { ...planPatch(3), ...profile }, ...forcedPatch() } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

test('Trainer: richtig → eine kurze Vibration, falsch → deutlichere, je Prüfen genau eine', async ({ page }) => {
  await recordVibrate(page);
  const { errors } = await startTrainer(page);
  await answerCurrent(page);
  await expect.poll(() => vibs(page)).toEqual([[12, 40, 18]]);
  await answerCurrent(page, { wrong: true });
  await expect.poll(() => vibs(page)).toEqual([[12, 40, 18], [30, 60, 30]]);
  expect(errors).toEqual([]);
});

test('Einstellung „Vibration“ aus: keine Vibration; wieder an wird gespeichert', async ({ page }) => {
  await recordVibrate(page);
  const { errors } = await startTrainer(page, { haptic: false });
  await answerCurrent(page);
  expect(await vibs(page)).toEqual([]);
  await openSettings(page);
  const sw = page.getByTestId('set-haptic');
  await expect(sw).toBeVisible();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect.poll(async () => (await dump(page))['app/profile']?.haptic).toBe(true);
  expect(errors).toEqual([]);
});

test('iPhone ohne navigator.vibrate: Hinweis statt Schalter, Prüfen ohne Fehler', async ({ page }) => {
  await removeVibrate(page);
  const { errors } = await startTrainer(page);
  await answerCurrent(page);
  await answerCurrent(page, { wrong: true });
  await openSettings(page);
  await expect(page.getByTestId('haptic-none')).toBeVisible();
  await expect(page.getByTestId('set-haptic')).toHaveCount(0);
  expect(errors).toEqual([]);
});
