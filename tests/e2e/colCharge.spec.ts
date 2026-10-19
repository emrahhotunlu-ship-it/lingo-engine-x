import { expect, test, type Page } from '@playwright/test';
import { boot, screen, type Theme } from './fixtures';
import { colOf, dump, planPatch, TYPE_MODE } from './trainerHelpers';

// Wortpartner-Charge `col` im Trainer (Engine-Verdrahtung 19.10.2026): Eine Karte ohne eigene Wortpartner („concern“ in den Testdaten) bekommt die geprüften
// der Charge als Auswahl-Lücke; die Ablenker stammen nur aus der Charge; die Antwort bucht wie jede andere und ergänzt die Wortpartner im selben Schreibschritt.

// Stufe 3, die Auswahl-Lücke ist die schwächste Art, alle anderen sitzen (sonst wählte die App eine andere Art). `na: 9`: Aktivierungs-Fahrplan durch.
const GOOD = { c: 6, w: 0 };
const CONCERN = {
  state: 'learning',
  stage: 3,
  S: 1,
  D: 5,
  due: 1_700_000_000_000,
  last: 1_699_900_000_000,
  reps: 3,
  lapses: 0,
  na: 9,
  hist: [],
  xs: { colloc_gap: { c: 0, w: 6 }, cloze_hint: GOOD, cloze: GOOD, type: GOOD, colloc: GOOD, wordfam: GOOD, situation: GOOD, find_trap: GOOD, complete: GOOD },
};

async function startConcern(page: Page, theme?: Theme) {
  const booted = await boot(page, { migrated: true, ...(theme ? { theme } : {}), fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/concern': CONCERN } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

test.describe('Wortpartner-Charge im Trainer', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Auswahl-Lücke erscheint mit Ablenkern nur aus der Charge und bucht col, colN und Verlauf', async ({ page }) => {
    const { errors } = await startConcern(page);
    const ex = page.getByTestId('exercise');
    await expect(ex).toHaveAttribute('data-ex', 'colloc_gap');
    await expect(ex).toHaveAttribute('data-card', 'concern');
    const charge = colOf({ word: 'concern' });
    expect(charge.length).toBeGreaterThan(0);
    const idx = Number((await page.locator('[data-col]').first().getAttribute('data-col')) ?? '0');
    const entry = charge[idx] as { gap: string; opts: string[]; p: string };
    const labels = (await page.getByTestId('choice').locator('[lang]').allInnerTexts()).map((l) => l.trim());
    expect(labels).toContain(entry.gap);
    for (const l of labels) expect([entry.gap, ...entry.opts]).toContain(l);

    await page.getByTestId('choice').nth(labels.indexOf(entry.gap)).click();
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    // Gebucht wird mit „Weiter“ (wie jede Antwort).
    await page.getByTestId('next').click();

    // Die Testdaten haben `col: []` (leer = keine Wortpartner): erst die Antwort ergänzt sie.
    await expect.poll(async () => ((await dump(page))['vocab/concern']?.col as unknown[] | undefined)?.length ?? 0).toBeGreaterThan(0);
    const doc = (await dump(page))['vocab/concern'] as { col: Array<Record<string, unknown>>; colN: number[]; hist: Array<Record<string, unknown>>; reps: number };
    expect(doc.col.map((c) => c.p)).toEqual(charge.map((c) => c.p));
    expect(doc.col.some((c) => 'ai' in c)).toBe(false);
    expect(doc.colN[idx]).toBe(1);
    expect(doc.hist.at(-1)).toMatchObject({ x: 'colloc_gap', m: 'colloc', ci: idx });
    expect(doc.reps).toBe(4);
    expect(errors).toEqual([]);
  });
});

// Bildschirmfotos (390/1440, dunkel/hell) nur auf Zuruf: LX_SHOTS=1 LX_SHOTS_DIR=<Ordner>.
const SHOTS = process.env.LX_SHOTS_DIR ?? '';
for (const s of [
  { name: '390-dunkel', viewport: { width: 390, height: 844 }, theme: 'dark' as Theme, touch: true },
  { name: '390-hell', viewport: { width: 390, height: 844 }, theme: 'light' as Theme, touch: true },
  { name: '1440-dunkel', viewport: { width: 1440, height: 900 }, theme: 'dark' as Theme, touch: false },
  { name: '1440-hell', viewport: { width: 1440, height: 900 }, theme: 'light' as Theme, touch: false },
]) {
  test.describe(`Foto Wortpartner ${s.name}`, () => {
    test.skip(!process.env.LX_SHOTS || !SHOTS, 'nur mit LX_SHOTS=1 und LX_SHOTS_DIR');
    test.use({ viewport: s.viewport, hasTouch: s.touch });
    test('Auswahl-Lücke und Ergebnis', async ({ page }) => {
      await startConcern(page, s.theme);
      await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'colloc_gap');
      await page.screenshot({ path: `${SHOTS}/wortpartner-${s.name}.png` });
      const entry = colOf({ word: 'concern' })[0] as { gap: string };
      const labels = (await page.getByTestId('choice').locator('[lang]').allInnerTexts()).map((l) => l.trim());
      await page.getByTestId('choice').nth(labels.indexOf(entry.gap)).click();
      await page.getByTestId('check').click();
      await expect(page.getByTestId('verdict')).toBeVisible();
      await page.screenshot({ path: `${SHOTS}/wortpartner-${s.name}-ergebnis.png` });
    });
  });
}
