import { expect, test, type Browser, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, type Lang } from './fixtures';
import { expected, forcedPatch, planPatch } from './trainerHelpers';
import { TYPE_MODE } from './trainerHelpers';

// Befunde aus Daten-, Plattform- und UX-Prüfung des umgebauten Vokabeltrainers.
// Gegen den Produktions-Build mit eingespieltem Adapter.

const forced = (id: string) => forcedPatch()[`vocab/${id}`] ?? {};

async function startWith(page: Page, patch: Record<string, Record<string, unknown>>, opts: { lang?: Lang } = {}) {
  const booted = await boot(page, { migrated: true, ...(opts.lang ? { lang: opts.lang } : {}), fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...patch } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

async function mobile(browser: Browser, height = 844) {
  const context = await browser.newContext({ viewport: { width: 375, height }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  return { context, page };
}

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('B1: „void" bei vorgegebenem „a" ist richtig; der Buchstabe bleibt auf Platz 1', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/avoid': forced('avoid') });
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze_hint');
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('void', { delay: 20 });
    // Platz 1 zeigt weiter das „a", die Eingabe steht auf den Plätzen 2–5.
    const slots = page.locator('[data-slot="letter"]');
    await expect(slots.nth(0)).toHaveText('a');
    await expect(slots.nth(1)).toHaveText('v');
    await expect(slots.nth(4)).toHaveText('d');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(page.getByTestId('gap')).toHaveText('avoid');
    expect(errors).toEqual([]);
  });

  test('B2/B3: „Tipp" zeigt sichtbare Plätze in der Box; überzählige Buchstaben bekommen eigene Plätze', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/overcome': forced('overcome') });
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze');
    await page.getByTestId('hint').click();
    const slots = page.locator('[data-slot="letter"]');
    await expect(slots).toHaveCount(8);
    const gap = (await page.getByTestId('gap').boundingBox())!;
    for (const b of await slots.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))) {
      expect(b.height).toBeGreaterThan(10);
      expect(b.left).toBeGreaterThanOrEqual(gap.x - 1);
      expect(b.right).toBeLessThanOrEqual(gap.x + gap.width + 1);
      expect(b.bottom).toBeLessThanOrEqual(gap.y + gap.height + 1);
    }
    await page.keyboard.type('overcomingly', { delay: 20 });
    await page.waitForTimeout(400);
    await expect(page.locator('[data-slot="extra"]')).toHaveCount(4);
    const letters = await page.locator('[data-letter]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
    for (let i = 1; i < letters.length; i++) expect(letters[i]!.left).toBeGreaterThanOrEqual(letters[i - 1]!.right - 0.5);
    const gap2 = (await page.getByTestId('gap').boundingBox())!;
    expect(letters.at(-1)!.right).toBeLessThanOrEqual(gap2.x + gap2.width + 1);
    expect(errors).toEqual([]);
  });

  test('H2/H3: Tippfehler zeigt den fehlenden Buchstaben; kein doppelter Formhinweis, keine doppelte Bedeutung', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/struggle': forced('struggle') });
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'type');
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('to strugle', { delay: 20 });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveText('≈Fast richtig');
    await expect(page.getByTestId('verdict-sub')).toHaveText('Tippfehler');
    // Die Lösung gleitet in die Lücke, die eigene Eingabe steht klein durchgestrichen darüber (Vergleich nur, wo die Lücke sie nicht zeigt).
    await expect(page.getByTestId('gap-solution')).toContainText('to struggle');
    await expect(page.getByTestId('gap-given')).toContainText('to strugle');
    await expect(page.getByTestId('form-hint')).toHaveCount(0);
    // Keine doppelte Bedeutung: Die Frage zeigt sie, die Erklär-Karte wiederholt sie nicht.
    const cue = (await page.getByTestId('cue-meaning').innerText()).trim();
    await expect(page.getByTestId('explanation')).not.toContainText(cue);
    expect(errors).toEqual([]);
  });

  test('H1/H3: Wortpartner falsch – die Lösung gleitet in die Lücke (nicht rot), die Warum-Zeile nennt das Partnerwort', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/handle': forced('handle') });
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'colloc');
    const col = await page.locator('[data-col]').first().getAttribute('data-col');
    const answer = expected('colloc', 'handle', col === null ? null : Number(col));
    // Der Wortpartner wird getippt (die Auswahl gibt es nur als Tipp 2).
    await expect(page.getByTestId('choice')).toHaveCount(0);
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('zzzz', { delay: 20 });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hint-line')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    await expect(page.getByTestId('gap')).toHaveAttribute('data-state', 'reveal');
    await expect(page.getByTestId('gap-solution')).toContainText(answer);
    await expect(page.getByTestId('explanation')).toContainText(answer);
    expect(errors).toEqual([]);
  });

  test('B4/F5/F10: nach falscher Antwort „unsicher", die Wiederholung ist als „noch einmal" markiert', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/avoid': forced('avoid') });
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('zzzz', { delay: 20 });
    await page.keyboard.press('Enter');
    // Erst ein Hinweis, dann der zweite Versuch (unverändert → falsch).
    await expect(page.getByTestId('hint-line')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    await expect(page.getByTestId('status')).toContainText('Lernt');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-step]')).toHaveCount(1);
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-card', 'avoid');
    await expect(page.getByTestId('status')).toContainText('Lernt');
    await expect(page.getByTestId('again-badge')).toHaveText('noch einmal');
    expect(errors).toEqual([]);
  });

  test('H5/H6/F1: -ing zuerst als Verb, Satzzeichen bleibt am Wort, Zielwort in Beispielen markiert', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/avoid': forced('avoid') });
    const hour = page.getByTestId('sentence').locator('button.lx-word[data-word="hour"]');
    await expect(hour.locator('xpath=..')).toHaveClass(/whitespace-nowrap/);
    await expect(hour.locator('xpath=..')).toHaveText('hour.');
    await page.getByTestId('sentence').locator('button.lx-word[data-word="driving"]').click();
    await expect(page.getByTestId('lk-pos')).toHaveText('Verb');
    await expect(page.getByTestId('lk-dict-note')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('avoid', { delay: 20 });
    await page.keyboard.press('Enter');
    // Die Erklär-Karte steht; das Hervorheben des Zielworts in den Beispielen fehlt noch (Befund für P1, `Examples` kennt kein `mark`).
    await expect(page.getByTestId('explanation')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('H-D: Schließen per Knopf oder Klick außerhalb gibt den Fokus an die Lücke zurück', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/avoid': forced('avoid') });
    const active = () => page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.testid ?? document.activeElement?.tagName);
    await page.getByTestId('gap-input').click();
    await expect.poll(active).toBe('gap-input');
    await page.getByTestId('sentence').locator('button.lx-word[data-word="driving"]').click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await expect.poll(active).toBe('lookup');
    await page.getByTestId('lk-close').click();
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await expect.poll(active).toBe('gap-input');
    await page.getByTestId('sentence').locator('button.lx-word[data-word="rush"]').click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await expect.poll(active).toBe('gap-input');
    // Auch langes Drücken auf eine leere Stelle (> 1 s) gibt den Fokus zurück (keine Zeitgrenze).
    await page.getByTestId('sentence').locator('button.lx-word[data-word="rush"]').click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.mouse.move(5, 5);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await page.mouse.up();
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await expect.poll(active).toBe('gap-input');
    // Getippt wird direkt weiter.
    await page.keyboard.type('avoid', { delay: 20 });
    await expect(page.locator('[data-slot="letter"][data-filled]')).toHaveCount(5);
    expect(errors).toEqual([]);
  });

  test('B6: englische Bedeutungen werden nie mitten im Wort abgeschnitten', async ({ page }) => {
    const { errors } = await startWith(page, { 'vocab/deserve': forced('deserve') }, { lang: 'en' });
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'mc_en');
    for (const label of await page.getByTestId('choice').allInnerTexts()) expect(label.trim()).not.toMatch(/…$/);
    expect(errors).toEqual([]);
  });
});

test('Handy: Nachschlage-Blatt lässt sich bei niedriger Höhe per Finger scrollen', async ({ browser }) => {
  const { context, page } = await mobile(browser, 520);
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/avoid': forced('avoid') } } });
  await screen(page, 'today');
  await page.getByTestId('start').tap();
  await screen(page, 'trainer');
  await page.getByTestId('gap-input').tap();
  await page.keyboard.type('avoid');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('next')).toBeVisible();
  await page.getByTestId('sentence').locator('button.lx-word[data-word="driving"]').tap();
  const lk = page.getByTestId('lookup');
  await expect(lk).toBeVisible();
  // „Claude fragen" öffnet seit Phase 5 den Begleiter (E5-09); das Blatt wird hier nur durch die niedrige Höhe voll.
  await expect(page.getByTestId('lk-ipa')).toBeVisible();
  await page.waitForTimeout(400);
  const m = await lk.evaluate((el) => ({ ch: el.clientHeight, sh: el.scrollHeight, ta: getComputedStyle(el).touchAction }));
  expect(m.sh, 'Inhalt höher als das Blatt').toBeGreaterThan(m.ch);
  expect(m.ta).not.toBe('pan-x');
  const box = (await lk.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const y0 = Math.round(box.y + box.height * 0.8);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - 6 * i }] });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
  await expect(lk).toBeVisible();
  expect(await lk.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(errors).toEqual([]);
  await context.close();
});

test('Handy: keine Ziffern-Tasten an den Auswahlknöpfen', async ({ browser }) => {
  const { context, page } = await mobile(browser);
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/deserve': forced('deserve') } } });
  await screen(page, 'today');
  await page.getByTestId('start').tap();
  await screen(page, 'trainer');
  await expect(page.getByTestId('choice').first()).toBeVisible();
  // Am Handy tragen die Optionen Buchstaben A–D als Kennzeichnung, keine Ziffern (Tasten gibt es dort nicht).
  const keys = await page.locator('.lx-choice-key').allInnerTexts();
  expect(keys.length).toBeGreaterThan(1);
  for (const k of keys) expect(k.trim()).toMatch(/^[A-D]$/);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
