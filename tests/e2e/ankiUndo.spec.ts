import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, openTab, screen } from './fixtures';
import { DAY, dump, planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// B4 Anki „Rückgängig“ und N35 Hör-Modus + Hörschleife (Paket B, Bereich Wortschatz/Anki).

type Doc = Record<string, unknown>;
const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken]);

test('Rückgängig: dieselbe Karte von vorn, gespeichert wird nur die neue Bewertung', async ({ page }) => {
  const { patch } = ankiPatch(3);
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(3), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } } } } });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-review').click();
  await screen(page, 'trainer');
  const flip = page.getByTestId('flip');
  const id = (await flip.getAttribute('data-card')) ?? '';
  expect(id).not.toBe('');
  await page.getByTestId('flip-show').click();
  await page.locator('[data-testid="grades"] button[data-grade="1"]').click();
  await expect(page.getByTestId('undo-bar')).toBeVisible();
  await expect(page.getByTestId('undo-bar')).toContainText(/\S/);
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('undo-bar')).toHaveCount(0);
  await expect(flip).toHaveAttribute('data-card', id);
  await expect(page.getByTestId('flip-show')).toBeVisible();
  await expect(page.getByTestId('trainer-progress')).toContainText('1');
  await page.getByTestId('flip-show').click();
  await page.locator('[data-testid="grades"] button[data-grade="3"]').click();
  await expect(page.getByTestId('undo-bar')).toBeVisible();
  // Nach 5 s festgeschrieben: genau eine Bewertung (Gut), kein „Nochmal“ – weder an der Karte noch im Protokoll.
  await expect.poll(async () => (((await dump(page))[`vocab/${id}`]?.hist as Doc[] | undefined) ?? []).length, { timeout: 15_000 }).toBe(1);
  const db = await dump(page);
  const card = db[`vocab/${id}`] as Doc;
  expect((card.hist as Doc[])[0]).toMatchObject({ x: 'flip', g: 3 });
  expect(((card.xs as Doc).flip as Doc)).toEqual({ c: 1, w: 0 });
  expect(card.lapses).toBe(0);
  expect((card.fsrs as Doc).due).toBe(card.due);
  await expect(page.getByTestId('undo-bar')).toHaveCount(0);
  await expect.poll(async () => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.id === id).map((e) => e.g)).toEqual([3]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Hör-Modus: Stapel „Hören“ spricht den Satz, getippt wird in die Lücke', async ({ page }) => {
  const { patch } = ankiPatch(3);
  const deck = { id: 'd1', name: 'Hören', order: 0, created: DAY, mode: 'listen', filter: { kinds: ['vocab'] } };
  const { errors } = await bootAt(page, { name: 'deck', id: 'd1' }, { fake: { patch: { ...patch, 'app/decks': { v: 1, decks: { d1: deck } } } } });
  await screen(page, 'deck');
  await expect(page.locator('[data-testid="deck-mode"] [role="radio"]').nth(2)).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('deck-listen-hint')).toBeVisible();
  await page.getByTestId('deck-start').click();
  await screen(page, 'trainer');
  const ex = page.getByTestId('exercise');
  await expect(ex).toHaveAttribute('data-ex', 'dictation');
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
  await expect(page.getByTestId('replay')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Hörschleife: aus der Extra-Runde, spricht von selbst, anhalten, Text zeigen, schreibt nichts', async ({ page }) => {
  test.setTimeout(60_000);
  const { patch, ids } = ankiPatch(3);
  const { errors } = await boot(page, { migrated: true, fake: { patch } });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-more').click();
  await page.getByTestId('extra-loop').click();
  await screen(page, 'listenLoop');
  // Die Schleife spricht von selbst (Text zuerst verborgen). Leere Äußerung = Freischalten am iPhone.
  await expect.poll(async () => (await spoken(page)).filter((x) => x.trim()).length, { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(page.getByTestId('loop-sentence')).toHaveCount(0);
  const done = page.getByTestId('loop-done');
  if (!(await done.isVisible())) {
    // Anhalten, Text zeigen (antippbar), weiter per Knopf bis zum Ende.
    await page.getByTestId('loop-toggle').click();
    await expect(page.getByTestId('loop-phase')).toHaveAttribute('data-phase', 'paused');
    await page.getByTestId('loop-text').click();
    await expect(page.getByTestId('loop-sentence')).toBeVisible();
    for (let i = 0; i < 10 && !(await done.isVisible()); i++) await page.getByTestId('loop-next').click();
  }
  await expect(done).toBeVisible();
  const db = await dump(page);
  for (const id of ids) expect((db[`vocab/${id}`]?.hist as Doc[] | undefined) ?? []).toEqual([]);
  expect(((db[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => ids.includes(String(e.id)))).toEqual([]);
  expect(errors).toEqual([]);
});
