import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { InstallOptions } from '../../src/platform/dev/install';
import { WHATS_NEW_KEY, WHATS_NEW_VERSION } from '../../src/features/system/whatsNew';
import { routeToString } from '../../src/app/router/deeplink';
import type { Route } from '../../src/app/router/types';
import { TABS, type TabId } from '../../src/app/shell/tabs';

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
  /** Adress-Anker beim Start (ohne `#`), z. B. `go=trainer%3Fround%3Dextra` (siehe `bootAt`). */
  hash?: string;
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
  await page.goto(`${ORIGIN}/${opts.hash ? `#${opts.hash}` : ''}`);
  return { external, errors };
}

/**
 * Start direkt an einer Route (Neubau §2.3): `#go=<route>` wird einmal beim Start gelesen, nie
 * geschrieben. Übungen mit im Klick gebauter Sitzung kehren ohne Sitzung zur Herkunft zurück.
 */
export async function bootAt(page: Page, route: Route, opts: BootOptions = {}): Promise<Booted> {
  return boot(page, { migrated: true, ...opts, hash: `go=${encodeURIComponent(routeToString(route))}` });
}

/** Wartet, bis ein Bildschirm fertig eingeblendet ist (Routenname oder Systemzustand). */
export async function screen(page: Page, name: 'loading' | 'nodb' | 'offline' | 'migration' | Route['name']): Promise<void> {
  await page.locator(`[data-screen="${name}"]`).waitFor({ state: 'visible' });
  await page.waitForFunction((n) => {
    const el = document.querySelector(`[data-screen="${n}"]`);
    return !!el && getComputedStyle(el).opacity === '1';
  }, name);
}

/** Wurzel-Bildschirm eines Reiters (aus `src/app/shell/tabs.ts`). */
export const tabRoot = (id: TabId): Route['name'] => (TABS.find((t) => t.id === id) ?? TABS[0]).root.name;

/**
 * Reiter öffnen und auf seiner Wurzel stehen (Neubau §2.4). Ein fremder Reiter zeigt seinen
 * Stapel; ein zweiter Tipp auf den nun aktiven Reiter führt zur Wurzel.
 */
export async function openTab(page: Page, id: TabId): Promise<void> {
  const root = tabRoot(id);
  const btn = page.getByTestId(`tab-${id}`);
  await btn.click();
  if ((await btn.getAttribute('aria-current')) === 'page' && !(await page.locator(`[data-screen="${root}"]`).isVisible())) await btn.click();
  await screen(page, root);
}

/**
 * Einstieg per Test-ID öffnen (`hub-course`, `hub-grammar`, `hub-drill-*` …): probiert die Reiter
 * aus der Reiterleiste der Reihe nach, bis der Einstieg sichtbar ist – unabhängig von der Zahl der
 * Reiter. Einstiege, die erst nach dem Laden erscheinen, wartet der letzte Reiter ab.
 */
export async function openEntry(page: Page, testId: string): Promise<void> {
  await page.getByTestId('tabbar').waitFor();
  for (const t of TABS) {
    await openTab(page, t.id);
    const el = page.getByTestId(testId).first();
    if (await el.isVisible()) {
      await el.click();
      return;
    }
  }
  // Nichts gefunden: Einstiege, die auf Daten warten (z. B. Kurzübungen), erscheinen auf „Üben“.
  await openTab(page, 'learn');
  await page.getByTestId(testId).first().click();
}

/** Reiter „Üben“ (Kurs, Grammatik, Kurzübungen, freie Runde …; Test-ID `learn-hub`). */
export async function openLearnPage(page: Page): Promise<void> {
  await openTab(page, 'learn');
}

/** Profil öffnen (WP0a: der Profil-Knopf oben links führt zu „Dein Stand“; WP0b/P6: Profil-Blatt). */
export async function openProfile(page: Page): Promise<void> {
  const btn = page.getByTestId('open-profile');
  await page.getByTestId('tabbar').waitFor();
  for (let i = 0; i < 2 && !(await btn.isVisible()); i++) await page.getByTestId('tab-today').click();
  await btn.click();
}

/** „Dein Stand“: über den Profil-Knopf (war ein Reiter). */
export async function openOverview(page: Page): Promise<void> {
  await openProfile(page);
  await screen(page, 'overview');
}

/**
 * Einstellungen öffnen: Das Zahnrad steht auf jeder Seite und in jeder Übung (und auf den
 * System-Bildschirmen ohne Reiter). Steht es nicht im Bild, erst zu „Dein Stand“.
 */
export async function openSettings(page: Page): Promise<void> {
  const gear = page.getByTestId('open-settings').first();
  if (!(await gear.isVisible())) await openOverview(page);
  await gear.click();
}

/**
 * Reiter „Sprechen“ mit einem Bereich öffnen. Neubau (plan.md §1.3): Gespräche · Schreiben · Preply
 * (`talk`/`write`/`preply`); bis P5 umbaut, heißen die Bereiche Szenen · Business · Preply. Der
 * Helfer nimmt beide Namen und wählt, was die App gerade anbietet.
 */
export async function openSpeak(page: Page, seg: 'talk' | 'write' | 'preply' | 'scenes' | 'business' = 'talk'): Promise<void> {
  await openTab(page, 'speak');
  const hub = page.getByTestId('speak-hub');
  await hub.waitFor();
  const alias: Record<string, string[]> = { talk: ['talk', 'scenes'], scenes: ['scenes', 'talk'], write: ['write', 'business'], business: ['business', 'write'], preply: ['preply'] };
  const names = alias[seg] ?? [seg];
  let target = names[0] ?? seg;
  for (const n of names) {
    if (await page.getByTestId(`speak-seg-${n}`).count()) {
      target = n;
      break;
    }
  }
  if ((await hub.getAttribute('data-seg')) !== target) await page.getByTestId(`speak-seg-${target}`).click();
  await page.locator(`[data-testid="speak-hub"][data-seg="${target}"]`).waitFor();
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
