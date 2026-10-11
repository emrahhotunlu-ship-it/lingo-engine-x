import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen, type BootOptions } from './fixtures';
import { answerGrammar, grammarKey } from './learnHelpers';

// Kapitel-Arbeit (Rückmeldung 5, `docs/umbau/kapitel-plan.md` K5): ein Hauptknopf je Kapitel, „Du bist hier“ = „Als Nächstes“, Themen-Test
// mit „Nächstes Thema trotzdem beginnen“, nichts gesperrt. Schalter `chapterRun` (Standard an).

type Doc = Record<string, unknown>;
const TODAY = '2026-09-20';
const LAST = Date.parse('2026-09-19T09:00:00+02:00');

const dump = (page: Page): Promise<Record<string, Doc>> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Record<string, Doc> } } }).__LINGO_FAKE__.db.dump());

const start = async (page: Page, opts: BootOptions = {}) => {
  const booted = await boot(page, { migrated: true, ...opts });
  await screen(page, 'today');
  await openTab(page, 'learn');
  return booted;
};

/** Passiv: alle Muster eingeführt und je 3-mal geübt (2 richtig), also ist der Themen-Test dran. */
const PASSIVE_READY: Doc = {
  id: 'passive',
  p: 0.45,
  n: 15,
  c: 10,
  last: LAST,
  hist: [{ d: '2026-09-01', p: 0.3 }],
  recent: [1, 0, 1],
  seen: [],
  seenText: [],
  errors: [],
  pats: Object.fromEntries(['pv.simple', 'pv.progressive', 'pv.perfect', 'pv.modal-future', 'pv.prep-agent'].map((id) => [id, { n: 3, c: 2, last: LAST, h: 0, r: 5, k: 3, dd: [], i: '2026-09-01' }])),
};

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Kapitelblatt: ein Hauptknopf, Phase je Thema; Klick startet die Runde und speichert die Wahl; danach „Du bist hier“ = „Als Nächstes“', async ({ page }) => {
    const { errors } = await start(page);
    await page.locator('[data-testid="program-chapter"][data-chapter="k4"] [data-testid="program-chapter-open"]').click();
    const sheet = page.getByTestId('chapter-sheet');
    await expect(sheet).toHaveAttribute('data-chapter', 'k4');
    await expect(sheet.getByTestId('chapter-start')).toHaveCount(1);
    await expect(sheet.getByTestId('chapter-run')).toContainText('Deine Grammatik von heute kommt aus diesem Kapitel.');
    expect(await sheet.getByTestId('chapter-topic-phase').count()).toBeGreaterThanOrEqual(5);
    expect(await layoutProblems(page)).toEqual([]);
    await sheet.getByTestId('chapter-start').click();
    await screen(page, 'grammarSession');
    await expect.poll(async () => ((await dump(page))['app/c1'] as { ch?: { n: number } } | undefined)?.ch?.n).toBe(4);
    const c1 = (await dump(page))['app/c1'] as { ch: { n: number; d: string }; chh: unknown[] };
    expect(c1.ch).toEqual({ n: 4, d: TODAY });
    expect(c1.chh).toEqual([[4, TODAY]]);
    await page.keyboard.press('Escape');
    await openTab(page, 'learn');
    await expect(page.locator('[data-testid="program-chapter"][data-here="true"]')).toHaveAttribute('data-chapter', 'k4');
    await expect(page.getByTestId('hub-next-topic')).toHaveAttribute('data-chapter', '4');
    await expect(page.getByTestId('hub-next-topic')).toContainText('Kapitel 4 ·');
    expect(errors).toEqual([]);
  });

  test('Gespeicherte Wahl (app/c1.ch): Programmkarte, Weiter-Karte und markiertes Thema zeigen dasselbe Kapitel; keine Bremse', async ({ page }) => {
    const { errors } = await start(page, { fake: { patch: { 'app/c1': { v: 1, ch: { n: 3, d: '2026-09-19' }, chh: [[3, '2026-09-19']] } } } });
    await expect(page.locator('[data-testid="program-chapter"][data-here="true"]')).toHaveAttribute('data-chapter', 'k3');
    const next = page.getByTestId('hub-next-topic');
    await expect(next).toHaveAttribute('data-chapter', '3');
    const topic = await next.getAttribute('data-topic');
    expect(['conditionals', 'cond-alt', 'mixed-cond', 'c1-diplomacy']).toContain(topic);
    await expect(page.getByTestId('hub-intro-brake')).toHaveCount(0);
    await expect(page.getByTestId('hub-next-start')).toHaveAttribute('data-action', /^(intro|practice|test)$/);
    expect(errors).toEqual([]);
  });

  test('Themen-Test: 6 Aufgaben ohne Hilfe, nicht bestanden → schwache Stellen, morgen noch einmal, „Nächstes Thema trotzdem beginnen“', async ({ page }) => {
    const { errors } = await start(page, { fake: { patch: { 'grammar/passive': PASSIVE_READY, 'app/c1': { v: 1, ch: { n: 4, d: '2026-09-19' }, chh: [[4, '2026-09-19']] } } } });
    const main = page.getByTestId('hub-next-start');
    await expect(page.getByTestId('hub-next-topic')).toHaveAttribute('data-topic', 'passive');
    await expect(main).toHaveAttribute('data-action', 'test');
    await expect(page.getByTestId('hub-next-line')).toContainText('6 Aufgaben ohne Hilfe. Bestanden ab 5 richtig.');
    await main.click();
    await screen(page, 'grammarSession');
    await expect(page.getByTestId('grammar-session')).toHaveAttribute('data-ctx', 'xtra');
    const key = grammarKey();
    for (let k = 1; k <= 6; k++) {
      await expect(page.getByText(`Themen-Test · ${k} von 6`)).toBeVisible();
      await answerGrammar(page, key, { wrong: true });
      await page.getByTestId('next').click();
    }
    const res = page.getByTestId('tt-result');
    await expect(res).toHaveAttribute('data-ok', 'false');
    await expect(res).toHaveAttribute('data-n', '6');
    await expect(res).toContainText('Morgen kommt der Test noch einmal.');
    await page.getByTestId('tt-skip').click();
    await expect(page.getByTestId('tt-skipped')).toBeVisible();
    await expect.poll(async () => ((await dump(page))['grammar/passive'] as { tt?: { s?: string } }).tt?.s).toBe(TODAY);
    const tt = ((await dump(page))['grammar/passive'] as { tt: Doc }).tt;
    expect(tt).toMatchObject({ d: TODAY, n: 6, ok: false, k: 1, s: TODAY });
    expect(errors).toEqual([]);
  });

  test('Schalter aus (`chapterRun: false`): kein Kapitel-Knopf, alter Weg unverändert', async ({ page }) => {
    const { errors } = await start(page, { localStorage: { 'lx:flags': JSON.stringify({ chapterRun: false }) } });
    await page.locator('[data-testid="program-chapter"][data-chapter="k4"] [data-testid="program-chapter-open"]').click();
    await expect(page.getByTestId('chapter-sheet')).toBeVisible();
    await expect(page.getByTestId('chapter-start')).toHaveCount(0);
    await expect(page.getByTestId('chapter-topic-phase')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('hub-next-start')).toHaveAttribute('data-action', /^(topic|fix)$/);
    expect(errors).toEqual([]);
  });
});
