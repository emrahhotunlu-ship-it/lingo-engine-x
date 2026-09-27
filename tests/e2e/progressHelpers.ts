import { expect, type Page } from '@playwright/test';
import { openOverview, screen } from './fixtures';
import { typeInGap } from './learnHelpers';

// Rundgang durch die Phase-6-Bildschirme (Plan §13): die vier Reiter von „Dein Stand", der
// Wochen-Check (erste Aufgabe, M10) und der Wortschatztest (Einstieg, Ja/Nein, Bedeutung).
// `visit(name)` prüft bzw. fotografiert je Station.

export async function progressTour(page: Page, visit: (name: string) => Promise<void>): Promise<void> {
  await openOverview(page);
  for (const id of ['judge', 'errors', 'path', 'history'] as const) {
    await page.getByTestId(`tab-${id}`).click();
    await expect(page.getByTestId(`tab-${id}`)).toHaveAttribute('aria-selected', 'true');
    await page.waitForTimeout(250);
    await visit(`stand-${id}`);
  }
  await page.getByTestId('check-start').click();
  await expect(page.getByTestId('check-item')).toBeVisible();
  await page.waitForTimeout(250);
  await visit('wochencheck');
  await page.getByTestId('round-close').click();
  await screen(page, 'overview');
  await expect(page.getByTestId('tab-history')).toHaveAttribute('aria-selected', 'true');
  await page.getByTestId('vtest-start').click();
  await screen(page, 'vtest');
  await visit('wortschatztest');
  await page.getByTestId('vt-start').click();
  await expect(page.getByTestId('vt-word')).toBeVisible();
  await visit('wortschatztest-janein');
  for (let k = 0; k < 112; k++) await page.getByTestId(k % 2 ? 'vt-no' : 'vt-yes').click();
  await expect(page.getByTestId('vtest')).toHaveAttribute('data-state', 'meaning');
  await visit('wortschatztest-bedeutung');
}

/** Eine Aufgabe des Wochen-Checks beantworten (erste Wahl, „Weiß ich nicht" bzw. Unsinn) – ohne Tipp-Knopf. */
export async function answerCheckItem(page: Page, n: number, total: number): Promise<void> {
  await expect(page.getByTestId('round-progress')).toHaveText(new RegExp(`\\b${n}\\b\\D+\\b${total}\\b`));
  // Erst antworten, wenn genau diese Aufgabe steht (die vorige ist ausgeblendet).
  const item = page.locator(`[data-testid="check-item"][data-n="${n}"]`);
  await expect(item).toBeVisible();
  await expect(page.getByTestId('check-item')).toHaveCount(1);
  await expect(item.getByTestId('hint')).toHaveCount(0);
  const kind = await item.getAttribute('data-kind');
  if (kind === 'g') {
    await item.getByTestId('dont-know').click();
  } else if (await item.getByTestId('choice').count()) {
    await item.getByTestId('choice').first().click();
  } else {
    await typeInGap(page, 'zzz');
    await item.getByTestId('check').click();
  }
  await expect(item.getByTestId('verdict')).toBeVisible();
  // Nach einer richtigen Wahl geht es nach kurzer Zeit von selbst weiter.
  await item.getByTestId('next').click({ timeout: 800 }).catch(() => undefined);
}

/** Den ganzen Wochen-Check durchspielen (ab der ersten Aufgabe) bis zur Zusammenfassung. */
export async function playCheck(page: Page): Promise<void> {
  for (let n = 1; n <= 12; n++) await answerCheckItem(page, n, 12);
  await expect(page.getByTestId('check-summary')).toBeVisible();
}
