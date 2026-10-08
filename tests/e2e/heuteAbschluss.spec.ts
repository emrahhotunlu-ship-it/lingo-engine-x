import { expect, test } from '@playwright/test';
import { boot, screen } from './fixtures';
import { MON, MON_9, VG_BLOCKS, profileWith, reviewedLog, vgPlan } from './heuteHelpers';

// Abschlusskarte Heute 3.0 (Lernplattform 3.0 P27, Motivation §4.4, §4.5, §4.8, §4.10): Ring, eine große Zahl, höchstens vier Zeilen,
// Kartenfuß „Serie 12 · 4 von 6 Lerntagen“, Pausen ohne Vorwurf. Die Serienregel selbst bleibt unberührt (Fixtures der Serien-Tests).

type Doc = Record<string, unknown>;
const DONE = ['u-focus', 'u-task', 'u-again'];
const BAD = /Serie 0|Streak 0|verlor|gerissen|verfehlt|nicht erledigt|nicht geschafft|!/;

function donePlan(day: string, extra: Doc = {}): Doc {
  const p = vgPlan(day);
  return { ...p, u: { ...(p.u as Doc), b: VG_BLOCKS, ...extra } };
}

test.describe('Handy 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Normaler Tag: Kartenfuß „Serie · Woche“ im Streifen, Ziel statt Meilenstein, kein Text doppelt, Streifen ohne Scrollen im Bild', async ({ page }) => {
    const plan = donePlan(MON, { nx: 'c1check' });
    const { errors } = await boot(page, { migrated: true, now: MON_9, fake: { patch: { ...profileWith(MON, plan, DONE, {}), ...reviewedLog(MON) } } });
    await screen(page, 'today');
    const card = page.getByTestId('today-card');
    await expect(card).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('today-status')).toHaveText('Fertig für heute');
    // Zeile 4: Serie und Woche an einer Stelle (im Kopf des Wochenstreifens), die Zählung der Tage steht nicht noch einmal daneben.
    await expect(page.getByTestId('today-streak')).toHaveText(/^Serie 1\d · 1 von 6 Lerntagen$/);
    await expect(page.getByTestId('today-streak')).toHaveCount(1);
    await expect(page.getByTestId('week-summary')).toHaveCount(0);
    // Zeile 2: das eine nächste Ziel (kein Meilenstein heute).
    await expect(page.getByTestId('today-goal')).toHaveText('Nächstes Ziel: der nächste C1-Check');
    await expect(page.getByTestId('today-milestone')).toHaveCount(0);
    // Höchstens vier Textzeilen unter der Zahl und kein Text doppelt.
    const lines = await card.locator('p').allInnerTexts();
    const body = lines.filter((l) => l.trim() && !/^✓/.test(l));
    expect(new Set(body).size).toBe(body.length);
    expect(await card.locator('[data-testid="today-truth"], [data-testid="today-milestone"], [data-testid="today-goal"], [data-testid="today-tomorrow"], [data-testid="week-strip"]').count()).toBeLessThanOrEqual(4);
    // Streifen vollständig im Bild, ohne Scrollen.
    await expect(page.getByTestId('week-strip')).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    await expect(page.locator('body')).not.toContainText(BAD);
    await expect(card.locator('button')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Ohne Kennung im Plan (Plan von früher) gibt es keine Zielzeile', async ({ page }) => {
    await boot(page, { migrated: true, now: MON_9, fake: { patch: { ...profileWith(MON, donePlan(MON), DONE, {}), ...reviewedLog(MON) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('today-goal')).toHaveCount(0);
  });

  test('Erster Tag nach einer Pause: Überschrift „Erster Tag zurück“, kein „Serie 0“, Pausentage „kein Lerntag“, nichts von „nicht erledigt“', async ({ page }) => {
    const FRI = '2026-09-25';
    const { errors } = await boot(page, { migrated: true, now: `${FRI}T09:00:00+02:00`, fake: { patch: { ...profileWith(FRI, donePlan(FRI), DONE, {}), ...reviewedLog(FRI) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('today-status')).toHaveText('Erster Tag zurück');
    // Montag bis Donnerstag dieser Woche waren ohne Pflicht: ruhig „kein Lerntag“.
    const past = page.locator('[data-testid="week-day"][data-state="open"]:not([data-today])');
    await expect(past.first()).toHaveAttribute('title', /kein Lerntag/);
    await expect(page.locator('body')).not.toContainText(BAD);
    await expect(page.getByTestId('today-streak')).not.toContainText(/Serie 0/);
    expect(errors).toEqual([]);
  });

  test('Nach 14 Tagen Pause zeigt die Willkommens-Karte „Das ist noch da“ aus den Wortkarten', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: '2026-10-05T09:00:00+02:00' });
    await screen(page, 'today');
    const there = page.getByTestId('still-there');
    await expect(there).toBeVisible();
    await expect(there).toHaveText(/^Von deinen \d+ gelernten Wörtern sind voraussichtlich noch \d+ da\.$/);
    const known = Number(await there.getAttribute('data-known'));
    const learned = Number(await there.getAttribute('data-learned'));
    expect(known).toBeLessThanOrEqual(learned);
    await expect(page.locator('body')).not.toContainText(BAD);
    expect(errors).toEqual([]);
  });

  test('Ohne Pause keine „Das ist noch da“-Zeile und kein „Erster Tag zurück“', async ({ page }) => {
    await boot(page, { migrated: true, now: MON_9, fake: { patch: { ...profileWith(MON, donePlan(MON), DONE, {}), ...reviewedLog(MON) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('still-there')).toHaveCount(0);
    await expect(page.getByTestId('today-status')).not.toHaveText('Erster Tag zurück');
  });
});
