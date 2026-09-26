import { expect, type Page } from '@playwright/test';
import { openOverview } from './fixtures';

// Hilfen für die E2E-Tests von Phase 4 (Lesen, Hören, Schreiben, Entdecken).

type Doc = Record<string, unknown>;
export type Dump = Record<string, Doc>;

export const DAY = '2026-09-20';
/** Artikel mit Fragen im Testbestand (Tageswahl am Stichtag, siehe generate-seed.mjs). */
export const ARTICLE_Q = 'ai1789754400000';
/** Eigener Text ohne Fragen im Testbestand. */
export const ARTICLE_OWN = 'ai1789149600000';
export const LPOOL_NEW = 'ai1789668000000';

export const dump = (page: Page): Promise<Dump> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

export const writes = (page: Page): Promise<Array<{ op: string; path: string }>> =>
  page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { db: { writes(): Array<{ op: string; path: string }> } } }).__LINGO_FAKE__.db.writes()]);

export const sampleCalls = (page: Page): Promise<Array<{ id: string | null; tier: string }>> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string | null; tier: string }> } }).__LINGO_FAKE__.sampleCalls.map((c) => ({ id: c.id, tier: c.tier })));

export const activeSubscriptions = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { activeSubscriptions(): number } } }).__LINGO_FAKE__.db.activeSubscriptions());

/** Über „Dein Stand" → „Üben" ein Modul öffnen. */
export async function openModule(page: Page, id: 'read' | 'listen' | 'write' | 'discover'): Promise<void> {
  await openOverview(page);
  await page.locator(`[data-testid="module"][data-module="${id}"]`).click();
  await page.locator(`[data-screen="${id}"]`).waitFor({ state: 'visible' });
}

/** Alle Fragen beantworten (immer die erste Option); prüft den DOM-Vertrag je Frage. */
export async function answerAll(page: Page, n: number, from = 0): Promise<void> {
  for (let i = from; i < from + n; i++) {
    const q = page.getByTestId('question');
    await expect(q).toHaveAttribute('data-index', String(i));
    // Vor der Wahl: kein Lösungsattribut im DOM.
    await expect(page.locator('[data-testid="option"][data-state]')).toHaveCount(0);
    await page.getByTestId('option').first().click();
    await expect(page.locator('[data-testid="option"][data-state="correct"], [data-testid="option"][data-state="solution"]')).toHaveCount(1);
    await page.getByTestId('next').click();
  }
}

export const entriesOf = (db: Dump, day = DAY): Array<Record<string, unknown>> => ((db[`log/${day}`]?.entries as Array<Record<string, unknown>> | undefined) ?? []);
