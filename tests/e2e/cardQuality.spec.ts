import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, openSettings, screen, type Lang, type Theme } from './fixtures';
import { dump } from './trainerHelpers';

// Kartenqualität (26.10.2026, Emrahs Meldung „adaptive attempts“, docs/umbau/card-quality.md): Eine schon gespeicherte Lesekarte mit freier
// Wortgruppe wird NICHT gelöscht, sondern ruht (keine Abfrage). Die KI-Stichprobe in den Einstellungen zeigt Zahl und Liste; „Doch lernen“
// ergänzt nur `lu` an der Karte (ein Schreibvorgang, alle anderen Felder bleiben).

const NOW = Date.parse('2026-09-20T21:00:00+02:00');
const DAY = 86_400_000;
const HELD = {
  word: 'adaptive attempts',
  de: 'adaptive Versuche',
  ex: 'The model was jailbroken across 15 [adaptive attempts].',
  src: 'read',
  origin: { v: 1, kind: 'read', ref: 'a-2026-09-19-1-abc123', title: 'Red teams', t: NOW - 2 * DAY },
  state: 'review',
  stage: 2,
  S: 3,
  D: 5,
  due: NOW - DAY,
  last: NOW - 3 * DAY,
  reps: 3,
  added: '2026-09-17',
};
const FIXED = { ...HELD, word: 'adaptive attacks', de: 'adaptive Angriffe', ex: 'Labs test models against [adaptive attacks].' };

async function openSample(page: Page, o: { theme?: Theme; lang?: Lang } = {}) {
  const booted = await boot(page, { migrated: true, ...o, fake: { patch: { 'vocab/adaptive-attempts': HELD, 'vocab/adaptive-attacks': FIXED } } });
  await screen(page, 'today');
  await openSettings(page);
  const sample = page.getByRole('dialog').getByTestId('ai-sample');
  await sample.scrollIntoViewIfNeeded();
  return { ...booted, sample };
}

test('ruhende Lesekarte: Zahl und Liste in der KI-Stichprobe, „Doch lernen“ ergänzt nur den Vermerk', async ({ page }) => {
  const { sample, errors } = await openSample(page);
  const row = sample.getByTestId('ai-held-units-row');
  await expect(row).toHaveAttribute('data-n', '1');
  await expect(row).toHaveText('Ruhende Lesekarten (keine feste Wendung): 1');
  await sample.getByTestId('ai-held-units-toggle').click();
  const items = sample.getByTestId('ai-held-unit');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toHaveAttribute('data-w', 'adaptive attempts');
  await expect(items.first()).toContainText('Üblich ist: adaptive attacks');
  const before = (await dump(page))['vocab/adaptive-attempts']!;
  expect(before.lu).toBeUndefined();

  const btn = items.first().getByTestId('ai-held-unit-release');
  expect((await btn.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await btn.click();
  await expect(row).toHaveAttribute('data-n', '0');
  const after = (await dump(page))['vocab/adaptive-attempts']!;
  expect(after.lu).toMatchObject({ ok: true, by: 'user' });
  expect({ ...after, lu: undefined }).toEqual({ ...before, lu: undefined });
  // Die feste Wendung war nie betroffen.
  expect((await dump(page))['vocab/adaptive-attacks']?.lu).toBeUndefined();
  expect(errors).toEqual([]);
});

for (const theme of ['dark', 'light'] as const) {
  for (const lang of ['de', 'en'] as const) {
    test(`axe · ruhende Lesekarten · ${theme} · ${lang}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const { sample } = await openSample(page, { theme, lang });
      await sample.getByTestId('ai-held-units-toggle').click();
      await expect(sample.getByTestId('ai-held-unit')).toHaveCount(1);
      if (lang === 'en') await expect(sample.getByTestId('ai-held-units-row')).toHaveText('Resting reading cards (not a fixed phrase): 1');
      await page.waitForTimeout(300);
      const res = await new AxeBuilder({ page }).include('[data-testid="ai-sample"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}
