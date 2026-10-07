import { expect, test } from '@playwright/test';
import { boot, openSettings, screen } from './fixtures';
import { dump, writes } from './trainerHelpers';

// P29 (Lernplattform 3.0): Kapazitätsanzeige in den Einstellungen. Nur Lesen; ohne genug Tagesbilder steht „noch keine Prognose“.

test('Einstellungen zeigen Dokumentzahl, Warnschwelle und die Sammlungen; es wird nichts geschrieben', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await page.waitForTimeout(800);
  const before = await dump(page);
  const writesBefore = (await writes(page)).length;
  await openSettings(page);
  const box = page.getByTestId('doc-forecast');
  await expect(box).toBeVisible();
  const line = page.getByTestId('doc-forecast-line');
  await expect(line).toContainText('Dokumente');
  await expect(line).toContainText('von 5.000');
  await expect(line).toContainText('Warnschwelle (3.500)');
  await expect(line).toContainText('noch keine Prognose');
  for (const c of ['vocab', 'chunk', 'log']) await expect(page.getByTestId(`doc-forecast-${c}`)).toContainText('von 1.000');
  await expect(page.getByTestId('doc-forecast-vocab')).toContainText('Vorwarnung (900)');
  await page.waitForTimeout(500);
  expect((await writes(page)).length).toBe(writesBefore);
  expect(await dump(page)).toEqual(before);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('mit genug Tagesbildern: „in etwa n–m Monaten“', async ({ page }) => {
  const today = new Date('2026-09-20T12:00:00Z').getTime();
  const history = Array.from({ length: 28 }, (_, i) => ({
    d: new Date(today - (27 - i) * 86_400_000).toISOString().slice(0, 10),
    dc: 1000 + 3 * i,
    lx: 2,
  }));
  await boot(page, { migrated: true, fake: { patch: { 'app/profile': { history } } } });
  await screen(page, 'today');
  await openSettings(page);
  await expect(page.getByTestId('doc-forecast-line')).toContainText(/in etwa \d+(–\d+)? Monat/);
});
