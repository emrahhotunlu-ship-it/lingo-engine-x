import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { InstallOptions } from '../../src/platform/dev/install';
import { WHATS_NEW_KEY, WHATS_NEW_VERSION } from '../../src/features/system/whatsNew';

// Lädt den Produktions-Build dist/index.html unter einer https-Adresse und spielt den
// Entwicklungs-Adapter von außen ein (CLAUDE.md A7). Jede andere Anfrage wird
// abgefangen, protokolliert und abgebrochen – so beweist jeder Test nebenbei, dass
// die App nichts von fremden Hosts lädt (Kap. 12, Plattform-Test).

export const ORIGIN = 'https://lingo.artifact.test';
const HTML = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
const RUNTIME = readFileSync(new URL('../.runtime/fake-claude.js', import.meta.url), 'utf8');

/** Stichtag der Testdaten: Sonntag, 20.09.2026, 21:00 Uhr in Berlin. */
export const SEED_EVENING = '2026-09-20T21:00:00+02:00';
export const MIGRATED = { 'app/schema': { version: 1, cutover: '2026-09-20', migratedAt: Date.parse('2026-09-20T20:30:00+02:00'), app: 'lingo-engine-x' } };

export type Theme = 'dark' | 'dim' | 'light';
export type Lang = 'de' | 'en';

export type BootOptions = {
  /** Optionen des Entwicklungs-Adapters; `false` = gar keine Laufzeit (wie eine gespeicherte Kopie). */
  fake?: InstallOptions | false;
  theme?: Theme;
  lang?: Lang;
  migrated?: boolean;
  now?: string;
  /** Einträge für localStorage vor dem Start (z. B. `sw2:`-Kopien der alten App). */
  localStorage?: Record<string, string>;
  /** `true` = der Hinweis „Was ist neu" (M20) erscheint wie nach einem Update. */
  whatsNew?: boolean;
};

export type Booted = { external: string[]; errors: string[] };

export async function boot(page: Page, opts: BootOptions = {}): Promise<Booted> {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    if (url === `${ORIGIN}/`) {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: HTML });
      return;
    }
    external.push(url);
    await route.abort();
  });
  await page.clock.setFixedTime(new Date(opts.now ?? SEED_EVENING));
  // „Was ist neu" (M20) gilt in Tests als gesehen – außer ein Test prüft ihn ausdrücklich.
  if (!opts.whatsNew) {
    await page.addInitScript(([k, v]: [string, string]) => window.localStorage.setItem(k, v), [WHATS_NEW_KEY, WHATS_NEW_VERSION] as [string, string]);
  }
  if (opts.localStorage) {
    await page.addInitScript((entries: Record<string, string>) => {
      for (const [k, v] of Object.entries(entries)) window.localStorage.setItem(k, v);
    }, opts.localStorage);
  }
  if (opts.fake !== false) {
    const fake: InstallOptions = { ...(opts.fake ?? {}) };
    const patch = { ...(fake.patch ?? {}) };
    if (opts.migrated) Object.assign(patch, MIGRATED);
    if (opts.theme || opts.lang) {
      patch['app/profile'] = { ...(patch['app/profile'] ?? {}), ...(opts.lang ? { lang: opts.lang } : {}), ...(opts.theme ? { theme: { m: opts.theme, p: 'ocean' } } : {}) };
    }
    fake.patch = patch;
    await page.addInitScript((o: InstallOptions) => {
      window.__LINGO_FAKE_OPTIONS__ = o;
    }, fake);
    await page.addInitScript({ content: RUNTIME });
  }
  await page.goto(`${ORIGIN}/`);
  return { external, errors };
}

/** Wartet, bis ein Bildschirm fertig eingeblendet ist. */
export async function screen(page: Page, name: 'loading' | 'nodb' | 'offline' | 'migration' | 'overview' | 'today' | 'trainer' | 'speak' | 'roleplay' | 'mail' | 'playbook' | 'pitch' | 'grammarSession' | 'vtest' | 'learn'): Promise<void> {
  await page.locator(`[data-screen="${name}"]`).waitFor({ state: 'visible' });
  await page.waitForFunction((n) => {
    const el = document.querySelector(`[data-screen="${n}"]`);
    return !!el && getComputedStyle(el).opacity === '1';
  }, name);
}

/** Start ist „Heute"; „Dein Stand" liegt eine Navigation weiter. */
export async function openOverview(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('tab-overview').click();
  await screen(page, 'overview');
}

/**
 * Einstellungen öffnen (UX-Beratung 27.09.): das Zahnrad sitzt auf „Stand" (und auf den
 * System-Bildschirmen ohne Reiter). Steht es nicht im Bild, erst zum Reiter „Stand".
 */
export async function openSettings(page: Page): Promise<void> {
  const gear = page.getByTestId('open-settings');
  if (!(await gear.isVisible())) {
    await page.getByTestId('tab-overview').click();
    await screen(page, 'overview');
  }
  await gear.click();
}

/** Reiter „Sprechen" mit einem Bereich öffnen: Szenen · Business · Preply (UX-Beratung Nr. 7). */
export async function openSpeak(page: Page, seg: 'scenes' | 'business' | 'preply' = 'scenes'): Promise<void> {
  await page.getByTestId('tab-speak').click();
  await screen(page, 'speak');
  if (seg !== 'scenes' || (await page.getByTestId('speak-hub').getAttribute('data-seg')) !== 'scenes') await page.getByTestId(`speak-seg-${seg}`).click();
  await page.locator(`[data-testid="speak-hub"][data-seg="${seg}"]`).waitFor();
}

/** Prüfungen, die auf jedem Bildschirm gelten (Kap. 12). */
export async function layoutProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const text = document.body.innerText;
    for (const bad of ['undefined', 'NaN']) if (new RegExp(`\\b${bad}\\b`).test(text)) out.push(`Text enthält „${bad}"`);
    if (text.includes('[object Object]')) out.push('Text enthält „[object Object]"');
    const ph = /\{\w+\}/.exec(text);
    if (ph) out.push(`Unersetzter Platzhalter ${ph[0]}`);
    const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`Querscrollen: ${document.documentElement.scrollWidth} > ${vw}`);
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"], .sr-only')) continue;
      // Waagrecht wischbare Leisten (z. B. Wendungs-Chips, Phase 3) dürfen über den Rand laufen.
      if (el.closest('[data-hscroll]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 1 || r.left < -1) out.push(`Ragt aus dem Bild: <${el.tagName.toLowerCase()} class="${el.className}"> (${Math.round(r.left)}–${Math.round(r.right)})`);
      const clips = ['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflowY);
      const hasText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim());
      if (clips && hasText && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 2)) out.push(`Abgeschnittener Text: „${el.textContent?.trim().slice(0, 40)}"`);
    }
    return [...new Set(out)].slice(0, 10);
  });
}
