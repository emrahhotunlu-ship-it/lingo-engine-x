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
    // UX-Prüfung C: Kapitel 4 ist (noch) nicht das wirksame Kapitel → nur der Wenn-Satz, nicht „kommt aus diesem Kapitel“.
    await expect(sheet.getByTestId('chapter-daily')).toHaveAttribute('data-active', 'false');
    await expect(sheet.getByTestId('chapter-daily')).toHaveText('Wenn du hier startest, kommt deine Grammatik ab heute aus diesem Kapitel.');
    expect(await sheet.getByTestId('chapter-topic-phase').count()).toBeGreaterThanOrEqual(5);
    // UX-Prüfung E: im Kapitel-Modus EIN Zustand je Thema (die Phase), kein zweiter Chip „Neu“/„Lernt“ daneben.
    await expect(sheet.getByTestId('chapter-topic-chip')).toHaveCount(0);
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
    // UX-Prüfung C/D: jetzt ist Kapitel 4 das wirksame Kapitel: Tagessatz und derselbe Knopftext wie die Weiter-Karte.
    const hubLabel = (await page.getByTestId('hub-next-start').innerText()).trim();
    await page.locator('[data-testid="program-chapter"][data-chapter="k4"] [data-testid="program-chapter-open"]').click();
    await expect(sheet.getByTestId('chapter-daily')).toHaveAttribute('data-active', 'true');
    await expect(sheet.getByTestId('chapter-daily')).toContainText('Deine Grammatik von heute kommt aus diesem Kapitel.');
    await expect(sheet.getByTestId('chapter-start')).toHaveText(hubLabel);
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
    await expect(page.getByTestId('hub-next-line')).toContainText('Kurzer Test ohne Hilfe.');
    await main.click();
    await screen(page, 'grammarSession');
    await expect(page.getByTestId('grammar-session')).toHaveAttribute('data-ctx', 'xtra');
    const key = grammarKey();
    for (let k = 1; k <= 6; k++) {
      // UX-Prüfung G/H: „k von 6“ steht nur oben; das Abzeichen sagt nur „Themen-Test“ (neutral, nicht Bernstein); ohne Hilfe kein ⓘ.
      await expect(page.getByTestId('grammar-session').getByText(`${k} von 6`, { exact: true })).toBeVisible();
      await expect(page.getByTestId('again-badge')).toHaveText('Themen-Test');
      await expect(page.getByTestId('again-badge')).toHaveAttribute('data-tone', 'hint');
      await expect(page.getByTestId('purpose-info')).toHaveCount(0);
      await answerGrammar(page, key, { wrong: true });
      await page.getByTestId('next').click();
    }
    const res = page.getByTestId('tt-result');
    await expect(res).toHaveAttribute('data-ok', 'false');
    await expect(res).toHaveAttribute('data-n', '6');
    await expect(res).toContainText('Ab morgen ist der Test wieder bereit.');
    // UX-Prüfung F: Überschrift = Testergebnis; Ergebnis oben ohne zweite Zahl; die schwachen Stellen nur als Liste + Fehlerliste.
    const end = page.getByTestId('session-end');
    await expect(end.locator('h1')).toHaveText('Noch nicht bestanden · 0 von 6 richtig');
    await expect(res).not.toContainText('0 von 6');
    await expect(page.getByTestId('session-end-facts')).toHaveCount(0);
    await expect(page.getByTestId('session-end-items')).toHaveCount(0);
    await expect(page.getByTestId('tt-weak')).toBeVisible();
    await expect(page.getByTestId('session-end-mistakes')).toBeVisible();
    await expect(page.getByTestId('session-end-next')).toHaveText('Schwache Stellen üben');
    await expect(page.getByTestId('session-end-secondary')).toHaveText('Zurück zu Heute');
    await page.getByTestId('tt-skip').click();
    await expect(page.getByTestId('tt-skipped')).toBeVisible();
    // Nach „trotzdem weiter“: keine Liste der schwachen Stellen mehr, der Knopf beginnt das nächste Thema (wie die Weiter-Karte).
    await expect(page.getByTestId('tt-weak')).toHaveCount(0);
    await expect(page.getByTestId('session-end-next')).toHaveText(/^Thema beginnen: .+/);
    await expect.poll(async () => ((await dump(page))['grammar/passive'] as { tt?: { s?: string } }).tt?.s).toBe(TODAY);
    const tt = ((await dump(page))['grammar/passive'] as { tt: Doc }).tt;
    expect(tt).toMatchObject({ d: TODAY, n: 6, ok: false, k: 1, s: TODAY });
    // Die schwachen Muster des Tests (`tt.w`) bleiben auch nach „trotzdem weiter“ stehen: danach wird genau das geübt.
    expect(Array.isArray(tt.w) && (tt.w as unknown[]).length > 0).toBe(true);
    await page.getByTestId('session-end-next').click();
    await expect(page.getByTestId('summary')).toHaveCount(0);
    await expect(page.getByTestId('grammar-session')).toBeVisible();
    await page.keyboard.press('Escape');
    await openTab(page, 'learn');
    await expect(page.getByTestId('hub-next-topic')).toHaveAttribute('data-topic', 'passive-plus');
    expect(errors).toEqual([]);
  });

  test('Themen-Test nicht bestanden → „Schwache Stellen üben“ startet die Übung desselben Themas', async ({ page }) => {
    const { errors } = await start(page, { fake: { patch: { 'grammar/passive': PASSIVE_READY, 'app/c1': { v: 1, ch: { n: 4, d: '2026-09-19' }, chh: [[4, '2026-09-19']] } } } });
    await page.getByTestId('hub-next-start').click();
    await screen(page, 'grammarSession');
    const key = grammarKey();
    for (let k = 1; k <= 6; k++) {
      await answerGrammar(page, key, { wrong: true });
      await page.getByTestId('next').click();
    }
    await expect(page.getByTestId('tt-result')).toHaveAttribute('data-ok', 'false');
    await page.getByTestId('session-end-next').click();
    await expect(page.getByTestId('summary')).toHaveCount(0);
    await expect(page.getByTestId('gr-item')).toHaveAttribute('data-topic', 'passive');
    // Übung, kein Test: kein Abzeichen „Themen-Test“.
    await expect(page.getByTestId('again-badge').filter({ hasText: 'Themen-Test' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Themen-Test bestanden: Überschrift aus dem Ergebnis, Knopf = nächster Schritt; Kapitelblatt und Reise zählen „geschafft“', async ({ page }) => {
    const { errors } = await start(page, { fake: { patch: { 'grammar/passive': PASSIVE_READY, 'app/c1': { v: 1, ch: { n: 4, d: '2026-09-19' }, chh: [[4, '2026-09-19']] } } } });
    await page.getByTestId('hub-next-start').click();
    await screen(page, 'grammarSession');
    const key = grammarKey();
    for (let k = 0; k < 8 && !(await page.getByTestId('tt-result').isVisible()); k++) {
      await answerGrammar(page, key);
      await page.getByTestId('next').click();
    }
    const res = page.getByTestId('tt-result');
    await expect(res).toHaveAttribute('data-ok', 'true');
    const c = await res.getAttribute('data-c');
    await expect(page.getByTestId('session-end').locator('h1')).toHaveText(`Themen-Test bestanden · ${c} von 6 richtig`);
    await expect(page.getByTestId('session-end-items')).toHaveCount(0);
    await expect(page.getByTestId('session-end-next')).toHaveText(/^Thema beginnen: .+/);
    await expect(page.getByTestId('session-end-secondary')).toHaveText('Zurück zu Heute');
    await page.keyboard.press('Escape');
    await openTab(page, 'learn');
    await expect(page.getByTestId('hub-next-topic')).toHaveAttribute('data-topic', 'passive-plus');
    // UX-Prüfung A/B: das Thema mit bestandenem Test ist in Blatt (Zähler, Phase, Ring) und Reise „geschafft“ – dieselbe Zahl.
    await expect(page.locator('[data-testid="program-chapter"][data-chapter="k4"] [data-testid="program-pats"]')).toHaveAttribute('data-done', '1');
    await page.locator('[data-testid="program-chapter"][data-chapter="k4"] [data-testid="program-chapter-open"]').click();
    const sheet = page.getByTestId('chapter-sheet');
    await expect(sheet.getByTestId('chapter-sheet-pats')).toHaveAttribute('data-safe', '1');
    const row = sheet.locator('[data-testid="chapter-topic"][data-topic="passive"]');
    await expect(row.getByTestId('chapter-topic-phase')).toHaveAttribute('data-phase', 'done');
    await expect(row.getByTestId('chapter-topic-ring')).toHaveAttribute('data-done', 'true');
    await expect(row.getByTestId('chapter-topic-chip')).toHaveCount(0);
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
