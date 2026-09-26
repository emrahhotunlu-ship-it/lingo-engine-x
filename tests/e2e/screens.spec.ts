import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen, type Lang, type Theme } from './fixtures';

// Jeder Bildschirm rendert auf 390, 1440 und 2560 px, in allen drei Modi und beiden
// Sprachen: keine JS-Fehler, kein undefined/NaN/{0}, kein Querscrollen, nichts
// abgeschnitten, keine Mischsprache (Kap. 12). Screenshots gehen an den ux-reviewer.

const VIEWPORTS = [
  { name: 'handy', width: 390, height: 844, mobile: true },
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'gross', width: 2560, height: 1440, mobile: false },
] as const;
const THEMES: Theme[] = ['dark', 'dim', 'light'];
const LANGS: Lang[] = ['de', 'en'];
const BG: Record<Theme, string> = { dark: 'rgb(11, 15, 25)', dim: 'rgb(26, 32, 48)', light: 'rgb(245, 246, 250)' };
const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });

const GERMAN_IN_EN = /[äöüÄÖÜß]|\b(und|nicht|wird|Karten|Tage|Einstellungen|Serie|Passiv|Indirekte|Relativsätze|Modalverben|Zukunft|Infinitiv|Artikel)\b/;
const ENGLISH_UI_IN_DE = /\b(Settings|Loading|Streak|Vocabulary|Course|Assessment|Where you stand)\b/;

for (const vp of VIEWPORTS) {
  for (const theme of THEMES) {
    for (const lang of LANGS) {
      for (const migrated of [false, true]) {
        const name = `${migrated ? 'stand' : 'umstellung'}-${vp.name}-${theme}-${lang}`;
        test(name, async ({ browser }) => {
          const context = await browser.newContext({
            viewport: { width: vp.width, height: vp.height },
            isMobile: vp.mobile,
            hasTouch: vp.mobile,
            deviceScaleFactor: vp.mobile ? 2 : 1,
            timezoneId: 'Europe/Berlin',
            locale: lang === 'de' ? 'de-DE' : 'en-US',
          });
          const page = await context.newPage();
          const { errors, external } = await boot(page, { theme, lang, migrated });
          if (migrated) await openOverview(page);
        else await screen(page, 'migration');
          if (!migrated) await expect(page.getByTestId('mig-streak')).toBeVisible();

          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await expect(page.locator('html')).toHaveAttribute('lang', lang);
          expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(BG[theme]);

          expect(await layoutProblems(page)).toEqual([]);
          const text = await page.locator('body').innerText();
          if (lang === 'en') expect(GERMAN_IN_EN.exec(text)?.[0] ?? null, 'Deutsch in der englischen Oberfläche').toBeNull();
          else expect(ENGLISH_UI_IN_DE.exec(text)?.[0] ?? null, 'Englische Bedienelemente in der deutschen Oberfläche').toBeNull();

          await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
          expect(errors).toEqual([]);
          expect(external).toEqual([]);
          await context.close();
        });
      }
    }
  }
}

test('reduzierte Bewegung: alles erscheint ohne Animation vollständig', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Berlin' });
  const page = await context.newPage();
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  expect(errors).toEqual([]);
  await context.close();
});
