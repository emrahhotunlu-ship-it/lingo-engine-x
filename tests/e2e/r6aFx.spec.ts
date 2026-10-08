import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, openSettings, openTab, screen } from './fixtures';
import { dump, planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Lernplattform 3.0 R6 Spur A (P54–P60, Wächter P64): Kartenstapel, Wischen mit Fingerfolge, Lichtfeld, Momente, Aufstieg.
// Effekte stehen in Tests sonst auf „Aus“; hier setzt jeder Test die Stufe selbst.

async function startAnki(page: Page, n: number, fx: 'full' | 'calm' | 'off'): Promise<void> {
  const { patch } = ankiPatch(n);
  await boot(page, { migrated: true, localStorage: { 'lx:fx': fx }, fake: { patch: { 'app/profile': planPatch(n), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } } } } });
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-review').click();
  await screen(page, 'trainer');
}

/** Finger auf die Mitte des Elements, Wege (dx, dy) nacheinander, ohne Loslassen. */
async function touchPath(page: Page, selector: string, path: ReadonlyArray<readonly [number, number]>, end: boolean): Promise<void> {
  await page.evaluate(
    async ({ selector, path, end }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`kein Element ${selector}`);
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + Math.min(r.height / 2, 60);
      const touch = (cx: number, cy: number) => new Touch({ identifier: 7, target: el, clientX: cx, clientY: cy });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(x, y)], changedTouches: [touch(x, y)] }));
      let last: readonly [number, number] = [0, 0];
      for (const [dx, dy] of path) {
        await new Promise((r2) => setTimeout(r2, 16));
        last = [dx, dy];
        el.dispatchEvent(new TouchEvent('touchmove', { bubbles: true, touches: [touch(x + dx, y + dy)], changedTouches: [touch(x + dx, y + dy)] }));
      }
      if (end) {
        await new Promise((r2) => setTimeout(r2, 800));
        el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(x + last[0], y + last[1])] }));
      }
    },
    { selector, path, end },
  );
}

/** Datenbankstand, sobald er sich 600 ms nicht mehr ändert (Hintergrundarbeiten nach dem Start sind dann fertig). */
async function stableDump(page: Page): Promise<string> {
  let prev = JSON.stringify(await dump(page));
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(600);
    const next = JSON.stringify(await dump(page));
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

/** Geänderte Dokumente zwischen zwei Ständen. */
function changedKeys(a: string, b: string): string[] {
  const x = JSON.parse(a) as Record<string, unknown>;
  const y = JSON.parse(b) as Record<string, unknown>;
  return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k]));
}

const cardTransform = (page: Page): Promise<string> => page.locator('.lx-swipe-card').evaluate((el) => (el as HTMLElement).style.transform);

/** Zählt rAF-Aufrufe ab jetzt (Hülle nach dem Start: die Test-Uhr ersetzt rAF beim Laden). */
async function installRafCounter(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __raf: number };
    w.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      w.__raf += 1;
      return orig(cb);
    };
  });
}
const rafCount = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __raf: number }).__raf);

/** Standbild, sobald Bildschirm und Bereichsfarbe stehen (zwei gleiche Lesungen im Abstand von 300 ms). */
async function stillFrame(page: Page): Promise<string> {
  const read = (): Promise<string> => page.getByTestId('ambient').evaluate((c) => (c as HTMLCanvasElement).toDataURL());
  let prev = await read();
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(300);
    const next = await read();
    if (next === prev) return next;
    prev = next;
  }
  return prev;
}

test.describe('Handy · Karten (P54)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('30 px senkrecht bewegt die Karte nicht; waagerecht folgt sie und färbt; ohne Entscheidung federt sie zurück', async ({ page }) => {
    await startAnki(page, 6, 'full');
    await page.getByTestId('flip-show').click();
    await expect(page.getByTestId('grades')).toBeVisible();
    expect(await page.locator('.lx-swipe-card').evaluate((el) => getComputedStyle(el).touchAction)).toBe('pan-y');
    expect(await page.evaluate(() => getComputedStyle(document.body).touchAction)).not.toBe('pan-y');
    const card = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';

    await touchPath(page, '[data-testid="flip-back"]', [[0, 10], [2, 20], [3, 30]], false);
    expect(await cardTransform(page)).toBe('');
    await expect(page.locator('.lx-swipe-card')).not.toHaveAttribute('data-swipe', /./);
    await page.evaluate(() => window.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true })));

    await touchPath(page, '[data-testid="flip-back"]', [[12, 0], [30, 2], [60, 3]], false);
    expect(await cardTransform(page)).toContain('translateX(60px)');
    await expect(page.locator('.lx-swipe-card')).toHaveAttribute('data-swipe', 'right');
    await page.evaluate(() => window.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true })));
    await expect.poll(() => cardTransform(page)).toBe('');
    // Noch dieselbe Karte: nichts wurde bewertet.
    await expect(page.getByTestId('flip')).toHaveAttribute('data-card', card);
  });

  test('Wischen nach links bewertet weiterhin (classifySwipe), die Karte fliegt hinaus, nie ein Leerbild', async ({ page }) => {
    await startAnki(page, 6, 'full');
    const a = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';
    await page.getByTestId('flip-show').click();
    await expect(page.getByTestId('grades')).toBeVisible();
    await page.evaluate(() => {
      const w = window as unknown as { __blank: number; __watch: boolean };
      w.__blank = 0;
      w.__watch = true;
      const tick = (): void => {
        if (!document.querySelector('[data-testid="flip"]')) w.__blank += 1;
        if (w.__watch) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await touchPath(page, '[data-testid="flip-back"]', [[-12, 0], [-60, 2], [-140, 3]], false);
    await page.evaluate(() => {
      const el = document.querySelector('[data-testid="flip-back"]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const t = new Touch({ identifier: 7, target: el, clientX: r.left + r.width / 2 - 140, clientY: r.top + 60 });
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t] }));
    });
    await expect(page.locator(`[data-testid="flip"][data-card="${a}"]`)).toHaveCount(0);
    await page.waitForTimeout(400);
    await page.evaluate(() => ((window as unknown as { __watch: boolean }).__watch = false));
    expect(await page.evaluate(() => (window as unknown as { __blank: number }).__blank)).toBe(0);
    await expect(page.locator('[data-stack-ghost]')).toHaveCount(0);
    await expect
      .poll(async () => (((await dump(page))[`vocab/${a}`] as Record<string, unknown>).hist as Array<Record<string, unknown>>).at(-1)?.g)
      .toBe(1);
  });

  test('Kartenwechsel: Median ≤ 250 ms bis alles steht, höchstens zwei Kanten dahinter', async ({ page }) => {
    await startAnki(page, 10, 'full');
    const times: number[] = [];
    for (let i = 0; i < 6; i++) {
      await expect(page.locator('.lx-stack-edge')).toHaveCount(2);
      await page.keyboard.press(' ');
      await expect(page.getByTestId('grades')).toBeVisible();
      const ms = await page.evaluate(
        () =>
          new Promise<number>((resolve) => {
            const before = document.querySelector('[data-testid="flip"]')?.getAttribute('data-card');
            const t0 = performance.now();
            (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: '3', bubbles: true }));
            const tick = (): void => {
              const card = document.querySelector('[data-testid="flip"]');
              const stack = document.querySelector('.lx-stack');
              const moving = (stack?.getAnimations({ subtree: true }) ?? []).some((a) => a.playState === 'running');
              if (card && card.getAttribute('data-card') !== before && !moving && !document.querySelector('[data-stack-ghost]')) resolve(performance.now() - t0);
              else requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
      );
      times.push(ms);
    }
    const s = [...times].sort((x, y) => x - y);
    const med = s[Math.floor(s.length / 2)] ?? 0;
    test.info().annotations.push({ type: 'kartenwechsel-ms', description: `${times.map((t) => t.toFixed(0)).join(', ')} · Median ${med.toFixed(0)}` });
    expect(med).toBeLessThanOrEqual(250);
  });
});

test.describe('Handy · Lichtfeld (P57)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('ersetzt den festen Verlauf; 12 s nach dem Wechsel kein einziger rAF mehr', async ({ page }) => {
    test.setTimeout(60_000);
    const { errors } = await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:fx': 'full' } });
    await installRafCounter(page);
    await expect(page.locator('html')).toHaveAttribute('data-ambient', '');
    await expect(page.getByTestId('ambient')).toHaveCount(1);
    expect(await page.evaluate(() => getComputedStyle(document.body, '::before').backgroundImage)).toBe('none');
    // In Bewegung: rAF läuft.
    const a = await rafCount(page);
    await page.waitForTimeout(500);
    expect(await rafCount(page)).toBeGreaterThan(a);
    await page.waitForTimeout(12_600);
    const b = await rafCount(page);
    await page.waitForTimeout(1500);
    expect(await rafCount(page)).toBe(b);
    expect(errors).toEqual([]);
  });

  test('reduzierte Bewegung: Standbild ab dem ersten Bild, deterministisch je Lerntag; axe ohne Befund', async ({ page, browser }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:fx': 'full' } });
    await installRafCounter(page);
    await expect(page.getByTestId('ambient')).toHaveCount(1);
    const first = await stillFrame(page);
    const n = await rafCount(page);
    await page.waitForTimeout(800);
    expect(await rafCount(page)).toBe(n);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const p2 = await ctx.newPage();
    await bootAt(p2, { name: 'apply' }, { localStorage: { 'lx:fx': 'full' } });
    await expect(p2.getByTestId('ambient')).toHaveCount(1);
    expect(await stillFrame(p2)).toBe(first);
    await ctx.close();
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
  });

  test('in Übungen gedimmt und still', async ({ page }) => {
    await startAnki(page, 4, 'full');
    await installRafCounter(page);
    await expect(page.getByTestId('ambient')).toHaveAttribute('data-exercise', 'true');
    await page.waitForTimeout(400);
    const n = await rafCount(page);
    await page.waitForTimeout(1200);
    // Keine Dauerschleife in der Übung (einzelne Bilder durch Fokus/Bedienung sind erlaubt, kein fortlaufendes Zeichnen).
    expect((await rafCount(page)) - n).toBeLessThan(10);
  });
});

test.describe('Handy · Momente ansehen und Aufstieg (P55, P56, P60)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  async function openDemo(page: Page, fx: 'full' | 'off') {
    const booted = await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:fx': fx } });
    await openSettings(page);
    const btn = page.getByTestId('moments-open');
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(page.getByTestId('moments-demo')).toBeVisible();
    return booted;
  }

  test('„Voll“: Tag spielt als Moment (data-moment), Funken-Ebene verschwindet wieder, Messzeile erscheint; nichts in der Datenbank', async ({ page }) => {
    const { errors } = await openDemo(page, 'full');
    const before = await stableDump(page);
    await page.getByTestId('demo-play-day').click();
    await expect(page.locator('html')).toHaveAttribute('data-moment', 'day');
    await expect(page.getByTestId('demo-day').getByTestId('today-ring')).toHaveAttribute('data-closed', 'true');
    await expect(page.locator('canvas[data-testid="fx-layer"]')).toHaveCount(1, { timeout: 2000 });
    await expect(page.locator('html')).not.toHaveAttribute('data-moment', /./, { timeout: 3000 });
    await expect(page.locator('canvas[data-testid="fx-layer"]')).toHaveCount(0, { timeout: 3000 });
    await expect(page.getByTestId('demo-day').getByTestId('odometer')).toHaveAttribute('data-phase', 'still');
    await expect(page.getByTestId('demo-day').getByTestId('odometer')).toHaveText('12');
    await expect(page.getByTestId('moment-lines')).toContainText('Tag geschafft');
    await expect(page.getByTestId('moment-lines')).toContainText('fps');
    await page.getByTestId('demo-play-round').click();
    await expect(page.getByTestId('demo-round')).toBeVisible();
    await expect(page.getByTestId('moment-lines')).toContainText('Runde geschafft', { timeout: 3000 });
    expect(changedKeys(before, JSON.stringify(await dump(page)))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('„Aus“: Endzustand sofort, kein Rollen, kein „0“-Zwischenbild, keine Funken', async ({ page }) => {
    await openDemo(page, 'off');
    await page.getByTestId('demo-play-day').click();
    const odo = page.getByTestId('demo-day').getByTestId('odometer');
    await expect(odo).toHaveAttribute('data-phase', 'still');
    await expect(odo).toHaveText('12');
    await expect(page.getByTestId('demo-day').getByTestId('today-ring')).toHaveAttribute('data-filled', '4');
    await expect(page.getByTestId('demo-day').getByTestId('today-ring')).not.toHaveAttribute('data-play', /.*/);
    await page.waitForTimeout(300);
    await expect(page.locator('canvas[data-testid="fx-layer"]')).toHaveCount(0);
  });

  test('Aufstieg: Fokus auf „Weiter“, Esc schließt (das Blatt bleibt offen), axe ohne Befund; Wort-Marke mit Zahl', async ({ page }) => {
    const { errors } = await openDemo(page, 'full');
    const before = await stableDump(page);
    await page.getByTestId('demo-play-level').click();
    const dlg = page.getByTestId('levelup');
    await expect(dlg).toBeVisible();
    await expect(dlg).toHaveAttribute('data-kind', 'chapter');
    await expect(page.getByTestId('levelup-continue')).toBeFocused();
    await expect(dlg.getByTestId('emblem')).toHaveAttribute('data-id', 'k3');
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('levelup-continue')).toBeFocused();
    await page.waitForTimeout(1500);
    const axe = await new AxeBuilder({ page }).include('[data-testid="levelup"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId('moments-open')).toBeVisible();
    await expect(page.getByTestId('demo-play-level')).toBeFocused();
    // Zweiter: C1, dritter: Wort-Marke mit rollender Zahl; Tippen neben die Karte schließt.
    await page.getByTestId('demo-play-level').click();
    await expect(dlg).toHaveAttribute('data-kind', 'c1');
    await page.getByTestId('levelup-continue').click();
    await page.getByTestId('demo-play-level').click();
    await expect(dlg).toHaveAttribute('data-kind', 'words');
    await expect(dlg.getByTestId('odometer')).toHaveAttribute('data-value', '500');
    await page.getByTestId('levelup-scrim').click({ position: { x: 10, y: 10 } });
    await expect(dlg).toHaveCount(0);
    // Die Vorschau merkt nichts und schreibt nichts.
    expect(await page.evaluate(() => window.localStorage.getItem('lx:moments-seen'))).toBeNull();
    expect(changedKeys(before, JSON.stringify(await dump(page)))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Lautstärke Leise/Normal bleibt auf dem Gerät', async ({ page }) => {
    await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:fx': 'off' } });
    await openSettings(page);
    const low = page.getByTestId('sound-vol-low');
    await low.scrollIntoViewIfNeeded();
    await low.click();
    expect(await page.evaluate(() => window.localStorage.getItem('lx:sound-vol'))).toBe('low');
  });
});

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Reiter-Pille gleitet (eine Pille), Lichtfeld liegt hinter allem', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:fx': 'full' } });
    await expect(page.locator('.dz-tab-pill:visible')).toHaveCount(1);
    await openTab(page, 'vocab');
    await expect(page.locator('.dz-tab-pill:visible')).toHaveCount(1);
    expect(await page.getByTestId('ambient').evaluate((el) => [getComputedStyle(el).position, getComputedStyle(el).zIndex, getComputedStyle(el).pointerEvents])).toEqual(['fixed', '-1', 'none']);
    expect(errors).toEqual([]);
  });
});
