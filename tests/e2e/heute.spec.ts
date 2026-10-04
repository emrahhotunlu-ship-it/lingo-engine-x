import { expect, test } from '@playwright/test';
import { boot, crashOnce, layoutProblems, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { answerGrammar, grammarKey, nextItem, orderSolution } from './learnHelpers';
import { MON, MON_9, SUN_9, TUE_9, VG_DUTY, WEEK_W39, profileWith, reviewedLog, unitStatus, vgPlan } from './heuteHelpers';

// P1 (plan.md §4.2): Heute mit Tageskarte, Tageseinheit mit Ersatzblöcken, Wochenthema.
// Seit 04.10.2026 (Fokus Vokabeln und Grammatik) Mo–Sa: Wortschatz · Grammatik · Satzbau · Fehler korrigieren.
// Paketkriterien: Morgen-Journey mit 1 Tipp bis zur ersten Aufgabe; Montag mit Bestätigungskarte
// bis „Fertig“ und Serie +1; Neuladen in Block 3 (Satzbau) setzt dort fort; Sonntag 2 Blöcke, Kurz-Einheit 3;
// ohne KI erfüllbar.

type Doc = Record<string, unknown>;

/** Älterer, heute fälliger Reparatur-Satz (aus „Sag es“ in der Vorwoche) – Material für Block 5 „Fehler korrigieren“. */
const SAY_REPAIR_T = Date.parse('2026-09-17T08:30:00+02:00');
const SAY_REPAIR = { id: 'rh01', wrong: 'Please send me the actual version of the contract.', right: 'Please send me the current version of the contract.', why: '„actual“ heißt „tatsächlich“.', src: 'say', t: SAY_REPAIR_T, box: 0, due: SAY_REPAIR_T + 86_400_000 };

test('Morgen-Journey: Tageskarte mit 4 Blöcken (Wortschatz · Grammatik · Satzbau · Fehler korrigieren), ein Tipp bis zur ersten Aufgabe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors, external } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...WEEK_W39 } } });
  await screen(page, 'today');
  const { done, total } = await unitStatus(page);
  expect(done).toBe(0);
  expect(total).toBe(4);
  await expect(page.getByTestId('duty')).toHaveCount(4);
  expect(await page.getByTestId('duty').evaluateAll((els) => els.map((e) => e.getAttribute('data-duty')))).toEqual(VG_DUTY);
  await expect(page.locator('[data-testid="duty"][data-duty="ch:u-focus"]')).toContainText('Grammatik');
  await expect(page.locator('[data-testid="duty"][data-duty="ch:u-task"]')).toContainText('Satzbau');
  await expect(page.locator('[data-testid="duty"][data-duty="ch:u-again"]')).toContainText('Fehler korrigieren');
  await expect(page.getByTestId('duty').first()).toHaveAttribute('data-now', 'true');
  await expect(page.getByTestId('today-theme')).toHaveAttribute('data-theme-id', 't01');
  await expect(page.getByTestId('start')).toBeInViewport();
  await expect(page.locator('main button.bg-accent')).toHaveCount(1);
  expect(await layoutProblems(page)).toEqual([]);
  // Plan einmal je Lerntag gespeichert, mit Pflicht der Einheit.
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as Doc | undefined)?.d).toBe('2026-09-22');
  const plan = (await dump(page))['app/profile']?.plan as { duty: string[]; u: { b: Array<[number, string, number]> } };
  expect(plan.duty).toEqual(VG_DUTY);
  expect(plan.u.b.map(([n, kind]) => [n, kind])).toEqual([
    [1, 'review'],
    [2, 'grammar'],
    [3, 'task.order'],
    [5, 'again'],
  ]);
  // Ein Tipp → erste Aufgabe (Wiederholen im Trainer), Zeile unter dem Balken nennt Pflicht.
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise').or(page.locator('[data-testid="intro"]')).first()).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Montag: Bestätigungskarte, Blöcke bis „Fertig“, Serie +1, ohne KI und ohne Sprachausgabe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, {
    migrated: true,
    now: MON_9,
    // Grammatik (Block 2) und Satzbau (Block 3) sind schon erledigt; offen ist „Fehler korrigieren“.
    fake: { capabilities: { sample: false }, speech: false, patch: { ...profileWith(MON, vgPlan(), ['u-task', 'u-focus'], {}), ...reviewedLog(MON), 'app/repair': { items: [SAY_REPAIR] } } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', '3');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-again');
  // Mit dem gespeicherten Plan der Einheit gilt ab heute die Pflicht-Regel (pflichtSince, nie rückwirkend).
  await expect.poll(async () => (await dump(page))['app/schema']?.pflichtSince).toBe(MON);
  // Am Tag von pflichtSince zählt noch die alte Regel (Regel 2: nie rückwirkend); Sonntag stand die Serie bei 12.
  // Erster Lerntag der Woche ohne Thema → Bestätigungskarte vor dem nächsten Block (M10).
  await page.getByTestId('start').click();
  await screen(page, 'unitCard');
  // Vorschlag = nächstes Thema der Reihenfolge nach KW 38 (t02 → t13, lehrer.md §3).
  await expect(page.getByTestId('unit-confirm')).toHaveAttribute('data-theme-id', 't13');
  await page.getByTestId('unit-confirm-ok').click();
  // Block 5 „Fehler korrigieren“ (Anbieter `again`, Übung `unitAgain`): ohne Aufgabe des Tages die ältesten fälligen
  // Reparatur-Sätze – geräteübergreifend aus `app/repair`, ohne KI lokal verglichen.
  await screen(page, 'unitAgain');
  await page.getByTestId('again-input').fill('Please send me the current version of the contract today.');
  await page.getByTestId('again-compare').click();
  await expect(page.getByTestId('again-new')).toContainText('current version of the contract today');
  await expect(page.getByTestId('again-better')).toContainText(SAY_REPAIR.right);
  await page.getByTestId('next').click();
  // Ende der Einheit → zurück zu Heute: Fertig-Zustand, kein Knopf, Serie +1.
  await expect(page.getByTestId('unit-end')).toBeVisible();
  await page.getByTestId('session-end-next').click();
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', 'allDone');
  await expect(page.getByTestId('start')).toHaveCount(0);
  await expect.poll(async () => ((await dump(page))['app/profile']?.pflicht as Doc | undefined)?.[MON]).toBe(1);
  const act = ((await dump(page))['app/profile']?.act as Record<string, Doc>)[MON];
  expect(act).toMatchObject({ 'u-focus': 1, 'u-task': 1, 'u-again': 1 });
  expect((await dump(page))['app/week']?.cur).toMatchObject({ wk: '2026-W39', theme: 't13', by: 'auto' });
  expect(((await dump(page))['app/week']?.hist as Doc[]).map((h) => h.wk)).toEqual(['2026-W37', '2026-W38']);
  await expect(page.getByTestId('today-streak')).toHaveText('Serie: 13 Tage');
  expect(errors).toEqual([]);
});

test('Neuladen in Block 3 (Satzbau): Heute führt direkt zurück in Block 3', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    now: MON_9,
    fake: { persist: true, patch: { ...WEEK_W39, ...profileWith(MON, vgPlan(), ['u-focus']), ...reviewedLog(MON) } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
  await page.getByTestId('start').click();
  await screen(page, 'drill');
  await expect(page.getByTestId('drill')).toHaveAttribute('data-kind', 'order');
  await expect(page.getByTestId('drill')).toHaveAttribute('data-ctx', 'duty');
  await page.reload();
  await page.locator('[data-screen="today"], [data-screen="drill"]').first().waitFor();
  if (await page.locator('[data-screen="today"]').isVisible()) {
    await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', '2');
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
    await page.getByTestId('start').click();
  }
  await screen(page, 'drill');
  await expect(page.getByTestId('drill')).toHaveAttribute('data-kind', 'order');
  expect(errors).toEqual([]);
});

test('Sonntag: 2 Blöcke (Wiederholen + Wochen-Check); Kurz-Einheit bei Tagesziel 15: 3 Blöcke', async ({ page }) => {
  await boot(page, { migrated: true, now: SUN_9, fake: { patch: { 'app/week': { v: 1, cur: { wk: '2026-W39', theme: 't01', by: 'auto', at: 1 } } } } });
  await screen(page, 'today');
  await expect(page.getByTestId('duty')).toHaveCount(2);
  await expect(page.locator('[data-testid="duty"]').nth(1)).toHaveAttribute('data-duty', 'ch:u-check');
  await page.close();
});

test('Kurz-Einheit (Tagesziel 15): 3 Blöcke', async ({ page }) => {
  await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...WEEK_W39, 'app/profile': { goalMin: 15 } } } });
  await screen(page, 'today');
  await expect(page.getByTestId('duty')).toHaveCount(3);
  // Wortschatz · Grammatik · Fehler korrigieren (kein Satzbau in der Kurz-Einheit).
  expect(await page.getByTestId('duty').evaluateAll((els) => els.map((e) => e.getAttribute('data-duty')))).toEqual(['review', 'ch:u-focus', 'ch:u-again']);
});

test('„Deine Woche“ über die Unterzeile von Heute, Thema wechseln schreibt app/week', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...WEEK_W39 } } });
  await screen(page, 'today');
  // Einstieg `hub-week` hängt am Platz `learn` (Gruppe `path`); P2 zeigt ihn in „Dein Weg“.
  await page.getByTestId('today-theme').click();
  await screen(page, 'week');
  await expect(page.getByTestId('week-page')).toHaveAttribute('data-theme-id', 't01');
  await page.getByTestId('week-change').click();
  await page.locator('[data-testid="week-theme"][data-theme-id="t02"]').click();
  await expect(page.getByTestId('week-page')).toHaveAttribute('data-theme-id', 't02');
  await expect.poll(async () => ((await dump(page))['app/week']?.cur as Doc | undefined)?.theme).toBe('t02');
  // Gleiche Woche: kein neuer Verlaufseintrag; der Seed-Verlauf (KW 37) bleibt unverändert.
  expect(((await dump(page))['app/week']?.hist as Doc[]).map((h) => h.wk)).toEqual(['2026-W37']);
  expect(errors).toEqual([]);
});

test('Fehlergrenze (lx:crash-once) in Block 2 der Einheit (Grammatik): Hinweis statt weißer Seite, Überspringen, Runde läuft weiter', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    now: MON_9,
    localStorage: crashOnce('grammarSession'),
    fake: { patch: { ...WEEK_W39, ...profileWith(MON, vgPlan(), []), ...reviewedLog(MON) } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-focus');
  await page.getByTestId('start').click();
  // Die Schritt-Grenze der Übung fängt den Fehler (G4): Leiste der Einheit bleibt, Hinweis mit „Überspringen“.
  await screen(page, 'grammarSession');
  await expect(page.getByTestId('grammar-session')).toHaveAttribute('data-ctx', 'duty');
  await expect(page.getByTestId('boundary-step')).toBeVisible();
  await expect(page.getByTestId('boundary-exercise')).toHaveCount(0);
  await expect(page.getByTestId('round-progress')).toHaveText(/^1 \/ \d+$/);
  await page.getByTestId('boundary-skip').click();
  // Überspringen führt ohne Bewertung zur nächsten Aufgabe; die Runde läuft weiter.
  await expect(page.getByTestId('boundary-step')).toHaveCount(0);
  await expect(page.getByTestId('round-progress')).toHaveText(/^2 \/ \d+$/);
  expect(errors.filter((e) => !e.includes('crash-once'))).toEqual([]);
});

test('Block 3 Satzbau aus Heute: Runde als Pflicht, „Weiter“ in der Zusammenfassung meldet den Block erledigt', async ({ page }) => {
  const { errors, external } = await boot(page, {
    migrated: true,
    now: MON_9,
    fake: { capabilities: { sample: false }, patch: { ...WEEK_W39, ...profileWith(MON, vgPlan(), ['u-focus']), ...reviewedLog(MON) } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
  await page.getByTestId('start').click();
  await screen(page, 'drill');
  await expect(page.getByTestId('drill')).toHaveAttribute('data-kind', 'order');
  await expect(page.getByTestId('drill')).toHaveAttribute('data-ctx', 'duty');
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('drill-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    const item = page.getByTestId('drill-item');
    const texts = await item.getByTestId('tile-pool').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));
    const order = orderSolution(texts);
    expect(order, `Satz aus ${texts.join(' | ')}`).not.toBeNull();
    for (const [n, k] of (order ?? []).entries()) {
      const text = texts[k] ?? '';
      await item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${text.replace(/"/g, '\\"')}"]`).first().click();
      await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(n + 1);
    }
    await item.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
    await page.getByTestId('next').click();
    await expect(page.getByTestId('drill-item').getByTestId('verdict')).toHaveCount(0);
  }
  // Als Block der Einheit: kein „Zurück zu Grammatik“, sondern „Weiter“ – meldet Block 3 erledigt.
  await expect(page.getByTestId('summary-back')).toHaveCount(0);
  await page.getByTestId('summary-next').click();
  await expect.poll(async () => (((await dump(page))['app/profile']?.act as Record<string, Doc>)[MON] ?? {})['u-task']).toBe(1);
  // Weiter geht es mit Block 5 „Fehler korrigieren“ (Zwischenkarte oder direkt).
  await page.locator('[data-screen="unitCard"], [data-screen="unitAgain"]').first().waitFor();
  if (await page.locator('[data-screen="unitCard"]').isVisible()) await expect(page.getByTestId('unit-between')).toHaveAttribute('data-next', 'ch:u-again');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Block 2 Grammatik aus Heute: Grammatikrunde als Pflicht mit 6 Aufgaben, „Weiter“ meldet den Block erledigt', async ({ page }) => {
  test.slow();
  const { errors, external } = await boot(page, {
    migrated: true,
    now: MON_9,
    fake: { capabilities: { sample: false }, patch: { ...WEEK_W39, ...profileWith(MON, vgPlan(), []), ...reviewedLog(MON) } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-focus');
  await page.getByTestId('start').click();
  await screen(page, 'grammarSession');
  const session = page.getByTestId('grammar-session');
  await expect(session).toHaveAttribute('data-ctx', 'duty');
  // Rundengröße aus dem Plan (Block 2, volle Einheit: 6 Aufgaben).
  await expect(page.getByTestId('round-progress')).toHaveText('1 / 6');
  const solve = grammarKey();
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    await answerGrammar(page, solve);
    await nextItem(page);
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByTestId('summary-back')).toHaveCount(0);
  await page.getByTestId('summary-next').click();
  await expect.poll(async () => (((await dump(page))['app/profile']?.act as Record<string, Doc>)[MON] ?? {})['u-focus']).toBe(1);
  // Weiter geht es mit Block 3 Satzbau (Zwischenkarte oder direkt).
  await page.locator('[data-screen="unitCard"], [data-screen="drill"]').first().waitFor();
  if (await page.locator('[data-screen="unitCard"]').isVisible()) await expect(page.getByTestId('unit-between')).toHaveAttribute('data-next', 'ch:u-task');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
