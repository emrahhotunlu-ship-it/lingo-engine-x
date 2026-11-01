import { expect, test } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, openSettings, SEED_EVENING, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Großpaket A S6 (Bilder s2-05, s2-13): Übersicht der Wörter-App unter Fortschritt › Wörter (Zahlen, 14-Tage-Vorschau, Behaltensrate)
// und Einstellungen › Wortschatz › Wörter (Zielzeit, neue Wörter, Sicherheit). Schreiben nur über den einen Schreibpfad auf app/profile.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const D = 86_400_000;

/** Ein Wort mit Lernstand (Stufe 5, beide Spuren), damit die Übersicht etwas zählt. Die übrigen Seed-Wörter haben noch keinen `lex`. */
function learnedLex(): Doc {
  const t = NOW - 30 * D;
  const day = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const fs = { s: 2.3065, d: 2.1181, st: 2, reps: 1, lapses: 0, last: t + 300_000, sd: 1, ls: 0 };
  return {
    v: 1, k: 'w', of: null, core: null, sense: null, lv: 5,
    u: { due: NOW + 3 * D, ...fs }, b: { due: NOW + 2 * D, ...fs },
    day, dayU: null, step: null, ev: { f: [day, day, day], o: 0, s: 0 }, sn: [['a', day]], gr: null, reg: null, pri: 'core',
    lc: 0, pair: null, mv: 0, sync: 0, mig: null, intro: day,
  };
}

const patch = (): Record<string, Doc> => ({
  'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
  'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1 }, newPerDay: 5 },
  'vocab/achieve': { lex: learnedLex() },
});

for (const vp of [
  { name: 'Handy 390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: 'Desktop 1440', use: { viewport: { width: 1440, height: 900 } } },
]) {
  test.describe(vp.name, () => {
    test.use(vp.use);

    test('Fortschritt › Wörter: Zahlen, 14 Tage, Behaltensrate; alte Behaltens-Karte entfällt', async ({ page }) => {
      const { errors, external } = await bootAt(page, { name: 'overview' }, { migrated: false, fake: { patch: patch() } });
      await screen(page, 'overview');
      await page.getByTestId('tab-words').click();
      const vo = page.getByTestId('vo');
      await expect(vo).toBeVisible();
      await expect(page.getByTestId('vo-counts')).toBeVisible();
      const total = Number(await page.getByTestId('vo-total').getAttribute('data-n'));
      expect(total).toBeGreaterThan(0);
      expect(Number(await page.getByTestId('vo-onway').getAttribute('data-n'))).toBeGreaterThan(0);
      const parts = await Promise.all(['vo-produce', 'vo-onway', 'vo-recognize'].map(async (id) => Number(await page.getByTestId(id).getAttribute('data-n'))));
      const fresh = (await page.getByTestId('vo-fresh').count()) ? Number(await page.getByTestId('vo-fresh').getAttribute('data-n')) : 0;
      expect(parts.reduce((a, b) => a + b, 0) + fresh).toBe(total);
      await expect(page.getByTestId('vo-day')).toHaveCount(14);
      await expect(page.getByTestId('vo-outlook-note')).not.toBeEmpty();
      await expect(page.getByTestId('vo-ret')).toHaveAttribute('data-status', /^(few|ok)$/);
      await expect(page.getByTestId('vo-ret-note')).not.toBeEmpty();
      // Die Übersicht steht über dem bisherigen Teil.
      const [a, b] = await Promise.all([vo.boundingBox(), page.getByTestId('seg-words').boundingBox()]);
      expect(a!.y).toBeLessThan(b!.y);
      expect(await layoutProblems(page)).toEqual([]);
      await page.getByTestId('vo-list').click();
      await screen(page, 'vocabList');
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Einstellungen › Wörter: Zielzeit, neue Wörter (auch 0), Sicherheit mit Minuten; alte Wahl „neue Wörter“ ausgeblendet', async ({ page }) => {
      const { errors } = await bootAt(page, { name: 'overview' }, { migrated: false, fake: { patch: patch() } });
      await screen(page, 'overview');
      await openSettings(page);
      const vs = page.getByTestId('vs');
      await vs.scrollIntoViewIfNeeded();
      await expect(vs).toBeVisible();
      await expect(page.getByTestId('set-newperday')).toHaveCount(0);
      for (const r of [85, 90, 95]) await expect(page.getByTestId(`vs-ret-${r}`)).toContainText(/\d/);
      await expect(page.getByTestId('vs-when')).not.toBeEmpty();
      await page.getByTestId('vs-min-20').click();
      await expect.poll(async () => ((await dump(page))['app/profile']?.vcfg as Doc | undefined)?.min).toBe(20);
      await page.getByTestId('vs-new-0').click();
      await expect.poll(async () => (await dump(page))['app/profile']?.newPerDay).toBe(0);
      await page.getByTestId('vs-ret-95').click();
      await expect.poll(async () => (await dump(page))['app/profile']?.vcfg).toEqual({ min: 20, ret: 0.95, mod: 1 });
      await expect(page.getByTestId('vs-ret-95')).toHaveAttribute('aria-checked', 'true');
      // S6b-3: Anki-Modus (Standard aus) und „Satz vor dem Prüfen anhören“ (Standard an) als Schalter.
      await expect(page.getByTestId('vs-anki')).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByTestId('vs-pre')).toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('vs-anki').click();
      await expect.poll(async () => ((await dump(page))['app/profile']?.vcfg as Doc | undefined)?.anki).toBe(1);
      await page.getByTestId('vs-pre').click();
      await expect.poll(async () => ((await dump(page))['app/profile']?.vcfg as Doc | undefined)?.pre).toBe(0);
      await expect(page.getByTestId('vs-anki')).toHaveAttribute('aria-checked', 'true');
      await expect(page.getByTestId('vs-pre')).toHaveAttribute('aria-checked', 'false');
      expect(await layoutProblems(page)).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}
