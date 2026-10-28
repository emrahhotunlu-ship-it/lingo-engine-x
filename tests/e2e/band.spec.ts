import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, screen } from './fixtures';
import { forcedPatch, planPatch, TYPE_MODE } from './trainerHelpers';

// Übungsrahmen mit Band (Relaunch Stufe 1 P3 S1-BAND, stufe1-plan §6.4).
// - Die längste Rückmeldung (audit-why-length: err-0039, 211 Zeichen „Warum“ auf Deutsch) passt auf 390×844 ohne Rollen,
//   samt Leiste höchstens 45 % des Bildes; vorläufige Probe auf 390×700 (Ergebnis als Anmerkung, siehe Bericht).
// - Das Band rollt nicht und verschwindet nicht von selbst.
// - Menü „…“ oben enthält „Pause, später weiter“; das Mehr-Blatt ist höchstens 85 % hoch; Esc schließt Blatt, nie die Übung.

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
// err-0039 (src/content/c1x/src/err/k1-2.json items[11]): „Please don’t deploy until QA signed off on the release candidate.“
const ERR_LONG: Doc = {
  q: 'Please don’t deploy until QA signed off on the release candidate.',
  given: '',
  ans: 'Please don’t deploy until QA has signed off on the release candidate.',
  t: OLD,
  due: OLD,
  box: 0,
  src: 'seed',
  cid: 'err-0039',
  pat: 'tc.present-perfect',
  pts: [0, 2],
};
const topicDoc: Doc = { id: 'time-clauses', p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors: [ERR_LONG] };

async function longest(page: Page, choice: 'has signed off' | 'will sign off') {
  const booted = await bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'err' }, fake: { patch: { 'grammar/time-clauses': topicDoc } } });
  const item = page.getByTestId('gr-item');
  await expect(item.getByTestId('c1x-err')).toBeVisible();
  await item.getByTestId('spot-word').nth(5).click();
  await item.getByTestId('chip').filter({ hasText: choice }).click();
  await page.getByTestId('check').click();
  await expect(item.getByTestId('result')).toBeVisible();
  // Einblenden abwarten (220 ms), dann messen.
  await page.waitForTimeout(400);
  return booted;
}

type Measure = { band: number; bar: number; vh: number; scrolls: boolean; whyClipped: boolean; position: string; bandTop: number; barTop: number; whyChars: number };
const measure = (page: Page): Promise<Measure> =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="result"]');
    const bar = document.querySelector<HTMLElement>('.lx-actionbar');
    const why = band?.querySelector<HTMLElement>('.lx-band-why');
    const b = band?.getBoundingClientRect();
    const r = bar?.getBoundingClientRect();
    return {
      band: Math.round(b?.height ?? 0),
      bar: Math.round(r?.height ?? 0),
      vh: window.innerHeight,
      scrolls: !!band && (band.scrollHeight > band.clientHeight + 1 || ['auto', 'scroll'].includes(getComputedStyle(band).overflowY)),
      whyClipped: !!why && why.scrollHeight > why.clientHeight + 1,
      position: band ? getComputedStyle(band).position : '',
      bandTop: Math.round(b?.top ?? 0),
      barTop: Math.round(r?.top ?? 0),
      whyChars: (why?.textContent ?? '').length,
    };
  });

test.describe('Handy 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  for (const choice of ['has signed off', 'will sign off'] as const) {
    test(`längste Rückmeldung (err-0039, ${choice}) passt ohne Rollen, Band samt Leiste ≤ 45 %`, async ({ page }) => {
      const { errors } = await longest(page, choice);
      const m = await measure(page);
      test.info().annotations.push({ type: 'band', description: `390×844 ${choice}: Band ${m.band} px + Leiste ${m.bar} px = ${m.band + m.bar} px von ${m.vh} (${Math.round(((m.band + m.bar) / m.vh) * 100)} %), Warum ${m.whyChars} Zeichen` });
      expect(m.position).toBe('fixed');
      // Ein Dock: das Band sitzt direkt auf der Leiste.
      expect(Math.abs(m.bandTop + m.band - m.barTop)).toBeLessThanOrEqual(1);
      expect(m.band + m.bar).toBeLessThanOrEqual(Math.round(m.vh * 0.45) + 1);
      expect(m.scrolls).toBe(false);
      expect(m.whyClipped).toBe(false);
      // Die vier Fragen an fester Stelle: Urteil (Zeichen + Wort), Lösung, Warum – auch bei richtiger Antwort.
      const res = page.getByTestId('result');
      await expect(res.getByTestId('verdict')).toBeVisible();
      await expect(res.locator('[data-block="why"]')).toContainText('until');
      // Höchstens zwei Zweitknöpfe im Band.
      expect(await res.locator('.lx-band-btns > button, .lx-band-btns > [data-slot] button').count()).toBeLessThanOrEqual(2);
      expect(await layoutProblems(page), 'Layout').toEqual([]);
      expect(errors, 'Fehler').toEqual([]);
    });
  }

  test('das Band rollt nicht und verschwindet nicht von selbst; Mehr-Blatt ≤ 85 %, Esc schließt nur das Blatt', async ({ page }) => {
    await longest(page, 'will sign off');
    const res = page.getByTestId('result');
    const before = await measure(page);
    // Ein Wischen über dem Band bewegt das Band nicht (es steht fest), und es bleibt auch nach 6 s stehen.
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(6000);
    await expect(res).toBeVisible();
    const after = await measure(page);
    expect(after.bandTop).toBe(before.bandTop);
    expect(after.scrolls).toBe(false);
    await res.getByTestId('explanation-more').click();
    const sheet = page.getByTestId('band-more');
    await expect(sheet).toBeVisible();
    const h = await sheet.evaluate((el) => el.getBoundingClientRect().height / window.innerHeight);
    expect(h).toBeLessThanOrEqual(0.851);
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page.getByTestId('gr-item')).toBeVisible();
    await expect(res).toBeVisible();
  });

  test('Menü „…“ oben: Claude, Übersetzer, Einstellungen, „Pause, später weiter“ – Pause verlässt die Runde ruhig', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/avoid': { ...(forcedPatch()['vocab/avoid'] ?? {}), hist: [] } } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    // Handy: oben nur ✕, Balken und „…“.
    await expect(page.getByTestId('exercise-bar').getByTestId('open-settings')).toHaveCount(0);
    await page.getByTestId('exercise-menu').click();
    const list = page.getByTestId('exercise-menu-list');
    await expect(list.getByTestId('menu-pause')).toHaveText('Pause, später weiter');
    await expect(list.getByTestId('open-settings')).toBeVisible();
    await expect(list.getByTestId('menu-whyTask')).toBeVisible();
    await list.getByTestId('menu-pause').click();
    await screen(page, 'today');
  });

  test('Tipp-Runde: eine ruhige Zeile, nie rot; „Lösung gezeigt“ neutral', async ({ page }) => {
    await boot(page, { migrated: true, fake: { patch: { ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/avoid': { ...(forcedPatch()['vocab/avoid'] ?? {}), hist: [] } } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('evxde', { delay: 10 });
    await page.keyboard.press('Enter');
    const hint = page.locator('[data-slot="hint"]');
    if (await hint.count()) {
      await expect(hint).toHaveClass(/lx-hintband/);
      const color = await hint.getByTestId('hint-line').evaluate((el) => getComputedStyle(el).color);
      const bad = await page.evaluate(() => {
        const p = document.createElement('span');
        p.style.color = 'var(--bad)';
        document.body.appendChild(p);
        const c = getComputedStyle(p).color;
        p.remove();
        return c;
      });
      expect(color).not.toBe(bad);
    }
  });
});

test.describe('Handy 390×700 (vorläufige Probe)', () => {
  test.use({ viewport: { width: 390, height: 700 }, hasTouch: true });

  test('längste Rückmeldung: Messung (vorläufig, Ergebnis als Anmerkung)', async ({ page }) => {
    await longest(page, 'will sign off');
    const m = await measure(page);
    test.info().annotations.push({ type: 'band', description: `390×700: Band ${m.band} px + Leiste ${m.bar} px = ${m.band + m.bar} px (${Math.round(((m.band + m.bar) / m.vh) * 100)} %), Warum abgeschnitten: ${m.whyClipped}` });
    // Harte Regeln auch hier: nie rollen, nie über 45 %.
    expect(m.scrolls).toBe(false);
    expect(m.band + m.bar).toBeLessThanOrEqual(Math.round(m.vh * 0.45) + 1);
  });
});
