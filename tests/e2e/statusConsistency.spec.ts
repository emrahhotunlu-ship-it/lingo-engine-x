import { expect, test, type Page } from '@playwright/test';
import { boot, openOverview, openTab, screen } from './fixtures';

// Paket ST: Liste, Wortblatt, Übungsbildschirm und Wort-Hub (Zahlen) zeigen für dieselbe Karte denselben Zustand und denselben Beleg.
// Seed-Daten, Desktop 1280 (Hub/Statistik) und Handy 390 (Liste → Wortblatt → Übung).

const STATES = ['new', 'learning', 'wobbly', 'safe', 'firm'] as const;
const LABEL: Record<(typeof STATES)[number], string> = { new: 'Neu', learning: 'Lernt', wobbly: 'Wackelt', safe: 'Sicher', firm: 'Fest' };

async function openList(page: Page): Promise<void> {
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-all').click();
  await screen(page, 'vocabList');
}

async function setFilter(page: Page, f: string): Promise<number> {
  await page.locator(`[data-testid="vocab-filter"][data-filter="${f}"]`).click();
  const txt = (await page.getByTestId('vocab-count').textContent()) ?? '';
  return Number(/^\s*([\d.]+)/.exec(txt)?.[1]?.replace('.', '') ?? '0');
}

test('Liste: Filter und Zeilen tragen denselben Zustand; die fünf Zustände ergeben alle Karten', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await openList(page);
  const counts: Record<string, number> = {};
  for (const s of STATES) counts[s] = await setFilter(page, s);
  const total = await setFilter(page, 'all');
  expect(STATES.reduce((a, s) => a + counts[s]!, 0)).toBe(total);

  // Jede sichtbare Zeile eines Filters trägt genau diesen Zustand.
  for (const s of STATES) {
    if (!counts[s]) continue;
    await setFilter(page, s);
    const states = await page.getByTestId('vocab-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
    expect(new Set(states)).toEqual(new Set([s]));
    // Das Zustandswort in der Zeile heißt wie im Filter.
    await expect(page.getByTestId('vocab-row-state').first()).toHaveText(LABEL[s]);
  }

  expect(errors).toEqual([]);
});

test('Wort-Hub: die Zahlen je Zustand sind die Zahlen der Liste; Behaltensquote nennt „frei abgerufen“', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { errors } = await boot(page, { migrated: true });
  await openList(page);
  const counts: Record<string, number> = {};
  for (const s of STATES) counts[s] = await setFilter(page, s);

  await openOverview(page);
  await page.getByTestId('tab-words').click();
  await page.getByTestId('measures-words').click();
  const dl = page.getByTestId('ws-stat-states');
  await dl.scrollIntoViewIfNeeded();
  for (const s of STATES) {
    const dd = dl.locator('div', { has: page.getByText(LABEL[s], { exact: true }) }).locator('dd');
    await expect(dd).toHaveText(String(counts[s]));
  }
  await expect(page.getByTestId('ws-stat-active')).toContainText(String(counts.firm));
  await expect(page.getByText('Frei abgerufen (28 Tage)')).toBeVisible();
  expect(errors).toEqual([]);
});

// Wortblatt und Übung: je Zustand eine Karte, die es in den Seed-Daten gibt (Neu ausgenommen: die Übung beginnt mit der Einführung).
for (const s of ['learning', 'wobbly', 'safe', 'firm'] as const) {
  test(`Liste → Wortblatt → Übung: Zustand „${LABEL[s]}“ und Beleg sind überall gleich`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { errors } = await boot(page, { migrated: true });
    await openList(page);
    const n = await setFilter(page, s);
    test.skip(n === 0, `keine Karte im Zustand ${s} in den Seed-Daten`);
    const row = page.getByTestId('vocab-row').first();
    const detail = (await row.getByTestId('vocab-row-detail').textContent())?.trim() ?? '';
    expect(detail.length).toBeGreaterThan(0);
    await row.click();
    const sheet = page.getByTestId('word-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('word-status')).toHaveAttribute('data-state', s);
    await expect(sheet.getByTestId('word-status-word')).toHaveText(LABEL[s]);
    await expect(sheet.getByTestId('word-status-detail')).toHaveText(detail);
    // Messwerte stehen eingeklappt: die Stufe ist nicht sichtbar, solange die Aufklappzeile zu ist.
    await expect(sheet.getByTestId('word-raw-stage')).toBeHidden();
    await sheet.getByTestId('word-practice').click();
    await screen(page, 'trainer');
    const status = page.getByTestId('status').first();
    await expect(status).toBeVisible();
    await expect(status).toHaveAttribute('data-state', s);
    await expect(status.getByTestId('status-detail')).toHaveText(detail);
    expect(errors).toEqual([]);
  });
}
