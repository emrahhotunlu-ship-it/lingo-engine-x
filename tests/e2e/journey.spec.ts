import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen } from './fixtures';

// C1-Reise (Lernplattform 3.0 P58): die Programmkarte als Weg mit Gelände. Stationen bleiben echte Knöpfe in Programmreihenfolge (k1…k7),
// der Weg verbindet sie (gegangen · Ankunft · vor dir). Bei Effekt-Stufe „Aus“ kein Kippen und keine Animation. Schalter `program`.

async function start(page: Page, fx: 'full' | 'off') {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const booted = await boot(page, { migrated: true, localStorage: { 'lx:flags': 'program', 'lx:fx': fx, 'lx:journey-seen': '2026-09-20' } });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await expect(page.getByTestId('program-map')).toBeVisible();
  return booted;
}

const order = (page: Page) => page.locator('[data-testid="program-chapter"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-chapter')));

test.describe('Handy 360', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('Stufe Voll: Gelände gekippt, Weg mit Abschnitten, Stationen als Knöpfe in Reihenfolge; kein Querscrollen, axe 0', async ({ page }) => {
    const { errors } = await start(page, 'full');
    expect(await order(page)).toEqual(['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7']);
    const opens = page.locator('[data-testid="program-chapter"] [data-testid="program-chapter-open"]');
    await expect(opens).toHaveCount(7);
    expect(await opens.evaluateAll((els) => els.every((el) => el.tagName === 'BUTTON'))).toBe(true);
    expect(await page.locator('.lx-jr-ground').first().evaluate((el) => getComputedStyle(el).transform)).not.toBe('none');
    const route = page.getByTestId('journey-route');
    await expect(route).toHaveCount(1);
    expect(await route.locator('g[data-tone]').count()).toBeGreaterThanOrEqual(6);
    expect(await layoutProblems(page)).toEqual([]);
    const res = await new AxeBuilder({ page }).include('[data-testid="program-map"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Stufe Aus: flach, keine Animation; Tastatur erreicht die Stationen in Reihenfolge', async ({ page }) => {
    const { errors } = await start(page, 'off');
    expect(await page.locator('.lx-jr-ground').first().evaluate((el) => getComputedStyle(el).transform)).toBe('none');
    expect(await page.getByTestId('program-map').evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    const ids = await page
      .locator('[data-testid="program-chapter"] [data-testid="program-chapter-open"]')
      .evaluateAll((els) => els.map((el) => el.closest('[data-testid="program-chapter"]')?.getAttribute('data-chapter')));
    expect(ids).toEqual(['k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'k7']);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Waagerechte Reise mit Detail; Station wählen wechselt das Detail', async ({ page }) => {
    const { errors } = await start(page, 'full');
    const map = page.getByTestId('program-map');
    await expect(map.getByTestId('program-chapter')).toHaveCount(7);
    await expect(map.getByTestId('program-detail')).toBeVisible();
    await page.locator('[data-testid="program-chapter"][data-chapter="k5"] [data-testid="program-chapter-open"]').click();
    await expect(page.locator('[data-testid="program-chapter"][data-chapter="k5"] [data-testid="program-chapter-open"]')).toHaveAttribute('aria-pressed', 'true');
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
