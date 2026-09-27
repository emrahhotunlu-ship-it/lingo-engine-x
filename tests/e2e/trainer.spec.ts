import { expect, test } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { DAY, answerCurrent, dump, forcedPatch, planPatch } from './trainerHelpers';

// Vokabeltrainer (Phase 1, MVP): jede Abfrageart einmal, Tastatur, Schreibwege, fliegende
// Buchstaben, reduzierte Bewegung. Gegen den Produktions-Build mit eingespieltem Adapter.

test.use({ viewport: { width: 1440, height: 900 } });

const CATALOG_IDS = ['mc_en', 'spot', 'listen_mc', 'mc_de', 'match', 'cloze_hint', 'tiles', 'type', 'cloze', 'colloc', 'situation', 'dictation', 'speed', 'produce'];

test('komplette Pflichtrunde per Tastatur: jede Abfrageart, Schreibwege, danach „Fertig für heute"', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(6), ...forcedPatch() } } });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveText('Noch 6 Karten');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');

  const seen = new Set<string>();
  for (let i = 0; i < 30; i++) {
    await expect(page.locator('[data-step]')).toHaveCount(1);
    if (await page.getByTestId('summary').isVisible()) break;
    expect(await layoutProblems(page)).toEqual([]);
    seen.add(await answerCurrent(page));
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  // Jede der sechs erzwungenen Arten kommt vor; Wiedervorlagen dürfen weitere Arten des Katalogs zeigen.
  expect([...seen]).toEqual(expect.arrayContaining(['cloze', 'cloze_hint', 'colloc', 'mc_de', 'mc_en', 'type']));
  for (const ex of seen) expect(CATALOG_IDS).toContain(ex);
  // Je Wort genau ein Chip, auch wenn eine Karte in der Runde wiederkam.
  const chipWords = await page.getByTestId('summary-chip').allInnerTexts();
  expect(chipWords.length).toBeGreaterThan(0);
  expect(new Set(chipWords).size).toBe(chipWords.length);

  // Schreibwege: Karte mit FSRS und gespiegelten Altfeldern, Protokoll, Zähler.
  await expect.poll(async () => ((await dump(page))[`log/${DAY}`]?.entries as unknown[] | undefined)?.filter((e) => (e as { ctx?: string }).ctx === 'rev').length ?? 0).toBeGreaterThanOrEqual(6);
  const db = await dump(page);
  const card = db['vocab/struggle'] as Record<string, unknown> & { fsrs: Record<string, number | string>; hist: Array<Record<string, unknown>> };
  expect(card.fsrs).toMatchObject({ v: 1, src: 'lx' });
  expect(card.S).toBe(Math.min(Number(card.fsrs.stability), 365));
  expect(card.due).toBe(card.fsrs.due);
  expect(card.last).toBe(card.fsrs.last);
  expect(card.state).toMatch(/^(learning|review)$/);
  expect(card.reps).toBe(4);
  expect(card.hist.at(-1)).toMatchObject({ m: 'type' });
  expect(card.xs).toMatchObject({ type: { c: 1, w: 6 } });
  expect(card.word).toBe('to struggle');
  const log = db[`log/${DAY}`] as { entries: Array<Record<string, unknown>> };
  expect(log.entries.find((e) => e.id === 'struggle' && e.ctx === 'rev')).toMatchObject({ k: 'v', m: 'tr-type', ok: true, lang: 'de', ans: 'to struggle' });
  const profile = db['app/profile'] as { days: Record<string, number>; act: Record<string, Record<string, number>>; minutes: Record<string, number> };
  const answers = log.entries.filter((e) => e.ctx === 'rev').length;
  expect(profile.days[DAY]).toBe(62 + answers);
  expect(profile.act[DAY]?.review).toBe(2);
  expect(profile.minutes[DAY]).toBeGreaterThanOrEqual(16);

  // Zurück zu Heute: erledigt ist Zustand, kein Knopf; Extra klar getrennt.
  await page.getByTestId('summary-back').click();
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveText('Fertig für heute');
  await expect(page.getByTestId('done-item')).toBeVisible();
  await expect(page.getByTestId('done-item').locator('button')).toHaveCount(0);
  await expect(page.getByTestId('start')).toHaveCount(0);
  await expect(page.getByTestId('start-extra')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('die fliegenden Buchstaben landen in der Lücke; falsche Antwort zeigt die Lösung', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(1), 'vocab/avoid': forcedPatch()['vocab/avoid'] ?? {} } } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze_hint');
  // Letzte Position jedes Fliegers vor dem Entfernen mitschreiben.
  await page.evaluate(() => {
    const w = window as unknown as { __flights: Array<{ x: number; y: number; w: number; h: number }> };
    w.__flights = [];
    const last = new Map<Element, DOMRect>();
    const tick = () => {
      document.querySelectorAll('[data-flyer]').forEach((el) => last.set(el, el.getBoundingClientRect()));
      requestAnimationFrame(tick);
    };
    tick();
    new MutationObserver((ms) => {
      for (const m of ms)
        m.removedNodes.forEach((n) => {
          const els = n instanceof Element ? [n, ...Array.from(n.querySelectorAll('[data-flyer]'))] : [];
          for (const el of els) {
            const r = last.get(el);
            if (r) w.__flights.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height });
          }
        });
    }).observe(document.body, { childList: true, subtree: true });
  });
  await page.getByTestId('gap-input').click();
  await page.keyboard.type('avoid', { delay: 60 });
  await expect(page.locator('[data-flyer]')).toHaveCount(0);
  await expect(page.locator('[data-letter][data-landed="true"]')).toHaveCount(5);
  await page.waitForTimeout(400);
  const gap = await page.getByTestId('gap').boundingBox();
  const flights = await page.evaluate(() => (window as unknown as { __flights: Array<{ x: number; y: number }> }).__flights);
  expect(flights.length).toBeGreaterThanOrEqual(5);
  const letters = await page.locator('[data-letter]').evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => ({ l: r.left, r: r.right, t: r.top, b: r.bottom })));
  expect(gap).not.toBeNull();
  if (gap) {
    for (const f of flights) {
      expect(f.x).toBeGreaterThanOrEqual(gap.x - 2);
      expect(f.x).toBeLessThanOrEqual(gap.x + gap.width + 2);
      expect(f.y).toBeGreaterThanOrEqual(gap.y - 4);
      expect(f.y).toBeLessThanOrEqual(gap.y + gap.height + 4);
    }
    for (const l of letters) {
      expect(l.l).toBeGreaterThanOrEqual(gap.x - 1);
      expect(l.r).toBeLessThanOrEqual(gap.x + gap.width + 1);
      expect(l.t).toBeGreaterThanOrEqual(gap.y - 1);
      expect(l.b).toBeLessThanOrEqual(gap.y + gap.height + 1);
    }
  }
  // Löschen und falsch abschließen: rot, die Lösung erscheint darunter.
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Backspace');
  await expect(page.locator('[data-letter]')).toHaveCount(3);
  await page.keyboard.type('di');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('gap')).toHaveAttribute('data-state', 'near');
  await expect(page.getByTestId('solution')).toContainText('avoid');
  await expect(page.getByTestId('verdict')).toHaveText('Fast richtig – Tippfehler');
  await expect(page.getByTestId('due-in')).toHaveAttribute('data-grade', '2');
  expect(errors).toEqual([]);
});

test('Handy mit Touch: Tippen auf die Lücke fokussiert das Eingabefeld, kein Querscrollen; reduzierte Bewegung ohne Flieger', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(1), 'vocab/struggle': forcedPatch()['vocab/struggle'] ?? {} } } });
  await screen(page, 'today');
  await page.getByTestId('start').tap();
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'type');
  await page.getByTestId('gap-input').tap();
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('gap-input');
  let flyers = 0;
  for (const ch of 'strugle') {
    await page.keyboard.type(ch);
    flyers += await page.locator('[data-flyer]').count();
  }
  expect(flyers).toBe(0);
  await expect(page.getByTestId('gap')).toContainText('strugle');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'near');
  expect(await layoutProblems(page)).toEqual([]);
  await page.keyboard.press('Escape');
  await screen(page, 'today');
  expect(errors).toEqual([]);
  await context.close();
});
