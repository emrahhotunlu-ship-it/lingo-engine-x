import { expect, test, type Locator, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';

// Relaunch Stufe 1, P2 S1-SHELL (docs/relaunch/stufe1-plan.md §6.3, Abnahme A5): jeder Bereich und jeder frühere Reiter-Bildschirm
// (Heute, Wortschatz, Grammatik, Anwenden/Praxis, Lesen, Fortschritt) ist von „Heute“ aus in höchstens zwei Klicks erreichbar –
// am Handy über die Leiste unten und die Hub-Zeilen, am Laptop über die Seitenleiste.
// Jeder Weg beginnt frisch auf „Heute“ (Tipp auf „Heute“ zählt nicht mit).

type Goal = { name: string; clicks: string[]; done: (page: Page) => Locator };

const onScreen = (name: string) => (page: Page) => page.locator(`[data-screen="${name}"]`);
const byId = (id: string) => (page: Page) => page.getByTestId(id);

const COMMON: Goal[] = [
  { name: 'Wortschatz', clicks: ['tab-vocab'], done: onScreen('vocab') },
  { name: 'Grammatik', clicks: ['tab-learn'], done: onScreen('learn') },
  { name: 'Praxis (früher Anwenden)', clicks: ['tab-apply'], done: onScreen('apply') },
  { name: 'Fortschritt', clicks: ['tab-progress'], done: onScreen('overview') },
  { name: 'Profil', clicks: ['tab-progress', 'open-profile'], done: byId('profile-sheet') },
  { name: 'Claude', clicks: ['open-companion'], done: byId('companion') },
];

/** Zuletzt: eine Übung starten (danach braucht es keinen Rückweg mehr). */
const EXERCISE: Goal = { name: 'Übung', clicks: ['start'], done: (page) => page.locator('[data-testid="frame"][data-exercise]') };

const PHONE: Goal[] = [
  ...COMMON,
  { name: 'Lesen (früherer Reiter)', clicks: ['tab-apply', 'hub-read'], done: onScreen('read') },
  { name: 'Sprechen', clicks: ['tab-apply', 'hub-speak-page'], done: onScreen('speak') },
  { name: 'Einstellungen', clicks: ['tab-progress', 'open-settings'], done: (page) => page.getByRole('dialog', { name: 'Einstellungen' }) },
  EXERCISE,
];

const DESK: Goal[] = [
  ...COMMON,
  { name: 'Lesen (früherer Reiter)', clicks: ['side-practice-toggle', 'side-read'], done: onScreen('read') },
  { name: 'Sprechen', clicks: ['side-practice-toggle', 'side-speak'], done: onScreen('speak') },
  { name: 'Hören', clicks: ['side-practice-toggle', 'side-listen'], done: onScreen('apply') },
  { name: 'Einstellungen', clicks: ['side-settings'], done: (page) => page.getByRole('dialog', { name: 'Einstellungen' }) },
  { name: 'Übersetzer', clicks: ['side-translate'], done: byId('companion') },
  EXERCISE,
];

/** Zurück auf eine frische „Heute“-Wurzel: neu laden (leert die Stapel der Reiter; der Klick-Zähler beginnt von vorn). */
async function home(page: Page): Promise<void> {
  await page.reload();
  await screen(page, 'today');
}

for (const [label, viewport, goals] of [
  ['Handy 390 px', { width: 390, height: 844 }, PHONE],
  ['Laptop 1280 px', { width: 1280, height: 800 }, DESK],
] as const) {
  test(`A5 ${label}: jeder Bereich in höchstens zwei Klicks`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
    const page = await ctx.newPage();
    const { errors, external } = await boot(page, { migrated: true });
    await screen(page, 'today');
    for (const [i, goal] of goals.entries()) {
      expect(goal.clicks.length, goal.name).toBeLessThanOrEqual(2);
      for (const id of goal.clicks) {
        const el = page.getByTestId(id).first();
        // „Praxis“ bleibt aufgeklappt, wenn sie es schon ist (der Klick würde sie wieder zuklappen).
        if (id === 'side-practice-toggle' && (await el.getAttribute('aria-expanded')) === 'true') continue;
        await el.click();
      }
      await expect(goal.done(page).first(), goal.name).toBeVisible();
      if (i < goals.length - 1) await home(page);
    }
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await ctx.close();
  });
}
