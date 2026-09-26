import { expect, test, type Page } from '@playwright/test';
import { boot, openOverview } from './fixtures';

type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page) =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

test.use({ viewport: { width: 1440, height: 900 } });

test('Sprache und Darstellung werden sofort angewendet und in app/profile gespeichert', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  await page.getByTestId('open-settings').click();
  const dialog = page.getByRole('dialog', { name: 'Einstellungen' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect.poll(async () => (await dump(page))['app/profile']?.lang).toBe('en');

  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(async () => (await dump(page))['app/profile']?.theme).toEqual({ m: 'light', p: 'ocean' });

  // Tastatur: Pfeiltasten wechseln innerhalb der Gruppe, Esc schließt.
  await page.getByRole('radio', { name: 'Light' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dim');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('open-settings')).toBeFocused();

  expect(errors).toEqual([]);
});

test('Tab bleibt im geöffneten Dialog (Tastaturbedienung)', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  await page.getByTestId('open-settings').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
});

test('Diagnose zeigt Fähigkeiten, Dokumentzahl und Datenversion', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  await page.getByTestId('open-settings').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Datenbank', { exact: true })).toBeVisible();
  await expect(dialog.getByText('197 von 5.000')).toBeVisible();
  await expect(dialog.getByText(/^1 · 20\. September 2026$/)).toBeVisible();
  await expect(dialog.getByText('Keine Fehler protokolliert.')).toBeVisible();
});

test('scheitert das Speichern, wird die Änderung zurückgenommen und gemeldet', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { setFailWrites(c: string): void } } }).__LINGO_FAKE__.db.setFailWrites('invalid_argument'));
  await page.getByTestId('open-settings').click();
  await page.getByRole('radio', { name: 'Hell' }).click();
  await expect(page.getByRole('alert')).toContainText('Konnte nicht gespeichert werden');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('diag-log')).toContainText('settings:save');
  expect(errors.some((e) => e.includes('settings:save'))).toBe(true);
});

test('ein ungültiges Profil wird gemeldet, angezeigt und beim Speichern nie ersetzt', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { rate: 'schnell' } } } });
  await openOverview(page);
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  await page.getByTestId('open-settings').click();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect.poll(async () => (await dump(page))['app/profile']?.lang).toBe('en');
  const profile = (await dump(page))['app/profile'] ?? {};
  expect(Object.keys(profile).length).toBeGreaterThan(30);
  expect(profile.rate).toBe('schnell');
  expect(Object.keys(profile.days ?? {}).length).toBeGreaterThan(20);
  await expect(page.getByTestId('diag-log')).toContainText('app/profile');
  expect(errors.some((e) => e.includes('data:validate'))).toBe(true);
});

test('Datenexport über downloads liefert alle Dokumente als JSON', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  await page.getByTestId('open-settings').click();
  await page.getByRole('button', { name: 'Alle Daten als JSON sichern' }).click();
  await expect(page.getByText('Sicherung gespeichert.')).toBeVisible();
  const saved = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { saved: Array<{ data: string }> } }).__LINGO_FAKE__.saved[0]?.data ?? '{}');
  const json = JSON.parse(saved) as { documentCount: number; schemaVersion: number; documents: Record<string, unknown> };
  expect(json.documentCount).toBe(197);
  expect(json.schemaVersion).toBe(1);
  expect(Object.keys(json.documents)).toContain('daily/2026-09-20');
});
