import { expect, test, type Page } from '@playwright/test';
import { boot, openSettings, openOverview } from './fixtures';

type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page) =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

test.use({ viewport: { width: 1440, height: 900 } });

test('Sprache und Darstellung werden sofort angewendet und in app/profile gespeichert', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  await openSettings(page);
  const dialog = page.getByRole('dialog', { name: 'Einstellungen' });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect.poll(async () => (await dump(page))['app/profile']?.lang).toBe('en');

  await page.getByRole('radio', { name: 'Light' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect.poll(async () => (await dump(page))['app/profile']?.theme).toEqual({ m: 'light', p: 'ocean' });

  // Tastatur: Pfeiltasten wechseln innerhalb der Gruppe, Esc schließt.
  await page.getByRole('radio', { name: 'Light' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dim');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('open-settings')).toBeFocused();

  expect(errors).toEqual([]);
});

test('Tab bleibt im geöffneten Dialog (Tastaturbedienung)', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  await openSettings(page);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
});

test('Diagnose zeigt Fähigkeiten, Dokumentzahl und Datenversion', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  await openSettings(page);
  const dialog = page.getByRole('dialog');
  // Zugeklappt (UX-Beratung Nr. 11), die App-Version steht schon in der Zeile.
  await expect(dialog.getByTestId('diag-toggle')).toContainText('Version ');
  await expect(dialog.getByText('Datenbank', { exact: true })).toHaveCount(0);
  await dialog.getByTestId('diag-toggle').click();
  await expect(dialog.getByText('Datenbank', { exact: true })).toBeVisible();
  await expect(dialog.getByText('209 von 5.000')).toBeVisible();
  await expect(dialog.getByText(/^1 · 20\. September 2026$/)).toBeVisible();
  await expect(dialog.getByText('Keine Fehler protokolliert.')).toBeVisible();
});

test('scheitert das Speichern, wird die Änderung zurückgenommen und gemeldet', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { setFailWrites(c: string): void } } }).__LINGO_FAKE__.db.setFailWrites('invalid_argument'));
  await openSettings(page);
  await page.getByRole('radio', { name: 'Hell' }).click();
  await expect(page.getByRole('alert')).toContainText('Konnte nicht gespeichert werden');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('diag-toggle').click();
  await expect(page.getByTestId('diag-log')).toContainText('settings:save');
  expect(errors.some((e) => e.includes('settings:save'))).toBe(true);
});

test('ein ungültiges Profil wird gemeldet, angezeigt und beim Speichern nie ersetzt', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { rate: 'schnell' } } } });
  await openOverview(page);
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  await openSettings(page);
  await page.getByRole('radio', { name: 'English' }).click();
  await expect.poll(async () => (await dump(page))['app/profile']?.lang).toBe('en');
  const profile = (await dump(page))['app/profile'] ?? {};
  expect(Object.keys(profile).length).toBeGreaterThan(30);
  expect(profile.rate).toBe('schnell');
  expect(Object.keys(profile.days ?? {}).length).toBeGreaterThan(20);
  await page.getByTestId('diag-toggle').click();
  await expect(page.getByTestId('diag-log')).toContainText('app/profile');
  expect(errors.some((e) => e.includes('data:validate'))).toBe(true);
});

test('Datenexport über downloads liefert alle Dokumente als JSON', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Alle Daten als JSON sichern' }).click();
  await expect(page.getByText('Sicherung gespeichert.')).toBeVisible();
  const saved = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { saved: Array<{ data: string }> } }).__LINGO_FAKE__.saved[0]?.data ?? '{}');
  const json = JSON.parse(saved) as { documentCount: number; schemaVersion: number; documents: Record<string, unknown> };
  expect(json.documentCount).toBe(209);
  expect(json.schemaVersion).toBe(1);
  expect(Object.keys(json.documents)).toContain('daily/2026-09-20');
});

test('Englisch: Sicherung heißt „backup", Diagnose-Meldungen auf Englisch', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    lang: 'en',
    localStorage: { 'lx:diag': JSON.stringify([{ id: 1, t: Date.parse('2026-09-20T20:00:00+02:00'), level: 'warn', scope: 'grammar:generate', code: 'invalid_document', message: 'Pool ungültig – nicht überschrieben' }]) },
  });
  await openOverview(page);
  await openSettings(page);
  await page.getByRole('button', { name: 'Back up all data as JSON' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { saved: Array<{ filename: string }> } }).__LINGO_FAKE__.saved[0]?.filename ?? '')).toBe('lingo-engine-x-backup-2026-09-20.json');
  await page.getByTestId('diag-toggle').click();
  const log = page.getByTestId('diag-log');
  await expect(log).toContainText('Pool invalid – not overwritten');
  await expect(log).not.toContainText('ungültig');
  expect(errors).toEqual([]);
});

// ---------------------------------------------------------------- Phase 6 (Plan §9, §13)

test('Tagesziel, neue Wörter pro Tag und Ton bleiben nach dem Neuladen', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { persist: true, capabilities: { sample: false } } });
  await openOverview(page);
  await openSettings(page);
  await page.getByTestId('set-goalmin').getByRole('radio', { name: '15' }).click();
  await page.getByTestId('set-newperday').getByRole('radio', { name: '10' }).click();
  await expect.poll(async () => (await dump(page))['app/profile']?.goalMin).toBe(15);
  await expect.poll(async () => (await dump(page))['app/profile']?.newPerDay).toBe(10);
  await expect(page.getByTestId('sound-section')).toBeVisible();
  await page.reload();
  await openOverview(page);
  await openSettings(page);
  await expect(page.getByTestId('set-goalmin').getByRole('radio', { name: '15' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('set-newperday').getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('Ton an/aus wird in app/profile.sound gespeichert (WebAudio nachgebildet)', async ({ page }) => {
  await page.addInitScript(() => {
    class FakeParam {
      value = 0;
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
    }
    class FakeNode {
      frequency = new FakeParam();
      gain = new FakeParam();
      type = 'sine';
      connect(n: unknown) {
        return n;
      }
      start() {
        (window as unknown as { __cues: number }).__cues = ((window as unknown as { __cues?: number }).__cues ?? 0) + 1;
      }
      stop() {}
    }
    class FakeCtx {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return new FakeNode();
      }
      createGain() {
        return new FakeNode();
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
  });
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openOverview(page);
  await openSettings(page);
  const sw = page.getByTestId('set-sound');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect.poll(async () => (await dump(page))['app/profile']?.sound).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cues?: number }).__cues ?? 0)).toBeGreaterThan(0);
  await sw.click();
  await expect.poll(async () => (await dump(page))['app/profile']?.sound).toBe(false);
});

test('scheitert das Speichern des Tagesziels, springt die Auswahl zurück und es gibt einen Hinweis', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openOverview(page);
  await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { setFailWrites(c: string): void } } }).__LINGO_FAKE__.db.setFailWrites('invalid_argument'));
  await openSettings(page);
  await page.getByTestId('set-goalmin').getByRole('radio', { name: '40' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Konnte nicht gespeichert werden' })).toBeVisible();
  await expect(page.getByTestId('set-goalmin').getByRole('radio', { name: '25' })).toHaveAttribute('aria-checked', 'true');
  expect((await dump(page))['app/profile']?.goalMin).toBeUndefined();
});

test('gespeicherte Stimme fehlt auf dem Gerät: Hinweis, Probe hören spricht mit der besten US-Stimme', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/profile': { voice: 'Stimme-die-es-nicht-gibt' } } } });
  await openOverview(page);
  await openSettings(page);
  await expect(page.getByTestId('voice-missing')).toBeVisible();
  await page.getByTestId('voice-preview').first().click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken.length)).toBeGreaterThan(0);
});
