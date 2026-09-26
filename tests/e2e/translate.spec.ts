import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Phase 5: Übersetzer im Begleiter (Plan §8.2, §10.2 translate.spec.ts).

type Call = { id: string | null; tier: string; input: string; cache?: unknown };
const calls = async (page: Page, id: string): Promise<Call[]> =>
  (await page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Call[] } }).__LINGO_FAKE__.sampleCalls])).filter((c) => c.id === id);

test.describe('Desktop 1440 DE', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Taste / öffnet den Übersetzer mit Fokus; im Eingabefeld tippt / ein Zeichen', async ({ page }) => {
    await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.keyboard.press('/');
    await expect(page.getByTestId('companion')).toHaveAttribute('data-tab', 'translate');
    await expect(page.getByTestId('tr-input')).toBeFocused();
    await page.keyboard.type('a/b');
    await expect(page.getByTestId('tr-input')).toHaveValue('a/b');
  });

  test('DE → EN: Hauptfassung, zwei Alternativen mit anderem Ton, Hinweis auf Deutsch; quick mit 24-h-Speicher; Wort als Karte (src translate)', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.getByTestId('open-companion').click();
    await page.getByTestId('companion-tab-translate').click();
    await page.getByTestId('tr-input').fill('Wir müssen das Budget freigeben');
    await expect(page.getByTestId('tr-dir')).toHaveAttribute('data-dir', 'de-en');
    await page.getByTestId('tr-go').click();
    const main = page.getByTestId('tr-main');
    await expect(main).toHaveAttribute('lang', 'en');
    await expect(main).toContainText('We need to approve the budget.');
    const alts = page.getByTestId('tr-alt');
    await expect(alts).toHaveCount(2);
    expect(await alts.evaluateAll((els) => els.map((e) => e.getAttribute('data-register')))).toEqual(['formal', 'casual']);
    await expect(page.getByTestId('tr-note')).toContainText('freigeben');
    const c = await calls(page, 'translate');
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ tier: 'quick', cache: { gcTime: 86_400_000 } });
    await expect(page.getByTestId('tr-history')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);

    // Englisches Wort der Übersetzung antippen und als Karte speichern.
    await main.locator('button.lx-word', { hasText: 'approve' }).click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.getByTestId('lk-save').click();
    await expect.poll(async () => (await dump(page))['vocab/approve']?.src).toBe('translate');
    const card = (await dump(page))['vocab/approve']!;
    expect(card).toMatchObject({ origin: { kind: 'translate' }, ex: 'We need to [approve] the budget.' });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('zzsame: Schemafehler → genau ein Neuversuch (A6.3)', async ({ page }) => {
    await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.keyboard.press('/');
    await page.getByTestId('tr-input').fill('zzsame Budget heute');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('tr-main')).toBeVisible();
    expect(await calls(page, 'translate')).toHaveLength(2);
  });
});

test.describe('Handy 390 EN', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('EN-Oberfläche: Hinweise auf Englisch, kein Querscrollen', async ({ page }) => {
    await boot(page, { migrated: true, lang: 'en' });
    await screen(page, 'today');
    await page.getByTestId('open-companion').tap();
    await page.getByTestId('companion-tab-translate').tap();
    await page.getByTestId('tr-input').fill('Wir müssen das Budget freigeben');
    await page.getByTestId('tr-go').tap();
    await expect(page.getByTestId('tr-note')).toContainText('means approve');
    expect(await layoutProblems(page)).toEqual([]);
  });
});
