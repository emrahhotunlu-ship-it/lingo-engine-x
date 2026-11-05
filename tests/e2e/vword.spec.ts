import { expect, test } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, SEED_EVENING, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Großpaket A S6: Wort-Seite (Bilder s2-01/s2-03). Stand mit Stufe und beiden Spuren, Verlauf (6 Wochen), Sätze, Aktionen.
// Verwalten schreibt nur über den einen Schreibpfad: „Morgen wieder“ zieht die Termine vor, „Von vorn“ erst nach Rückfrage, Pausieren setzt `hidden`.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const D = 86_400_000;
const PATH = 'vocab/achieve';

function learnedLex(): Doc {
  const t = NOW - 30 * D;
  const day = new Date(t).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Berlin',
  });
  const fs = {
    s: 2.3065,
    d: 2.1181,
    st: 2,
    reps: 1,
    lapses: 0,
    last: t + 300_000,
    sd: 1,
    ls: 0,
  };
  return {
    v: 1,
    k: 'w',
    of: null,
    core: null,
    sense: null,
    lv: 5,
    u: { due: NOW + 30 * D, ...fs },
    b: { due: NOW + 9 * D, ...fs },
    day,
    dayU: null,
    step: null,
    ev: { f: [day, day, day], o: 0, s: 0 },
    sn: [['a', day]],
    gr: null,
    reg: null,
    pri: 'core',
    lc: 0,
    pair: null,
    mv: 0,
    sync: 0,
    mig: null,
    intro: day,
    os: [[NOW - 2 * D, 'We achieved the target ahead of schedule.', 0]],
  };
}

const patch = (): Record<string, Doc> => ({
  'app/schema': {
    ...MIGRATED['app/schema'],
    vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' },
  },
  'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1 } },
  [PATH]: { lex: learnedLex() },
});

const lexIn = async (page: Parameters<typeof dump>[0]): Promise<Doc> => ((await dump(page))[PATH]?.lex ?? {}) as Doc;

for (const vp of [
  {
    name: 'Handy 390',
    use: {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    },
  },
  { name: 'Desktop 1440', use: { viewport: { width: 1440, height: 900 } } },
]) {
  test.describe(vp.name, () => {
    test.use(vp.use);

    test('Stand, Spuren, nächster Schritt, Verlauf, eigene Sätze', async ({ page }) => {
      const { errors, external } = await bootAt(page, { name: 'vword', path: PATH }, { migrated: false, fake: { patch: patch() } });
      await screen(page, 'vword');
      await expect(page.getByTestId('vw-head')).toHaveText('to achieve');
      await expect(page.getByTestId('vw-stage')).toHaveAttribute('data-lv', '5');
      await expect(page.locator('[data-testid="vw-stagebar"] [data-on="1"]')).toHaveCount(5);
      await expect(page.getByTestId('vw-track-u')).toBeVisible();
      await expect(page.getByTestId('vw-track-b')).toBeVisible();
      await expect(page.getByTestId('vw-next')).toHaveAttribute('data-group', 'onway');
      await expect(page.getByTestId('vw-history')).toHaveAttribute('data-status', 'ready');
      await expect(page.locator('[data-testid="vw-timeline"] i')).toHaveCount(42);
      await expect(page.getByTestId('vw-own-item')).toHaveCount(1);
      await expect(page.getByTestId('vw-practice')).toBeVisible();
      expect(await layoutProblems(page)).toEqual([]);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });

    test('Verwalten: Morgen wieder, Von vorn mit Rückfrage; Pausieren und Fortsetzen', async ({ page }) => {
      const { errors } = await bootAt(page, { name: 'vword', path: PATH }, { migrated: false, fake: { patch: patch() } });
      await screen(page, 'vword');
      await page.getByTestId('vw-manage').click();
      await page.getByTestId('vw-tomorrow').click();
      await expect.poll(async () => ((await lexIn(page)).b as Doc).due as number).toBeLessThan(NOW + 2 * D);
      expect(((await lexIn(page)).u as Doc).due as number).toBeLessThan(NOW + 2 * D);
      expect((await lexIn(page)).lv).toBe(5);

      await page.getByTestId('vw-restart').click();
      await expect(page.getByTestId('vw-restart-confirm')).toBeVisible();
      await page.getByTestId('vw-restart-no').click();
      expect((await lexIn(page)).lv).toBe(5);
      await page.getByTestId('vw-restart').click();
      await page.getByTestId('vw-restart-yes').click();
      await expect.poll(async () => (await lexIn(page)).intro).toBeNull();
      expect((await lexIn(page)).os).toHaveLength(1);
      await expect(page.getByTestId('vw-stage')).toHaveAttribute('data-lv', '0');

      await page.getByTestId('vw-pause').click();
      await expect.poll(async () => (await dump(page))[PATH]?.hidden).toBe(true);
      await expect(page.getByTestId('vw-paused')).toBeVisible();
      await page.getByTestId('vw-pause').click();
      await expect.poll(async () => (await dump(page))[PATH]?.hidden).toBe(false);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('Handy 390 · Wege', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('„Dieses Wort üben“ startet eine Runde nur mit diesem Wort', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vword', path: PATH }, { migrated: false, fake: { patch: patch() } });
    await screen(page, 'vword');
    await page.getByTestId('vw-practice').click();
    await screen(page, 'vlearn');
    const go = page.getByTestId('vm-start-go');
    await expect(go.or(page.getByTestId('vm-check')).or(page.getByTestId('vm-use-sit')).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Wortblatt aus der Liste führt bei eingeschaltetem Modul zur Wort-Seite', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vocabList', q: 'achieve' }, { migrated: false, fake: { patch: patch() } });
    await screen(page, 'vocabList');
    await page.locator('[data-testid="vocab-row"][data-word="achieve"]').first().click();
    await screen(page, 'vword');
    await expect(page.getByTestId('vw-head')).toHaveText('to achieve');
    expect(errors).toEqual([]);
  });
});

// Großpaket W3 (05.11.2026): Wortpartner und alle Beispielsätze auf der Wortseite; Claude-Ergänztes lässt sich melden (nie gelöscht, nur `bad: 1`),
// „Fehlt etwas? Jetzt ergänzen“ holt Fehlendes über `word-know@1` und speichert nur Geprüftes.
const AI_SENT = 'The sales team achieved its quarterly target two weeks early.';
test.describe('Wort-Wissen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Wortpartner und Beispielsätze mit Übersetzung; Melden markiert nur', async ({ page }) => {
    const p = patch();
    p[PATH] = {
      ...p[PATH],
      col: [{ p: 'achieve a goal', de: 'ein Ziel erreichen', ex: 'We [achieved our goal] in March.', ai: 1, pv: 'word-know@1', t: NOW }],
      sb: [{ en: AI_SENT, de: 'Das Vertriebsteam erreichte sein Quartalsziel zwei Wochen früher.', sit: 'sales', k: 'work', src: 'ai', t: NOW, pv: 'word-know@1' }],
    };
    const { errors } = await bootAt(page, { name: 'vword', path: PATH }, { migrated: false, fake: { patch: p } });
    await screen(page, 'vword');
    await expect(page.getByTestId('vw-partner')).toContainText('achieve a goal');
    const ex = page.getByTestId('vw-example').filter({ hasText: 'quarterly target' });
    await expect(ex).toHaveCount(1);
    await expect(page.getByTestId('vw-example-de')).toHaveCount(0);
    await ex.getByTestId('vw-example-de-toggle').click();
    await expect(ex.getByTestId('vw-example-de')).toContainText('Quartalsziel');
    await ex.getByTestId('vw-example-report').click();
    await expect.poll(async () => (((await dump(page))[PATH]?.sb as Doc[] | undefined) ?? [])[0]?.bad).toBe(1);
    await expect(page.getByTestId('vw-example').filter({ hasText: 'quarterly target' })).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Jetzt ergänzen: speichert geprüfte Wortpartner und Sätze', async ({ page }) => {
    const p = patch();
    p[PATH] = { ...p[PATH], col: [], sb: [] };
    const { errors } = await bootAt(page, { name: 'vword', path: PATH }, { migrated: false, fake: { patch: p } });
    await screen(page, 'vword');
    await page.getByTestId('vw-fill-btn').click();
    await expect.poll(async () => (((await dump(page))[PATH]?.col as Doc[] | undefined) ?? []).length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(page.getByTestId('vw-partner').first()).toBeVisible();
    await expect(page.getByTestId('vw-example').first()).toBeVisible();
    expect((await dump(page))[PATH]?.kn).toMatchObject({ pv: 'word-know@1' });
    expect(errors).toEqual([]);
  });
});
