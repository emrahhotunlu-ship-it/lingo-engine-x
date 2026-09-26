import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen, type Lang, type Theme } from './fixtures';
import { answerAll, openModule } from './inputHelpers';

// Plattform und Oberfläche von Phase 4 (Plan §8.3): alle neuen Bildschirme in drei Modi, beiden
// Sprachen, Handy und Desktop – keine JS-Fehler, keine fremden Anfragen, kein undefined/NaN/{0},
// kein Querscrollen, nichts abgeschnitten, keine Mischsprache; axe ohne Befund; Widerspruchstest
// zwischen Angebotszeile, Modul-Häkchen und `channelDone`. Screenshots für den ux-reviewer.

const THEMES: Theme[] = ['dark', 'dim', 'light'];
const LANGS: Lang[] = ['de', 'en'];
const VIEWPORTS = [
  { name: 'handy', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
] as const;
const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

const GERMAN_IN_EN = /[äöüÄÖÜß]|\b(und|nicht|wird|Karten|Tage|Lesen|Hören|Schreiben|Entdecken|Verlauf|Weiter)\b/;
const ENGLISH_UI_IN_DE = /\b(Reading|Listening|Writing|Discover|History|Next|Submit|Done reading)\b/;

type Stop = { name: string; go: (page: Page) => Promise<void> };

const STOPS: Stop[] = [
  { name: 'lesen', go: (p) => openModule(p, 'read') },
  { name: 'hoeren', go: (p) => openModule(p, 'listen') },
  { name: 'schreiben', go: (p) => openModule(p, 'write') },
  { name: 'entdecken', go: (p) => openModule(p, 'discover') },
  {
    name: 'beitrag',
    go: async (p) => {
      await openModule(p, 'discover');
      await p.locator('[data-testid="feed-item"][data-id="vida-ey"]').click();
      await p.getByTestId('next').click();
      await p.getByTestId('gist').waitFor();
    },
  },
  {
    name: 'verlauf',
    go: async (p) => {
      await openOverview(p);
      await p.locator('[data-testid="module-history"]').nth(2).click();
      await p.getByTestId('history').waitFor();
    },
  },
];

/** Nur UI-Texte prüfen: englische Inhalte (lang="en") zählen in der DE-Oberfläche nicht als Mischsprache. */
async function uiText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const clone = document.querySelector('main')?.cloneNode(true) as HTMLElement | undefined;
    if (!clone) return '';
    clone.querySelectorAll('[lang="en"], [lang="de"]').forEach((n) => {
      if (n.getAttribute('lang') !== document.documentElement.lang) n.remove();
    });
    return clone.innerText;
  });
}

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      test(`Phase 4 · ${vp.name} · ${theme} · ${lang}`, async ({ browser }) => {
        test.setTimeout(120_000);
        const context = await browser.newContext({
          viewport: { width: vp.width, height: vp.height },
          isMobile: vp.mobile,
          hasTouch: vp.mobile,
          timezoneId: 'Europe/Berlin',
          locale: lang === 'de' ? 'de-DE' : 'en-US',
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const { errors, external } = await boot(page, { theme, lang, migrated: true });
        await screen(page, 'today');
        for (const stop of STOPS) {
          await stop.go(page);
          await page.waitForTimeout(250);
          expect(await layoutProblems(page), `${stop.name}`).toEqual([]);
          const text = await uiText(page);
          if (lang === 'en') expect(GERMAN_IN_EN.exec(text)?.[0] ?? null, `${stop.name}: Deutsch in EN`).toBeNull();
          else expect(ENGLISH_UI_IN_DE.exec(text)?.[0] ?? null, `${stop.name}: Englisch in DE`).toBeNull();
          if (theme !== 'dim') await page.screenshot({ path: `${SHOTS}/input-${stop.name}-${vp.name}-${theme}-${lang}.png`, fullPage: true });
          // Zurück zum Start für den nächsten Halt.
          await page.getByTestId('unit-close').first().click();
          await page.waitForTimeout(150);
          if (!(await page.locator('[data-screen="today"]').count())) await page.getByTestId('unit-close').first().click();
          await screen(page, 'today');
        }
        expect(errors).toEqual([]);
        expect(external).toEqual([]);
        await context.close();
      });
    }
  }
}

for (const theme of THEMES) {
  test(`axe · Phase-4-Bildschirme · ${theme}`, async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const page = await context.newPage();
    await boot(page, { theme, migrated: true });
    for (const stop of STOPS) {
      await stop.go(page);
      await page.waitForTimeout(250);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${stop.name} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      await page.getByTestId('unit-close').first().click();
      await page.waitForTimeout(150);
      if (!(await page.locator('[data-screen="today"]').count())) await page.getByTestId('unit-close').first().click();
      await screen(page, 'today');
    }
    // Fragen und Rückmeldung (nach der Wahl) ebenfalls ohne Befund.
    await openModule(page, 'read');
    await page.getByTestId('read-done').click();
    await page.getByTestId('option').first().click();
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => `frage ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await context.close();
  });
}

test('Widerspruchstest: Angebotszeile, Modul-Häkchen und Klickziel folgen channelDone', async ({ page }) => {
  test.setTimeout(90_000);
  // Pflicht ist heute nichts (Plan ohne Wiederholen) → Angebote sind sichtbar.
  await boot(page, {
    migrated: true,
    fake: { patch: { 'app/profile': { newPerDay: 0, plan: { d: '2026-09-20', v: 1, ids: [], why: [], duty: [], goal: { review: 0 }, lesson: null, at: 1 } }, 'articles/ai1789149600000': null } },
  });
  await screen(page, 'today');
  const offers = page.getByTestId('input-offers');
  await expect(offers).toBeVisible();
  // Hören ist im Testbestand heute schon erledigt: keine Zeile, im Modul ein Häkchen.
  await expect(page.locator('[data-testid="offer"][data-channel="listen"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="offer"][data-channel="read"]')).toBeVisible();
  await expect(page.locator('[data-testid="offer"][data-channel="discover"]')).toContainText('neue Beiträge');
  await openOverview(page);
  await expect(page.locator('[data-module="listen"] [data-testid="module-done"]')).toHaveCount(1);
  await expect(page.locator('[data-module="read"] [data-testid="module-done"]')).toHaveCount(0);

  // Lesen abschließen (Klickziel der Angebotszeile) → Zeile verschwindet, Modul zeigt erledigt.
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  await page.locator('[data-testid="offer"][data-channel="read"]').click();
  await page.getByTestId('read-done').click();
  await answerAll(page, 4);
  await expect(page.getByTestId('unit-done')).toBeVisible();
  await page.getByTestId('unit-close').click();
  await screen(page, 'today');
  await expect(page.locator('[data-testid="offer"][data-channel="read"]')).toHaveCount(0);
  await openOverview(page);
  await expect(page.locator('[data-module="read"] [data-testid="module-done"]')).toHaveCount(1);
});
