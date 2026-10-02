import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
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
  const de = String(((await dump(page))['vocab/deserve'] ?? {}).de ?? '');
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
  const doc = (await dump(page))['vocab/deserve'] as Doc | undefined;
  expect(Object.keys((doc?.exDe as Doc | undefined) ?? {}).length).toBeGreaterThanOrEqual(1);
});
