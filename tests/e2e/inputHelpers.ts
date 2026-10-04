import { expect, type Page } from '@playwright/test';
import { routeToString } from '../../src/app/router/deeplink';
import { openSpeak, ORIGIN } from './fixtures';

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

/** Laufende Abos je Ziel (Dokumentpfad bzw. `<Sammlung>/*`), sortiert. */
export const activePaths = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { activePaths(): string[] } } }).__LINGO_FAKE__.db.activePaths());

/** Abos, sobald sie sich nicht mehr ändern (zwei gleiche Lesungen im Abstand von 300 ms). */
export async function settledPaths(page: Page): Promise<string[]> {
  let prev = await activePaths(page);
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    const cur = await activePaths(page);
    if (JSON.stringify(cur) === JSON.stringify(prev)) return cur;
    prev = cur;
  }
  return prev;
}

/**
 * „Lesen“ öffnen (Lesen, Hören, Entdecken; Route `library`). Seit 04.10.2026 (Fokus Vokabeln und Grammatik) gibt es
 * dafür keinen Reiter und keinen Einstieg mehr – nur den Deep-Link, der beim Start gelesen wird. Der Helfer lädt die
 * Seite deshalb mit `#go=library` neu (der Testbestand wird dabei wie beim Start neu eingespielt).
 */
export async function openLearn(page: Page): Promise<void> {
  // Nach dem Schließen einer Einheit steht man schon wieder in „Lesen“ (Rückweg zur Herkunft).
  if (!(await page.locator('[data-screen="library"]').isVisible())) {
    await page.goto(`${ORIGIN}/#go=${encodeURIComponent(routeToString({ name: 'library' }))}`);
    await page.reload();
  }
  await page.locator('[data-screen="library"]').waitFor({ state: 'visible' });
}

/**
 * Ein Modul öffnen: Lesen, Hören (Text/Hörtext des Tages) und Entdecken („Alle Beiträge“) über die
 * Seite „Lesen“ (Deep-Link, siehe `openLearn`); Schreiben liegt im Neubau unter „Sprechen · Schreiben“ (Einstieg `hub-write`).
 */
export async function openModule(page: Page, id: 'read' | 'listen' | 'write' | 'discover'): Promise<void> {
  if (id === 'write') {
    // Nach einem Neuladen mit Deep-Link öffnet die App die Schreibaufgabe selbst.
    if (page.url().includes('#go=write')) {
      const open = await page
        .locator('[data-screen="write"]')
        .waitFor({ state: 'visible', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (open) return;
    }
    await openSpeak(page, 'write');
    const entry = page.getByTestId('hub-write').first();
    if (await entry.count()) await entry.click();
    // Bis P5 die Einstiege des Platzes `write` zeigt: Deep-Link (wird nur beim Start gelesen).
    else {
      await page.goto(`${ORIGIN}/#go=${encodeURIComponent(routeToString({ name: 'write', ctx: 'extra' }))}`);
      await page.reload();
    }
    await page.locator('[data-screen="write"]').waitFor({ state: 'visible' });
    return;
  }
  await openLearn(page);
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

/** Zurück zu „Heute": Einheiten schließen (✕, zurück zur Herkunft), sonst über den Reiter – je Schritt warten, bis der Wechsel fertig ist. */
export async function backToToday(page: Page): Promise<void> {
  const screens = () => page.locator('main [data-screen]').evaluateAll((els) => els.map((e) => e.getAttribute('data-screen') ?? ''));
  for (let i = 0; i < 4; i++) {
    // Erst warten, bis genau ein Bildschirm da ist (der alte blendet sonst noch aus).
    await expect.poll(async () => (await screens()).length).toBe(1);
    const [cur] = await screens();
    if (cur === 'today') return;
    const close = page.locator(`main [data-screen="${cur}"] [data-testid="unit-close"]`).first();
    if (await close.count()) await close.click();
    else {
      // Seiten ohne Reiter (Lesen, Sprechen; seit 04.10.2026) haben oben „‹ Zurück“ – die Reiterleiste unten kann am
      // Handy noch von einer Meldung („Gespeichert …“) überdeckt sein.
      const back = page.locator(`main [data-screen="${cur}"] [data-testid="page-back"]`).first();
      if (await back.count()) await back.click();
      else await page.getByTestId('tab-today').click();
    }
    await expect.poll(async () => (await screens()).join(',')).not.toBe(cur);
  }
  await page.locator('[data-screen="today"]').waitFor({ state: 'visible' });
}

export type InputScreen = 'lesen' | 'hoeren' | 'schreiben' | 'entdecken' | 'beitrag' | 'verlauf';

/** Alle Phase-4-Bildschirme nacheinander öffnen; `visit` prüft jeden (Seite ist ruhig). Start und Ende: Heute. */
export async function inputTour(page: Page, visit: (name: InputScreen) => Promise<void>): Promise<void> {
  const stops: Array<[InputScreen, () => Promise<void>]> = [
    ['lesen', () => openModule(page, 'read')],
    ['hoeren', () => openModule(page, 'listen')],
    ['schreiben', () => openModule(page, 'write')],
    ['entdecken', () => openModule(page, 'discover')],
    [
      'beitrag',
      async () => {
        await openModule(page, 'discover');
        await page.locator('[data-testid="feed-item"][data-id="vida-ey"]').click();
        await expect(page.getByTestId('unit')).toHaveAttribute('data-state', 'prep');
        await page.getByTestId('next').click();
        await expect(page.getByTestId('unit')).toHaveAttribute('data-state', 'take');
        await page.getByTestId('gist').waitFor();
      },
    ],
    [
      'verlauf',
      async () => {
        // Verlauf steht oben rechts im Bildschirm selbst (UX-Beratung Nr. 8).
        await openModule(page, 'write');
        await page.getByTestId('open-history').click();
        await page.getByTestId('history').waitFor();
      },
    ],
  ];
  for (const [name, go] of stops) {
    await go();
    await page.waitForTimeout(300);
    await visit(name);
    await backToToday(page);
  }
}
