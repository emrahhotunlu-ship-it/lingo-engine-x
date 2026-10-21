import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { RECALLED, TYPE_MODE, planPatch } from './trainerHelpers';

// Emrahs Meldung 21.10.2026 (Bausteine „ein Viertelprozentpunkt“): Die Ablagezeile zeigt vorab so viele Plätze, wie die Lösung Bausteine hat; nach dem
// Prüfen sind nur falsch gelegte Bausteine rot; gleichwertige Fassungen („a quarter percentage point“) gelten; die beiden „a“ sind vertauschbar.

type Counts = Record<string, { c: number; w: number }>;
const SHOTS = process.env.LX_SHOTS ?? '';
const strong = (...ids: string[]): Counts => Object.fromEntries(ids.map((id) => [id, { c: 6, w: 0 }]));
const ID = 'c-a-quarter-of-a-percentage-point';
const quarterDoc = {
  id: ID,
  en: 'a quarter of a percentage point',
  de: 'ein Viertelprozentpunkt',
  def: 'a change of 0.25 percentage points',
  kind: 'phrase',
  register: 'neutral',
  why: '',
  level: 'C1',
  created: 1_689_000_000_000,
  also: [],
  state: 'learning',
  stage: 3,
  S: 1,
  D: 5,
  due: 1_600_000_000_000,
  last: 1_599_900_000_000,
  reps: 3,
  lapses: 0,
  xs: { ...strong('cloze_hint', 'cloze_part', 'complete', 'match', 'mc_de', 'ctx_mc', 'mc_en', 'type', 'cloze', 'produce'), tiles: { c: 0, w: 6 } },
  hist: RECALLED,
  na: 9,
};

async function openQuarter(page: Page): Promise<void> {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), [`chunk/${ID}`]: quarterDoc } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  const ex = page.getByTestId('exercise');
  await expect(ex).toHaveAttribute('data-card', ID);
  await expect(ex).toHaveAttribute('data-ex', 'tiles');
  expect(errors).toEqual([]);
}

const pool = (page: Page, text: string) => page.locator(`[data-testid="tile"][data-where="pool"][data-tile="${text}"]`).first();

async function lay(page: Page, words: string[]): Promise<void> {
  for (const w of words) await pool(page, w).click();
}

for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test.describe(`Bausteine „ein Viertelprozentpunkt“ (${vp.width} px)`, () => {
    test.use({ viewport: vp, ...(vp.width < 500 ? { hasTouch: true } : {}) });

    test('sechs Plätze vorab sichtbar; gleichwertige Fassung „a quarter percentage point“ ist richtig (Auch richtig)', async ({ page }) => {
      await openQuarter(page);
      // Vorab: 6 leere Plätze (so viele Wörter hat die Lösung), die zwei „a“ als gleiche Bausteine gekennzeichnet.
      await expect(page.getByTestId('tile-slot')).toHaveCount(6);
      // UX-Prüfung WL2 S2: Es gibt kürzere gültige Fassungen – die Plätze heißen „bis zu 6“, nicht „genau 6“.
      await expect(page.getByTestId('tiles-upto')).toContainText('Bis zu 6 Bausteine');
      await expect(page.locator('[data-testid="tile"][data-where="pool"][data-dup]')).toHaveCount(2);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/tiles-${vp.width}-1-start.png`, fullPage: true });
      await lay(page, ['a', 'quarter']);
      await expect(page.getByTestId('tile-slot')).toHaveCount(4);
      await lay(page, ['percentage', 'point']);
      await page.getByTestId('check').click();
      await expect(page.getByTestId('result')).toBeVisible();
      await expect(page.locator('[data-testid="tile"][data-where="line"][data-state="ok"]')).toHaveCount(4);
      await expect(page.locator('[data-testid="tile"][data-where="line"][data-state="off"]')).toHaveCount(0);
      await expect(page.getByTestId('result')).toContainText('Auch richtig');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/tiles-${vp.width}-2-alt-correct.png`, fullPage: true });
    });

    test('ein Ablenker zu viel: nur er ist rot, die richtigen grün; beide „a“ vertauscht zählen gleich', async ({ page }) => {
      await openQuarter(page);
      const distractor = await page
        .locator('[data-testid="tile"][data-where="pool"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? '').find((x) => !['a', 'quarter', 'of', 'percentage', 'point'].includes(x)) ?? '');
      expect(distractor).not.toBe('');
      // Erst das zweite „a“ (data-dup 2/2), dann das erste: vertauscht.
      await page.locator('[data-testid="tile"][data-where="pool"][data-tile="a"][data-dup="2/2"]').click();
      await lay(page, ['quarter', 'of', 'a', 'percentage', distractor, 'point']);
      await page.getByTestId('check').click();
      await expect(page.getByTestId('result')).toBeVisible();
      await expect(page.locator('[data-testid="tile"][data-where="line"][data-state="ok"]')).toHaveCount(6);
      await expect(page.locator('[data-testid="tile"][data-where="line"][data-state="off"]')).toHaveCount(1);
      await expect(page.locator(`[data-testid="tile"][data-where="line"][data-tile="${distractor}"]`)).toHaveAttribute('data-state', 'off');
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/tiles-${vp.width}-3-one-wrong.png`, fullPage: true });
    });

    test('UX-Prüfung WL2 S1: Ablenker statt „point“ – die Zeile bleibt nach dem Prüfen gleich hoch, „fehlt: point“ steht darin', async ({ page }) => {
      await openQuarter(page);
      const distractor = await page
        .locator('[data-testid="tile"][data-where="pool"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? '').find((x) => !['a', 'quarter', 'of', 'percentage', 'point'].includes(x)) ?? '');
      await lay(page, ['a', 'quarter', 'of', 'a', 'percentage', distractor]);
      const before = (await page.getByTestId('tile-line').boundingBox())?.height ?? 0;
      await page.getByTestId('check').click();
      await expect(page.getByTestId('result')).toBeVisible();
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
      const after = (await page.getByTestId('tile-line').boundingBox())?.height ?? 0;
      expect(after).toBeLessThanOrEqual(before + 1);
      await expect(page.getByTestId('tile-missing')).toHaveCount(1);
      await expect(page.getByTestId('tile-missing')).toContainText('fehlt:');
      await expect(page.getByTestId('tile-missing')).toHaveAttribute('data-tile', 'point');
      await expect(page.getByTestId('tiles-upto')).toHaveCount(0);
    });

    test('vertauschte „a“ in der vollen Lösung: richtig, alle grün', async ({ page }) => {
      await openQuarter(page);
      await page.locator('[data-testid="tile"][data-where="pool"][data-tile="a"][data-dup="2/2"]').click();
      await lay(page, ['quarter', 'of', 'a', 'percentage', 'point']);
      await page.getByTestId('check').click();
      await expect(page.getByTestId('result')).toBeVisible();
      await expect(page.locator('[data-testid="tile"][data-where="line"][data-state="ok"]')).toHaveCount(6);
      await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    });
  });
}
