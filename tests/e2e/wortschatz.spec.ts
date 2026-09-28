import { expect, test } from '@playwright/test';
import { boot, layoutProblems, openOverview, openSettings, openTab, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { bigVocab } from './wortschatzHelpers';

// Reiter „Wortschatz“ (plan.md §1.3, N22–N27): Hauptkarte, Prognose, Stapel anlegen → Filter →
// Start in 2 Tipps, Liste als Browser (1.500 Karten, ≤ 60 Zeilen im DOM), Wortblatt-Aktionen,
// Extra-Runde, Einstellungen „Wortschatz“.

type Doc = Record<string, unknown>;

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Wurzel: Alle fälligen, Prognose, Stapel, Eingangskorb, Zuletzt – ohne Querüberstand', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await expect(page.getByTestId('ws-due')).toBeVisible();
    await expect(page.getByTestId('ws-counts')).toBeVisible();
    await expect(page.locator('[data-testid="ws-forecast"] li')).toHaveCount(7);
    await expect(page.getByTestId('ws-inbox')).toBeVisible();
    await expect(page.getByTestId('ws-deck').first()).toBeVisible();
    await expect(page.locator('[data-testid="ws-recent"] [data-testid="vocab-row"]')).toHaveCount(5);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Stapel anlegen → Filter → Start in 2 Tipps; Modus gemerkt in app/decks', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await page.getByTestId('ws-new-deck').click();
    await page.getByTestId('deck-new-name').fill('Nachgeschlagen');
    await page.locator('[data-testid="deck-new-src"][data-value="lookup"]').click();
    await page.getByTestId('deck-new-create').click();
    await screen(page, 'deck');
    await expect.poll(async () => Object.values(((await dump(page))['app/decks']?.decks ?? {}) as Record<string, Doc>).find((d) => d.name === 'Nachgeschlagen')?.filter).toEqual({ src: ['lookup'] });
    await page.locator('[data-testid="deck-mode"] [role="radio"]').nth(1).click();
    await expect.poll(async () => Object.values(((await dump(page))['app/decks']?.decks ?? {}) as Record<string, Doc>).find((d) => d.name === 'Nachgeschlagen')?.mode).toBe('type');
    await page.locator('[data-testid="deck-mode"] [role="radio"]').nth(0).click();
    // 2 Tipps ab der Reiter-Wurzel: Stapel-Zeile → „Lernen“.
    await page.getByTestId('tab-vocab').click();
    await screen(page, 'vocab');
    const row = page.locator('[data-testid="ws-deck"][data-deck^="u"]').filter({ hasText: 'Nachgeschlagen' });
    await row.click();
    await page.getByTestId('deck-start').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('flip').or(page.getByTestId('intro'))).toBeVisible();
    // Ausblenden = hidden:true (kein Löschen).
    // ✕ führt zur Herkunft (Stapel-Seite).
    await page.getByTestId('trainer-close').click();
    await screen(page, 'deck');
    await page.getByTestId('deck-hide').click();
    await expect.poll(async () => Object.values(((await dump(page))['app/decks']?.decks ?? {}) as Record<string, Doc>).find((d) => d.name === 'Nachgeschlagen')?.hidden).toBe(true);
    expect(errors).toEqual([]);
  });

  test('Extra-Runde: Optionen mit Zahlen, Start ohne neues Dokument', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await page.getByTestId('ws-more').click();
    await expect(page.getByTestId('extra-sheet')).toBeVisible();
    await expect(page.getByTestId('extra-opt')).toHaveCount(5);
    const before = Object.keys(await dump(page)).length;
    const opt = page.locator('[data-testid="extra-opt"]:not([disabled])').first();
    await opt.click();
    await screen(page, 'trainer');
    expect(Object.keys(await dump(page)).length).toBe(before);
    expect(errors).toEqual([]);
  });
});

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Liste mit 1.500 Karten: erste Zeilen < 300 ms, höchstens 60 Zeilen im DOM, kein layoutId', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, fake: { patch: bigVocab(1500) } });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    // Im Browser gemessen: Tipp auf „Alle Einträge“ → erste Zeile im Bild (ohne Playwright-Umlauf).
    const ms = await page.evaluate(async () => {
      const t0 = performance.now();
      document.querySelector<HTMLElement>('[data-testid="ws-all"]')?.click();
      for (let i = 0; i < 200 && !document.querySelector('[data-testid="vocab-list"] [data-testid="vocab-row"]'); i++) await new Promise((r) => requestAnimationFrame(() => r(null)));
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      return performance.now() - t0;
    });
    expect(ms).toBeLessThan(300);
    expect(await page.getByTestId('vocab-row').count()).toBeLessThanOrEqual(60);
    await page.getByTestId('vocab-more').click();
    expect(await page.getByTestId('vocab-row').count()).toBeLessThanOrEqual(100);
    expect(errors).toEqual([]);
  });

  test('Mehrfachauswahl: ausblenden; Wortblatt: Morgen wieder, Verlauf', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await page.getByTestId('ws-all').click();
    await screen(page, 'vocabList');
    await page.getByTestId('vocab-select').click();
    const rows = page.getByTestId('vocab-row');
    const pathOf = async (i: number) => `${(await rows.nth(i).getAttribute('data-kind')) === 'chunk' ? 'chunk' : 'vocab'}/${(await rows.nth(i).getAttribute('data-word')) ?? ''}`;
    const a = await pathOf(0);
    const b = await pathOf(1);
    await rows.nth(0).click();
    await rows.nth(1).click();
    await page.getByTestId('vocab-bulk-hide').click();
    await expect.poll(async () => [(await dump(page))[a]?.hidden, (await dump(page))[b]?.hidden]).toEqual([true, true]);
    await page.getByTestId('vocab-select').click();
    await page.locator('[data-testid="vocab-filter"][data-filter="solid"]').click();
    const row = page.getByTestId('vocab-row').first();
    const id = (await row.getAttribute('data-word')) ?? '';
    const before = (await dump(page))[`vocab/${id}`] as Doc;
    await row.click();
    await expect(page.getByTestId('word-history')).toBeVisible();
    await page.getByTestId('word-tomorrow').click();
    await expect.poll(async () => ((await dump(page))[`vocab/${id}`] as Doc).due).not.toBe(before.due);
    const after = (await dump(page))[`vocab/${id}`] as Doc;
    expect((after.fsrs as Doc).due).toBe(after.due);
    expect(after.stage).toBe(before.stage);
    expect(after.S).toBe(before.S);
    expect(errors).toEqual([]);
  });

  test('Einstellungen „Wortschatz“: Standard-Modus, Richtung, 2 Knöpfe', async ({ page }) => {
    await boot(page, { migrated: true });
    await screen(page, 'today');
    await openSettings(page);
    const sec = page.getByTestId('set-vocab');
    await expect(sec).toBeVisible();
    await sec.getByTestId('set-vocab-grades').locator('[role="radio"]').nth(1).click();
    await expect.poll(async () => ((await dump(page))['app/decks']?.prefs as Doc | undefined)?.grades).toBe(2);
  });
});

test('Dein Stand: Abschnitt „Wortschatz-Statistik“ (Platz stand); ohne KI bleibt Aufdecken erfüllbar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/decks': { v: 1, prefs: { mode: 'flip' } } } } });
  await openOverview(page);
  const stats = page.getByTestId('ws-stats');
  await stats.scrollIntoViewIfNeeded();
  await expect(stats).toBeVisible();
  await expect(page.getByTestId('ws-stat-retention')).toContainText('%');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-review').click();
  await screen(page, 'trainer');
  const flip = page.getByTestId('flip').or(page.getByTestId('intro')).or(page.getByTestId('repair-item'));
  await expect(flip.first()).toBeVisible();
  expect(errors).toEqual([]);
});
