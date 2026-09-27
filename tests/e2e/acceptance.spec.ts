import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen } from './fixtures';

// Abschlussprüfung (P7-4, docs/abnahme.md): Kap. 14 und 15 als durchlaufende Prüfungen gegen den
// Produktions-Build. Weitere Kriterien belegen die dort genannten Specs und Unit-Tests.

type Dump = Record<string, Record<string, unknown>>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Dump;
const dump = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

test.use({ viewport: { width: 1440, height: 900 } });

/** Gleicher Textblock (≥ 24 Zeichen) höchstens einmal je Bildschirm (Kap. 15 „dasselbe dreimal"). */
async function duplicates(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const seen = new Map<string, number>();
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('main p, main h1, main h2, main h3, main li'))) {
      // Ausnahmen: Feldbeschriftungen in Listeneinträgen (`data-label`), Tabellen, Optionen, Can-Do-Liste.
      if (el.closest('[aria-hidden="true"], .sr-only, table, [data-testid="choices"], [data-testid="cando"], [data-label]')) continue;
      const t = el.innerText.trim().replace(/\s+/g, ' ');
      if (t.length < 24 || el.querySelector('p, li, h2, h3')) continue;
      seen.set(t, (seen.get(t) ?? 0) + 1);
    }
    return [...seen.entries()].filter(([, n]) => n > 1).map(([t, n]) => `${n}× ${t.slice(0, 60)}`);
  });
}

test('Kap. 14: alle Bereiche öffnen sich ohne Fehler, ohne Querscrollen und ohne Wiederholungen; nichts wird von außen geladen', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  for (const tab of ['today', 'learn', 'speak', 'discover', 'overview'] as const) {
    await page.getByTestId(`tab-${tab}`).click();
    await page.locator(`[data-screen="${tab}"]`).waitFor();
    await page.waitForTimeout(300);
    expect(await layoutProblems(page), tab).toEqual([]);
    expect(await duplicates(page), tab).toEqual([]);
  }
  for (const id of ['errors', 'path', 'history'] as const) {
    await page.getByTestId(`tab-${id}`).click();
    await page.waitForTimeout(300);
    expect(await duplicates(page), id).toEqual([]);
  }
  await page.getByTestId('vtest-start').click();
  await screen(page, 'vtest');
  await page.getByTestId('open-settings').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Kap. 14: alle bisherigen Daten sichtbar, Serie läuft weiter', async ({ page }) => {
  await boot(page, { migrated: true });
  await openOverview(page);
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  await expect(page.getByTestId('course-done')).toHaveText('6');
  await expect(page.getByTestId('vocab-total')).toHaveText('146');
});

test('Kap. 14/9: der Tagesauftrag funktioniert unverändert – daily/* und feed/* bleiben bytegleich, neue Wörter werden Karten', async ({ page }) => {
  await boot(page, { migrated: true });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toBeVisible();
  await page.getByTestId('tab-discover').click();
  await page.locator('[data-screen="discover"]').waitFor();
  await page.getByTestId('tab-overview').click();
  await screen(page, 'overview');
  await page.getByTestId('tab-history').click();
  await expect(page.getByTestId('weekly')).toBeVisible();
  await page.waitForTimeout(800);
  const db = await dump(page);
  const keys = Object.keys(SEED).filter((k) => k.startsWith('daily/') || k.startsWith('feed/'));
  expect(keys.length).toBeGreaterThan(0);
  for (const k of keys) expect(JSON.stringify(db[k]), k).toBe(JSON.stringify(SEED[k]));
  const words = Object.values(SEED)
    .flatMap((d) => (Array.isArray(d.newWords) ? (d.newWords as Array<{ word: string }>) : []))
    .map((w) => w.word.toLowerCase());
  const cards = new Set(Object.entries(db).filter(([k]) => k.startsWith('vocab/')).map(([, d]) => String(d.word).toLowerCase()));
  for (const w of words) expect(cards.has(w), w).toBe(true);
});

test('Kap. 15: erledigte Aufgaben sind keine Knöpfe, Extra zählt nicht zur Pflicht', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await screen(page, 'today');
  for (const row of await page.locator('[data-testid="duty"][data-state="done"]').all()) await expect(row.locator('button, a[href]')).toHaveCount(0);
  const total = await page.getByTestId('today-status').getAttribute('data-total');
  expect(Number(total)).toBeLessThanOrEqual(3);
});
