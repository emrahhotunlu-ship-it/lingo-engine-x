import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { checkoutV86 } from '../../scripts/v86-checkout.mjs';
import type { InstallOptions } from '../../src/platform/dev/install';
import { MIGRATED, ORIGIN, SEED_EVENING } from './fixtures';
import { DAY, dump, planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Rückweg-Test (Stufe 1, P0 S1-TOR Nr. 7; Plan docs/relaunch/stufe1-plan.md §4.6):
// Der Live-Stand v86 (Commit 3377252, Einzeldatei) muss Daten mit allen neuen Feldern aus Stufe 1 lesen, damit arbeiten und beim
// Zurückschreiben stehen lassen. Sonst wäre der Rückweg auf v86 nach einem Live-Gang von Stufe 1 nicht sicher.
//
// - Die Seite ist die v86-`dist/index.html` aus scripts/v86-checkout.mjs (.cache/v86/), nicht der aktuelle Build.
// - Der Entwicklungs-Adapter kommt wie in allen E2E-Tests von außen (tests/.runtime/fake-claude.js).
// - Daten: seed/sample-data.json + tests/fixtures/s1-seed.json (neue Felder: hist fk/ms/in/mx/pl/n/bg/st, Log fk/in/mx/sm/pl/n/bg/st, theme.a, dk, app/today).
// - Bedienung nur über Test-Kennungen des v86-Stands (eingefroren), nicht über die Helfer in fixtures.ts, die mit der neuen Hülle wandern.

type Doc = Record<string, unknown>;
type S1Seed = { histExtra: Doc; logExtra: Doc; docs: { 'app/profile': { theme: Doc; dk: Doc }; 'app/today': Doc } };

const S1 = JSON.parse(readFileSync(new URL('../fixtures/s1-seed.json', import.meta.url), 'utf8')) as S1Seed;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;
const RUNTIME = readFileSync(new URL('../.runtime/fake-claude.js', import.meta.url), 'utf8');
const LOG = `log/${DAY}`;
const CARDS = 3;
/** Messzeilen von v86 im Diagnose-Protokoll (Stufe `warn`, aber nur Kennzahlen einmal je Lerntag). */
const MEASUREMENT_LINES = new Set(['wl_stats', 'wk_stats']);

/** Ältere hist-Einträge mit den neuen Zeitfeldern (vor dem Stichtag, damit v86 sie als Vergangenheit liest). */
const oldHist = (): Doc[] => [
  { t: Date.parse('2026-09-12T10:00:00+02:00'), m: 'cloze', g: 3, ...S1.histExtra },
  { t: Date.parse('2026-09-15T10:00:00+02:00'), m: 'recog', g: 4, ...S1.histExtra },
];

function seedPatch(): { patch: Record<string, Doc | null>; ids: string[]; oldLog: Doc } {
  const { patch, ids } = ankiPatch(CARDS);
  for (const id of ids) patch[`vocab/${id}`] = { ...(patch[`vocab/${id}`] as Doc), hist: oldHist() };
  const log = SEED[LOG] as { entries: Doc[] } & Doc;
  const oldLog = { ...log.entries[0], ...S1.logExtra };
  patch[LOG] = { ...log, entries: [oldLog, ...log.entries.slice(1)] };
  patch['app/profile'] = { ...planPatch(CARDS), ...S1.docs['app/profile'] };
  patch['app/today'] = S1.docs['app/today'];
  patch['app/decks'] = { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } };
  Object.assign(patch, MIGRATED);
  return { patch, ids, oldLog };
}

let v86Html = '';
let whatsNew: [string, string] = ['', ''];
let diagKey = '';

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  const { dir } = checkoutV86();
  v86Html = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
  // „Was ist neu“ und Diagnose-Schlüssel so, wie v86 sie kennt (aus dem v86-Quelltext, nicht aus dem aktuellen).
  const prefix = /KEY_PREFIX = '([^']+)'/.exec(readFileSync(join(dir, 'src', 'platform', 'storage.ts'), 'utf8'))?.[1] ?? 'lx:';
  const version = /WHATS_NEW_VERSION = '([^']+)'/.exec(readFileSync(join(dir, 'src', 'features', 'system', 'whatsNew.ts'), 'utf8'))?.[1] ?? '';
  whatsNew = [`${prefix}whats-new`, version];
  diagKey = `${prefix}diag`;
});

async function bootV86(page: Page, fake: InstallOptions): Promise<{ errors: string[]; external: string[] }> {
  const errors: string[] = [];
  const external: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === ORIGIN && url.pathname === '/') {
      await route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: v86Html });
      return;
    }
    external.push(url.href);
    await route.abort();
  });
  await page.clock.setFixedTime(new Date(SEED_EVENING));
  await page.addInitScript(([k, v]: [string, string]) => window.localStorage.setItem(k, v), whatsNew);
  await page.addInitScript(() => window.localStorage.setItem('lx:fx', 'off'));
  await page.addInitScript((o: InstallOptions) => {
    (window as unknown as { __LINGO_FAKE_OPTIONS__: InstallOptions }).__LINGO_FAKE_OPTIONS__ = o;
  }, fake);
  await page.addInitScript({ content: RUNTIME });
  await page.goto(`${ORIGIN}/`);
  return { errors, external };
}

const screenOf = (page: Page, name: string) => page.locator(`[data-screen="${name}"]`);

test('v86 läuft mit den Daten von Stufe 1 und lässt die neuen Felder beim Zurückschreiben stehen', async ({ page }) => {
  test.setTimeout(90_000);
  const { patch, ids, oldLog } = seedPatch();
  const { errors, external } = await bootV86(page, { patch });

  // Heute lädt, Serie stimmt.
  await expect(screenOf(page, 'today')).toBeVisible();
  await page.getByTestId('open-profile').first().click();
  await expect(page.getByTestId('profile-sheet-streak')).toContainText('12');
  await page.keyboard.press('Escape');
  await page.getByTestId('profile-sheet').waitFor({ state: 'detached' });

  // Wörter-Liste lädt.
  await page.getByTestId('tab-vocab').click();
  await expect(page.getByTestId('ws-all')).toBeVisible();
  await page.getByTestId('ws-all').click();
  await expect(screenOf(page, 'vocabList')).toBeVisible();
  await expect(page.locator('[data-testid="vocab-list"] [data-testid="vocab-row"]').first()).toBeVisible();

  // Eine Übung bis zum Ende: Karten aufdecken (Leertaste) und mit „Gut“ (3) bewerten.
  await page.getByTestId('tab-vocab').click();
  await expect(page.getByTestId('ws-review')).toBeVisible();
  await page.getByTestId('ws-review').click();
  await expect(screenOf(page, 'trainer')).toBeVisible();
  for (let i = 0; i < CARDS; i++) {
    const flip = page.getByTestId('flip');
    await expect(flip).toBeVisible();
    const card = (await flip.getAttribute('data-card')) ?? '';
    await page.keyboard.press(' ');
    await expect(page.getByTestId('grades')).toBeVisible();
    await page.keyboard.press('3');
    await expect(page.locator(`[data-testid="flip"][data-card="${card}"]`)).toHaveCount(0);
  }
  await expect(page.getByTestId('summary')).toBeVisible();

  // Thema ändern: v86 schreibt `theme` verschmolzen (src/app/actions.ts `persist({ theme: { m } })`).
  await page.keyboard.press('Escape');
  const gear = page.getByTestId('open-settings').first();
  if (await gear.isVisible()) await gear.click();
  else {
    await page.getByTestId('open-profile').first().click();
    await page.getByTestId('profile-settings').click();
  }
  await page.getByRole('radio', { name: 'Hell' }).click();
  await expect.poll(async () => ((await dump(page))['app/profile']?.theme as Doc | undefined)?.m).toBe('light');

  // v86 hat zurückgeschrieben: jede Karte bewertet, Protokoll ergänzt.
  const rated = async () => {
    const db = await dump(page);
    return ids.filter((id) => ((db[`vocab/${id}`]?.hist as Doc[] | undefined) ?? []).length > oldHist().length).length;
  };
  await expect.poll(rated, { timeout: 15_000 }).toBe(CARDS);
  const logged = async () => (((await dump(page))[LOG]?.entries as Doc[] | undefined) ?? []).filter((e) => ids.includes(String(e.id)) && e.t !== oldLog.t).length;
  await expect.poll(logged, { timeout: 15_000 }).toBeGreaterThanOrEqual(CARDS);

  const db = await dump(page);
  // hist: ältere Einträge unverändert, samt fk/ms/in/mx/pl/n/bg/st.
  for (const id of ids) {
    const hist = db[`vocab/${id}`]?.hist as Doc[];
    expect(hist.slice(0, oldHist().length), id).toEqual(oldHist());
    expect(hist.length, id).toBe(oldHist().length + 1);
  }
  // Log: der ältere Eintrag behält fk/in/mx/sm/pl/n/bg/st und left (LS3: beim Verlassen gebucht) – v86 schreibt den Tag zurück, ohne Felder zu verlieren.
  expect(((db[LOG]?.entries as Doc[]) ?? []).find((e) => e.t === oldLog.t && e.id === oldLog.id)).toEqual(oldLog);
  // Profil: theme.a und theme.p bleiben neben dem neuen theme.m; dk unverändert.
  const profile = db['app/profile'] as Doc;
  const s1Profile = S1.docs['app/profile'];
  expect(profile.theme).toEqual({ ...s1Profile.theme, m: 'light' });
  expect(profile.dk).toEqual(s1Profile.dk);
  // app/today: v86 kennt das Dokument nicht und lässt es unberührt.
  expect(db['app/today']).toEqual(S1.docs['app/today']);

  // Keine Meldung in der Diagnose, keine Fehler, nichts von außen. Ausgenommen sind nur die Messzeilen, die v86 absichtlich einmal je
  // Lerntag als Hinweis schreibt (src/domain/srs/wlDiagnose.ts: Kennzahlen, keine Störung).
  const diag = await page.evaluate((k) => window.localStorage.getItem(k), diagKey);
  const entries = (diag ? (JSON.parse(diag) as Array<{ level: string; scope: string; code?: string; message: string }>) : []).filter(
    (e) => (e.level === 'warn' || e.level === 'error') && !MEASUREMENT_LINES.has(e.code ?? ''),
  );
  expect(entries).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
