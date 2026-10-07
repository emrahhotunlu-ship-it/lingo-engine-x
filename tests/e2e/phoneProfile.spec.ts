import { expect, test, type Page } from '@playwright/test';
import { bootAt, screen } from './fixtures';
import { NO_GRAMMAR_ERRORS } from './heuteHelpers';
import { setInputProfile } from './input';

// Handy-Profil `touch` (Lernplattform 2.0 §6, §10.4 P8): in den Pflichtschritten nie ein Textfeld mit ganzem Satz, kein eigener Satz
// (`produce`), kein Hören – auch nicht mit einem Fehlersatz mit zwei Fehlerstellen. Der Plan hängt nie vom Profil ab.

type Doc = Record<string, unknown>;
const T = Date.parse('2026-09-20T18:00:00+02:00');
const DAY = 86_400_000;
const TWO = { id: 'two1', wrong: 'Yesterday I go to the office and she say hello.', right: 'Yesterday I went to the office and she said hello.', why: 'Vergangenheit: went, said.', src: 'say', t: T - 3 * DAY, box: 0, due: T - 2 * DAY };
const dump = (page: Page): Promise<Record<string, Doc>> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Record<string, Doc> } } }).__LINGO_FAKE__.db.dump());
const noTextarea = async (page: Page, at: string): Promise<void> => expect(await page.locator('textarea').count(), `kein Textfeld mit ganzem Satz (${at})`).toBe(0);

test('Schritt 4 am Handy: zwei Fehlerstellen nacheinander antippen und ersetzen, nie ein Textfeld', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setInputProfile(page, 'touch');
  const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...NO_GRAMMAR_ERRORS, 'app/repair': { items: [TWO] } } } });
  await screen(page, 'unitAgain');
  await expect(page.getByTestId('repair-item')).toHaveAttribute('data-form', 'spots');
  await noTextarea(page, 'Start');
  for (const [word, fix] of [['go', 'went'], ['say', 'said']] as const) {
    await page.getByTestId('spot-word').filter({ hasText: new RegExp(`^${word}$`) }).click();
    await page.getByTestId('repair-check').click();
    await noTextarea(page, `Ersatz ${word}`);
    await page.getByTestId('repair-span-input').fill(fix);
    await page.getByTestId('repair-check').click();
  }
  await expect(page.getByTestId('result')).toHaveAttribute('data-verdict', 'ok');
  expect(errors).toEqual([]);
});

test('Grammatik-Pflichtrunde am Handy: nie ein Textfeld mit ganzem Satz', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setInputProfile(page, 'touch');
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'duty' });
  await screen(page, 'grammarSession');
  for (let i = 0; i < 4; i++) {
    await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').count()) break;
    await noTextarea(page, `Aufgabe ${i + 1}`);
    expect(await page.getByTestId('gr-item').getAttribute('data-type')).not.toBe('correct');
    await page.getByTestId('dont-know').click();
    await page.getByTestId('next').click();
  }
  expect(errors).toEqual([]);
});

test('Plan und Pflicht hängen nie vom Eingabeprofil ab', async ({ page, browser }) => {
  const plan = async (profile: 'touch' | 'keys'): Promise<unknown> => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const p = await ctx.newPage();
    await setInputProfile(p, profile);
    await bootAt(p, { name: 'today' }, { migrated: true });
    await screen(p, 'today');
    const doc = (await dump(p))['app/profile'];
    await ctx.close();
    return doc?.plan ?? null;
  };
  void page;
  expect(await plan('touch')).toEqual(await plan('keys'));
});
