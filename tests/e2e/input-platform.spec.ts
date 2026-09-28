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

test('Widerspruchstest: Modul-Hinweis „heute geübt“ und Klickziel folgen channelDone', async ({ page }) => {
  test.setTimeout(90_000);
  // Pflicht ist heute nichts (Plan ohne Wiederholen) → Angebote sind sichtbar.
  await boot(page, {
    migrated: true,
    fake: { patch: { 'app/profile': { newPerDay: 0, plan: { d: '2026-09-20', v: 1, ids: [], why: [], duty: [], goal: { review: 0 }, lesson: null, at: 1 } }, 'articles/ai1789149600000': null } },
  });
  await screen(page, 'today');
  // UX-Beratung 27.09.: keine Angebotsliste mehr auf Heute – alles Freiwillige lebt in „Üben“.
  await expect(page.getByTestId('input-offers')).toHaveCount(0);
  // Neubau (Reiter Lesen): „heute gelesen/gehört“ hängt am Text selbst, nicht am Kanal.
  await openLearn(page);
  await expect(page.locator('[data-module="read"] [data-testid="module-done"]')).toHaveCount(0);
  await expect(page.locator('[data-module="listen"]')).not.toContainText('Erledigt');

  // Lesen abschließen (Klickziel der Modulzeile) → ✕ führt zurück zu „Lesen“, das Modul zeigt „heute geübt“.
  await page.locator('[data-testid="module"][data-module="read"]').click();
  await page.getByTestId('read-done').click();
  await answerAll(page, 4);
  await expect(page.getByTestId('unit-done')).toBeVisible();
  await page.getByTestId('unit-close').click();
  await page.locator('[data-screen="library"]').waitFor({ state: 'visible' });
  // Freiwillig: ruhiger Hinweis „heute gelesen“, kein „Erledigt“ am Klickziel (Kap. 2.2/2.6).
  await expect(page.locator('[data-module="read"] [data-testid="module-done"]')).toHaveCount(1);
  await expect(page.locator('[data-module="read"] [data-testid="module-done"]')).toContainText('heute gelesen');
  await expect(page.locator('[data-module="read"]')).not.toContainText('Erledigt');
});
