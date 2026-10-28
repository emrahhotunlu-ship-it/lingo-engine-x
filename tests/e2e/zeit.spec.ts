import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, screen } from './fixtures';
import { nextItem } from './learnHelpers';
import { DAY, dump, forcedPatch, planPatch, TYPE_MODE } from './trainerHelpers';

// S1-ZEIT (Relaunch Stufe 1 P4): Zeit je Versuch. Eine Wörter-Übung beantworten und prüfen, dass `hist` (fk/ms/in) und
// das Tagesprotokoll (fk/in, ms wie bisher) die Messwerte tragen. Nur gespeichert, nie ausgewertet.

test.use({ viewport: { width: 1440, height: 900 } });

type Doc = Record<string, unknown>;

async function startWith(page: Page, id: string): Promise<string[]> {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), [`vocab/${id}`]: forcedPatch()[`vocab/${id}`] ?? {} } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return errors;
}

async function saved(page: Page, id: string): Promise<{ hist: Doc; log: Doc }> {
  await expect.poll(async () => ((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined)?.some((e) => e.id === id && e.ctx === 'rev') ?? false).toBe(true);
  const db = await dump(page);
  const hist = (db[`vocab/${id}`]?.hist as Doc[]).at(-1) ?? {};
  const log = (db[`log/${DAY}`]?.entries as Doc[]).find((e) => e.id === id && e.ctx === 'rev') ?? {};
  return { hist, log };
}

const isTenMs = (v: unknown): boolean => typeof v === 'number' && v >= 0 && v <= 600_000 && v % 10 === 0;

test('getippt: hist trägt fk/ms/in, das Protokoll fk/in', async ({ page }) => {
  const errors = await startWith(page, 'struggle');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'type');
  await page.waitForTimeout(400);
  await page.getByTestId('gap-input').click();
  await page.keyboard.type('to struggle', { delay: 30 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  await page.keyboard.press('Enter');
  const { hist, log } = await saved(page, 'struggle');
  expect(hist).toMatchObject({ m: 'type', in: 't' });
  expect(isTenMs(hist.fk)).toBe(true);
  expect(isTenMs(hist.ms)).toBe(true);
  // Der erste Kontakt kommt vor dem Senden.
  expect(Number(hist.fk)).toBeGreaterThan(0);
  expect(Number(hist.fk)).toBeLessThanOrEqual(Number(hist.ms));
  expect(log).toMatchObject({ k: 'v', m: 'tr-type', in: 't', fk: hist.fk });
  // `ms` im Protokoll bleibt ungerundet (gleiche Bedeutung wie bisher) und passt zu `hist.ms`.
  expect(Math.abs(Number(log.ms) - Number(hist.ms))).toBeLessThanOrEqual(5);
  expect(errors).toEqual([]);
});

test('ohne Taste eingesetzt (Diktat): in = d', async ({ page }) => {
  const errors = await startWith(page, 'struggle');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'type');
  await page.getByTestId('gap-input').click();
  // Text in einem Stück ohne Tastendruck, wie es Diktat oder eine Vorhersage einsetzt.
  await page.keyboard.insertText('to struggle');
  await expect(page.getByTestId('gap')).toContainText('struggle');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toBeVisible();
  await page.keyboard.press('Enter');
  const { hist, log } = await saved(page, 'struggle');
  expect(hist.in).toBe('d');
  expect(log.in).toBe('d');
  expect(isTenMs(hist.fk)).toBe(true);
  expect(errors).toEqual([]);
});

test('Auswahl: in = c, fk bis zum Antippen', async ({ page }) => {
  const errors = await startWith(page, 'deserve');
  const ex = await page.getByTestId('exercise').getAttribute('data-ex');
  expect(['mc_en', 'mc_de', 'ctx_mc', 'match']).toContain(ex);
  await page.waitForTimeout(300);
  await page.getByTestId('choice').first().click();
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  await page.keyboard.press('Enter');
  const { hist, log } = await saved(page, 'deserve');
  expect(hist.in).toBe('c');
  expect(log.in).toBe('c');
  expect(Number(hist.fk)).toBeGreaterThan(0);
  expect(isTenMs(hist.fk)).toBe(true);
  expect(errors).toEqual([]);
});

// ------------------------------------------------------------------ Grammatik (GrammarItem)

const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const topicDoc = (topic: string, errors: Doc[]): Doc => ({ id: topic, p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors });
const grammarLog = async (page: Page): Promise<Doc[]> => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g' && e.topic === 'pres-simple-cont');

test('Grammatik: Fehlersatz verbessern schreibt fk/in ins Protokoll', async ({ page }) => {
  const err = { q: 'She don’t like meetings.', given: 'She don’t like meetings.', ans: 'She doesn’t like meetings.', t: OLD, due: OLD, box: 0, src: 'seed' };
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { fake: { patch: { 'grammar/pres-simple-cont': topicDoc('pres-simple-cont', [err]) } } });
  const item = page.getByTestId('gr-item');
  await expect(item).toBeVisible();
  // Die Aufgabe startet ihre Uhr kurz nach dem ersten Zeigen noch einmal (wie `ms`); erst danach tippen.
  await page.waitForTimeout(1500);
  if (await item.getByTestId('correct-input').isVisible().catch(() => false)) {
    await item.getByTestId('correct-input').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('She doesn’t like meetings.', { delay: 10 });
  } else {
    await page.getByTestId('gap-input').focus();
    await page.keyboard.type('doesn’t', { delay: 10 });
  }
  await page.getByTestId('check').click();
  await expect(item.getByTestId('verdict')).toBeVisible();
  await nextItem(page);
  await expect.poll(async () => (await grammarLog(page)).length, { timeout: 25_000 }).toBeGreaterThan(0);
  const e = (await grammarLog(page)).at(-1) ?? {};
  expect(e).toMatchObject({ k: 'g', m: 'gr-correct', in: 't' });
  expect(isTenMs(e.fk)).toBe(true);
  // Erster Kontakt nie nach dem Prüfen (`ms` im Protokoll ungerundet).
  expect(Number(e.fk)).toBeLessThanOrEqual(Number(e.ms) + 5);
  expect(errors).toEqual([]);
});
