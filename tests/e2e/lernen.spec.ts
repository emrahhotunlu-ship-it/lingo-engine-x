import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, openTab, screen } from './fixtures';

// Paket P2 (docs/neubau/plan.md §4.3): Üben-Hub mit vier Abschnitten, jede Übung ≤ 2 Tipps ab
// Üben, Tageseinheit Block 4 (Fokus, Mini-Drill bei Fallen-Korrektur) und Block 5 (beide
// Fassungen), Werkzeug der Woche per `grammar?topic=`.

type Doc = Record<string, unknown>;
const TODAY_T = Date.parse('2026-09-20T18:00:00+02:00');
// Eine Korrektur aus Block 3 von heute (Reparatur-Satz) mit der Falle f01 „actual ≠ aktuell“.
const TRAP_REPAIR = { id: 'rf01', wrong: 'Please send me the actual version of the contract.', right: 'Please send me the current version of the contract.', why: '„actual“ heißt „tatsächlich“.', src: 'say', t: TODAY_T, box: 0, due: TODAY_T + 86_400_000 };

const dump = (page: Page): Promise<Record<string, Doc>> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Record<string, Doc> } } }).__LINGO_FAKE__.db.dump());

test('Üben: vier Abschnitte, Einstiege je 1 Tipp, kein waagrechter Bildlauf (390)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'learn');
  const hub = page.getByTestId('learn-hub');
  for (const h of ['Dein Weg', 'Aus deinen Fehlern', 'Grammatik & Fallen', 'Training']) await expect(hub.getByRole('heading', { name: h })).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  // Reihenfolge laut Ü1: Fehler direkt unter „Dein Weg“.
  const titles = await hub.locator('h2.lx-eyebrow').allTextContents();
  expect(titles.slice(0, 4)).toEqual(['Dein Weg', 'Aus deinen Fehlern', 'Grammatik & Fallen', 'Training']);

  for (const [id, target] of [
    ['hub-grammar', 'grammar'],
    ['hub-patterns', 'patterns'],
    ['hub-wissen', 'wissen'],
    ['hub-course', 'course'],
  ] as const) {
    await openTab(page, 'learn');
    await page.getByTestId(id).click();
    await expect(page.getByTestId(target)).toBeVisible();
  }
  await openTab(page, 'learn');
  await page.getByTestId('hub-drill-cloze').click();
  await expect(page.getByTestId('drill-item')).toBeVisible();
  await page.getByTestId('round-close').click();
  await openTab(page, 'learn');
  await expect(page.getByTestId('hub-repair')).toContainText('offen');
  expect(errors).toEqual([]);
});

test('Block 4 Fokus: Fallen-Korrektur → Hinweis, Versuch, Lösung mit Grund, danach Mini-Drill mit 3 Sätzen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await bootAt(page, { name: 'unitFocus' }, { fake: { patch: { 'app/repair': { items: [TRAP_REPAIR] } } } });
  await screen(page, 'unitFocus');
  const item = page.getByTestId('focus-item');
  await expect(item).toHaveAttribute('data-kind', 'fix');
  await expect(item).toHaveAttribute('data-trap', 'f01');
  await expect(page.getByTestId('focus-wrong')).toContainText(TRAP_REPAIR.wrong);
  // Erst der Hinweis, dann der Versuch.
  await expect(page.getByTestId('focus-hint')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  await page.getByTestId('focus-input').fill(TRAP_REPAIR.right);
  await page.getByTestId('focus-check').click();
  // M9: auch bei richtiger Antwort Lösung und Grund.
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('feedback-solution')).toContainText('current version');
  await expect(page.getByTestId('feedback-fixes')).toContainText('tatsächlich');
  await page.getByTestId('next').click();

  // Mini-Drill: 3 Sätze der Falle f01.
  for (let n = 1; n <= 3; n++) {
    await expect(item).toHaveAttribute('data-drill', '');
    await expect(item).toHaveAttribute('data-trap', 'f01');
    await expect(page.getByTestId('focus-eyebrow')).toContainText(`Satz ${n} von 3`);
    if (n === 1) {
      // Falsch lassen → Lösung + Grund, Satz wird Reparatur-Karte (Startsatz-Lösung).
      await page.getByTestId('focus-check').click();
      await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'wrong');
      await expect(page.getByTestId('feedback-solution')).toContainText('current status');
    } else {
      await page.getByTestId('focus-dont-know').click();
      await expect(page.getByTestId('feedback-solution')).toBeVisible();
    }
    await page.getByTestId('next').click();
  }
  // Danach füllen fällige Fehler bzw. Fallen der Woche auf 3 Hauptaufgaben auf.
  await expect(page.getByTestId('unit-focus')).toHaveAttribute('data-main', '3');
  for (let i = 0; i < 2; i++) {
    const gr = page.getByTestId('gr-item');
    if (await gr.isVisible()) {
      await page.getByTestId('dont-know').click();
      await page.getByTestId('next').click();
    } else {
      await page.getByTestId('focus-dont-know').click();
      await page.getByTestId('next').click();
    }
  }
  await expect(page.getByTestId('session-end')).toBeVisible();
  await expect
    .poll(async () => ((await dump(page))['app/repair']?.items as Doc[] | undefined)?.some((e) => e.src === 'pattern' && String(e.wrong).includes('actual status')) ?? false)
    .toBe(true);
  expect(errors).toEqual([]);
});

test('Block 4 ohne Korrekturen und ohne KI: immer 3 Aufgaben', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'unitFocus' }, { fake: { capabilities: { sample: false } } });
  await screen(page, 'unitFocus');
  await expect(page.getByTestId('unit-focus')).toHaveAttribute('data-main', '3');
  expect(errors).toEqual([]);
});

test('Block 5: aus dem Kopf neu formulieren, danach beide Fassungen nebeneinander und Korrektur „jetzt drin“', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { 'app/repair': { items: [TRAP_REPAIR] } } } });
  await screen(page, 'unitAgain');
  await expect(page.getByTestId('again-remember')).toContainText('tatsächlich');
  await page.getByTestId('again-input').fill('Please send me the current version of the contract today.');
  await page.getByTestId('again-compare').click();
  await expect(page.getByTestId('again-new')).toContainText('current version of the contract today');
  await expect(page.getByTestId('again-better')).toContainText(TRAP_REPAIR.right);
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'ok');
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Werkzeug der Woche: grammar?topic=c1-hedging öffnet das Themenblatt', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammar', topic: 'c1-hedging' });
  await expect(page.getByTestId('rule-sheet')).toHaveAttribute('data-topic', 'c1-hedging');
  // Umschalter steht auf dem C1-Werkzeugkasten; B2-Themen sind einen Tipp entfernt.
  await page.keyboard.press('Escape');
  await expect(page.locator('ul[data-set="c1"] [data-testid="topic"]')).toHaveCount(7);
  await page.getByTestId('gr-set-b2').click();
  await expect(page.locator('[data-testid="topic"][data-topic^="c1-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="topic"]')).toHaveCount(16);
  expect(errors).toEqual([]);
});

test('Deutsch-Fallen ohne KI: Startsatz-Falle in 2 Tipps ab Üben, 3 Sätze mit Hinweis und Lösung', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await page.getByTestId('hub-patterns').click();
  await expect(page.getByTestId('patterns-start')).toBeVisible();
  await page.getByTestId('pattern-start-f03').click();
  await expect(page.getByTestId('patterns')).toHaveAttribute('data-view', 'drill');
  for (let i = 0; i < 3; i++) {
    const item = page.locator('[data-testid="focus-item"][data-state="open"]');
    await expect(item).toHaveAttribute('data-trap', 'f03');
    await expect(page.getByTestId('focus-hint')).toBeVisible();
    await page.getByTestId('focus-dont-know').click();
    await expect(page.getByTestId('feedback-fixes')).not.toBeEmpty();
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('pattern-drill-end')).toHaveAttribute('data-total', '3');
  expect(errors).toEqual([]);
});

test('Grammatik-Runde: „Kurz erklärt“ vor der Aufgabe, zugeklappt (N46)', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await page.getByTestId('hub-grammar').click();
  await page.getByTestId('gr-start').click();
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await expect(page.getByTestId('gr-brief-text')).toHaveCount(0);
  await page.getByTestId('gr-brief').click();
  await expect(page.getByTestId('gr-brief-text')).not.toBeEmpty();
  expect(errors).toEqual([]);
});
