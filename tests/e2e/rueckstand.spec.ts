import { expect, test } from '@playwright/test';
import { boot, layoutProblems, openTab, screen } from './fixtures';
import { TUE_9, WEEK_W39 } from './heuteHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Rückstand-Steuerung (Emrah 02.10.2026: „Wie intelligent ist der Anki-Modus wirklich?“): Der Tagesplan gibt dem Wiederholen
// bei Rückstand mehr Zeit und nennt den Grund, neue Wörter werden gebremst, und der Wortschatz-Bereich sagt ehrlich, was der Knopf
// „Wiederholen“ gerade tut. Nach der Pflichtrunde bleibt „Noch eine Runde“.

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('40 überfällige Karten: Heute nennt den Rückstand als Grund, Wortschatz zeigt Rückstand, Bremse und was der Knopf startet', async ({ page }) => {
    const { patch } = ankiPatch(40);
    const { errors, external } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...WEEK_W39, ...patch } } });
    await screen(page, 'today');
    const first = page.getByTestId('duty').first();
    await expect(first.getByTestId('reason')).toContainText('Karten · überfällig');
    // Die Minuten von Block 1 wachsen mit dem Rückstand (mehr als die 8 des Grundplans).
    const min = Number(((await first.innerText()).match(/(\d+)\s*Min\./) ?? [])[1] ?? 0);
    expect(min).toBeGreaterThan(8);
    expect(min).toBeLessThanOrEqual(12);

    await openTab(page, 'vocab');
    await expect(page.getByTestId('ws-behind')).toHaveAttribute('data-n', '40');
    await expect(page.getByTestId('ws-braked')).toContainText('2 neue Wörter');
    // Pflicht offen: der Knopf startet die Pflicht von heute.
    const hint = page.getByTestId('ws-round-hint');
    await expect(hint).toHaveAttribute('data-duty', '');
    await expect(hint).toContainText('Pflicht von heute');
    // Eingangskorb: „reicht für n Tage“ mit 2 neuen am Tag (Bremse), nicht mit dem Kontingent.
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('ws-decks-all').click();
    await expect(page.getByTestId('ws-inbox')).toContainText('Tage');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('ohne Rückstand: keine Rückstandszeile, Block 1 bleibt bei 8 Minuten ohne Zusatz', async ({ page }) => {
    const { patch } = ankiPatch(6, { due: Date.parse('2026-09-22T09:30:00+02:00'), last: Date.parse('2026-09-12T09:00:00+02:00') });
    const { errors } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...WEEK_W39, ...patch } } });
    await screen(page, 'today');
    const first = page.getByTestId('duty').first();
    await expect(first.getByTestId('reason')).not.toContainText('überfällig');
    await openTab(page, 'vocab');
    await expect(page.getByTestId('ws-behind')).toHaveCount(0);
    await expect(page.getByTestId('ws-braked')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Pflichtrunde mit 70 überfälligen Karten: danach „Noch 10 Karten sind fällig“ und „Noch eine Runde“ startet eine freie Runde', async ({ page }) => {
    const { patch } = ankiPatch(70);
    const { errors } = await boot(page, {
      migrated: true,
      now: TUE_9,
      fake: { patch: { ...WEEK_W39, ...patch, 'app/profile': { newPerDay: 0 }, 'app/decks': { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } } } },
    });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await page.getByTestId('ws-review').click();
    await screen(page, 'trainer');
    for (let i = 0; i < 100 && !(await page.getByTestId('summary').isVisible()); i++) {
      const flip = page.getByTestId('flip');
      if (!(await flip.isVisible())) continue;
      const card = (await flip.getAttribute('data-card')) ?? '';
      await page.keyboard.press(' ');
      await page.keyboard.press('3');
      await expect(page.locator(`[data-testid="flip"][data-card="${card}"]`)).toHaveCount(0);
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    // Budget 480 s + höchstens 50 % = 720 s: 60 Karten zu je 12 s – nicht alle 70.
    await expect(page.getByTestId('summary-left')).toHaveAttribute('data-n', '10');
    await expect(page.getByTestId('summary-left')).toContainText('Noch 10 Karten sind fällig');
    await page.getByTestId('summary-more').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('flip')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
