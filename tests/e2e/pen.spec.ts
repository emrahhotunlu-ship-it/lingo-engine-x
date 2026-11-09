import { expect, test, type Page } from '@playwright/test';
import { boot } from './fixtures';

// Stift-Werkzeug (Emrah 09.11.2026, ersetzt den Kommentar-Modus): Griff am rechten Rand → Stelle antippen oder Rahmen ziehen →
// Bild + Art + Text → `pen/<id>`. Im Auswahl-Modus löst ein Tipp in der App nichts aus.

type Doc = { kind?: string; text?: string; img?: string; target?: { path?: string | null }; screen?: { tab?: string | null } };
const pens = (page: Page) =>
  page.evaluate(() => {
    const dump = (window as unknown as { __LINGO_FAKE__: { db: { dump: () => Record<string, unknown> } } }).__LINGO_FAKE__.db.dump();
    return Object.entries(dump)
      .filter(([k]) => k.startsWith('pen/'))
      .map(([, v]) => v);
  }) as Promise<Doc[]>;

test('Tipp auf eine Stelle: Bild, Art und Text landen in pen/*, der Reiter wechselt nicht', async ({ page }) => {
  await boot(page, { migrated: true });
  await expect(page.locator('[data-screen="today"]')).toBeVisible();
  const tab = await page.evaluate(() => document.documentElement.getAttribute('data-lx-tab'));
  await page.getByTestId('pen-open').click();
  await expect(page.getByTestId('pen-bar')).toBeVisible();
  await page.locator('[data-testid^="tab-"]:not([data-testid="tab-badge"])').nth(2).click();
  await expect(page.getByTestId('pen-text')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('pen-img')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-lx-tab'))).toBe(tab);
  await page.getByTestId('pen-kind').getByRole('button', { name: 'Design' }).click();
  await page.getByTestId('pen-text').fill('Der Reiter ist zu klein.');
  await page.getByTestId('pen-send').click();
  await expect.poll(async () => (await pens(page)).length).toBe(1);
  const [d] = await pens(page);
  expect(d?.kind).toBe('design');
  expect(d?.text).toBe('Der Reiter ist zu klein.');
  expect(d?.img?.startsWith('data:image/jpeg')).toBe(true);
  expect((d?.img ?? '').length).toBeLessThan(180_000);
  await expect(page.getByTestId('pen-open')).toBeVisible();
});

test('Rahmen ziehen markiert einen Bereich', async ({ page }) => {
  await boot(page, { migrated: true });
  await expect(page.locator('[data-screen="today"]')).toBeVisible();
  await page.getByTestId('pen-open').click();
  await page.mouse.move(40, 120);
  await page.mouse.down();
  await page.mouse.move(200, 260, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId('pen-text')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('pen-text').fill('Bereich');
  await page.getByTestId('pen-send').click();
  await expect.poll(async () => (await pens(page)).length).toBe(1);
});

test('Abbrechen beendet den Modus ohne Rückmeldung', async ({ page }) => {
  await boot(page, { migrated: true });
  await page.getByTestId('pen-open').click();
  await page.getByTestId('pen-cancel').click();
  await expect(page.getByTestId('pen-open')).toBeVisible();
  expect(await pens(page)).toHaveLength(0);
});
