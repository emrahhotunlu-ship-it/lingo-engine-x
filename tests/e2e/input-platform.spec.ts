import { expect, test } from '@playwright/test';
import { boot, screen } from './fixtures';
import { activeSubscriptions, answerAll, inputTour, openLearn } from './inputHelpers';

// Plattform von Phase 4 (Plan §8.3): keine fremden Anfragen und keine JS-Fehler über alle
// Bildschirme, Abo-Zähler ≤ 64 und das Feed-Abo endet beim Verlassen; Widerspruchstest zwischen
// Angebotszeile, Modul-Häkchen und `channelDone`. Die Bildschirm-Matrix (Breiten, Modi, Sprachen)
// steht in screens.spec.ts, axe in a11y.spec.ts.

test('Rundgang: keine fremden Anfragen, keine Fehler, Abos ≤ 64, Feed-Abo nach dem Verlassen beendet', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  const base = await activeSubscriptions(page);
  const seen: number[] = [];
  await inputTour(page, async () => {
    seen.push(await activeSubscriptions(page));
  });
  expect(Math.max(...seen)).toBeLessThanOrEqual(64);
  await expect.poll(() => activeSubscriptions(page)).toBe(base);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Widerspruchstest: Angebotszeile, Modul-Häkchen und Klickziel folgen channelDone', async ({ page }) => {
  test.setTimeout(90_000);
  // Pflicht ist heute nichts (Plan ohne Wiederholen) → Angebote sind sichtbar.
  await boot(page, {
    migrated: true,
    fake: { patch: { 'app/profile': { newPerDay: 0, plan: { d: '2026-09-20', v: 1, ids: [], why: [], duty: [], goal: { review: 0 }, lesson: null, at: 1 } }, 'articles/ai1789149600000': null } },
  });
  await screen(page, 'today');
  const offers = page.getByTestId('input-offers');
  await expect(offers).toBeVisible();
  // Hören ist im Testbestand heute schon erledigt: keine Zeile, im Modul der Hinweis „heute geübt“.
  await expect(page.locator('[data-testid="input-offer"][data-channel="listen"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="input-offer"][data-channel="read"]')).toBeVisible();
  await expect(page.locator('[data-testid="input-offer"][data-channel="discover"]')).toContainText('neue Beiträge');
  await openLearn(page);
  await expect(page.locator('[data-module="listen"] [data-testid="module-done"]')).toHaveCount(1);
  // Freiwilliges Modul: ruhiger Hinweis „heute geübt", kein „Erledigt" am Startknopf (Kap. 2.2/2.6).
  await expect(page.locator('[data-module="listen"] [data-testid="module-done"]')).toHaveText('heute geübt');
  await expect(page.locator('[data-module="listen"]')).not.toContainText('Erledigt');
  await expect(page.locator('[data-module="read"] [data-testid="module-done"]')).toHaveCount(0);

  // Lesen abschließen (Klickziel der Angebotszeile) → Zeile verschwindet, Modul zeigt erledigt.
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  await page.locator('[data-testid="input-offer"][data-channel="read"]').click();
  await page.getByTestId('read-done').click();
  await answerAll(page, 4);
  await expect(page.getByTestId('unit-done')).toBeVisible();
  await page.getByTestId('unit-close').click();
  await screen(page, 'today');
  await expect(page.locator('[data-testid="input-offer"][data-channel="read"]')).toHaveCount(0);
  await openLearn(page);
  await expect(page.locator('[data-module="read"] [data-testid="module-done"]')).toHaveCount(1);
});
