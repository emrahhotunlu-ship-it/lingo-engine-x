import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openOverview, openSpeak, openTab, screen } from './fixtures';
import { DAY, answerCurrent, dump, forcedPatch, planPatch } from './trainerHelpers';

// Reparatur-Sätze (Lernberatung 27.09., V2 „Nochmal, aber besser"): Wiederholung in der
// Pflichtrunde (lokal richtig, KI-Nachprüfung falsch), Schritt nach dem Rollenspiel-Bericht und
// nach der Schreibkorrektur, Schreibwege in `app/repair` und `log/<tag>`, „Dein Stand".
// Handy (390) und Desktop.

type Doc = Record<string, unknown>;
const DUE = Date.parse('2026-09-19T12:00:00+02:00');
const A = { id: 'ra1', wrong: 'We are working on it since two years.', right: 'We have been working on it for two years.', why: 'Für eine Dauer bis jetzt: Present Perfect Continuous und „for“.', src: 'talk', t: DUE - 86_400_000, box: 0, due: DUE, fix: ['have been working', 'for two years'] };
const B = { id: 'rb2', wrong: 'It depends of the budget.', right: 'It depends on the budget.', why: 'Nach „depend“ steht „on“.', src: 'preply', t: DUE - 86_400_000, box: 0, due: DUE + 1 };

const SIZES = [
  { name: 'Handy', width: 390, height: 844 },
  { name: 'Desktop', width: 1280, height: 900 },
] as const;

const repairs = async (page: Page): Promise<Doc[]> => (((await dump(page))['app/repair'] as { items?: Doc[] } | undefined)?.items ?? []);

for (const size of SIZES) {
  test(`Wiederholung (${size.name}): „Damals hast du gesagt“, lokal richtig, KI-Nachprüfung, zählt zur Pflicht`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const { errors, external } = await boot(page, {
      migrated: true,
      fake: { patch: { 'app/profile': planPatch(3), 'vocab/avoid': forcedPatch()['vocab/avoid'] ?? {}, 'app/repair': { items: [A, B] } } },
    });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');

    // 1. Satz: alter Satz sichtbar, bessere Fassung verborgen, Textfeld für den ganzen Satz.
    const item = page.getByTestId('repair-item');
    await expect(item).toHaveAttribute('data-id', 'ra1');
    await expect(item).toHaveAttribute('data-mode', 'review');
    await expect(item).toContainText('Damals hast du gesagt:');
    await expect(page.getByTestId('repair-wrong')).toContainText(A.wrong);
    await expect(page.getByTestId('repair-right')).toHaveCount(0);
    await expect(page.getByTestId('trainer-progress')).toHaveText('1 / 3');
    expect(await layoutProblems(page)).toEqual([]);
    const axe = await new AxeBuilder({ page }).include('[data-testid="repair-item"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await expect(page.getByTestId('repair-check')).toBeDisabled();
    await page.getByTestId('repair-input').fill("We've been working on it for two years now");
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('repair-verdict')).toHaveAttribute('data-verdict', 'close');
    await expect(page.getByTestId('repair-right')).toContainText(A.right);
    await expect(page.getByTestId('repair-why')).toContainText('for');
    // Englische Wörter antippbar.
    await page.getByTestId('repair-right').locator('button.lx-word').first().click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await page.screenshot({ path: `test-results/screens/reparatur-wiederholung-${size.width}.png`, fullPage: true });
    await page.getByTestId('repair-next').click();

    // 2. Satz: der alte Fehler steckt noch drin → lokal nein → KI (repair-check@1) sagt nein.
    await expect(item).toHaveAttribute('data-id', 'rb2');
    await page.getByTestId('repair-input').fill('It depends of the budget.');
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('repair-verdict')).toHaveAttribute('data-verdict', 'no');
    await expect(page.getByTestId('repair-result')).toContainText('Der alte Fehler steckt noch im Satz.');
    await expect(page.getByTestId('repair-right')).toContainText(B.right);
    await page.getByTestId('repair-next').click();

    // Danach die Karte wie gewohnt, dann die Zusammenfassung.
    await expect(page.getByTestId('exercise')).toBeVisible();
    await answerCurrent(page);
    await expect(page.getByTestId('summary')).toBeVisible();

    // Schreibwege: Boxen in app/repair, Protokoll zählt zu „Wiederholen“.
    await expect.poll(async () => (await repairs(page)).find((e) => e.id === 'ra1')?.box).toBe(1);
    const list = await repairs(page);
    expect(list.find((e) => e.id === 'rb2')).toMatchObject({ box: 0, done: false });
    await expect
      .poll(async () => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.type === 'repair').map((e) => [e.id, e.ok, e.ctx]))
      .toEqual([
        ['ra1', true, 'rev'],
        ['rb2', false, 'rev'],
      ]);
    await page.getByTestId('summary-back').click();
    await screen(page, 'today');
    await expect(page.getByTestId('today-status')).toHaveText('Fertig für heute');

    // „Dein Stand“: eine Zeile.
    await openOverview(page);
    await page.getByTestId('tab-errors').click();
    await expect(page.getByTestId('repair-stand')).toHaveText('Reparatur-Sätze: 2 offen, 0 sicher');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

// Neubau (Block 1 „Wiederholen“, domain/week/review.ts REPAIR_MAX): höchstens 3 Reparatur-Sätze je
// Runde, der Rest bleibt fällig. Die Tagesgrenze von 4 (REPAIR_PER_DAY) prüft tests/unit/repairFlow.test.ts.
test('Wiederholung ohne KI: die lokale Prüfung zählt; höchstens 3 je Runde, der Rest bleibt fällig', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const many = Array.from({ length: 5 }, (_, i) => ({ ...B, id: `rm${i}`, wrong: `It depends of the budget number ${i + 1}.`, right: `It depends on the budget number ${i + 1}.`, due: DUE + i }));
  const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/profile': planPatch(8), 'app/repair': { items: many } } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('repair-item')).toHaveAttribute('data-id', `rm${i}`);
    await page.getByTestId('repair-input').fill(i === 0 ? 'It depends of the budget number 1.' : `It depends on the budget number ${i + 1}`);
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('repair-verdict')).toHaveAttribute('data-verdict', i === 0 ? 'no' : 'exact');
    await expect(page.getByTestId('ai-phase')).toHaveCount(0);
    await page.getByTestId('repair-next').click();
  }
  // Der vierte und fünfte bleiben fällig (unverändert); weiter geht es mit Karten.
  await expect(page.getByTestId('exercise')).toBeVisible();
  await expect(page.getByTestId('repair-item')).toHaveCount(0);
  const rest = (await repairs(page)).filter((r) => r.id === 'rm3' || r.id === 'rm4');
  expect(rest.map((r) => [r.id, r.box, r.due])).toEqual([
    ['rm3', 0, DUE + 3],
    ['rm4', 0, DUE + 4],
  ]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Rollenspiel: „Nochmal, aber besser“ nach dem Bericht, Satz wird Reparatur-Satz (src talk, erste Wiederholung)', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  // Sprechen ist seit 04.10.2026 kein Reiter mehr: Heute › „Sprechen (freiwillig)“.
  await openSpeak(page);
  await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
  for (const s of ['We must delay the start by two weeks.', 'That depends on your test team.']) {
    const before = await page.locator('[data-testid="rp-turn"][data-role="persona"]').count();
    await page.getByTestId('composer-input').fill(s);
    await page.getByTestId('composer-send').click();
    await expect(page.locator('[data-testid="rp-turn"][data-role="persona"]')).toHaveCount(before + 1);
    await expect(page.getByTestId('roleplay')).toHaveAttribute('data-state', 'composing');
  }
  await expect(page.getByTestId('an-chip').first()).toHaveAttribute('data-state', 'errors', { timeout: 15_000 });
  await expect(page.getByTestId('an-chip').nth(1)).toHaveAttribute('data-state', 'clean', { timeout: 15_000 });
  await page.getByTestId('rp-end').click();
  await expect(page.getByTestId('report')).toHaveAttribute('data-state', 'saved');

  const step = page.getByTestId('repair-step');
  await expect(step).toBeVisible();
  await step.getByTestId('repair-step-start').click();
  await expect(step.getByTestId('repair-item')).toHaveCount(1);
  await expect(step.getByTestId('repair-wrong')).toContainText('We must delay the start by two weeks.');
  await expect(step.getByTestId('repair-right')).toHaveCount(0);
  // Gespeichert, bevor Emrah etwas tippt.
  await expect.poll(async () => (await repairs(page)).map((e) => [e.src, e.wrong, e.right, e.box])).toEqual([['talk', 'We must delay the start by two weeks.', 'We need to delay the start by two weeks.', 0]]);
  await step.getByTestId('repair-input').fill('We need to delay the start by two weeks.');
  await step.getByTestId('repair-check').click();
  await expect(step.getByTestId('repair-verdict')).toHaveAttribute('data-verdict', 'exact');
  await expect(step.getByTestId('repair-right')).toContainText('need to delay');
  expect(await layoutProblems(page)).toEqual([]);
  await page.screenshot({ path: 'test-results/screens/reparatur-rollenspiel-390.png', fullPage: true });
  await step.getByTestId('repair-next').click();
  await expect(step).toHaveAttribute('data-state', 'done');
  // Direkt nach der Korrektur ist ein Treffer noch kein freier Abruf: Box bleibt 0, morgen wieder.
  await page.waitForTimeout(300);
  expect((await repairs(page))[0]?.box).toBe(0);
  expect((await repairs(page))[0]).toMatchObject({ ctx: expect.any(String), fix: ['need to delay'] });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Anwenden › Fehler korrigieren: freiwillige Runde über die fälligen Sätze, ctx xtra, Box wächst, Pflicht unberührt', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/repair': { items: [A, B] } } } });
  await screen(page, 'today');
  const planBefore = (await dump(page))['app/profile']?.plan;
  await openTab(page, 'apply');
  await expect(page.getByTestId('hub-repair-round')).toBeVisible();
  await page.getByTestId('hub-repair-round').click();
  await expect(page.getByTestId('repair-round')).toBeVisible();
  await expect(page.getByTestId('repair-item')).toHaveAttribute('data-id', 'ra1');
  await page.getByTestId('repair-input').fill("We've been working on it for two years now");
  await page.getByTestId('repair-check').click();
  await expect(page.getByTestId('repair-verdict')).toBeVisible();
  await page.getByTestId('repair-next').click();
  await page.getByTestId('repair-input').fill('It depends on the budget.');
  await page.getByTestId('repair-check').click();
  await page.getByTestId('repair-next').click();
  await expect(page.getByTestId('session-end')).toBeVisible();
  await expect.poll(async () => (await repairs(page)).filter((e) => Number(e.box) >= 1).length).toBe(2);
  const logOf = async () => (((await dump(page))[`log/${DAY}`] as { entries?: Doc[] } | undefined)?.entries ?? []).filter((e) => e.type === 'repair');
  await page.getByTestId('session-end-next').click();
  await expect.poll(async () => (await logOf()).length).toBe(2);
  const log = await logOf();
  expect(log.every((e) => e.ctx === 'xtra')).toBe(true);
  expect((await dump(page))['app/profile']?.plan).toEqual(planBefore);
  expect(errors).toEqual([]);
});

test('Anwenden: ohne fällige Sätze gibt es keinen Knopf „Fehler korrigieren“', async ({ page }) => {
  await boot(page, { migrated: true, fake: { patch: { 'app/repair': { items: [] } } } });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await expect(page.getByTestId('apply-hub')).toBeVisible();
  await expect(page.getByTestId('hub-repair-round')).toHaveCount(0);
});
