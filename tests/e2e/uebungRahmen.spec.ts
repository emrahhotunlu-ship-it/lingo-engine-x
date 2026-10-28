import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, screen } from './fixtures';
import { answerCurrent, answerOnly, DAY, dump, forcedPatch, planPatch, writes } from './trainerHelpers';
import { typeInGap } from './learnHelpers';

// Übungsleiste neben der Seitenleiste und Reiterwechsel mitten in der Übung (Relaunch Stufe 1 P3 nach dem Merge mit P2).
// - ux N1 (Nora): ab 1024 px steht die Seitenleiste auch in Übungen; die Übungsleiste zeigt nur, was die Navigation nicht hat
//   (kein Übersetzer, kein Zahnrad bzw. Einstellungs-Punkt, kein zweites Claude-Symbol – Korrekturrunde Punkt 13).
// - Reiterwechsel: die Übung (Überlagerung) endet sauber. Mit „Weiter“ Bestätigtes bleibt gezählt; eine geprüfte, noch nicht
//   bestätigte Antwort wird beim Verlassen gebucht (Korrekturrunde Punkt 4, LS3: `left: true`), genau einmal; die Runde endet genau einmal.

test.use({ viewport: { width: 1440, height: 900 } });

type Doc = Record<string, unknown>;
const logEntries = async (page: Page): Promise<Doc[]> => ((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? [];
const leftEntries = async (page: Page, id: string): Promise<number> => (await logEntries(page)).filter((e) => e.id === id && e.left === true).length;

/** Seite verbergen (App-Wechsel am Handy): `visibilitychange` mit `hidden`, danach wieder sichtbar. */
async function hideAndShow(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

async function start(page: Page) {
  const booted = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(6), ...forcedPatch() } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

test('ab 1024 px: Übungsleiste ohne Übersetzer und Zahnrad, die Seitenleiste hat sie', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const { errors } = await start(page);
  const bar = page.getByTestId('exercise-bar');
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByTestId('tabbar')).toBeVisible();
    await expect(page.getByTestId('side-translate')).toBeVisible();
    await expect(page.getByTestId('side-settings')).toBeVisible();
    await expect(bar.getByTestId('open-translate')).toHaveCount(0);
    await expect(bar.getByTestId('open-settings')).toHaveCount(0);
    // Punkt 13: Claude nur in der Seitenleiste (gleicher Aufgaben-Kontext), nicht doppelt in der Leiste.
    await expect(bar.getByTestId('open-companion')).toHaveCount(0);
    await expect(page.getByTestId('side-claude')).toBeVisible();
    await bar.getByTestId('exercise-menu').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByTestId('open-settings')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByTestId('exercise')).toBeVisible();
  }
  // Unter 1024 px (keine Seitenleiste in Übungen): Übersetzer in der Leiste, Einstellungen im Menü „…“.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByTestId('tabbar')).toHaveCount(0);
  await expect(bar.getByTestId('open-translate')).toBeVisible();
  await bar.getByTestId('exercise-menu').click();
  await expect(page.getByTestId('open-settings')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('Reiterwechsel mitten in der Übung: die Übung endet sauber, Erledigtes zählt genau einmal, „Starten“ macht weiter', async ({ page }) => {
  test.slow();
  const { errors } = await start(page);
  const card = page.getByTestId('today-card');
  await answerCurrent(page);
  // 1) Wechsel mit offener Aufgabe: die Übung endet ganz (kein halber Zustand), die erledigte Aufgabe bleibt gezählt.
  await page.getByTestId('tab-vocab').click();
  await expect(page.getByTestId('exercise')).toHaveCount(0);
  await expect(page.getByTestId('result')).toHaveCount(0);
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('exercise')).toHaveCount(0);
  await expect(card).toContainText('1 von 6 erledigt');
  // 2) Weiter über „Starten“; Wechsel mit offenem Ergebnis: die geprüfte Antwort wird beim Verlassen gebucht (LS3), genau einmal,
  //    mit `left: true` im Protokoll; beim nächsten „Starten“ kommt die nächste Karte.
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  const id = await page.getByTestId('exercise').getAttribute('data-card');
  const w0 = (await writes(page)).length;
  await answerOnly(page);
  await page.getByTestId('tab-learn').click();
  await expect(page.getByTestId('result')).toHaveCount(0);
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('exercise')).toHaveCount(0);
  await expect(card).toContainText('2 von 6 erledigt');
  await expect.poll(async () => (await writes(page)).slice(w0).filter((x) => x.path === `vocab/${id}`).length).toBeGreaterThan(0);
  await expect.poll(async () => leftEntries(page, id ?? '')).toBe(1);
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).not.toHaveAttribute('data-card', id ?? '');
  expect(await leftEntries(page, id ?? '')).toBe(1);
  // 3) Runde zu Ende: eine Abschlusskarte, auch nach einem weiteren Wechsel; danach Heute mit erledigter Karte ohne Knopf.
  for (let i = 0; i < 30; i++) {
    await expect(page.getByTestId('summary').or(page.locator('[data-step]')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    await answerCurrent(page);
  }
  await expect(page.getByTestId('summary')).toHaveCount(1);
  await page.getByTestId('tab-vocab').click();
  await page.getByTestId('tab-today').click();
  // Die Abschlusskarte kommt höchstens einmal: nach dem Wechsel steht sie noch (dann „Weiter“) oder Heute ist schon erledigt.
  await expect(page.getByTestId('summary').or(page.locator('[data-testid="today-card"][data-done="true"]')).first()).toBeVisible();
  expect(await page.getByTestId('summary').count()).toBeLessThanOrEqual(1);
  if (await page.getByTestId('summary').isVisible()) await page.getByTestId('session-end-next').click();
  const doneCard = page.locator('[data-testid="today-card"][data-done="true"]');
  await expect(doneCard).toBeVisible();
  await expect(doneCard.locator('button')).toHaveCount(0);
  await expect(page.getByTestId('summary')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Seite verborgen mit offenem Ergebnis: sofort gebucht (`left`), die Aufgabe bleibt stehen; „Weiter“ bucht nicht noch einmal', async ({ page }) => {
  const { errors } = await start(page);
  const id = (await page.getByTestId('exercise').getAttribute('data-card')) ?? '';
  await answerOnly(page);
  await hideAndShow(page);
  await expect.poll(async () => leftEntries(page, id)).toBe(1);
  // Nicht weitergerechnet: das Ergebnis steht noch.
  await expect(page.getByTestId('result')).toBeVisible();
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-card', id);
  await page.getByTestId('next').click();
  await expect(page.getByTestId('exercise')).not.toHaveAttribute('data-card', id);
  await page.waitForTimeout(300);
  expect((await logEntries(page)).filter((e) => e.id === id).length).toBe(1);
  expect(errors).toEqual([]);
});

test('Grammatik: ✕ mit offenem Ergebnis bucht die Antwort genau einmal (`left`)', async ({ page }) => {
  const OLD = Date.parse('2020-01-01T10:00:00+01:00');
  const err = { q: 'It was the first time she ___ such a large account.', given: 'has handled', ans: 'had handled', t: OLD, due: OLD, box: 0, src: 'seed' };
  const topic = { id: 'past-perfect', p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors: [err] };
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { fake: { patch: { 'grammar/past-perfect': topic } } });
  const item = page.getByTestId('gr-item');
  await expect(item).toBeVisible();
  const choice = item.getByTestId('choice').filter({ hasText: 'had handled' });
  if (await choice.count()) await choice.first().click();
  else await typeInGap(page, 'had handled');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('result')).toBeVisible();
  const grammarLeft = async () => (await logEntries(page)).filter((e) => e.k === 'g' && e.left === true).length;
  const g0 = (await logEntries(page)).filter((e) => e.k === 'g').length;
  expect(await grammarLeft()).toBe(0);
  await hideAndShow(page);
  await expect.poll(grammarLeft).toBe(1);
  await expect(page.getByTestId('result')).toBeVisible();
  await page.getByTestId('round-close').click();
  await expect(page.getByTestId('gr-item')).toHaveCount(0);
  await page.waitForTimeout(300);
  expect(await grammarLeft()).toBe(1);
  expect((await logEntries(page)).filter((e) => e.k === 'g').length).toBe(g0 + 1);
  expect(errors).toEqual([]);
});

test('C1-Aufgabe (Fehler finden) in der Grammatikrunde: ✕ mit offenem Ergebnis bucht genau einmal (`left`)', async ({ page }) => {
  const OLD = Date.parse('2020-01-01T10:00:00+01:00');
  // err-0039 (src/content/c1x/src/err/k1-2.json items[11]), wie band.spec.
  const err = { q: 'Please don’t deploy until QA signed off on the release candidate.', given: '', ans: 'Please don’t deploy until QA has signed off on the release candidate.', t: OLD, due: OLD, box: 0, src: 'seed', cid: 'err-0039', pat: 'tc.present-perfect', pts: [0, 2] };
  const topic = { id: 'time-clauses', p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors: [err] };
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'err' }, fake: { patch: { 'grammar/time-clauses': topic } } });
  const item = page.getByTestId('gr-item');
  await expect(item.getByTestId('c1x-err')).toBeVisible();
  await item.getByTestId('spot-word').nth(5).click();
  const chip = item.getByTestId('chip').filter({ hasText: 'has signed off' });
  const field = item.getByRole('textbox', { name: 'Korrektur' });
  await expect(chip.or(field).first()).toBeVisible();
  if (await chip.isVisible()) await chip.click();
  else await field.fill('has signed off');
  await page.getByTestId('check').click();
  await expect(item.getByTestId('result')).toBeVisible();
  const grammarLeft = async () => (await logEntries(page)).filter((e) => e.k === 'g' && e.left === true).length;
  const g0 = (await logEntries(page)).filter((e) => e.k === 'g').length;
  expect(await grammarLeft()).toBe(0);
  await page.getByTestId('round-close').click();
  await expect(page.getByTestId('gr-item')).toHaveCount(0);
  await expect.poll(grammarLeft).toBe(1);
  await page.waitForTimeout(300);
  expect(await grammarLeft()).toBe(1);
  expect((await logEntries(page)).filter((e) => e.k === 'g').length).toBe(g0 + 1);
  expect(errors).toEqual([]);
});
