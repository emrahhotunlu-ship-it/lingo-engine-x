import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { answerCurrent, answerOnly, forcedPatch, planPatch, writes } from './trainerHelpers';

// Übungsleiste neben der Seitenleiste und Reiterwechsel mitten in der Übung (Relaunch Stufe 1 P3 nach dem Merge mit P2).
// - ux N1 (Nora): ab 1024 px steht die Seitenleiste auch in Übungen; die Übungsleiste zeigt nur, was die Navigation nicht hat
//   (kein Übersetzer, kein Zahnrad bzw. Einstellungs-Punkt; Claude bleibt, weil es die Aufgabe sieht).
// - Reiterwechsel: die Übung (Überlagerung) endet sauber. Mit „Weiter“ Bestätigtes bleibt gezählt, eine nur geprüfte Antwort
//   zählt nicht und schreibt nichts; „Starten“ macht an derselben Stelle weiter, die Runde endet genau einmal.

test.use({ viewport: { width: 1440, height: 900 } });

async function start(page: Page) {
  const booted = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(6), ...forcedPatch() } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

test('ab 1024 px: Übungsleiste ohne Übersetzer und Zahnrad, die Seitenleiste hat sie', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const { errors } = await start(page);
  const bar = page.getByTestId('exercise-bar');
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByTestId('tabbar')).toBeVisible();
    await expect(page.getByTestId('side-translate')).toBeVisible();
    await expect(page.getByTestId('side-settings')).toBeVisible();
    await expect(bar.getByTestId('open-translate')).toHaveCount(0);
    await expect(bar.getByTestId('open-settings')).toHaveCount(0);
    await expect(bar.getByTestId('open-companion')).toBeVisible();
    await bar.getByTestId('exercise-menu').click();
    await expect(page.getByRole('menu')).toBeVisible();
    await expect(page.getByTestId('open-settings')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.getByTestId('exercise')).toBeVisible();
  }
  // Unter 1024 px (keine Seitenleiste in Übungen): Übersetzer in der Leiste, Einstellungen im Menü „…“.
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByTestId('tabbar')).toHaveCount(0);
  await expect(bar.getByTestId('open-translate')).toBeVisible();
  await bar.getByTestId('exercise-menu').click();
  await expect(page.getByTestId('open-settings')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('Reiterwechsel mitten in der Übung: die Übung endet sauber, Erledigtes zählt genau einmal, „Starten“ macht weiter', async ({ page }) => {
  test.slow();
  const { errors } = await start(page);
  const card = page.getByTestId('today-card');
  await answerCurrent(page);
  // 1) Wechsel mit offener Aufgabe: die Übung endet ganz (kein halber Zustand), die erledigte Aufgabe bleibt gezählt.
  await page.getByTestId('tab-vocab').click();
  await expect(page.getByTestId('exercise')).toHaveCount(0);
  await expect(page.getByTestId('result')).toHaveCount(0);
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('exercise')).toHaveCount(0);
  await expect(card).toContainText('1 von 6 erledigt');
  // 2) Weiter über „Starten“; Wechsel mit offenem Ergebnis: gespeichert wird erst mit „Weiter“. Die nicht bestätigte Antwort
  //    zählt nicht und schreibt nichts; dieselbe Karte kommt beim nächsten „Starten“ wieder (nichts doppelt, nichts halb).
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  const id = await page.getByTestId('exercise').getAttribute('data-card');
  const w0 = (await writes(page)).length;
  await answerOnly(page);
  await page.getByTestId('tab-learn').click();
  await expect(page.getByTestId('result')).toHaveCount(0);
  await page.getByTestId('tab-today').click();
  await expect(page.getByTestId('exercise')).toHaveCount(0);
  await expect(card).toContainText('1 von 6 erledigt');
  expect((await writes(page)).slice(w0).filter((x) => x.path === `vocab/${id}`)).toEqual([]);
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-card', id ?? '');
  // 3) Runde zu Ende: eine Abschlusskarte, auch nach einem weiteren Wechsel; danach Heute mit erledigter Karte ohne Knopf.
  for (let i = 0; i < 30; i++) {
    await expect(page.getByTestId('summary').or(page.locator('[data-step]')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    await answerCurrent(page);
  }
  await expect(page.getByTestId('summary')).toHaveCount(1);
  await page.getByTestId('tab-vocab').click();
  await page.getByTestId('tab-today').click();
  // Die Abschlusskarte kommt höchstens einmal: nach dem Wechsel steht sie noch (dann „Weiter“) oder Heute ist schon erledigt.
  await expect(page.getByTestId('summary').or(page.locator('[data-testid="today-card"][data-done="true"]')).first()).toBeVisible();
  expect(await page.getByTestId('summary').count()).toBeLessThanOrEqual(1);
  if (await page.getByTestId('summary').isVisible()) await page.getByTestId('session-end-next').click();
  const doneCard = page.locator('[data-testid="today-card"][data-done="true"]');
  await expect(doneCard).toBeVisible();
  await expect(doneCard.locator('button')).toHaveCount(0);
  await expect(page.getByTestId('summary')).toHaveCount(0);
  expect(errors).toEqual([]);
});
