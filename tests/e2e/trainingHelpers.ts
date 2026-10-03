import { expect, type Page } from '@playwright/test';
import { dump } from './trainerHelpers';

// E2E-Helfer des Bereichs „Training“ (neue Übungen) – Besitz: Paket P7 (docs/neubau/plan.md §4.8).
// Gemeinsame Navigation (openTab, openEntry, openProfile, bootAt …) steht in `fixtures.ts` (WP0).

/** In die kinetische Lücke tippen und prüfen (Enter). */
export async function typeGap(page: Page, text: string): Promise<void> {
  const input = page.getByTestId('gap-input');
  await expect(input).not.toHaveAttribute('aria-hidden', 'true');
  await input.focus();
  await page.keyboard.type(text, { delay: 5 });
  await page.getByTestId('drill-check').click();
}

/** Einträge in `out/<Monat>` aus dem Abzug der Test-Datenbank. */
export async function outItems(page: Page, day = '2026-09-20', month = day.slice(0, 7)): Promise<Array<Record<string, unknown>>> {
  const d = await dump(page);
  const items = d[`out/${month}`]?.items;
  // Nur Einträge des Stichtags (der Seed enthält ältere Beispiele).
  return (Array.isArray(items) ? (items as Array<Record<string, unknown>>) : []).filter((x) => x.d === day);
}

/** Einträge im Tagesprotokoll mit `type`-Präfix `nb-`. */
export async function nbLog(page: Page, day = '2026-09-20'): Promise<Array<Record<string, unknown>>> {
  const d = await dump(page);
  const e = d[`log/${day}`]?.entries;
  return (Array.isArray(e) ? (e as Array<Record<string, unknown>>) : []).filter((x) => typeof x.type === 'string' && x.type.startsWith('nb-'));
}
