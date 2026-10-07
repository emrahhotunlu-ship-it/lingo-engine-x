import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, crashOnce, openTab, screen } from './fixtures';
import { DAY, dump, planPatch } from './trainerHelpers';
import { ankiPatch, lastCardMs, swipe } from './wortschatzHelpers';

// Anki-Modus „Aufdecken“ (plan.md N20/N21/N29, anki-regeln.md): 40 Karten am Stück, Vorderseite
// Bedeutung + Satz mit Lücke, Rückseite voll, 4 Knöpfe mit Intervall und Vorschlag, Tasten 1–4,
// Wischen, Schreibweg (xs.flip, hist x:'flip', fsrs zusätzlich, alte Felder gespiegelt).

type Doc = Record<string, unknown>;

async function startReview(page: Page): Promise<void> {
  await screen(page, 'today');
  await openTab(page, 'vocab');
  await page.getByTestId('ws-review').click();
  await screen(page, 'trainer');
}

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('40 Karten am Stück aufdecken und bewerten: lx:card < 50 ms (Median), Schreibweg je Karte', async ({ page }) => {
    const { patch, ids } = ankiPatch(40);
    const { errors, external } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(40), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } } } } });
    await startReview(page);
    const seen: string[] = [];
    const ms: number[] = [];
    for (let i = 0; i < 40; i++) {
      if (i > 0) {
        await expect.poll(() => lastCardMs(page)).not.toBeNull();
        ms.push((await lastCardMs(page)) ?? 0);
      }
      const flip = page.getByTestId('flip');
      await expect(flip).toBeVisible();
      const card = (await flip.getAttribute('data-card')) ?? '';
      seen.push(card);
      if (i === 0) {
        // Vorderseite: Bedeutung + Lücke, keine Lösung im DOM, kein ▶ (anki-regeln §0).
        await expect(page.getByTestId('flip-front')).not.toBeEmpty();
        await expect(page.getByTestId('flip-gap')).toBeVisible();
        await expect(page.getByTestId('flip-listen')).toHaveCount(0);
        await expect(flip).toHaveAttribute('data-dir', 'de-en');
      }
      await page.keyboard.press(' ');
      await expect(page.getByTestId('grades')).toBeVisible();
      if (i === 0) {
        await expect(page.getByTestId('flip-answer')).toBeVisible();
        await expect(page.locator('[data-testid="grades"] button')).toHaveCount(4);
        await expect(page.locator('[data-testid="grades"] button[data-suggest]')).toHaveCount(1);
        for (const iv of await page.locator('[data-testid="grades"] button small').allInnerTexts()) expect(iv).toMatch(/\d/);
        await expect(page.getByTestId('grades-note')).toBeVisible();
      }
      // Taste 3 = Gut (Review-Karten: keine Wiedervorlage in der Runde).
      await page.keyboard.press('3');
      await expect(page.locator(`[data-testid="flip"][data-card="${card}"]`)).toHaveCount(0);
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    expect(new Set(seen).size).toBe(40);
    expect(ms.length).toBe(39);
    const sorted = [...ms].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(50);
    // Schreibweg: jede Karte einmal, Stufe höchstens 2, alte Felder gespiegelt.
    const flipped = async () => {
      const db = await dump(page);
      return ids.filter((id) => (((db[`vocab/${id}`]?.xs as Doc | undefined)?.flip as Doc | undefined)?.c ?? 0) === 1).length;
    };
    await expect.poll(flipped, { timeout: 15_000 }).toBe(40);
    const db = await dump(page);
    for (const id of ids) {
      const d = db[`vocab/${id}`] as Doc;
      expect(d.stage).toBe(2);
      expect((d.fsrs as Doc).due).toBe(d.due);
      expect((d.hist as Doc[]).at(-1)).toMatchObject({ x: 'flip', m: 'recog', g: 3 });
      expect(d.word).toBeTruthy();
    }
    const log = ((db[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => ids.includes(String(e.id)) && e.m === 'tr-flip');
    expect(log.length).toBe(40);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Nochmal: Wiedervorlage nach 5 anderen Karten, wieder aufgedeckt, höchstens Gut', async ({ page }) => {
    const { patch } = ankiPatch(8);
    await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(8), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip' } } } } });
    await startReview(page);
    const first = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';
    await page.keyboard.press(' ');
    await page.keyboard.press('1');
    const order: string[] = [];
    for (let i = 0; i < 6; i++) {
      const flip = page.getByTestId('flip');
      await expect(flip).toBeVisible();
      order.push((await flip.getAttribute('data-card')) ?? '');
      await page.keyboard.press(' ');
      await expect(page.getByTestId('grades')).toBeVisible();
      if (i === 5) {
        const s = Number(await flip.getAttribute('data-suggest'));
        expect(s).toBeLessThanOrEqual(3);
      }
      await page.keyboard.press('3');
      await expect(page.locator('[data-testid="flip"][data-shown]')).toHaveCount(0);
    }
    expect(order.slice(0, 5)).not.toContain(first);
    expect(order[5]).toBe(first);
  });

  test('Stapel mit Richtung Englisch → Deutsch: Vorderseite Englisch, Rückseite Bedeutung', async ({ page }) => {
    const { patch } = ankiPatch(3, { src: 'preply' });
    await boot(page, { migrated: true, fake: { patch: { ...patch, 'app/decks': { v: 1, builtin: { 'src:preply': { mode: 'flip', dir: 'en-de' } } } } } });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await page.getByTestId('ws-decks-all').click();
    await page.locator('[data-testid="ws-deck"][data-deck="src:preply"]').click();
    await screen(page, 'deck');
    await page.getByTestId('deck-start').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('flip')).toHaveAttribute('data-dir', 'en-de');
  });
});

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Wischen: links = Nochmal, rechts = Vorschlag; kein Querüberstand', async ({ page }) => {
    const { patch, ids } = ankiPatch(8);
    const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(8), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip' } } } } });
    await startReview(page);
    const a = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';
    await page.getByTestId('flip-show').click();
    await expect(page.getByTestId('grades')).toBeVisible();
    await swipe(page, '[data-testid="flip-back"]', -140, 0);
    await expect(page.locator(`[data-testid="flip"][data-card="${a}"]`)).toHaveCount(0);
    const b = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';
    await page.getByTestId('exercise').click();
    await expect(page.getByTestId('grades')).toBeVisible();
    const suggest = Number(await page.getByTestId('flip').getAttribute('data-suggest'));
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await swipe(page, '[data-testid="flip-back"]', 140, 0);
    await expect(page.locator(`[data-testid="flip"][data-card="${b}"]`)).toHaveCount(0);
    await expect
      .poll(async () => {
        const db = await dump(page);
        const ga = ((db[`vocab/${a}`] as Doc).hist as Doc[]).at(-1)?.g;
        const gb = ((db[`vocab/${b}`] as Doc).hist as Doc[]).at(-1)?.g;
        return [ga, gb];
      })
      .toEqual([1, suggest]);
    expect(ids).toContain(a);
    expect(errors).toEqual([]);
  });
});

// G5: Hauptbildschirme je Modus mit axe, keine ernsten Verstöße.
for (const theme of ['dark', 'dim', 'light'] as const) {
  test(`axe · Wortschatz + Aufdecken · ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const { patch } = ankiPatch(3);
    await boot(page, { theme, migrated: true, fake: { patch: { 'app/profile': planPatch(3), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip' } } } } });
    const scan = async (name: string) => {
      // Kartenwechsel (`itemEnter`, 150 ms) abwarten: axe rechnet den Kontrast sonst mit der halb eingeblendeten Karte.
      await page.waitForTimeout(450);
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const serious = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${name} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    };
    await startReview(page);
    await scan('flip-front');
    await page.getByTestId('flip-show').click();
    await expect(page.getByTestId('grades')).toBeVisible();
    await scan('flip-back');
    await page.getByTestId('trainer-close').click();
    await screen(page, 'vocab');
    await scan('vocab');
  });
}

// G3/N04: Neuladen bei Karte 23 setzt bei 23 fort, ohne doppelten Schreibvorgang (WP0b-Fortsetzen).
test('Neuladen bei Karte 23: gleiche Stelle, kein doppelter Eintrag', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { patch, ids } = ankiPatch(30);
  await boot(page, { migrated: true, fake: { persist: true, patch: { 'app/profile': planPatch(30), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip' } } } } as never });
  await startReview(page);
  for (let i = 0; i < 22; i++) {
    const card = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';
    await page.keyboard.press(' ');
    await page.keyboard.press('3');
    await expect(page.locator(`[data-testid="flip"][data-card="${card}"]`)).toHaveCount(0);
  }
  const at23 = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';
  await expect(page.getByTestId('trainer-progress')).toContainText('23');
  const logged = async () => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => ids.includes(String(e.id)) && e.m === 'tr-flip').length;
  await expect.poll(logged).toBe(22);
  await page.reload();
  await screen(page, 'trainer');
  await expect(page.getByTestId('flip')).toHaveAttribute('data-card', at23);
  await expect(page.getByTestId('trainer-progress')).toContainText('23');
  expect(await logged()).toBe(22);
});

// G4: Eine Karte stürzt ab (`lx:crash-once=trainer`) → „Diese Aufgabe überspringen“, die Runde endet regulär.
test('Kaputte Karte wird übersprungen, ohne Bewertung; die Runde endet regulär', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { patch, ids } = ankiPatch(3);
  await boot(page, { migrated: true, localStorage: crashOnce('trainer'), fake: { patch: { 'app/profile': planPatch(3), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip' } } } } });
  await startReview(page);
  await page.getByTestId('boundary-skip').click();
  for (let i = 0; i < 2; i++) {
    const card = (await page.getByTestId('flip').getAttribute('data-card')) ?? '';
    await page.keyboard.press(' ');
    await page.keyboard.press('3');
    await expect(page.locator(`[data-testid="flip"][data-card="${card}"]`)).toHaveCount(0);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  // B4: Die vorletzte Aufdeck-Bewertung wird erst mit der letzten festgeschrieben – daher abwarten.
  await expect.poll(async () => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => ids.includes(String(e.id)) && e.m === 'tr-flip').length).toBe(2);
});

// Befund 29.09. (Emrahs Kommentar): eine Karte ohne Beispielsatz zeigte auf der Rückseite gar
// keinen Satz (Kap. 15: keine Karte ohne Ursprungssatz). Betrifft z. B. Karten aus der Umstellung
// der alten App, die nie einen Satz hatten. Claude ergänzt jetzt beim Aufdecken einen Satz, genau
// wie im Tippen-Modus (ExerciseView.tsx).
test('Karte ohne Beispielsatz: Claude ergänzt beim Aufdecken einen Satz (einmalig, gespeichert)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { patch, ids } = ankiPatch(1, { ex: '', col: [] });
  await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(1), ...patch, 'app/decks': { v: 1, prefs: { mode: 'flip' } } } } });
  await startReview(page);
  const id = ids[0] ?? '';
  await expect(page.getByTestId('flip')).toHaveAttribute('data-card', id);
  await page.getByTestId('flip-show').click();
  await page.getByTestId('examples-more').click();
  await expect(page.getByTestId('example').first()).toBeVisible();
  await expect
    .poll(async () => ((await dump(page))[`vocab/${id}`]?.xEx as Doc[] | undefined)?.length ?? 0)
    .toBeGreaterThan(0);
});
