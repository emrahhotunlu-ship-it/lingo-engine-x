import { expect, test } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, openSettings, SEED_EVENING, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Großpaket A S7c (Bilder s3-01 bis s3-04): Einstufungstest der Wörter-App. Einstieg über Fortschritt › Wörter und Einstellungen › Wörter;
// 6× erkennen, 2× selbst bilden je Stufe, keine Rückmeldung je Wort, Stopp nach zwei unsicheren Stufen in Folge; gespeichert wird nur vmod/place.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);

const patch = (): Record<string, Doc> => ({
  'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
  'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1 }, newPerDay: 5 },
});

for (const vp of [
  { name: 'Handy 390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: 'Desktop 1440', use: { viewport: { width: 1440, height: 900 } } },
]) {
  test.describe(vp.name, () => {
    test.use(vp.use);

    test('Einstufung: Start, Erkennen, Selbst bilden, Stopp nach zwei schweren Stufen, Ergebnis gespeichert', async ({ page }) => {
      const { errors, external } = await bootAt(page, { name: 'overview' }, { migrated: false, fake: { patch: patch() } });
      await screen(page, 'overview');
      await page.getByTestId('tab-words').click();
      const entry = page.getByTestId('vo-place');
      await entry.scrollIntoViewIfNeeded();
      await expect(entry).toHaveAttribute('data-edge', '');
      // Vorher-Stand: Wörter und Tagesplan, die der Test nicht ändern darf.
      // Der Tagesplan wird beim Start nach dem Nachfüllen eingefroren; erst danach ist der Stand ruhig.
      await expect.poll(async () => (await dump(page))['vmod/day'] !== undefined).toBe(true);
      const before = await dump(page);
      const wordsOf = (d: Record<string, Doc>) => JSON.stringify(Object.entries(d).filter(([k]) => /^(vocab|chunk)\//.test(k)).sort(([a], [b]) => a.localeCompare(b)));
      await entry.click();
      await screen(page, 'vplace');

      // Start (s3-01): fünf Stufen, „Später“ und „Einstufung starten“.
      await expect(page.getByTestId('vp-intro')).toBeVisible();
      await expect(page.getByTestId('vp-intro-bands').locator('li')).toHaveCount(5);
      expect(await layoutProblems(page)).toEqual([]);
      await page.getByTestId('vp-go').click();

      // Erkennen (s3-02): markiertes Wort im Satz, vier Bedeutungen, „Weiter“ erst nach einer Wahl, keine Rückmeldung.
      await expect(page.getByTestId('vp-choices')).toBeVisible();
      await expect(page.getByTestId('vp-choices').locator('.lx-choice')).toHaveCount(4);
      await expect(page.getByTestId('vp-next')).toBeDisabled();
      await expect(page.getByTestId('vp-note')).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      await page.getByTestId('vp-choices').locator('.lx-choice').first().click();
      await expect(page.getByTestId('vp-next')).toBeEnabled();
      await expect(page.locator('.lx-choice[data-state="correct"], .lx-choice[data-state="wrong"]')).toHaveCount(0);
      await page.getByTestId('vp-next').click();
      for (let i = 1; i < 6; i++) await page.getByTestId('vp-dunno').click();

      // Selbst bilden (s3-03): deutsches Wort groß, Lücke mit Anfangsbuchstabe im Satz.
      await expect(page.getByTestId('vp-de')).toBeVisible();
      await expect(page.getByTestId('vp-oneword')).toBeVisible();
      await expect(page.getByTestId('vp-next')).toBeDisabled();
      expect(await layoutProblems(page)).toEqual([]);
      // Nur der Anfangsbuchstabe steht da, kein Platz je Buchstabe: die Länge des Worts bleibt verborgen.
      await expect(page.getByTestId('gap').locator('.lx-slot:not(.lx-slot-extra)')).toHaveCount(1);
      await page.getByTestId('gap-input').click();
      await page.keyboard.type('xyz');
      await expect(page.getByTestId('vp-next')).toBeEnabled();
      await page.getByTestId('vp-next').click();
      await page.getByTestId('vp-dunno').click();

      // Eine schwere Stufe beendet den Test nicht: Stufe 2 läuft, alles „Weiß ich nicht“.
      await expect(page.getByTestId('vp-choices')).toBeVisible();
      for (let i = 0; i < 8; i++) await page.getByTestId('vp-dunno').click();

      // Ergebnis (s3-04): zwei Stufen schwer → Stopp, Grenze unter 2.500, übrige Stufen nicht getestet.
      await expect(page.getByTestId('vp-result')).toBeVisible();
      await expect(page.getByTestId('vp-edge')).toHaveAttribute('data-edge', '2500');
      await expect(page.getByTestId('vp-band-2500')).toHaveAttribute('data-s', 'bad');
      await expect(page.getByTestId('vp-band-4000')).toHaveAttribute('data-s', 'bad');
      for (const lo of [6000, 8000, 10000]) await expect(page.getByTestId(`vp-band-${lo}`)).toHaveAttribute('data-s', 'skip');
      await expect(page.getByTestId('vp-mix').locator('li')).toHaveCount(4);
      await page.getByTestId('vp-words-toggle').click();
      await expect(page.getByTestId('vp-words').locator('li')).toHaveCount(16);
      expect(await layoutProblems(page)).toEqual([]);

      await expect
        .poll(async () => {
          const d = (await dump(page))['vmod/place'];
          return d ? { v: d.v, edge: d.edge, bands: (d.bands as unknown[][]).map((b) => b[1]) } : null;
        })
        .toEqual({ v: 1, edge: 2500, bands: ['bad', 'bad', 'skip', 'skip', 'skip'] });
      const saved = (await dump(page))['vmod/place']!;
      expect(Object.keys(saved).sort()).toEqual(['bands', 'edge', 'ok', 'v', 't'].sort());
      // Wörter und Plan bleiben unberührt: kein neues Lexem, kein Tagesplan.
      const after = await dump(page);
      expect(after['vmod/day']).toEqual(before['vmod/day']);
      expect(wordsOf(after)).toBe(wordsOf(before));

      await page.getByTestId('vp-done').click();
      await screen(page, 'overview');
      await page.getByTestId('tab-words').click();
      await expect(page.getByTestId('vo-place')).toHaveAttribute('data-edge', '2500');
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Einstellungen › Wörter: Zeile „Wörter einstufen“, „Später“ führt zurück und speichert nichts', async ({ page }) => {
      const { errors } = await bootAt(page, { name: 'overview' }, { migrated: false, fake: { patch: patch() } });
      await screen(page, 'overview');
      await openSettings(page);
      const entry = page.getByTestId('vs').getByTestId('vo-place');
      await entry.scrollIntoViewIfNeeded();
      await entry.click();
      await screen(page, 'vplace');
      await expect(page.getByTestId('set-group-learn')).toHaveCount(0);
      await page.getByTestId('vp-later').click();
      await expect(page.getByTestId('vplace')).toHaveCount(0);
      expect((await dump(page))['vmod/place']).toBeUndefined();
      expect(errors).toEqual([]);
    });
  });
}
