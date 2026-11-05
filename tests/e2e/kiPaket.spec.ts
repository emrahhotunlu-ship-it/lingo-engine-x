import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { dump, forcedPatch, planPatch } from './trainerHelpers';

// KI-Paket (docs/ki-paket-plan.md): Kartenpaket beim Rundenstart, Claudes Nachprüfung getippter
// Antworten mit Warum, ohne KI alles wie bisher. Gegen den Produktions-Build mit eingespieltem Adapter.

test.use({ viewport: { width: 1440, height: 900 } });

type Calls = Array<{ id: string | null; tier: string; input: string }>;
const sampleCalls = (page: Page): Promise<Calls> =>
  page.evaluate(() => [...((window as unknown as { __LINGO_FAKE__?: { sampleCalls: Calls } }).__LINGO_FAKE__?.sampleCalls ?? [])]);

async function startWith(page: Page, opts: { sample?: boolean } = {}) {
  const avoid = forcedPatch()['vocab/avoid'] ?? {};
  const booted = await boot(page, {
    migrated: true,
    fake: { patch: { 'app/profile': planPatch(1), 'vocab/avoid': avoid }, ...(opts.sample === false ? { capabilities: { sample: false } } : {}) },
  });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

async function answer(page: Page, text: string) {
  await page.getByTestId('gap-input').click();
  // Der erste Versuch bleibt nach dem Hinweis stehen: vor dem zweiten löschen.
  for (let i = 0; i < 12; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type(text, { delay: 20 });
  await page.keyboard.press('Enter');
}

test('Rundenstart: Claude bereitet die Karten gebündelt vor (quick), das Paket liegt an der Karte', async ({ page }) => {
  const { errors } = await startWith(page);
  await expect.poll(async () => (await sampleCalls(page)).filter((c) => c.id === 'word-prep').length).toBeGreaterThan(0);
  const prep = (await sampleCalls(page)).filter((c) => c.id === 'word-prep');
  expect(prep.every((c) => c.tier === 'quick')).toBe(true);
  expect(prep.some((c) => /^Card \d+: to avoid$/m.test(c.input))).toBe(true);
  await expect.poll(async () => (((await dump(page))['vocab/avoid']?.xPack as { items?: unknown[] } | undefined)?.items ?? []).length).toBe(4);
  const card = (await dump(page))['vocab/avoid'] as Record<string, unknown>;
  // Bestehende Felder bleiben unberührt (Kap. 9).
  expect(card.ex).toBe('Try to [avoid] driving in rush hour.');
  expect(errors).toEqual([]);
});

test('falsch getippt: erst Hinweis, dann Lösung mit genauem Warum von Claude und neuem Beispiel', async ({ page }) => {
  const { errors } = await startWith(page);
  await answer(page, 'escape');
  await expect(page.getByTestId('verdict')).toHaveCount(0);
  await answer(page, 'prevent');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
  const why = page.locator('[data-testid="why"][data-src="ai"]');
  await expect(why).toContainText('„prevent“ hat eine andere Bedeutung');
  await expect(page.getByTestId('why-example')).toContainText('avoid');
  const judge = (await sampleCalls(page)).filter((c) => c.id === 'word-judge');
  expect(judge.length).toBe(2);
  expect(judge.every((c) => c.tier === 'quick' && c.input.includes('Sentence: Try to ___ driving in rush hour.'))).toBe(true);
  expect(errors).toEqual([]);
});

test('Claude lässt die erste Antwort gelten: der zweite Versuch endet sofort als richtig', async ({ page }) => {
  const { errors } = await startWith(page);
  await answer(page, 'zzok');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
  await expect(page.locator('[data-testid="why"][data-src="ai"]')).toContainText('ebenso richtig');
  expect(errors).toEqual([]);
});

test('ohne KI: keine Vorbereitung, keine Nachprüfung, feste Prüfung wie bisher', async ({ page }) => {
  const { errors } = await startWith(page, { sample: false });
  await answer(page, 'escape');
  await answer(page, 'prevent');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
  await expect(page.getByTestId('why')).toHaveCount(0);
  await expect(page.getByTestId('judging')).toHaveCount(0);
  const calls = (await sampleCalls(page)).filter((c) => c.id === 'word-prep' || c.id === 'word-judge');
  expect(calls).toEqual([]);
  expect((await dump(page))['vocab/avoid']?.xPack).toBeUndefined();
  expect(errors).toEqual([]);
});
