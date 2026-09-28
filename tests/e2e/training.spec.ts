import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, bootAt, crashOnce, layoutProblems, openEntry, openTab, screen } from './fixtures';
import { nbLog, outItems, typeGap } from './trainingHelpers';

// Paket P7b (docs/neubau/plan.md §4.8, N101–N106): Kollokationen, Satz-Umformung, Einwand-Training,
// Posteingang, Nachsprechen. Paketkriterien: 5 Kollokationen mit Lehnübersetzung → Hinweis →
// Lösung; Einwand-Serie mit Zeitbalken, ohne KI Selbstcheck; Posteingang in 3 Schritten, Neuladen
// im Antwortfeld behält den Entwurf; Nachsprechen mit 3 Durchgängen; jede Übung ≤ 2 Tipps ab Reiter.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test('Einstiege: jede Übung 1 Tipp ab ihrem Reiter', async ({ page }) => {
  await boot(page, { migrated: true });
  await openTab(page, 'learn');
  await expect(page.getByTestId('training-colloc')).toBeVisible();
  await expect(page.getByTestId('training-transform')).toBeVisible();
  await openTab(page, 'speak');
  await expect(page.getByTestId('training-objection')).toBeVisible();
  await expect(page.getByTestId('training-shadow')).toBeVisible();
  await expect(page.getByTestId('training-inbox')).toBeVisible();
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

test('Einwand-Training ohne KI: Zeitbalken, Muster, Selbstcheck, Musterantwort, beste Antwort merken', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openEntry(page, 'training-objection');
  await screen(page, 'pressure');
  await expect(page.getByTestId('pressure-think')).toBeVisible();
  await expect(page.getByTestId('pressure-pattern')).toContainText('anerkennen');
  await expect(page.getByTestId('pressure-pattern')).toContainText('absichern');
  for (let i = 1; i <= 5; i++) {
    await expect(page.getByTestId('round-progress')).toHaveText(`${i} / 5`);
    await page.getByTestId('pressure-start').click();
    await expect(page.getByTestId('pressure-answer')).toBeVisible();
    await page.getByTestId('pressure-input').fill('I understand. What are you comparing us with? We include support. Shall we compare?');
    await page.getByTestId('pressure-check').click();
    const review = page.getByTestId('pressure-review');
    await expect(review).toHaveAttribute('data-mode', 'self');
    await expect(page.getByTestId('pressure-model')).toBeVisible();
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'unchecked');
    await page.getByTestId('selfcheck-acknowledge').check();
    await page.getByTestId('selfcheck-ask').check();
    await page.getByTestId('selfcheck-secure').check();
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('session-end')).toBeVisible();
  await expect(page.getByTestId('session-end')).toHaveAttribute('data-right', '5');
  // Ohne KI wird die Musterantwort gemerkt (nie ungeprüfter eigener Text).
  await page.getByTestId('pressure-save').click();
  await expect(page.getByTestId('pressure-save')).toHaveAttribute('data-state', 'saved');
  await expect.poll(async () => (await outItems(page)).filter((x) => x.k === 'objection').length).toBe(1);
  await expect.poll(async () => (await nbLog(page)).filter((x) => x.type === 'nb-objection').length).toBe(5);
});

test('Einwand-Training mit KI: Claude prüft das Muster im Hintergrund, Weiter wartet nie', async ({ page }) => {
  await boot(page, { migrated: true });
  await openEntry(page, 'training-objection');
  await screen(page, 'pressure');
  await page.getByTestId('pressure-start').click();
  await page.getByTestId('pressure-input').fill('I understand. What are you comparing us with? We include support. Shall we compare?');
  await page.getByTestId('pressure-check').click();
  await expect(page.getByTestId('pressure-review')).toHaveAttribute('data-mode', 'ai');
  await expect(page.getByTestId('pressure-pattern').locator('[data-move="ask"]')).toHaveAttribute('data-on', 'true');
  await expect(page.getByTestId('feedback-solution')).toContainText('side by side');
  await page.getByTestId('next').click();
  await expect(page.getByTestId('round-progress')).toHaveText('2 / 5');
});

test('Posteingang: 3 Schritte, Neuladen im Antwortfeld behält den Entwurf, Rückmeldung', async ({ page }) => {
  await bootAt(page, { name: 'inbox' }, { fake: { persist: true } });
  await screen(page, 'inbox');
  await expect(page.getByTestId('inbox')).toHaveAttribute('data-step', 'read');
  await expect(page.getByTestId('inbox-mail')).toBeVisible();
  await page.getByTestId('inbox-next').click();
  await page.getByTestId('inbox-gist').fill('Sie hat keine Zeit und der Chef entscheidet.');
  await page.getByTestId('inbox-next').click();
  await expect(page.getByTestId('inbox')).toHaveAttribute('data-step', 'reply');
  const draft = 'Hi Laura, thanks for your reply. I send you a short overview for your managing director.';
  await page.getByTestId('inbox-reply').fill(draft);
  await page.waitForTimeout(500);
  await page.reload();
  await screen(page, 'inbox');
  await expect(page.getByTestId('inbox')).toHaveAttribute('data-step', 'reply');
  await expect(page.getByTestId('inbox-reply')).toHaveValue(draft);
  await page.getByTestId('inbox-check').click();
  await expect(page.getByTestId('inbox-review')).toHaveAttribute('data-mode', 'ai');
  await expect(page.getByTestId('inbox-gist-verdict')).toBeVisible();
  await expect(page.getByTestId('feedback-fixes')).toContainText("I'll send you");
  await page.getByTestId('next').click();
  await expect.poll(async () => (await outItems(page)).filter((x) => x.k === 'inbox').length).toBe(1);
});

test('Posteingang ohne KI: Selbstvergleich mit Anliegen, Punkten und Musterantwort', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openEntry(page, 'training-inbox');
  await screen(page, 'inbox');
  await page.getByTestId('inbox-next').click();
  await page.getByTestId('inbox-gist').fill('Keine Zeit.');
  await page.getByTestId('inbox-next').click();
  await page.getByTestId('inbox-reply').fill('Thanks for your message. Let us talk again next month.');
  await page.getByTestId('inbox-check').click();
  await expect(page.getByTestId('inbox-review')).toHaveAttribute('data-mode', 'self');
  await expect(page.getByTestId('inbox-hidden')).toBeVisible();
  await expect(page.getByTestId('inbox-model')).toBeVisible();
  await page.getByTestId('inbox-must-0').check();
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'unchecked');
});

test('Nachsprechen: 3 Durchgänge mit 0,9 / 1,0 / 1,1, keine Wertung', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page, { migrated: true });
  await openEntry(page, 'training-shadow');
  await screen(page, 'pron');
  const item = page.getByTestId('shadow-item');
  await expect(item).toHaveAttribute('data-rate', '0.9');
  await page.getByTestId('shadow-start').click();
  await expect(page.getByTestId('shadow-you')).toBeVisible();
  await expect(item).toHaveAttribute('data-pass', '2', { timeout: 30_000 });
  await expect(item).toHaveAttribute('data-rate', '1');
  await expect(item).toHaveAttribute('data-pass', '3', { timeout: 30_000 });
  await expect(item).toHaveAttribute('data-rate', '1.1');
  await expect(page.getByTestId('session-end')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await outItems(page)).filter((x) => x.k === 'shadow').length).toBe(1);
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

test('Soll N108: Heißer Stuhl und Zeit gewinnen mit Zeitbalken und Muster zum Vergleich', async ({ page }) => {
  await boot(page, { migrated: true });
  await openEntry(page, 'training-hotseat');
  await screen(page, 'pressure');
  await expect(page.getByTestId('hotseat-item')).toBeVisible();
  await expect(page.getByTestId('pressure-think')).toBeVisible();
  await page.getByTestId('pressure-start').click();
  await page.getByTestId('pressure-input').fill("That's a fair question. We have run many projects like yours.");
  await page.getByTestId('pressure-check').click();
  await expect(page.getByTestId('pressure-review')).toHaveAttribute('data-mode', 'self');
  await expect(page.getByTestId('feedback-solution')).toBeVisible();
  await page.getByTestId('round-close').click();
  await openEntry(page, 'training-buytime');
  await screen(page, 'pressure');
  await expect(page.getByTestId('buytime-item')).toBeVisible();
  // Zeit gewinnen: keine Bedenkzeit, sofort Antwortzeit.
  await expect(page.getByTestId('pressure-answer')).toBeVisible();
  await page.getByTestId('pressure-input').fill("That's a fair question.");
  await page.getByTestId('pressure-check').click();
  await expect(page.getByTestId('pressure-starters')).toBeVisible();
});

test('Soll N109: Wortbetonung und Zahlen ohne KI', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openEntry(page, 'training-stress');
  await screen(page, 'pron');
  await expect(page.getByTestId('stress-item')).toHaveAttribute('data-id', 's01');
  await page.getByTestId('syll-1').click();
  await expect(page.getByTestId('stress-item')).toHaveAttribute('data-state', 'wrong');
  await expect(page.getByTestId('feedback-solution')).toHaveText(/DOC·u·ment/);
  await page.getByTestId('next').click();
  await expect(page.getByTestId('round-progress')).toHaveText('2 / 8');
  await page.getByTestId('round-close').click();
  await openEntry(page, 'training-numbers');
  await screen(page, 'pron');
  await expect(page.getByTestId('number-show')).toHaveText('€1.5bn');
  await page.getByTestId('number-reveal').click();
  await expect(page.getByTestId('feedback-solution')).toContainText('one point five billion euros');
});

for (const theme of ['dark', 'dim', 'light'] as const) {
  test(`Barrierefreiheit (${theme}): Kollokation und Posteingang ohne ernste axe-Verstöße`, async ({ page }) => {
    await boot(page, { migrated: true, theme, lang: theme === 'light' ? 'en' : 'de' });
    await openEntry(page, 'training-colloc');
    await screen(page, 'nbdrill');
    const a = await new AxeBuilder({ page }).include('[data-testid="nbdrill"]').analyze();
    expect(a.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    await page.getByTestId('round-close').click();
    await openEntry(page, 'training-inbox');
    await screen(page, 'inbox');
    const b = await new AxeBuilder({ page }).include('[data-testid="inbox"]').analyze();
    expect(b.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
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
