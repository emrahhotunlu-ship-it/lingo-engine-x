import { expect, test, type Page } from '@playwright/test';
import { TABS } from '../../src/app/shell/tabs';
import { boot, layoutProblems, openSettings, screen } from './fixtures';
import { openProfileContent, openProfileRow, openStandTab, startVtest } from './profilHelpers';

// Paket P6 (docs/neubau/plan.md §4.7): Profil-Blatt, „Dein Stand“ mit fünf Reitern, Tests,
// Claude-Blatt (Übersetzen → „+ Wortschatz“ in einem Tipp, Rückfrage-Chips), Einstellungen in
// sechs Gruppen mit Messwerten, Wortschatztest fortsetzbar.

type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Profil: Kopf mit Serie, sieben Punkten und Urteil; jeder Stand-Reiter in 2 Tipps', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
    await screen(page, 'today');
    await openProfileContent(page);
    await expect(page.getByTestId('streak-count')).toHaveText('12');
    await expect(page.getByTestId('week-strip').getByTestId('week-day')).toHaveCount(7);
    await expect(page.getByTestId('profile-judge-line')).toContainText('B2');
    expect(await layoutProblems(page)).toEqual([]);
    for (const tab of ['judge', 'errors', 'path', 'stats', 'history'] as const) {
      await openStandTab(page, tab);
      expect(await layoutProblems(page), tab).toEqual([]);
    }
    // Statistik: Heatmap oben, darunter der Platz `stand` bzw. die Karten-Messwerte.
    await openStandTab(page, 'stats');
    await expect(page.getByTestId('heatmap')).toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Tests in 2 Tipps: Wochen-Check-Seite mit bisherigen Checks, Wortschatztest mit Einstieg', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
    await screen(page, 'today');
    await openProfileRow(page, 'profile-check');
    await screen(page, 'checks');
    await expect(page.getByTestId('check-start')).toBeVisible();
    await expect(page.getByTestId('check-last')).toContainText('75 %');
    await openProfileRow(page, 'profile-vtest');
    await screen(page, 'vtest');
    await expect(page.getByTestId('vt-start')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Wochenbericht als Seite aus dem Profil', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openProfileRow(page, 'profile-weekly');
    await screen(page, 'weekly');
    await expect(page.getByTestId('weekly-text')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Übersetzen → „+ Wortschatz“ an einer Wendung: Karte mit Satz im Eingangskorb (1 Tipp)', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.getByTestId('open-companion').tap();
    // Umschalter „Übersetzen · Fragen“: Übersetzen steht zuerst.
    const tabs = page.getByTestId('companion').getByRole('tab');
    await expect(tabs.first()).toHaveAttribute('data-testid', 'companion-tab-translate');
    await page.getByTestId('companion-tab-translate').tap();
    await page.getByTestId('tr-input').fill('Keep up');
    await page.getByTestId('tr-go').tap();
    await expect(page.getByTestId('tr-card')).toHaveAttribute('data-word', 'keep up');
    await page.getByTestId('tr-card').tap();
    await expect(page.getByTestId('tr-card-done')).toBeVisible();
    await expect.poll(async () => (await dump(page))['vocab/keep-up']?.state).toBe('new');
    expect((await dump(page))['vocab/keep-up']).toMatchObject({ word: 'keep up', de: 'mithalten', ex: 'It is hard to [keep up] with all the new emails.', src: 'translate' });
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Fragen: nach der Antwort die Chips „Noch ein Beispiel · Wann nimmt man das andere? · Auf Deutsch“', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await page.getByTestId('open-companion').tap();
    await page.getByTestId('companion-tab-chat').tap();
    await page.getByTestId('chat-input').fill('Warum heißt es „since 2020“ und nicht „for 2020“?');
    await page.getByTestId('chat-send').tap();
    await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
    const keys = await page.getByTestId('chat-suggestion').evaluateAll((els) => els.map((e) => e.getAttribute('data-key')));
    expect(keys).toEqual(['nbProfilSgExample', 'nbProfilSgOther', 'nbProfilSgGerman']);
    await expect(page.getByTestId('chat-suggestion').nth(1)).toHaveText('Wann nimmt man das andere?');
    // N96: „Mach mir eine Übung dazu“ startet die Übung im Player (Thema = Frage und Antwort).
    await page.locator('[data-testid="chat-action"][data-action="drill"]').tap();
    await screen(page, 'claudeDrill');
    const call = (await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string | null; input: string }> } }).__LINGO_FAKE__.sampleCalls)).filter((c) => c.id === 'claude-drill');
    expect(call).toHaveLength(1);
    expect(call[0]?.input).toContain('since 2020');
    // Ohne feste Antwort des Adapters: sauberer Fehlerzustand mit „Erneut versuchen“ (A6.3).
    await expect(page.getByTestId('cd-item').or(page.getByTestId('cd-error'))).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors.filter((e) => !e.includes('claude-drill'))).toEqual([]);
  });
});

test.describe('Desktop 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Einstellungen in sechs Gruppen; Diagnose zeigt die vier Messwerte (kopierbar)', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openSettings(page);
    const dialog = page.getByRole('dialog');
    for (const g of ['learn', 'voice', 'context', 'look', 'data']) await expect(dialog.getByTestId(`set-group-${g}`)).toBeVisible();
    await dialog.getByTestId('diag-toggle').click();
    const rows = dialog.getByTestId('diag-perf-row');
    await expect(rows).toHaveCount(4);
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute('data-name')))).toEqual(['lx:boot', 'lx:live', 'lx:status', 'lx:card']);
    // Die Werte selbst prüft tests/unit/nbProfilPerf.test.ts (die Testuhr ersetzt `performance`).
    await expect(dialog.getByTestId('diag-perf-copy')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Wortschatztest: ✕ fragt nicht und behält den Stand; erneut öffnen setzt am selben Wort fort', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
    await screen(page, 'today');
    await startVtest(page);
    for (let k = 0; k < 5; k++) await page.getByTestId(k % 2 ? 'vt-no' : 'vt-yes').click();
    const word = (await page.getByTestId('vt-word').innerText()).trim();
    await page.getByTestId('vt-close').click();
    await expect(page.locator('[data-screen="vtest"]')).toHaveCount(0);
    await openProfileRow(page, 'profile-vtest');
    await screen(page, 'vtest');
    await expect(page.getByTestId('vtest')).toHaveAttribute('data-state', 'yesno');
    await expect(page.getByTestId('vt-word')).toHaveText(word);
    await expect(page.getByTestId('vt-progress')).toContainText('6');
    expect(errors).toEqual([]);
  });

  test('Profil-Zeilen auf jeder Reiter-Wurzel erreichbar', async ({ page }) => {
    await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
    await screen(page, 'today');
    for (const { id } of TABS) {
      await page.getByTestId(`tab-${id}`).click();
      await openProfileContent(page);
      await expect(page.getByTestId('profile-stats')).toBeVisible();
    }
  });
});
