import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen, type Theme } from './fixtures';

// Wort-Himmel im Atlas (Lernplattform 3.0 P59): Sterne = Atlas-Wörter mit Karte (gleiche Zahl wie die Bänder darunter), Schleier aus dem
// Wortschatztest (Saat: 30.08.2026), Vorlesetext, Zoom und Antippen, Zeichenzeit ≤ 50 ms, keine Dauerschleife. Schalter `sky` per `lx:flags`.

async function openSky(page: Page, opts: { flags?: string; fx?: string; theme?: Theme } = {}) {
  const booted = await boot(page, { migrated: true, theme: opts.theme, localStorage: { 'lx:flags': opts.flags ?? 'sky', 'lx:fx': opts.fx ?? 'off' } });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-atlas').click();
  await expect(page.getByTestId('atlas')).toBeVisible();
  return booted;
}

const bandSum = (page: Page): Promise<number> =>
  page.getByTestId('atlas-fband').evaluateAll((els) =>
    els.reduce((s, el) => {
      const m = /([\d.,]+)\D+[\d.,]+/.exec(el.querySelector('[data-testid="atlas-fband-toggle"] .lx-tnum')?.textContent ?? '');
      return s + (m ? Number(m[1]!.replace(/[.,]/g, '')) : 0);
    }, 0),
  );

test.describe('Handy 360', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true });

  test('Sterne = Summe der Bänder, Schleier aus dem Test, Vorlesetext, kein Querscrollen, axe 0', async ({ page }) => {
    const { errors } = await openSky(page);
    const sky = page.getByTestId('word-sky');
    await expect(sky).toBeVisible();
    await expect(page.getByTestId('word-sky-canvas')).toHaveAttribute('data-drawn', 'true');
    const stars = Number(await sky.getAttribute('data-stars'));
    expect(stars).toBeGreaterThan(0);
    expect(stars).toBe(await bandSum(page));
    expect(Number(await sky.getAttribute('data-words'))).toBeGreaterThan(6000);
    await expect(sky).toHaveAttribute('data-veil', 'true');
    await expect(page.getByTestId('word-sky-veil')).toContainText('30. August 2026');
    await expect(page.getByTestId('word-sky-summary')).toContainText(`${stars}`);
    await expect(page.getByTestId('word-sky-canvas')).toHaveAttribute('aria-label', /Wort-Himmel/);
    const box = await page.getByTestId('word-sky-canvas').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(360);
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
    // Pixeldichte höchstens 2.
    expect(await page.getByTestId('word-sky-canvas').evaluate((c: HTMLCanvasElement) => c.width / c.getBoundingClientRect().width)).toBeLessThanOrEqual(2.01);
    expect(await layoutProblems(page)).toEqual([]);
    const res = await new AxeBuilder({ page }).include('[data-testid="word-sky"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Antippen zeigt das Wort; Zoom per Knopf und Doppeltipp; Zeichenzeit ≤ 50 ms', async ({ page }) => {
    const { errors } = await openSky(page);
    const sky = page.getByTestId('word-sky');
    const cv = page.getByTestId('word-sky-canvas');
    await expect(cv).toHaveAttribute('data-drawn', 'true');
    const box = (await cv.boundingBox())!;
    // Außenrand (seltene Wörter, dicht gesät): ein Tipp nahe dem Rand trifft einen Punkt.
    let picked = false;
    for (const [fx, fy] of [
      [0.5, 0.03],
      [0.97, 0.5],
      [0.5, 0.97],
      [0.03, 0.5],
      [0.2, 0.2],
    ] as const) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      if (await page.getByTestId('word-sky-pick').isVisible()) {
        picked = true;
        break;
      }
      await page.waitForTimeout(400);
    }
    expect(picked).toBe(true);
    await expect(page.getByTestId('word-sky-pick')).toHaveAttribute('data-word', /\w/);
    await page.getByTestId('word-sky-zoom').click();
    await expect(sky).toHaveAttribute('data-zoom', '3');
    await page.getByTestId('word-sky-zoom').click();
    await expect(sky).toHaveAttribute('data-zoom', '1');
    await cv.dblclick({ position: { x: box.width / 2, y: box.height / 3 } });
    await expect(sky).toHaveAttribute('data-zoom', '3');
    const ms = Number(await cv.getAttribute('data-draw-ms'));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(50);
    expect(errors).toEqual([]);
  });

  test('Stufe Voll: 600 ms Einlauf, danach keine Bildschleife mehr', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.addInitScript(() => {
      const w = window as unknown as { __raf: number };
      w.__raf = 0;
      const orig = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (cb) => {
        w.__raf++;
        return orig(cb);
      };
    });
    const { errors } = await openSky(page, { fx: 'full' });
    await expect(page.getByTestId('word-sky-canvas')).toHaveAttribute('data-drawn', 'true');
    await page.waitForTimeout(1500);
    const a = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
    await page.waitForTimeout(1000);
    const b = await page.evaluate(() => (window as unknown as { __raf: number }).__raf);
    // Ruhe: in einer Sekunde höchstens eine Handvoll Bildanfragen (fremde Einmal-Aufrufe), keine 60er-Schleife.
    expect(b - a).toBeLessThan(10);
    const running = await page.getByTestId('word-sky').evaluate((el) => el.getAnimations({ subtree: true }).filter((x) => x.playState === 'running').length);
    expect(running).toBe(0);
    expect(errors).toEqual([]);
  });

  test('Ohne Schalter `sky`: kein Himmel, Atlas wie bisher', async ({ page }) => {
    const { errors } = await openSky(page, { flags: '{"fx":{"sky":false}}' });
    await expect(page.getByTestId('atlas-freq')).toBeVisible();
    await expect(page.getByTestId('word-sky')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Zwei Spalten: Himmel links (≤ 480 px), Bänder rechts; heller Modus ohne axe-Befund', async ({ page }) => {
    const { errors } = await openSky(page, { theme: 'light' });
    const cv = page.getByTestId('word-sky-canvas');
    await expect(cv).toHaveAttribute('data-drawn', 'true');
    const skyBox = (await page.getByTestId('word-sky').boundingBox())!;
    const bands = (await page.getByTestId('atlas-freq').boundingBox())!;
    expect(skyBox.x + skyBox.width).toBeLessThanOrEqual(bands.x);
    expect((await cv.boundingBox())!.width).toBeLessThanOrEqual(480);
    expect(await layoutProblems(page)).toEqual([]);
    const res = await new AxeBuilder({ page }).include('[data-testid="atlas"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(res.violations.map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
