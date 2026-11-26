import { expect, test, type Page } from '@playwright/test';
import { bootAt, MIGRATED, SEED_EVENING, screen } from './fixtures';

// Stimme 2.0 (Emrah 26.11.2026: „auf Handy und Mac IMMER die gute Stimme, schnell und immer verfügbar“): Ist ein Satz noch nicht gerechnet,
// zeigt der Anhören-Knopf einen ruhigen Lade-Zustand und die gute Stimme spielt, sobald sie fertig ist – nie die Gerätestimme. Die
// Gerätestimme spricht nur, wenn die gute Stimme hier gar nicht lädt. Die neue Stimme ist nachgebildet (Entwicklungs-Adapter, fakeNeural.ts).

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const D = 86_400_000;

function uDueLex(): Doc {
  const t = NOW - 30 * D;
  const day = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const fs = { s: 2.3065, d: 2.1181, st: 2, reps: 1, lapses: 0, last: t + 300_000, sd: 1, ls: 0 };
  return {
    v: 1, k: 'w', of: null, core: null, sense: null, lv: 4,
    u: { due: NOW - D, ...fs }, b: { due: NOW + 20 * D, ...fs },
    day, dayU: null, step: null, ev: { f: [day, day], o: 0, s: 0 }, sn: [['a', day]], gr: null, reg: null, pri: 'core',
    lc: 0, pair: null, mv: 0, sync: NOW - D, mig: null, intro: day,
  };
}

// Anki-Karte („to achieve“ mit Satz): der Knopf „Satz anhören“ liest den ganzen Satz vor.
const patch = (): Record<string, Doc> => ({
  'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
  'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1, anki: 1 }, newPerDay: 0 },
  'vocab/achieve': { lex: uDueLex() },
});

type W = { __played: number; __LINGO_FAKE__: { spoken: string[]; neural: string[] } };
const played = (page: Page) => page.evaluate(() => (window as unknown as W).__played);
const spoken = (page: Page) => page.evaluate(() => [...(window as unknown as W).__LINGO_FAKE__.spoken]);
const computed = (page: Page) => page.evaluate(() => [...(window as unknown as W).__LINGO_FAKE__.neural]);

async function countPlayback(page: Page): Promise<void> {
  // Gespielte Töne der neuen Stimme zählen (der stumme Ein-Abtastwert-Ton zum Freischalten am iPhone zählt nicht).
  await page.addInitScript(() => {
    const w = window as unknown as W;
    w.__played = 0;
    const proto = AudioBufferSourceNode.prototype as unknown as { start: (this: AudioBufferSourceNode, ...a: unknown[]) => void };
    const start = proto.start;
    proto.start = function (this: AudioBufferSourceNode, ...a: unknown[]) {
      if ((this.buffer?.length ?? 0) > 1) w.__played += 1;
      start.apply(this, a);
    };
  });
}

test('Satz noch nicht gerechnet: Knopf wartet sichtbar, dann spielt die gute Stimme – keine Gerätestimme; nochmal sofort', async ({ page }) => {
  await countPlayback(page);
  const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch(), neural: { delayMs: 2_500 } } });
  await screen(page, 'vlearn');
  const listen = page.getByTestId('vm-listen');
  await expect(listen).toBeVisible();
  const sentence = (await page.getByTestId('vm-sentence').innerText()).trim();
  await listen.click();
  await expect(listen).toHaveAttribute('data-voice-wait', '');
  await expect(listen).toHaveAttribute('aria-busy', 'true');
  await expect.poll(() => played(page), { timeout: 15_000 }).toBeGreaterThan(0);
  await expect(listen).not.toHaveAttribute('data-voice-wait');
  expect(await computed(page)).toContain(sentence);
  expect((await spoken(page)).join(' ')).not.toContain(sentence);
  // Zweiter Tipp: aus dem Gedächtnis, ohne Lade-Zustand und ohne neues Rechnen.
  const before = await played(page);
  const n = (await computed(page)).length;
  await listen.click();
  await expect.poll(() => played(page), { timeout: 1_000 }).toBeGreaterThan(before);
  expect((await computed(page)).length).toBe(n);
  expect(errors).toEqual([]);
});

test('gute Stimme lädt hier gar nicht: die Gerätestimme spricht', async ({ page }) => {
  await countPlayback(page);
  const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch(), neural: { fail: true } } });
  await screen(page, 'vlearn');
  const listen = page.getByTestId('vm-listen');
  const sentence = (await page.getByTestId('vm-sentence').innerText()).trim();
  // Laden scheitert kurz nach dem Start (Status „failed“).
  await page.waitForTimeout(800);
  await listen.click();
  await expect.poll(async () => (await spoken(page)).join(' ')).toContain(sentence.slice(0, 20));
  expect(await played(page)).toBe(0);
  await expect(listen).not.toHaveAttribute('data-voice-wait');
  expect(errors).toEqual([]);
});
