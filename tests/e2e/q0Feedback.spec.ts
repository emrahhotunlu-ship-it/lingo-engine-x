import { expect, test, type Page } from '@playwright/test';
import { bootAt, type Theme } from './fixtures';

// Paket Q0 (Aufgaben-Qualität): die Lernenden-Ansicht echter Aufgaben mit anderen richtigen Antworten.
//  · art-snd-k2 (Schlüsselwort MBA, LP2-Adapter `kwt-v2-7`): kurze Lösung → eine Lücke, EIN Wortzähler, keine Teile A/B, keine Teilpunkte;
//    „an mba“ klein → angenommen, die Lücke zeigt „an MBA“ mit Hinweis; „her MBA“ → „Auch richtig“ mit Musterlösung.
//  · pc-rc-k1 (LATELY, `kwt-v2-948`): „have gotten longer lately“ → „Auch richtig“, keine Begründung „Richtig: have been getting …“.
// Fotos für die Bildschirm-Prüfung (G2): test-results/q0/<zustand>-<breite>-<modus>.png.

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
const RECENT = Date.parse('2026-09-20T08:00:00+02:00');
const errorOf = (cid: string, q: string, ans: string, pat: string): Doc => ({ q, given: '', ans, t: OLD, due: OLD, box: 0, src: 'seed', cid, pat, pts: [0, 2] });
const topicDoc = (id: string, p: number, err: Doc): Doc => ({ id, p, anchor: p, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: p > 0.7 ? RECENT : OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p }], errors: [err] });

const MBA = { topic: 'articles', err: errorOf('kwt-v2-7', 'Last spring, Maria earned ___.', 'an MBA', 'art.sound') };
const LATELY = { topic: 'pres-perf-cont', err: errorOf('kwt-v2-948', 'Our response times ___.', 'have been getting longer lately', 'pc.recent') };

async function start(page: Page, t: { topic: string; err: Doc }, p: number, theme: Theme = 'dark') {
  return bootAt(page, { name: 'grammarSession', mode: 'errors' }, { theme, localStorage: { 'lx:flags': 'kwt' }, fake: { patch: { [`grammar/${t.topic}`]: topicDoc(t.topic, p, t.err) } } });
}
async function answer(page: Page, text: string) {
  await page.getByTestId('gap-input').focus();
  await page.keyboard.type(text, { delay: 5 });
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toBeVisible();
}
const shot = async (page: Page, name: string, w: number, theme: Theme) => {
  // Erst fotografieren, wenn die Buchstaben gelandet sind (UX-Prüfung: Fotos mitten in der Animation).
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  await page.screenshot({ path: `test-results/q0/${name}-${w}-${theme}.png`, fullPage: false });
};

for (const vp of [{ w: 390, h: 844, touch: true }, { w: 1440, h: 900, touch: false }]) {
  test.describe(`${vp.w} px`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, hasTouch: vp.touch });

    test('MBA: eine Lücke, ein Zähler; „an mba“ angenommen mit richtiger Schreibung', async ({ page }) => {
      const { errors } = await start(page, MBA, 0.95);
      const item = page.getByTestId('gr-item');
      await expect(item.getByTestId('c1x-kwt')).toHaveAttribute('data-kwt-mode', 'desk');
      await expect(item.getByTestId('kwt-part')).toHaveCount(0);
      await expect(item.getByTestId('word-counter')).toHaveCount(1);
      await answer(page, 'an mba');
      await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
      await expect(page.getByTestId('verdict-sub')).toContainText('MBA schreibt man groß');
      await expect(page.getByTestId('verdict-sub')).not.toContainText('von 2');
      await expect(item.getByTestId('c1x-kwt')).toContainText('an MBA');
      await shot(page, 'mba-case', vp.w, 'dark');
      expect(errors).toEqual([]);
    });

    for (const theme of ['dark', 'dim', 'light'] as const) {
      test(`MBA: „her MBA“ → Auch richtig mit Musterlösung (${theme})`, async ({ page }) => {
        const { errors } = await start(page, MBA, 0.95, theme);
        await answer(page, 'her MBA');
        await expect(page.getByTestId('verdict')).toContainText('Auch richtig');
        await expect(page.getByTestId('verdict-sub')).toContainText('Musterlösung: an MBA');
        await shot(page, 'mba-also', vp.w, theme);
        expect(errors).toEqual([]);
      });
    }

    // Am Handy kommt die lange Lösung als Bausteine bzw. Teil A/B; getippt wird sie am Laptop (gleiche Rückmeldung, `useC1Item`).
    test('LATELY: „have gotten longer lately“ → Auch richtig, keine widersprechende Begründung', async ({ page }) => {
      test.skip(vp.touch, 'lange Lösung am Handy: Bausteine');
      const { errors } = await start(page, LATELY, 0.5);
      await answer(page, 'have gotten longer lately');
      await expect(page.getByTestId('verdict')).toContainText('Auch richtig');
      await expect(page.getByTestId('verdict-sub')).toContainText('Musterlösung: have been getting longer lately');
      await expect(page.getByTestId('gr-item')).not.toContainText('Richtig: have been getting');
      // In eine einzige Lücke getippt: keine Teilpunkte, keine Teile.
      await expect(page.getByTestId('verdict-sub')).not.toContainText('von 2');
      await shot(page, 'lately-also', vp.w, 'dark');
      expect(errors).toEqual([]);
    });
  });
}
