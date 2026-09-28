import { expect, test, type Page } from '@playwright/test';
import { boot, crashOnce, layoutProblems, openOverview, openProfile, openTab, screen, type Lang, type Theme } from './fixtures';
import { openProfileRow } from './profilHelpers';

// Neubau WP0b – Rahmen (docs/neubau/plan.md §4.1, architektur.md §5.5): Einstieg, Rückweg zur
// Herkunft, Neuladen/Fortsetzen, Fehlergrenzen per `lx:crash-once`, 390 px, beide Sprachen, drei
// Modi. Das Fortsetzen je Übung prüfen die Pakete mit ihrem `Resumable` (G3).

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

/** Vokabeltest: Einstieg über die Profil-Zeile (Neubau, früher „Dein Stand“ → Verlauf). */
async function openVtest(page: Page): Promise<void> {
  await openProfileRow(page, 'profile-vtest');
  await screen(page, 'vtest');
}

test('Einstieg: Kopf wie v1 (Profil + Serie links, Übersetzen + Claude rechts), 5 Reiter einzeilig, Profil-Blatt', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  const top = page.getByTestId('topbar');
  await expect(top.getByTestId('open-profile')).toBeVisible();
  await expect(top.getByTestId('profile-streak')).toHaveText('Serie 12');
  await expect(top.getByTestId('open-companion')).toBeVisible();
  await expect(top.getByTestId('open-translate')).toBeVisible();
  // Genau ein Claude-Knopf auf der Wurzel (die Seite zeichnet keinen zweiten).
  await expect(page.getByTestId('open-companion')).toHaveCount(1);
  const tabs = page.getByTestId('tabbar').locator('button');
  await expect(tabs).toHaveCount(5);
  for (const b of await tabs.all()) expect((await b.boundingBox())?.height ?? 99).toBeLessThan(64);
  for (const id of ['vocab', 'learn', 'read', 'speak', 'today'] as const) {
    await openTab(page, id);
    await expect(page.getByTestId('topbar')).toBeVisible();
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

test('Rückweg zur Herkunft: Seite „‹ Heute“, Übung ✕ zurück zur Herkunft, Bildlauf bleibt; aktiver Reiter → Wurzel', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openOverview(page);
  await expect(page.getByTestId('page-back')).toContainText('Heute');
  await expect(page.getByTestId('tabbar')).toBeVisible();
  await page.getByTestId('page-back').click();
  await screen(page, 'today');
  // Übung (aus dem Profil-Blatt): keine Reiterleiste, ✕ führt zurück zur Herkunft.
  await openVtest(page);
  await expect(page.getByTestId('tabbar')).toHaveCount(0);
  await expect(page.getByTestId('open-settings')).toHaveCount(0);
  await page.getByTestId('vt-close').click();
  await screen(page, 'today');
  // Bildlauf der Reiter-Wurzel bleibt über eine Seite hinweg erhalten.
  await openTab(page, 'learn');
  await page.evaluate(() => window.scrollTo(0, 300));
  const y = await page.evaluate(() => window.scrollY);
  await page.getByTestId('hub-course').click();
  await expect(page.getByTestId('course')).toBeVisible();
  await page.getByTestId('back').first().click();
  await screen(page, 'learn');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(y);
  // Tipp auf den aktiven Reiter: Wurzel und oben.
  await page.getByTestId('hub-course').click();
  await expect(page.getByTestId('course')).toBeVisible();
  await page.getByTestId('tab-learn').click();
  await screen(page, 'learn');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
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
  await screen(page, 'today');
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
    await expect(page.getByTestId('profile-streak')).toHaveText(lang === 'de' ? 'Serie 12' : 'Streak 12');
    await expect(page.getByTestId('tab-vocab')).toHaveText(lang === 'de' ? 'Wortschatz' : 'Vocab');
    expect(await layoutProblems(page)).toEqual([]);
    await openProfile(page);
    await expect(page.getByTestId('profile-overview')).toContainText(lang === 'de' ? 'Dein Stand' : 'Your progress');
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
}
