import { expect, test, type Page } from '@playwright/test';
import { boot, openEntry, screen } from './fixtures';
import { orderSolution } from './learnHelpers';
import { TOUR, answerOnly, dump, expected, forcedPatch, planPatch, tourPatch } from './trainerHelpers';

// Einheitliche Hilfen in jeder Übung (Emrah 02.10.2026): Tipp (Stufe 1 Wortart und Bedeutung/Erklärung, Stufe 2
// erster Buchstabe bzw. eine falsche Option weniger), „Mehr Infos" nach der Antwort, deutsche Übersetzung des
// Beispielsatzes per Knopf (einmal von Claude, dann gespeichert), deutsche Bedeutung nach der Antwort.

type Doc = Record<string, unknown>;

async function open(page: Page, patch: Record<string, Doc>, ex: string) {
  const { errors } = await boot(page, { migrated: true, fake: { patch } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', ex);
  return errors;
}

const forced = (): Record<string, Doc> => ({ ...forcedPatch(), 'app/profile': { ...planPatch(1), autoNext: false } });

test('Auswahl (mc_en): Tipp zeigt die englische Erklärung (nie die deutsche Lösung), Stufe 2 streicht eine falsche Option, zählt als Hilfe', async ({ page }) => {
  const errors = await open(page, forced(), 'mc_en');
  const deRaw = ((await dump(page))['vocab/deserve'] ?? {}).de;
  const de = typeof deRaw === 'string' ? deRaw : '';
  await expect(page.getByTestId('choice')).toHaveCount(4);
  await expect(page.getByTestId('tip-info')).toHaveCount(0);
  const hint = page.getByTestId('hint');
  await expect(hint).toBeVisible();
  await hint.click();
  const info = page.getByTestId('tip-info');
  await expect(info).toBeVisible();
  if (de) await expect(info).not.toContainText(de);
  await expect(hint).toHaveAttribute('data-level', '1');
  await hint.click();
  await expect(page.getByTestId('choice')).toHaveCount(3);
  await expect(hint).toHaveCount(0);
  // Richtige Option wählen: mit Hilfe höchstens „Schwer“.
  const answer = expected('mc_en', 'deserve', null, 'vocab', 'de');
  const labels = await page.getByTestId('choice').allInnerTexts();
  const idx = labels.findIndex((l) => l.replace(/^\d+\s*/, '').trim() === answer);
  expect(idx).toBeGreaterThanOrEqual(0);
  await page.getByTestId('choice').nth(idx).click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  expect(Number(await page.getByTestId('due-in').getAttribute('data-grade'))).toBeLessThanOrEqual(2);
  // Nach der Antwort: deutsche Bedeutung und „Mehr Infos“.
  if (de) await expect(page.getByTestId('meaning')).toContainText(de);
  await expect(page.getByTestId('more-info-btn')).toBeVisible();
  await expect(page.getByTestId('more-info-body')).toHaveCount(0);
  await page.getByTestId('more-info-btn').click();
  await expect(page.getByTestId('more-info-body')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Tipp je Übungsart: Diktat Stufe 1; Tempo ohne Tipp; Wochen-Check-Regel bleibt (noHelp)', async ({ page }) => {
  const i = TOUR.findIndex((t) => t.ex === 'dictation');
  expect(i).toBeGreaterThanOrEqual(0);
  // Die Rundgang-Karten sind in dieser Reihenfolge fällig: bis zum Diktat beantworten.
  await boot(page, { migrated: true, fake: { patch: tourPatch() } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  for (let n = 0; n < TOUR.length; n++) {
    const ex = (await page.getByTestId('exercise').getAttribute('data-ex')) ?? '';
    if (ex === 'dictation') {
      await expect(page.getByTestId('hint')).toBeVisible();
      await page.getByTestId('hint').click();
      await expect(page.getByTestId('tip-info')).toBeVisible();
      await expect(page.getByTestId('hint')).toHaveCount(0);
    }
    if (ex === 'speed') await expect(page.getByTestId('hint')).toHaveCount(0);
    await answerOnly(page);
    await page.getByTestId('next').click();
    await expect(page.locator('[data-testid="result"]')).toHaveCount(0);
    if (ex === 'speed' || n === TOUR.length - 1) break;
  }
});

test('Beispielsatz: „Deutsch“ übersetzt einmal per Claude, zeigt es und speichert es an der Karte', async ({ page }) => {
  await open(page, forced(), 'mc_en');
  const answer = expected('mc_en', 'deserve', null, 'vocab', 'de');
  const labels = await page.getByTestId('choice').allInnerTexts();
  await page.getByTestId('choice').nth(labels.findIndex((l) => l.replace(/^\d+\s*/, '').trim() === answer)).click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  const btn = page.getByTestId('example-trans-btn').first();
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByTestId('example-trans-text').first()).toBeVisible();
  const doc = (await dump(page))['vocab/deserve'];
  expect(Object.keys((doc?.exDe as Doc | undefined) ?? {}).length).toBeGreaterThanOrEqual(1);
});

// ------------------------------------------------------------------ Satzbau (Emrah 02.10.2026)


const ORDER_PLAN = { d: '2026-09-20', v: 1, ids: ['order', 'cloze', 'gram'], why: [[['whyRotation']], [['whyRotation']], [['whyRotation']]], duty: ['ch:order'], goal: { review: 0, ch: 6 }, lesson: null, at: 1 };

async function openOrder(page: Page) {
  const booted = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { plan: ORDER_PLAN } } } });
  await screen(page, 'today');
  await openEntry(page, 'hub-drill-order');
  await expect(page.getByTestId('drill')).toHaveAttribute('data-kind', 'order');
  await expect(page.getByTestId('drill-item')).toBeVisible();
  return booted;
}

test('Satzbau: Bedeutung vorab, klare Aufgabe, Tipp (guter Anfang, dann die ersten zwei Bausteine), Warum nach dem Prüfen', async ({ page }) => {
  const { errors } = await openOrder(page);
  const item = page.getByTestId('drill-item');
  await expect(page.getByTestId('task-line')).toContainText('englischen Satz aus den Bausteinen');
  // Die deutsche Bedeutung steht von Anfang an da (keine Hilfe, kein Knopf), die Warum-Zeile erst danach.
  await expect(item.getByTestId('order-de')).toBeVisible();
  expect(((await item.getByTestId('order-de').textContent()) ?? '').trim().length).toBeGreaterThan(10);
  await expect(item.getByTestId('order-de-btn')).toHaveCount(0);
  await expect(item.getByTestId('order-why')).toHaveCount(0);
  const texts = await item.getByTestId('tile-pool').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));
  const order = (orderSolution(texts) ?? []).map((k) => texts[k] ?? '');
  expect(order).toHaveLength(texts.length);
  await expect(item.getByTestId('tip-info')).toHaveCount(0);
  // Erst einen falschen Baustein legen (der letzte der Lösung): Tipp 2 stellt trotzdem die ersten zwei nach vorn.
  const last = order[order.length - 1] ?? '';
  await item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${last.replace(/"/g, '\\"')}"]`).first().click();
  await item.getByTestId('hint').click();
  await expect(item.getByTestId('tip-info')).toContainText('guter Anfang');
  await item.getByTestId('hint').click();
  await expect(item.getByTestId('tip-info')).toContainText('Die ersten beiden Bausteine');
  await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(2 + 1);
  const line = await item.getByTestId('tile-line').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile')));
  expect(line.slice(0, 2)).toEqual(order.slice(0, 2));
  await expect(item.getByTestId('hint')).toHaveCount(0);
  // „Neu legen“ räumt die Zeile; der Tipp-Text behauptet nicht, dass etwas liegt.
  await item.getByTestId('tiles-reset').click();
  await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(0);
  await expect(item.getByTestId('tip-info')).toContainText('Die ersten beiden Bausteine:');
  for (const [n, text] of order.entries()) {
    await item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${text.replace(/"/g, '\\"')}"]`).first().click();
    await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(n + 1);
  }
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
  await expect(page.getByTestId('verdict')).toContainText('mit Tipp');
  await expect(item.getByTestId('order-why')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Satzbau am Rechner: Wörter tippen legt die Bausteine, Enter im leeren Feld prüft, Rücktaste nimmt zurück', async ({ page }) => {
  const { errors } = await openOrder(page);
  const item = page.getByTestId('drill-item');
  const field = item.getByTestId('tiles-type');
  await expect(field).toBeVisible();
  await expect(field).toBeFocused();
  const texts = await item.getByTestId('tile-pool').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));
  const order = orderSolution(texts);
  expect(order).not.toBeNull();
  const words = (order ?? []).map((k) => texts[k] ?? '');
  // Erst falsch tippen: unbekanntes Wort bleibt im Feld, Hinweis erscheint.
  await page.keyboard.type('zzzzz ');
  await expect(item.getByTestId('tiles-type-miss')).toBeVisible();
  await field.fill('');
  for (const w of words) await page.keyboard.type(`${w} `);
  await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(words.length);
  // Rücktaste im leeren Feld nimmt den letzten Baustein zurück, erneutes Tippen legt ihn wieder.
  await page.keyboard.press('Backspace');
  await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(words.length - 1);
  await page.keyboard.type(`${words[words.length - 1]} `);
  await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(words.length);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
  expect(errors).toEqual([]);
});

test('Bausteine am Handy: kein Tastaturfeld (nur Tippen auf die Bausteine)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  await openOrder(page);
  await expect(page.getByTestId('tiles-type')).toHaveCount(0);
  await context.close();
});

test.describe('Handy 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Bausteine: beim Antippen springt nichts – „Prüfen“ und die übrigen Bausteine bleiben an ihrem Platz (Emrahs Meldung „kein t“)', async ({ page }) => {
    const { errors } = await openOrder(page);
    const item = page.getByTestId('drill-item');
    const pos = async () => (await page.getByTestId('check').boundingBox())?.y ?? -1;
    const texts = await item.getByTestId('tile-pool').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));
    const lastTile = item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${(texts[texts.length - 1] ?? '').replace(/"/g, '\\"')}"]`).first();
    const y0 = await pos();
    const t0 = (await lastTile.boundingBox())?.y ?? -1;
    for (const text of texts.slice(0, -1)) {
      await item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${text.replace(/"/g, '\\"')}"]`).first().tap();
      expect(await pos()).toBe(y0);
      expect((await lastTile.boundingBox())?.y).toBe(t0);
    }
    expect(errors).toEqual([]);
  });
});
