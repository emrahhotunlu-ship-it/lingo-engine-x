import { readdirSync, readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, openSettings, openOverview, expectStreak, screen } from './fixtures';

// Plattform-Test (Kap. 12): nichts von fremden Hosts, kein Absturz ohne Fähigkeiten,
// kein Entwicklungs-Adapter im Produktions-Build.

test('der Produktions-Build enthält keinen Entwicklungs-Adapter und keine Testdaten', () => {
  // Einzeldatei: nur index.html; Mehr-Datei (LX_BUILD=multi): alle Textdateien in dist/.
  const dist = new URL('../../dist/', import.meta.url);
  const html = readdirSync(dist).filter((f) => /\.(html|js|css|json)$/.test(f)).map((f) => readFileSync(new URL(f, dist), 'utf8')).join('\n');
  const markers = [
    '__LINGO_FAKE__',
    'lx:fake-db',
    'installFakeRuntime',
    'createMemoryDb',
    'createFakeClaude',
    'withCallLog',
    'registerCannedReply',
    'Feste Beispielantwort',
    'Alex Muster',
    // Kennungen des Adapters für KI und Sprachausgabe (platform-guard H-G).
    'zzjson',
    'zzqx',
    'FakeUtterance',
    'FAKE_VOICES',
    'com.apple.voice.compact',
    'Our onboarding takes two weeks',
  ];
  for (const marker of markers) {
    expect(html.includes(marker), marker).toBe(false);
  }
});

test('ohne window.claude (gespeicherte Kopie): klarer Hinweis, kein Absturz, keine Anfrage', async ({ page }) => {
  const { errors, external } = await boot(page, { fake: false });
  await screen(page, 'nodb');
  await expect(page.getByTestId('no-db')).toContainText('Datenbank nicht verfügbar');
  await expect(page.getByText('Es wurde nichts verändert.')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('db und sample liefern null: klarer Hinweis statt Absturz', async ({ page }) => {
  const { errors, external } = await boot(page, { fake: { capabilities: { db: false, sample: false, downloads: false } } });
  await screen(page, 'nodb');
  await openSettings(page);
  await page.getByTestId('diag-toggle').click();
  await expect(page.getByRole('dialog')).toContainText('nicht verfügbar');
  await expect(page.getByRole('button', { name: 'Alle Daten als JSON sichern' })).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('ohne sample und downloads läuft die App mit Datenbank weiter', async ({ page }) => {
  const { errors } = await boot(page, { fake: { capabilities: { sample: false, downloads: false } } });
  await screen(page, 'migration');
  await expect(page.getByRole('button', { name: 'Vorher Sicherung herunterladen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Umstellung ausführen' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('bricht ein Datenbank-Abonnement ab, erscheint eine klare Meldung mit Neu laden statt eines ewigen Skeletts', async ({ page }) => {
  const { errors } = await boot(page, { fake: { failSubscriptions: 'revoked' } });
  await screen(page, 'offline');
  await expect(page.getByTestId('connection-lost')).toContainText('Verbindung zu deinen Daten unterbrochen');
  await expect(page.getByRole('button', { name: 'Neu laden' })).toBeVisible();
  // Der Abbruch ist protokolliert, nicht still verschluckt.
  expect(errors.some((e) => e.includes('data:live'))).toBe(true);
});

test('reißt die Brücke einmal ab (unavailable), wird neu abonniert und die App läuft normal', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { failSubscriptions: 'unavailable', failSubscriptionsTimes: 6 } });
  await expectStreak(page, '12');
  expect(errors).toEqual([]);
});

test('antwortet die Laufzeit spät, erscheint sofort ein Lade-Skelett statt eines leeren Bildschirms', async ({ page }) => {
  const { errors } = await boot(page, { fake: { useDelayMs: 1500 }, migrated: true });
  await expect(page.locator('[data-screen="loading"]')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Deine Daten werden geladen' })).toBeVisible();
  await openOverview(page);
  expect(errors).toEqual([]);
});
