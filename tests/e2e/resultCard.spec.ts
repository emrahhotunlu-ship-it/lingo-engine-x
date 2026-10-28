import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, screen, type Theme } from './fixtures';
import { MON, MON_9, WEEK_W39, profileWith, reviewedLog, vgPlan } from './heuteHelpers';
import { answerGrammar, grammarKey, nextItem, skipMiniLesson } from './learnHelpers';
import { forcedPatch, planPatch, TYPE_MODE } from './trainerHelpers';

// UX-Audit U3 (27.10.2026): Rückmeldung wie ein Produkt.
// Ein Bauplan für alle Übungsarten – höchstens drei Blöcke (Urteil+Lösung · Warum · Merke), der Rest hinter EINEM „Mehr“;
// auf 390×844 ohne Scrollen sichtbar; das Lernwort höchstens zweimal; Abschlussmomente ruhig, bei reduzierter Bewegung nur Überblenden.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const BLOCKS = '[data-block="verdict"], [data-block="why"], [data-block="remember"]';

/** Unterkante des letzten offenen Blocks gegen die Oberkante der Aktionsleiste (fest unten am Handy). */
async function fitsAboveBar(page: Page): Promise<{ bottom: number; limit: number }> {
  return page.evaluate(() => {
    const res = document.querySelector('[data-testid="result"]');
    const blocks = res ? [...res.querySelectorAll('[data-block="verdict"], [data-block="why"], [data-block="remember"]')] : [];
    const last = blocks[blocks.length - 1];
    const bar = document.querySelector('.lx-actionbar');
    const limit = bar ? bar.getBoundingClientRect().top : window.innerHeight;
    return { bottom: last ? Math.round(last.getBoundingClientRect().bottom) : 0, limit: Math.round(limit) };
  });
}

/** Text der offenen Ergebnis-Karte ohne den Bereich „Mehr“. */
const openText = (page: Page) =>
  page.getByTestId('result').evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('[data-slot="more"], .sr-only').forEach((x) => x.remove());
    return c.textContent ?? '';
  });

const count = (text: string, word: string): number => (text.toLowerCase().match(new RegExp(`(^|[^a-z])${word}(?=$|[^a-z])`, 'g')) ?? []).length;

async function wordResult(page: Page, theme?: Theme, wrong = false) {
  await boot(page, { migrated: true, ...(theme ? { theme } : {}), fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/avoid': { ...(forcedPatch()['vocab/avoid'] ?? {}), hist: [] } } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await page.getByTestId('gap-input').click();
  await page.keyboard.type(wrong ? 'evade' : 'avoid', { delay: 10 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toBeVisible();
}

test('Wörter: höchstens drei Blöcke, ohne Scrollen sichtbar, Lernwort höchstens zweimal, ein „Mehr“', async ({ page }) => {
  await wordResult(page);
  const res = page.getByTestId('result');
  expect(await res.locator(BLOCKS).count()).toBeLessThanOrEqual(3);
  await expect(res.getByTestId('explanation-more')).toHaveCount(1);
  const { bottom, limit } = await fitsAboveBar(page);
  expect(bottom).toBeGreaterThan(0);
  expect(bottom).toBeLessThanOrEqual(limit);
  expect(count(await openText(page), 'avoid')).toBeLessThanOrEqual(2);
  // Überall dieselbe Überschrift „Warum“ – nie „Richtig, weil“ oder „Claude sagt“ als Block-Überschrift.
  await expect(res).not.toContainText('Richtig, weil');
  expect(await layoutProblems(page)).toEqual([]);
});

test('Grammatik: Urteil, Lösung, Warum und Merke auf 390×844 ohne Scrollen; beginnt so hoch wie die Wörter', async ({ page }) => {
  const solve = grammarKey();
  await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': { id: 'used-to', p: 0.5, n: 14, c: 10, last: Date.parse('2026-09-18T10:00:00+02:00'), hist: [{ d: '2026-09-10', p: 0.4 }], recent: [1, 1, 1], seen: [], seenText: [], errors: [] } } } });
  await skipMiniLesson(page);
  await expect(page.getByTestId('gr-item')).toBeVisible();
  // Kein reservierter Platz über der Aufgabe: die Statuszeile steht direkt unter der Kopfzeile (vorher ~64 Geräte-px tiefer).
  // Gemessen ab der Inhaltskante der Karte (P1 S1-TOK: Kartenpolster 1,5rem statt 1,25rem), damit nur reservierter Platz zählt.
  const gap = await page.evaluate(() => {
    const exEl = document.querySelector('[data-testid="exercise"]');
    if (!exEl) return 999;
    const cs = getComputedStyle(exEl);
    const ex = exEl.getBoundingClientRect().top + parseFloat(cs.paddingTop) + parseFloat(cs.borderTopWidth);
    const st = document.querySelector('[data-slot="status"]')?.getBoundingClientRect().top ?? 0;
    return Math.round(st - ex);
  });
  expect(gap).toBeLessThan(4);
  await answerGrammar(page, solve, { wrong: true });
  const res = page.getByTestId('result');
  await expect(res).toBeVisible();
  expect(await res.locator(BLOCKS).count()).toBeLessThanOrEqual(3);
  await expect(res.locator('[data-block="why"]')).toContainText('Warum');
  const { bottom, limit } = await fitsAboveBar(page);
  expect(bottom).toBeLessThanOrEqual(limit);
});

test('Reduzierte Bewegung: die Ergebnis-Karte blendet nur über (keine Verschiebung)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await wordResult(page);
  await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
  const style = (await page.getByTestId('result').getAttribute('style')) ?? '';
  expect(style).not.toMatch(/translateY\((?!0)/);
});

for (const theme of ['dark', 'dim', 'light'] as const) {
  test(`Modus ${theme}: leise Knöpfe und Chips haben Fläche, die Spur ist sichtbar`, async ({ page }) => {
    await wordResult(page, theme);
    await page.getByTestId('explanation-more').click();
    const looks = await page.evaluate(() => {
      const bg = (s: string) => {
        const el = document.querySelector(s);
        return el ? getComputedStyle(el).backgroundColor : null;
      };
      const page = getComputedStyle(document.body).backgroundColor;
      return { chip: bg('[data-chip]'), page, track: getComputedStyle(document.documentElement).getPropertyValue('--lx-track').trim() };
    });
    expect(looks.track).not.toBe('');
    if (looks.chip) {
      expect(looks.chip).not.toBe('rgba(0, 0, 0, 0)');
      expect(looks.chip).not.toBe(looks.page);
    }
    expect(await layoutProblems(page)).toEqual([]);
  });
}

test('Zwischenkarte: Ring und Häkchen in Smaragd, Knopf „Weiter: …“ nennt den nächsten Schritt', async ({ page }) => {
  test.slow();
  // Bewegung an (die Tests laufen sonst mit Stufe „Aus“): Ring 250 ms, danach das Häkchen.
  await boot(page, { migrated: true, now: MON_9, localStorage: { 'lx:fx': 'full' }, fake: { capabilities: { sample: false }, patch: { ...WEEK_W39, ...profileWith(MON, vgPlan(), []), ...reviewedLog(MON) } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'grammarSession');
  const solve = grammarKey();
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    await answerGrammar(page, solve);
    await nextItem(page);
  }
  await page.getByTestId('session-end-next').click();
  await expect(page.getByTestId('unit-between')).toBeVisible();
  const mark = page.getByTestId('done-mark');
  await expect(mark).toBeVisible();
  await expect(page.getByTestId('unit-next')).toContainText(/^Weiter: .+/);
  // Smaragd ist das Token --lx-ok (P1 S1-TOK); Lightning CSS schreibt oklch als lab(), daher Pixelvergleich (±1) statt Farbtext.
  const ring = await mark.locator('.lx-done-ring').evaluate((el) => {
    const cs = getComputedStyle(el);
    const px = (color: string): number[] => {
      const c = document.createElement('canvas');
      c.width = c.height = 1;
      const g = c.getContext('2d');
      if (!g) return [];
      g.fillStyle = color;
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data];
    };
    const probe = document.createElement('span');
    probe.style.color = 'var(--lx-ok)';
    el.parentElement?.appendChild(probe);
    const ok = getComputedStyle(probe).color;
    probe.remove();
    const a = px(cs.stroke);
    const b = px(ok);
    return { delta: a.length && b.length ? Math.max(...a.map((v, i) => Math.abs(v - (b[i] ?? 0)))) : 255, rgb: a, dur: cs.animationDuration };
  });
  expect(ring.delta).toBeLessThanOrEqual(1);
  // Smaragd: Grün überwiegt Rot und Blau.
  expect(ring.rgb[1] ?? 0).toBeGreaterThan(Math.max(ring.rgb[0] ?? 255, ring.rgb[2] ?? 255));
  expect(ring.dur).toBe('0.25s');
});
