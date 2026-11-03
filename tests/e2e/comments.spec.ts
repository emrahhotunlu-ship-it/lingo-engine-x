import { expect, test, type Page } from '@playwright/test';
import { boot } from './fixtures';

// Kommentar-Modus (Emrah 03.11.2026): Knopf am rechten Rand → nächster Tipp öffnet das Kommentarfeld von claude.ai an der
// Stelle (Fähigkeit `comments`, nur `openComposer`) und löst in der App nichts aus.

const calls = (page: Page) => page.evaluate(() => (window as { __LINGO_COMMENTS__?: string[] }).__LINGO_COMMENTS__ ?? []);

test('ohne Fähigkeit kein Kommentar-Knopf', async ({ page }) => {
  await boot(page, { migrated: true });
  await expect(page.locator('[data-screen="today"]')).toBeVisible();
  await expect(page.getByTestId('comment-mode')).toHaveCount(0);
});

test('Tipp auf einen Reiter öffnet das Kommentarfeld dort und wechselt nicht den Reiter', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { comments: true } } });
  await expect(page.locator('[data-screen="today"]')).toBeVisible();
  const btn = page.getByTestId('comment-mode');
  await expect(btn).toBeVisible();
  const tab = await page.evaluate(() => document.documentElement.getAttribute('data-lx-tab'));
  await btn.click();
  await expect(page.getByTestId('comment-mode-bar')).toBeVisible();
  const target = page.locator('[data-testid^="tab-"]:not([data-testid="tab-badge"])').nth(2);
  await target.click();
  await expect(page.getByTestId('comment-mode-bar')).toHaveCount(0);
  await expect.poll(() => calls(page)).toHaveLength(1);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.documentElement.getAttribute('data-lx-tab'))).toBe(tab);
  // Danach wirkt ein Tipp wieder normal.
  await target.click();
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute('data-lx-tab'))).not.toBe(tab);
  expect(await calls(page)).toHaveLength(1);
});

test('Abbrechen beendet den Modus ohne Kommentar', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { comments: true } } });
  await page.getByTestId('comment-mode').click();
  await page.getByTestId('comment-mode-cancel').click();
  await expect(page.getByTestId('comment-mode')).toBeVisible();
  expect(await calls(page)).toHaveLength(0);
});
