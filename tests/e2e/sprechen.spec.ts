import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openSpeak, screen } from './fixtures';
import { setInputProfile } from './input';
import { installGoalCheckReply } from './sprechenHelpers';

// Freiwilliges Extra „Sprechen“ (Umbau, 04.10.2026): Seite mit Rollenspiel-Szenen und Einwand-Training,
// Gespräch in ≤ 2 Tipps, Ziel-Checkliste mit Haken (goal-check@1), Fortsetzen nach Neuladen nach Zug 3.

const MOBILE = { width: 390, height: 844 };

async function send(page: Page, text: string): Promise<void> {
  const before = await page.locator('[data-testid="rp-turn"][data-role="persona"]').count();
  await page.getByTestId('composer-input').fill(text);
  await page.getByTestId('composer-send').click();
  await expect(page.locator('[data-testid="rp-turn"][data-role="persona"]')).toHaveCount(before + 1);
  await expect(page.getByTestId('roleplay')).toHaveAttribute('data-state', 'composing');
}

test.use({ viewport: MOBILE });

test('Seite: Szenen und Einwand-Training, Gespräch in 2 Tipps, Ziel-Haken, Neuladen nach Zug 3, Bericht', async ({ page }) => {
  await installGoalCheckReply(page);
  const { errors, external } = await boot(page, { migrated: true, fake: { persist: true } });
  await screen(page, 'today');
  await openSpeak(page);
  await expect(page.getByTestId('speak-scenes')).toBeVisible();
  await expect(page.getByTestId('speak-training').getByTestId('training-objection')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Tipp 1: Szene → Einweisung mit Ziel-Checkliste (ohne Haken); Tipp 2: Start.
  await page.getByTestId('scene-card').first().click();
  const nGoals = await page.getByTestId('briefing-goals').getByTestId('goal-item').count();
  expect(nGoals).toBeGreaterThan(0);
  await expect(page.getByTestId('briefing-goals').locator('[data-state="none"]')).toHaveCount(nGoals);
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
  const goals = page.getByTestId('rp-goals');
  await expect(goals.getByTestId('goal-item')).toHaveCount(nGoals);
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
  // Fortsetzen (N04/G3): frische Momentaufnahme → automatisch zurück an dieselbe Stelle.
  await screen(page, 'roleplay');
  await expect(page.locator('[data-testid="rp-turn"][data-role="me"]')).toHaveCount(3);
  await expect(page.getByTestId('rp-goals')).toHaveAttribute('data-met', '1');

  // Beenden → Bericht: Ziele mit Beleg, Kriterien-Raster.
  await send(page, 'So if I am hearing you correctly, time is the main issue.');
  await page.getByTestId('rp-end').click();
  await expect(page.getByTestId('report')).toHaveAttribute('data-state', 'saved');
  await expect(page.getByTestId('report-goal-list').locator('[data-state="met"]')).toHaveCount(1);
  // Das Kriterien-Raster gab es nur bei Business-Szenen (entfernt); die übrigen Szenen haben keines.
  await expect(page.getByTestId('report-criteria')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

for (const [theme, lang] of [['dark', 'de'], ['dim', 'en'], ['light', 'de']] as const) {
  test(`Wurzel Sprechen · ${theme} · ${lang} · axe`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await boot(page, { migrated: true, theme, lang });
    await screen(page, 'today');
    {
      await openSpeak(page);
      expect(await layoutProblems(page)).toEqual([]);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      await page.screenshot({ path: `test-results/screens/sprechen-${theme}-${lang}.png`, fullPage: true });
    }
  });
}

// Lernplattform 2.0 §6 (Zeile Rollenspiel): Mit Eingabeprofil `touch` steht der Hinweis auf die Diktiertaste da, mit `keys` nicht.
for (const profile of ['touch', 'keys'] as const) {
  test(`Rollenspiel: Hinweis auf die Diktiertaste nur mit Profil touch (${profile})`, async ({ page }) => {
    await installGoalCheckReply(page);
    await setInputProfile(page, profile);
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openSpeak(page);
    await page.getByTestId('scene-card').first().click();
    await page.getByTestId('briefing-start').click();
    await screen(page, 'roleplay');
    await expect(page.getByTestId('rp-dictate-hint')).toHaveCount(profile === 'touch' ? 1 : 0);
    if (profile === 'touch') await expect(page.getByTestId('rp-dictate-hint')).toContainText('Mikrofon-Taste');
    expect(errors).toEqual([]);
  });
}
