import { expect, test, type Browser, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, openTab } from './fixtures';
import { DAY, answerCurrent, dump, planPatch, produceSentence } from './trainerHelpers';
import { TYPE_MODE } from './trainerHelpers';

// Neue Abfragearten (phase1-plan §4.2) und Wendungen in der täglichen Wiederholung (Kap. 5, M15):
// jede neue Art einmal am Handy (390 px, Touch), eine Runde mit fälliger Wendung, Wortschatzliste
// mit Wendungen, ohne KI. Gegen den Produktions-Build mit eingespieltem Adapter.

type Doc = Record<string, unknown>;
type Counts = Record<string, { c: number; w: number }>;
type Device = 'phone' | 'keys';

/** `phone`: Touch 390 px (Eingabeprofil touch); `keys`: Laptop mit Tastatur (Profil keys). */
async function device(browser: Browser, kind: Device): Promise<{ page: Page; close: () => Promise<void> }> {
  const context =
    kind === 'phone'
      ? await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' })
      : await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  return { page, close: () => context.close() };
}
const phone = (browser: Browser) => device(browser, 'phone');

/** Karte, die als erste fällig ist und deren schwächste Art feststeht. */
const forcedDoc = (stage: number, xs: Counts, i = 0): Doc => ({ state: 'learning', stage, S: 1, D: 5, due: 1_690_000_000_000 + i, last: 1_689_900_000_000, reps: 3, lapses: 0, xs });
const strong = (...ids: string[]): Counts => Object.fromEntries(ids.map((id) => [id, { c: 6, w: 0 }]));
const weak = (id: string): Counts => ({ [id]: { c: 0, w: 6 } });

// Hören (listen_mc, dictation) und der eigene Satz (produce) gibt es nur mit Tastatur (Profil keys, Geräte-Matrix); am Handy fehlen sie.
const MODES: Array<{ ex: string; stage: number; others: string[]; device: Device }> = [
  { ex: 'ctx_mc', stage: 1, others: ['mc_en'], device: 'phone' },
  { ex: 'match', stage: 2, others: ['mc_de'], device: 'phone' },
  { ex: 'listen_mc', stage: 1, others: ['mc_en', 'ctx_mc'], device: 'keys' },
  { ex: 'dictation', stage: 5, others: ['produce', 'complete', 'cloze'], device: 'keys' },
  { ex: 'produce', stage: 5, others: ['dictation', 'complete', 'cloze'], device: 'keys' },
];

async function startRound(page: Page, patch: Record<string, Doc>, opts: { sample?: boolean } = {}) {
  const booted = await boot(page, {
    migrated: true,
    fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), ...patch }, ...(opts.sample === false ? { capabilities: { sample: false } } : {}) },
  });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

for (const m of MODES) {
  test(`${m.device === 'phone' ? 'Handy' : 'Tastatur'}: ${m.ex} – Aufgabe, Lösen, automatische Note, Schreibweg`, async ({ browser }) => {
    const { page, close } = await device(browser, m.device);
    const { errors, external } = await startRound(page, { 'vocab/avoid': forcedDoc(m.stage, { ...strong(...m.others), ...weak(m.ex) }) });
    const ex = page.getByTestId('exercise');
    await expect(ex).toHaveAttribute('data-ex', m.ex);
    await expect(ex).toHaveAttribute('data-card', 'avoid');
    await expect(page.getByTestId('task')).not.toBeEmpty();
    // Lösung steht vor dem Prüfen nicht im DOM (außer als Option).
    if (m.ex === 'dictation') await expect(page.getByTestId('sentence')).not.toContainText('avoid');
    if (m.ex === 'listen_mc' || m.ex === 'dictation') {
      await expect.poll(async () => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken.join(' | '))).toContain('Try to avoid driving in rush hour.');
      await expect(page.getByTestId('replay')).toBeVisible();
    }
    if (m.ex === 'listen_mc') await expect(page.getByTestId('sentence')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);

    // Lösen
    if (m.ex === 'listen_mc') {
      await page.getByTestId('choice').filter({ hasText: 'vermeiden' }).click();
      await page.getByTestId('check').click();
    } else if (m.ex === 'ctx_mc') {
      await page.getByTestId('choice').filter({ hasText: 'vermeiden' }).click();
      await page.getByTestId('check').click();
    } else if (m.ex === 'match') {
      await page.getByTestId('choice').filter({ has: page.locator('[lang]', { hasText: /^avoid$/ }) }).click();
      await page.getByTestId('check').click();
    } else if (m.ex === 'produce') {
      await page.getByTestId('produce-input').click();
      await page.getByTestId('produce-input').fill(produceSentence('avoid'));
      await page.getByTestId('check').click();
    } else {
      await page.getByTestId('gap-input').click();
      await page.keyboard.type('avoid', { delay: 20 });
      await page.getByTestId('check').click();
    }
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(page.getByTestId('result')).toBeVisible();
    // Keine Bewertungsknöpfe (A7), Erklär-Karte (bei „Eigener Satz“ mit der Rückmeldung von Claude), jedes englische Wort antippbar.
    await expect(page.locator('button[data-grade]')).toHaveCount(0);
    if (m.ex === 'produce') {
      await expect(page.getByTestId('explanation')).toBeVisible();
      await expect(page.getByTestId('ai-note')).toBeVisible();
    } else await expect(page.getByTestId('explanation')).toBeVisible();
    expect(await page.getByTestId('result').locator('button.lx-word').count()).toBeGreaterThan(0);
    expect(await layoutProblems(page)).toEqual([]);
    const step = (await page.locator('[data-step]').getAttribute('data-step')) ?? '';
    await page.getByTestId('next').click();
    // Karte in Lernschritten: sie kommt in der Runde noch einmal (F10) – dann ebenfalls lösen.
    await expect(page.locator(`[data-step="${step}"]`)).toHaveCount(0);
    await expect(page.locator('[data-step]')).toHaveCount(1);
    for (let i = 0; i < 4 && !(await page.getByTestId('summary').isVisible()); i++) await answerCurrent(page);
    await expect(page.getByTestId('summary')).toBeVisible();

    await expect.poll(async () => ((await dump(page))['vocab/avoid']?.xs as Counts | undefined)?.[m.ex]?.c ?? 0).toBeGreaterThanOrEqual(1);
    expect(((await dump(page))['vocab/avoid']?.xs as Counts)[m.ex]?.w).toBe(6);
    const card = (await dump(page))['vocab/avoid'] as Doc & { fsrs: Doc; hist: Doc[]; dev?: unknown };
    expect(card.fsrs).toMatchObject({ v: 1, src: 'lx' });
    expect(card.hist.some((h) => h.x === m.ex)).toBe(true);
    expect(card.word).toBe('to avoid');
    await expect.poll(async () => ((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined)?.find((e) => e.id === 'avoid' && e.ctx === 'rev')).toMatchObject({ k: 'v', m: `tr-${m.ex}`, ok: true, dev: m.device === 'phone' ? 't' : 'k' });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await close();
  });
}

test('Am Handy gibt es nie Hören, Diktat oder eigenen Satz – auch nicht, wenn sie die schwächste Art wären', async ({ browser }) => {
  const { page, close } = await phone(browser);
  const { errors } = await startRound(page, { 'vocab/avoid': forcedDoc(5, { ...strong('cloze', 'complete'), ...weak('dictation'), produce: { c: 0, w: 9 } }) });
  const ex = await page.getByTestId('exercise').getAttribute('data-ex');
  // V1: ab Stufe 4 mit wenig Formen kommen auch Nachbar-Arten (z. B. Wortpartner) dazu; verboten bleiben Hören, Diktat und der eigene Satz.
  expect(['dictation', 'listen_mc', 'produce', 'flip']).not.toContain(ex);
  await expect(page.getByTestId('replay')).toHaveCount(0);
  await expect(page.getByTestId('produce-input')).toHaveCount(0);
  expect(errors).toEqual([]);
  await close();
});

test('Eigener Satz: falsche Verwendung → „Noch nicht" mit Begründung; bei KI-Fehler „Ohne Claude prüfen"', async ({ browser }) => {
  const { page, close } = await device(browser, 'keys');
  const { errors } = await startRound(page, { 'vocab/avoid': forcedDoc(5, { ...strong('dictation', 'complete', 'cloze'), ...weak('produce') }) });
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'produce');
  // „zzjson" liefert keine gültige Antwort: Fehlerzustand, Knopf „Erneut versuchen" und Prüfung ohne Claude.
  await page.getByTestId('produce-input').fill('I zzjson this every day at work.');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('produce-local')).toBeVisible();
  await page.getByTestId('produce-input').fill('We always avoid long meetings on Friday afternoons.');
  await page.getByTestId('produce-local').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('verdict-sub')).toContainText('Ohne Claude geprüft');
  await expect(page.getByTestId('next-in')).toBeVisible();
  expect(errors.filter((e) => !/invalid_json|zzjson|not valid JSON/i.test(e))).toEqual([]);
  await close();

  const second = await device(browser, 'keys');
  await startRound(second.page, { 'vocab/avoid': forcedDoc(5, { ...strong('dictation', 'complete', 'cloze'), ...weak('produce') }) });
  await second.page.getByTestId('produce-input').fill('The meeting starts at nine.');
  await second.page.getByTestId('check').click();
  await expect(second.page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
  await expect(second.page.getByTestId('explanation')).toContainText('Zielwort');
  // Ein falscher Satz wird zum Fehlersatz (Box 1) – nur mit Claudes Korrektur.
  await expect.poll(async () => ((await dump(second.page))['app/repair']?.items as Doc[] | undefined)?.some((i) => i.src === 'write') ?? false).toBe(true);
  await second.close();
});

test('ohne KI (nosample): Stufe 5 fällt auf KI-freie Arten zurück, kein toter Knopf', async ({ browser }) => {
  const { page, close } = await device(browser, 'keys');
  const { errors } = await startRound(page, { 'vocab/avoid': forcedDoc(5, { ...strong('dictation'), ...weak('produce') }) }, { sample: false });
  const ex = page.getByTestId('exercise');
  await expect(ex).toBeVisible();
  expect(['dictation', 'complete', 'cloze']).toContain(await ex.getAttribute('data-ex'));
  await expect(page.getByTestId('produce-input')).toHaveCount(0);
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  // Ohne Claude zählt „Satz vervollständigen“ höchstens als „Schwer“: die Karte kommt in der Runde noch einmal.
  for (let i = 0; i < 5 && !(await page.getByTestId('summary').isVisible()); i++) await answerCurrent(page);
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(errors).toEqual([]);
  await close();
});

test.describe('Wendungen in der täglichen Wiederholung', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Pflichtrunde mit fälliger Wendung: Abfrage im Originalsatz, FSRS zusätzlich, Protokoll wie die alte App, Pflicht erledigt', async ({ page }) => {
    const { errors, external } = await boot(page, {
      migrated: true,
      fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'chunk/c-non-negotiable': forcedDoc(3, { ...strong('tiles'), ...weak('cloze_hint') }) } },
    });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    const ex = page.getByTestId('exercise');
    await expect(ex).toHaveAttribute('data-kind', 'chunk');
    await expect(ex).toHaveAttribute('data-card', 'c-non-negotiable');
    await expect(ex).toHaveAttribute('data-ex', 'cloze_hint');
    // Ursprungssatz = aufgewertete Fassung, die Lücke steht an der Stelle der Wendung.
    await expect(page.getByTestId('sentence')).toContainText('For us, the Q2 date is');
    await expect(page.getByTestId('sentence')).not.toContainText('non-negotiable');
    await answerCurrent(page);
    await expect(page.getByTestId('summary')).toBeVisible();

    await expect.poll(async () => ((await dump(page))['chunk/c-non-negotiable']?.fsrs as Doc | undefined)?.src).toBe('lx');
    const doc = (await dump(page))['chunk/c-non-negotiable'] as Doc & { hist: Doc[]; modes: Doc };
    // Alte Felder bleiben, keine Fähigkeitswerte der Vokabeln, Modus der alten Wendungs-Wiederholung.
    expect(doc).toMatchObject({ en: 'non-negotiable', de: 'nicht verhandelbar', register: expect.any(String) });
    expect(doc).not.toHaveProperty('pa');
    expect(doc).not.toHaveProperty('ac');
    expect(doc.modes).toMatchObject({ cloze: { c: 1, w: 0 } });
    expect(doc.hist.at(-1)).toMatchObject({ x: 'cloze_hint', m: 'cloze' });
    expect(doc.last).toBe((doc.fsrs as Doc).last);
    await expect.poll(async () => ((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined)?.find((e) => e.id === 'c-non-negotiable')).toMatchObject({ type: 'chunk', m: 'tr-cloze_hint', q: 'non-negotiable', ctx: 'rev', ok: true });
    const entry = ((await dump(page))[`log/${DAY}`]?.entries as Doc[]).find((e) => e.id === 'c-non-negotiable');
    expect(entry).not.toHaveProperty('k');

    await page.getByTestId('session-end-next').click();
    await screen(page, 'today');
    await expect(page.getByTestId('today-status')).toHaveText('Fertig für heute');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Aus der Situation (M15): Szene und Absicht, Wendung frei tippen, „Damals hattest du gesagt"', async ({ page }) => {
    const { errors } = await boot(page, {
      migrated: true,
      fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'chunk/c-non-negotiable': forcedDoc(4, { ...strong('type', 'cloze'), ...weak('situation') }) } },
    });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'situation');
    await expect(page.getByTestId('situation-scene')).toBeVisible();
    await expect(page.getByTestId('situation-intent')).toContainText('nicht verhandelbar');
    await expect(page.getByTestId('exercise')).not.toContainText('non-negotiable');
    await page.getByTestId('hint').click();
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('non-negotiable', { delay: 20 });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    // „Tipp" zählt als Hilfe: höchstens „Gut" (die Zeit bis zur nächsten Wiederholung steht in der Rückmeldung).
    await expect(page.getByTestId('next-in')).toBeVisible();
    await expect(page.getByTestId('explanation')).toBeVisible();
    await expect(page.getByTestId('situation-then')).toContainText('Damals hattest du gesagt');
    await expect(page.getByTestId('examples')).toContainText('For us, the Q2 date is non-negotiable.');
    expect(errors).toEqual([]);
  });

  test('Wendung aus der Mail auf Stufe 2: keine Auswahlfrage mehr, sondern Abruf mit Stütze; Protokoll als Wendung (Lernberatung 27.09.)', async ({ page }) => {
    const { errors } = await boot(page, {
      migrated: true,
      fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'chunk/c-behind-schedule': forcedDoc(2, { ...strong('mc_de'), ...weak('match') }) } },
    });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    const ex = page.getByTestId('exercise');
    await expect(ex).toHaveAttribute('data-card', 'c-behind-schedule');
    // Wendungen überspringen Erkennen/Zuordnen (Stufen 1–2): abgefragt wird ab „Mit Stütze abrufen".
    const kind = await ex.getAttribute('data-ex');
    expect(['match', 'mc_de', 'mc_en']).not.toContain(kind);
    await answerCurrent(page);
    await expect.poll(async () => ((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined)?.find((e) => e.id === 'c-behind-schedule')).toMatchObject({ type: 'chunk' });
    expect(errors).toEqual([]);
  });
});

test.describe('Wortschatzliste: Wendungen', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Filter „Wendungen", eigenes Blatt mit Ursprung, verstecken und zurückholen', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await expect(page.getByTestId('vocab')).toBeVisible();
    // Neubau (plan.md §1.3): die Liste liegt unter „Alle Einträge ›“.
    await page.getByTestId('ws-all').click();
    await expect(page.getByTestId('vocab-status')).toContainText('8 Wendungen');
    await page.locator('[data-testid="vocab-filter"][data-filter="phrases"]').click();
    const rows = page.locator('[data-testid="vocab-row"][data-kind="chunk"]');
    await expect(rows).toHaveCount(8);
    await page.locator('[data-testid="vocab-row"][data-word="c-i-take-your-point-but"]').click();
    const sheet = page.getByTestId('word-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('chunk-origin')).toHaveAttribute('data-src', 'scene');
    await expect(sheet.getByTestId('chunk-origin-title')).toContainText('Holding the Q2 e-invoicing deadline');
    await expect(sheet.getByTestId('chunk-then')).toContainText('I understand you, but the risk is high.');
    await expect(sheet.getByTestId('origin-sentence')).toContainText('I take your point, but the penalty risk is real.');
    await expect(sheet.getByTestId('origin-sentence').locator('mark, .lx-mark').first()).toBeVisible();
    await expect(sheet.getByTestId('chunk-why')).toBeVisible();
    await expect(sheet.getByTestId('word-known')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);

    await sheet.getByTestId('word-hide').click();
    await expect(sheet).toBeHidden();
    await expect.poll(async () => (await dump(page))['chunk/c-i-take-your-point-but']?.hidden).toBe(true);
    await expect(rows).toHaveCount(7);
    await page.locator('[data-testid="vocab-filter"][data-filter="hidden"]').click();
    await page.locator('[data-testid="vocab-row"][data-word="c-i-take-your-point-but"]').click();
    await page.getByTestId('word-unhide').click();
    await expect.poll(async () => (await dump(page))['chunk/c-i-take-your-point-but']?.hidden).toBe(false);
    // Nichts gelöscht: die Wendung behält alle Felder der alten App.
    expect((await dump(page))['chunk/c-i-take-your-point-but']).toMatchObject({ en: 'I take your point, but …', stage: 1, S: 2.2 });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});
