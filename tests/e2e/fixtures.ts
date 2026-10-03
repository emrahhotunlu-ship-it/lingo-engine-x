import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { InstallOptions } from '../../src/platform/dev/install';

// Lädt den Produktions-Build dist/index.html unter einer https-Adresse und spielt den
// Entwicklungs-Adapter von außen ein (CLAUDE.md A7). Jede andere Anfrage wird abgefangen,
// protokolliert und abgebrochen: So beweist jeder Test nebenbei, dass die App nichts von fremden
// Hosts lädt.

export const ORIGIN = 'https://lingo.artifact.test';
const HTML = readFileSync(new URL('../../dist/index.html', import.meta.url), 'utf8');
const RUNTIME = readFileSync(new URL('../.runtime/fake-claude.js', import.meta.url), 'utf8');

/** Stichtag der Testdaten: Sonntag, 20.09.2026, 21:00 Uhr in Berlin. */
export const NOW = '2026-09-20T21:00:00+02:00';
const NOW_MS = Date.parse(NOW);

export type Theme = 'dark' | 'light';
export type Lang = 'de' | 'en';

/** Ein eingestuftes Profil (B2), damit Tests direkt trainieren können. */
export function placedProfile(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    v: 1,
    created: NOW_MS - 86_400_000,
    newPerDay: 3,
    planStart: '2026-09-01',
    placement: {
      at: NOW_MS - 86_400_000,
      size: 4200,
      bands: [1, 0.98, 0.9, 0.8, 0.62, 0.45, 0.3, 0.2, 0.1],
      falseAlarm: 0,
      grammar: { 'pres-simple-cont': 0.9, 'past-simple-perfect': 0.5, articles: 0.4 },
      level: 'B2',
    },
    imported: { at: NOW_MS - 86_400_000, cards: 0, days: ['2026-09-18', '2026-09-19'], grammar: {} },
    ...extra,
  };
}

export type BootOptions = {
  /** Optionen des Entwicklungs-Adapters; `false` = gar keine Laufzeit. */
  fake?: InstallOptions | false;
  theme?: Theme;
  lang?: Lang;
  now?: string;
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
  await page.clock.setFixedTime(new Date(opts.now ?? NOW));
  if (opts.lang || opts.theme) {
    await page.addInitScript(([lang, theme]: [string, string]) => {
      if (lang) window.localStorage.setItem('lx:lang', lang);
      if (theme) window.localStorage.setItem('lx:theme', theme);
    }, [opts.lang ?? '', opts.theme ?? ''] as [string, string]);
  }
  if (opts.fake !== false) {
    const fake: InstallOptions = { ...(opts.fake ?? {}) };
    await page.addInitScript((o: InstallOptions) => {
      window.__LINGO_FAKE_OPTIONS__ = o;
    }, fake);
    await page.addInitScript({ content: RUNTIME });
  }
  await page.goto(`${ORIGIN}/`);
  return { external, errors };
}

/** Prüfungen, die auf jedem Bildschirm gelten. */
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
    return out;
  });
}

/**
 * Eine Trainingseinheit durchspielen, egal welche Abfrage kommt. Liefert die Zahl der Schritte.
 * `answer` bestimmt, was in Lücken getippt wird (Standard: absichtlich falsch → Lösung wird gezeigt).
 */
export async function playSession(page: Page, maxSteps = 120): Promise<number> {
  for (let i = 0; i < maxSteps; i++) {
    const done = page.getByTestId('session-done');
    const sortKnow = page.getByTestId('sort-new');
    const meet = page.getByTestId('meet-done');
    const choices = page.getByTestId('choices');
    const check = page.getByTestId('check');
    const next = page.getByTestId('next');
    await done.or(sortKnow).or(meet).or(choices).or(check).or(next).first().waitFor();
    if (await done.isVisible()) return i;
    if (await next.isVisible()) {
      await next.click();
      continue;
    }
    if (await sortKnow.isVisible()) {
      await sortKnow.click();
      continue;
    }
    if (await meet.isVisible()) {
      await meet.click();
      continue;
    }
    if (await choices.isVisible()) {
      await choices.getByRole('button').first().click();
      await next.waitFor();
      continue;
    }
    if (await check.isVisible()) {
      await page.locator('.lx-hidden-input').click();
      await page.keyboard.type('xyz');
      await check.click();
      await next.waitFor();
    }
  }
  throw new Error('Einheit nicht beendet');
}
