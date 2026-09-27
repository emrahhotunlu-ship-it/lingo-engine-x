import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { grammarKey, L07_OUTPUT, lessonMeta, playLesson, storedL07 } from './learnHelpers';
import { dump } from './trainerHelpers';

// KI-Wege, die bisher ohne feste Testantwort waren (Prüfbericht): „Mit Claude ergänzen",
// „Neue Wörter", Merkhilfe, Rückmeldung zum Schritt „Anwenden" der Lektion und „Neue Aufgaben".
// Die Antworten kommen aus src/platform/dev/cannedLearn.ts und gehen durch die zod-Prüfung.

type Doc = Record<string, unknown>;
type Call = { id: string | null };
const calls = async (page: Page, id: string): Promise<number> =>
  (await page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Call[] } }).__LINGO_FAKE__.sampleCalls])).filter((c) => c.id === id).length;

test.use({ viewport: { width: 1440, height: 900 } });

async function openVocab(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  await page.getByTestId('hub-vocab').click();
  await expect(page.getByTestId('vocab')).toBeVisible();
}

test('„Mit Claude ergänzen" füllt Deutsch und Beispielsatz; die Karte wird gespeichert', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await openVocab(page);
  await page.getByTestId('vocab-add').click();
  await page.getByTestId('add-en').fill('benchmark');
  await page.getByTestId('add-fill').click();
  await expect(page.getByTestId('add-de')).toHaveValue('Vergleichsmaßstab, Richtwert');
  await expect(page.getByTestId('add-ex')).toHaveValue(/benchmark/);
  expect(await calls(page, 'word-gen')).toBe(1);
  await page.getByTestId('add-save').click();
  await expect.poll(async () => (await dump(page))['vocab/benchmark']?.word).toBe('benchmark');
  expect((await dump(page))['vocab/benchmark']).toMatchObject({ src: 'user', de: 'Vergleichsmaßstab, Richtwert' });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('„Neue Wörter von Claude": Liste ohne bekannte Wörter, ein Wort übernehmen', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openVocab(page);
  await page.getByTestId('vocab-add').click();
  await page.getByTestId('add-gen-general').click();
  const words = page.getByTestId('gen-word');
  await expect(words.first()).toBeVisible();
  expect(await words.count()).toBeGreaterThanOrEqual(6);
  const first = (await words.first().getAttribute('data-word')) ?? '';
  await words.first().getByTestId('gen-add').click();
  const saved = async () => Object.entries(await dump(page)).find(([p, d]) => p.startsWith('vocab/') && d.word === first)?.[1];
  await expect.poll(async () => (await saved())?.src).toBe('ai');
  expect(typeof (await saved())?.ex).toBe('string');
  expect(errors).toEqual([]);
});

test('Wortblatt: alte Ergebnisse je Abfrageart sichtbar; Merkhilfe von Claude wird an der Karte gespeichert', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'vocab/deserve': { lapses: 4 } } } });
  await openVocab(page);
  await page.getByTestId('vocab-search').fill('deserve');
  await page.locator('[data-testid="vocab-row"][data-word="deserve"]').click();
  const sheet = page.getByTestId('word-sheet');
  await expect(sheet).toBeVisible();
  // W4: Werte der alten App ({modus: {c, w}}) erscheinen.
  await expect(sheet.getByTestId('word-balance')).toContainText('Erkennen (bisher)');
  await expect(sheet.getByTestId('word-balance')).toContainText('6 von 6 richtig');
  await sheet.getByTestId('mnemo-ask').click();
  await expect(sheet.getByTestId('mnemo')).toContainText('deserve');
  await expect.poll(async () => ((await dump(page))['vocab/deserve']?.mnemo as Doc | undefined)?.lang).toBe('de');
  expect(errors).toEqual([]);
});

test('Lektion „Anwenden": Rückmeldung von Claude, Schreibdokument gespeichert', async ({ page }) => {
  const l07 = storedL07();
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'lesson/l07': l07 } } });
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await page.getByTestId('hub-course').click();
  await page.locator('[data-testid="lesson-row"][data-lesson="l07"]').click();
  const answers: Record<string, string> = {};
  for (const q of l07.questions as Array<{ q: string; answer: string }>) answers[q.q] = q.answer;
  await playLesson(page, { words: lessonMeta('l07').words.map(([en, de]) => ({ en, de })), solve: grammarKey([l07]), answers, output: L07_OUTPUT, aiCheck: true });
  expect(await calls(page, 'lesson-production')).toBe(1);
  const writing = Object.entries(await dump(page)).find(([p]) => p.startsWith('writing/lesson-l07-'));
  expect(writing?.[1]).toMatchObject({ lesson: 'l07', res: { pv: 'lesson-production@1' } });
  expect(errors).toEqual([]);
});

test('„Neue Aufgaben zu {Thema}": gespeichert im Pool und in der nächsten Themenrunde zuerst', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await page.getByTestId('hub-grammar').click();
  await expect(page.getByTestId('grammar')).toBeVisible();
  // Das erste Thema, bei dem der Knopf erscheint (weniger als 8 ungesehene Aufgaben).
  const topics = await page.getByTestId('topic').evaluateAll((els) => els.map((e) => e.getAttribute('data-topic') ?? ''));
  let found = '';
  for (const tp of topics) {
    await page.locator(`[data-testid="topic"][data-topic="${tp}"]`).click();
    await expect(page.getByTestId('rule-sheet')).toBeVisible();
    if (await page.getByTestId('gr-generate').isVisible()) {
      found = tp;
      break;
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('rule-sheet')).toHaveCount(0);
  }
  expect(found, 'ein Thema mit „Neue Aufgaben"').not.toBe('');
  await page.getByTestId('gr-generate').click();
  await expect.poll(async () => calls(page, 'grammar-items')).toBe(1);
  await expect.poll(async () => JSON.stringify((await dump(page))['app/pool'] ?? {})).toContain(`"topic":"${found}"`);
  await page.getByTestId('topic-start').click();
  const item = page.getByTestId('gr-item');
  // Fällige Fehler stehen vorn (höchstens 3), danach die neuen Aufgaben.
  let src = '';
  for (let i = 0; i < 4; i++) {
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('data-topic', found);
    src = (await item.getAttribute('data-src')) ?? '';
    if (src === 'ai') break;
    await item.getByTestId('dont-know').click();
    await page.getByTestId('next').click();
  }
  expect(src).toBe('ai');
  expect(errors).toEqual([]);
});
