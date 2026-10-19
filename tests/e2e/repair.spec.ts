import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openSpeak, openTab, screen } from './fixtures';
import { NO_GRAMMAR_ERRORS, profileWith, vgPlan } from './heuteHelpers';
import { DAY, dump, planPatch } from './trainerHelpers';

// Reparatur-Sätze (Lernberatung 27.09., V2 „Nochmal, aber besser"): Wiederholung in der
// Pflichtrunde (lokal richtig, KI-Nachprüfung falsch), Schritt nach dem Rollenspiel-Bericht und
// nach der Schreibkorrektur, Schreibwege in `app/repair` und `log/<tag>`, „Dein Stand".
// Handy (390) und Desktop.

type Doc = Record<string, unknown>;
const DUE = Date.parse('2026-09-19T12:00:00+02:00');
const A = { id: 'ra1', wrong: 'We are working on it since two years.', right: 'We have been working on it for two years.', why: 'Für eine Dauer bis jetzt: Present Perfect Continuous und „for“.', src: 'say', t: DUE - 86_400_000, box: 0, due: DUE, fix: ['have been working', 'for two years'] };
const B = { id: 'rb2', wrong: 'It depends of the budget.', right: 'It depends on the budget.', why: 'Nach „depend“ steht „on“.', src: 'preply', t: DUE - 86_400_000, box: 0, due: DUE + 1 };

const SIZES = [
  { name: 'Handy', width: 390, height: 844 },
  { name: 'Desktop', width: 1280, height: 900 },
] as const;

const repairs = async (page: Page): Promise<Doc[]> => (((await dump(page))['app/repair'] as { items?: Doc[] } | undefined)?.items ?? []);

for (const size of SIZES) {
  test(`Fehlersätze (${size.name}): eigene Runde unter Anwenden – lokal „fast richtig“, KI-Nachprüfung, Protokoll`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    // Plan v2: Schritt 4 (Sonntag) nimmt die fälligen Sätze selbst; die freiwillige Runde gibt es erst, wenn er erledigt ist.
    const sunPlan = { ...vgPlan(DAY), duty: ['review', 'ch:u-check', 'ch:u-again'] };
    const { errors, external } = await boot(page, { migrated: true, fake: { patch: { ...NO_GRAMMAR_ERRORS, ...profileWith(DAY, sunPlan, ['u-again']), 'app/repair': { items: [A, B] } } } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('hub-repair-round').click();
    await expect(page.getByTestId('repair-round')).toBeVisible();

    // 1. Satz: alter Satz sichtbar, bessere Fassung verborgen, vorbefülltes Feld (Tastatur).
    const item = page.getByTestId('repair-item');
    await expect(item).toHaveAttribute('data-id', 'ra1');
    await expect(page.getByTestId('repair-input')).toHaveValue(A.wrong);
    await expect(page.getByTestId('repair-right')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);
    await page.waitForTimeout(450);
    const axe = await new AxeBuilder({ page }).include('[data-testid="repair-item"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await expect(page.getByTestId('repair-check')).toBeDisabled();
    await page.getByTestId('repair-input').fill("We've been working on it for two years now");
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'near');
    await expect(page.getByTestId('repair-right')).toContainText(A.right);
    await expect(page.getByTestId('result')).toContainText('for');
    // Englische Wörter antippbar.
    await page.getByTestId('repair-right').locator('button.lx-word').first().click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await page.screenshot({ path: `test-results/screens/reparatur-wiederholung-${size.width}.png`, fullPage: true });
    await page.getByTestId('repair-next').click();

    // 2. Satz: unverändert abgeschickt → immer nein, ohne KI, mit Hinweis (Rückmeldung 19.10.2026: nie „Fast richtig“).
    await expect(item).toHaveAttribute('data-id', 'rb2');
    await page.getByTestId('repair-input').fill('It depends of the budget');
    await page.getByTestId('repair-check').click();
    await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'wrong');
    await expect(page.getByTestId('result')).toContainText('Du hast nichts geändert.');
    await expect(page.getByTestId('repair-right')).toContainText(B.right);
    await page.getByTestId('repair-next').click();
    await expect(page.getByTestId('session-end')).toBeVisible();

    // Schreibwege: „Fast richtig“ (near): Box bleibt, morgen wieder (Prüfbefund S3), im Protokoll trotzdem als geschafft.
    await expect.poll(async () => (await repairs(page)).find((e) => e.id === 'ra1')?.last).toBeTruthy();
    expect((await repairs(page)).find((e) => e.id === 'ra1')).toMatchObject({ box: 0, done: false });
    expect((await repairs(page)).find((e) => e.id === 'rb2')).toMatchObject({ box: 0, done: false });
    await expect
      .poll(async () => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.type === 'repair').map((e) => [e.id, e.ok, e.ctx]))
      .toEqual([
        ['ra1', true, 'xtra'],
        ['rb2', false, 'xtra'],
      ]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

// 11.10.2026 (Emrah): Die Pflichtrunde „Wörter wiederholen“ enthält nie Fehlersätze – auch nicht, wenn viele fällig sind.
// Sie bleiben fällig und werden im Bereich Grammatik/Anwenden geübt (Test darunter).
test('Pflichtrunde Wörter: fällige Fehlersätze kommen nicht vor, sie bleiben unverändert fällig', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const many = Array.from({ length: 5 }, (_, i) => ({ ...B, id: `rm${i}`, wrong: `It depends of the budget number ${i + 1}.`, right: `It depends on the budget number ${i + 1}.`, due: DUE + i }));
  const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/profile': planPatch(8), 'app/repair': { items: many } } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('repair-item')).toHaveCount(0);
  await expect(page.getByTestId('exercise').or(page.getByTestId('intro')).or(page.getByTestId('flip')).first()).toBeVisible();
  await expect(page.getByTestId('trainer-progress')).toHaveText('1 von 8');
  expect((await repairs(page)).map((r) => [r.id, r.box, r.due])).toEqual(many.map((r, i) => [r.id, 0, DUE + i]));
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
  await expect(step.getByTestId('repair-input')).toHaveValue('We must delay the start by two weeks.');
  await expect(step.getByTestId('repair-right')).toHaveCount(0);
  // Gespeichert, bevor Emrah etwas tippt.
  await expect.poll(async () => (await repairs(page)).map((e) => [e.src, e.wrong, e.right, e.box])).toEqual([['talk', 'We must delay the start by two weeks.', 'We need to delay the start by two weeks.', 0]]);
  await step.getByTestId('repair-input').fill('We need to delay the start by two weeks.');
  await page.getByTestId('repair-check').click();
  await expect(step.getByTestId('result')).toHaveAttribute('data-verdict', 'ok');
  await expect(step.getByTestId('repair-right')).toContainText('need to delay');
  expect(await layoutProblems(page)).toEqual([]);
  await page.screenshot({ path: 'test-results/screens/reparatur-rollenspiel-390.png', fullPage: true });
  await page.getByTestId('repair-next').click();
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
  // Plan v2: Schritt 4 (Sonntag) nimmt die fälligen Sätze selbst; die freiwillige Runde gibt es erst, wenn er erledigt ist.
  const sunPlan = { ...vgPlan(DAY), duty: ['review', 'ch:u-check', 'ch:u-again'] };
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...NO_GRAMMAR_ERRORS, ...profileWith(DAY, sunPlan, ['u-again']), 'app/repair': { items: [A, B] } } } });
  await screen(page, 'today');
  const planBefore = (await dump(page))['app/profile']?.plan;
  await openTab(page, 'apply');
  await expect(page.getByTestId('hub-repair-round')).toBeVisible();
  await page.getByTestId('hub-repair-round').click();
  await expect(page.getByTestId('repair-round')).toBeVisible();
  await expect(page.getByTestId('repair-item')).toHaveAttribute('data-id', 'ra1');
  await page.getByTestId('repair-input').fill(A.right);
  await page.getByTestId('repair-check').click();
  await expect(page.getByTestId('result')).toBeVisible();
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
  await boot(page, { migrated: true, fake: { patch: { ...NO_GRAMMAR_ERRORS, 'app/repair': { items: [] } } } });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await expect(page.getByTestId('apply-hub')).toBeVisible();
  await expect(page.getByTestId('hub-repair-round')).toHaveCount(0);
});
