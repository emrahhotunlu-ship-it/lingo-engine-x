import { expect, test } from '@playwright/test';
import { bootAt, bootLibrary, screen } from './fixtures';
import { ARTICLE_Q, dump, entriesOf, DAY } from './inputHelpers';

// Neubau P4 (plan.md §4.5): „Lesen“ (seit 04.10.2026 kein Reiter mehr, nur Deep-Link `library`), Leser, „Wörter aus diesem Text üben“, Fortsetzen,
// Block 2 der Tageseinheit ohne KI.

test.describe('Lesen (Neubau P4)', () => {
  test('Bibliothek: Chips, Heute neu mit Themen-Text, „x % neu“, Artikel in 1 Tipp', async ({ page }) => {
    const { errors, external } = await bootLibrary(page);
    await expect(page.getByTestId('lib-chips').getByTestId('lib-chip')).toHaveCount(5);
    await expect(page.getByTestId('lib-theme')).toBeVisible();
    // „% neu“ erscheint nach dem ersten Bild (Wörterbuch lazy).
    await expect(page.getByTestId('lib-theme').getByTestId('lib-meta')).toContainText('% neu');
    // Chip „Hören“: nur Hörtexte in der Bibliothek.
    await page.locator('[data-testid="lib-chip"][data-chip="listen"]').click();
    await expect(page.getByTestId('lib-theme')).toHaveCount(0);
    await page.locator('[data-testid="lib-chip"][data-chip="all"]').click();
    // 1 Tipp → Artikel im Leser.
    await page.locator(`[data-testid="lib-item"][data-key="a:${ARTICLE_Q}"]`).click();
    await screen(page, 'read');
    await expect(page.getByTestId('article')).toHaveAttribute('data-id', ARTICLE_Q);
    await expect(page.getByTestId('reader-legend')).toBeVisible();
    // „Leichter / Näher an C1“ (N59) nur auf Knopfdruck, mit KI.
    await expect(page.getByTestId('level-easier')).toBeVisible();
    await expect(page.getByTestId('level-harder')).toBeVisible();
    // Satzmodus (N56): ein Satz, blättern.
    await page.getByTestId('sentence-mode').click();
    await expect(page.getByTestId('sentence-view')).toHaveAttribute('data-i', '0');
    await page.getByTestId('sentence-next').click();
    await expect(page.getByTestId('sentence-view')).toHaveAttribute('data-i', '1');
    await page.getByTestId('sentence-mode').click();
    await expect(page.getByTestId('sentence-view')).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Wort antippen → „+ Wortschatz“ → Eingangskorb mit Ursprungssatz; Wortstatus danach markiert', async ({ page }) => {
    const { errors } = await bootLibrary(page);
    await page.locator(`[data-testid="lib-item"][data-key="a:${ARTICLE_Q}"]`).click();
    await screen(page, 'read');
    const word = page.getByTestId('article').locator('button.lx-word[data-lookup="benefit"]').first();
    await word.click();
    await page.getByTestId('lk-save').click();
    await expect(page.getByTestId('lk-saved')).toBeVisible();
    await expect.poll(async () => (await dump(page))['vocab/benefit']?.state).toBe('new');
    const card = (await dump(page))['vocab/benefit'] as Record<string, unknown>;
    expect(String(card.ex)).toContain('[benefit');
    expect(card.origin).toMatchObject({ kind: 'read', ref: `articles/${ARTICLE_Q}` });
    await page.keyboard.press('Escape');
    // Gespeichert = „am Lernen“: gepunktet unterstrichen.
    await expect.poll(async () => word.evaluate((el) => getComputedStyle(el).textDecorationStyle)).toBe('dotted');
    expect(errors).toEqual([]);
  });

  test('„Wörter aus diesem Text üben (n)“ startet genau diese Karten', async ({ page }) => {
    const { errors } = await bootLibrary(page);
    await page.locator(`[data-testid="lib-item"][data-key="a:${ARTICLE_Q}"]`).click();
    await screen(page, 'read');
    const btn = page.getByTestId('practice-text');
    await expect(btn).toBeVisible();
    const n = Number(await btn.getAttribute('data-n'));
    expect(n).toBeGreaterThan(0);
    await btn.click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('exercise-bar').getByRole('progressbar')).toHaveAttribute('aria-valuemax', String(n));
    expect(errors).toEqual([]);
  });

  test('Block 2 ohne KI: Themen-Text, 2 Fragen mit Beleg und Grund, Wendungen mitnehmen, Abschluss gespeichert', async ({ page }) => {
    const { errors, external } = await bootAt(page, { name: 'inputUnit', day: DAY, kind: 'read', ref: 'theme:x-t01' }, { fake: { capabilities: { sample: false } } });
    await screen(page, 'inputUnit');
    const block = page.getByTestId('input-block');
    await expect(block).toHaveAttribute('data-step', 'input');
    await expect(page.getByTestId('reader-text')).toContainText('Walk me through your current process');
    await page.getByTestId('block-to-questions').click();
    for (let i = 0; i < 2; i++) {
      await expect(page.getByTestId('question')).toHaveAttribute('data-index', String(i));
      await page.getByTestId('option').first().click();
      // M9: Belegstelle und Grund auch bei richtiger Antwort.
      await expect(page.getByTestId('evidence')).toBeVisible();
      await expect(page.getByTestId('explain')).toBeVisible();
      await page.getByTestId('next').click();
    }
    await expect(block).toHaveAttribute('data-step', 'notice');
    await expect(page.getByTestId('notice-row')).toHaveCount(3);
    await expect.poll(async () => Object.values(await dump(page)).some((d) => d.articleId === 'x-t01' && d.date === DAY)).toBe(true);
    const log = entriesOf(await dump(page));
    expect(log.filter((e) => e.ref === 'theme:t01').length).toBe(2);
    await page.getByTestId('block-next').click();
    await expect(page.locator('[data-screen="inputUnit"]')).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  // Offen (2 Versuche, A2): Text wird hergestellt, der Absatz-Sprung greift noch nicht (Bildlauf der Übungsebene).
  test.fixme('reload() im Leser: gleicher Text, gleicher Absatz (G3)', async ({ page }) => {
    const { errors } = await bootLibrary(page);
    await page.locator(`[data-testid="lib-item"][data-key="a:${ARTICLE_Q}"]`).click();
    await screen(page, 'read');
    await page.locator('[data-para="2"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.reload();
    await screen(page, 'read');
    await expect(page.getByTestId('article')).toHaveAttribute('data-id', ARTICLE_Q);
    await expect(page.locator('[data-para="2"]')).toBeInViewport();
    expect(errors).toEqual([]);
  });

  test('Schreibwerkstatt: weitere Gattung (N61) wird Aufgabe des Tages, mit eigenem Wortziel', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'write', ctx: 'extra' }, { fake: { capabilities: { sample: false } } });
    await screen(page, 'write');
    await page.locator('[data-testid="genre-chip"][data-id="nb-half"]').click();
    await expect(page.getByTestId('prompt-card')).toHaveAttribute('data-id', 'nb-half');
    await expect.poll(async () => JSON.stringify((await dump(page))[`wprompt/${DAY}`] ?? {})).toContain('nb-half');
    expect(errors).toEqual([]);
  });

  test('Block 2 Dienstag ohne KI: Themen-Text vorgelesen (Tempo-Leiter), Fragen, Zusammenfassung in 3 Sätzen', async ({ page }) => {
    test.setTimeout(90_000);
    const { errors } = await bootAt(page, { name: 'inputUnit', day: DAY, kind: 'listen', ref: 'theme:x-t01', summary: true }, { fake: { capabilities: { sample: false } } });
    await screen(page, 'inputUnit');
    const player = page.getByTestId('tempo-player');
    await expect(player).toHaveAttribute('data-pass', '1');
    // Kein Text vor den Fragen.
    await expect(page.getByTestId('reader-text')).toHaveCount(0);
    await page.getByTestId('tempo-play').click();
    await expect(player).toHaveAttribute('data-pass', '2', { timeout: 60_000 });
    expect(Number(await player.getAttribute('data-rate'))).toBeGreaterThan(1);
    await page.getByTestId('block-to-questions').click();
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('option').first().click();
      await page.getByTestId('next').click();
    }
    await expect(page.getByTestId('block-summary')).toBeVisible();
    await expect(page.getByTestId('block-summary-save')).toBeDisabled();
    await page.getByTestId('block-summary-draft').fill('The memo says the customer should talk most. Sellers should ask open questions. They must find out who signs.');
    await page.getByTestId('block-summary-save').click();
    await expect(page.getByTestId('input-block')).toHaveAttribute('data-step', 'notice');
    await expect.poll(async () => Object.values(await dump(page)).some((d) => d.articleId === 'x-t01' && String(d.summary).startsWith('The memo says'))).toBe(true);
    expect(errors).toEqual([]);
  });
});
