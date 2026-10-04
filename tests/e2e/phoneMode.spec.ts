import { expect, test, type Browser, type Page } from '@playwright/test';
import { boot, openSettings, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { TUE_9, VG_DUTY, mondayPlan, profileWith, reviewedLog, unitStatus, vgPlan } from './heuteHelpers';

// Handy-Modus (Emrahs Wunsch 01.10.2026): Am Handy wird eine Sprech-/Schreibaufgabe (Block 3 alter Pläne) durch
// eine kurze Übung ersetzt. Nur eine Ansicht: der gespeicherte Plan bleibt, am Laptop gilt die volle Liste,
// und die Serie reißt nie (die übrige Pflicht setzt `pflicht[tag]`).
// Seit 04.10.2026 (Fokus Vokabeln und Grammatik) ist Block 3 Satzbau – der geht am Handy gut und bleibt.
// Ältere gespeicherte Pläne (mit „Sag es“ usw.) gelten unverändert weiter; für sie gilt die Ersetzung noch.

type Doc = Record<string, unknown>;
const TUE = '2026-09-22';
const OTHER = ['u-in', 'u-focus', 'u-again'];

/** Handy: Touch als Hauptzeiger und Bildschirm 390 × 844. */
async function phone(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  return context.newPage();
}

/** Alter gespeicherter Plan (Block 3 „Sag es“). */
const planOnly = () => ({ ...profileWith(TUE, mondayPlan(TUE), [], {}, 0) });
/** Neuer gespeicherter Plan (Block 3 Satzbau). */
const vgOnly = () => ({ ...profileWith(TUE, vgPlan(TUE), [], {}, 0) });
const dutyIds = (page: Page) => page.getByTestId('duty').evaluateAll((els) => els.map((e) => e.getAttribute('data-duty')));

test('Handy: Satzbau (Block 3) bleibt Pflicht, kein Ersatz und kein Hinweis', async ({ browser }) => {
  const page = await phone(browser);
  const { errors, external } = await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: vgOnly() } });
  await screen(page, 'today');
  const { done, total } = await unitStatus(page);
  expect(done).toBe(0);
  expect(total).toBe(4);
  expect(await dutyIds(page)).toEqual(VG_DUTY);
  const task = page.locator('[data-testid="duty"][data-duty="ch:u-task"]');
  await expect(task).toContainText('Satzbau');
  await expect(task).not.toContainText('Kollokationen');
  await expect(page.getByTestId('today-phone-hint')).toHaveCount(0);
  const plan = (await dump(page))['app/profile']?.plan as { u: { b: Array<[number, string, number]> } };
  expect(plan.u.b[2]).toEqual([3, 'task.order', 5]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.context().close();
});

test('Handy, alter gespeicherter Plan: Aufgabe des Tages wird durch eine kurze Übung ersetzt, ruhiger Hinweis, gespeicherter Plan unberührt', async ({ browser }) => {
  const page = await phone(browser);
  const { errors, external } = await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: planOnly() } });
  await screen(page, 'today');
  const { done, total } = await unitStatus(page);
  expect(done).toBe(0);
  expect(total).toBe(5);
  expect(await dutyIds(page)).toEqual(['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
  // Dienstag: statt „Sag es“ Kollokationen zum Thema; Fokus und Nochmal sagen nichts von „der Aufgabe“.
  const task = page.locator('[data-testid="duty"][data-duty="ch:u-task"]');
  await expect(task).toContainText('Kollokationen');
  await expect(task).toContainText('6 Min.');
  expect((await page.getByTestId('duty').allTextContents()).join(' ')).not.toContain('aus der Aufgabe');
  await expect(page.getByTestId('today-phone-hint')).toContainText('Am Handy ist die Aufgabe des Tages kurz und ohne Sprechen');
  // Der gespeicherte Plan bleibt auf allen Geräten gleich (Kap. 15: nie neu gewürfelt).
  const plan = (await dump(page))['app/profile']?.plan as { duty: string[]; u: { b: Array<[number, string, number]> } };
  expect(plan.duty).toEqual(['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
  expect(plan.u.b[2]).toEqual([3, 'task.say', 9]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.context().close();
});

test('Handy, alter gespeicherter Plan: Schalter in den Einstellungen bringt die volle Aufgabe zurück und wieder weg', async ({ browser }) => {
  const page = await phone(browser);
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: planOnly() } });
  await screen(page, 'today');
  const task = page.locator('[data-testid="duty"][data-duty="ch:u-task"]');
  await expect(task).toContainText('Kollokationen');
  await openSettings(page);
  const sw = page.getByTestId('set-phone-mode');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(task).toContainText('Sag es');
  await expect(task).toContainText('9 Min.');
  await expect(page.getByTestId('today-phone-hint')).toHaveCount(0);
  await sw.click();
  await expect(task).toContainText('Kollokationen');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-total', '5');
  await page.context().close();
});

test('Handy, alter gespeicherter Plan: Pflicht bleibt offen, bis die kurze Übung erledigt ist; danach zählt der Tag für die Serie', async ({ browser }) => {
  const page = await phone(browser);
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: { ...profileWith(TUE, mondayPlan(TUE), OTHER, {}, 2), ...reviewedLog(TUE) } } });
  await screen(page, 'today');
  const status = page.getByTestId('today-status');
  await expect(status).toHaveAttribute('data-status', 'open');
  await expect(status).toHaveAttribute('data-done', '4');
  await expect(status).toHaveAttribute('data-total', '5');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
  expect(((await dump(page))['app/profile']?.pflicht as Doc | undefined)?.[TUE]).toBeUndefined();
  await page.context().close();

  const page2 = await phone(browser);
  await boot(page2, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: { ...profileWith(TUE, mondayPlan(TUE), [...OTHER, 'u-task'], {}, 2), ...reviewedLog(TUE) } } });
  await screen(page2, 'today');
  await expect(page2.getByTestId('today-status')).toHaveAttribute('data-status', 'allDone');
  await expect.poll(async () => ((await dump(page2))['app/profile']?.pflicht as Doc | undefined)?.[TUE]).toBe(1);
  await page2.context().close();
});

test('Keine Wochenbilanz „Aufgabe des Tages am Laptop“ mehr; Sprechen ist auf Heute ein freiwilliges Extra (Laptop und Handy)', async ({ browser }) => {
  // Seit 04.10.2026 gibt es keine Aufgabe des Tages mit Sprechen mehr; die Zeile `today-lap` entfällt.
  const base = profileWith(TUE, vgPlan(TUE), ['u-task'], {}, 2);
  const patch = { 'app/profile': { ...base['app/profile'], lap: { '2026-09-14': 1, '2026-09-22': 1 } }, ...reviewedLog(TUE) };
  const lap = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const a = await lap.newPage();
  await boot(a, { migrated: true, now: TUE_9, fake: { patch } });
  await screen(a, 'today');
  await expect(a.getByTestId('today-status')).toBeVisible();
  await expect(a.getByTestId('today-lap')).toHaveCount(0);
  await expect(a.getByTestId('today-lap-more')).toHaveCount(0);
  await expect(a.getByTestId('today-speak')).toBeVisible();
  // Das Extra zählt nie zur Pflicht.
  await expect(a.getByTestId('today-status')).toHaveAttribute('data-total', '4');
  await a.getByTestId('today-speak').click();
  await screen(a, 'speak');
  await lap.close();
  const p = await phone(browser);
  await boot(p, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch } });
  await screen(p, 'today');
  await expect(p.getByTestId('today-status')).toBeVisible();
  await expect(p.getByTestId('today-lap')).toHaveCount(0);
  await expect(p.getByTestId('today-speak')).toBeVisible();
  await p.context().close();
});

test('Laptop: volle Pflichtliste, kein Hinweis, kein Schalter (auch bei eingeschaltetem Handy-Modus)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: vgOnly() } });
  await screen(page, 'today');
  const { total } = await unitStatus(page);
  expect(total).toBe(4);
  expect(await dutyIds(page)).toEqual(VG_DUTY);
  await expect(page.getByTestId('today-phone-hint')).toHaveCount(0);
  await openSettings(page);
  await expect(page.getByTestId('phone-mode-section')).toHaveCount(0);
});

test('Schmales Fenster ohne Touch (Laptop mit kleinem Fenster) ist kein Handy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Alter Plan: am echten Handy würde Block 3 ersetzt – hier nicht (kein Touch).
  await boot(page, { migrated: true, now: TUE_9, phoneMode: true, fake: { patch: planOnly() } });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-total', '5');
  await expect(page.locator('[data-testid="duty"][data-duty="ch:u-task"]')).not.toContainText('Kollokationen');
  await expect(page.getByTestId('today-phone-hint')).toHaveCount(0);
});
