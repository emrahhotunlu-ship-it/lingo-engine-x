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
    // UX-Audit U1: nicht „überfällig“, sondern der Grund in Worten; Glossar 3.6: kein Altwort „Rückstand“.
    // Seit UX-Neuanfang C hat der Schritt „Wörter“ feste Minuten aus dem Tagesziel (Emrah 02.11.2026: „mindestens 10 Minuten und immer 40 %“),
    // er wächst nicht mehr mit dem Rückstand; die Zeile sagt in Worten, dass die Wörter zur Zeit passen (keine Kartenzahl mehr auf Heute).
    await expect(first.getByTestId('reason')).toContainText('passend zu deiner Zeit');
    // Tagesziel 25 → Wörter 18 Minuten (70 % aufgerundet, Tagesaufteilung 70/20/10 vom 12.11.2026), auch bei Rückstand.
    await expect(first).toHaveAttribute('data-min', '18');

    await openTab(page, 'vocab');
    await expect(page.getByTestId('ws-behind')).toHaveAttribute('data-n', '40');
    // Eine Zahl überall (UX-Audit U1): die Plan-Zahl des Wörter-Reiters ist die Kartenzahl der Heute-Karte, und die Wortliste nennt dieselbe Zeile.
    const behindEl = page.getByTestId('ws-behind');
    const planned = (await behindEl.getAttribute('data-planned')) ?? '';
    expect(planned).toMatch(/^[1-9]\d*$/);
    const due = (await behindEl.getAttribute('data-due')) ?? '';
    const line = (await behindEl.innerText()).split('\n')[0] ?? '';
    expect(line).toContain(due);
    if (Number(planned) < Number(due)) expect(line).toContain(planned);
    await page.getByTestId('ws-all').click();
    await screen(page, 'vocabList');
    await expect(page.getByText(line, { exact: false }).first()).toBeVisible();
    await page.getByTestId('back').first().click();
    await screen(page, 'vocab');
    await expect(page.getByTestId('ws-braked')).toContainText('2 neue Wörter');
    // Pflicht offen: der Knopf startet die Pflicht von heute.
    const review = page.getByTestId('ws-review');
    await expect(review).toContainText('Pflicht:');
    await expect(page.getByTestId('ws-round-hint')).toHaveCount(0);
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
    await expect(first.getByTestId('reason')).not.toContainText('Rückstand');
    await openTab(page, 'vocab');
    await expect(page.getByTestId('ws-behind')).toHaveCount(0);
    await expect(page.getByTestId('ws-braked')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Pflichtrunde mit 130 überfälligen Karten: danach „Weitere Runde · n fällig“ startet eine freie Runde', async ({ page }) => {
    const N = 130;
    const { patch } = ankiPatch(N);
    const { errors } = await boot(page, {
      migrated: true,
      now: TUE_9,
      // Tagesziel 20 → Wörter 14 Min. (70/20/10): das Zeitbudget reicht sicher nicht für alle 130 Karten (der Testbestand hat nur ~136 Wörter).
      fake: { patch: { ...WEEK_W39, ...patch, 'app/profile': { newPerDay: 0, goalMin: 20 }, 'app/decks': { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } } } },
    });
    await screen(page, 'today');
    await openTab(page, 'vocab');
    await page.getByTestId('ws-review').click();
    await screen(page, 'trainer');
    let reviewed = 0;
    for (let i = 0; i < 400 && !(await page.getByTestId('summary').isVisible()); i++) {
      const flip = page.getByTestId('flip');
      if (!(await flip.isVisible())) continue;
      const card = (await flip.getAttribute('data-card')) ?? '';
      await page.keyboard.press(' ');
      await page.keyboard.press('3');
      await expect(page.locator(`[data-testid="flip"][data-card="${card}"]`)).toHaveCount(0);
      reviewed++;
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    // Zeitbudget der Pflichtrunde (Wörter 14 Min. bei Tagesziel 20, mit Rückstand-Zuschlag) reicht nicht für alle 130 Karten;
    // der Knopf nennt genau den Rest. UX-Prüfung W6 (07.10.2026): ohne doppeltes „Noch“.
    expect(reviewed).toBeGreaterThan(60);
    expect(reviewed).toBeLessThan(N);
    await expect(page.getByTestId('session-end-more')).toHaveText(new RegExp(`Weitere Runde · ${N - reviewed} fällig`));
    await page.getByTestId('session-end-more').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('flip')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
