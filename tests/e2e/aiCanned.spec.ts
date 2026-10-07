import { readFileSync } from 'node:fs';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import bank from '../../src/content/grammar-bank.json' with { type: 'json' };
import { expect, test, type Page } from '@playwright/test';
import { boot, screen, openTab } from './fixtures';
import { skipMiniLesson } from './learnHelpers';
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
  await openTab(page, 'vocab');
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
  await page.getByTestId('vocab-search-open').click();
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

test('„Neue Aufgaben zu {Thema}": gespeichert im Pool und in der nächsten Themenrunde zuerst', async ({ page }) => {
  // Mit Bank und Musteraufgaben (Lernplattform 2.0) hat jedes Thema viele Aufgaben: Der Knopf erscheint erst, wenn ein Thema fast durchgespielt ist.
  const v2 = (JSON.parse(readFileSync(new URL('../../src/content/grammar/tasks-v2.json', import.meta.url), 'utf8')) as { tasks: Array<{ topic: string; type: string; frame?: string; prompt?: string; a?: string }> }).tasks;
  const seen = [
    ...(bank.tasks as Array<{ topic: string; prompt: string }>).filter((x) => x.topic === 'passive').map((x) => legacyTaskKey(x.prompt)),
    // Schlüssel der neuen Aufgabenarten: Rahmensatz (kwt), Satz (find), Satz a (meaning).
    ...v2.filter((x) => x.topic === 'passive').map((x) => legacyTaskKey((x.type === 'kwt' ? x.frame : x.type === 'find' ? x.prompt : x.a) ?? '')),
  ];
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'grammar/passive': { seen } } } });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await expect(page.getByTestId('learn-hub')).toBeVisible();
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
  await skipMiniLesson(page);
  const item = page.getByTestId('gr-item');
  // Fällige Fehler stehen vorn (höchstens 3), danach die neuen Aufgaben.
  let src = '';
  for (let i = 0; i < 4; i++) {
    await expect(item).toBeVisible();
    await expect(item).toHaveAttribute('data-topic', found);
    src = (await item.getAttribute('data-src')) ?? '';
    if (src === 'pool') break;
    await item.getByTestId('dont-know').click();
    await page.getByTestId('next').click();
  }
  expect(src).toBe('pool');
  expect(errors).toEqual([]);
});
