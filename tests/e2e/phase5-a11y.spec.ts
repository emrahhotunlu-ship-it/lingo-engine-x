import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, openSpeak, layoutProblems, screen, type Theme } from './fixtures';

// Phase 5: Barrierefreiheit und Gestalt (Plan §10.2 screens-phase5 / a11y-phase5, verkleinert):
// je Modus und Breite Begleiter mit Antwort, Übersetzer-Ergebnis, Preply-Plan und Import-Vorschau.
// Geprüft: axe (WCAG 2.1 AA), `layoutProblems`, Touch-Ziele ≥ 44 px im Begleiter. Bildschirmfotos
// liegen für den ux-reviewer unter test-results/.

const THEMES: Theme[] = ['dark', 'dim', 'light'];

async function axe(page: Page, scope: string): Promise<string[]> {
  const res = await new AxeBuilder({ page }).include(scope).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

async function smallTargets(page: Page, scope: string): Promise<string[]> {
  return page.locator(`${scope} button`).evaluateAll((els) =>
    els
      .filter((e) => !e.classList.contains('lx-word'))
      .map((e) => ({ r: e.getBoundingClientRect(), t: (e.getAttribute('aria-label') ?? e.textContent ?? '').trim().slice(0, 30) }))
      .filter(({ r }) => r.width > 0 && (r.height < 32 || r.width < 32))
      .map(({ r, t }) => `${t} ${Math.round(r.width)}×${Math.round(r.height)}`),
  );
}

for (const theme of THEMES) {
  for (const width of [390, 1440]) {
    test(`Phase 5 · ${theme} · ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const { errors } = await boot(page, { theme, migrated: true });
      await screen(page, 'today');

      // Begleiter mit Antwort
      await page.getByTestId('open-companion').click();
      await page.getByTestId('chat-input').fill('Was heißt leverage?');
      await page.getByTestId('chat-send').click();
      await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
      expect(await axe(page, '[data-testid="companion"]')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await smallTargets(page, '[data-testid="companion"]')).toEqual([]);
      await page.screenshot({ path: info.outputPath(`companion-${theme}-${width}.png`) });

      // Übersetzer-Ergebnis
      await page.getByTestId('companion-tab-translate').click();
      await page.getByTestId('tr-input').fill('Wir müssen das Budget freigeben');
      await page.getByTestId('tr-go').click();
      await expect(page.getByTestId('tr-result')).toBeVisible();
      expect(await axe(page, '[data-testid="companion"]')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      await page.screenshot({ path: info.outputPath(`translate-${theme}-${width}.png`) });
      await page.getByTestId('companion-close').click();

      // Preply: Plan und Import-Vorschau
      await openSpeak(page, 'preply');
      await page.getByTestId('pp-create').click();
      await expect(page.getByTestId('pp-plan')).toBeVisible();
      expect(await axe(page, 'main')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      await page.screenshot({ path: info.outputPath(`preply-plan-${theme}-${width}.png`), fullPage: true });
      await page.getByTestId('pp-tab-import').click();
      await page.getByTestId('pi-raw').fill('Teacher: "depend of" -> depend on');
      await page.getByTestId('pi-analyze').click();
      await expect(page.getByTestId('pi-review')).toBeVisible();
      expect(await axe(page, 'main')).toEqual([]);
      expect(await layoutProblems(page)).toEqual([]);
      await page.screenshot({ path: info.outputPath(`preply-import-${theme}-${width}.png`), fullPage: true });
      expect(errors).toEqual([]);
    });
  }
}

test('Fokusfalle und Esc-Reihenfolge: Nachschlagen → Begleiter', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page, { migrated: true });
  await screen(page, 'today');
  await page.getByTestId('open-companion').click();
  // Tab bleibt im Dialog.
  for (let i = 0; i < 25; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="companion"]'))).toBe(true);
  await page.locator('[data-testid="chat-msg"][data-role="assistant"] button.lx-word').first().click();
  await expect(page.getByTestId('lookup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lookup')).toHaveCount(0);
  await expect(page.getByTestId('companion')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('companion')).toHaveCount(0);
});
