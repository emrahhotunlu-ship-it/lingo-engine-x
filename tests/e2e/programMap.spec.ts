import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen } from './fixtures';
import { openAllChapters } from './learnHelpers';

// Programmkarte „Dein Weg zu C1“ und Kapitelblatt (Lernplattform 3.0 P32): 7 Stationen, aktuelles Kapitel mit Ziel, kein Querscrollen bei 360 px,
// Zahlen gleich dem Lernpfad, „in Vorbereitung“ für Kapitel ohne Inhalte, axe 0. Schalter `program` per `lx:flags`.

const start = async (page: Page, flags = 'program') => {
  const booted = await boot(page, { migrated: true, localStorage: { 'lx:flags': flags } });
  await screen(page, 'today');
  await openTab(page, 'learn');
  return booted;
};

test.describe('Handy 360', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('Route mit 7 Stationen, aktuelles Kapitel offen mit Ziel, Zahl „Muster sicher“, kein Querscrollen', async ({ page }) => {
    const { errors } = await start(page);
    const map = page.getByTestId('program-map');
    await expect(map).toBeVisible();
    await expect(map.getByTestId('program-chapter')).toHaveCount(7);
    await expect(map.getByTestId('program-here')).toHaveCount(1);
    const goal = map.getByTestId('program-goal');
    await expect(goal).toHaveCount(1);
    await expect(goal).toContainText('Abgeschlossen heißt');
    await expect(goal.getByTestId('program-goal')).toHaveCount(0);
    const here = map.locator('[data-here="true"]');
    await expect(here.getByTestId('program-pats')).toHaveAttribute('data-total', /^[1-9]\d*$/);
    expect(await layoutProblems(page)).toEqual([]);
    const res = await new AxeBuilder({ page }).include('[data-testid="program-map"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Kapitelblatt: Ziel, Themen mit Ring, Prüfungsfokus, Lehrer-Satz zum Kopieren; Schließen', async ({ page }) => {
    const { errors } = await start(page);
    await page.getByTestId('program-more').click();
    const sheet = page.getByTestId('chapter-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('chapter-goal')).not.toBeEmpty();
    expect(await sheet.getByTestId('chapter-topic').count()).toBeGreaterThanOrEqual(5);
    await expect(sheet.getByTestId('chapter-exam')).not.toBeEmpty();
    await expect(sheet.locator('textarea')).toHaveValue(/^This month I'm working on /);
    await expect(sheet.getByTestId('chapter-note-copy')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chapter-sheet')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Kapitel 5 hat alle Themen mit Inhalten (kein „Kommt bald“ mehr); Zahlen gleich dem Lernpfad', async ({ page }) => {
    const { errors } = await start(page);
    await page.locator('[data-testid="program-chapter"][data-chapter="k5"] [data-testid="program-chapter-open"]').click();
    const sheet = page.getByTestId('chapter-sheet');
    await expect(sheet).toHaveAttribute('data-chapter', 'k5');
    await expect(sheet.locator('[data-testid="chapter-topic"][data-exists="false"]')).toHaveCount(0);
    await page.keyboard.press('Escape');

    // Invariante: Muster sicher je Kapitel = Summe der Themenzeilen des Lernpfads.
    await openAllChapters(page);
    for (const id of ['k1', 'k4', 'k6']) {
      const prog = page.locator(`[data-testid="program-chapter"][data-chapter="${id}"] [data-testid="program-pats"]`);
      const rows = await page.locator(`[data-testid="chapter"][data-chapter="${id}"] [data-testid="topic-pats"]`).evaluateAll((els) => els.map((e) => [Number(e.getAttribute('data-safe')), Number(e.getAttribute('data-total'))] as const));
      expect(rows.length).toBeGreaterThan(0);
      await expect(prog).toHaveAttribute('data-total', String(rows.reduce((s, r) => s + r[1], 0)));
      await expect(prog).toHaveAttribute('data-safe', String(rows.reduce((s, r) => s + r[0], 0)));
    }
    expect(errors).toEqual([]);
  });

  test('ohne Schalter erscheint die Karte nicht', async ({ page }) => {
    await start(page, 'kwt');
    await expect(page.getByTestId('learn-hub')).toBeVisible();
    await expect(page.getByTestId('program-map')).toHaveCount(0);
  });
});

test.describe('Laptop 1280', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('waagerechte Leiste mit 7 Stationen, Themen des gewählten Kapitels darunter, Wahl wechselt', async ({ page }) => {
    const { errors } = await start(page);
    const map = page.getByTestId('program-map');
    await expect(map.getByTestId('program-chapter')).toHaveCount(7);
    await expect(map.getByTestId('program-detail')).toHaveAttribute('data-chapter', 'k1');
    expect(await map.getByTestId('program-topic').count()).toBeGreaterThanOrEqual(5);
    await map.locator('[data-testid="program-chapter"][data-chapter="k5"] [data-testid="program-chapter-open"]').click();
    const detail = map.getByTestId('program-detail');
    await expect(detail).toHaveAttribute('data-chapter', 'k5');
    await expect(detail.locator('[data-testid="program-topic"][data-exists="false"]')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);
    const res = await new AxeBuilder({ page }).include('[data-testid="program-map"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
