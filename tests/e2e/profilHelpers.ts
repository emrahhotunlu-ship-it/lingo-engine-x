import { expect, type Page } from '@playwright/test';
import { openProfile, screen } from './fixtures';

// E2E-Helfer des Bereichs „Profil, Stand & Claude“ – Besitz: Paket P6 (docs/neubau/architektur.md §5.3).
// Gemeinsame Navigation (openTab, openEntry, openProfile, bootAt …) steht in `fixtures.ts` (WP0).
// Profil-Zeilen (Test-IDs): profile-judge|errors|path|stats|history, profile-check, profile-vtest,
// profile-weekly, profile-settings, profile-rescue-row.

/** Profil öffnen (Blatt bzw. bis WP0b die Seite mit den Profil-Abschnitten) und warten, bis der Kopf steht. */
export async function openProfileContent(page: Page): Promise<void> {
  await openProfile(page);
  await expect(page.getByTestId('profile-head')).toBeVisible();
}

/** Eine Zeile im Profil antippen (2 Tipps ab jeder Reiter-Wurzel). */
export async function openProfileRow(page: Page, testId: string): Promise<void> {
  await openProfileContent(page);
  await page.getByTestId(testId).click();
}

/** „Dein Stand“ direkt auf einem Reiter (über das Profil). */
export async function openStandTab(page: Page, tab: 'judge' | 'errors' | 'path' | 'stats' | 'history'): Promise<void> {
  await openProfileRow(page, `profile-${tab}`);
  await screen(page, 'overview');
  await expect(page.getByTestId(`tab-${tab}`)).toHaveAttribute('aria-selected', 'true');
}

/** Seite „Wochen-Check“ (Start und bisherige Checks). */
export async function openChecks(page: Page): Promise<void> {
  await openProfileRow(page, 'profile-check');
  await screen(page, 'checks');
}

/** Seite „Wochenbericht“. */
export async function openWeekly(page: Page): Promise<void> {
  await openProfileRow(page, 'profile-weekly');
  await screen(page, 'weekly');
}

/** Wortschatztest bis zum ersten Wort. */
export async function startVtest(page: Page): Promise<void> {
  await openProfileRow(page, 'profile-vtest');
  await screen(page, 'vtest');
  await page.getByTestId('vt-start').click();
}
