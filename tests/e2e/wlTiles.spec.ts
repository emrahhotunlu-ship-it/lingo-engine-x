import { expect, test } from '@playwright/test';
import { boot, screen } from './fixtures';
import { RECALLED, TYPE_MODE, planPatch } from './trainerHelpers';

// UX-Prüfung WL (B-1): Bausteine bei Wendungen zeigen eine Übung (Satz mit Ablagezeile in der Lücke, Vorrat darunter), nie eine leere Karte.

type Counts = Record<string, { c: number; w: number }>;
const strong = (...ids: string[]): Counts => Object.fromEntries(ids.map((id) => [id, { c: 6, w: 0 }]));
const chunkDoc = (xs: Counts) => ({ state: 'learning', stage: 2, S: 1, D: 5, due: 1_690_000_000_000, last: 1_689_900_000_000, reps: 3, lapses: 0, xs, hist: RECALLED });

for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`Wendung mit Bausteinen (${vp.width} px): Bausteine sichtbar, Antwort prüfbar`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { errors } = await boot(page, {
      migrated: true,
      fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'chunk/c-non-negotiable': chunkDoc({ ...strong('cloze_hint', 'match', 'mc_de', 'ctx_mc', 'mc_en', 'type', 'cloze_part'), tiles: { c: 0, w: 6 } }) } },
    });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    const ex = page.getByTestId('exercise');
    await expect(ex).toHaveAttribute('data-ex', 'tiles');
    await expect(ex).toHaveAttribute('data-kind', 'chunk');
    const tiles = ex.locator('[data-where="pool"]');
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.count()).toBeGreaterThan(2);
    await expect(page.getByTestId('check')).toBeDisabled();
    await tiles.first().click();
    await expect(page.getByTestId('check')).toBeEnabled();
    await page.getByTestId('check').click();
    await expect(page.getByTestId('result')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
