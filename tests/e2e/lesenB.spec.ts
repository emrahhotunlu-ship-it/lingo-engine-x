import { expect, test, type Page } from '@playwright/test';
import { bootAt, bootLibrary, screen, type Booted } from './fixtures';
import { ARTICLE_Q, dump } from './inputHelpers';

// Paket B, Lesen/Hören/Schreiben: Wendung markieren (N57), Wort-Markierung beim Vorlesen (N58),
// Meeting mit mehreren Stimmen → Stichworte → Follow-up-Mail (B6), Ton-Erkennung im eigenen Text (B9).

/** „Lesen“ gibt es seit 04.10.2026 nur noch per Deep-Link (kein Reiter); dort den Artikel öffnen. */
async function openArticle(page: Page): Promise<Booted> {
  const booted = await bootLibrary(page);
  await page.locator(`[data-testid="lib-item"][data-key="a:${ARTICLE_Q}"]`).click();
  await screen(page, 'read');
  return booted;
}

test.describe('Lesen & Hören, Paket B', () => {
  test('N57: erstes + letztes Wort antippen → Wortblatt für die ganze Wendung', async ({ page }) => {
    const { errors } = await openArticle(page);
    await page.getByTestId('phrase-mode').click();
    await expect(page.getByTestId('phrase-hint')).toHaveAttribute('data-step', 'first');
    const words = page.locator('[data-para="0"] button.lx-word');
    const a = (await words.nth(1).getAttribute('data-word')) ?? '';
    const b = (await words.nth(3).getAttribute('data-word')) ?? '';
    await words.nth(1).click();
    // Kein Nachschlagen nach dem ersten Wort, das Wort ist markiert.
    await expect(page.getByTestId('lookup')).toHaveCount(0);
    await expect(page.getByTestId('phrase-hint')).toHaveAttribute('data-step', 'last');
    await expect(page.locator('[data-para="0"] mark.lx-mark')).toContainText(a);
    await words.nth(3).click();
    const sheet = page.getByTestId('lookup').first();
    await expect(sheet).toBeVisible();
    const label = (await sheet.getAttribute('aria-label')) ?? '';
    expect(label).toContain(a);
    expect(label).toContain(b);
    await expect(page.getByTestId('phrase-hint')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('N58: Vorlesen markiert das gesprochene Wort (wo boundary feuert) und lässt sich anhalten', async ({ page }) => {
    const { errors } = await openArticle(page);
    await page.getByTestId('read-aloud').click();
    await expect(page.locator('[data-reading="true"]').first()).toBeVisible();
    await expect(page.locator('[data-reading="true"] mark.lx-mark').first()).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('read-aloud').click();
    await expect(page.locator('[data-reading="true"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('B6: Meeting mit mehreren Stimmen → Stichworte → Follow-up-Mail → Vereinbarungen geprüft', async ({ page }) => {
    test.setTimeout(90_000);
    const { errors, external } = await bootLibrary(page);
    await page.getByTestId('lib-dialog').click();
    await screen(page, 'listenDialog');
    await expect(page.getByTestId('dialog-speaker')).toHaveCount(3);
    // Nachgebildete Stimmen: Samantha und Zoe (en-US) und Daniel (en-GB) → drei eigene Stimmen.
    await expect(page.getByTestId('dialog-speakers')).toHaveAttribute('data-voices', '3');
    await expect(page.locator('[data-testid="dialog-speaker"][data-accent="gb"]')).toHaveAttribute('data-voice', 'Daniel');
    // Kein Text vor dem Hören.
    await expect(page.getByTestId('dialog-transcript')).toHaveCount(0);
    await expect(page.getByTestId('dialog-to-notes')).toBeDisabled();
    await page.getByTestId('dialog-play').click();
    await expect(page.locator('[data-testid="dialog-speaker"][data-active="true"]')).toHaveCount(1);
    await expect(page.getByTestId('dialog-to-notes')).toBeEnabled({ timeout: 60_000 });
    await page.getByTestId('dialog-to-notes').click();
    await page.getByTestId('dialog-notes').fill('Priya: estimate Friday. Oliver: approve < 40k next week. Start 3 sites in Nov.');
    await page.getByTestId('dialog-to-mail').click();
    await expect(page.getByTestId('dialog-notes-view')).toContainText('Priya');
    await expect(page.getByTestId('dialog-check')).toBeDisabled();
    await page
      .getByTestId('dialog-mail')
      .fill(
        'Hi all, thanks for the call today. Here is a quick recap of what we agreed. Priya will send a cost estimate for both interfaces by Friday. If the estimate is under 40,000, Oliver will approve the budget next week. Please let me know if I missed anything. Best regards, Megan',
      );
    const listenUnits = async (): Promise<number> => {
      const act = ((await dump(page))['app/profile']?.act ?? {}) as Record<string, Record<string, unknown> | undefined>;
      return Object.values(act).reduce((n, d) => n + (Number(d?.listen) || 0), 0);
    };
    const before = await listenUnits();
    await page.getByTestId('dialog-check').click();
    await expect(page.getByTestId('dialog-review')).toBeVisible();
    await expect(page.getByTestId('dialog-point')).toHaveCount(3);
    await expect(page.locator('[data-testid="dialog-point"][data-covered="yes"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="dialog-point"][data-covered="no"]')).toHaveCount(1);
    await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'close');
    await expect(page.getByTestId('dialog-transcript')).toBeVisible();
    // Zählt als Hör-Einheit (Extra) im Profil.
    await expect.poll(listenUnits).toBe(before + 1);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('B9: Ton-Erkennung im eigenen Text „Wirkt: …“', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'write', ctx: 'extra' });
    await screen(page, 'write');
    await expect(page.getByTestId('tone-read')).toHaveCount(0);
    await page.getByTestId('draft').fill('Send me the updated numbers ASAP! We must close this deal today, no more delays.');
    await page.getByTestId('tone-ask').click();
    const res = page.getByTestId('tone-result');
    await expect(res).toBeVisible();
    await expect(res).toHaveAttribute('data-tones', /urgent/);
    await expect(res).toContainText('Wirkt:');
    expect(errors).toEqual([]);
  });
});
