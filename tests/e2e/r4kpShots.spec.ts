import { test, type Page } from '@playwright/test';
import { boot, openTab, screen, type Theme } from './fixtures';
import { answerItem, chapterOnePatch, openChapterOne, runGate, type Doc } from './gateHelpers';
import { MON, MON_9, VG_BLOCKS, profileWith, reviewedLog, vgPlan } from './heuteHelpers';

// Bildschirmfotos für den Design-Vergleich (R4 Spur Kapitelprüfung, P42/P43) nach `docs/umbau/design-vergleich/r4-kp-*.png`.
// Läuft nur auf Zuruf (`LX_SHOTS=1`), sonst übersprungen: Bilder sind Belege für Emrah und den ux-reviewer, keine Prüfung.

const OUT = 'docs/umbau/design-vergleich';
const on = !!process.env.LX_SHOTS;
const sizes = [
  { name: '390-dunkel', viewport: { width: 390, height: 844 }, theme: 'dark' as Theme, touch: true },
  { name: '390-hell', viewport: { width: 390, height: 844 }, theme: 'light' as Theme, touch: true },
];

async function start(page: Page, theme: Theme, patch: Record<string, Doc>, now?: string) {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await boot(page, { migrated: true, theme, ...(now ? { now } : {}), localStorage: { 'lx:fx': 'full', 'lx:journey-seen': '2026-09-20' }, fake: { patch } });
  await screen(page, 'today');
}

const donePatch = (extra: Record<string, Doc> = {}): Record<string, Doc> => {
  const plan = { ...vgPlan(MON), u: { ...(vgPlan(MON).u as Doc), b: VG_BLOCKS } };
  return { ...chapterOnePatch(), ...profileWith(MON, plan, ['u-focus', 'u-task', 'u-again'], {}), ...reviewedLog(MON), ...extra };
};

for (const s of sizes) {
  test.describe(`Fotos ${s.name}`, () => {
    test.skip(!on, 'nur mit LX_SHOTS=1');
    test.setTimeout(150_000);
    test.use({ viewport: s.viewport, hasTouch: s.touch });

    test('Grammatik-Reiter mit der Reise', async ({ page }) => {
      await start(page, s.theme, chapterOnePatch());
      await openTab(page, 'learn');
      await page.getByTestId('program-map').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/r4-kp-01-grammatik-reiter-${s.name}.png` });
    });

    test('Kapitelblatt mit Abschnitt Abschlussprüfung', async ({ page }) => {
      await start(page, s.theme, chapterOnePatch());
      await openTab(page, 'learn');
      await openChapterOne(page);
      await page.getByTestId('gate-section').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/r4-kp-02-kapitelblatt-pruefung-${s.name}.png` });
    });

    test('Heute: Extra-Karte Kapitelprüfung', async ({ page }) => {
      await start(page, s.theme, donePatch(), MON_9);
      await page.getByTestId('gate-card').scrollIntoViewIfNeeded();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/r4-kp-03-heute-extra-${s.name}.png` });
    });

    test('Prüfung: Start und erste Aufgabe', async ({ page }) => {
      await start(page, s.theme, chapterOnePatch());
      await openTab(page, 'learn');
      await openChapterOne(page);
      await page.getByTestId('gate-start-sheet').click();
      await page.getByTestId('gate-intro').waitFor();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/r4-kp-04-pruefung-start-${s.name}.png` });
      await page.getByTestId('gate-go').click();
      await page.getByTestId('place-item').waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/r4-kp-05-pruefung-aufgabe-${s.name}.png` });
    });

    test('Ergebnis bestanden mit Aufstieg', async ({ page }) => {
      await start(page, s.theme, chapterOnePatch());
      await openTab(page, 'learn');
      await openChapterOne(page);
      await page.getByTestId('gate-start-sheet').click();
      await runGate(page, { grammarRight: true, wordsRight: true });
      await page.getByTestId('levelup').waitFor();
      await page.waitForTimeout(2200);
      await page.screenshot({ path: `${OUT}/r4-kp-07-meilenstein-karte-${s.name}.png` });
      await page.keyboard.press('Escape');
      await page.getByTestId('levelup').waitFor({ state: 'detached' });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/r4-kp-06-ergebnis-bestanden-${s.name}.png` });
    });

    test('Ergebnis nicht bestanden', async ({ page }) => {
      await start(page, s.theme, chapterOnePatch());
      await openTab(page, 'learn');
      await openChapterOne(page);
      await page.getByTestId('gate-start-sheet').click();
      await page.getByTestId('gate-go').click();
      // Ein paar richtig, der Rest „Weiß ich nicht“: das Ergebnis zeigt Themen und den neuen Termin.
      for (let k = 0; k < 4; k++) await answerItem(page, false);
      await runGate(page, { grammarRight: false, wordsRight: false }).catch(() => undefined);
      await page.getByTestId('gate-result').waitFor();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/r4-kp-08-ergebnis-nicht-bestanden-${s.name}.png` });
    });

    test('Heute: Meilenstein-Zeile auf der Abschlusskarte', async ({ page }) => {
      const c1 = { v: 1, checks: [], gates: [{ d: '2026-09-18', ch: 1, g: [13, 14], w: [8, 8], ok: true }], prod: [], bad: [] };
      await start(page, s.theme, donePatch({ 'app/c1': c1 }), MON_9);
      await page.getByTestId('levelup').waitFor();
      await page.waitForTimeout(2200);
      await page.keyboard.press('Escape');
      await page.getByTestId('levelup').waitFor({ state: 'detached' });
      await page.getByTestId('today-milestone').scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
      await page.screenshot({ path: `${OUT}/r4-kp-09-heute-meilenstein-${s.name}.png` });
    });
  });
}
