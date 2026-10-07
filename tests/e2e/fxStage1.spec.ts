import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootAt, openSettings } from './fixtures';
import { typeInGap } from './learnHelpers';

// Effekte-Fundament und Antwort-Momente, Stufe 1 (Lernplattform 3.0 P30, §6.1): Farbe, gezeichnetes ✓/✕ und Füllung der Lücke, jedes höchstens 220 ms;
// im Lesefenster (Erklärung, Beispiele, Vergleich) läuft nach 400 ms keine Animation; bei Stufe `off` steht sofort der Endzustand;
// reduzierte Bewegung erzwingt `off`. Alle anderen Specs laufen mit `lx:fx=off` (tests/e2e/fixtures.ts), nur hier wird Bewegung eingeschaltet.

type Doc = Record<string, unknown>;
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
type Item = { id: string; kind: string; pat: string; topic?: string; text?: string; accept?: string[]; options?: string[]; answer?: number };

function itemOf(kind: 'ocl' | 'mcc', id: string): Item {
  const dir = new URL(`../../src/content/c1x/src/${kind}/`, import.meta.url);
  for (const f of readdirSync(dir)) {
    const hit = (JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { items: Item[] }).items.find((i) => i.id === id);
    if (hit) return hit;
  }
  throw new Error(`Aufgabe ${id} nicht gefunden`);
}
const OCL = itemOf('ocl', 'ocl-0007');
const MCC = itemOf('mcc', 'mcc-0049');

const errorOf = (it: Item, ans: string): Doc => ({ q: it.text, given: '', ans, t: OLD, due: OLD, box: 0, src: 'seed', cid: it.id, pat: it.pat, pts: [0, 1] });
const topicDoc = (topic: string, errors: Doc[]): Doc => ({ id: topic, p: 0.5, anchor: 0.5, anchorD: '2026-09-15', n: 8, c: 6, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.5 }], errors });

function start(page: Page, it: Item, fx: 'full' | 'calm' | 'off' | null = 'calm') {
  const topic = it.topic ?? 'passive-plus';
  const ans = it.kind === 'mcc' ? (it.options?.[it.answer ?? 0] ?? '') : (it.accept?.[0] ?? '');
  return bootAt(page, { name: 'grammarSession', mode: 'errors' }, { localStorage: { 'lx:flags': 'mcc,ocl', ...(fx ? { 'lx:fx': fx } : {}) }, fake: { patch: { [`grammar/${topic}`]: topicDoc(topic, [errorOf(it, ans)]) } } });
}

type Anim = { name: string; end: number; pseudo: string | null; state: string; css: boolean };
/** Alle laufenden Animationen und Übergänge unter dem Urteil und der Lücke, mit Endzeit (inkl. Verzögerung). */
const animsAround = (page: Page): Promise<Anim[]> =>
  page.evaluate(() => {
    const roots = [document.querySelector('[data-testid="verdict-block"]'), document.querySelector('[data-testid="gap"]'), ...Array.from(document.querySelectorAll('[data-testid="choice"]'))].filter((x): x is Element => !!x);
    const out: Array<{ name: string; end: number; pseudo: string | null; state: string; css: boolean }> = [];
    for (const a of document.getAnimations()) {
      const eff = a.effect as KeyframeEffect | null;
      const target = eff?.target ?? null;
      if (!target || !roots.some((r) => r === target || r.contains(target))) continue;
      out.push({ name: (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty ?? 'anim', end: Number(eff?.getComputedTiming().endTime ?? 0), pseudo: eff?.pseudoElement ?? null, state: a.playState, css: a instanceof CSSAnimation || a instanceof CSSTransition });
    }
    return out;
  });

const readingWindow = (page: Page): Promise<number> =>
  page.evaluate(() => ['explanation', 'examples', 'comparison'].reduce((n, s) => n + (document.querySelector(`[data-slot="${s}"]`)?.getAnimations({ subtree: true }).length ?? 0), 0));

test.describe('Stufe „Ruhig“ (Handy)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('richtig (Lücke): ✓ wird aufgezogen, die Lücke füllt sich, alles höchstens 220 ms, kein Lichtimpuls', async ({ page }) => {
    const { errors } = await start(page, OCL);
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'calm');
    await typeInGap(page, OCL.accept?.[0] ?? '');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    const anims = await animsAround(page);
    const names = anims.map((a) => a.name);
    expect(names).toContain('ee-draw');
    expect(names).toContain('ee-fill');
    expect(names).not.toContain('lx-pulse');
    for (const a of anims) expect(a.end, a.name).toBeLessThanOrEqual(220);
    // Das Zeichen ist nach der Zeichenzeit voll da, die Füllung hat die Endfarbe.
    await page.waitForTimeout(350);
    const clip = await page.locator('[data-testid="verdict"] .ee-mark').evaluate((el) => getComputedStyle(el).clipPath);
    expect(clip).toMatch(/^inset\(0px 0(px|%) 0px 0px\)$/);
    expect((await animsAround(page)).filter((a) => a.state === 'running')).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('im Lesefenster läuft nach 400 ms keine Animation (Erklärung, Beispiele, Vergleich)', async ({ page }) => {
    await start(page, OCL);
    await typeInGap(page, OCL.accept?.[0] ?? '');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toBeVisible();
    await expect(page.locator('[data-slot="explanation"]')).toBeVisible();
    await page.waitForTimeout(450);
    expect(await readingWindow(page)).toBe(0);
  });

  test('falsch (Auswahl): ✕ wird aufgezogen in höchstens 220 ms, kein Schütteln, kein Lichtimpuls', async ({ page }) => {
    const { errors } = await start(page, MCC);
    const wrong = (MCC.options ?? []).findIndex((_, i) => i !== MCC.answer);
    await page.getByTestId('gr-item').getByTestId('choice').nth(wrong).click();
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    const anims = await animsAround(page);
    expect(anims.map((a) => a.name)).toContain('ee-draw');
    expect(anims.map((a) => a.name).filter((n) => /pulse|shake|wobble/i.test(n))).toEqual([]);
    for (const a of anims) expect(a.end, a.name).toBeLessThanOrEqual(220);
    await page.waitForTimeout(450);
    expect(await readingWindow(page)).toBe(0);
    expect(errors).toEqual([]);
  });

  test('die Farbe „Richtig“ bleibt: die Füllung der Lücke hat am Ende dieselbe Farbe wie bei Stufe „Aus“', async ({ page }) => {
    await start(page, OCL);
    await typeInGap(page, OCL.accept?.[0] ?? '');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    await page.waitForTimeout(350);
    const fill = await page.getByTestId('gap').evaluate((el) => getComputedStyle(el, '::before').backgroundColor);
    // Gleiche Gap-Farbe, wenn die Stufe auf „Aus“ wechselt (dann färbt die Lücke selbst).
    await page.evaluate(() => {
      document.documentElement.dataset.fx = 'off';
    });
    const off = await page.getByTestId('gap').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(fill).toBe(off);
    expect(fill).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('Stufe „Aus“ und reduzierte Bewegung', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('„Aus“: sofort der Endzustand, keine laufende Animation, Zeichen ganz da', async ({ page }) => {
    await start(page, OCL, 'off');
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
    await typeInGap(page, OCL.accept?.[0] ?? '');
    await page.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    // Keine CSS-Animation und kein CSS-Übergang (die Bewegung der Buchstaben in der Lücke ist nicht Teil der Stufe 1).
    expect((await animsAround(page)).filter((a) => a.css)).toEqual([]);
    // Das Zeichen steht sofort ganz da (kein Zuschnitt, keine Animation).
    expect(await page.locator('[data-testid="verdict"] .ee-mark').evaluate((el) => getComputedStyle(el).clipPath)).toBe('none');
    const bg = await page.getByTestId('gap').evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('„Voll“ mit reduzierter Bewegung am Gerät wird zu „Aus“', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await start(page, OCL, 'full');
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
  });

  // Angepasst 07.10.2026 (Design-Lead): der Standard ist jetzt „Voll“ (Emrahs Wunsch nach Spiel-Gefühl); vorher „Ruhig“.
  test('ohne gespeicherte Wahl gilt „Voll“', async ({ page }) => {
    // Ein leerer Wert überspringt den Testumgebungs-Standard „Aus“ und ist keine gültige Wahl: es gilt der Standard „Voll“.
    await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:fx': '' } });
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'full');
  });
});

test.describe('Einstellungen › Effekte', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Wahl Voll · Ruhig · Aus wirkt sofort, bleibt auf dem Gerät und zeigt Diagnosezeilen', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:fx': 'calm' } });
    await openSettings(page);
    const section = page.getByTestId('fx-section');
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveAttribute('data-level', 'calm');
    await expect(page.getByTestId('fx-now')).toContainText('Ruhig');
    await expect(page.getByTestId('fx-frames')).toBeVisible();
    await page.getByTestId('fx-off').click();
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'off');
    await expect(section).toHaveAttribute('data-level', 'off');
    expect(await page.evaluate(() => window.localStorage.getItem('lx:fx'))).toBe('off');
    await page.getByTestId('fx-full').click();
    await expect(page.locator('html')).toHaveAttribute('data-fx', 'full');
    expect(await page.evaluate(() => window.localStorage.getItem('lx:fx'))).toBe('full');
    expect(errors).toEqual([]);
  });
});
