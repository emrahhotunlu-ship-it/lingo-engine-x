import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, openSettings, screen } from './fixtures';
import { dump } from './trainerHelpers';

// „Neue Wörter-App einschalten“ (plan.md §9.3/9.4): Einstellungen › Wortschatz › Probelauf → Bericht → Sicherung → Übernehmen und einschalten
// → Fortschritt › Wörter zeigt die neue Übersicht; Rückweg „Zur alten Wörter-Ansicht zurück“ (mod 0) und wieder an ohne neue Umrechnung.

type Doc = Record<string, unknown>;

// Umgestellt wie nach Phase 0, die Wörter-App noch nie eingeschaltet (kein vcfg, keine Marke vocabModule).
const patch = (): Record<string, Doc> => ({ 'app/schema': { ...MIGRATED['app/schema'] } });
const saved = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { saved: { filename: string }[] } }).__LINGO_FAKE__.saved.map((s) => s.filename));
const axe = async (page: Page, sel: string) => (await new AxeBuilder({ page }).include(sel).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => v.id);
// Was die Umstellung anfassen dürfte (Karten, Verlauf, Modul, Marke, Schalter); Zeitzähler der App laufen nebenher.
const touched = (d: Record<string, Doc>) =>
  JSON.stringify([...Object.entries(d).filter(([p]) => /^(vocab|chunk|vlog|vmod)\//.test(p)).sort(([a], [b]) => a.localeCompare(b)), d['app/schema'], d['app/profile']?.vcfg ?? null]);
const vcfgOf = async (page: Page) => (await dump(page))['app/profile']?.vcfg as Doc | undefined;

for (const vp of [
  { name: 'Handy 390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: 'Desktop 1440', use: { viewport: { width: 1440, height: 900 } } },
]) {
  test.describe(vp.name, () => {
    test.use(vp.use);

    test('Einschalten: Probelauf, Sicherung, Übernehmen → neue Übersicht; Rückweg und wieder an', async ({ page }) => {
      const { errors, external } = await bootAt(page, { name: 'overview' }, { migrated: false, fake: { patch: patch() } });
      await screen(page, 'overview');
      await openSettings(page);
      const sw = page.getByTestId('vsw');
      await sw.scrollIntoViewIfNeeded();
      await expect(sw).toBeVisible();
      await expect(page.getByTestId('vs'), 'Einstellungen der Wörter-App erst nach dem Einschalten').toHaveCount(0);

      // Probelauf: Bericht in Alltagsworten, nichts geschrieben.
      const before = await dump(page);
      await page.getByTestId('vsw-dry').click();
      const report = page.getByTestId('vsw-report');
      await expect(report).toBeVisible();
      await expect(page.getByTestId('vsw-words')).toContainText(/\d/);
      for (const g of ['recognize', 'onway', 'produce', 'fresh']) await expect(page.getByTestId(`vsw-g-${g}`)).toContainText(/\d/);
      expect(touched(await dump(page)), 'Probelauf schreibt nichts').toBe(touched(before));
      await expect(page.getByTestId('vsw-apply'), 'ohne Sicherung gesperrt').toBeDisabled();
      expect(await layoutProblems(page)).toEqual([]);
      expect(await axe(page, '[data-testid="vsw"]')).toEqual([]);

      // Sicherung (Datei, nur auf Klick), dann Übernehmen.
      await page.getByTestId('vsw-backup').click();
      await expect(page.getByTestId('vsw-backup-state')).toContainText('Sicherung gespeichert');
      expect(await saved(page)).toHaveLength(1);
      await expect(page.getByTestId('vsw-apply')).toBeEnabled();
      await page.getByTestId('vsw-apply').click();
      await expect.poll(async () => ((await dump(page))['app/schema']?.vocabModule as Doc | undefined)?.state).toBe('done');
      await expect.poll(async () => (await vcfgOf(page))?.mod).toBe(1);
      const d = await dump(page);
      const lexed = Object.entries(d).filter(([p, v]) => /^(vocab|chunk)\//.test(p) && v && typeof v === 'object' && 'lex' in v).length;
      expect(lexed).toBeGreaterThan(0);
      // Eingeschaltet: Einstellungen der Wörter-App und darunter der Rückweg.
      await expect(page.getByTestId('vs')).toBeVisible();
      await expect(page.getByTestId('vsw-back')).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      expect(await axe(page, '[data-testid="vsw-back"]')).toEqual([]);

      // Wörter zeigt den neuen Start (Übersicht der Wörter-App).
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.getByTestId('tab-words').click();
      await expect(page.getByTestId('vo')).toBeVisible();

      // Rückweg: mod 0, alte Ansicht wieder da, Umrechnung bleibt.
      await openSettings(page);
      const back = page.getByTestId('vsw-back-btn');
      await back.scrollIntoViewIfNeeded();
      await back.click();
      await expect.poll(async () => (await vcfgOf(page))?.mod).toBe(0);
      expect(((await dump(page))['app/schema']?.vocabModule as Doc).state).toBe('done');
      await expect(page.getByTestId('vs')).toHaveCount(0);
      const again = page.getByTestId('vsw-reenable');
      await again.scrollIntoViewIfNeeded();
      await expect(again).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      expect(await axe(page, '[data-testid="vsw"]')).toEqual([]);

      // Wieder an: ohne Probelauf und ohne neue Sicherung (Umrechnung ist fertig).
      const schemaBefore = JSON.stringify((await dump(page))['app/schema']);
      await again.click();
      await expect.poll(async () => (await vcfgOf(page))?.mod).toBe(1);
      expect(JSON.stringify((await dump(page))['app/schema'])).toBe(schemaBefore);
      expect(await saved(page)).toHaveLength(1);
      await expect(page.getByTestId('vsw-back')).toBeVisible();
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('ohne Dateien speichern: Hinweis, Übernehmen bleibt gesperrt', async ({ page }) => {
      const { errors } = await bootAt(page, { name: 'overview' }, { migrated: false, fake: { patch: patch(), capabilities: { downloads: false } } });
      await screen(page, 'overview');
      await openSettings(page);
      await page.getByTestId('vsw-dry').scrollIntoViewIfNeeded();
      await page.getByTestId('vsw-dry').click();
      await expect(page.getByTestId('vsw-report')).toBeVisible();
      await page.getByTestId('vsw-backup').click();
      await expect(page.getByTestId('vsw-backup-state')).toContainText('nicht verfügbar');
      await expect(page.getByTestId('vsw-apply')).toBeDisabled();
      expect((await dump(page))['app/profile']?.vcfg).toBeUndefined();
      expect(errors).toEqual([]);
    });
  });
}
