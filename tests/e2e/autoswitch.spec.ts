import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, layoutProblems, openTab, screen, VCFG_OFF } from './fixtures';
import { TUE_9 } from './heuteHelpers';
import { dump } from './trainerHelpers';

// Wörter-App von selbst an (Emrah 02.11.2026: „schalte die neue Wörter-App einfach live, warum muss ich da noch manuell was machen“):
// Profil ohne `vcfg` → beim Start übernimmt die App die Wörter und schaltet ein; der Reiter Wörter zeigt die neue App mit EINEM Knopf.
// Ein vorhandenes `vcfg` (Rückweg mod 0) bleibt unangetastet.

type Doc = Record<string, unknown>;
const vcfgOf = async (page: Parameters<typeof dump>[0]) => (await dump(page))['app/profile']?.vcfg as Doc | undefined;
const axe = async (page: Parameters<typeof dump>[0], sel: string) => (await new AxeBuilder({ page }).include(sel).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => v.id);

for (const vp of [
  { name: 'Handy 390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: 'Desktop 1440', use: { viewport: { width: 1440, height: 900 } } },
]) {
  test.describe(vp.name, () => {
    test.use(vp.use);

    test('ohne vcfg: übernimmt beim Start, Reiter Wörter zeigt die neue App, Knopf startet die Wörter von heute', async ({ page }) => {
      const { errors, external } = await boot(page, { migrated: true, vocabAuto: true });
      await screen(page, 'today');
      await expect.poll(async () => (await vcfgOf(page))?.mod, { timeout: 20_000 }).toBe(1);
      const d = await dump(page);
      expect((d['app/schema']?.vocabModule as Doc | undefined)?.state).toBe('done');
      expect(Object.entries(d).filter(([p, doc]) => /^vocab\//.test(p) && doc.hidden !== true && doc.lex).length).toBeGreaterThan(50);
      await expect(page.getByRole('status').filter({ hasText: 'Neue Wörter-App ist an' })).toBeVisible();

      await openTab(page, 'vocab');
      await expect(page.getByTestId('vocab-home')).toBeVisible();
      await expect(page.getByTestId('vocab'), 'alter Reiter weg').toHaveCount(0);
      await expect(page.getByTestId('vo-counts')).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      expect(await axe(page, '[data-testid="vocab-home"]')).toEqual([]);
      // Testdaten: Wörter sind heute schon erledigt (act.review) → Zustand statt Knopf, dazu „Noch 5“ als Extra.
      await expect(page.getByTestId('vh-done')).toBeVisible();
      await expect(page.getByTestId('vh-go')).toHaveCount(0);
      await page.getByTestId('vh-more').click();
      await screen(page, 'vlearn');
      await expect(page.getByTestId('vm-notice'), 'kein „noch nicht eingeschaltet“').toHaveCount(0);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });

    test('neuer Tag: Wörter offen → EIN Knopf „Wörter lernen“ startet die Pflichtrunde', async ({ page }) => {
      const { errors } = await boot(page, { migrated: true, vocabAuto: true, now: TUE_9 });
      await screen(page, 'today');
      await expect.poll(async () => (await vcfgOf(page))?.mod, { timeout: 20_000 }).toBe(1);
      await openTab(page, 'vocab');
      await expect(page.getByTestId('vh-done')).toHaveCount(0);
      await page.getByTestId('vh-go').click();
      await screen(page, 'vlearn');
      await expect(page.getByTestId('vm-notice')).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    test('Rückweg-Stand (vcfg mod 0): nichts übernommen, alter Reiter bleibt', async ({ page }) => {
      const { errors } = await boot(page, { migrated: true });
      await screen(page, 'today');
      await openTab(page, 'vocab');
      await expect(page.getByTestId('vocab')).toBeVisible();
      await expect(page.getByTestId('vocab-home')).toHaveCount(0);
      const d = await dump(page);
      expect(d['app/profile']?.vcfg).toEqual(VCFG_OFF);
      expect(d['app/schema']?.vocabModule).toBeUndefined();
      expect(errors).toEqual([]);
    });
  });
}
