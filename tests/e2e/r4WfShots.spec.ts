import { readdirSync, readFileSync } from 'node:fs';
import { test } from '@playwright/test';
import { bootAt } from './fixtures';
import { typeInGap } from './learnHelpers';

// Bildschirmfotos der Übung „Wort umbauen“ (R4 P38) nach `docs/umbau/design-vergleich/r4-wf-*.png`.
// Läuft nur auf Zuruf (`LX_SHOTS=1`), sonst übersprungen: Bilder sind Belege für Emrah und den ux-reviewer, keine Prüfung.

const OUT = 'docs/umbau/design-vergleich';
const on = !!process.env.LX_SHOTS;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');

type Wf = { id: string; text: string; accept: string[]; pat: string };
function wfBy(word: string): Wf {
  const dir = new URL('../../src/content/c1x/src/wf/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const hit = (JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { items: Wf[] }).items.find((i) => i.accept[0] === word);
    if (hit) return hit;
  }
  throw new Error(word);
}

test.describe('Fotos Wort umbauen', () => {
  test.skip(!on, 'nur mit LX_SHOTS=1');
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const theme of ['dark', 'light'] as const) {
    test(`Frage und Ergebnis ${theme}`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      const it = wfBy('unauthorized');
      const err = { q: it.text, given: '', ans: it.accept[0], t: OLD, due: OLD, box: 0, src: 'seed', cid: it.id, pat: it.pat, pts: [0, 1] };
      const topic = { id: 'passive-plus', p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors: [err] };
      await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { theme, localStorage: { 'lx:fx': 'full' }, fake: { patch: { 'grammar/passive-plus': topic } } });
      const item = page.getByTestId('gr-item');
      await item.getByTestId('wf-stem').waitFor();
      await page.waitForTimeout(700);
      await page.screenshot({ path: `${OUT}/r4-wf-frage-390-${theme === 'dark' ? 'dunkel' : 'hell'}.png` });
      await typeInGap(page, it.accept[0] ?? '');
      await page.getByTestId('check').click();
      await item.getByTestId('morph-split').waitFor();
      await page.waitForTimeout(1400);
      await page.screenshot({ path: `${OUT}/r4-wf-ergebnis-390-${theme === 'dark' ? 'dunkel' : 'hell'}.png`, fullPage: true });
    });
  }
});
