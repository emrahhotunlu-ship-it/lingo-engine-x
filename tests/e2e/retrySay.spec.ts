import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openSpeak, screen } from './fixtures';
import { DAY, dump, writes } from './trainerHelpers';

// Rollenspiel+ (Lernplattform 3.0 P51): Kapitelziel im Szenenstart und im Gespräch, turn-analysis@3, „Sag’s nochmal“ (Korrektur verdeckt, genau ein
// repair-check@1 je Prüfung, ✓ schließt die Stelle ohne Buchung), K7-Eintrag `s: 'talk'` beim Beenden, eingefügter Text zählt nie, Laptop: Analyse
// rechts, iPhone-Hinweis. Nachgebildete Analyse: „must …“ → Fehler, sonst sauber; repair-check: `zzno` → nicht repariert.

type Doc = Record<string, unknown>;
type Call = { id: string; tier: string };

const calls = async (page: Page, id: string): Promise<number> =>
  (await page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Call[] } }).__LINGO_FAKE__.sampleCalls])).filter((c) => c.id === id).length;

async function startScene(page: Page, id = 'sc-vida'): Promise<void> {
  await screen(page, 'today');
  await openSpeak(page);
  await page.locator(`[data-testid="scene-card"][data-scene="${id}"]`).click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  // Kapitelziel schon im Szenenstart (freiwillig, mit Grund).
  await expect(page.getByTestId('briefing-chapter-goal')).toBeVisible();
  await expect(page.getByTestId('briefing-chapter-goal')).toContainText('In diesem Gespräch:');
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
  await expect(page.locator('[data-testid="rp-turn"][data-role="persona"]').first()).toBeVisible();
}

async function say(page: Page, text: string, opts: { paste?: boolean } = {}): Promise<void> {
  const before = await page.locator('[data-testid="rp-turn"][data-role="persona"]').count();
  const input = page.getByTestId('composer-input');
  if (opts.paste) await input.dispatchEvent('paste');
  await input.fill(text);
  await page.getByTestId('composer-send').click();
  await expect(page.locator('[data-testid="rp-turn"][data-role="persona"]')).toHaveCount(before + 1);
  await expect(page.getByTestId('roleplay')).toHaveAttribute('data-state', 'composing');
}

const talkProds = async (page: Page): Promise<Doc[]> => (((await dump(page))['app/c1'] as { prod?: Doc[] } | undefined)?.prod ?? []).filter((p) => p.s === 'talk');
const bookings = async (page: Page): Promise<number> => (await writes(page)).filter((w) => /^(app\/c1|repair|app\/radar)/.test(w.path)).length;

test('Laptop: Analyse rechts, „Sag’s nochmal“ ohne Korrektur, ein repair-check, ✓ geschlossen ohne Buchung, K7-Eintrag beim Beenden', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors, external } = await boot(page, { migrated: true, localStorage: { 'lx:input': 'keys' } });
  await startScene(page);
  await expect(page.getByTestId('rp-chapter-goal')).toBeVisible();
  await expect(page.getByTestId('rp-chapter-goal-item').first()).toHaveAttribute('data-have', '0');

  await say(page, 'We must delay the start by two weeks.');
  const panel = page.getByTestId('analysis-panel');
  await expect(panel).toBeVisible();
  const card = panel.locator('[data-testid="analysis"][data-idx="1"]');
  await expect(card).toHaveAttribute('data-state', 'errors', { timeout: 15_000 });
  // Laptop: Gespräch links, Analysespur rechts.
  const chatBox = await page.getByTestId('composer-input').boundingBox();
  const panelBox = await panel.boundingBox();
  expect(chatBox && panelBox && panelBox.x > chatBox.x + chatBox.width - 1).toBe(true);
  await expect(card.getByTestId('an-error')).toHaveCount(1);
  expect(await calls(page, 'turn-analysis')).toBeGreaterThan(0);

  // „Sag’s nochmal“: Korrektur verdeckt, eigener Satz mit markierter Stelle, vier Fragen sichtbar, keine Aussprachebewertung, kein iPhone-Hinweis.
  await card.getByTestId('rs-open').click();
  await expect(card).toHaveAttribute('data-hidden', '');
  await expect(card.getByTestId('an-error')).toHaveCount(0);
  await expect(card.getByTestId('an-upgraded')).toHaveCount(0);
  await expect(card.getByTestId('an-lands')).toHaveCount(0);
  await expect(card).not.toContainText('push back');
  await expect(card.getByTestId('rs-panel')).toContainText('Sag oder tipp den Satz noch einmal');
  await expect(card.getByTestId('rs-panel')).toContainText('behält sie besser');
  await expect(card.getByTestId('rs-before').locator('[data-off]')).toHaveCount(1);
  await expect(card.getByTestId('rs-noscore')).toBeVisible();
  await expect(card.getByTestId('rs-iphone')).toHaveCount(0);
  const axe = await new AxeBuilder({ page }).include('[data-testid="analysis-panel"]').include('[data-testid="rp-goals-box"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);

  // Unveränderter Satz: kein Aufruf.
  await card.getByTestId('rs-input').fill('We must delay the start by two weeks.');
  await card.getByTestId('rs-check').click();
  await expect(card.getByTestId('rs-same')).toBeVisible();
  expect(await calls(page, 'repair-check')).toBe(0);

  const before = await bookings(page);
  await card.getByTestId('rs-input').fill('We have to push back the start by two weeks.');
  await card.getByTestId('rs-check').click();
  const result = card.getByTestId('rs-result');
  await expect(result).toHaveAttribute('data-state', 'ok', { timeout: 15_000 });
  await expect(result).toContainText('Repariert');
  await expect(result).toContainText('We have to push back the start by two weeks.');
  expect(await calls(page, 'repair-check')).toBe(1);
  // Erledigt heißt erledigt: kein Knopf mehr, Korrektur wieder sichtbar, nichts gebucht.
  await expect(card.getByTestId('rs-open')).toHaveCount(0);
  await expect(card.getByTestId('an-error')).toHaveCount(1);
  expect(await bookings(page)).toBe(before);

  // Ein sauberer Satz: Analyse mit `used` (turn-analysis@3).
  await say(page, 'That depends on your test team and the exposure.');
  await expect(panel.locator('[data-testid="analysis"][data-idx="3"]')).toHaveAttribute('data-state', 'clean', { timeout: 15_000 });
  // Der Stand je Zielmuster steht im Zielkasten (die Zählung selbst prüft der Unit-Test goalProgress).
  await expect(page.getByTestId('rp-chapter-goal-item').first()).toContainText(' von ');
  expect(await calls(page, 'repair-check')).toBe(1);
  expect(await layoutProblems(page)).toEqual([]);

  // Beenden: genau ein K7-Eintrag `talk` mit Kennung, Wörter und Fehler aus den eigenen Zügen.
  await page.getByTestId('rp-end').click();
  await expect(page.getByTestId('report')).toBeVisible();
  await expect(page.getByTestId('report-ai')).toHaveAttribute('data-state', 'done', { timeout: 15_000 });
  await expect.poll(async () => (await talkProds(page)).length).toBe(1);
  const [prod] = await talkProds(page);
  expect(prod).toMatchObject({ d: DAY, s: 'talk', w: 17, e: 1 });
  expect(String(prod?.id)).toMatch(/^talk:/);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Handy (iPhone): Hinweis zur Spracheingabe, zwei Versuche, dann Korrektur zeigen; eingefügter Text → kein K7-Eintrag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true, localStorage: { 'lx:input': 'touch' } });
  await startScene(page);
  await say(page, 'Our budget is fixed for this quarter.', { paste: true });
  await say(page, 'We must delay the start by two weeks.');
  const chip = page.locator('[data-testid="an-chip"]').nth(1);
  await expect(chip).toHaveAttribute('data-state', 'errors', { timeout: 15_000 });
  await chip.click();
  const card = page.locator('[data-testid="analysis"][data-idx="3"]').first();
  await card.getByTestId('rs-open').click();
  await expect(card.getByTestId('rs-iphone')).toBeVisible();
  await expect(card.getByTestId('an-error')).toHaveCount(0);

  await card.getByTestId('rs-input').fill('We zzno delay the start.');
  await card.getByTestId('rs-check').click();
  await expect(card.getByTestId('rs-result')).toHaveAttribute('data-state', 'no', { timeout: 15_000 });
  await expect(card.getByTestId('rs-result')).toContainText('Noch nicht ganz');
  expect(await calls(page, 'repair-check')).toBe(1);
  await card.getByTestId('rs-input').fill('We zzno postpone it.');
  await card.getByTestId('rs-check').click();
  await expect.poll(() => calls(page, 'repair-check')).toBe(2);
  await expect(card.getByTestId('rs-result')).toHaveAttribute('data-state', 'no');
  // Zwei Versuche verbraucht: kein Prüfen mehr, nur noch die Korrektur zeigen.
  await expect(card.getByTestId('rs-check')).toHaveCount(0);
  await card.getByTestId('rs-close').click();
  await expect(card.getByTestId('an-error')).toHaveCount(1);
  await expect(card.getByTestId('rs-open')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);

  await page.getByTestId('rp-end').click();
  await expect(page.getByTestId('report')).toBeVisible();
  await expect(page.getByTestId('report-ai')).toHaveAttribute('data-state', 'done', { timeout: 15_000 });
  await expect.poll(async () => ((await dump(page))['talk/2026-09'] as { runs: Doc[] } | undefined)?.runs.some((r) => r.day === DAY)).toBe(true);
  expect(await talkProds(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Schalter aus: turn-analysis@2, kein Kapitelziel, kein „Sag’s nochmal“', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await boot(page, { migrated: true, localStorage: { 'lx:flags': '{"tutor":{"talk":false}}', 'lx:input': 'keys' } });
  await screen(page, 'today');
  await openSpeak(page);
  await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
  await expect(page.getByTestId('briefing')).toBeVisible();
  await expect(page.getByTestId('briefing-chapter-goal')).toHaveCount(0);
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
  await say(page, 'We must delay the start by two weeks.');
  const card = page.getByTestId('analysis-panel').locator('[data-testid="analysis"][data-idx="1"]');
  await expect(card).toHaveAttribute('data-state', 'errors', { timeout: 15_000 });
  await expect(page.getByTestId('rp-chapter-goal')).toHaveCount(0);
  await expect(card.getByTestId('rs-open')).toHaveCount(0);
});
