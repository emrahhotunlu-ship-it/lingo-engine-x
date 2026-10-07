import { expect, test, type Browser, type Page } from '@playwright/test';
import { boot, bootAt, screen } from './fixtures';
import { answerGrammar, grammarKey, shownPrompt, typeInGap } from './learnHelpers';
import { DAY, dump, expected, planPatch } from './trainerHelpers';
import { TYPE_MODE } from './trainerHelpers';

// „Erst ein Hinweis, dann die Lösung" (Lernberatung Vorschlag 4): Falsch getippt → gezielter
// Hinweis unter der Lücke, Eingabe bleibt stehen, Fokus bleibt in der Lücke, zweiter Versuch.
// Richtig im zweiten Versuch → höchstens „Schwer"; genau ein Ergebnis je Karte bzw. Aufgabe.

type Doc = Record<string, unknown>;
const solve = grammarKey();

/** overcome: Stufe 4, schwächste Art „cloze" (freie Lücke ohne Platzhalter). */
const OVERCOME = { 'vocab/overcome': { state: 'learning', stage: 4, S: 1, D: 5, due: 1_700_000_000_000, last: 1_699_900_000_000, reps: 3, lapses: 0, xs: { cloze: { c: 0, w: 6 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } } } };

const entriesFor = async (page: Page, id: string) => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.id === id);

async function startCloze(page: Page) {
  const booted = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...OVERCOME } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze');
  return booted;
}

async function phone(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}

const focusedTestId = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid') ?? null);

/** Vokabel: falsch → Hinweis → richtig. Prüft Anzeige, Fokus, Note und genau einen Eintrag. */
async function vocabRetryCorrect(page: Page) {
  const { errors } = await startCloze(page);
  const answer = expected('cloze', 'overcome', null);
  const before = (await entriesFor(page, 'overcome')).length;
  await typeInGap(page, 'zzzz');
  await page.keyboard.press('Enter');
  const hint = page.locator('[data-testid="hint-line"][data-tone="near"]');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText(`„${answer.slice(0, 2)}…“`);
  await expect(hint).toContainText(`(${answer.length} Buchstaben)`);
  // Noch kein Ergebnis, keine Lösung im DOM, die falsche Eingabe steht noch in der Lücke.
  await expect(page.getByTestId('result')).toHaveCount(0);
  await expect(page.getByTestId('verdict')).toHaveCount(0);
  expect((await page.locator('main').innerText()).toLowerCase()).not.toContain(answer.toLowerCase());
  await expect(page.getByTestId('gap')).toHaveAttribute('data-state', 'input');
  await expect(page.getByTestId('gap')).toContainText('zzzz');
  // Der Anfang ist aufgedeckt (Platzhalter mit erstem Buchstaben), „Tipp" gibt es nicht mehr.
  await expect(page.getByTestId('gap')).toHaveAttribute('data-masked', '');
  await expect(page.locator('.lx-slot-hint')).toHaveText(answer.slice(0, 1));
  await expect(page.getByTestId('hint')).toHaveCount(0);
  expect(await focusedTestId(page)).toBe('gap-input');

  // Zweiter Versuch: korrigieren und prüfen.
  for (let i = 0; i < 4; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type(answer, { delay: 20 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  // Hinweis „beginnt mit …" hieß: das Wort war nicht bekannt → trotz Treffer „Nochmal" (Lernwissenschaft 27.09.).
  await expect(page.getByTestId('next-in')).toHaveText('Wieder in 1 Min.');
  await expect(page.locator('[data-testid="hint-line"][data-tone="near"]')).toHaveCount(0);
  // Erklärung und Beispiele auch nach richtigem zweitem Versuch; kein automatisches Weiter.
  await expect(page.getByTestId('examples')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByTestId('next')).toBeVisible();
  await page.getByTestId('next').click();
  await expect.poll(async () => (await entriesFor(page, 'overcome')).length).toBe(before + 1);
  const last = (await entriesFor(page, 'overcome')).at(-1);
  expect(last).toMatchObject({ ok: false, ans: answer });
  expect(errors).toEqual([]);
}

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Vokabel: falsch → Hinweis unter der Lücke, Eingabe bleibt, Fokus bleibt; zweiter Versuch richtig → „Nochmal" (Anfang verraten), ein Eintrag', async ({ page }) => {
    await vocabRetryCorrect(page);
  });

  test('Vokabel: zweiter Versuch auch falsch → Lösung, „Nochmal", ein Eintrag', async ({ page }) => {
    const { errors } = await startCloze(page);
    const answer = expected('cloze', 'overcome', null);
    const before = (await entriesFor(page, 'overcome')).length;
    await typeInGap(page, 'zzzz');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="hint-line"][data-tone="near"]')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    await expect(page.getByTestId('gap-solution')).toContainText(answer);
    await expect(page.getByTestId('next-in')).toHaveText('Wieder in 1 Min.');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await entriesFor(page, 'overcome')).length).toBe(before + 1);
    expect((await entriesFor(page, 'overcome')).at(-1)).toMatchObject({ ok: false });
    expect(errors).toEqual([]);
  });

  test('Vokabel: „fast richtig" (Tippfehler) bleibt wie bisher – sofort Ergebnis, kein Hinweis', async ({ page }) => {
    const { errors } = await startCloze(page);
    const answer = expected('cloze', 'overcome', null);
    await typeInGap(page, answer.slice(0, -1));
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'near');
    await expect(page.locator('[data-testid="hint-line"][data-tone="near"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Grammatik: getippte Aufgabe falsch → Hinweis, zweiter Versuch richtig → „Schwer", kein Fehlereintrag', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
    const item = page.getByTestId('gr-item');
    // Auswahl-, Bedeutungs- und „Fehler finden“-Aufgaben richtig beantworten, bis eine getippte Aufgabe in der Lücke kommt.
    for (let i = 0; i < 12; i++) {
      await expect(item).toHaveCount(1);
      await expect(item.getByTestId('task')).toBeVisible();
      if (!['mc', 'meaning', 'find'].includes((await item.getAttribute('data-type')) ?? '')) break;
      await answerGrammar(page, solve);
      await page.getByTestId('next').click();
      await expect(item.getByTestId('result')).toHaveCount(0);
    }
    const type = (await item.getAttribute('data-type')) ?? '';
    const topic = (await item.getAttribute('data-topic')) ?? '';
    expect(['mc', 'meaning', 'find']).not.toContain(type);
    const prompt = await shownPrompt(page);
    const answer = solve(prompt);
    expect(answer).not.toBeNull();
    const errorsBefore = ((await dump(page))[`grammar/${topic}`]?.errors as unknown[] | undefined)?.length ?? 0;
    const whole = (await item.getByTestId('correct-input').count()) > 0;
    if (whole) await item.getByTestId('correct-input').fill('zzzz wrong');
    else await typeInGap(page, 'zzzz wrong');
    await page.getByTestId('check').click();
    // Leitfrage des Musters bzw. „Achte auf …“; sie verrät die Lösung nicht.
    const retry = item.locator('[data-testid="hint-line"][data-tone="near"]');
    await expect(retry).toBeVisible();
    await expect(retry).not.toHaveText('');
    await expect(item.getByTestId('result')).toHaveCount(0);
    await expect(item.getByTestId('hint')).toHaveCount(0);
    if (whole) await expect(item.getByTestId('correct-input')).toHaveValue('zzzz wrong');
    else {
      await expect(item.getByTestId('gap')).toContainText('zzzz');
      expect(await focusedTestId(page)).toBe('gap-input');
      for (let i = 0; i < 'zzzz wrong'.length; i++) await page.keyboard.press('Backspace');
    }
    if (whole) await item.getByTestId('correct-input').fill(answer ?? '');
    else await page.keyboard.type(answer ?? '', { delay: 10 });
    await page.getByTestId('check').click();
    await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(item.getByTestId('explanation')).toBeVisible();
    await page.getByTestId('next').click();
    const logged = async () => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g' && e.topic === topic && e.given !== 'zzzz wrong' && e.ok === true && e.g === 2);
    await expect.poll(async () => (await logged()).length).toBe(1);
    const all = (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.given === 'zzzz wrong');
    expect(all).toHaveLength(0);
    expect(((await dump(page))[`grammar/${topic}`]?.errors as unknown[] | undefined)?.length ?? 0).toBe(errorsBefore);
    expect(errors).toEqual([]);
  });
});

test('Handy 390: Vokabel-Hinweis, Eingabe bleibt in der Lücke, zweiter Versuch richtig → „Nochmal" (Anfang verraten)', async ({ browser }) => {
  const { page, close } = await phone(browser);
  await vocabRetryCorrect(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await close();
});
