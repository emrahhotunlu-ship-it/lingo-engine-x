import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { forcedPatch, planPatch } from './trainerHelpers';

// Kap. 4.4 Übergänge mit gemeinsamen Elementen: Heldenkarte → erste Übung, Kurszeile → Kopf der
// Lektion (Flug per framer `animate`, engine/shared.tsx). Der Listen-Flug Wortzeile → Wortblatt
// ist bewusst entfernt (leistung.md §3.2). Geprüft wird, dass das Ziel direkt nach dem Tippen von der Quelle
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

test('prefers-reduced-motion: kein Flug, nur Überblendung', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(3), ...forcedPatch() } } });
  await screen(page, 'today');
  await probe(page, '[data-testid="exercise"]');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toBeVisible();
  const p = await probed(page);
  expect(p.frames.length).toBeGreaterThan(0);
  expect(moving(p)).toEqual([]);
});
