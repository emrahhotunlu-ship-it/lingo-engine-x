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

  test('Wurzel: Zielkarte, Wiederholen, Neue Wörter heute, drei Stapel, Alle Stapel (Prognose, Eingangskorb, Zuletzt) – ohne Querüberstand', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    // Zielkarte: eine große Zahl „X von 8.000“, Balken mit C1-Marke, Tempo-Zeile.
    await expect(page.getByTestId('ws-goal')).toBeVisible();
    await expect(page.getByTestId('ws-goal-now')).toContainText('von 8.000');
    await expect(page.getByTestId('ws-goal-bar')).toContainText('4.500');
    await expect(page.getByTestId('ws-goal-pace')).toBeVisible();
    // Wiederholen-Karte: ein Hauptknopf mit Zahl, Modus als Textknopf.
    await expect(page.getByTestId('ws-due')).toBeVisible();
    await expect(page.getByTestId('ws-review')).toContainText('Wiederholen');
    await expect(page.getByTestId('ws-mode-open')).toContainText('Modus: Automatisch');
    await expect(page.getByTestId('ws-new-left')).toBeVisible();
    // Das Pluszeichen sitzt als Symbolknopf in der Titelzeile.
    await expect(page.getByTestId('vocab-add')).toHaveAttribute('aria-label', 'Wort hinzufügen');
    await expect(page.getByTestId('ws-all')).toBeVisible();
    await expect(page.getByTestId('ws-atlas')).toBeVisible();
    // Höchstens drei Stapel im Hub; der Rest steht unter „Alle Stapel“.
    expect(await page.locator('[data-testid="ws-decks-main"] li').count()).toBeLessThanOrEqual(4);
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('ws-decks-all').click();
    await expect(page.getByTestId('decks-sheet')).toBeVisible();
    await expect(page.locator('[data-testid="ws-forecast"] li')).toHaveCount(7);
    await expect(page.getByTestId('ws-inbox')).toBeVisible();
    await expect(page.getByTestId('ws-deck').first()).toBeVisible();
    await expect(page.locator('[data-testid="ws-recent"] [data-testid="vocab-row"]')).toHaveCount(5);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Stapel anlegen → Filter → Start in 2 Tipps; Modus gemerkt in app/decks', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await page.getByTestId('ws-decks-all').click();
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
    // Der eigene Stapel steht als dritter Stapel direkt im Hub.
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
    // Wörter: 6 Zeilen mit Zahl und Grund; dazu Grammatik, Anwenden, Sprechen.
    await expect(page.locator('[data-testid="extra-group-words"] [data-testid="extra-opt"]')).toHaveCount(6);
    await expect(page.locator('[data-testid="extra-group-words"] [data-testid="extra-opt"]').first()).toContainText('neue Wörter');
    await expect(page.locator('[data-testid="extra-group-grammar"] [data-testid="extra-opt"]')).toHaveCount(2);
    await expect(page.locator('[data-testid="extra-group-speak"] [data-testid="extra-opt"]')).toHaveCount(1);
    await expect(page.locator('[data-testid="extra-group-apply"] [data-testid="extra-opt"]').first()).toBeVisible();
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
  // Platz `stand` liegt im Reiter „Statistik“ von „Dein Stand“ (Neubau plan.md §1.3).
  await openOverview(page);
  await page.getByTestId('tab-words').click();
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

test('Atlas: sieben Bänder, Band aufklappen zeigt Einträge mit Stand; schreibt nichts; ohne Überstand', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-atlas').click();
  await expect(page.getByTestId('atlas')).toBeVisible();
  await expect(page.getByTestId('atlas-band')).toHaveCount(7);
  await expect(page.getByTestId('atlas-total')).toContainText('von');
  await page.getByTestId('atlas-band-toggle').first().click();
  await expect(page.getByTestId('atlas-entry').first()).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Atlas: Wortliste nach Häufigkeit, Suche, „Als Karte“ legt eine Karte mit Beispielsatz an', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-atlas').click();
  await expect(page.getByTestId('atlas-fband')).toHaveCount(4);
  await page.getByTestId('atlas-search').fill('monopol');
  const hit = page.getByTestId('atlas-hits').getByTestId('atlas-word').first();
  await expect(hit).toBeVisible();
  await hit.getByTestId('atlas-add').click();
  await expect.poll(async () => Object.keys(await dump(page)).filter((k) => k === 'vocab/monopoly').length).toBe(1);
  const doc = (await dump(page))['vocab/monopoly'] as Doc;
  expect(String(doc.ex)).toMatch(/\[[^\]]+\]/);
  expect(doc.src).toBe('pack');
  await expect(hit).toHaveAttribute('data-have', 'true');
  await page.getByTestId('atlas-search').fill('');
  await page.getByTestId('atlas-fband-toggle').first().click();
  await expect(page.getByTestId('atlas-word').first()).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Atlas-Sperre: ab 4.500 Karten legt „Als Karte“ nichts an und sagt es ruhig', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: bigVocab(4500) } });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-atlas').click();
  await expect(page.getByTestId('atlas-cap')).toHaveAttribute('data-state', 'full');
  await page.getByTestId('atlas-search').fill('monopol');
  const before = Object.keys(await dump(page)).length;
  await page.getByTestId('atlas-hits').getByTestId('atlas-add').first().click();
  await expect(page.getByTestId('atlas-hits').getByTestId('atlas-word').first()).toHaveAttribute('data-have', 'false');
  expect(Object.keys(await dump(page)).length).toBe(before);
  expect(errors).toEqual([]);
});

test('Atlas: je Tag nur so viele neue Karten, wie die Kapazitätsregel zulässt, dann „heute genug“', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-atlas').click();
  await page.getByTestId('atlas-search').fill('con');
  const added = async () =>
    Object.values(await dump(page)).filter((d) => {
      const ref = (d.origin as { ref?: unknown } | undefined)?.ref;
      return typeof ref === 'string' && ref.startsWith('atlas/');
    }).length;
  for (let i = 0; i < 7 && (await page.getByTestId('atlas-cap').count()) === 0; i++) {
    const n = await added();
    await page.getByTestId('atlas-hits').getByTestId('atlas-add').first().click();
    await expect.poll(added).toBe(n + 1);
  }
  await expect(page.getByTestId('atlas-cap')).toHaveAttribute('data-state', 'enough');
  const n = await added();
  expect(n).toBeGreaterThanOrEqual(2);
  expect(n).toBeLessThanOrEqual(5);
  await page.getByTestId('atlas-hits').getByTestId('atlas-add').first().click();
  expect(await added()).toBe(n);
  expect(errors).toEqual([]);
});
