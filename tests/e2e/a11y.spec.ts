import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, screen, type Theme } from './fixtures';

// Barrierefreiheit (Kap. 8, Kap. 12): axe in allen drei Modi, Touch-Ziele ≥ 44 px.

const THEMES: Theme[] = ['dark', 'dim', 'light'];

for (const theme of THEMES) {
  for (const migrated of [false, true]) {
    for (const width of [390, 1440]) {
      test(`axe · ${migrated ? 'Stand' : 'Umstellung'} · ${theme} · ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await boot(page, { theme, migrated });
        await screen(page, migrated ? 'overview' : 'migration');
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }
  }
}

test('axe · Einstellungen offen (alle Modi)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const theme of THEMES) {
    await boot(page, { theme, migrated: true });
    await screen(page, 'overview');
    await page.getByTestId('open-settings').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

test('Touch-Ziele am Handy mindestens 44 × 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { migrated: true });
  await screen(page, 'overview');
  await page.getByTestId('open-settings').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400);
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, [role="radio"], a[href], input, select, textarea'))
      .filter((el) => el.offsetParent !== null && !el.classList.contains('sr-only'))
      .map((el) => ({ label: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ label, r }) => `${label} (${Math.round(r.width)}×${Math.round(r.height)})`),
  );
  expect(small).toEqual([]);
});
