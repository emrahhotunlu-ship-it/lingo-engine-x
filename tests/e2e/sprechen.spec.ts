import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, openSpeak, screen } from './fixtures';
import { installGoalCheckReply } from './sprechenHelpers';
import { DAY, dump } from './trainerHelpers';

// Neubau P5 – Sprechen, Business & Preply (plan.md §4.6): Sprechen-Wurzel mit Gespräche ·
// Schreiben · Preply, Gespräch in ≤ 2 Tipps, Ziel-Checkliste mit Haken (goal-check@1),
// Fortsetzen nach Neuladen nach Zug 3, „Laut zuerst“ bis zur besseren Fassung mit ▶, Sag es ohne
// KI speicherbar, Einheits-Modus (Block 3) mit Wochenziel-Leiste.

type Doc = Record<string, unknown>;
const MOBILE = { width: 390, height: 844 };
const FIRST = 'We are working with them since 2019 and they save many hours every month. The cloud is cheaper than the old server room, and the team likes it. Can we discuss the numbers next week?';

async function send(page: Page, text: string): Promise<void> {
  const before = await page.locator('[data-testid="rp-turn"][data-role="persona"]').count();
  await page.getByTestId('composer-input').fill(text);
  await page.getByTestId('composer-send').click();
  await expect(page.locator('[data-testid="rp-turn"][data-role="persona"]')).toHaveCount(before + 1);
  await expect(page.getByTestId('roleplay')).toHaveAttribute('data-state', 'composing');
}

test.use({ viewport: MOBILE });

test('Wurzel: drei Bereiche, Szene der Woche, Gespräch in 2 Tipps, Ziel-Haken, Neuladen nach Zug 3, Bericht mit Raster', async ({ page }) => {
  await installGoalCheckReply(page);
  const { errors, external } = await boot(page, { migrated: true, fake: { persist: true } });
  await screen(page, 'today');
  await openSpeak(page, 'talk');
  await expect(page.getByTestId('speak-seg-talk')).toBeVisible();
  await expect(page.getByTestId('speak-seg-write')).toBeVisible();
  await expect(page.getByTestId('speak-seg-preply')).toBeVisible();
  await expect(page.getByTestId('training-meeting')).toBeVisible();
  await expect(page.getByTestId('speak-training').getByTestId('training-fluency')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Tipp 1: Szene der Woche → Einweisung mit Ziel-Checkliste (ohne Haken); Tipp 2: Start.
  await page.getByTestId('speak-theme-scene').click();
  await expect(page.getByTestId('briefing-goals').getByTestId('goal-item')).toHaveCount(3);
  await expect(page.getByTestId('briefing-goals').locator('[data-state="none"]')).toHaveCount(3);
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
  const goals = page.getByTestId('rp-goals');
  await expect(goals.getByTestId('goal-item')).toHaveCount(3);
  await expect(goals).toHaveAttribute('data-met', '0');

  // Nach der ersten Antwort der Figur: ein Haken (goal-check@1).
  await send(page, 'What is prompting you to look at this now?');
  await expect(goals).toHaveAttribute('data-met', '1');
  await expect(goals.locator('[data-testid="goal-item"][data-state="met"]')).toHaveCount(1);
  await send(page, 'Can you walk me through your current process?');
  await send(page, 'Who else is involved in the decision?');
  await expect(page.locator('[data-testid="rp-turn"][data-role="me"]')).toHaveCount(3);

  // Neuladen nach Zug 3: dieselbe Szene, drei eigene Züge, Haken bleibt.
  await page.reload();
  await screen(page, 'today');
  await openSpeak(page, 'talk');
  await page.getByTestId('speak-theme-scene').click();
  await page.getByTestId('rp-resume').click();
  await screen(page, 'roleplay');
  await expect(page.locator('[data-testid="rp-turn"][data-role="me"]')).toHaveCount(3);
  await expect(page.getByTestId('rp-goals')).toHaveAttribute('data-met', '1');

  // Beenden → Bericht: Ziele mit Beleg, Kriterien-Raster.
  await send(page, 'So if I am hearing you correctly, time is the main issue.');
  await page.getByTestId('rp-end').click();
  await expect(page.getByTestId('report')).toHaveAttribute('data-state', 'saved');
  await expect(page.getByTestId('report-goal-list').locator('[data-state="met"]')).toHaveCount(1);
  await expect(page.getByTestId('report-criteria')).toHaveAttribute('data-state', 'done');
  expect(await page.getByTestId('criterion').count()).toBeGreaterThanOrEqual(3);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Schreiben: Sag es mit „Laut zuerst“ bis zur besseren Fassung mit ▶', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openSpeak(page, 'write');
  await expect(page.getByTestId('speak-write').getByTestId('biz-mail')).toBeVisible();
  await expect(page.getByTestId('speak-write').getByTestId('training-tones')).toBeVisible();
  await page.getByTestId('write-say').click();
  await screen(page, 'say');
  await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'aloud');
  await expect(page.getByTestId('say-aloud-timer')).toBeVisible();
  await page.getByTestId('say-aloud-done').click();
  await expect(page.getByTestId('say-dictate-hint')).toBeVisible();
  await page.getByTestId('say-draft').fill(FIRST);
  await page.getByTestId('say-check').click();
  await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'feedback');
  await expect(page.getByTestId('say-better')).toBeVisible();
  await expect(page.getByTestId('say-shadow')).toBeVisible();
  await page.getByTestId('say-better-play').first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken.length)).toBeGreaterThan(0);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Ohne KI: Sag es bleibt speicherbar', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await screen(page, 'today');
  await openSpeak(page, 'write');
  await page.getByTestId('write-say').click();
  await page.getByTestId('say-aloud-done').click();
  await page.getByTestId('say-draft').fill(FIRST);
  await page.getByTestId('say-noai').click();
  await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'final');
  await expect.poll(async () => ((await dump(page))['say/2026-09']?.items as Doc[] | undefined)?.length ?? 0).toBe(1);
  expect(((await dump(page))['say/2026-09']?.items as Doc[])[0]).toMatchObject({ ai: false, day: DAY });
  expect(errors).toEqual([]);
});

test('Tageseinheit Block 3: Sag es zum Wochenthema mit Wochenziel-Leiste, Zähler steigt beim Tippen', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'say', unit: 3 });
  await screen(page, 'say');
  // Die Situation ist die Kernaufgabe der Woche (kein „Andere Situation“).
  await expect(page.getByTestId('say-situation')).toHaveAttribute('data-sit', /^wk-t\d\d$/);
  await expect(page.getByTestId('say-other')).toHaveCount(0);
  await page.getByTestId('say-aloud-done').click();
  const bar = page.getByTestId('target-bar');
  await expect(bar).toBeVisible();
  const chip = bar.locator('[data-testid="target-chip"][data-kind="transition"]');
  if (await chip.count()) {
    await expect(chip).toHaveAttribute('data-have', '0');
    await page.getByTestId('say-draft').fill('First of all, thank you. However, the price is high.');
    await expect(chip).not.toHaveAttribute('data-have', '0');
  }
  await page.getByTestId('say-draft').fill(FIRST);
  await page.getByTestId('say-check').click();
  await expect(page.getByTestId('say-unit-next')).toBeVisible();
  await expect(page.getByTestId('say-again')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const [theme, lang] of [['dark', 'de'], ['dim', 'en'], ['light', 'de']] as const) {
  test(`Wurzel Sprechen · ${theme} · ${lang} · axe (Gespräche, Schreiben)`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, { migrated: true, theme, lang });
    await screen(page, 'today');
    for (const seg of ['talk', 'write'] as const) {
      await openSpeak(page, seg);
      expect(await layoutProblems(page)).toEqual([]);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      await page.screenshot({ path: `test-results/screens/sprechen-${seg}-${theme}-${lang}.png`, fullPage: true });
    }
  });
}

test('Tageseinheit Block 3: 90/60/45 mit Frage A der Woche und Wochenziel-Leiste', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'fluency', unit: 3 });
  await screen(page, 'fluency');
  await expect(page.getByTestId('fluency-question')).toHaveAttribute('data-q', /.+/);
  await page.getByTestId('fluency-start').click();
  await expect(page.getByTestId('target-bar')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Tageseinheit Block 3: Rollenspiel zum Thema mit Wochenziel-Leiste, „Weiter“ im Bericht wartet nicht auf die KI', async ({ page }) => {
  await installGoalCheckReply(page);
  const { errors } = await bootAt(page, { name: 'roleplay', sceneId: 'b03', unit: 3 });
  await screen(page, 'roleplay');
  await expect(page.getByTestId('target-bar')).toBeVisible();
  await expect(page.getByTestId('rp-traps')).toBeVisible();
  await send(page, 'I understand it may seem high at first glance, but it pays for itself within 18 months.');
  // Zähler der Wochenziele stehen da (die Wendungen hängen vom Wochenthema des Testtags ab).
  expect(await page.getByTestId('target-bar').getByTestId('target-chip').count()).toBeGreaterThan(0);
  await page.getByTestId('rp-end').click();
  await expect(page.getByTestId('report')).toHaveAttribute('data-state', 'saved');
  await expect(page.getByTestId('report-unit-next')).toBeEnabled();
  expect(errors).toEqual([]);
});
