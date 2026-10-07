import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey } from './learnHelpers';
import { dump } from './trainerHelpers';

// P26 (Lernplattform 3.0, KI-Tutor T1): „Erklär mir meine Antwort“ mit explain-answer@2 – Vermutung zuerst, genau die erlaubten Aufrufe,
// Kennzeichnung, Melden, Speichern in der Datenbank, ohne Claude weder Knopf noch Zeile. Die Testlaufzeit antwortet fest (`canned/lp3/p26.ts`).

const solve = grammarKey();
type Fake = { sampleCalls: Array<{ id: string | null; tier: string }>; explainMode?: string };

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'explain-answer').map((c) => `${c.id}:${c.tier}`));
const mode = (page: Page, m: string): Promise<void> => page.evaluate((v) => void ((window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.explainMode = v), m);

async function wrongAnswer(page: Page): Promise<void> {
  await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await answerGrammar(page, solve, { wrong: true });
  await expect(page.getByTestId('tutor-ask')).toBeVisible();
}

test('Vermutung zuerst, dann genau ein Aufruf; Karte mit Antwort, Begründung, Beispiel und Kennzeichnung', async ({ page }) => {
  await wrongAnswer(page);
  await page.getByTestId('tutor-ask').click();
  await expect(page.getByTestId('tutor-guessbox')).toBeVisible();
  await page.getByTestId('tutor-guess-input').fill('falsche Zeitform');
  expect(await calls(page)).toEqual([]);
  await page.getByTestId('tutor-go').click();
  await expect(page.getByTestId('tutor-text')).toBeVisible();
  await expect(page.getByTestId('tutor-guess')).toContainText('falsche Zeitform');
  await expect(page.getByTestId('tutor-yours')).toBeVisible();
  await expect(page.getByTestId('tutor-why')).toBeVisible();
  await expect(page.getByTestId('tutor-example')).toContainText('archive module');
  await expect(page.getByTestId('tutor-mark')).toContainText('von Claude');
  await expect(page.getByTestId('ai-report')).toBeVisible();
  expect(await calls(page)).toEqual(['explain-answer:quick']);
  await expect(page.getByTestId('tutor-ask')).toHaveCount(0);
});

test('invalid_json: genau ein Aufruf, „Erneut versuchen“ fragt einmal frisch', async ({ page }) => {
  await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await mode(page, 'zzjson');
  await answerGrammar(page, solve, { wrong: true });
  await page.getByTestId('tutor-ask').click();
  await page.getByTestId('tutor-go').click();
  await expect(page.getByTestId('ai-error')).toBeVisible();
  expect(await calls(page)).toEqual(['explain-answer:quick']);
  await page.waitForTimeout(400);
  expect(await calls(page)).toHaveLength(1);
  await mode(page, '');
  await page.getByTestId('ai-retry').click();
  await expect(page.getByTestId('tutor-text')).toBeVisible();
  expect(await calls(page)).toHaveLength(2);
});

test('Schemafehler: genau zwei Aufrufe (der eine Neuversuch nach A6.3), dann die Karte', async ({ page }) => {
  await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await mode(page, 'zzschema');
  await answerGrammar(page, solve, { wrong: true });
  await page.getByTestId('tutor-ask').click();
  await page.getByTestId('tutor-go').click();
  await expect(page.getByTestId('tutor-text')).toBeVisible();
  expect(await calls(page)).toEqual(['explain-answer:quick', 'explain-answer:quick']);
});

test('britisches Beispiel und ein Signalwort, das nicht im Satz steht, fallen still weg (kein Neuversuch)', async ({ page }) => {
  await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await mode(page, 'zzbrit zzsignal');
  await answerGrammar(page, solve, { wrong: true });
  await page.getByTestId('tutor-ask').click();
  await page.getByTestId('tutor-go').click();
  await expect(page.getByTestId('tutor-text')).toBeVisible();
  await expect(page.getByTestId('tutor-example')).toHaveCount(0);
  await expect(page.getByTestId('tutor-signal')).toHaveCount(0);
  expect(await calls(page)).toHaveLength(1);
});

test('Melden: Karte verschwindet, Qualitätszähler zählt, die Aufgabe selbst bleibt', async ({ page }) => {
  await wrongAnswer(page);
  await page.getByTestId('tutor-ask').click();
  await page.getByTestId('tutor-go').click();
  await expect(page.getByTestId('tutor-text')).toBeVisible();
  await page.getByTestId('ai-report').click();
  await page.getByTestId('report-explain').click();
  await expect(page.getByTestId('tutor-text')).toHaveCount(0);
  await expect(page.getByTestId('tutor-ask')).toHaveCount(0);
  const q = await page.evaluate(() => window.localStorage.getItem('lx:ai-q'));
  expect(JSON.parse(q ?? '{}')).toMatchObject({ 'explain-answer@2': { gen: 1, acc: 1, shown: 1, flag: 1 } });
  await expect(page.getByTestId('gr-item')).toBeVisible();
});

test('Erklärung wird an der falschen Antwort gespeichert (ax), ohne etwas zu löschen', async ({ page }) => {
  await wrongAnswer(page);
  await page.getByTestId('tutor-ask').click();
  await page.getByTestId('tutor-go').click();
  await expect(page.getByTestId('tutor-text')).toBeVisible();
  await expect
    .poll(async () => {
      const d = await dump(page);
      return Object.entries(d)
        .filter(([p]) => p.startsWith('grammar/'))
        .flatMap(([, doc]) => ((doc as { errors?: Array<Record<string, unknown>> }).errors ?? []).filter((e) => e.ax))
        .map((e) => (e.ax as { pv?: string }).pv);
    }, { timeout: 15_000 })
    .toContain('explain-answer@2');
});

test('ohne Claude weder Knopf noch Zeile; die Pflicht bleibt erfüllbar', async ({ page }) => {
  await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { fake: { capabilities: { sample: false } } });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await answerGrammar(page, solve, { wrong: true });
  await expect(page.getByTestId('result')).toBeVisible();
  await expect(page.getByTestId('tutor')).toHaveCount(0);
  await expect(page.getByTestId('ai-mark')).toHaveCount(0);
  await expect(page.getByTestId('tutor-mark')).toHaveCount(0);
});
