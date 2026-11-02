import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, openSettings, screen, VCFG_OFF } from './fixtures';
import { dump } from './trainerHelpers';

// „Neue Wörter-App einschalten“ (plan.md §9.3/9.4): Einstellungen › Wortschatz › Probelauf → Bericht → Sicherung → Übernehmen und einschalten
// → Fortschritt › Wörter zeigt die neue Übersicht; Rückweg „Zur alten Wörter-Ansicht zurück“ (mod 0) und wieder an ohne neue Umrechnung.

type Doc = Record<string, unknown>;

// Umgestellt wie nach Phase 0, Wörter noch nie übernommen (keine Marke vocabModule); das Profil steht auf dem Rückweg-Stand `vcfg.mod = 0`
// (Fixture), sonst schaltete sich die Wörter-App beim Start von selbst ein (autoswitch.spec.ts).
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
      // Erledigt ist Zustand: Häkchen-Zeile statt gleich beschriftetem Knopf, erneut nur als leiser Textknopf.
      await expect(page.getByTestId('vsw-backup-state')).toContainText('Sicherung gespeichert');
      await expect(page.getByTestId('vsw-backup')).toHaveCount(0);
      await expect(page.getByTestId('vsw-backup-again')).toHaveText('Noch einmal speichern');
      await expect(page.getByTestId('vsw').getByText('bleibt „Übernehmen und einschalten“ gesperrt')).toHaveCount(0);
      expect(await saved(page)).toHaveLength(1);
      await expect(page.getByTestId('vsw-apply')).toBeEnabled();
      await page.getByTestId('vsw-apply').click();
      await expect.poll(async () => ((await dump(page))['app/schema']?.vocabModule as Doc | undefined)?.state).toBe('done');
      await expect.poll(async () => (await vcfgOf(page))?.mod).toBe(1);
      const d = await dump(page);
      const lexed = Object.entries(d).filter(([p, v]) => /^(vocab|chunk)\//.test(p) && v && typeof v === 'object' && 'lex' in v).length;
      expect(lexed).toBeGreaterThan(0);
      // Eingeschaltet: Abschnittsanfang im Bild, feste Zustandszeile oben, Einstellungen der Wörter-App und darunter der Rückweg.
      const state = page.getByTestId('vsw-state');
      await expect(state).toHaveText('Neue Wörter-App ist an');
      await expect(state).toBeInViewport();
      await expect(page.getByTestId('vs')).toBeVisible();
      await expect(page.getByTestId('vsw-back')).toBeVisible();
      await expect(page.getByTestId('vsw-on').getByTestId('vs'), 'Einstellungen der Wörter-App in der Karte').toHaveCount(1);
      await expect(page.getByTestId('set-vocab').locator('h3')).toHaveText('Alte Wörter-Ansicht');
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
      await expect(page.getByTestId('vsw-state')).toHaveText('Alte Wörter-Ansicht ist an');
      await expect(page.getByTestId('vsw-state')).toBeInViewport();
      const again = page.getByTestId('vsw-reenable');
      await expect(again).toBeVisible();
      await expect(again, 'Zweitknopf, kein zweiter Hauptknopf').not.toHaveClass(/lx-btn-primary/);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await axe(page, '[data-testid="vsw"]')).toEqual([]);

      // Wieder an: ohne Probelauf und ohne neue Sicherung (Umrechnung ist fertig).
      const schemaBefore = JSON.stringify((await dump(page))['app/schema']);
      await again.click();
      await expect.poll(async () => (await vcfgOf(page))?.mod).toBe(1);
      expect(JSON.stringify((await dump(page))['app/schema'])).toBe(schemaBefore);
      expect(await saved(page)).toHaveLength(1);
      await expect(page.getByTestId('vsw-back')).toBeVisible();
      await expect(page.getByTestId('vsw-state')).toHaveText('Neue Wörter-App ist an');
      await expect(page.getByTestId('vsw-state')).toBeInViewport();
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Doppel: nur „gleiches Wort“ ist wählbar und sagt, welches Wort bleibt; Ähnliches nur als Hinweis', async ({ page }) => {
      const t = Date.parse('2026-09-18T10:00:00Z');
      const card = (id: string, word: string, de: string, reps: number) => ({ id, word, de, pos: 'noun', ex: `A ${word} here.`, reps, last: t - reps * 3_600_000, state: 'review', S: 3, D: 5, due: t, stage: 2 });
      const extra = { 'vocab/dl-a': card('dl-a', 'deadline', 'Frist', 4), 'vocab/dl-b': card('dl-b', 'Deadline', 'Frist', 2), 'vocab/col-a': card('col-a', 'colour', 'Farbe', 3), 'vocab/col-b': card('col-b', 'color', 'Farbe', 1) };
      const { errors } = await bootAt(page, { name: 'overview' }, { migrated: false, fake: { patch: { ...patch(), ...extra } } });
      await screen(page, 'overview');
      await openSettings(page);
      await page.getByTestId('vsw-dry').scrollIntoViewIfNeeded();
      await page.getByTestId('vsw-dry').click();
      const dupes = page.getByTestId('vsw-dupes');
      await expect(dupes).toBeVisible();
      const same = page.getByTestId('vsw-dupe').filter({ hasText: 'deadline · Deadline' });
      await expect(same).toHaveCount(1);
      await expect(same).toContainText('Zusammenlegen: du lernst nur noch „deadline“.');
      await expect(page.getByTestId('vsw-dupe').filter({ hasText: 'colo' }), 'britisch: keine Wahl').toHaveCount(0);
      await expect(page.getByTestId('vsw-like-item').filter({ hasText: 'colour · color' })).toContainText('britische Schreibweise');
      const words = Number((await page.getByTestId('vsw-words').innerText()).replace(/\D/g, ''));
      await same.getByTestId('vsw-merge').click();
      await expect.poll(async () => Number((await page.getByTestId('vsw-words').innerText()).replace(/\D/g, ''))).toBe(words - 1);
      expect(await layoutProblems(page)).toEqual([]);
      expect(await axe(page, '[data-testid="vsw"]')).toEqual([]);
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
      // Klarer nächster Schritt statt doppeltem Sperr-Satz; der Knopf ist nur noch Zweitknopf.
      await expect(page.getByTestId('vsw-backup-state')).toContainText('am Computer in claude.ai');
      await expect(page.getByTestId('vsw').getByText('bleibt „Übernehmen und einschalten“ gesperrt')).toHaveCount(0);
      await expect(page.getByTestId('vsw-backup')).not.toHaveClass(/lx-btn-primary/);
      await expect(page.getByTestId('vsw-apply')).toBeDisabled();
      expect((await dump(page))['app/profile']?.vcfg).toEqual(VCFG_OFF);
      expect(errors).toEqual([]);
    });
  });
}
