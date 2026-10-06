import { expect, type Page } from '@playwright/test';

// Lernplattform 2.0 §4.2: Jede Übung zeichnet ihre Plätze in fester Reihenfolge (`data-slot`).
export const SLOT_ORDER = ['status', 'task', 'aid', 'prompt', 'answer', 'secondary', 'hint', 'verdict', 'comparison', 'explanation', 'examples', 'menu'] as const;
export type Slot = (typeof SLOT_ORDER)[number];

/** Die sichtbaren Plätze der Übung im DOM, in Lesereihenfolge. */
export async function slotsOf(page: Page, scope = '[data-testid="exercise"]'): Promise<string[]> {
  return page.locator(`${scope} [data-slot]`).evaluateAll((els) => els.map((el) => el.getAttribute('data-slot') ?? ''));
}

/** Die Plätze stehen in der Reihenfolge von `SLOT_ORDER` (fehlende dürfen fehlen, doppelte nicht). */
export async function expectSlotOrder(page: Page, scope = '[data-testid="exercise"]'): Promise<string[]> {
  const found = await slotsOf(page, scope);
  const idx = found.map((s) => SLOT_ORDER.indexOf(s as Slot));
  expect(idx.every((i) => i >= 0), `unbekannter Platz in ${JSON.stringify(found)}`).toBe(true);
  expect(idx, `Reihenfolge der Plätze ${JSON.stringify(found)}`).toEqual([...idx].sort((a, b) => a - b));
  expect(new Set(found).size, `doppelter Platz in ${JSON.stringify(found)}`).toBe(found.length);
  return found;
}
