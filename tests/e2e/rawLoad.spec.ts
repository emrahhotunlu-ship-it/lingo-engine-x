import { expect, test, type Page } from '@playwright/test';
import { serveDist } from './dist';
import { ORIGIN } from './fixtures';

// Großpaket C „schneller Start“: Die großen Inhalte kommen als nachgeladene Dateien (`raw-*.txt`). Scheitert das Laden, steht statt des
// Startbilds ein Hinweis mit „Neu laden“; hängt es, kommt nach 15 s ein ruhiges Band mit „Neu laden“, das Startbild bleibt (Kap. 15: nie stumm).

async function open(page: Page, raw: 'fail' | 'hang'): Promise<void> {
  await page.route('**/*', async (route) => {
    if (/\/raw-[^/]+\.txt(\?|$)/.test(route.request().url())) {
      if (raw === 'fail') await route.abort();
      return; // „hang“: keine Antwort
    }
    if (await serveDist(route, ORIGIN)) return;
    await route.abort();
  });
  await page.goto(`${ORIGIN}/`);
}

test('Nachladen scheitert: Hinweis mit „Neu laden“ statt Startbild', async ({ page }) => {
  await open(page, 'fail');
  const box = page.getByTestId('raw-failed');
  await expect(box).toBeVisible();
  await expect(box.getByRole('button', { name: 'Neu laden' })).toBeVisible();
  await expect(page.locator('#lx-boot')).toHaveCount(0);
});

test('Nachladen hängt: nach 15 s ein Band mit „Neu laden“, Startbild bleibt', async ({ page }) => {
  await page.clock.install();
  await open(page, 'hang');
  await expect(page.locator('#lx-boot')).toBeVisible();
  await expect(page.getByTestId('raw-slow')).toHaveCount(0);
  await page.clock.runFor(16_000);
  await expect(page.getByTestId('raw-slow')).toBeVisible();
  await expect(page.getByTestId('raw-slow').getByRole('button', { name: 'Neu laden' })).toBeVisible();
  await expect(page.locator('#lx-boot')).toBeVisible();
});
