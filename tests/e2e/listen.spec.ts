import { expect, test } from '@playwright/test';
import { boot, layoutProblems } from './fixtures';
import { DAY, LPOOL_NEW, answerAll, dump, entriesOf, openModule } from './inputHelpers';

// Hören (Plan §4.2, §8.3): Abspielen mit Abschnitten, Transkript vorher NICHT im DOM, Fragen
// erst nach dem Hören, Beleg abspielbar, Transkript danach, `profile.listen[]` im Altformat.

const PATCH = { 'lpool/ai1789322400000': null };
const SENTENCE = 'data migration'; // kommt im Hörtext l5 vor

test('Hören: abspielen, Fragen, Beleg anhören, Transkript mit Mitsprechen, Schreibwege', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: PATCH } });
  await openModule(page, 'listen');
  const unit = page.getByTestId('unit');
  await expect(unit).toHaveAttribute('data-state', 'prep');
  await expect(page.getByTestId('listen-prep').getByTestId('chunk-row')).toHaveCount(5);
  await page.getByTestId('listen-start').click();
  await expect(unit).toHaveAttribute('data-state', 'listening');
  await expect(page.getByTestId('audio-bar')).toBeVisible();
  // Kein Text vor den Fragen im DOM (F14).
  await expect(page.getByTestId('transcript')).toHaveCount(0);
  await expect(page.getByTestId('listen-text')).toHaveCount(0);
  expect(await page.evaluate((s) => document.body.innerText.toLowerCase().includes(s), SENTENCE)).toBe(false);
  await expect(page.getByTestId('to-questions')).toBeDisabled();
  expect(await layoutProblems(page)).toEqual([]);

  await page.getByTestId('audio-play').click();
  await expect(page.getByTestId('audio-stop')).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId('audio-progress').getAttribute('data-i'))).toBeGreaterThan(1);
  const n = Number(await page.getByTestId('audio-progress').getAttribute('data-n'));
  expect(n).toBeGreaterThan(3);
  await expect(page.getByTestId('audio-play')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('to-questions')).toBeEnabled();
  await page.getByTestId('to-questions').click();

  // Erste Frage: Beleg anhören.
  await page.getByTestId('option').first().click();
  await expect(page.getByTestId('evidence')).toBeVisible();
  await page.getByTestId('evidence-speak').click();
  const evidence = (await page.getByTestId('evidence').locator('p[lang="en"]').innerText()).trim();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken.join(' '))).toContain(evidence.slice(0, 30));
  await page.getByTestId('next').click();
  await answerAll(page, 3, 1);

  // Danach: Transkript zum Mitsprechen (Satz für Satz mit Pause, M12).
  await expect(page.getByTestId('transcript')).toBeVisible();
  expect(await page.getByTestId('transcript-part').count()).toBe(n);
  await page.getByTestId('shadow-start').click();
  await expect(page.getByTestId('shadow-phase')).toHaveAttribute('data-phase', 'listen');
  await expect(page.getByTestId('shadow-phase')).toHaveAttribute('data-phase', 'you', { timeout: 10_000 });
  await page.getByTestId('shadow-stop').click();

  const db = await dump(page);
  const profile = db['app/profile'] as { listen: Array<Record<string, unknown>>; act: Record<string, Record<string, number>> };
  expect(profile.listen.at(-1)).toMatchObject({ id: LPOOL_NEW, level: 'B2+', n: 4, plays: 1, rate: 1, help: false });
  expect(profile.listen.length).toBe(4);
  expect(profile.act[DAY]?.listen).toBe(2);
  const log = entriesOf(db).filter((e) => e.type === 'listen');
  expect(log).toHaveLength(4);
  expect(log[0]).toMatchObject({ ref: `lpool/${LPOOL_NEW}`, ctx: 'xtra' });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Hören ohne Stimme: Hinweis, Text als Lesetext, trotzdem abschließbar (help: true)', async ({ page }) => {
  test.setTimeout(60_000);
  const { errors } = await boot(page, { migrated: true, fake: { patch: PATCH, speech: false } });
  await page.addInitScript(() => {
    // Headless-Chromium ohne Stimmen: Sprachausgabe gibt es nicht.
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
  });
  await page.reload();
  await openModule(page, 'listen');
  await page.getByTestId('listen-start').click();
  await expect(page.getByTestId('audio-off')).toBeVisible();
  await expect(page.getByTestId('listen-text')).toBeVisible();
  await expect(page.getByTestId('audio-bar')).toHaveCount(0);
  await page.getByTestId('to-questions').click();
  await answerAll(page, 4);
  await expect(page.getByTestId('transcript')).toBeVisible();
  const profile = (await dump(page))['app/profile'] as { listen: Array<Record<string, unknown>> };
  expect(profile.listen.at(-1)).toMatchObject({ id: LPOOL_NEW, help: true, plays: 0 });
  expect(errors).toEqual([]);
});

test('Hören: „Text zeigen" zählt als Hilfe', async ({ page }) => {
  await boot(page, { migrated: true, fake: { patch: PATCH } });
  await openModule(page, 'listen');
  await page.getByTestId('listen-start').click();
  await page.getByTestId('show-transcript').click();
  await expect(page.getByTestId('listen-text')).toBeVisible();
  await expect(page.getByTestId('to-questions')).toBeEnabled();
  await page.getByTestId('to-questions').click();
  await answerAll(page, 4);
  const profile = (await dump(page))['app/profile'] as { listen: Array<Record<string, unknown>> };
  expect(profile.listen.at(-1)).toMatchObject({ help: true });
});
