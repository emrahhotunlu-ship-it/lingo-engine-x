import { expect, test, type Page } from '@playwright/test';
import { boot, openSettings, openTab, screen, type Theme } from './fixtures';
import { answerCurrent, dump, planPatch, TYPE_MODE } from './trainerHelpers';

// Engine-Verdrahtung 19.10.2026, Satzbank: Am Rundenende fragt die App im Hintergrund genau einmal `word-bank@1` (quick) und sammelt die geprüften
// Sätze in `vocab/<id>.sb[]`; sichtbar werden Claude-Sätze erst nach der Freigabe (`app/profile.sbGate` mit Befund {hard, unclear}) und 4 Wochen nach
// ihrer Erzeugung. Das Wortblatt zeigt die sichtbaren Sätze („Weitere Sätze“), die KI-Stichprobe zählt und legt 30 Sätze für den Lehrer bei.

type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'word-bank').map((c) => `${c.id}:${c.tier}`));

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-20T21:00:00+02:00');
const OLD = 'Our director had to convince the investors that the new factory was a safe bet.';
const FRESH = 'Can you convince the client to sign the contract before the end of the quarter?';
const READ = 'The article tried to convince readers that remote teams can be just as productive.';
const sb = (en: string, t: number, src: 'ai' | 'read' = 'ai') => ({ en, de: 'Ein Satz zum Test.', sit: 'meeting', k: 'work', src, t, pv: src === 'ai' ? 'word-bank@1' : 'read:a1' });
const RELEASED = { start: NOW - 60 * DAY, on: true, checkedAt: NOW - 30 * DAY, review: { hard: 0, unclear: 1 } };

/** Hintergrundaufrufe erst nach einem beantworteten Nutzer-Aufruf (LP3 P25): eine Nachricht an Claude. */
async function confirmSample(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('open-companion').click();
  await expect(page.getByTestId('companion')).toBeVisible();
  await page.getByTestId('chat-input').fill('Hallo');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('companion')).toHaveCount(0);
}

async function openWord(page: Page, word: string): Promise<void> {
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('vocab-search-open').click();
  await page.getByTestId('vocab-search').fill(word);
  await page.locator(`[data-testid="vocab-row"][data-word="${word}"]`).click();
  await expect(page.getByTestId('word-sheet')).toBeVisible();
}

test.describe('Satzbank', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Rundenende: genau ein Hintergrund-Aufruf für bis zu 8 Karten (Runde zuerst), Sätze ergänzend gesammelt, Start der Prüfzeit gesetzt', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1) } } });
    await confirmSample(page);
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    const first = (await page.getByTestId('exercise').getAttribute('data-card')) ?? '';
    expect(await calls(page)).toEqual([]);
    const before = await dump(page);
    await answerCurrent(page);
    await expect(page.getByTestId('summary')).toBeVisible();
    await expect.poll(() => calls(page)).toEqual(['word-bank:quick']);
    const banks = async () => Object.entries(await dump(page)).filter(([p, d]) => p.startsWith('vocab/') && Array.isArray(d.sb));
    await expect.poll(async () => (await banks()).length).toBe(8);
    const d = await dump(page);
    // Die Karte der Runde ist dabei; je Karte 4 geprüfte Claude-Sätze, sonst nichts an der Karte verändert (Planung bleibt).
    expect((d[`vocab/${first}`]?.sb as unknown[] | undefined)?.length).toBe(4);
    for (const [p, doc] of await banks()) {
      expect((doc.sb as Array<{ src: string; pv: string }>).every((x) => x.src === 'ai' && x.pv === 'word-bank@1')).toBe(true);
      if (p !== `vocab/${first}`) expect({ ...doc, sb: undefined }).toEqual({ ...before[p], sb: undefined });
    }
    await expect.poll(async () => typeof ((await dump(page))['app/profile']?.sbGate as { start?: unknown } | undefined)?.start).toBe('number');
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Freigabe mit Befund: alte Claude-Sätze und Lesetext-Sätze sichtbar, frische nicht; Melden blendet aus und speichert bad', async ({ page }) => {
    const { errors } = await boot(page, {
      migrated: true,
      fake: { patch: { 'app/profile': { sbGate: RELEASED }, 'vocab/convince': { sb: [sb(OLD, NOW - 40 * DAY), sb(FRESH, NOW - 2 * DAY), sb(READ, NOW, 'read')] } } },
    });
    await openWord(page, 'convince');
    const items = page.getByTestId('word-sb-item');
    await expect(items).toHaveCount(2);
    await expect(page.getByTestId('word-sb')).toContainText('Weitere Sätze');
    await expect(page.getByTestId('word-sb')).not.toContainText('Can you convince');
    await expect(items.first()).toHaveAttribute('data-src', 'ai');
    await expect(items.nth(1)).toHaveAttribute('data-src', 'read');
    await expect(page.getByTestId('word-sb-mark')).toHaveCount(1);
    // „Satz von Claude · …“ steht einmal über der Liste; je Satz nur „Melden“ mit passenden Gründen.
    await expect(page.getByTestId('word-sb-note')).toHaveCount(1);
    await expect(page.getByTestId('word-sb')).toContainText('Satz von Claude');
    await expect(page.getByTestId('word-sb-mark')).not.toContainText('Satz von Claude');
    await page.getByTestId('word-sb-mark').getByTestId('ai-report').click();
    await expect(page.getByTestId('report-sheet').getByRole('button')).toHaveCount(2);
    await expect(page.getByTestId('report-solution')).toHaveCount(0);
    await page.getByTestId('report-sheet').getByRole('button').first().click();
    await expect.poll(async () => ((await dump(page))['vocab/convince']?.sb as Array<{ bad?: number }>)[0]?.bad).toBe(1);
    await expect(items).toHaveCount(1);
    expect(((await dump(page))['vocab/convince']?.sb as unknown[]).length).toBe(3);
    expect(errors).toEqual([]);
  });

  test('Befund über der Schwelle: die Bank bleibt zu, auch wenn on gesetzt ist', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { 'app/profile': { sbGate: { ...RELEASED, review: { hard: 2, unclear: 0 } } }, 'vocab/convince': { sb: [sb(OLD, NOW - 40 * DAY)] } } } });
    await openWord(page, 'convince');
    await expect(page.getByTestId('word-sb')).toHaveCount(0);
  });

  test('KI-Stichprobe: Zeile mit Zahl, Prüfzeit und Freigabe; zählt nur Claude-Sätze', async ({ page }) => {
    await boot(page, {
      migrated: true,
      fake: { patch: { 'vocab/convince': { sb: [sb(OLD, NOW - 40 * DAY), sb(FRESH, NOW - 2 * DAY), sb(READ, NOW, 'read')] }, 'vocab/deserve': { sb: [sb('We really deserve a short break after this long and difficult project.', NOW - DAY)] } } },
    });
    await screen(page, 'today');
    await openSettings(page);
    const row = page.getByRole('dialog').getByTestId('ai-sb');
    await expect(row).toHaveAttribute('data-n', '3');
    await expect(row).toHaveAttribute('data-sample', '3');
    await expect(row).toHaveAttribute('data-on', '0');
    await expect(row).toContainText('3 Sätze von Claude gesammelt, 3 davon noch in der 4-Wochen-Prüfzeit');
  });
});

// Bildschirmfotos (390/1440, dunkel/hell) nur auf Zuruf: LX_SHOTS=1 LX_SHOTS_DIR=<Ordner>.
const SHOTS = process.env.LX_SHOTS_DIR ?? '';
for (const s of [
  { name: '390-dunkel', viewport: { width: 390, height: 844 }, theme: 'dark' as Theme, touch: true },
  { name: '390-hell', viewport: { width: 390, height: 844 }, theme: 'light' as Theme, touch: true },
  { name: '1440-dunkel', viewport: { width: 1440, height: 900 }, theme: 'dark' as Theme, touch: false },
  { name: '1440-hell', viewport: { width: 1440, height: 900 }, theme: 'light' as Theme, touch: false },
]) {
  test.describe(`Foto Satzbank ${s.name}`, () => {
    test.skip(!process.env.LX_SHOTS || !SHOTS, 'nur mit LX_SHOTS=1 und LX_SHOTS_DIR');
    test.use({ viewport: s.viewport, hasTouch: s.touch });
    test('Wortblatt mit weiteren Sätzen', async ({ page }) => {
      await boot(page, { migrated: true, theme: s.theme, fake: { patch: { 'app/profile': { sbGate: RELEASED }, 'vocab/convince': { sb: [sb(OLD, NOW - 40 * DAY), sb(READ, NOW, 'read')] } } } });
      await openWord(page, 'convince');
      await page.getByTestId('word-sb').scrollIntoViewIfNeeded();
      // Erst nach der Öffnungs-Animation fotografieren.
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${SHOTS}/satzbank-${s.name}.png` });
    });
  });
}
