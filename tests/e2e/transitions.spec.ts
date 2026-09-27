import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { forcedPatch, planPatch } from './trainerHelpers';

// Kap. 4.4 Übergänge mit gemeinsamen Elementen: Heldenkarte → erste Übung, Kurszeile → Kopf der
// Lektion (Flug per framer `animate`, engine/shared.tsx), Wortzeile → Titel des Wortblatts
// (framer `layoutId`). Geprüft wird, dass das Ziel direkt nach dem Tippen von der Quelle
// heranfliegt (Transform in den ersten Bildern, danach Ruhe), dass es ohne Tippen nicht fliegt und
// dass `prefers-reduced-motion` die Bewegung abschaltet.

type Probe = { frames: string[]; gaps: number[]; done: boolean };

/**
 * Zeichnet ab jetzt je Bild den Transform des ersten Treffers von `selector` auf – bis das Element
 * da ist und 12 Bilder lang ruht (höchstens 8 s; unter Last kann der Wechsel dauern).
 */
async function probe(page: Page, selector: string): Promise<void> {
  await page.evaluate((sel) => {
    const w = window as unknown as { __probe: Probe };
    w.__probe = { frames: [], gaps: [], done: false };
    let last = performance.now();
    const start = last;
    let calm = 0;
    const tick = (t: number) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) {
        const tf = el.style.transform || 'none';
        w.__probe.frames.push(tf);
        calm = tf === 'none' ? calm + 1 : 0;
      }
      w.__probe.gaps.push(t - last);
      last = t;
      if (calm >= 12 || t - start > 8000) w.__probe.done = true;
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, selector);
}

async function probed(page: Page): Promise<Probe> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __probe: Probe }).__probe.done), { timeout: 12_000 }).toBe(true);
  return page.evaluate(() => (window as unknown as { __probe: Probe }).__probe);
}
const moving = (p: Probe): string[] => p.frames.filter((f) => f !== 'none' && /-?[1-9]/.test(f.replace(/scale[XY]?\(1\)|scale\(1, 1\)|0px/g, '')));

async function openCourse(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await page.getByTestId('hub-course').click();
  await expect(page.getByTestId('course')).toBeVisible();
}

test('Kurszeile → Kopf der Lektion: der Titel gleitet herein und kommt zur Ruhe', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openCourse(page);
  await probe(page, '[data-testid="lesson-title"]');
  await page.locator('[data-testid="lesson-row"][data-lesson="l07"]').click();
  await expect(page.getByTestId('lesson-title')).toHaveAttribute('data-shared', '');
  const p = await probed(page);
  expect(moving(p).length).toBeGreaterThan(0);
  expect(p.frames.at(-1)).toBe('none');
  test.info().annotations.push({ type: 'frames', description: `${p.gaps.length} Bilder, max. Abstand ${Math.round(Math.max(...p.gaps.slice(2)))} ms` });
  expect(errors).toEqual([]);
});

test('Ohne Tippen im Kurs (vom Lernen-Reiter aus) kein Flug', async ({ page }) => {
  await boot(page, { migrated: true });
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  // Kurs einmal besuchen (die Quelle war schon zu sehen), dann über „Lektion öffnen“ gehen.
  await page.getByTestId('hub-course').click();
  await expect(page.getByTestId('course')).toBeVisible();
  await page.getByTestId('tab-learn').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  await page.getByTestId('hub-next-lesson').click();
  await expect(page.getByTestId('lesson-title')).toBeVisible();
  await expect(page.getByTestId('lesson-title')).not.toHaveAttribute('data-shared', '');
});

test('Heldenkarte → erste Übung: die Karte gleitet in die Übung', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(3), ...forcedPatch() } } });
  await screen(page, 'today');
  await probe(page, '[data-testid="exercise"]');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-shared', '');
  const p = await probed(page);
  expect(moving(p).length).toBeGreaterThan(0);
  expect(p.frames.at(-1)).toBe('none');
  expect(errors).toEqual([]);
});

test('Wortzeile → Wortblatt: das Wort gleitet in den Titel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await page.getByTestId('hub-vocab').click();
  const row = page.getByTestId('vocab-row').first();
  await expect(row).toBeVisible();
  await probe(page, '[role="dialog"] h2');
  await row.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const p = await probed(page);
  expect(moving(p).length).toBeGreaterThan(0);
  expect(p.frames.at(-1)).toBe('none');
  expect(errors).toEqual([]);
});

test('prefers-reduced-motion: kein Flug, nur Überblendung', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, { migrated: true });
  await openCourse(page);
  await probe(page, '[data-testid="lesson-title"]');
  await page.locator('[data-testid="lesson-row"][data-lesson="l07"]').click();
  await expect(page.getByTestId('lesson-title')).toBeVisible();
  const p = await probed(page);
  expect(p.frames.length).toBeGreaterThan(0);
  expect(moving(p)).toEqual([]);
});
