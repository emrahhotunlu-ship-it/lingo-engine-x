import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, layoutProblems, placedProfile, type Theme } from './fixtures';

// Barrierefreiheit (axe) und Handy-Layout auf den Hauptbildschirmen, hell und dunkel.

for (const theme of ['dark', 'light'] as Theme[]) {
  test.describe(`Modus ${theme}`, () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('Heute, Fahrplan, Training und Übersetzer ohne axe-Befund und ohne Querscrollen', async ({ page }) => {
      await boot(page, { theme, fake: { seed: 'empty', patch: { 'coach/profile': placedProfile() } } });
      const scan = async (where: string) => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        expect(res.violations.map((v) => `${where}: ${v.id} – ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
        expect(await layoutProblems(page)).toEqual([]);
      };
      await expect(page.getByTestId('home')).toBeVisible();
      await scan('Heute');
      await page.getByTestId('tab-plan').click();
      await expect(page.getByTestId('plan')).toBeVisible();
      await scan('Fahrplan');
      await page.getByTestId('tab-home').click();
      await page.getByTestId('start-training').click();
      await expect(page.getByTestId('session')).toBeVisible();
      await scan('Training');
      await page.getByTestId('open-translate').click();
      await page.getByTestId('translate-input').fill('verhandeln');
      await expect(page.getByTestId('translate-hits')).toBeVisible();
      await scan('Übersetzer');
    });
  });
}
