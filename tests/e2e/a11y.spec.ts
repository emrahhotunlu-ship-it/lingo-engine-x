import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { boot, openSettings, openOverview, screen, type Theme } from './fixtures';
import { learnTour } from './learnHelpers';
import { openChecks } from './profilHelpers';
import { checkSettled, playCheck, progressTour } from './progressHelpers';
import { tourPatch, trainerTour } from './trainerHelpers';

// Barrierefreiheit (Kap. 8, Kap. 12): axe in allen drei Modi, Touch-Ziele ≥ 44 px.

const THEMES: Theme[] = ['dark', 'dim', 'light'];

for (const theme of THEMES) {
  for (const migrated of [false, true]) {
    for (const width of [390, 1440]) {
      test(`axe · ${migrated ? 'Stand' : 'Umstellung'} · ${theme} · ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await boot(page, { theme, migrated });
        if (migrated) await openOverview(page);
        else await screen(page, 'migration');
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }
  }
}

// Phase 2: alle Lernen-Bildschirme (Hub, Kurs, Lektion, Grammatik, Regelblatt, Aufgabe, Wissen,
// Wortschatz, Lückenjagd, Satzbau) je Modus und Breite.
for (const theme of THEMES) {
  for (const width of [390, 1440]) {
    test(`axe · Lernen · ${theme} · ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await boot(page, { theme, migrated: true });
      await screen(page, 'today');
      const found: string[] = [];
      await learnTour(page, async (name) => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        found.push(...res.violations.map((v) => `${name} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
      });
      expect(found).toEqual([]);
    });
  }
}

// Trainer: jede neue Abfrageart (Frage und Ergebnis), Situation, Wendungsblatt – je Modus und Breite.
for (const theme of THEMES) {
  for (const width of [390, 1440]) {
    test(`axe · Trainer-Abfragearten und Wendungen · ${theme} · ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await boot(page, { theme, migrated: true, fake: { patch: tourPatch(width < 700) } });
      await screen(page, 'today');
      const found: string[] = [];
      await trainerTour(page, async (name) => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        found.push(...res.violations.map((v) => `${name} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
      });
      expect(found).toEqual([]);
    });
  }
}


test('axe · Einstellungen offen (alle Modi)', async ({ browser }) => {
  for (const theme of THEMES) {
    // Je Modus eine frische Seite: keine gehäuften Init-Skripte und Uhren aus dem vorigen Durchlauf.
    const context = await browser.newContext({ reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const page = await context.newPage();
    await boot(page, { theme, migrated: true });
    await openOverview(page);
    await openSettings(page);
    await expect(page.getByRole('dialog')).toBeVisible();
    const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => `${theme} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    await context.close();
  }
});

test('Touch-Ziele am Handy mindestens 44 × 44 px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { migrated: true });
  await openOverview(page);
  await openSettings(page);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.waitForTimeout(400);
  const small = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button, [role="radio"], a[href], input, select, textarea'))
      // Antippbare Wörter im Fließtext (`.lx-word`) fallen unter die Inline-Ausnahme von WCAG 2.5.8.
      .filter((el) => el.offsetParent !== null && !el.classList.contains('sr-only') && !el.classList.contains('lx-word'))
      .map((el) => ({ label: el.getAttribute('aria-label') ?? el.textContent?.trim() ?? el.tagName, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.width < 44 || r.height < 44)
      .map(({ label, r }) => `${label} (${Math.round(r.width)}×${Math.round(r.height)})`),
  );
  expect(small).toEqual([]);
});

// Phase 6: Dein Stand (vier Reiter) und Wortschatztest je Modus und Breite.
for (const theme of THEMES) {
  for (const width of [390, 1440]) {
    test(`axe · Dein Stand und Wortschatztest · ${theme} · ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await boot(page, { theme, migrated: true });
      const found: string[] = [];
      await progressTour(page, async (name) => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        found.push(...res.violations.map((v) => `${name} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
      });
      expect(found).toEqual([]);
    });
  }
}

// Lücken aus dem Abgleich: Heute mit „Was ist neu", Nachtragen-Hinweis und Check-Angebot, der
// Wochen-Check (Aufgabe, Ergebnis) und die Einstellungen (Farbthema, beruflicher Kontext) – je Modus
// und Farbthema der Testdaten (Ozean) sowie einmal je Modus mit Pflaume und Graphit.
for (const theme of THEMES) {
  for (const width of [390, 1440]) {
    test(`axe · Wochen-Check, Hinweise, Einstellungen · ${theme} · ${width}px`, async ({ page }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await boot(page, {
        theme,
        migrated: true,
        whatsNew: true,
        fake: { patch: { 'app/profile': { newPerDay: 0, plan: { d: '2026-09-20', v: 1, ids: [], why: [], duty: [], goal: { review: 0 }, lesson: null, at: 1 } } } },
        localStorage: {
          'sw2:__dirty': JSON.stringify({ 'vocab/vom-handy': 1_789_950_000_000 }),
          'sw2:vocab/vom-handy': JSON.stringify({ word: 'from the phone', de: 'vom Handy', state: 'new', S: 0 }),
        },
      });
      const found: string[] = [];
      const scan = async (name: string) => {
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        found.push(...res.violations.map((v) => `${name} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`));
      };
      await screen(page, 'today');
      await expect(page.getByTestId('late-rescue-hint')).toBeVisible();
      // Die Tageskarte blendet Zähler und Zeilen noch ein, wenn der Hinweis schon steht: erst ruhen lassen,
      // sonst misst axe den Kontrast mitten im Übergang (sporadisch rot, auch ohne Codeänderung).
      await page.waitForTimeout(400);
      await scan('heute');
      // Der Wochen-Check startet (Neubau) über Profil → „Wochen-Check“, nicht mehr auf Heute.
      await openChecks(page);
      await page.getByTestId('check-start').click();
      await checkSettled(page);
      await scan('wochencheck');
      await playCheck(page);
      await scan('wochencheck-ergebnis');
      // Zurück zur Herkunft (Seite Wochen-Check), dann in die Einstellungen.
      await page.getByTestId('session-end-secondary').or(page.getByTestId('session-end-next')).first().click();
      await screen(page, 'checks');
      await openSettings(page);
      await expect(page.getByTestId('work-ctx')).toBeVisible();
      for (const p of ['Pflaume', 'Graphit', 'Salbei'] as const) {
        await page.getByRole('radio', { name: p }).click();
        await page.waitForTimeout(150);
        await scan(`einstellungen-${p}`);
      }
      await page.keyboard.press('Escape');
      await scan('stand-salbei');
      expect(found).toEqual([]);
    });
  }
}
