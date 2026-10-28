import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { MON, MON_9, WEEK_W39, profileWith, reviewedLog, vgPlan } from './heuteHelpers';
import { grammarKey, shownPrompt } from './learnHelpers';
import { expected, forcedPatch, planPatch } from './trainerHelpers';

// Tastatur am Laptop (Relaunch Stufe 1 P3 S1-BAND, stufe1-plan §6.4): eine Wörter-Runde und eine Grammatik-Runde auf 1440 px,
// nur mit der Tastatur von „Heute“ bis zur Abschlusskarte. ⏎ prüft bzw. geht weiter, 1–4 wählen, T = Tipp, W = „Weiß ich nicht“,
// ? = Tastenübersicht, Esc schließt Übersicht/Menü/Kontextspalte, verlässt aber NIE die Übung.
// Kein Mausklick: Felder bekommen den Fokus wie per Tab (`focus()`), alles Weitere sind Tastendrücke.

test.use({ viewport: { width: 1440, height: 900 } });

const choiceIndex = async (page: Page, answer: string): Promise<number> => {
  const labels = (await page.getByTestId('choice').locator('[lang]').allInnerTexts()).map((l) => l.trim());
  const idx = labels.findIndex((l) => l === answer);
  expect(idx, `„${answer}“ in ${labels.join(' | ')}`).toBeGreaterThanOrEqual(0);
  return idx;
};

/** Esc in der Übung: bleibt in der Übung (nie verlassen). */
async function escStays(page: Page, item: string): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(item)).toBeVisible();
}

/** ? öffnet die Tastenübersicht, Esc schließt sie – die Übung bleibt. */
async function keysHelp(page: Page, item: string): Promise<void> {
  await page.keyboard.press('?');
  const help = page.getByTestId('keys-help');
  await expect(help).toBeVisible();
  for (const k of ['⏎', 'T', 'W', '1–4', 'Esc', '?']) await expect(help.locator('kbd', { hasText: k }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
  await expect(page.getByTestId(item)).toBeVisible();
}

test('Wörter-Runde nur per Tastatur: Heute → Abschlusskarte; 1–4, ⏎, T, W, ?, Esc nie raus', async ({ page }) => {
  test.slow();
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(6), ...forcedPatch() } } });
  await screen(page, 'today');
  await page.getByTestId('start').focus();
  await page.keyboard.press('Enter');
  await screen(page, 'trainer');

  let usedDigit = false;
  let usedHint = false;
  let usedDontKnow = false;
  let probed = false;
  for (let i = 0; i < 30; i++) {
    await expect(page.locator('[data-step]')).toHaveCount(1);
    if (await page.getByTestId('summary').isVisible()) break;
    const exEl = page.getByTestId('exercise');
    await expect(exEl).toBeVisible();
    const ex = (await exEl.getAttribute('data-ex')) ?? '';
    const id = (await exEl.getAttribute('data-card')) ?? '';
    const kind = (await exEl.getAttribute('data-kind')) ?? 'vocab';
    const colAttr = await page.locator('[data-col]').first().getAttribute('data-col').catch(() => null);
    const answer = expected(ex, id, colAttr === null ? null : Number(colAttr), kind, 'de');
    if (!probed) {
      // Esc und ? in der laufenden Aufgabe: die Übung bleibt.
      await escStays(page, 'exercise');
      await keysHelp(page, 'exercise');
      probed = true;
    }
    if (['mc_en', 'ctx_mc', 'mc_de', 'colloc_gap', 'listen_mc'].includes(ex)) {
      if (!usedDontKnow && usedDigit) {
        // W = „Weiß ich nicht“: die Lösung wird gezeigt, ruhig und neutral.
        await page.keyboard.press('w');
        await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'dontKnow');
        usedDontKnow = true;
      } else {
        const idx = await choiceIndex(page, answer);
        await page.keyboard.press(String(idx + 1));
        await expect(page.getByTestId('choice').nth(idx)).toHaveAttribute('aria-pressed', 'true');
        await page.keyboard.press('Enter');
        usedDigit = true;
      }
    } else {
      const input = page.getByTestId('gap-input');
      await expect(input).toBeAttached();
      await input.focus();
      // Im Textfeld gelten nur ⏎ und Esc: T und W werden getippt, nicht als Kürzel genommen.
      await page.keyboard.type(answer, { delay: 20 });
      if (!usedHint) {
        // T aus dem Feld heraus (Feld ohne Fokus): der Tipp erscheint als ruhige Zeile, die Antwort bleibt stehen.
        await input.evaluate((el) => (el as HTMLElement).blur());
        const hint = page.getByTestId('hint');
        if (await hint.isVisible()) {
          await page.keyboard.press('t');
          await expect(page.getByTestId('hint-line')).toBeVisible();
          usedHint = true;
        }
        await input.focus();
      }
      await page.keyboard.press('Enter');
      // Ein „w“ oder „t“ im getippten Wort hat nichts ausgelöst: kein „Weiß ich nicht“.
      await expect(page.getByTestId('verdict')).not.toHaveAttribute('data-verdict', 'dontKnow');
    }
    await expect(page.getByTestId('verdict')).toBeVisible();
    // Esc im Ergebnis: die Übung bleibt, das Ergebnis auch.
    await escStays(page, 'result');
    const step = await page.locator('[data-step]').getAttribute('data-step');
    await page.keyboard.press('Enter');
    await expect(page.locator(`[data-step="${step}"]`)).toHaveCount(0);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(usedDigit, '1–4 benutzt').toBe(true);
  expect(usedDontKnow, 'W benutzt').toBe(true);
  expect(usedHint, 'T benutzt').toBe(true);
  expect(errors).toEqual([]);
});

test('Grammatik-Runde nur per Tastatur: Heute → Abschlusskarte; 1–4 und ⏎, Esc nie raus', async ({ page }) => {
  test.slow();
  const { errors } = await boot(page, { migrated: true, now: MON_9, fake: { capabilities: { sample: false }, patch: { ...WEEK_W39, ...profileWith(MON, vgPlan(), []), ...reviewedLog(MON) } } });
  await screen(page, 'today');
  await page.getByTestId('start').focus();
  await page.keyboard.press('Enter');
  await screen(page, 'grammarSession');
  const solve = grammarKey();
  let probed = false;
  for (let i = 0; i < 14; i++) {
    await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('task')).toBeVisible();
    if (!probed) {
      await escStays(page, 'gr-item');
      await keysHelp(page, 'gr-item');
      probed = true;
    }
    const type = (await item.getAttribute('data-type')) ?? '';
    const shown = await shownPrompt(page);
    const known = solve.full(shown);
    const answer = known?.answer ?? solve(shown) ?? '';
    if (type === 'mc' || type === 'meaning') {
      const labels = (await item.getByTestId('choice').allInnerTexts()).map((l) => l.replace(/^(?:\d+\s*|[A-F]\s+)/, '').trim());
      let idx = type === 'meaning' ? ['a', 'b', 'both'].indexOf(answer || 'a') : labels.findIndex((l) => l === answer);
      if (idx < 0) idx = 0;
      await page.keyboard.press(String(idx + 1));
      await page.keyboard.press('Enter');
    } else if (type === 'find') {
      // Stelle per Tab-Fokus und ⏎ wählen; ein fehlerfreier Satz → „Kein Fehler“.
      const err = known?.err ?? null;
      if (err === null) {
        await item.getByTestId('no-error').focus();
        await page.keyboard.press('Enter');
      } else {
        await item.getByTestId('spot-word').nth(err[0]).focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        const input = page.getByTestId('gap-input');
        await input.focus();
        await page.keyboard.type(answer, { delay: 10 });
        await page.keyboard.press('Enter');
      }
    } else if (await item.getByTestId('correct-input').count()) {
      const input = item.getByTestId('correct-input');
      await input.focus();
      await page.keyboard.press('ControlOrMeta+A');
      await page.keyboard.type(answer, { delay: 5 });
      await page.keyboard.press('Enter');
    } else {
      const input = page.getByTestId('gap-input');
      await expect(input).not.toHaveAttribute('aria-hidden', 'true');
      await input.focus();
      await page.keyboard.type(answer, { delay: 10 });
      await page.keyboard.press('Enter');
    }
    const near = item.locator('[data-testid="hint-line"][data-tone="near"]');
    await expect(item.getByTestId('verdict').or(near).first()).toBeVisible();
    if (await near.isVisible()) await page.keyboard.press('Enter');
    await expect(item.getByTestId('verdict')).toBeVisible();
    await escStays(page, 'gr-item');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(errors).toEqual([]);
});
