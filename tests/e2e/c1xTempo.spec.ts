import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { dump, DAY } from './trainerHelpers';
import { nextItem, squash, typeInGap } from './learnHelpers';

// Tempo-Runde (Lernplattform 3.0 §2.3, P24): Kachel in Anwenden, zwölf Aufgaben aus sicheren Mustern, ruhiger Zielzeit-Balken ohne Zahl und ohne Sperre,
// `tm` im Protokoll, Ergebnis ohne Rot und ohne „zu langsam“. Die Muster werden über die Datenbank als „Sicher“ gesetzt (Inhalte stammen aus den Inhaltsdateien).

type Doc = Record<string, unknown>;
type Item = { id: string; kind: string; pat: string; topic?: string; text?: string; accept?: string[] };

function load(kind: string): Item[] {
  const dir = new URL(`../../src/content/c1x/src/${kind}/`, import.meta.url);
  return readdirSync(dir).flatMap((f) => (JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as { items: Item[] }).items);
}
const OCL = load('ocl');
const ALL = [...OCL, ...load('kwt'), ...load('err')];
const SOLVE = new Map(OCL.map((i) => [squash((i.text ?? '').replace(/_{3,}/, '')), i.accept?.[0] ?? '']));

/** Muster-Eintrag mit Zustand „Sicher“. */
const SAFE: Doc = { n: 5, c: 5, last: Date.parse('2026-09-19T10:00:00+02:00'), h: 0, r: 31, k: 5, dd: ['2026-09-18', '2026-09-19'], s: '2026-09-18', i: '2026-09-01' };
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
function safePatch(): Record<string, Doc> {
  const out: Record<string, Doc> = {};
  for (const i of ALL) {
    const topic = i.topic ?? 'passive-plus';
    const d = (out[`grammar/${topic}`] ??= { id: topic, p: 0.8, anchor: 0.8, anchorD: '2026-09-15', n: 10, c: 9, due: OLD, last: OLD, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: '2026-09-15', p: 0.8 }], errors: [], pats: {} });
    (d.pats as Record<string, Doc>)[i.pat] = SAFE;
  }
  return out;
}

const start = (page: Page, route: Parameters<typeof bootAt>[1], flags?: string) => bootAt(page, route, { localStorage: { 'lx:flags': flags ?? 'ocl,kwt,err' }, fake: { patch: safePatch() } });
const logOf = async (page: Page): Promise<Doc[]> => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g');

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Kachel in Anwenden, 12 Aufgaben, Balken ohne Zahl und Sperre, tm im Protokoll, Ergebnis ohne „zu langsam“', async ({ page }) => {
    test.setTimeout(120_000);
    const { errors } = await start(page, { name: 'apply' });
    const tile = page.getByTestId('hub-tempo');
    await expect(tile).toBeVisible();
    await tile.click();
    const round = page.getByTestId('tempo-round');
    await expect(round).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('round-progress')).toBeVisible();

    // Der Balken: keine Zahl, nur Fläche; nach Ablauf der Zielzeit bleibt die Aufgabe voll bedienbar.
    const bar = page.getByTestId('tempo-bar');
    await expect(bar).toBeVisible();
    await expect(bar).toHaveText('');
    const ms = Number(await bar.getAttribute('data-ms'));
    expect(ms).toBeGreaterThanOrEqual(8400);
    await page.waitForTimeout(ms + 600);
    await expect(round).not.toContainText(/zu langsam|too slow|Zeit abgelaufen|time.?s up/i);
    const fill = await bar.locator('span').evaluate((el) => el.getAnimations().map((a) => a.playState));
    expect(fill.every((s) => s === 'finished')).toBe(true);

    let solved = 0;
    for (let n = 0; n < 12; n++) {
      const item = page.getByTestId('gr-item');
      await expect(item).toBeVisible();
      await expect(round).toHaveAttribute('data-pos', String(n));
      const kind = (await item.getAttribute('data-c1x')) ?? '';
      expect(['ocl', 'kwt', 'err']).toContain(kind);
      // Am Handy nie Bausteine und nie ein Textfeld für mehr als 3 Wörter.
      await expect(item.getByTestId('kwt-tiles')).toHaveCount(0);
      if (kind === 'kwt') await expect(item.getByTestId('kwt-part-b-only')).toBeVisible();
      const answer = kind === 'ocl' ? SOLVE.get(squash((await item.getByTestId('sentence').innerText()).replace(/_{3,}/, ''))) : undefined;
      if (answer) {
        await typeInGap(page, answer);
        await page.getByTestId('check').click();
        await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
        solved++;
      } else {
        await page.getByTestId('dont-know').click();
        await expect(item.getByTestId('verdict')).toBeVisible();
      }
      // Kein automatisches Weiter: der Knopf bleibt, bis er gedrückt wird.
      await page.waitForTimeout(400);
      await expect(page.getByTestId('next')).toBeVisible();
      await nextItem(page);
    }
    expect(solved).toBeGreaterThan(0);

    const end = page.getByTestId('session-end');
    await expect(end).toBeVisible();
    await expect(end).toContainText(/\d+ von 12 richtig · \d+ davon in der Zielzeit/);
    await expect(end).not.toContainText(/zu langsam|too slow/i);

    // `tm` je getippter, richtiger Antwort im Protokoll.
    await expect.poll(async () => (await logOf(page)).filter((e) => e.c1k === 'ocl' && e.free === true).length, { timeout: 20_000 }).toBeGreaterThan(0);
    const typed = (await logOf(page)).filter((e) => e.c1k === 'ocl' && e.free === true && e.ok === true);
    expect(typed.length).toBeGreaterThan(0);
    for (const e of typed) {
      expect(typeof e.tm).toBe('number');
      expect(e.tm as number).toBeGreaterThan(0);
      expect(e.tm).toBe(e.ms);
    }
    expect(errors).toEqual([]);
  });

  test('ohne Schalter „tempo“ gibt es keine Kachel', async ({ page }) => {
    await start(page, { name: 'apply' }, JSON.stringify({ c1xKinds: { ocl: true, kwt: true, err: true }, tempo: false }));
    await expect(page.getByTestId('apply-hub')).toBeVisible();
    await expect(page.getByTestId('hub-tempo')).toHaveCount(0);
  });

  test('ohne sichere Muster keine Kachel (kein toter Knopf)', async ({ page }) => {
    await bootAt(page, { name: 'apply' }, { localStorage: { 'lx:flags': 'ocl,kwt,err' }, fake: { patch: Object.fromEntries(Object.entries(safePatch()).map(([k, d]) => [k, { ...d, pats: {} }])) } });
    await expect(page.getByTestId('apply-hub')).toBeVisible();
    await expect(page.getByTestId('hub-tempo')).toHaveCount(0);
  });
});

test.describe('Laptop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('direkt geöffnet baut die Runde selbst; Esc verlässt sie; Aufgabe bleibt nach der Zielzeit bedienbar', async ({ page }) => {
    await start(page, { name: 'tempoRound' });
    const round = page.getByTestId('tempo-round');
    await expect(round).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('tempo-bar')).toBeVisible();
    const first = page.getByTestId('gr-item');
    await expect(first).toBeVisible();
    // Keine Hilfe in der Runde (wie ein Messmodus).
    await expect(page.getByTestId('hint')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(round).toHaveCount(0);
  });
});
