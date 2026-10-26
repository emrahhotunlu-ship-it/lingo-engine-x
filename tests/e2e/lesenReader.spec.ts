import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { build } from 'vite';
import { goodItem } from '../unit/read/fixtures';

// Lesen, Paket L4 „Der Leser“ (docs/umbau/lesen-plan.md §2.2). Weil Route und Reiter erst mit Paket L3 verdrahtet werden, hängt ein
// eigener Prüfstand (tests/e2e/readHarness) NUR den Leser samt Nachschlage-Fenster in eine leere Seite. Er wird hier mit Vite gebaut
// (nach test-results/read-harness, nicht Teil von dist/) und über dieselbe nachgebildete Laufzeit (`window.claude`) bedient wie alle
// anderen E2E-Tests. Geprüft wird also die echte Leser-Komponente mit der echten Wort-Antippen-Engine, aber NICHT die Einbindung
// in den App-Rahmen (Reiterleiste, Routen) – die gehört zu L3.

test.describe.configure({ mode: 'serial' });

const ORIGIN = 'https://lingo.artifact.test';
const HARNESS = new URL('../../test-results/read-harness/tests/e2e/readHarness/index.html', import.meta.url);
const RUNTIME_URL = new URL('../.runtime/fake-claude.js', import.meta.url);
const ROOT = new URL('../../', import.meta.url).pathname;

const ART = goodItem();
const ID = ART.id;
const DAY = '2026-10-13';
const TOTAL = ART.paras.flat().length;

type Doc = Record<string, unknown>;
type Theme = 'dark' | 'dim' | 'light';

const entry = (st: Doc = {}): Doc => ({ id: ID, day: DAY, title: ART.title, topic: 'saas', mins: 4, words: 480, st });

test.beforeAll(async () => {
  await build({ root: ROOT, configFile: `${ROOT}tests/e2e/readHarness/vite.config.ts`, logLevel: 'error' });
  if (!existsSync(RUNTIME_URL)) await build({ root: ROOT, configFile: `${ROOT}vite.runtime.config.ts`, logLevel: 'error' });
});

type Opts = { id?: string; lang?: 'de' | 'en'; theme?: Theme; state?: Doc; prefs?: Doc; article?: Doc; width?: number; height?: number; at?: number; noSample?: boolean };

async function open(page: Page, o: Opts = {}): Promise<{ external: string[]; errors: string[] }> {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.setViewportSize({ width: o.width ?? 390, height: o.height ?? 844 });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === ORIGIN && url.pathname === '/') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: readFileSync(HARNESS, 'utf8') });
      return;
    }
    external.push(url.href);
    await route.abort();
  });
  const patch: Record<string, Doc> = {
    [`read/d-${DAY}`]: { v: 1, day: DAY, items: [o.article ?? ART] },
    'read/m-2026-10': { v: 1, items: [entry(o.state)] },
    ...(o.prefs ? { 'read/p': o.prefs } : {}),
  };
  await page.addInitScript((opts: unknown) => {
    (window as unknown as { __LINGO_FAKE_OPTIONS__: unknown }).__LINGO_FAKE_OPTIONS__ = opts;
    // Uhr, die auf Wunsch vorspringt (Lesezeit prüfen, ohne zu warten): `window.__skip(ms)`.
    const real = Date.now.bind(Date);
    let off = 0;
    Date.now = () => real() + off;
    (window as unknown as { __skip: (ms: number) => void }).__skip = (ms) => {
      off += ms;
    };
  }, { seed: 'empty', patch, ...(o.noSample ? { capabilities: { sample: false } } : {}) });
  await page.addInitScript({ content: readFileSync(RUNTIME_URL, 'utf8') });
  await page.goto(`${ORIGIN}/#id=${encodeURIComponent(o.id ?? ID)}&lang=${o.lang ?? 'de'}${o.at ? `&at=${o.at}` : ''}&theme=${o.theme ?? 'dark'}`);
  return { external, errors };
}

const dump = (page: Page): Promise<Record<string, Doc>> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Record<string, Doc> } } }).__LINGO_FAKE__.db.dump());
const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken]);
const ready = async (page: Page) => {
  await expect(page.getByTestId('rdr')).toBeVisible();
  await expect(page.getByTestId('rdr-sentence')).toHaveCount(TOTAL);
};
const sentence = (page: Page, n: number) => page.locator(`[data-testid="rdr-sentence"][data-n="${n}"]`);

test.describe('Leser 390 px, Deutsch, dunkel', () => {
  test('Standard ist Ansicht B: Englisch allein, Deutsch nur auf Tipp; Kopf mit Herkunft und Stand', async ({ page }) => {
    const { errors, external } = await open(page);
    await ready(page);
    await expect(page.getByTestId('rdr')).toHaveAttribute('data-view', 'b');
    await expect(page.getByTestId('rdr-views').locator('[role="radio"][aria-checked="true"]')).toHaveAttribute('data-testid', 'rdr-view-b');
    await expect(page.getByTestId('rdr-title')).toHaveText(ART.title);
    await expect(page.getByTestId('rdr-byclaude')).toContainText('Von Claude geschrieben');
    await expect(page.getByTestId('rdr-byclaude')).toContainText('Wissensstand: Januar 2026');
    await expect(page.getByTestId('rdr-en')).toHaveCount(TOTAL);
    await expect(page.getByTestId('rdr-de')).toHaveCount(0);
    await expect(page.getByTestId('rdr-topic')).toHaveText('SaaS');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Ansicht A zeigt überall Deutsch, C zeigt Deutsch zuerst und Englisch erst auf Tipp; die Wahl wird in read/p gemerkt', async ({ page }) => {
    await open(page);
    await ready(page);
    await page.getByTestId('rdr-view-a').click();
    await expect(page.getByTestId('rdr')).toHaveAttribute('data-view', 'a');
    await expect(page.getByTestId('rdr-de')).toHaveCount(TOTAL);
    await expect(page.getByTestId('rdr-en')).toHaveCount(TOTAL);
    // Deutsch steht UNTER dem Englischen
    const order = await sentence(page, 1).evaluate((li) => {
      const en = li.querySelector('[data-testid="rdr-en"]')?.getBoundingClientRect().top ?? 0;
      const de = li.querySelector('[data-testid="rdr-de"]')?.getBoundingClientRect().top ?? 0;
      return de > en;
    });
    expect(order).toBe(true);

    await page.getByTestId('rdr-view-c').click();
    await expect(page.getByTestId('rdr')).toHaveAttribute('data-view', 'c');
    await expect(page.getByTestId('rdr-de')).toHaveCount(TOTAL);
    await expect(page.getByTestId('rdr-en')).toHaveCount(0);
    await expect(page.locator('[data-testid="rdr-text"] button.lx-word')).toHaveCount(0);
    // Englisch eines Satzes aufdecken: danach antippbar
    await sentence(page, 2).getByTestId('rdr-marker').click();
    await expect(sentence(page, 2).getByTestId('rdr-en')).toBeVisible();
    await expect(sentence(page, 2).locator('button.lx-word').first()).toBeVisible();
    await expect(page.getByTestId('rdr-en')).toHaveCount(1);

    await page.getByTestId('rdr-view-b').click();
    await expect(page.getByTestId('rdr-de')).toHaveCount(0);
    await expect.poll(async () => (await dump(page))['read/p']?.view).toBe('b');
    await page.getByTestId('rdr-view-c').click();
    await expect.poll(async () => (await dump(page))['read/p']?.view).toBe('c');
  });

  test('gemerkte Ansicht aus read/p wird beim Öffnen benutzt', async ({ page }) => {
    await open(page, { prefs: { v: 1, view: 'c' } });
    await ready(page);
    await expect(page.getByTestId('rdr')).toHaveAttribute('data-view', 'c');
  });

  test('Satznummer antippen deckt das Deutsche dieses Satzes auf (live-Bereich, Name nennt die Nummer), nochmal tippen deckt zu; Vorlesen spricht den englischen Satz', async ({ page }) => {
    await open(page);
    await ready(page);
    const marker = sentence(page, 3).getByTestId('rdr-marker');
    await expect(marker).toHaveAttribute('aria-label', 'Deutsch zu Satz 3 anzeigen');
    await expect(marker).toHaveAttribute('aria-expanded', 'false');
    await marker.click();
    await expect(sentence(page, 3).getByTestId('rdr-de')).toContainText('Ist diese Botschaft vage');
    await expect(marker).toHaveAttribute('aria-expanded', 'true');
    await expect(marker).toHaveAttribute('aria-label', 'Deutsch zu Satz 3 verbergen');
    await expect(page.getByTestId('rdr-de')).toHaveCount(1);
    await expect(sentence(page, 3).locator('[aria-live="polite"]')).toHaveCount(1);
    await sentence(page, 3).getByTestId('rdr-speak').click();
    await expect.poll(async () => (await spoken(page)).join(' ')).toContain('When that message is vague');
    await marker.click();
    await expect(page.getByTestId('rdr-de')).toHaveCount(0);
    // „Alle Sätze aufdecken“ und wieder zudecken
    await page.getByTestId('rdr-all').click();
    await expect(page.getByTestId('rdr-de')).toHaveCount(TOTAL);
    await page.getByTestId('rdr-all').click();
    await expect(page.getByTestId('rdr-de')).toHaveCount(0);
  });

  test('Aufdecken zeichnet nur diese eine Zeile neu (kein Neuzeichnen aller Sätze)', async ({ page }) => {
    await open(page);
    await ready(page);
    const touched = await page.evaluate(async () => {
      const list = document.querySelector('[data-testid="rdr-text"]');
      const rows = new Set<string>();
      const mo = new MutationObserver((recs) => {
        for (const r of recs) {
          const li = (r.target instanceof Element ? r.target : r.target.parentElement)?.closest('li[data-n]');
          if (li) rows.add(li.getAttribute('data-n') ?? '');
        }
      });
      if (list) mo.observe(list, { childList: true, subtree: true, attributes: true, characterData: true });
      document.querySelector<HTMLButtonElement>('li[data-n="7"] [data-testid="rdr-marker"]')?.click();
      await new Promise((r) => setTimeout(r, 300));
      mo.disconnect();
      return [...rows];
    });
    expect(touched).toEqual(['7']);
  });

  test('Wort antippen öffnet das Nachschlagen; „Als Karte speichern“ legt eine Karte mit dem Artikelsatz als Ursprung an (src read, origin ref = Artikel)', async ({ page }) => {
    const { errors } = await open(page);
    await ready(page);
    await sentence(page, 6).locator('button.lx-word', { hasText: /^forecast$/ }).click();
    await expect(page.getByTestId('lookup')).toBeVisible();
    await page.getByTestId('lk-save').click();
    await expect(page.getByTestId('lk-saved')).toBeVisible();
    await expect.poll(async () => (await dump(page))['vocab/forecast']?.src).toBe('read');
    const card = (await dump(page))['vocab/forecast']!;
    expect(card).toMatchObject({ src: 'read', origin: { kind: 'read', ref: ID, title: ART.title } });
    expect(String(card.ex)).toContain('[forecast]');
    expect(String(card.ex)).toContain('Per-seat pricing is easy to');
    expect(errors).toEqual([]);
  });

  test('Schlüsselwörter: Karte mit dem Satz des Artikels, danach Zustand „Gespeichert“ statt Knopf; schon vorhandene Karte zeigt „Schon da“ und wird nicht doppelt angelegt', async ({ page }) => {
    const { errors } = await open(page);
    await ready(page);
    // erst über das Wort-Antippen speichern, dann über die Schlüsselwörter: keine zweite Karte
    await sentence(page, 6).locator('button.lx-word', { hasText: /^forecast$/ }).click();
    await page.getByTestId('lk-save').click();
    await expect(page.getByTestId('lk-saved')).toBeVisible();
    await page.getByTestId('lk-close').click();

    const kws = page.getByTestId('rdr-kw');
    await expect(kws).toHaveCount(5);
    await kws.first().scrollIntoViewIfNeeded();
    const tiers = page.locator('[data-testid="rdr-kw"][data-w="tiers"]');
    await tiers.getByTestId('rdr-kw-save').click();
    await expect(tiers.getByTestId('rdr-kw-saved')).toHaveText('Gespeichert');
    await expect(tiers.getByTestId('rdr-kw-save')).toHaveCount(0);
    const card = (await dump(page))['vocab/tiers']!;
    expect(card).toMatchObject({ src: 'read', origin: { kind: 'read', ref: ID, title: ART.title }, level: 'C1', de: 'Stufen' });
    expect(String(card.ex)).toBe('Many teams respond by offering three [tiers], because a middle option makes the premium plan look reasonable by comparison.');

    const fc = page.locator('[data-testid="rdr-kw"][data-w="forecast"]');
    await fc.getByTestId('rdr-kw-save').click();
    await expect(fc.getByTestId('rdr-kw-saved')).toHaveText('Schon da');
    const cards = Object.keys(await dump(page)).filter((p) => p.startsWith('vocab/'));
    expect(cards.sort()).toEqual(['vocab/forecast', 'vocab/tiers']);
    expect(errors).toEqual([]);
  });

  test('Prüffragen: Rückmeldung mit Was tun · Wozu · Deine Antwort · Richtig · Warum, auch bei richtiger Antwort; keine Wertung', async ({ page }) => {
    await open(page);
    await ready(page);
    const qs = page.getByTestId('rdr-q');
    await expect(qs).toHaveCount(2);
    await qs.first().scrollIntoViewIfNeeded();
    // Was tun und Wozu stehen einmal im Kopf der Karte, nicht unter jeder Frage (Kap. 15).
    const raster = page.getByTestId('rdr-check-raster');
    await expect(page.getByTestId('rdr-check')).toContainText('Was tun:');
    await expect(raster).toContainText('Wozu:');
    await expect(raster).toHaveCount(1);
    await expect(qs.first()).not.toContainText('Was tun:');
    // falsche Antwort
    await qs.first().getByTestId('rdr-opt').nth(0).click();
    const fb = qs.first().getByTestId('rdr-q-feedback');
    await expect(fb).toContainText('Nicht ganz.');
    await expect(fb).toContainText('Deine Antwort: They always dislike the product.');
    await expect(fb).toContainText('Richtig ist: They may have chosen a plan that did not fit their needs.');
    await expect(fb).toContainText('Warum: Der Text sagt, dass frühe Kündigungen');
    await expect(qs.first().getByTestId('rdr-opt').nth(2)).toBeDisabled();
    // richtige Antwort: Begründung kommt trotzdem
    await qs.nth(1).getByTestId('rdr-opt').nth(0).click();
    const fb2 = qs.nth(1).getByTestId('rdr-q-feedback');
    await expect(fb2).toContainText('Richtig.');
    // „Richtig ist“ steht nur bei falscher Antwort (die richtige Option ist schon grün markiert); das Warum kommt immer.
    await expect(fb2).not.toContainText('Richtig ist:');
    await expect(fb2).toContainText('Warum: Kleine Tests mit wenigen Besuchern');
    await expect(qs.nth(1)).toHaveAttribute('data-answered', 'right');
  });

  test('Prüffragen per Tastatur: Ziffer 1 bis 3 wählt die Antwort der fokussierten Frage; Was tun und Wozu bleiben stehen', async ({ page }) => {
    await open(page);
    await ready(page);
    const qs = page.getByTestId('rdr-q');
    await qs.first().getByTestId('rdr-opt').nth(1).focus();
    await page.keyboard.press('1');
    await expect(qs.first()).toHaveAttribute('data-answered', /right|wrong/);
    await expect(qs.first().getByTestId('rdr-opt').nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('rdr-check-raster')).toContainText('Was tun:');
    await expect(page.getByTestId('rdr-check-raster')).toContainText('Wozu:');
    await expect(qs.nth(1)).not.toHaveAttribute('data-answered', /.+/);
  });

  test('Abschluss: ein Hauptknopf am Ende führt zurück zur Liste', async ({ page }) => {
    await open(page);
    await ready(page);
    const end = page.getByTestId('rdr-end');
    await end.scrollIntoViewIfNeeded();
    await expect(page.getByTestId('rdr-end-next')).toBeVisible();
    await page.getByTestId('rdr-end-next').click();
    await expect(page.locator('body')).toHaveAttribute('data-listed', '1');
  });

  test('Über „Weiterlesen“ geöffnet (Sprung zum Satz): keine Zwischenkarte, Satz steht oben', async ({ page }) => {
    await open(page, { state: { sec: 120, pos: 14, open: 3 }, at: 14 });
    await ready(page);
    await expect(page.getByTestId('rdr-resume')).toHaveCount(0);
    await expect.poll(async () => (await sentence(page, 14).boundingBox())?.y ?? 9999).toBeLessThan(300);
  });

  test('ungültige Prüffragen fehlen still: kein Check-Block, Artikel bleibt lesbar', async ({ page }) => {
    await open(page, { article: { ...ART, check: undefined } });
    await ready(page);
    await expect(page.getByTestId('rdr-check')).toHaveCount(0);
    await expect(page.getByTestId('rdr-keywords')).toBeVisible();
  });

  test('Lesezustand: Zeit, Position und „gelesen“ werden einmal beim Ausblenden geschrieben, nie beim Bildlauf; Pflicht/Serie/Profil bleiben unberührt', async ({ page }) => {
    await open(page);
    await ready(page);
    await sentence(page, 4).getByTestId('rdr-marker').click();
    await page.getByTestId('rdr-keywords').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    // viel scrollen: kein Schreiben
    await page.mouse.wheel(0, -3000);
    await page.mouse.wheel(0, 6000);
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { writes(): unknown[] } } }).__LINGO_FAKE__.db.writes().length);
    await page.mouse.wheel(0, -500);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(200);
    const mid = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { writes(): unknown[] } } }).__LINGO_FAKE__.db.writes().length);
    expect(mid).toBe(before);
    expect(((await dump(page))['read/m-2026-10']?.items as Array<{ st?: Doc }>)[0]?.st).toEqual({});

    await page.evaluate(() => {
      (window as unknown as { __skip: (ms: number) => void }).__skip(70_000);
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(async () => ((await dump(page))['read/m-2026-10']?.items as Array<{ st?: Doc }>)[0]?.st?.done).toBe(true);
    const st = ((await dump(page))['read/m-2026-10']?.items as Array<{ st: Doc }>)[0]!.st;
    expect(st.sec as number).toBeGreaterThanOrEqual(70);
    expect(st.sec as number).toBeLessThanOrEqual(1200);
    expect(st).toMatchObject({ pos: TOTAL, open: 1, done: true });
    expect(typeof st.t0).toBe('number');
    const all = await dump(page);
    expect(Object.keys(all).filter((p) => p.startsWith('app/'))).toEqual([]);
    await page.evaluate(() => Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }));
  });

  test('Weiter bei Satz N: Hinweis mit Sprung an die Stelle; fertig gelesen zeigt „Gelesen“ und keinen Hinweis', async ({ page }) => {
    await open(page, { state: { sec: 120, pos: 14, open: 3 } });
    await ready(page);
    await expect(page.getByTestId('rdr-resume')).toContainText('Weiter bei Satz 14');
    await page.getByTestId('rdr-resume-go').click();
    await expect(page.getByTestId('rdr-resume')).toHaveCount(0);
    await expect.poll(async () => (await sentence(page, 14).boundingBox())?.y ?? 9999).toBeLessThan(200);
  });

  test('bereits gelesen: Zustand „Gelesen“ im Kopf, kein Weiterlesen-Hinweis', async ({ page }) => {
    await open(page, { state: { sec: 300, pos: TOTAL, done: true } });
    await ready(page);
    await expect(page.getByTestId('rdr-done')).toHaveText('Gelesen');
    await expect(page.getByTestId('rdr-resume')).toHaveCount(0);
  });

  test('unbekannte Kennung: ruhiger Hinweis statt Absturz', async ({ page }) => {
    const { errors } = await open(page, { id: 'a-2026-10-13-9-zzzzzz' });
    await expect(page.getByTestId('rdr-notfound')).toHaveText('Diesen Artikel gibt es nicht mehr.');
    expect(errors).toEqual([]);
  });

  test('aufgeräumter Artikel (paras: []) zeigt Titel, Wörter und den Hinweis, ohne Absturz', async ({ page }) => {
    const { errors } = await open(page, { article: { ...ART, paras: [] } });
    await expect(page.getByTestId('rdr-removed')).toContainText('gelöscht, um Platz zu sparen');
    await expect(page.getByTestId('rdr-keywords')).toBeVisible();
    await expect(page.getByTestId('rdr-kw-save')).toHaveCount(0);
    await expect(page.getByTestId('rdr-kw-nosentence').first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Layout: kein Querscrollen, Touch-Ziele mindestens 44 px, Zeilenlänge begrenzt, Fließtext mindestens 17 px', async ({ page }) => {
    await open(page);
    await ready(page);
    const m = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const small: string[] = [];
      for (const sel of ['[data-testid="rdr-marker"]', '[data-testid="rdr-views"] [role="radio"]', '[data-testid="rdr-all"]']) {
        for (const el of Array.from(document.querySelectorAll(sel))) {
          const r = el.getBoundingClientRect();
          if (r.width < 43.5 || r.height < 43.5) small.push(`${sel} ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      const en = document.querySelector('[data-testid="rdr-en"]');
      const fs = en ? parseFloat(getComputedStyle(en).fontSize) : 0;
      const w = document.querySelector('[data-testid="rdr"]')?.getBoundingClientRect().width ?? 0;
      return { overflow: document.documentElement.scrollWidth - vw, small, fs, w, vw };
    });
    expect(m.overflow).toBeLessThanOrEqual(0);
    expect(m.small).toEqual([]);
    expect(m.fs).toBeGreaterThanOrEqual(17);
    expect(m.w).toBeLessThanOrEqual(m.vw);
    // Schlüsselwort-Knopf
    await page.getByTestId('rdr-keywords').scrollIntoViewIfNeeded();
    const h = await page.getByTestId('rdr-kw-save').first().boundingBox();
    expect(h!.height).toBeGreaterThanOrEqual(43.5);
  });
});

test.describe('Leser Desktop 1440', () => {
  test('lange Zeilen werden begrenzt (höchstens etwa 66 Zeichen Breite), Text bleibt in der Mitte lesbar', async ({ page }) => {
    await open(page, { width: 1440, height: 900 });
    await ready(page);
    const w = await page.getByTestId('rdr').evaluate((el) => el.getBoundingClientRect().width);
    expect(w).toBeLessThanOrEqual(66 * 12 * 1.15);
    expect(w).toBeGreaterThan(400);
  });
});

test.describe('Leser Englisch', () => {
  test('Oberfläche Englisch: Ansichten, Zustände und Rückmeldungen auf Englisch (US)', async ({ page }) => {
    await open(page, { lang: 'en' });
    await ready(page);
    await expect(page.getByTestId('rdr-view-a')).toHaveText('EN + DE');
    await expect(page.getByTestId('rdr-view-b')).toHaveText('EN only');
    await expect(page.getByTestId('rdr-view-c')).toHaveText('DE first');
    await expect(page.getByTestId('rdr-byclaude')).toContainText('Written by Claude');
    await expect(sentence(page, 2).getByTestId('rdr-marker')).toHaveAttribute('aria-label', 'Show German for sentence 2');
    await expect(page.getByTestId('rdr-meta')).toContainText('min');
  });
});

// Kartenqualität (26.10.2026, Emrahs Meldung „adaptive attempts“): Eine freie Wortgruppe aus dem Artikel wird nicht als Karte gespeichert.
const FREE_SENT = 'In the red-team report, the model was jailbroken across 15 adaptive attempts.';
const ADAPT_SENT = 'Engineers had to adapt to unfamiliar hardware within a single week.';
const FREE_ART: Doc = {
  ...ART,
  paras: ART.paras.map((p, i) => (i === 0 ? p.map((x, j) => (j === 0 ? { ...x, e: FREE_SENT } : j === 1 ? { ...x, e: ADAPT_SENT } : x)) : p)),
  keyWords: [
    { w: 'adaptive attempts', de: 'adaptive Versuche', i: [0, 0] },
    { w: 'adapt to unfamiliar hardware', de: 'sich an fremde Hardware anpassen', i: [0, 1] },
    ...(ART.keyWords ?? []).slice(0, 3),
  ],
};
const unitCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string | null }> } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'lexical-unit-check').length);
const kw = (page: Page, w: string) => page.locator(`[data-testid="rdr-kw"][data-w="${w}"]`);

test.describe('Kartenqualität: nur feste Wendungen als Karte', () => {
  test('mit Claude: freie Gruppe → Hinweis mit fester Wendung dazu, keine Karte; Einzelwort als Ausweg; Lehrer-Sperrliste und feste Einträge ohne Aufruf', async ({ page }) => {
    const { errors } = await open(page, { article: FREE_ART });
    await ready(page);
    const free = kw(page, 'adaptive attempts');
    await free.scrollIntoViewIfNeeded();
    await free.getByTestId('rdr-kw-save').click();
    const note = free.getByTestId('rdr-kw-notunit');
    await expect(note).toBeVisible();
    await expect(note).toHaveAttribute('data-by', 'claude');
    await expect(note).toContainText('Richtiges Englisch, aber keine feste Wendung. Darum keine Karte.');
    await expect(free.getByTestId('rdr-kw-better')).toContainText('Feste Wendung dazu: adaptive attack');
    await expect(note).toContainText('Einschätzung von Claude');
    // „adaptive“ steht in keinem Wörterbuch: kein Einzelwort-Ausweg ohne gesicherte Bedeutung.
    await expect(free.getByTestId('rdr-kw-single')).toHaveCount(0);
    await expect(free.getByTestId('rdr-kw-save')).toHaveCount(0);

    const grp = kw(page, 'adapt to unfamiliar hardware');
    await grp.getByTestId('rdr-kw-save').click();
    await expect(grp.getByTestId('rdr-kw-notunit')).toBeVisible();
    // Lehrer-Sperrliste (units.json `free`): Urteil der Regel, kein Claude-Aufruf, die feste Einheit darin als Vorschlag.
    await expect(grp.getByTestId('rdr-kw-notunit')).toHaveAttribute('data-by', 'rule');
    await expect(grp.getByTestId('rdr-kw-better')).toContainText('Feste Wendung dazu: adapt to');
    await grp.getByTestId('rdr-kw-single').click();
    await expect(grp.getByTestId('rdr-kw-single-saved')).toHaveText('„adapt“ gespeichert');

    // feste bzw. einzelne Wörter: wie bisher, ohne Claude
    await kw(page, 'tiers').getByTestId('rdr-kw-save').click();
    await expect(kw(page, 'tiers').getByTestId('rdr-kw-saved')).toHaveText('Gespeichert');

    const db = await dump(page);
    const vocab = Object.keys(db).filter((k) => k.startsWith('vocab/')).sort();
    expect(vocab).toEqual(['vocab/adapt', 'vocab/tiers']);
    expect(db['vocab/adapt']).toMatchObject({ word: 'to adapt', src: 'read', origin: { kind: 'read', ref: ID } });
    expect(String(db['vocab/adapt']?.ex)).toBe('Engineers had to [adapt] to unfamiliar hardware within a single week.');
    expect(await unitCalls(page)).toBe(1);
    expect(errors).toEqual([]);
  });

  test('ohne Claude entscheidet die Prüfung: freie Gruppe wird nicht gespeichert, kein Aufruf', async ({ page }) => {
    const { errors } = await open(page, { article: FREE_ART, noSample: true, lang: 'en' });
    await ready(page);
    const free = kw(page, 'adaptive attempts');
    await free.scrollIntoViewIfNeeded();
    await free.getByTestId('rdr-kw-save').click();
    const note = free.getByTestId('rdr-kw-notunit');
    await expect(note).toHaveAttribute('data-by', 'rule');
    await expect(note).toContainText('Correct English, but not a set phrase, so no card.');
    await expect(free.getByTestId('rdr-kw-better')).toContainText('Related set phrase: adaptive attacks');
    await expect(note).not.toContainText('Claude');
    expect(Object.keys(await dump(page)).filter((k) => k.startsWith('vocab/'))).toEqual([]);
    expect(await unitCalls(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  for (const theme of ['dark', 'light'] as const) {
    test(`axe · Hinweis „keine feste Wendung“ · ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, { article: FREE_ART, theme });
      await ready(page);
      for (const w of ['adaptive attempts', 'adapt to unfamiliar hardware']) {
        await kw(page, w).scrollIntoViewIfNeeded();
        await kw(page, w).getByTestId('rdr-kw-save').click();
        await expect(kw(page, w).getByTestId('rdr-kw-notunit')).toBeVisible();
      }
      const box = await kw(page, 'adapt to unfamiliar hardware').getByTestId('rdr-kw-single').boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      const res = await new AxeBuilder({ page }).include('[data-testid="rdr-keywords"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});

test.describe('Barrierefreiheit (axe)', () => {
  for (const theme of ['dark', 'dim', 'light'] as const) {
    for (const width of [390, 1440]) {
      test(`axe · Leser · ${theme} · ${width}px`, async ({ page }) => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await open(page, { theme, width, height: 900 });
        await ready(page);
        await sentence(page, 2).getByTestId('rdr-marker').click();
        await page.getByTestId('rdr-q').first().scrollIntoViewIfNeeded();
        await page.getByTestId('rdr-q').first().getByTestId('rdr-opt').nth(0).click();
        await page.waitForTimeout(400);
        const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
        expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      });
    }
  }
});

// Bilder für die Prüfung: nur mit READER_SHOTS=<Ordner> (sonst übersprungen).
const SHOTS = process.env.READER_SHOTS;
test.describe('Bilder', () => {
  test.skip(!SHOTS, 'READER_SHOTS nicht gesetzt');
  const sets: Array<{ name: string; theme: Theme; width: number; height: number }> = [
    { name: 'dark-390', theme: 'dark', width: 390, height: 844 },
    { name: 'light-390', theme: 'light', width: 390, height: 844 },
    { name: 'light-1440', theme: 'light', width: 1440, height: 900 },
  ];
  for (const s of sets) {
    test(`Bilder ${s.name}`, async ({ page }) => {
      mkdirSync(SHOTS!, { recursive: true });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, { theme: s.theme, width: s.width, height: s.height });
      await ready(page);
      const shot = (n: string) => page.screenshot({ path: `${SHOTS}/${s.name}-${n}.png` });
      await page.waitForTimeout(400);
      await shot('view-b');
      await sentence(page, 2).getByTestId('rdr-marker').click();
      await sentence(page, 5).getByTestId('rdr-marker').click();
      await page.waitForTimeout(300);
      await shot('view-b-revealed');
      await page.getByTestId('rdr-view-a').click();
      await page.waitForTimeout(300);
      await shot('view-a');
      await page.getByTestId('rdr-view-c').click();
      await sentence(page, 2).getByTestId('rdr-marker').click();
      await page.waitForTimeout(300);
      await shot('view-c');
      await page.getByTestId('rdr-view-b').click();
      await sentence(page, 6).locator('button.lx-word', { hasText: /^forecast$/ }).click();
      await expect(page.getByTestId('lookup')).toBeVisible();
      await page.waitForTimeout(600);
      await shot('word-popover');
      await page.getByTestId('lk-close').click();
      await page.getByTestId('rdr-keywords').scrollIntoViewIfNeeded();
      await page.locator('[data-testid="rdr-kw"][data-w="tiers"]').getByTestId('rdr-kw-save').click();
      await page.waitForTimeout(400);
      await page.getByTestId('rdr-keywords').scrollIntoViewIfNeeded();
      await shot('keywords');
      await page.getByTestId('rdr-q').first().scrollIntoViewIfNeeded();
      await page.getByTestId('rdr-q').first().getByTestId('rdr-opt').nth(0).click();
      await page.waitForTimeout(300);
      await shot('check');
    });
  }
});
