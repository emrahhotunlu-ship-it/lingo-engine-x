import { expect, type Page } from '@playwright/test';
import { openOverview, screen } from './fixtures';

// Rundgang durch die Phase-6-Bildschirme (Plan §13): die vier Reiter von „Dein Stand" und der
// Wortschatztest (Einstieg, Ja/Nein, Bedeutung). `visit(name)` prüft bzw. fotografiert je Station.

export async function progressTour(page: Page, visit: (name: string) => Promise<void>): Promise<void> {
  await openOverview(page);
  for (const id of ['judge', 'errors', 'path', 'history'] as const) {
    await page.getByTestId(`tab-${id}`).click();
    await expect(page.getByTestId(`tab-${id}`)).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(250);
    await visit(`stand-${id}`);
  }
  await page.getByTestId('vtest-start').click();
  await screen(page, 'vtest');
  await visit('wortschatztest');
  await page.getByTestId('vt-start').click();
  await expect(page.getByTestId('vt-word')).toBeVisible();
  await visit('wortschatztest-janein');
  for (let k = 0; k < 112; k++) await page.getByTestId(k % 2 ? 'vt-no' : 'vt-yes').click();
  await expect(page.getByTestId('vtest')).toHaveAttribute('data-state', 'meaning');
  await visit('wortschatztest-bedeutung');
}
