import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, openApplyFolds, openTab } from './fixtures';
import { dump, DAY } from './trainerHelpers';
import { nextItem } from './learnHelpers';

// kwt (Umformen), P16: Handy mit Bausteinen (p ≤ 0,7) und mit Teil B getippt (p > 0,7); Laptop mit Zähler und leuchtendem Schlüsselwort.
// Die Aufgabe kommt über einen Fehlersatz mit `cid` (Pilot `kwt-9001`: „is said to be“).

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const RECENT = Date.parse('2026-09-20T08:00:00+02:00');
const KWT_ERROR: Doc = { q: 'The company ___ planning to move its headquarters.', given: '', ans: 'is said to be', t: OLD, due: OLD, box: 0, src: 'seed', cid: 'kwt-9001', pat: 'pp.personal', pts: [0, 2] };

const topicDoc = (p: number, last: number): Doc => ({ id: 'passive-plus', p, anchor: p, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p }], errors: [KWT_ERROR] });

async function start(page: Page, p: number, last: number) {
  return bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'kwt' }, fake: { patch: { 'grammar/passive-plus': topicDoc(p, last) } } });
}
const tile = (page: Page, text: string) => page.locator(`[data-testid="tile-pool"] [data-testid="tile"][data-tile="${text}"]`).first();
const logOf = async (page: Page): Promise<Doc[]> => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g');

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('p ≤ 0,7: Bausteine legen, ohne Tastatur lösbar; Plätze verraten die Länge nicht; Prüfen erst bei 3–6 Wörtern mit Schlüsselwort', async ({ page }) => {
    const { errors } = await start(page, 0.5, OLD);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('c1x-kwt')).toHaveAttribute('data-kwt-mode', 'tiles');
    await expect(item.getByTestId('gap-input')).toHaveCount(0);
    await expect(item.getByTestId('tile-slot')).toHaveCount(1);
    await expect(page.getByTestId('check')).toBeDisabled();
    await tile(page, 'is').click();
    await expect(item.getByTestId('tile-slot')).toHaveCount(1);
    await tile(page, 'to').click();
    await tile(page, 'be').click();
    // 3 Wörter, aber ohne Schlüsselwort: noch nicht prüfbar.
    await expect(page.getByTestId('word-counter')).toHaveAttribute('data-n', '3');
    await expect(page.getByTestId('check')).toBeDisabled();
    // Ein Wort zurücknehmen (2 Wörter): weiter nicht prüfbar; Schlüsselwort dazu: 3 Wörter mit Schlüsselwort, prüfbar.
    await page.locator('[data-testid="tile-line"] [data-testid="tile"]').nth(2).click();
    await expect(page.getByTestId('word-counter')).toHaveAttribute('data-n', '2');
    await expect(page.getByTestId('check')).toBeDisabled();
    await tile(page, 'SAID').click();
    await expect(page.getByTestId('check')).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test('p ≤ 0,7: richtig gelegt → 2 von 2, Buchung `free: false` (Bausteine zählen nicht als freier Abruf)', async ({ page }) => {
    const { errors } = await start(page, 0.5, OLD);
    const item = page.getByTestId('gr-item');
    await tile(page, 'is').click();
    await tile(page, 'SAID').click();
    await tile(page, 'to').click();
    await tile(page, 'be').click();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(item.getByTestId('verdict-sub')).toContainText('2 von 2');
    await nextItem(page);
    await expect.poll(async () => (await logOf(page)).some((e) => e.cid === 'kwt-9001')).toBe(true);
    const e = (await logOf(page)).find((x) => x.cid === 'kwt-9001') as Doc;
    expect(e).toMatchObject({ ok: true, pts: [2, 2], c1k: 'kwt' });
    expect(e.free).toBeFalsy();
    expect(errors).toEqual([]);
  });

  test('p > 0,7: Teil A aus Bausteinen, Teil B höchstens 3 Wörter getippt', async ({ page }) => {
    const { errors } = await start(page, 0.95, RECENT);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('c1x-kwt')).toHaveAttribute('data-kwt-mode', 'part');
    // Teil B („to be“) steht nicht im Vorrat.
    await expect(page.locator('[data-testid="tile-pool"] [data-testid="tile"][data-tile="to"]')).toHaveCount(0);
    await tile(page, 'is').click();
    await tile(page, 'SAID').click();
    await page.getByTestId('gap-input').focus();
    await page.keyboard.type('to be then now', { delay: 10 });
    // Vier Wörter in Teil B: nicht prüfbar.
    await expect(item.getByTestId('word-counter-b')).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('check')).toBeDisabled();
    for (let i = 0; i < ' then now'.length; i++) await page.keyboard.press('Backspace');
    await expect(item.getByTestId('word-counter-b')).toHaveAttribute('data-ok', 'true');
    await expect(page.getByTestId('check')).toBeEnabled();
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await nextItem(page);
    await expect.poll(async () => (await logOf(page)).some((e) => e.cid === 'kwt-9001')).toBe(true);
    const e = (await logOf(page)).find((x) => x.cid === 'kwt-9001') as Doc;
    expect(e).toMatchObject({ ok: true, pts: [2, 2], c1k: 'kwt', free: true });
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Zähler und Schlüsselwort leuchten live', async ({ page }) => {
    const { errors } = await start(page, 0.5, OLD);
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('c1x-kwt')).toHaveAttribute('data-kwt-mode', 'desk');
    await expect(item.getByTestId('kwt-key')).toHaveAttribute('data-found', 'false');
    await page.getByTestId('gap-input').focus();
    await page.keyboard.type('is said', { delay: 10 });
    await expect(page.getByTestId('word-counter')).toHaveAttribute('data-n', '2');
    await expect(item.getByTestId('kwt-key')).toHaveAttribute('data-found', 'true');
    // SAYS statt SAID leuchtet nicht.
    await page.keyboard.press('Control+A');
    await page.keyboard.type('is says to be', { delay: 10 });
    await expect(item.getByTestId('kwt-key')).toHaveAttribute('data-found', 'false');
    expect(errors).toEqual([]);
  });
});

test.describe('Anwenden', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('die Kachel „Satz-Umformung“ startet eine kwt-Runde', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, localStorage: { 'lx:flags': 'kwt' }, fake: { patch: { 'grammar/passive-plus': { ...topicDoc(0.5, OLD), errors: [], pats: { 'pp.personal': { n: 4, c: 2, last: OLD, h: 0, r: 1, k: 1, dd: [], i: '2026-09-01' } } } } } });
    await openTab(page, 'apply');
    await openApplyFolds(page);
    await page.getByTestId('training-transform').click();
    await expect(page.getByTestId('gr-item')).toHaveAttribute('data-c1x', 'kwt');
    expect(errors).toEqual([]);
  });
});
