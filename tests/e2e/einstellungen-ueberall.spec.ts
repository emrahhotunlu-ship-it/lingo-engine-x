import { expect, test, type Page } from '@playwright/test';
import { boot, openProfile, openSpeak, openTab, screen, tabRoot } from './fixtures';
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

test('Einstellungen von jeder Reiter-Seite und von jeder Seite in höchstens zwei Tipps (Zahnrad auf „Fortschritt“)', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  // Relaunch P2 S1-SHELL (stufe1-plan.md §6.3): im Kopf jeder Reiter-Wurzel EIN „Fragen“; das Zahnrad steht nur auf „Fortschritt“,
  // von jedem anderen Reiter also zwei Tipps (Fortschritt → Zahnrad). Ab 600 px steht „Einstellungen“ zusätzlich in der Navigation.
  for (const id of ['today', 'vocab', 'learn', 'apply'] as const) {
    await openTab(page, id);
    const top = page.getByTestId('topbar');
    await expect(top.getByTestId('open-companion')).toBeVisible();
    await expect(top.getByTestId('open-settings')).toHaveCount(0);
    await page.getByTestId('tab-progress').click();
    await screen(page, tabRoot('progress'));
    await openAndClose(page, 'topbar');
    await screen(page, tabRoot('progress'));
  }
  // Seiten (Sprechen, Wochenbericht): Kopf „‹ Herkunft · Fragen“ ohne Zahnrad; die Einstellungen liegen zwei Tipps entfernt (Fortschritt → Zahnrad).
  await openSpeak(page);
  await expect(page.getByTestId('page-bar').getByTestId('open-companion')).toBeVisible();
  await expect(page.getByTestId('page-bar').getByTestId('open-settings')).toHaveCount(0);
  await page.getByTestId('tab-progress').click();
  await screen(page, tabRoot('progress'));
  await openAndClose(page, 'topbar');
  await openProfile(page);
  await page.getByTestId('profile-weekly').click();
  await page.getByTestId('profile-sheet').waitFor({ state: 'detached' });
  await screen(page, 'weekly');
  await expect(page.getByTestId('page-bar').getByTestId('open-settings')).toHaveCount(0);
  await expect(page.getByTestId('page-bar').getByTestId('open-companion')).toBeVisible();
  // Seite mit eigenem Kopf (ScreenHeader, z. B. die Wortliste): ebenfalls nur „Fragen“, kein Zahnrad, kein Übersetzer (P2-Nachbesserung).
  await openTab(page, 'vocab');
  await page.getByTestId('ws-all').click();
  await screen(page, 'vocabList');
  const head = page.locator('[data-screen="vocabList"] header').first();
  await expect(head.getByTestId('open-companion')).toBeVisible();
  await expect(head.getByTestId('open-settings')).toHaveCount(0);
  await expect(head.getByTestId('open-translate')).toHaveCount(0);
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
  // Übungsleiste am Handy (Relaunch P3, Band): ✕ · Balken · „…“ – Übersetzen, Claude und Zahnrad stehen im Menü.
  await bar.getByTestId('exercise-menu').click();
  const menu = page.getByTestId('exercise-menu-list');
  await expect(menu.getByTestId('open-translate')).toBeVisible();
  await expect(menu.getByTestId('open-companion')).toBeVisible();
  await menu.getByTestId('open-settings').click();
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
