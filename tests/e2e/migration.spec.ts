import { expect, test } from '@playwright/test';
import { boot, screen } from './fixtures';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

type FakeWindow = Window & {
  __LINGO_FAKE__?: { db: { dump(): Record<string, Record<string, unknown>> }; saved: Array<{ filename: string; data: string }> };
};

test('Trockenlauf zeigt alles, schreibt nichts; nach Bestätigung ist die Umstellung Zustand, kein Knopf', async ({ page }) => {
  const { errors, external } = await boot(page, { fake: { persist: true } });
  await screen(page, 'migration');

  // Bericht: Serie vorher/nachher gleich, Anzahlen sichtbar, noch nichts geschrieben.
  await expect(page.getByTestId('mig-streak')).toHaveText('12 Tage');
  await expect(page.getByTestId('mig-summary')).toContainText('146 Vokabeln · 16 Grammatikthemen · 6 von 24 Lektionen · dazu 2 ausgeblendete');
  await expect(page.getByTestId('mig-summary')).toContainText('Nichts wird gelöscht.');
  await expect(page.getByText(/Jede bisher geübte Karte bekommt einen neuen Wiederholungsplan/)).toBeVisible();
  // Der eine Knopf ist ohne Scrollen sichtbar (Kap. 2.1).
  await expect(page.getByRole('button', { name: 'Umstellung ausführen' })).toBeInViewport();
  expect(await page.evaluate(() => Object.keys((window as FakeWindow).__LINGO_FAKE__?.db.dump() ?? {}).includes('app/schema'))).toBe(false);

  // Sicherung vorher: eine JSON-Datei mit allen Dokumenten.
  await page.getByRole('button', { name: 'Vorher Sicherung herunterladen' }).click();
  await expect(page.getByText('Sicherung gespeichert.')).toBeVisible();
  const backup = await page.evaluate(() => (window as FakeWindow).__LINGO_FAKE__?.saved[0]);
  expect(backup?.filename).toMatch(/^lingo-engine-x-sicherung-2026-09-20\.json$/);
  expect(JSON.parse(backup?.data ?? '{}')).toMatchObject({ app: 'lingo-engine-x', documentCount: 196 });

  // Ausführen → Übersicht mit denselben Werten.
  await page.getByRole('button', { name: 'Umstellung ausführen' }).click();
  await screen(page, 'overview');
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  await expect(page.getByTestId('course-done')).toHaveText('6');
  await expect(page.getByTestId('vocab-total')).toHaveText('146');
  await expect(page.getByText('Umgestellt am 20. September 2026')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Umstellung ausführen' })).toHaveCount(0);

  const dump = await page.evaluate(() => (window as FakeWindow).__LINGO_FAKE__?.db.dump() ?? {});
  expect(Object.keys(dump)).toHaveLength(197);
  expect(dump['app/schema']).toMatchObject({ version: 1, cutover: '2026-09-20' });
  expect(dump['vocab/reliable']).toHaveProperty('fsrs');

  // Nach dem Neuladen bleibt der Zustand (Daten liegen in db, nicht im Browser-Speicher).
  await page.reload();
  await screen(page, 'overview');
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('noch nicht übertragene Änderungen der alten App werden erkannt und übernommen', async ({ page }) => {
  const newerProfile = { lang: 'de', days: { '2026-09-21': 9 }, xpDays: { '2026-09-21': 30 } };
  const { errors } = await boot(page, {
    now: '2026-09-21T20:00:00+02:00',
    localStorage: {
      'sw2:__dirty': JSON.stringify({ 'vocab/nur-im-browser': 1_789_900_000_000 }),
      'sw2:vocab/nur-im-browser': JSON.stringify({ word: 'only in the browser', de: 'nur im Browser', state: 'new', S: 0 }),
      'sw2:app/other': JSON.stringify(newerProfile),
    },
  });
  await screen(page, 'migration');
  await expect(page.getByText('1 Änderung aus diesem Browser war noch nicht gespeichert und wird ergänzt.')).toBeVisible();
  await page.getByRole('button', { name: 'Umstellung ausführen' }).click();
  await screen(page, 'overview');
  const doc = await page.evaluate(() => (window as FakeWindow).__LINGO_FAKE__?.db.dump()['vocab/nur-im-browser']);
  expect(doc).toMatchObject({ word: 'only in the browser', fsrs: { state: 0 } });
  expect(errors).toEqual([]);
});

test('scheitert ein Schreibvorgang, erscheint eine klare Meldung und ein erneuter Versuch gelingt', async ({ page }) => {
  const { errors } = await boot(page);
  await screen(page, 'migration');
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { setFailWrites(c: string): void } } }).__LINGO_FAKE__.db.setFailWrites('invalid_argument'));
  await page.getByRole('button', { name: 'Umstellung ausführen' }).click();
  await expect(page.getByRole('alert')).toContainText('Die Umstellung wurde unterbrochen');
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { setFailWrites(c?: string): void } } }).__LINGO_FAKE__.db.setFailWrites(undefined));
  await page.getByRole('button', { name: 'Erneut prüfen' }).click();
  await page.getByRole('button', { name: 'Umstellung ausführen' }).click();
  await screen(page, 'overview');
  // Der Fehler wurde protokolliert (sichtbar in der Diagnose), nicht still verschluckt.
  expect(errors.some((e) => e.includes('data:write'))).toBe(true);
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('diag-log')).toContainText('migration:apply');
});

test('bei unerwartetem Profil ist die Umstellung gesperrt: kein Knopf, nur die Sicherung', async ({ page }) => {
  const { errors } = await boot(page, { fake: { patch: { 'app/profile': { rate: 'schnell' } } } });
  await screen(page, 'migration');
  await expect(page.getByTestId('mig-blocked')).toContainText('Dein Profil hat einen unerwarteten Aufbau');
  await expect(page.getByTestId('mig-streak')).toHaveText('12 Tage');
  await expect(page.getByRole('button', { name: 'Umstellung ausführen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Vorher Sicherung herunterladen' })).toBeInViewport();
  expect(errors.every((e) => e.includes('data:validate'))).toBe(true);
});
