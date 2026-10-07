import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { typeInGap } from './learnHelpers';

// Engine-Schicht (Design-Lead 07.10.2026): Teilchen nur bei Stufe „Voll“ (eine Canvas-Ebene, die nach dem Effekt wieder verschwindet),
// „Ruhig“ und „Aus“ ohne Teilchen; im Lesefenster läuft nach 450 ms nichts. Dazu eine Bildzeit-Messung unter 4× CPU-Drosselung (Protokoll).

type Doc = Record<string, unknown>;
type Item = { id: string; kind: string; pat: string; topic?: string; text?: string; accept?: string[] };
const OLD = Date.parse('2020-01-01T10:00:00+01:00');

function itemOf(id: string): Item {
  const dir = new URL('../../src/content/c1x/src/ocl/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const hit = (JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { items: Item[] }).items.find((i) => i.id === id);
    if (hit) return hit;
  }
  throw new Error(id);
}
const OCL = itemOf('ocl-0007');

function start(page: Page, fx: 'full' | 'calm' | 'off') {
  const topic = OCL.topic ?? 'passive-plus';
  const err: Doc = { q: OCL.text, given: '', ans: OCL.accept?.[0] ?? '', t: OLD, due: OLD, box: 0, src: 'seed', cid: OCL.id, pat: OCL.pat, pts: [0, 1] };
  const doc: Doc = { id: topic, p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors: [err] };
  return bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'mcc,ocl', 'lx:fx': fx }, fake: { patch: { [`grammar/${topic}`]: doc } } });
}

const readingWindow = (page: Page): Promise<number> =>
  page.evaluate(() => ['explanation', 'examples', 'comparison'].reduce((n, s) => n + (document.querySelector(`[data-slot="${s}"]`)?.getAnimations({ subtree: true }).length ?? 0), 0));

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('„Voll“: richtig → Teilchen-Ebene erscheint und verschwindet wieder; Lesefenster ruhig nach 450 ms', async ({ page }) => {
    const { errors } = await start(page, 'full');
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'full');
    await typeInGap(page, OCL.accept?.[0] ?? '');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await expect(page.locator('canvas[data-testid="fx-layer"]')).toHaveCount(1);
    await page.waitForTimeout(450);
    expect(await readingWindow(page)).toBe(0);
    await expect(page.locator('canvas[data-testid="fx-layer"]')).toHaveCount(0, { timeout: 4000 });
    expect(errors).toEqual([]);
  });

  for (const fx of ['calm', 'off'] as const) {
    test(`„${fx}“: keine Teilchen`, async ({ page }) => {
      await start(page, fx);
      await typeInGap(page, OCL.accept?.[0] ?? '');
      await page.getByTestId('check').click();
      await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
      await page.waitForTimeout(300);
      await expect(page.locator('canvas[data-testid="fx-layer"]')).toHaveCount(0);
    });
  }

  test('Bildzeiten während des Richtig-Moments unter 4× CPU-Drosselung (Protokoll, Grenze großzügig)', async ({ page }) => {
    await start(page, 'full');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await typeInGap(page, OCL.accept?.[0] ?? '');
    await page.evaluate(() => {
      const w = window as unknown as { __lxFrames: number[] };
      w.__lxFrames = [];
      let last = 0;
      const tick = (t: number): void => {
        if (last) w.__lxFrames.push(t - last);
        last = t;
        if (w.__lxFrames.length < 60) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByTestId('check').click();
    await page.waitForFunction(() => (window as unknown as { __lxFrames: number[] }).__lxFrames.length >= 60, null, { timeout: 15000 });
    const d = await page.evaluate(() => (window as unknown as { __lxFrames: number[] }).__lxFrames.slice(5));
    const s = [...d].sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)] ?? 0;
    const p95 = s[Math.floor(s.length * 0.95)] ?? 0;
    console.warn(`fx-moment 4x: median ${med.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms, max ${(s[s.length - 1] ?? 0).toFixed(1)} ms`);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    // Die Cloud hat kein iPhone: nur eine grobe Schranke gegen Ausreißer (Messung am Gerät: Einstellungen › Effekte).
    expect(med).toBeLessThanOrEqual(50);
  });
});
