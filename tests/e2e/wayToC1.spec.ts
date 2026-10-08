import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems, type Lang, type Theme } from './fixtures';
import { C1_THREE, C1_TWO, openWay } from './wayHelpers';

// „Weg zu C1“ (Lernplattform 3.0 P44/P45): Kopfzeile im Fortschritt, Blatt mit Urteil (assess@4), „Was dir noch fehlt“, K1–K7 mit Detail
// (vier Fragen), Kapitelband, Prognose erst nach 3 Checks, „Messwerte dahinter“. Leerzustand, Fehlerzustand, ohne `sample`.
// Handy 390 und Laptop, drei Modi mit axe, DE/EN. Schalter `way` per `lx:flags`.

type Dump = Record<string, Record<string, unknown>>;
type Call = { id: string | null; tier: string; cache?: unknown; input: string };
const dump = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());
const calls = (page: Page, id: string) =>
  page.evaluate(
    (tid) => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Call[] } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === tid).map((c) => ({ tier: c.tier, cache: c.cache, head: c.input.split('\n')[0] })),
    id,
  );

async function axe(page: Page): Promise<string[]> {
  // Erst nach dem Einblenden prüfen (halbe Deckkraft ergibt sonst falsche Kontrastbefunde).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await page.waitForTimeout(200);
  const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const [label, width, height] of [
  ['Handy 390', 390, 844],
  ['Laptop', 1440, 900],
] as const) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 600 });

    for (const theme of ['dark', 'dim', 'light'] as Theme[]) {
      test(`Blatt mit Urteil von Claude, Kriterien und Band · axe 0 · ${theme}`, async ({ page }) => {
        const { errors, external, sheet } = await openWay(page, { theme, fake: { patch: { 'app/c1': C1_THREE } } });
        await expect(sheet).toHaveAttribute('data-state', 'ready');
        await expect(page.getByTestId('way-verdict')).toHaveAttribute('data-source', 'claude');
        await expect(page.getByTestId('way-crit-row')).toHaveCount(7);
        await expect(page.getByTestId('way-band-seg')).toHaveCount(7);
        await expect(page.getByTestId('way-forecast')).toHaveAttribute('data-kind', 'range');
        await page.getByTestId('way-crit-row').first().locator('button').click();
        await expect(page.getByTestId('way-crit-detail')).toHaveCount(1);
        await page.getByTestId('way-more-toggle').click();
        await expect(page.getByTestId('way-checks').locator('li')).toHaveCount(3);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await axe(page)).toEqual([]);
        expect(errors).toEqual([]);
        expect(external).toEqual([]);
      });
    }

    test('Leerzustand ohne Daten: Erklärung, „Zum Lernen“, kein Urteil, kein Prozentwert', async ({ page }) => {
      const { errors, sheet } = await openWay(page, { fake: { seed: 'empty' } });
      await expect(sheet).toHaveAttribute('data-state', 'empty');
      await expect(sheet).toContainText('Dein Weg zu C1 beginnt mit dem Üben');
      await expect(page.getByTestId('way-not-measured')).toBeVisible();
      await expect(page.getByTestId('way-crit-row')).toHaveCount(0);
      await expect(sheet).not.toContainText('%');
      expect(await axe(page)).toEqual([]);
      await page.getByTestId('way-empty-cta').click();
      await expect(page.getByTestId('way-sheet')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('Verhalten (Laptop)', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const lang of ['de', 'en'] as Lang[]) {
    test(`assess@4 genau einmal (complex, ohne Zwischenspeicher); Urteil gespeichert und in der Sprache der Oberfläche · ${lang}`, async ({ page }) => {
      const { errors } = await openWay(page, { lang, fake: { patch: { 'app/c1': C1_THREE } } });
      await expect(page.getByTestId('way-status')).toBeVisible();
      expect(await calls(page, 'assess')).toEqual([{ tier: 'complex', cache: false, head: '[assess@4]' }]);
      const doc = (await dump(page))['app/assess']!;
      expect(doc).toMatchObject({ pv: 'assess@4', lang });
      const c1 = (doc.data as Record<string, unknown>).c1 as { status: string; why: string; missing: Array<{ crit: string }>; ev: string[] };
      expect(['not_yet', 'on_track']).toContain(c1.status);
      expect(c1.ev[0]).toMatch(/^c1:k[1-7]$/);
      await expect(page.getByTestId('way-why')).toHaveText(c1.why);
      await expect(page.getByTestId('way-by')).toContainText(lang === 'de' ? 'von Claude' : 'by Claude');
      // „Was dir noch fehlt“: Claudes Auswahl (nur offene Kriterien), höchstens drei, mit „Üben“.
      const rows = page.getByTestId('way-missing-row');
      expect(await rows.count()).toBeGreaterThan(0);
      expect(await rows.count()).toBeLessThanOrEqual(3);
      expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-crit')))).toEqual(c1.missing.map((m) => m.crit));
      // Laptop: zwei Spalten.
      await expect(page.getByTestId('way-col-left')).toBeVisible();
      await expect(page.getByTestId('way-col-right')).toBeVisible();
      await expect(page.getByTestId('way-sheet')).not.toContainText('% C1');
      expect(errors).toEqual([]);
    });
  }

  test('Prognose erst nach 3 Checks: mit 2 Checks „noch nicht abschätzbar“', async ({ page }) => {
    await openWay(page, { fake: { patch: { 'app/c1': C1_TWO } } });
    await expect(page.getByTestId('way-forecast')).toHaveAttribute('data-kind', 'wait');
    await expect(page.getByTestId('way-forecast')).toContainText('Noch nicht abschätzbar');
  });

  test('Fehlerzustand: rate_limited → Hinweis, feste Zählung bleibt, kein zweiter Aufruf', async ({ page }) => {
    const { errors } = await openWay(page, { fake: { sampleFail: { assess: 'rate_limited' }, patch: { 'app/c1': C1_THREE } } });
    await expect(page.getByTestId('way-error')).toBeVisible();
    await expect(page.getByTestId('way-verdict')).toHaveAttribute('data-source', 'app');
    await expect(page.getByTestId('way-fixed')).toContainText('von 7 Kriterien erreicht');
    await page.waitForTimeout(800);
    expect(await calls(page, 'assess')).toHaveLength(1);
    expect(errors.filter((e) => !e.includes('rate_limited'))).toEqual([]);
  });

  test('ohne sample: kein Knopf, feste Zählung, keine KI-Anfrage', async ({ page }) => {
    await openWay(page, { fake: { capabilities: { sample: false }, patch: { 'app/c1': C1_THREE } } });
    await expect(page.getByTestId('way-fixed')).toBeVisible();
    await expect(page.getByTestId('way-ask')).toHaveCount(0);
    await expect(page.getByTestId('way-asking')).toHaveCount(0);
    expect(await calls(page, 'assess')).toHaveLength(0);
  });

  test('„Üben“ führt zum Übungsort und schließt das Blatt', async ({ page }) => {
    await openWay(page, { fake: { patch: { 'app/c1': C1_THREE } } });
    const btn = page.getByTestId('way-practice').first();
    await expect(btn).toBeVisible();
    await btn.click();
    await expect(page.getByTestId('way-sheet')).toHaveCount(0);
    await expect(page.locator('[data-screen="overview"]')).toHaveCount(0);
  });
});
