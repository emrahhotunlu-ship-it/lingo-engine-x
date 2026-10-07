import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { dump, DAY } from './trainerHelpers';
import { nextItem } from './learnHelpers';

// err (Fehler finden), P17: Handy mit Korrektur-Chips (p ≤ 0,7) und mit getippter Korrektur ≤ 3 Wörter (p > 0,7), Laptop mit Tastatur.
// Die Aufgabe kommt über einen Fehlersatz mit `cid` (Pilot `err-9001`: „looking forward to hear“, Fundort Wort 6, Korrektur „hearing“).

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const RECENT = Date.parse('2026-09-20T08:00:00+02:00');
const ERR_ERROR: Doc = { q: "I'm really looking forward to hear from you.", given: '', ans: "I'm really looking forward to hearing from you.", t: OLD, due: OLD, box: 0, src: 'seed', cid: 'err-9001', pat: 'gi.prep-ing', pts: [0, 2] };
const topicDoc = (p: number, last: number): Doc => ({ id: 'gerund-inf', p, anchor: p, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p }], errors: [ERR_ERROR] });

const start = (page: Page, p: number, last: number) => bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'err' }, fake: { patch: { 'grammar/gerund-inf': topicDoc(p, last) } } });
const logOf = async (page: Page): Promise<Doc[]> => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g');
const entry = async (page: Page): Promise<Doc> => {
  await expect.poll(async () => (await logOf(page)).some((e) => e.cid === 'err-9001')).toBe(true);
  return (await logOf(page)).find((e) => e.cid === 'err-9001') as Doc;
};

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('jedes Wort ist einzeln treffbar (≥ 44 px), vor dem Prüfen kein Nachschlagen, danach wieder', async ({ page }) => {
    const { errors } = await start(page, 0.5, OLD);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('c1x-err')).toHaveAttribute('data-err-mode', 'tap');
    const words = item.getByTestId('spot-word');
    const n = await words.count();
    expect(n).toBeGreaterThanOrEqual(6);
    for (let i = 0; i < n; i++) {
      const box = await words.nth(i).boundingBox();
      expect(box?.height ?? 0, `Wort ${i} Höhe`).toBeGreaterThanOrEqual(43.5);
      expect(box?.width ?? 0, `Wort ${i} Breite`).toBeGreaterThanOrEqual(43.5);
    }
    // Ein Tipp wählt, öffnet aber nie das Nachschlagen.
    await words.nth(5).click();
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await expect(words.nth(5)).toHaveAttribute('data-selected', 'true');
    // Nach dem Prüfen öffnet ein Wort das Nachschlagen.
    await item.getByTestId('chip').first().click();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toBeVisible();
    await item.getByRole('button', { name: 'forward' }).first().click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('p ≤ 0,7: Wort antippen, Chip wählen → 2 von 2; Chips zählen nicht als freier Abruf', async ({ page }) => {
    const { errors } = await start(page, 0.5, OLD);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('chip')).toHaveCount(0);
    await expect(page.getByTestId('check')).toBeDisabled();
    await item.getByTestId('spot-word').nth(5).click();
    await expect(item.getByTestId('chip')).toHaveCount(3);
    // „Doch nicht“ nimmt die Wahl zurück.
    await item.getByTestId('err-undo').click();
    await expect(item.getByTestId('chip')).toHaveCount(0);
    await item.getByTestId('spot-word').nth(5).click();
    await item.getByTestId('chip').filter({ hasText: /^hearing$/ }).click();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(item.getByTestId('verdict-sub')).toContainText('2 von 2');
    await nextItem(page);
    const e = await entry(page);
    expect(e).toMatchObject({ ok: true, pts: [2, 2], c1k: 'err' });
    expect(e.free).toBeFalsy();
    expect(errors).toEqual([]);
  });

  test('p > 0,7: Wort antippen, Korrektur höchstens 3 Wörter tippen; zählt als freier Abruf', async ({ page }) => {
    const { errors } = await start(page, 0.95, RECENT);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('c1x-err')).toHaveAttribute('data-err-mode', 'tapfix');
    await expect(item.getByTestId('chip')).toHaveCount(0);
    await item.getByTestId('spot-word').nth(5).click();
    await item.getByTestId('err-fix').fill('is hearing from now');
    await expect(item.getByTestId('word-counter-fix')).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('check')).toBeDisabled();
    await item.getByTestId('err-fix').fill('hearing');
    await expect(page.getByTestId('check')).toBeEnabled();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await nextItem(page);
    const e = await entry(page);
    expect(e).toMatchObject({ ok: true, pts: [2, 2], c1k: 'err', free: true });
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Taste N meldet „Kein Fehler“ (bei einem Satz mit Fehler: übersehen, 0 von 2)', async ({ page }) => {
    const { errors } = await start(page, 0.5, OLD);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('c1x-err')).toHaveAttribute('data-err-mode', 'desk');
    await page.keyboard.press('n');
    await expect(item.getByTestId('verdict')).toBeVisible();
    await expect(item.getByTestId('verdict-sub')).toContainText('0 von 2');
    expect(errors).toEqual([]);
  });

  test('mit ←/→ zum Wort, Leertaste wählt, Korrektur tippen, Enter prüft', async ({ page }) => {
    const { errors } = await start(page, 0.5, OLD);
    const item = page.getByTestId('gr-item');
    await item.getByTestId('spot-word').first().focus();
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await expect(item.getByTestId('spot-word').nth(5)).toHaveAttribute('data-selected', 'true');
    await item.getByTestId('err-fix').fill('hearing');
    await page.keyboard.press('Enter');
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    expect(errors).toEqual([]);
  });
});
