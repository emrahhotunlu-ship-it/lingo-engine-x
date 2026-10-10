import { test, type Page } from '@playwright/test';
import { boot, openTab, screen, type Theme } from './fixtures';

// Bildschirmfotos für den Design-Vergleich (R6 Spur B: C1-Reise, Wort-Himmel, Struktur-Film) nach `docs/umbau/design-vergleich/r6b-*.png`.
// Läuft nur auf Zuruf (`LX_SHOTS=1`), sonst übersprungen: Bilder sind Belege für Emrah und den ux-reviewer, keine Prüfung.

const OUT = 'docs/umbau/design-vergleich';
const on = !!process.env.LX_SHOTS;

const sizes = [
  { name: '390-dunkel', viewport: { width: 390, height: 844 }, theme: 'dark' as Theme, touch: true },
  { name: '390-hell', viewport: { width: 390, height: 844 }, theme: 'light' as Theme, touch: true },
  { name: '1440', viewport: { width: 1440, height: 900 }, theme: 'dark' as Theme, touch: false },
];

async function start(page: Page, theme: Theme, fx = 'full') {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await boot(page, { migrated: true, theme, localStorage: { 'lx:flags': 'program,sky,film', 'lx:fx': fx, 'lx:journey-seen': '2026-09-20' } });
  await screen(page, 'today');
}

for (const s of sizes) {
  test.describe(`Fotos ${s.name}`, () => {
    test.skip(!on, 'nur mit LX_SHOTS=1');
    test.use({ viewport: s.viewport, hasTouch: s.touch });

    test('C1-Reise', async ({ page }) => {
      await start(page, s.theme);
      await openTab(page, 'learn');
      const map = page.getByTestId('program-map');
      await map.scrollIntoViewIfNeeded();
      await page.waitForTimeout(8000); // Lichthof ausgeatmet
      await map.screenshot({ path: `${OUT}/r6b-reise-${s.name}.png` });
    });

    test('Wort-Himmel', async ({ page }) => {
      await start(page, s.theme);
      await openTab(page, 'vocab');
      await page.getByTestId('ws-atlas').click();
      const sky = page.getByTestId('word-sky');
      await sky.waitFor();
      await sky.scrollIntoViewIfNeeded();
      await page.waitForTimeout(900);
      await (s.touch ? sky : page.getByTestId('atlas')).screenshot({ path: `${OUT}/r6b-himmel-${s.name}.png` });
    });

    test('Struktur-Film (Bildfolge)', async ({ page }) => {
      await start(page, s.theme);
      await openTab(page, 'learn');
      await page.locator('[data-testid="program-chapter"][data-chapter="k7"] [data-testid="program-chapter-open"]').click();
      if (s.touch === false) await page.getByTestId('program-more').click();
      const sheet = page.getByTestId('chapter-sheet');
      await sheet.getByTestId('film-open').click();
      const film = page.getByTestId('film');
      await film.waitFor();
      await film.scrollIntoViewIfNeeded();
      await film.screenshot({ path: `${OUT}/r6b-film-${s.name}-1-vorhersage.png` });
      const opts = film.getByTestId('film-option');
      if (await opts.count()) await opts.first().click();
      else await film.getByTestId('film-word').first().click();
      // Nach dem Raten startet der Film nach ~1 s von selbst.
      await page.locator('[data-testid="film"][data-phase="play"]').waitFor();
      await page.waitForTimeout(300);
      await film.screenshot({ path: `${OUT}/r6b-film-${s.name}-2-start.png` });
      await page.waitForTimeout(1600 + 140);
      await film.screenshot({ path: `${OUT}/r6b-film-${s.name}-3-bewegung.png` });
      await page.waitForTimeout(1400);
      await film.screenshot({ path: `${OUT}/r6b-film-${s.name}-4-ende.png` });
    });
  });
}
