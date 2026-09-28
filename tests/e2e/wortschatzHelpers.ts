// E2E-Helfer des Bereichs „Wortschatz & Anki“ – Besitz: Paket P3 (docs/neubau/architektur.md §5.3).
// Gemeinsame Navigation (openTab, openEntry, openProfile, bootAt …) steht in `fixtures.ts` (WP0).

import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

type Doc = Record<string, unknown>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;

/** Seed-Vokabeln mit Bedeutung und Ursprungssatz (Reihenfolge fest). */
export const SEED_WORDS: string[] = Object.entries(SEED)
  .filter(([k, d]) => k.startsWith('vocab/') && typeof d.de === 'string' && typeof d.ex === 'string' && d.hidden !== true)
  .map(([k]) => k.slice(6));

/**
 * Genau `n` fällige Wiederholungskarten (Stufe 1, lange überfällig), alle übrigen Vokabeln, Wendungen
 * und Reparatur-Sätze aus dem Seed entfernt – so ist die Runde vorhersagbar.
 */
export function ankiPatch(n: number, over: Doc = {}): { patch: Record<string, Doc | null>; ids: string[] } {
  const ids = SEED_WORDS.slice(0, n);
  const patch: Record<string, Doc | null> = { 'app/repair': null };
  for (const k of Object.keys(SEED)) if (k.startsWith('vocab/') || k.startsWith('chunk/')) patch[k] = null;
  ids.forEach((id, i) => {
    patch[`vocab/${id}`] = { ...SEED[`vocab/${id}`], state: 'review', stage: 1, S: 3, D: 5, due: 1_600_000_000_000 + i * 1000, last: 1_599_000_000_000, reps: 3, lapses: 0, hist: [], fsrs: undefined, ...over };
  });
  return { patch, ids };
}

/** Letzter Wert der Messmarke `lx:card` (ms) am Trainer; `null`, solange noch keiner gemessen ist. */
export async function lastCardMs(page: Page): Promise<number | null> {
  const v = await page.getByTestId('trainer').getAttribute('data-card-ms');
  return v === null ? null : Number(v);
}

/** Synthetische Wischgeste (touchstart → touchend) auf einem Element. */
export async function swipe(page: Page, selector: string, dx: number, dy: number, ms = 180): Promise<void> {
  await page.evaluate(
    async ({ selector, dx, dy, ms }) => {
      const el = document.querySelector(selector);
      if (!el) throw new Error(`kein Element ${selector}`);
      const r = el.getBoundingClientRect();
      const x = Math.min(window.innerWidth - 80, Math.max(80, r.left + r.width / 2));
      const y = r.top + Math.min(r.height / 2, 60);
      const touch = (cx: number, cy: number) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: cy });
      el.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [touch(x, y)], changedTouches: [touch(x, y)] }));
      await new Promise((r2) => setTimeout(r2, ms));
      el.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [touch(x + dx, y + dy)] }));
    },
    { selector, dx, dy, ms },
  );
}

/** Großer Wortschatz (Browser-Test): `n` erfundene Vokabeln mit Satz. */
export function bigVocab(n: number): Record<string, Doc> {
  const out: Record<string, Doc> = {};
  for (let i = 0; i < n; i++) {
    const w = `term${String(i).padStart(4, '0')}`;
    out[`vocab/${w}`] = { word: w, de: `Begriff ${i}`, def: `made-up term ${i}`, ex: `We use the [${w}] daily.`, pos: 'noun', state: 'review', stage: 1 + (i % 5), S: 5, D: 5, due: 1_900_000_000_000, last: 1_599_000_000_000, reps: 2, lapses: 0, src: 'lookup', added: '2026-09-01' };
  }
  return out;
}
