import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, screen } from './fixtures';
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

// Lernplattform 2.0 §10.4 P8: Wechsel zur nächsten Aufgabe ≤ 250 ms (Median) bei 390 px, mit und ohne Bewegungseinstellung.
// Gemessen wird in der Seite: vom Klick auf „Weiter“ bis die nächste Aufgabe (anderer Satz) im DOM steht.
for (const reduced of [false, true]) {
  test(`Grammatikrunde: Wechsel zur nächsten Aufgabe im Median ≤ 250 ms (${reduced ? 'reduzierte' : 'volle'} Bewegung, 390 px)`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'duty' });
    await screen(page, 'grammarSession');
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      await expect(page.getByTestId('gr-item')).toBeVisible();
      await page.getByTestId('dont-know').click();
      await expect(page.getByTestId('next')).toBeVisible();
      const ms = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const before = document.querySelector('[data-testid="gr-item"]')?.textContent ?? '';
            const t0 = performance.now();
            const poll = (): void => {
              const el = document.querySelector('[data-testid="gr-item"]');
              if (!el || (el.textContent !== before && !document.querySelector('[data-testid="result"]'))) resolve(performance.now() - t0);
              else requestAnimationFrame(poll);
            };
            (document.querySelector('[data-testid="next"]') as HTMLElement).click();
            requestAnimationFrame(poll);
          }),
      );
      times.push(ms);
      if (await page.getByTestId('summary').count()) break;
    }
    const median = [...times].sort((a, b) => a - b)[Math.floor(times.length / 2)] ?? 0;
    expect(median, `Wechselzeiten ${times.map((t) => Math.round(t)).join(', ')} ms`).toBeLessThanOrEqual(250);
    expect(errors).toEqual([]);
  });
}
