import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen, type BootOptions } from './fixtures';
import { dump } from './trainerHelpers';

// Persönliche „Deutsch-Fallen“ (Lernberatung 27.09., V3) und Wochenfokus Preply ↔ App (V8/Nr. 9):
// - „Dein Stand“ → Deutsch-Fallen → „Fallen erkennen“ (patterns@1, complex) → Liste mit Regel,
//   eigenem Beispiel und Verlauf; `app/patterns` gespeichert (gekappt, Verlauf je ISO-Woche).
// - Kurzdrill: eigene Sätze als Reparatur-Sätze (src `pattern`), neue Sätze mit pattern-check@1.
// - Vorhandene Muster: Karte auf „Dein Stand“ mit Wochenfokus, kein automatischer Aufruf in
//   derselben Woche; Wochenbericht mit seltener/gleich/häufiger; Hinweis im Prompt von „Sag es“.
// Handy (390) und Desktop.

type Doc = Record<string, unknown>;
type Call = { id: string | null; tier: string; input: string };

const SIZES = [
  { name: 'Handy', width: 390, height: 844 },
  { name: 'Desktop', width: 1280, height: 900 },
] as const;

const ms = (d: string) => Date.parse(`${d}T12:00:00+02:00`);
const corr = (wrong: string, right: string) => ({ wrong, right, why: 'Kurzer Grund.' });
const sayItem = (id: string, day: string, corrections: Doc[]) => ({ id, t: ms(day), day, sit: 'cfo-price', kind: 'job', a1: 'x', a2: '', fb1: { corrections, upgrades: [], better: 'x', praise: 'Gut.' }, fb2: null, ms: 1000, lang: 'de', ai: true });

/** Eigene Fehler in „Sag es“: diese Woche (KW 38) und letzte Woche (KW 37). */
const SAY_DOC = {
  v: 1,
  month: '2026-09',
  items: [
    sayItem('say-a', '2026-09-18', [corr('We work together since 2019.', 'We have been working together since 2019.'), corr('Our actual price list is attached.', 'Our current price list is attached.')]),
    sayItem('say-b', '2026-09-10', [
      corr('I live in Hamburg since five years.', 'I have lived in Hamburg for five years.'),
      corr('The actual numbers look good.', 'The current numbers look good.'),
      corr('I become the report tomorrow.', 'I will get the report tomorrow.'),
    ]),
  ],
};

const SINCE = {
  id: 'since-present',
  title_de: '„since“ mit Gegenwart',
  title_en: '“since” with the present tense',
  rule: 'Seit einem Zeitpunkt bis jetzt: Present Perfect (Continuous), nicht Präsens.',
  examples: [{ wrong: 'We work together since 2019.', right: 'We have been working together since 2019.' }],
  count: 3,
  keys: ['since'],
  tasks: ['Say how long you have worked for your company.', 'Tell a client how long you have used your CRM.'],
};
const ACTUAL = {
  id: 'actual-current',
  title_de: '„actual“ = „aktuell“',
  title_en: '“actual” used for “current”',
  rule: '„aktuell“ heißt „current“; „actual“ bedeutet „tatsächlich“.',
  examples: [{ wrong: 'Our actual price list is attached.', right: 'Our current price list is attached.' }],
  count: 2,
  keys: ['actual'],
  tasks: ['Describe the current status of your biggest project.', 'Tell a customer about your current pricing model.'],
};
/** Schon erkannte Muster aus dieser Woche (kein automatischer Neuaufruf). */
const PRESET = {
  d: '2026-09-19',
  t: ms('2026-09-19'),
  lang: 'de',
  pv: 'patterns@1',
  items: [SINCE, ACTUAL],
  history: [
    { w: '2026-W36', counts: { 'since-present': 1 } },
    { w: '2026-W37', counts: { 'since-present': 3, 'actual-current': 1 } },
    { w: '2026-W38', counts: { 'since-present': 1, 'actual-current': 2 } },
  ],
};

const calls = (page: Page): Promise<Call[]> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Call[] } }).__LINGO_FAKE__.sampleCalls]);
const patternsDoc = async (page: Page) => (await dump(page))['app/patterns'] as { items?: Doc[]; history?: Array<{ w: string; counts: Record<string, number> }>; lang?: string; pv?: string } | undefined;

async function openPatterns(page: Page, opts: BootOptions) {
  const booted = await boot(page, { migrated: true, ...opts });
  await openOverview(page);
  await page.getByTestId('tab-errors').click();
  await expect(page.getByTestId('patterns-stand')).toBeVisible();
  await page.getByTestId('patterns-open').click();
  await page.locator('[data-screen="patterns"]').waitFor({ state: 'visible' });
  return booted;
}

for (const size of SIZES) {
  test(`Erkennen und Kurzdrill (${size.name})`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    const { errors, external } = await openPatterns(page, { fake: { patch: { 'say/2026-09': SAY_DOC } } });

    // Noch nichts erkannt: EIN Knopf, Zweck nur hinter dem Info-Symbol.
    await expect(page.getByTestId('patterns-empty')).toBeVisible();
    await expect(page.getByTestId('patterns-purpose')).toHaveCount(0);
    await page.getByTestId('patterns-info').click();
    await expect(page.getByTestId('patterns-purpose')).toBeVisible();
    await page.getByTestId('patterns-recognize').click();

    const list = page.getByTestId('patterns-list');
    await expect(list).toBeVisible();
    const since = page.locator('[data-testid="pattern"][data-id="since-present"]');
    await expect(since).toContainText('„since“ mit Gegenwart');
    await expect(since.getByTestId('pattern-rule')).toContainText('Present Perfect');
    // Nur der falsche Satz; die richtige Fassung kommt erst nach dem Prüfen im Drill.
    await expect(since.getByTestId('pattern-example')).not.toContainText('→');
    // Verlauf lokal gezählt: letzte Woche (KW 37) → diese Woche (KW 38).
    const trend = since.getByTestId('pattern-trend');
    await expect(trend).toContainText('letzte Woche');
    expect(Number(await trend.getAttribute('data-cur'))).toBeGreaterThanOrEqual(1);
    expect(Number(await trend.getAttribute('data-prev'))).toBeGreaterThanOrEqual(1);
    await expect(page.locator('[data-testid="pattern"][data-id="actual-current"]')).toBeVisible();
    await expect(page.getByTestId('patterns-recognize')).toContainText('Neu erkennen');
    expect(await layoutProblems(page)).toEqual([]);
    const axe = await new AxeBuilder({ page }).include('[data-testid="patterns"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.screenshot({ path: `test-results/screens/deutsch-fallen-${size.width}.png`, fullPage: true });

    // Genau ein Aufruf (complex), gespeichert und gekappt.
    const pc = (await calls(page)).filter((c) => c.id === 'patterns');
    expect(pc.map((c) => c.tier)).toEqual(['complex']);
    expect(pc[0]!.input).toContain('We work together since 2019. => We have been working together since 2019.');
    const saved = (await patternsDoc(page))!;
    expect(saved).toMatchObject({ lang: 'de', pv: 'patterns@1' });
    expect(saved.items!.length).toBeLessThanOrEqual(8);
    expect(saved.history!.map((h) => h.w)).toEqual(expect.arrayContaining(['2026-W37', '2026-W38']));
    expect(saved.history!.find((h) => h.w === '2026-W38')!.counts['since-present']).toBeGreaterThanOrEqual(1);

    // Kurzdrill „since“: eigene Sätze neu formulieren, dann neue Sätze.
    await since.getByTestId('pattern-practice').click();
    await expect(page.getByTestId('patterns')).toHaveAttribute('data-view', 'drill');
    const drill = page.getByTestId('pattern-drill');
    await expect(drill).toHaveAttribute('data-id', 'since-present');
    let fixes = 0;
    let frees = 0;
    let starts = 0;
    for (let i = 0; i < 12; i++) {
      if ((await drill.getAttribute('data-state')) === 'done') break;
      // Nur die offene Aufgabe (die beantwortete blendet noch aus).
      const repair = page.locator('[data-testid="repair-item"][data-state="open"]');
      const free = page.locator('[data-testid="pattern-free"][data-state="open"]');
      // N43: 3 Sätze aus dem Startsatz der Fallen sind eingestreut (zählen nicht in den Trend).
      const start = page.locator('[data-testid="focus-item"][data-state="open"]');
      await expect(repair.or(free).or(start)).toBeVisible();
      if (await start.isVisible()) {
        await expect(page.getByTestId('focus-hint')).toBeVisible();
        await page.getByTestId('focus-dont-know').click();
        await expect(page.getByTestId('feedback-solution')).toBeVisible();
        starts++;
        await page.getByTestId('next').click();
      } else if (await repair.isVisible()) {
        await expect(repair).toContainText('aus deinen Deutsch-Fallen');
        await expect(page.getByTestId('repair-right')).toHaveCount(0);
        await page.getByTestId('repair-input').fill('We have been partners for many years now.');
        await page.getByTestId('repair-check').click();
        await expect(page.getByTestId('repair-verdict')).toHaveAttribute('data-verdict', 'ok');
        await expect(page.getByTestId('repair-right')).toBeVisible();
        if (fixes === 0) {
          expect(await layoutProblems(page)).toEqual([]);
          const a = await new AxeBuilder({ page }).include('[data-testid="pattern-drill"]').analyze();
          expect(a.violations.map((v) => v.id)).toEqual([]);
        }
        fixes++;
        await page.getByTestId('repair-next').click();
      } else {
        await expect(page.getByTestId('pattern-free-task')).not.toBeEmpty();
        const wrong = frees === 1;
        await page.getByTestId('pattern-free-input').fill(wrong ? 'zzno I work here since 2018.' : 'I have worked for Acme since 2018.');
        await page.getByTestId('pattern-free-check').click();
        await expect(page.getByTestId('pattern-free-verdict')).toHaveAttribute('data-verdict', wrong ? 'wrong' : 'correct');
        await expect(page.getByTestId('pattern-free-why')).not.toBeEmpty();
        if (wrong) await expect(page.getByTestId('pattern-free-fixed')).toBeVisible();
        // Wörter der Aufgabe antippbar.
        if (frees === 0) {
          await page.getByTestId('pattern-free-task').locator('button.lx-word').first().click();
          await expect(page.getByTestId('lookup')).toBeVisible();
          await page.keyboard.press('Escape');
          await expect(page.getByTestId('lookup')).toHaveCount(0);
          expect(await layoutProblems(page)).toEqual([]);
        }
        frees++;
        await page.getByTestId('pattern-free-next').click();
      }
    }
    await expect(drill).toHaveAttribute('data-state', 'done');
    expect(fixes).toBeGreaterThanOrEqual(1);
    expect(frees).toBeGreaterThanOrEqual(2);
    expect(fixes + frees).toBeLessThanOrEqual(7);
    expect(starts).toBe(3);
    const end = page.getByTestId('pattern-drill-end');
    await expect(end).toHaveAttribute('data-ok', String(fixes + frees - 1));
    // Eigene Sätze sind jetzt Reparatur-Sätze mit Quelle „pattern“ (oder waren es schon).
    await expect.poll(async () => (((await dump(page))['app/repair']?.items as Doc[] | undefined) ?? []).filter((e) => e.src === 'pattern').length).toBeGreaterThanOrEqual(1);
    await page.getByTestId('pattern-drill-back').click();
    await expect(page.getByTestId('patterns')).toHaveAttribute('data-view', 'list');
    await page.getByTestId('patterns-close').click();
    await screen(page, 'overview');
    await expect(page.getByTestId('patterns-stand-item').first()).toBeVisible();

    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test.describe('Vorhandene Muster (Desktop, EN)', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Dein Stand, Sprachtreue, Wochenbericht und Wochenfokus', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, lang: 'en', fake: { patch: { 'app/patterns': PRESET, 'say/2026-09': SAY_DOC } } });
    await openOverview(page);
    await page.getByTestId('tab-errors').click();
    const card = page.getByTestId('patterns-stand');
    await expect(card).toContainText('Your German traps');
    await expect(page.getByTestId('patterns-stand-item')).toHaveCount(2);
    await expect(page.getByTestId('patterns-stand-item').first()).toContainText('“since” with the present tense');
    await expect(page.getByTestId('patterns-stand-focus')).toContainText('Weekly focus: “since” with the present tense · “actual” used for “current”');
    expect(await layoutProblems(page)).toEqual([]);

    // Wochenbericht: letzte abgeschlossene Woche (KW 37) gegen KW 36.
    await page.getByTestId('tab-history').click();
    const weekly = page.getByTestId('weekly-patterns');
    await expect(weekly).toHaveAttribute('data-week', '2026-W37');
    await expect(weekly.locator('[data-testid="weekly-pattern"][data-id="since-present"]')).toHaveAttribute('data-trend', 'more');
    await expect(weekly).toContainText('German traps');

    // Liste: die Regel liegt nur auf Deutsch vor → Hinweis statt gemischter Sprache.
    // Der Einstieg steht auf der Karte „Deine Deutsch-Fallen“ im Reiter Fehler (Neubau: Stand-Reiter).
    await page.getByTestId('tab-errors').click();
    await page.getByTestId('patterns-open').click();
    await page.locator('[data-screen="patterns"]').waitFor({ state: 'visible' });
    await expect(page.getByTestId('pattern-rule')).toHaveCount(0);
    await expect(page.locator('[data-testid="pattern"][data-id="since-present"]')).toContainText('The rule is only available in German');
    await expect(page.getByTestId('patterns-focus')).toContainText('Weekly focus');
    // Diese Woche schon erkannt: kein automatischer Aufruf.
    expect((await calls(page)).filter((c) => c.id === 'patterns')).toEqual([]);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});

test('„Sag es“ bekommt die Top-3-Muster als Hinweis im Prompt (Handy)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const plan = { d: '2026-09-20', v: 1, ids: ['say', 'gram', 'cloze'], why: [[['whySay']], [['whyRotation']], [['whyRotation']]], duty: ['ch:say'], goal: { review: 0, ch: 1 }, lesson: null, at: 1 };
  await boot(page, { migrated: true, fake: { patch: { 'app/patterns': PRESET, 'app/profile': { plan } } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  // Neubau N71 „Laut zuerst“: erst laut sprechen, dann aufschreiben.
  await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'aloud');
  await page.getByTestId('say-aloud-done').click();
  await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'write1');
  await page
    .getByTestId('say-draft')
    .fill('Thank you for your honest feedback. We work together since 2019 and they save many hours every month. Our actual price list is attached, so you can compare it with your costs.');
  await page.getByTestId('say-check').click();
  await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'feedback');
  const sc = (await calls(page)).filter((c) => c.id === 'say-check');
  expect(sc[0]!.input).toContain('pay special attention to these): “since” with the present tense; “actual” used for “current”');
  expect(sc[0]!.input.split('\n')[0]).toBe('[say-check@2]');
});
