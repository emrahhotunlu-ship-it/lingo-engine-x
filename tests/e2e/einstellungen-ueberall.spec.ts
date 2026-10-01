import { expect, test, type Page } from '@playwright/test';
import { boot, openProfile, openTab, screen, tabRoot } from './fixtures';
import { answerCurrent, forcedPatch, planPatch } from './trainerHelpers';

// Emrahs Fehlermeldung am iPhone „Einstellungen nicht überall“ (CLAUDE.md A7, Paket 2):
// Übersetzer, Claude und Einstellungen auf jeder Seite und in jeder Übung mit einem Tipp. Die
// Einstellungen liegen als Blatt über der Ebene – eine laufende Übung geht danach an derselben
// Stelle weiter.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const settingsDialog = (page: Page) => page.getByRole('dialog', { name: 'Einstellungen' });

async function openAndClose(page: Page, scope: string): Promise<void> {
  const gear = page.getByTestId(scope).getByTestId('open-settings');
  await expect(gear, scope).toBeVisible();
  await gear.click();
  await expect(settingsDialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('Einstellungen aus jeder Reiter-Seite und von einer Seite mit einem Tipp', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  for (const id of ['today', 'vocab', 'learn', 'read', 'speak', 'progress'] as const) {
    await openTab(page, id);
    // Kopf: Übersetzen · Claude · Zahnrad.
    const top = page.getByTestId('topbar');
    await expect(top.getByTestId('open-translate')).toBeVisible();
    await expect(top.getByTestId('open-companion')).toBeVisible();
    await openAndClose(page, 'topbar');
    await screen(page, tabRoot(id));
  }
  // Von einer Seite (nicht Reiter-Wurzel): der Wochenbericht aus dem Profil-Blatt.
  await openTab(page, 'today');
  await openProfile(page);
  await page.getByTestId('profile-weekly').click();
  await page.getByTestId('profile-sheet').waitFor({ state: 'detached' });
  await screen(page, 'weekly');
  await openAndClose(page, 'page-bar');
  await screen(page, 'weekly');
  expect(errors).toEqual([]);
});

test('Einstellungen aus einer laufenden Übung: Blatt über der Übung, danach geht es an derselben Stelle weiter', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(3), ...forcedPatch() } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await answerCurrent(page);
  const progress = await page.getByTestId('trainer-progress').innerText();
  const card = (await page.getByTestId('exercise').getAttribute('data-card')) ?? '';
  const bar = page.getByTestId('exercise-bar');
  // Übungsleiste: Übersetzen · Claude · Zahnrad.
  await expect(bar.getByTestId('open-translate')).toBeVisible();
  await expect(bar.getByTestId('open-companion')).toBeVisible();
  await bar.getByTestId('open-settings').click();
  await expect(settingsDialog(page)).toBeVisible();
  // Eine Einstellung ändern – die Übung bleibt darunter stehen.
  await settingsDialog(page).getByRole('radio', { name: 'Hell' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await screen(page, 'trainer');
  await expect(page.getByTestId('trainer-progress')).toHaveText(progress);
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-card', card);
  // Fortsetzbar: die nächste Karte lässt sich ganz normal beantworten.
  await answerCurrent(page);
  await expect(page.getByTestId('trainer-progress')).not.toHaveText(progress);
  expect(errors).toEqual([]);
});
