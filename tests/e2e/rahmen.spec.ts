import { expect, test, type Browser, type Page } from '@playwright/test';
import { boot, crashOnce, layoutProblems, openProfile, openTab, screen, type Lang, type Theme } from './fixtures';
import { barAction } from './learnHelpers';
import { openProfileRow } from './profilHelpers';
import { forcedPatch, planPatch } from './trainerHelpers';
import type { InstallOptions } from '../../src/platform/dev/install';

// Neubau WP0b – Rahmen (docs/neubau/plan.md §4.1, architektur.md §5.5): Einstieg, Rückweg zur
// Herkunft, Neuladen/Fortsetzen, Fehlergrenzen per `lx:crash-once`, 390 px, beide Sprachen, drei
// Modi. Das Fortsetzen je Übung prüfen die Pakete mit ihrem `Resumable` (G3).
// Relaunch Stufe 1, P2 S1-SHELL (docs/relaunch/stufe1-plan.md §6.2/§6.3): fünf Reiter, Schiene 600–1279 px, Seitenleiste ab 1280 px
// mit aufklappbarer „Praxis“, „Fragen“ im Kopf, Zahnrad nur auf Fortschritt, Claude verdeckt nie die Bühne (Kontextspalte bzw. Blatt),
// der Chat springt beim Lesen nicht nach unten.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Vokabeltest: Einstieg über die Profil-Zeile (Neubau, früher „Dein Stand“ → Verlauf). */
async function openVtest(page: Page): Promise<void> {
  await openProfileRow(page, 'profile-vtest');
  await screen(page, 'vtest');
}

test('Einstieg: Kopf mit EINEM „Fragen“, fünf Reiter einzeilig, Zahnrad und Profil nur auf Fortschritt, Profil-Blatt', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  const top = page.getByTestId('topbar');
  await expect(top.getByTestId('open-companion')).toBeVisible();
  await expect(top.getByTestId('open-companion')).toHaveAttribute('aria-label', 'Fragen');
  // Kein Profil, kein Übersetzer, kein Zahnrad im Kopf von Heute (Plan §6.3); die Serie steht nicht im Kopf (Gesamtkonzept 3.1).
  await expect(top.getByTestId('open-profile')).toHaveCount(0);
  await expect(top.getByTestId('open-translate')).toHaveCount(0);
  await expect(top.getByTestId('open-settings')).toHaveCount(0);
  await expect(top.getByTestId('profile-streak')).toHaveCount(0);
  // Genau ein Claude-Knopf auf der Wurzel (die Seite zeichnet keinen zweiten).
  await expect(page.getByTestId('open-companion')).toHaveCount(1);
  const tabs = page.getByTestId('tabbar').locator('button[data-tab]');
  // Heute · Wörter · Grammatik · Praxis · Fortschritt (Lesen und Sprechen hängen unter Praxis).
  await expect(tabs).toHaveCount(5);
  await expect(page.getByTestId('tab-apply')).toHaveText('Praxis');
  await expect(page.getByTestId('tab-read')).toHaveCount(0);
  await expect(page.getByTestId('tab-speak')).toHaveCount(0);
  await expect(page.getByTestId('tab-learn')).toHaveText('Grammatik');
  for (const b of await tabs.all()) expect((await b.boundingBox())?.height ?? 99).toBeLessThan(64);
  // Am Handy keine Werkzeuge in der Leiste (die stehen ab 600 px in Schiene/Seitenleiste).
  await expect(page.getByTestId('side-settings')).toBeHidden();
  for (const id of ['vocab', 'learn', 'apply', 'progress', 'today'] as const) {
    await openTab(page, id);
    await expect(page.getByTestId('topbar')).toBeVisible();
    await expect(page.getByTestId('topbar').getByTestId('open-settings')).toHaveCount(id === 'progress' ? 1 : 0);
    await expect(page.getByTestId('topbar').getByTestId('open-profile')).toHaveCount(id === 'progress' ? 1 : 0);
    expect(await layoutProblems(page), id).toEqual([]);
  }
  await openProfile(page);
  await expect(page.getByTestId('profile-sheet-streak')).toHaveText('Serie: 12 Tage');
  await expect(page.getByTestId('profile-overview')).toBeVisible();
  await expect(page.getByTestId('profile-settings')).toBeVisible();
  await page.getByTestId('profile-settings').click();
  await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Rückweg zur Herkunft: Seite „‹ Wortschatz“, Übung ✕ zurück zur Herkunft, Bildlauf bleibt; aktiver Reiter → Wurzel', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  // Seite aus dem Reiter „Wortschatz“ (Wortliste): „‹ Wortschatz“ führt zur Wurzel des Reiters zurück.
  await openTab(page, 'vocab');
  await page.getByTestId('ws-all').click();
  await screen(page, 'vocabList');
  await expect(page.getByTestId('back').first()).toContainText('Wörter');
  await expect(page.getByTestId('tabbar')).toBeVisible();
  await page.getByTestId('back').first().click();
  await screen(page, 'vocab');
  await openTab(page, 'today');
  // Übung (aus dem Profil-Blatt auf „Fortschritt“): keine Reiterleiste, ✕ führt zurück zur Herkunft.
  await openVtest(page);
  await expect(page.getByTestId('tabbar')).toHaveCount(0);
  // Einstellungen auch in der Übung (A7 Paket 2): am Handy im Menü „…“ der Übungsleiste (Relaunch P3, Band).
  await page.getByTestId('exercise-bar').getByTestId('exercise-menu').click();
  await expect(page.getByTestId('exercise-menu-list').getByTestId('open-settings')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('exercise-menu-list')).toHaveCount(0);
  await page.getByTestId('vt-close').click();
  await screen(page, 'overview');
  await openTab(page, 'today');
  // Bildlauf der Reiter-Wurzel bleibt über eine Seite hinweg erhalten.
  await openTab(page, 'vocab');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const y = await page.evaluate(() => window.scrollY);
  expect(y).toBeGreaterThan(0);
  await page.getByTestId('ws-all').click();
  await screen(page, 'vocabList');
  // Ein Schritt tiefer beginnt oben (UX-Audit U1: neue Seite öffnete mitten im Inhalt).
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByTestId('back').first().click();
  await screen(page, 'vocab');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
  // Tipp auf den aktiven Reiter: Wurzel und oben.
  await page.getByTestId('ws-all').click();
  await screen(page, 'vocabList');
  await page.getByTestId('tab-vocab').click();
  await screen(page, 'vocab');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  expect(errors).toEqual([]);
});

test('Übungskopf bleibt stehen (UX-Audit U1): beim Bildlauf nach unten bleibt die Übungsleiste oben sichtbar', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openVtest(page);
  const bar = page.getByTestId('exercise-bar');
  await expect(bar).toBeVisible();
  // Die Übung künstlich verlängern (im selben Behälter wie die Leiste), damit sich die Seite sicher scrollen lässt.
  await bar.evaluate((el) => {
    const pad = document.createElement('div');
    pad.style.height = '3000px';
    el.parentElement?.appendChild(pad);
  });
  await page.evaluate(() => window.scrollTo(0, 2000));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500);
  const box = await bar.boundingBox();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(-1);
  expect(box?.y ?? 99).toBeLessThan(8);
  expect(errors).toEqual([]);
});

test('Fehlergrenze Seite (lx:crash-once): „Seite neu aufbauen“, Reiter bleiben, Diagnose überlebt das Neuladen', async ({ page }) => {
  await boot(page, { migrated: true, localStorage: crashOnce('learn') });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await expect(page.getByTestId('boundary-page')).toBeVisible();
  await expect(page.getByTestId('tabbar')).toBeVisible();
  await page.getByTestId('boundary-rebuild').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  const diag = await page.evaluate(() => window.localStorage.getItem('lx:diag') ?? '');
  expect(diag).toContain('crash-once: learn');
  expect(diag).toContain('ui:learn');
  // Der Schalter wirkt nur einmal (Reiter wechseln und zurück: kein zweiter Fehler).
  await openTab(page, 'today');
  await openTab(page, 'learn');
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  await expect(page.getByTestId('boundary-page')).toHaveCount(0);
  // Das Protokoll überlebt das Neuladen (boot spielt den Schalter beim Neuladen erneut ein).
  await page.reload();
  await screen(page, 'today');
  expect(await page.evaluate(() => window.localStorage.getItem('lx:diag') ?? '')).toContain('crash-once: learn');
});

test('Fehlergrenze Übung (lx:crash-once): Hinweis statt weißer Seite, „Übung beenden“ führt zur Herkunft, App läuft weiter', async ({ page }) => {
  await boot(page, { migrated: true, localStorage: crashOnce('vtest') });
  await screen(page, 'today');
  await openProfileRow(page, 'profile-vtest');
  await expect(page.getByTestId('boundary-exercise')).toBeVisible();
  await page.getByTestId('boundary-end').click();
  // Herkunft ist „Fortschritt“ (dort steht das Profil seit P2 S1-SHELL).
  await screen(page, 'overview');
  await openVtestAgain(page);
});

async function openVtestAgain(page: Page): Promise<void> {
  await openVtest(page);
  await expect(page.getByTestId('boundary-exercise')).toHaveCount(0);
}

test('Neuladen: veraltete oder fremde Fortsetz-Stände werden verworfen, Heute startet normal', async ({ page }) => {
  const stale = JSON.stringify({ v: 1, id: 'gibtsnicht', day: '2026-09-20', at: Date.parse('2026-09-20T20:59:00+02:00') });
  const { errors } = await boot(page, { migrated: true, localStorage: { 'lx:resume': stale, 'lx:resume:alt': JSON.stringify({ v: 1, id: 'alt', day: '2026-09-01', savedAt: 1, tabId: 'x', route: { name: 'today' }, data: {} }) } });
  await screen(page, 'today');
  await expect(page.getByTestId('resume-row')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => [window.localStorage.getItem('lx:resume'), window.localStorage.getItem('lx:resume:alt')])).toEqual([null, null]);
  // Neuladen mitten in einer Seite: die App kommt wieder hoch (Heute), nichts hängt.
  await openVtest(page);
  await page.reload();
  await screen(page, 'today');
  expect(errors).toEqual([]);
});

for (const [theme, lang] of [
  ['dark', 'de'],
  ['dim', 'en'],
  ['light', 'de'],
  ['dark', 'en'],
] as Array<[Theme, Lang]>) {
  test(`390 px · ${theme} · ${lang}: Kopf, Reiter, Profil-Blatt ohne Überlauf und ohne gemischte Sprache`, async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, theme, lang });
    await screen(page, 'today');
    await expect(page.getByTestId('profile-streak')).toHaveCount(0);
    // UX-Prüfung KLEIN: Heute-Fußzeile in einem Format „n von 6 Lerntagen“ (Text geändert, Zahlen unverändert).
    await expect(page.getByTestId('today-streak')).toHaveText(lang === 'de' ? 'Serie 12 · 6 von 6 Lerntagen ✓ · 7 Tage' : 'Streak 12 · 6 of 6 study days ✓ · 7 days');
    await expect(page.getByTestId('tab-vocab')).toHaveText(lang === 'de' ? 'Wörter' : 'Words');
    expect(await layoutProblems(page)).toEqual([]);
    await openProfile(page);
    await expect(page.getByTestId('profile-overview')).toContainText(lang === 'de' ? 'Fortschritt' : 'Progress');
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('Praxis am Handy: Lesen und Sprechen hängen unter „Praxis“ (Hub-Zeilen), Rückweg „‹ Praxis“', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await expect(page.getByTestId('practice-more')).toBeVisible();
  // „Sprechen“ nur einmal auf Praxis (keine zweite Rollenspiel-Kachel), Lesen und Sprechen oben.
  await expect(page.getByTestId('hub-speak')).toHaveCount(0);
  expect((await boxOf(page, 'practice-more')).y).toBeLessThan(400);
  await page.getByTestId('hub-read').click();
  await screen(page, 'read');
  await expect(page.getByTestId('page-back')).toContainText('Praxis');
  await expect(page.getByTestId('tab-apply')).toHaveAttribute('aria-current', 'page');
  await page.getByTestId('page-back').click();
  await screen(page, 'apply');
  await page.getByTestId('hub-speak-page').click();
  await screen(page, 'speak');
  await expect(page.getByTestId('tab-apply')).toHaveAttribute('aria-current', 'page');
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

// ------------------------------------------------------------------ Breiten-Stufen (Plan §6.2)

type Box = { x: number; y: number; width: number; height: number };

async function at(browser: Browser, width: number, height: number, fake: InstallOptions = {}): Promise<{ page: Page; errors: string[]; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const { errors } = await boot(page, { migrated: true, fake });
  await screen(page, 'today');
  return { page, errors, close: () => ctx.close() };
}

const meets = (a: Box, b: Box): boolean => a.x < b.x + b.width - 1 && b.x < a.x + a.width - 1 && a.y < b.y + b.height - 1 && b.y < a.y + a.height - 1;

async function boxOf(page: Page, testId: string): Promise<Box> {
  const b = await page.getByTestId(testId).first().boundingBox();
  if (!b) throw new Error(`kein Rechteck: ${testId}`);
  return b;
}

/** Das Begleiter-Fenster steht still (Einblend-Bewegung vorbei). */
async function companionSettled(page: Page): Promise<Box> {
  let last = '';
  await expect
    .poll(async () => {
      const b = await page.getByTestId('companion').boundingBox();
      const now = JSON.stringify(b);
      const same = now === last;
      last = now;
      return same && b !== null;
    })
    .toBe(true);
  return boxOf(page, 'companion');
}

const TRAINER: InstallOptions = { patch: { 'app/profile': planPatch(1), 'vocab/avoid': forcedPatch()['vocab/avoid'] ?? {} } };

async function startTrainer(page: Page): Promise<void> {
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('task')).toBeVisible();
}

for (const width of [600, 1024]) {
  test(`Schiene bei ${width} px: links, nur Symbole, fünf Reiter + Werkzeuge, keine Leiste unten`, async ({ browser }) => {
    const { page, errors, close } = await at(browser, width, 800);
    const nav = await boxOf(page, 'tabbar');
    expect(nav.x).toBe(0);
    expect(nav.width).toBeLessThan(100);
    expect(nav.height).toBeGreaterThan(700);
    await expect(page.getByTestId('tabbar').locator('button[data-tab]')).toHaveCount(5);
    await expect(page.locator('.lx-nav-mark')).toBeHidden();
    await expect(page.getByTestId('side-practice-toggle')).toBeHidden();
    await expect(page.getByTestId('side-settings')).toBeVisible();
    await expect(page.getByTestId('side-claude')).toBeVisible();
    // Bühne rechts der Schiene, nichts überlappt; Kontextspalte nur, wenn etwas offen ist.
    expect((await boxOf(page, 'stage')).x).toBeGreaterThanOrEqual(nav.width);
    await expect(page.getByTestId('context-column')).toBeHidden();
    await page.getByTestId('tab-vocab').click();
    await screen(page, 'vocab');
    await expect(page.getByTestId('tab-vocab')).toHaveAttribute('aria-current', 'page');
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('side-settings').click();
    await expect(page.getByRole('dialog', { name: 'Einstellungen' })).toBeVisible();
    expect(errors).toEqual([]);
    await close();
  });
}

test('Seitenleiste ab 1280 px: Wortmarke, Praxis aufklappbar (Sprechen, Hören, Lesen), Werkzeuge, Kontextspalte reserviert', async ({ browser }) => {
  const { page, errors, close } = await at(browser, 1280, 800);
  const nav = await boxOf(page, 'tabbar');
  expect(nav.width).toBeGreaterThan(200);
  await expect(page.locator('.lx-nav-mark')).toHaveText('Lingo');
  await expect(page.getByTestId('tab-apply')).toHaveText('Praxis');
  await expect(page.getByTestId('side-settings')).toBeVisible();
  await expect(page.getByTestId('side-translate')).toBeVisible();
  await expect(page.getByTestId('context-empty')).toBeVisible();
  // Bühne und Spalte nebeneinander, ohne Überlappung.
  expect(meets(await boxOf(page, 'stage'), await boxOf(page, 'context-column'))).toBe(false);
  // Praxis zu → aufklappen → Unterpunkte.
  const toggle = page.getByTestId('side-practice-toggle');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('side-read')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByTestId('side-speak')).toBeVisible();
  await expect(page.getByTestId('side-listen')).toBeVisible();
  await page.getByTestId('side-read').click();
  await screen(page, 'read');
  await expect(page.getByTestId('side-read')).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('tab-apply')).toHaveAttribute('aria-current', 'page');
  // Nie zwei aktive Zeilen: ist ein Unterpunkt aktiv, trägt „Praxis“ keine Pille (P2-Nachbesserung K2).
  await expect(page.getByTestId('tab-apply').locator('.lx-nav-pill-item')).toBeHidden();
  await expect(page.getByTestId('side-speak')).not.toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('side-listen')).not.toHaveAttribute('aria-current', 'page');
  await page.getByTestId('side-speak').click();
  await screen(page, 'speak');
  await expect(page.getByTestId('side-speak')).toHaveAttribute('aria-current', 'page');
  await page.getByTestId('side-listen').click();
  await screen(page, 'apply');
  // Die Hub-Zeilen „Lesen und Sprechen“ führt hier die Seitenleiste – auf Praxis stehen sie nicht doppelt.
  await expect(page.getByTestId('practice-more')).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('side-read')).toBeHidden();
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
  await close();
});

test('Fragen am Handy (390 px) in der Übung: keine Leiste, Claude als Blatt unten, der Aufgabensatz bleibt darüber sichtbar', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: TRAINER });
  await screen(page, 'today');
  await startTrainer(page);
  await expect(page.getByTestId('tabbar')).toHaveCount(0);
  // Am Handy steht Claude in der Übung hinter „…“ (Relaunch P3: oben nur ✕ und Balken).
  await barAction(page, 'open-companion');
  const sheet = await companionSettled(page);
  const task = await boxOf(page, 'task');
  expect(task.y + task.height).toBeLessThanOrEqual(sheet.y + 1);
  expect(task.y).toBeGreaterThanOrEqual(0);
  // Der Satz selbst (nicht nur die Aufgabenzeile) steht über dem Blatt; das Blatt reicht bis unten und bleibt groß genug.
  const prompt = await page.locator('[data-testid="exercise"] [data-slot="prompt"]').first().boundingBox();
  expect(prompt).not.toBeNull();
  if (prompt) expect(prompt.y + prompt.height).toBeLessThanOrEqual(sheet.y + 1);
  // Unterkante: über der Aktionsleiste („Prüfen“), also im unteren Fünftel.
  expect(sheet.y + sheet.height).toBeGreaterThan(844 * 0.8);
  expect(sheet.y + sheet.height).toBeLessThanOrEqual(await page.getByTestId('actionbar').evaluate((el) => el.getBoundingClientRect().top + 1));
  expect(sheet.height).toBeGreaterThanOrEqual(279);
  expect(errors).toEqual([]);
});

for (const [width, height] of [
  [1024, 768],
  [1440, 900],
] as const) {
  test(`Claude bei ${width} px dockt in die Kontextspalte und verdeckt die Bühne nicht`, async ({ browser }) => {
    const { page, errors, close } = await at(browser, width, height, TRAINER);
    await startTrainer(page);
    // Ab 1024 px bleiben Schiene/Seitenleiste auch in Übungen stehen („keine Leiste“ gilt nur für die Handy-Leiste unten).
    await expect(page.getByTestId('tabbar')).toBeVisible();
    expect(meets(await boxOf(page, 'tabbar'), await boxOf(page, 'stage'))).toBe(false);
    await barAction(page, 'open-companion');
    await expect(page.getByTestId('frame')).toHaveAttribute('data-ctx', '');
    await expect(page.getByTestId('context-column')).toHaveAttribute('data-kind', 'claude');
    const win = await companionSettled(page);
    const col = await boxOf(page, 'context-column');
    expect(Math.abs(win.x - col.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(win.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(win.height - height)).toBeLessThanOrEqual(1);
    expect(meets(win, await boxOf(page, 'task'))).toBe(false);
    expect(meets(win, await boxOf(page, 'stage'))).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByTestId('companion-close').click();
    await expect(page.getByTestId('companion')).toHaveCount(0);
    // In Übungen nimmt die Spalte nur Platz, solange etwas offen ist (auch ab 1280 px); die Bühne bekommt die Breite zurück.
    await expect(page.getByTestId('context-column')).toBeHidden();
    expect(errors).toEqual([]);
    await close();
  });
}

test('Ohne KI (1440 px): der Platzhalter der Kontextspalte nennt Claude nicht, die Bühne ist bei 1280 px mindestens 640 px breit', async ({ browser }) => {
  const { page, errors, close } = await at(browser, 1440, 900, { capabilities: { sample: false } });
  await expect(page.getByTestId('context-empty')).toBeVisible();
  await expect(page.getByTestId('context-empty')).not.toContainText('Claude');
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect.poll(async () => (await boxOf(page, 'stage')).width).toBeGreaterThanOrEqual(640);
  expect(errors).toEqual([]);
  await close();
});

test('Chat in der Spalte (1440 px) springt beim Lesen nicht nach unten', async ({ browser }) => {
  const { page, close } = await at(browser, 1440, 900, { sampleTickMs: 150 });
  await page.getByTestId('open-companion').click();
  await expect(page.getByTestId('context-column')).toHaveAttribute('data-kind', 'claude');
  await page.getByTestId('chat-input').fill('zzlong bitte ausführlich');
  await page.getByTestId('chat-send').click();
  const log = page.getByTestId('chat-log');
  await expect.poll(() => log.evaluate((el) => el.scrollHeight - el.clientHeight), { timeout: 20_000 }).toBeGreaterThan(500);
  await log.evaluate((el) => (el.scrollTop = Math.max(0, el.scrollTop - 300)));
  const before = await log.evaluate((el) => el.scrollTop);
  await page.waitForTimeout(1500);
  const after = await log.evaluate((el) => el.scrollTop);
  expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
  await close();
});
