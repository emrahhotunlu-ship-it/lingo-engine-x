import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { DAY, planPatch, writes } from './trainerHelpers';

// Relaunch Stufe 1 P6 S1-START (docs/relaunch/stufe1-plan.md P6, §4.3): Startbild aus `app/today`, Boot ohne Warten, wartender Start.
// Erfundene Daten (Seed-Stichtag 20.09.2026, 21:00 Uhr Berlin).

/** Gültiges Startbild für den Stichtag: Schritt 1 erledigt, `go` zeigt absichtlich auf die Grammatik (der berechnete Plan sagt „Wiederholen“). */
const startDoc = (d = DAY) => ({
  v: 1,
  d,
  b: {
    b1: { st: 'done', n: 3, of: 3, k: 'review', bl: 0, m: 0, id: 'review' },
    b2: { st: 'now', n: 0, of: 1, k: 'legacy', bl: 0, m: 0, id: 'ch:gram' },
  },
  rest: 12,
  ring: 0.42,
  go: { k: 'legacy', id: 'ch:gram' },
  at: 1,
});

/** Bis zum Ende des Ladezustands: keine Zahl aus einem fremden oder kaputten Startbild, nur das Skelett. */
async function expectSkeletonOnly(page: Page): Promise<void> {
  const loading = page.locator('[data-screen="loading"]');
  await expect(loading.getByTestId('today-skeleton')).toBeVisible();
  await expect(page.getByTestId('start-card')).toHaveCount(0);
  await expect(page.getByTestId('start-min')).toHaveCount(0);
}

/** Wartender Start mit Fokus im Tippen (`tap`: Berührung wie am Handy, sonst Mausklick). */
async function focusStart(page: Page, tap: boolean): Promise<void> {
  const { errors } = await boot(page, { migrated: true, fake: { subscribeDelayMs: 2500, patch: { 'app/profile': planPatch(3), 'app/today': startDoc() } } });
  const card = page.getByTestId('start-card');
  await expect(card).toBeVisible();
  await expect(page.getByTestId('start-min')).toHaveText('12');
  await expect(page.getByTestId('start-status')).toHaveAttribute('data-done', '1');
  await expect(page.getByTestId('start-go')).toHaveAttribute('data-duty', 'ch:gram');
  if (tap) await page.getByTestId('start-go').tap();
  else await page.getByTestId('start-go').click();
  // Sofort: Rahmen-Skelett, und das (versteckte) Eingabefeld hat im Tippen den Fokus bekommen (iPhone-Tastatur).
  await expect(page.getByTestId('start-waiting')).toBeVisible();
  const focused = await page.evaluate(() => document.activeElement?.tagName ?? '');
  expect(['INPUT', 'TEXTAREA']).toContain(focused);
  // Danach beginnt die erste Aufgabe von selbst – nach dem BERECHNETEN Plan (Wiederholen), nicht nach `go` (Grammatik).
  await screen(page, 'trainer');
  await expect(page.getByTestId('start-waiting')).toHaveCount(0);
  // Die Messpunkte prüft perf.spec.ts ohne Testuhr (`page.clock` ersetzt `performance`).
  expect(errors).toEqual([]);
}

// Tarek S4: WebKit gibt es in dieser Umgebung nicht; derselbe Fokus-Test läuft zusätzlich als Handy (Chromium mit isMobile/hasTouch, Tippen).
test.describe('P6 Startbild am Handy (Berührung)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test('wartender Start per Tippen: Übungsrahmen und Fokus sofort, dann die Aufgabe nach dem berechneten Plan', async ({ page }) => {
    await focusStart(page, true);
  });
});

test.describe('P6 Startbild', () => {
  test('wartender Start: Knopf aus app/today, Tippen zeigt den Übungsrahmen und fokussiert sofort; der berechnete Plan entscheidet', async ({ page }) => {
    await focusStart(page, false);
  });

  test('wartender Start lässt sich mit ✕ abbrechen: zurück zu Heute, keine Aufgabe startet', async ({ page }) => {
    await boot(page, { migrated: true, fake: { subscribeDelayMs: 2500, patch: { 'app/profile': planPatch(3), 'app/today': startDoc() } } });
    await page.getByTestId('start-go').click();
    await page.getByTestId('start-waiting-cancel').click();
    await expect(page.getByTestId('start-waiting')).toHaveCount(0);
    await screen(page, 'today');
    await page.waitForTimeout(500);
    await expect(page.locator('[data-screen="trainer"]')).toHaveCount(0);
  });

  const broken: [string, Record<string, unknown> | null][] = [
    ['fehlt', null],
    ['ungültig', { v: 1, d: DAY, b: { b1: { st: 'now' } }, rest: 'viel', go: { id: 'review' } }],
    ['von gestern', startDoc('2026-09-19')],
  ];
  for (const [name, doc] of broken) {
    test(`Startbild ${name}: Skelett ohne Zahlen, danach die echte Karte ohne Sprung`, async ({ page }) => {
      const { errors } = await boot(page, { migrated: true, fake: { subscribeDelayMs: 2500, patch: { 'app/profile': planPatch(3), 'app/today': doc } } });
      await expectSkeletonOnly(page);
      await screen(page, 'today');
      await expect(page.getByTestId('today-card')).toBeVisible();
      await expect(page.getByTestId('start-card')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test('nach dem Laden schreibt die App das Startbild für heute genau einmal (ungültiges wird ganz ersetzt)', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(3), 'app/today': { v: 1, d: '2026-09-19', alt: true } } } });
    await screen(page, 'today');
    await expect.poll(async () => (await writes(page)).filter((w) => w.path === 'app/today').length).toBe(1);
    await page.waitForTimeout(800);
    expect((await writes(page)).filter((w) => w.path === 'app/today')).toHaveLength(1);
  });

  test('ohne Datenbank (?fake=nodb): der Hinweis „Datenbank nicht verfügbar“ bleibt, kein Skelett', async ({ page }) => {
    const { errors } = await boot(page, { fake: { capabilities: { db: false } } });
    await screen(page, 'nodb');
    await expect(page.getByTestId('today-skeleton')).toHaveCount(0);
    await expect(page.getByTestId('start-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Datenbank kommt erst nach 8 s: so lange das Skelett, kein Hinweis, dann Heute', async ({ page }) => {
    test.setTimeout(45_000);
    const { errors } = await boot(page, { migrated: true, fake: { useDelayMsBy: { db: 8000 }, patch: { 'app/profile': planPatch(3) } } });
    await expectSkeletonOnly(page);
    await page.waitForTimeout(5000);
    await expect(page.locator('[data-screen="loading"]').getByTestId('today-skeleton')).toBeVisible();
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(page.getByTestId('start-slow')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Datenbank braucht länger als 10 s: ruhiger Hinweis mit „Erneut versuchen“, Karte bleibt an ihrem Platz', async ({ page }) => {
    test.setTimeout(45_000);
    await boot(page, { migrated: true, fake: { useDelayMsBy: { db: 13_000 }, patch: { 'app/profile': planPatch(3) } } });
    const sk = page.getByTestId('today-skeleton');
    await expect(sk).toBeVisible();
    const y0 = (await sk.boundingBox())?.y ?? -1;
    await expect(page.getByTestId('start-slow')).toBeVisible({ timeout: 12_000 });
    await expect(page.getByTestId('start-slow-retry')).toBeVisible();
    // G2 Nora M1: beim Laden kein Zahnrad oben; Einstellungen (Diagnose, Sicherung) erst im ruhigen Hinweis.
    await expect(page.getByTestId('system-actions').getByTestId('open-settings')).toHaveCount(0);
    await expect(page.getByTestId('start-slow').getByTestId('open-settings')).toBeVisible();
    expect((await sk.boundingBox())?.y).toBe(y0);
    await screen(page, 'today');
    await expect(page.getByTestId('start-slow')).toHaveCount(0);
  });
});
