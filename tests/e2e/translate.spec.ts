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
    // Ganzer Satz: kein Knopf „In den Vokabeltrainer“ (nur Wort-Antippen).
    await expect(page.getByTestId('tr-card')).toHaveCount(0);
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

  test('Tonwechsel nach dem Ergebnis übersetzt genau einmal neu im gewählten Ton', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.keyboard.press('/');
    await page.getByTestId('tr-input').fill('Wir müssen das Budget freigeben');
    await page.getByTestId('tr-go').click();
    await expect(page.getByTestId('tr-main')).toBeVisible();
    expect(await calls(page, 'translate')).toHaveLength(1);
    await page.getByTestId('tr-register').locator('[data-value="formal"]').click();
    await expect.poll(async () => (await calls(page, 'translate')).length).toBe(2);
    expect((await calls(page, 'translate'))[1]!.input).toContain('Register: formal');
    expect((await calls(page, 'translate'))[0]!.input).toContain('Register: neutral');
    await expect(page.getByTestId('tr-main')).toBeVisible();
    // Derselbe Ton noch einmal: kein weiterer Aufruf.
    await page.getByTestId('tr-register').locator('[data-value="formal"]').click();
    await page.waitForTimeout(300);
    expect(await calls(page, 'translate')).toHaveLength(2);
    expect(errors).toEqual([]);
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

test.describe('Handy 390 DE: Richtung', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Automatisch: „Keep up“ erkennt Claude als Englisch → Deutsch; feste Wahl EN → DE geht ohne Erkennung', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.getByTestId('open-companion').tap();
    await page.getByTestId('companion-tab-translate').tap();
    await expect(page.getByTestId('tr-mode').locator('[data-value="auto"]')).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('tr-input').fill('Keep up');
    await expect(page.getByTestId('tr-dir')).toHaveAttribute('data-dir', 'auto');
    await page.getByTestId('tr-go').tap();
    await expect(page.getByTestId('tr-main')).toHaveAttribute('lang', 'de');
    await expect(page.getByTestId('tr-dir')).toContainText('Erkannt: Englisch → Deutsch');
    const first = await calls(page, 'translate');
    expect(first.at(-1)?.input).toContain('From: detect it yourself');

    await page.getByTestId('tr-mode').locator('[data-value="en"]').tap();
    await expect(page.getByTestId('tr-dir')).toHaveAttribute('data-dir', 'en-de');
    await page.getByTestId('tr-go').tap();
    await expect(page.getByTestId('tr-main')).toHaveAttribute('lang', 'de');
    const second = await calls(page, 'translate');
    expect(second.at(-1)?.input).toContain('From: English');
    expect(await layoutProblems(page)).toEqual([]);

    // Wie in der alten App: kurzes Wort direkt in den Vokabeltrainer (mit Beispielsatz als Ursprung).
    await page.getByTestId('tr-card').tap();
    await expect(page.getByTestId('tr-card-done')).toBeVisible();
    await expect.poll(async () => (await dump(page))['vocab/keep-up']?.src).toBe('translate');
    expect((await dump(page))['vocab/keep-up']).toMatchObject({ word: 'keep up', de: 'mithalten', ex: 'It is hard to [keep up] with all the new emails.', origin: { kind: 'translate' } });
    expect(errors).toEqual([]);
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
