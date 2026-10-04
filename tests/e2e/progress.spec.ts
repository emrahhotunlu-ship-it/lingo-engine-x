import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen, type Lang } from './fixtures';
import { openWeekly } from './profilHelpers';

// Phase 6 (Plan §13): „Dein Stand" mit Urteil · Fehler · Weg nach C1 · Verlauf gegen den
// Produktions-Build. Feste Antworten des Adapters: assess@3 und weekly-report@2 in DE und EN.

type Dump = Record<string, Record<string, unknown>>;
type Call = { id: string | null; tier: string; cache?: unknown; input: string };
const dump = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());
const calls = (page: Page, id: string) =>
  page.evaluate((tid) => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Call[] } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === tid).map((c) => ({ id: c.id, tier: c.tier, cache: c.cache })), id);

test.use({ viewport: { width: 1440, height: 900 } });

async function tab(page: Page, id: 'judge' | 'errors' | 'path' | 'stats' | 'history') {
  // Drei Segmente: die alten Reiter-Namen führen auf das Segment mit ihrem Inhalt.
  const seg = { judge: 'review', history: 'review', errors: 'grammar', path: 'words', stats: 'words' }[id];
  await page.getByTestId(`tab-${seg}`).click();
  await expect(page.getByTestId(`tab-${seg}`)).toHaveAttribute('aria-selected', 'true');
}

for (const lang of ['de', 'en'] as Lang[]) {
  for (const width of [390, 1440]) {
    test(`drei Segmente ohne undefined/NaN/{0} und ohne Querscrollen · ${lang} · ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const { errors, external } = await boot(page, { migrated: true, lang });
      await openOverview(page);
      for (const id of ['judge', 'errors', 'path', 'stats', 'history'] as const) {
        await tab(page, id);
        await page.waitForTimeout(300);
        expect(await layoutProblems(page), id).toEqual([]);
      }
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });
  }
}

test('Öffnen löst genau eine Einschätzung aus (complex, ohne Zwischenspeicher); Hülle mit Verlauf gespeichert', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  await expect.poll(async () => (await dump(page))['app/assess']?.d).toBe('2026-09-20');
  const doc = (await dump(page))['app/assess']!;
  expect(doc).toMatchObject({ v: 2, pv: 'assess@3', tier: 'complex', lang: 'de' });
  expect((doc.run as Record<string, unknown>).d).toBe('2026-09-20');
  // Befund H3: Die Einschätzung der alten App (Seed, 18.09., ohne hist) ist erster Verlaufseintrag.
  const hist = doc.hist as Array<Record<string, unknown>>;
  expect(hist.map((h) => h.d)).toEqual(['2026-09-18', '2026-09-20']);
  expect(Object.keys(hist[0]!.dims as object)).toHaveLength(6);
  // Seit assess@3 nur noch Grammatik und Wortschatz (der Verlaufseintrag der alten App behält seine sechs Fertigkeiten).
  expect(((doc.data as Record<string, unknown>).dims as unknown[]).length).toBe(2);
  expect(await calls(page, 'assess')).toEqual([{ id: 'assess', tier: 'complex', cache: false }]);
  await expect(page.getByTestId('assess-cefr')).toHaveAttribute('data-cefr', 'B2');
  await expect(page.getByTestId('assess-stamp')).toContainText('20. September 2026');
  await expect(page.getByTestId('dim')).toHaveCount(2);
  expect(await page.getByTestId('dim').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')))).toEqual(['grammar', 'vocabulary']);
  // Tagessperre: Reiterwechsel und Rückkehr lösen keinen zweiten Lauf aus.
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  await openOverview(page);
  await screen(page, 'overview');
  await page.waitForTimeout(500);
  expect(await calls(page, 'assess')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('„Neu einschätzen" fragt ausdrücklich neu, „Denkt nach …" mit Stopp; der alte Stand bleibt sichtbar', async ({ page }) => {
  await boot(page, { migrated: true, fake: { sampleDelayMs: 1500 } });
  await openOverview(page);
  await expect(page.getByTestId('assess-phase')).toBeVisible();
  await expect(page.getByTestId('assess-cefr')).toHaveAttribute('data-cefr', 'B2');
  await expect(page.getByTestId('assess-stop')).toBeVisible();
  await expect(page.getByTestId('assess-renew')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('assess-renew').click();
  await expect(page.getByTestId('assess-phase')).toBeVisible();
  await page.getByTestId('assess-stop').click();
  await expect(page.getByTestId('assess-renew')).toBeVisible();
  await expect(page.getByTestId('assess-cefr')).toHaveAttribute('data-cefr', 'B2');
  expect(await calls(page, 'assess')).toHaveLength(2);
});

test('rate_limited: Hinweis, kein zweiter Aufruf, alter Stand bleibt', async ({ page }) => {
  await boot(page, { migrated: true, fake: { sampleFail: { assess: 'rate_limited' } } });
  await openOverview(page);
  await expect(page.getByTestId('assess-error')).toBeVisible();
  await page.waitForTimeout(1000);
  expect(await calls(page, 'assess')).toHaveLength(1);
  await expect(page.getByTestId('assess-cefr')).toHaveAttribute('data-cefr', 'B2');
  expect((await dump(page))['app/assess']?.d).toBe('2026-09-18');
});

test('ohne sample: Einschätzung wird angezeigt, ohne Knopf und ohne Aufruf', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openOverview(page);
  await expect(page.getByTestId('assess-cefr')).toHaveAttribute('data-cefr', 'B2');
  await expect(page.getByTestId('assess-renew')).toHaveCount(0);
  await expect(page.locator('[data-ai]')).toHaveCount(0);
});

test('not_granted: Knopf verschwindet, Stand bleibt', async ({ page }) => {
  await boot(page, { migrated: true, fake: { sampleFail: { assess: 'not_granted' } } });
  await openOverview(page);
  await expect(page.getByTestId('assess-cefr')).toHaveAttribute('data-cefr', 'B2');
  await expect(page.getByTestId('assess-renew')).toHaveCount(0);
  expect(await calls(page, 'assess')).toHaveLength(1);
});

test('schemawidrige erste Antwort: genau ein Neuversuch, dann gespeichert (A6.3)', async ({ page }) => {
  await boot(page, { migrated: true, fake: { assessBad: true } });
  await openOverview(page);
  await expect.poll(async () => (await dump(page))['app/assess']?.d).toBe('2026-09-20');
  expect(await calls(page, 'assess')).toHaveLength(2);
});

test('einfacheres Modell: die antwortende Stufe wird gespeichert und genannt', async ({ page }) => {
  await boot(page, { migrated: true, fake: { tierApplied: 'default' } });
  await openOverview(page);
  await expect.poll(async () => (await dump(page))['app/assess']?.tier).toBe('default');
  await expect(page.getByTestId('assess-stamp')).toContainText('einfacheren Modell');
});

test('Oberfläche EN, gespeicherte Einschätzung DE: Stufen sichtbar, Texte erst nach genau einem neuen Lauf', async ({ page }) => {
  // Einschätzung von heute: nur der Sprachwechsel ist ein Grund.
  await boot(page, { migrated: true, lang: 'en', fake: { patch: { 'app/assess': { d: '2026-09-20' } } } });
  await openOverview(page);
  await expect.poll(async () => (await dump(page))['app/assess']?.lang).toBe('en');
  expect(await calls(page, 'assess')).toHaveLength(1);
  await expect(page.getByTestId('strength').first()).toBeVisible();
  const text = await page.getByTestId('judge').innerText();
  expect(text).not.toMatch(/[äöüß]/);
});

test('„Üben" beim Blocker öffnet die Übung; ohne Ziel fehlt der Knopf', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openOverview(page);
  await expect(page.getByTestId('blocker')).toHaveCount(2);
  await expect(page.getByTestId('blocker-practice')).toHaveCount(2);
  await page.getByTestId('blocker-practice').first().click();
  await screen(page, 'grammarSession');
});

test('Blocker mit unbekannter Aktion: kein „Üben"-Knopf', async ({ page }) => {
  const data = {
    cefr: 'B2',
    level: 'Solides B2 mit Luft nach oben in mehreren Bereichen.',
    blockers: [{ title: 'Unbekannt', why: 'Ohne Ziel in der App.', fix: 'This has no target.', action: 'grammar:unknown' }],
    dims: [],
  };
  await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/assess': { data } } } });
  await openOverview(page);
  await expect(page.getByTestId('blocker')).toHaveCount(1);
  await expect(page.getByTestId('blocker-practice')).toHaveCount(0);
});

test('Fehler-Radar: Zeilen mit Trend, Beispiele, „Üben" führt zur Fehlerwiederholung', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openOverview(page);
  await tab(page, 'errors');
  const rows = page.getByTestId('radar-row');
  await expect(rows.first()).toBeVisible();
  for (const r of await rows.all()) expect(['more', 'same', 'fewer']).toContain(await r.getAttribute('data-trend'));
  const practice = page.getByTestId('radar-practice').first();
  await practice.click();
  await screen(page, 'grammarSession');
});

test('Weg nach C1: Status je Punkt, „Kann ich" wird in profile.canDo gespeichert und zählt', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openOverview(page);
  await tab(page, 'path');
  // Kurz gehalten (UX-Beratung Nr. 6): je Stufe höchstens 4 offene Punkte sichtbar, der Rest zugeklappt.
  for (const level of await page.getByTestId('cando-level').all()) expect(await level.locator('[data-testid="cando"]:not([data-status="reached"])').count()).toBeLessThanOrEqual(4);
  for (const toggle of await page.locator('[data-testid="cando-more"], [data-testid="cando-reached"]').all()) await toggle.click();
  // Nur Punkte zu Grammatik und Wortschatz (Fokus-Umbau, Gesamtkonzept 3.5).
  await expect(page.getByTestId('cando')).toHaveCount(10);
  await expect(page.getByTestId('vocab-goal')).toContainText('8.000');
  const item = page.locator('[data-testid="cando"][data-status="open"]').first();
  const id = await item.getAttribute('data-id');
  await item.getByTestId('cando-self').click();
  await expect(page.locator(`[data-testid="cando"][data-id="${id}"]`)).toHaveAttribute('data-status', 'self');
  await expect.poll(async () => ((await dump(page))['app/profile']?.canDo as Record<string, unknown>)[id ?? '']).toBe('2026-09-20');
  await page.locator(`[data-testid="cando"][data-id="${id}"]`).getByTestId('cando-self').click();
  await expect.poll(async () => ((await dump(page))['app/profile']?.canDo as Record<string, unknown>)[id ?? '']).toBeNull();
});

test('Wochenbericht mit Fakten und gespeichertem KI-Text; Verlauf mit Diagramm und Messwerten; Statistik mit Karten-Messwerten', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openWeekly(page);
  await expect(page.getByTestId('weekly')).toHaveAttribute('data-week', '2026-W37');
  await expect(page.getByTestId('weekly-fact').first()).toBeVisible();
  await expect(page.getByTestId('weekly-text')).toBeVisible();
  await expect.poll(async () => ((await dump(page))['app/weekly']?.items as unknown[] | undefined)?.length).toBe(1);
  expect(await calls(page, 'weekly-report')).toHaveLength(1);
  // Verlauf: Diagramm und Messwerte (BKT) zugeklappt (UX-Beratung Nr. 6).
  await openOverview(page);
  await tab(page, 'history');
  await expect(page.getByTestId('history-chart')).toHaveCount(0);
  await page.getByTestId('history-toggle').click();
  await expect(page.getByTestId('history-chart')).toBeVisible();
  await page.getByTestId('measures').getByRole('button').click();
  await expect(page.getByTestId('measures').locator('table')).toHaveCount(1);
  // Statistik: die Karten-Messwerte (bis P3 den Platz `stand` füllt); keine Aktivitäts-Heatmap mehr (Fokus-Umbau).
  await tab(page, 'stats');
  await expect(page.getByTestId('heatmap')).toHaveCount(0);
  await expect(page.getByTestId('stats')).toBeVisible();
  // Zweites Öffnen: der Bericht liegt schon vor, kein weiterer Aufruf.
  await openWeekly(page);
  await expect(page.getByTestId('weekly-text')).toBeVisible();
  expect(await calls(page, 'weekly-report')).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('Verlauf: Wochenbericht schlägt fehl → Hinweis mit „Erneut versuchen", der Neuversuch fragt frisch (refresh)', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { sampleFailOnce: { 'weekly-report': 'upstream_error' } } });
  await openWeekly(page);
  await expect(page.getByTestId('weekly-error')).toBeVisible();
  await expect(page.getByTestId('weekly-text')).toHaveCount(0);
  expect(await calls(page, 'weekly-report')).toHaveLength(1);
  await page.getByTestId('weekly-retry').click();
  await expect(page.getByTestId('weekly-text')).toBeVisible();
  await expect(page.getByTestId('weekly-error')).toHaveCount(0);
  const all = await calls(page, 'weekly-report');
  expect(all).toHaveLength(2);
  expect(all[1]?.cache).toMatchObject({ refresh: true });
  expect(errors).toEqual([]);
});

test('der zuletzt offene Reiter bleibt beim nächsten Öffnen', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openOverview(page);
  await tab(page, 'path');
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  await openOverview(page);
  await expect(page.getByTestId('tab-words')).toHaveAttribute('aria-selected', 'true');
});

test('Abo-Höchststand bleibt über einen Durchlauf aller Reiter ≤ 32', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  for (const id of ['judge', 'errors', 'path', 'stats', 'history'] as const) {
    await tab(page, id);
    await page.waitForTimeout(200);
  }
  const peak = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { peakSubscriptions(): number } } }).__LINGO_FAKE__.db.peakSubscriptions());
  expect(peak).toBeLessThanOrEqual(32);
});
