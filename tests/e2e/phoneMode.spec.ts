import { expect, test, type Browser, type Page } from '@playwright/test';
import { boot, openSettings, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { TUE_9, mondayPlan, profileWith, reviewedLog, unitStatus } from './heuteHelpers';

// Handy-Modus (Emrahs Wunsch 01.10.2026): Am Handy gehört die Aufgabe des Tages (Block 3) nicht zur
// Pflicht für heute. Nur eine Ansicht: der gespeicherte Plan bleibt, am Laptop gilt die volle Liste,
// und die Serie reißt nie (die übrige Pflicht setzt `pflicht[tag]`).

type Doc = Record<string, unknown>;
const TUE = '2026-09-22';
const OTHER = ['u-in', 'u-focus', 'u-again'];

/** Handy: Touch als Hauptzeiger und Bildschirm 390 × 844. */
async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  return context.newPage();
}

const planOnly = () => ({ ...profileWith(TUE, mondayPlan(TUE), [], {}, 0) });
const dutyIds = (page: Page) => page.getByTestId('duty').evaluateAll((els) => els.map((e) => e.getAttribute('data-duty')));

test('Handy: Pflichtliste ohne die Aufgabe des Tages, ruhiger Hinweis, gespeicherter Plan unberührt', async ({ browser }) => {
  const page = await phone(browser);
  const { errors, external } = await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: planOnly() } });
  await screen(page, 'today');
  const { done, total } = await unitStatus(page);
  expect(done).toBe(0);
  expect(total).toBe(4);
  expect(await dutyIds(page)).toEqual(['review', 'ch:u-in', 'ch:u-focus', 'ch:u-again']);
  await expect(page.getByTestId('today-phone-hint')).toContainText('Am Handy nicht Pflicht');
  await expect(page.getByTestId('today-phone-hint')).toContainText('Sag es');
  // Der gespeicherte Plan bleibt auf allen Geräten gleich (Kap. 15: nie neu gewürfelt).
  const plan = (await dump(page))['app/profile']?.plan as { duty: string[]; u: { b: unknown[] } };
  expect(plan.duty).toEqual(['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
  expect(plan.u.b).toHaveLength(5);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.context().close();
});

test('Handy: Schalter in den Einstellungen bringt die volle Liste zurück und wieder weg', async ({ browser }) => {
  const page = await phone(browser);
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: planOnly() } });
  await screen(page, 'today');
  await expect(page.getByTestId('duty')).toHaveCount(4);
  await openSettings(page);
  const sw = page.getByTestId('set-phone-mode');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('duty')).toHaveCount(5);
  await expect(page.getByTestId('today-phone-hint')).toHaveCount(0);
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-total', '5');
  await sw.click();
  await expect(page.getByTestId('duty')).toHaveCount(4);
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-total', '4');
  await page.context().close();
});

test('Handy: ist die übrige Pflicht erledigt, ist der Tag fertig und zählt für die Serie', async ({ browser }) => {
  const page = await phone(browser);
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: { ...profileWith(TUE, mondayPlan(TUE), OTHER, {}, 2), ...reviewedLog(TUE) } } });
  await screen(page, 'today');
  const status = page.getByTestId('today-status');
  await expect(status).toHaveAttribute('data-status', 'allDone');
  await expect(status).toHaveAttribute('data-done', '4');
  await expect(status).toHaveAttribute('data-total', '4');
  // Fertig ist Zustand (Kap. 2.2): keine Blockliste, kein Hinweis „nicht Pflicht“ mehr nötig.
  await expect(page.getByTestId('duty')).toHaveCount(0);
  await expect.poll(async () => ((await dump(page))['app/profile']?.pflicht as Doc | undefined)?.[TUE]).toBe(1);
  await page.context().close();
});

test('Laptop: volle Pflichtliste, kein Hinweis, kein Schalter (auch bei eingeschaltetem Handy-Modus)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: planOnly() } });
  await screen(page, 'today');
  const { total } = await unitStatus(page);
  expect(total).toBe(5);
  expect(await dutyIds(page)).toEqual(['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
  await expect(page.getByTestId('today-phone-hint')).toHaveCount(0);
  await openSettings(page);
  await expect(page.getByTestId('phone-mode-section')).toHaveCount(0);
});

test('Schmales Fenster ohne Touch (Laptop mit kleinem Fenster) ist kein Handy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: planOnly() } });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-total', '5');
  await expect(page.getByTestId('today-phone-hint')).toHaveCount(0);
});
