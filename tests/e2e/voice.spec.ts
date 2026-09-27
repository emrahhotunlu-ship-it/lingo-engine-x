import { expect, test, type Page } from '@playwright/test';
import { boot, openSettings, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Stimme und Spracheingabe (Phase 3, Plan §9.2).

type Doc = Record<string, unknown>;
const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken]);

async function startRoleplay(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('tab-speak').click();
  await screen(page, 'speak');
  await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
}

test('Einstellungen: englische Stimmen, Probehören, Tempo wird in app/profile.rate gespeichert', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openSettings(page);
  const list = page.getByTestId('voice-select');
  await expect(list.getByRole('radio')).toHaveCount(2);
  await expect(list.getByRole('radio').first()).toContainText('Samantha');
  await expect(list).not.toContainText('Anna');
  await page.getByTestId('voice-preview').nth(1).click();
  await expect.poll(() => spoken(page)).toContain('This is how I sound.');
  await list.getByRole('radio').nth(1).click();
  await expect.poll(async () => ((await dump(page))['app/profile'] as Doc).voice).toBe('Daniel');
  const rate = page.getByTestId('voice-rate');
  await rate.focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect.poll(async () => ((await dump(page))['app/profile'] as Doc).rate).toBe(0.9);
  const sw = page.getByTestId('voice-autoplay');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  expect(errors).toEqual([]);
});

test('Spracheingabe verfügbar: Mikrofon da, Ergebnis im Feld, nicht gesendet', async ({ page }) => {
  await boot(page, { migrated: true, fake: { stt: 'ok' } });
  await startRoleplay(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('mic')).toHaveAttribute('data-listening', 'true');
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sttSay(t: string): void } }).__LINGO_FAKE__.sttSay('The exposure here is real'));
  await expect(page.getByTestId('composer-input')).toHaveValue('The exposure here is real');
  await expect(page.locator('[data-testid="rp-turn"][data-role="me"]')).toHaveCount(0);
});

test('Spracheingabe gesperrt: Knopf verschwindet und fehlt auch nach dem Neuladen', async ({ page }) => {
  await boot(page, { migrated: true, fake: { stt: 'blocked' } });
  await startRoleplay(page);
  await page.getByTestId('mic').click();
  await expect(page.getByTestId('mic')).toHaveCount(0);
  await page.reload();
  await startRoleplay(page);
  await expect(page.getByTestId('composer-input')).toBeVisible();
  await expect(page.getByTestId('mic')).toHaveCount(0);
});

test('Ohne Spracheingabe: kein Mikrofon', async ({ page }) => {
  await boot(page, { migrated: true, fake: { stt: 'absent' } });
  await startRoleplay(page);
  await expect(page.getByTestId('composer-input')).toBeVisible();
  await expect(page.getByTestId('mic')).toHaveCount(0);
});

test('Eröffnung wird beim Start vorgelesen (Vorlesen an)', async ({ page }) => {
  await boot(page, { migrated: true });
  await startRoleplay(page);
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain('Let me be direct.');
});
