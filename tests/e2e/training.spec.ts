import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, bootAt, crashOnce, layoutProblems, openEntry, openSpeak, openTab, screen } from './fixtures';
import { nbLog, outItems, typeGap } from './trainingHelpers';
import { dump } from './trainerHelpers';

// Training: Kollokationen, Satz-Umformung, Register, Überleitungen/Wortbildung und das Einwand-Training
// (freiwilliges Extra). Posteingang, Nachsprechen und Aussprache entfallen seit dem Umbau (04.10.2026).

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('Einstiege: jede Übung 1 Tipp ab ihrem Reiter (Sprechen: ab Heute)', async ({ page }) => {
  await boot(page, { migrated: true });
  await openTab(page, 'learn');
  await expect(page.getByTestId('training-colloc')).toBeVisible();
  await expect(page.getByTestId('training-transform')).toBeVisible();
  // Sprechen ist seit 04.10.2026 kein Reiter mehr: Heute › „Sprechen (freiwillig)“.
  await openSpeak(page);
  await expect(page.getByTestId('training-objection')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
});

test('Kollokationen: 5 Aufgaben, Lehnübersetzung → Hinweis → Lösung, Ergebnis gespeichert', async ({ page }) => {
  await boot(page, { migrated: true });
  await openEntry(page, 'training-colloc');
  await screen(page, 'nbdrill');
  await expect(page.getByTestId('round-progress')).toHaveText('1 / 5');
  await expect(page.getByTestId('training-note')).toHaveText('Extra');

  // c01 deal: Lehnübersetzung „finish“ → Hinweis mit Grund, zählt nicht als Fehlversuch.
  const item = page.getByTestId('colloc-item');
  await expect(page.getByTestId('colloc-noun')).toHaveText('deal');
  await typeGap(page, 'finish');
  await expect(page.getByTestId('drill-step')).toHaveAttribute('data-kind', 'calque');
  await typeGap(page, 'closed');
  await expect(page.getByTestId('drill-step')).toHaveAttribute('data-kind', 'hit');
  await typeGap(page, 'strike');
  await expect(item).toHaveAttribute('data-state', 'close');
  // Lösung mit Grund (Lehnübersetzung als Kontrast), auch wenn es am Ende geklappt hat.
  await expect(page.getByTestId('feedback-fixes')).toContainText('close a deal');
  await expect(page.getByTestId('colloc-examples')).toContainText('seal');
  await page.getByTestId('next').click();

  // c02 deadline: falsch → Hinweis (Anfangsbuchstabe) → falsch → Lösung.
  await expect(page.getByTestId('colloc-noun')).toHaveText('deadline');
  await typeGap(page, 'do');
  await expect(page.getByTestId('drill-step')).toHaveAttribute('data-kind', 'hint');
  await typeGap(page, 'hit');
  await expect(page.getByTestId('colloc-item')).toHaveAttribute('data-state', 'wrong');
  await expect(page.getByTestId('feedback-solution')).toContainText('meet');
  await page.getByTestId('next').click();

  for (let i = 3; i <= 5; i++) {
    await expect(page.getByTestId('round-progress')).toHaveText(`${i} / 5`);
    await page.getByTestId('drill-dontknow').click();
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('session-end')).toBeVisible();
  await expect(page.getByTestId('session-end')).toHaveAttribute('data-total', '5');
  await expect.poll(async () => (await outItems(page)).filter((x) => x.k === 'colloc').length).toBe(1);
  await expect.poll(async () => (await nbLog(page)).filter((x) => x.type === 'nb-colloc' && x.ctx === 'xtra').length).toBe(5);
  await page.getByTestId('session-end-next').click();
  await screen(page, 'learn');
});

test('Satz-Umformung: Hinweis, zweiter Versuch, Neuladen setzt an derselben Aufgabe fort', async ({ page }) => {
  await bootAt(page, { name: 'nbdrill', set: 'transform' }, { fake: { persist: true } });
  await screen(page, 'nbdrill');
  const item = page.getByTestId('transform-item');
  await expect(item).toHaveAttribute('data-id', 'u01');
  await expect(page.getByTestId('motor-chip')).toHaveText('MAY');
  await typeGap(page, 'did not get');
  await expect(page.getByTestId('drill-step')).toHaveAttribute('data-kind', 'keyword');
  await typeGap(page, 'may not have received');
  await expect(item).toHaveAttribute('data-state', 'close');
  await expect(page.getByTestId('feedback-fixes')).toContainText('may not have');
  await page.getByTestId('next').click();
  await expect(page.getByTestId('transform-item')).toHaveAttribute('data-id', 'u02');
  await page.waitForTimeout(500);
  await page.reload();
  await screen(page, 'nbdrill');
  await expect(page.getByTestId('transform-item')).toHaveAttribute('data-id', 'u02');
  await expect(page.getByTestId('round-progress')).toHaveText('2 / 5');
});

const levels = (l: number, w: number[] = [], n = w.length) => ({ 'app/levels': { v: 1, k: { 'nb-objection': { l, w, n, ch: '' } } } });

test('Einwand-Training ohne KI, Stufe 2 (gelenkt): je Schritt den passenden Satz wählen, Stufe steigt, beste Antwort merken', async ({ page }) => {
  // Fünf gute Versuche liegen schon vor: nach dieser Runde (zehn Versuche, alle richtig) geht es auf Stufe 3.
  await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: levels(2, [1, 1, 1, 1, 1]) } });
  await openEntry(page, 'training-objection');
  await screen(page, 'pressure');
  await expect(page.getByTestId('pressure-level')).toHaveAttribute('data-level', '2');
  // Keine Uhr unterhalb von Stufe 5.
  await expect(page.getByTestId('pressure-think')).toHaveCount(0);
  await expect(page.getByTestId('pressure-answer')).toHaveCount(0);
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId('round-progress')).toHaveText(`${i} / 5`);
    for (let k = 1; k < 4; k++) await page.getByTestId(`choice-step-${k}`).locator('[data-ok="1"]').check();
    await page.getByTestId('pressure-check').click();
    const review = page.getByTestId('pressure-review');
    await expect(review).toHaveAttribute('data-mode', 'structured');
    await expect(review).toHaveAttribute('data-part', '4');
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'ok');
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('session-end')).toHaveAttribute('data-right', '5');
  await expect(page.getByTestId('pressure-level-next')).toHaveAttribute('data-kind', 'up');
  await expect.poll(async () => ((await dump(page))['app/levels']?.k as Record<string, { l: number }> | undefined)?.['nb-objection']?.l).toBe(3);
  // Gemerkt wird die Musterantwort (nie ungeprüfter eigener Text).
  await page.getByTestId('pressure-save').click();
  await expect(page.getByTestId('pressure-save')).toHaveAttribute('data-state', 'saved');
  await expect.poll(async () => (await outItems(page)).filter((x) => x.k === 'objection').length).toBe(1);
  await expect.poll(async () => (await nbLog(page)).filter((x) => x.type === 'nb-objection').length).toBe(5);
});

test('Einwand-Training Stufe 1 (Vorbild): Sätze antippen, falsche Reihenfolge wird je Schritt erklärt', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: levels(1) } });
  await openEntry(page, 'training-objection');
  await screen(page, 'pressure');
  await expect(page.getByTestId('pressure-level')).toHaveAttribute('data-level', '1');
  await expect(page.getByTestId('pressure-check')).toBeDisabled();
  for (const m of ['ask', 'acknowledge', 'answer', 'secure']) await page.locator(`[data-testid="order-pool-item"][data-move="${m}"]`).click();
  await page.getByTestId('pressure-check').click();
  await expect(page.getByTestId('pressure-review')).toHaveAttribute('data-part', '2');
  await expect(page.getByTestId('struct-row-0')).toHaveAttribute('data-ok', '0');
  await expect(page.getByTestId('struct-row-2')).toHaveAttribute('data-ok', '1');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'close');
});

test('Einwand-Training Stufe 3 und 4: Satzanfänge, Tipp auf Abruf, Knopf „Leichter“', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: levels(4) } });
  await openEntry(page, 'training-objection');
  await screen(page, 'pressure');
  await expect(page.getByTestId('pressure-level')).toHaveAttribute('data-level', '4');
  await expect(page.getByTestId('pressure-think')).toHaveCount(0);
  await page.getByTestId('pressure-hint').click();
  await expect(page.getByTestId('pressure-hint-list')).toContainText('…');
  await page.getByTestId('pressure-easier').click();
  await expect(page.getByTestId('pressure-level')).toHaveAttribute('data-level', '3');
  const first = page.getByTestId('starter-input-0');
  await expect(first).not.toHaveValue('');
  await expect(page.getByTestId('pressure-check')).toBeDisabled();
  await first.pressSequentially('and I see your point.');
  await page.getByTestId('pressure-check').click();
  await expect(page.getByTestId('pressure-review')).toHaveAttribute('data-mode', 'self');
});

test('Einwand-Training mit KI, Stufe 5: Bedenkzeit, Zeitziel, Claude prüft das Muster im Hintergrund, Weiter wartet nie', async ({ page }) => {
  await boot(page, { migrated: true, fake: { patch: levels(5) } });
  await openEntry(page, 'training-objection');
  await screen(page, 'pressure');
  await expect(page.getByTestId('pressure-think')).toBeVisible();
  await page.getByTestId('pressure-start').click();
  await expect(page.getByTestId('pressure-answer')).toBeVisible();
  await page.getByTestId('pressure-input').fill('I understand. What are you comparing us with? We include support. Shall we compare?');
  await page.getByTestId('pressure-check').click();
  await expect(page.getByTestId('pressure-review')).toHaveAttribute('data-mode', 'ai');
  await expect(page.getByTestId('pressure-pattern').locator('[data-move="ask"]')).toHaveAttribute('data-on', 'true');
  await expect(page.getByTestId('feedback-solution')).toContainText('side by side');
  await page.getByTestId('next').click();
  await expect(page.getByTestId('round-progress')).toHaveText('2 / 5');
});

test('Deep-Link öffnet die Übung direkt (neue Runde als Extra)', async ({ page }) => {
  await bootAt(page, { name: 'nbdrill', set: 'colloc' });
  await screen(page, 'nbdrill');
  await expect(page.getByTestId('colloc-item')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
});

test('Soll N107: Register-Leiter – ganzer Satz, Hinweis, zweiter Versuch', async ({ page }) => {
  await boot(page, { migrated: true });
  await openEntry(page, 'training-register');
  await screen(page, 'nbdrill');
  const item = page.getByTestId('register-item');
  await expect(item).toHaveAttribute('data-id', 'r01');
  await expect(page.getByTestId('motor-chip')).toHaveText('casual → neutral');
  await page.getByTestId('motor-input').fill('I have them.');
  await page.getByTestId('drill-check').click();
  await expect(page.getByTestId('drill-step')).toHaveAttribute('data-kind', 'start');
  await page.getByTestId('motor-input').fill('I received the documents yesterday.');
  await page.getByTestId('drill-check').click();
  await expect(item).toHaveAttribute('data-state', 'close');
  await expect(page.getByTestId('feedback-fixes')).toContainText('receive');
  await page.getByTestId('next').click();
  await expect(page.getByTestId('round-progress')).toHaveText('2 / 5');
});

test('Soll N107: Überleitungen und Wortbildung erreichbar', async ({ page }) => {
  await boot(page, { migrated: true });
  await openEntry(page, 'training-transition');
  await screen(page, 'nbdrill');
  await expect(page.getByTestId('transition-item')).toBeVisible();
  await expect(page.getByTestId('motor-gap')).toBeVisible();
  await page.getByTestId('round-close').click();
  await openEntry(page, 'training-wordform');
  await screen(page, 'nbdrill');
  await expect(page.getByTestId('wordform-item')).toHaveAttribute('data-id', 'w01');
  await typeGap(page, 'compliant');
  await expect(page.getByTestId('wordform-item')).toHaveAttribute('data-state', 'ok');
});

for (const theme of ['dark', 'dim', 'light'] as const) {
  test(`Barrierefreiheit (${theme}): Kollokation ohne ernste axe-Verstöße`, async ({ page }) => {
    await boot(page, { migrated: true, theme, lang: theme === 'light' ? 'en' : 'de' });
    await openEntry(page, 'training-colloc');
    await screen(page, 'nbdrill');
    const a = await new AxeBuilder({ page }).include('[data-testid="nbdrill"]').analyze();
    expect(a.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(await layoutProblems(page)).toEqual([]);
  });
}

test('G4: lx:crash-once – Aufgabe überspringen, die Runde läuft weiter', async ({ page }) => {
  await boot(page, { migrated: true, localStorage: crashOnce('nbdrill') });
  await openEntry(page, 'training-colloc');
  await expect(page.getByTestId('boundary-step')).toBeVisible();
  await page.getByTestId('boundary-skip').click();
  await expect(page.getByTestId('colloc-item')).toBeVisible();
  await expect(page.getByTestId('round-progress')).toHaveText('2 / 5');
});

test('G4: lx:crash-once auch im Einwand-Training', async ({ page }) => {
  await bootAt(page, { name: 'pressure' }, { localStorage: crashOnce('pressure') });
  await screen(page, 'pressure');
  await page.getByTestId('boundary-skip').click();
  await expect(page.getByTestId('round-progress')).toHaveText('2 / 5');
});
