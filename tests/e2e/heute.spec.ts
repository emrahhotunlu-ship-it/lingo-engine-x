import { expect, test } from '@playwright/test';
import { boot, crashOnce, layoutProblems, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { MON, MON_9, SUN_9, TUE_9, WEEK_W39, mondayPlan, profileWith, reviewedLog, unitStatus } from './heuteHelpers';

// P1 (plan.md §4.2): Heute mit Tageskarte, Tageseinheit mit Ersatzblöcken, Wochenthema.
// Paketkriterien: Morgen-Journey mit 1 Tipp bis zur ersten Aufgabe; Montag mit Bestätigungskarte
// bis „Fertig“ und Serie +1; Neuladen in Block 3 setzt dort fort; Sonntag 2 Blöcke, Kurz-Einheit 3;
// ohne KI erfüllbar.

type Doc = Record<string, unknown>;

/** Reparatur-Satz aus „Sag es“ (Block 3) vom Montagmorgen – Material für Block 5. */
const SAY_REPAIR_T = Date.parse('2026-09-21T08:30:00+02:00');
const SAY_REPAIR = { id: 'rh01', wrong: 'Please send me the actual version of the contract.', right: 'Please send me the current version of the contract.', why: '„actual“ heißt „tatsächlich“.', src: 'say', t: SAY_REPAIR_T, box: 0, due: SAY_REPAIR_T + 86_400_000 };

test('Morgen-Journey: Tageskarte mit 5 Blöcken, ein Tipp bis zur ersten Aufgabe', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors, external } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...WEEK_W39 } } });
  await screen(page, 'today');
  const { done, total } = await unitStatus(page);
  expect(done).toBe(0);
  expect(total).toBe(5);
  await expect(page.getByTestId('duty')).toHaveCount(5);
  await expect(page.getByTestId('duty').first()).toHaveAttribute('data-now', 'true');
  await expect(page.getByTestId('today-theme')).toHaveAttribute('data-theme-id', 't01');
  await expect(page.getByTestId('start')).toBeInViewport();
  await expect(page.locator('main button.bg-accent')).toHaveCount(1);
  expect(await layoutProblems(page)).toEqual([]);
  // Plan einmal je Lerntag gespeichert, mit Pflicht der Einheit.
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as Doc | undefined)?.d).toBe('2026-09-22');
  const plan = (await dump(page))['app/profile']?.plan as { duty: string[]; u: { b: unknown[] } };
  expect(plan.duty).toEqual(['review', 'ch:u-in', 'ch:u-task', 'ch:u-focus', 'ch:u-again']);
  expect(plan.u.b).toHaveLength(5);
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
    // Ohne Sprachausgabe entfällt das Nachsprechen nach Block 2 (plan.md §1.5, Rückfälle).
    fake: { capabilities: { sample: false }, speech: false, patch: { ...profileWith(MON, mondayPlan(), ['u-task', 'u-focus'], {}), ...reviewedLog(MON), 'app/repair': { items: [SAY_REPAIR] } } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', '3');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-in');
  // Mit dem gespeicherten Plan der Einheit gilt ab heute die Pflicht-Regel (pflichtSince, nie rückwirkend).
  await expect.poll(async () => (await dump(page))['app/schema']?.pflichtSince).toBe(MON);
  // Am Tag von pflichtSince zählt noch die alte Regel (Regel 2: nie rückwirkend); Sonntag stand die Serie bei 12.
  // Erster Lerntag der Woche ohne Thema → Bestätigungskarte vor dem nächsten Block (M10).
  await page.getByTestId('start').click();
  await screen(page, 'unitCard');
  // Vorschlag = nächstes Thema der Reihenfolge nach KW 38 (t02 → t13, lehrer.md §3).
  await expect(page.getByTestId('unit-confirm')).toHaveAttribute('data-theme-id', 't13');
  await page.getByTestId('unit-confirm-ok').click();
  // Block 2 (Anbieter `input.read`, Übung `inputUnit`): Themen-Text des bestätigten Themas, zwei Fragen
  // mit Belegstelle und Grund (auch bei richtig, M9), Wendungen mitnehmen.
  await screen(page, 'inputUnit');
  const block = page.getByTestId('input-block');
  await expect(block).toHaveAttribute('data-step', 'input');
  await expect(block).toHaveAttribute('data-ref', /^theme:.*t13$/);
  await page.getByTestId('block-to-questions').click();
  for (let i = 0; i < 2; i++) {
    await expect(page.getByTestId('question')).toHaveAttribute('data-index', String(i));
    await page.getByTestId('option').first().click();
    await expect(page.getByTestId('evidence')).toBeVisible();
    await expect(page.getByTestId('explain')).toBeVisible();
    await page.getByTestId('next').click();
  }
  await expect(block).toHaveAttribute('data-step', 'notice');
  expect(await page.getByTestId('notice-row').count()).toBeGreaterThanOrEqual(2);
  await page.getByTestId('block-next').click();
  // Zwischenkarte → Block 5 „Nochmal, aber besser“ (Anbieter `again`, Übung `unitAgain`): Material ist der
  // Reparatur-Satz von heute (Block 3) – geräteübergreifend aus `app/repair`, ohne KI lokal verglichen.
  await screen(page, 'unitCard');
  await expect(page.getByTestId('unit-between')).toHaveAttribute('data-next', 'ch:u-again');
  await page.getByTestId('unit-next').click();
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
  expect(act).toMatchObject({ 'u-in': 1, 'u-again': 1 });
  expect((await dump(page))['app/week']?.cur).toMatchObject({ wk: '2026-W39', theme: 't13', by: 'auto' });
  expect(((await dump(page))['app/week']?.hist as Doc[]).map((h) => h.wk)).toEqual(['2026-W37', '2026-W38']);
  await expect(page.getByTestId('today-streak')).toHaveText('Serie: 13 Tage');
  expect(errors).toEqual([]);
});

test('Neuladen in Block 3: Heute führt direkt zurück in Block 3', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    now: MON_9,
    fake: { persist: true, patch: { ...WEEK_W39, ...profileWith(MON, mondayPlan(), ['u-in']), ...reviewedLog(MON) } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
  await page.getByTestId('start').click();
  await screen(page, 'say');
  await page.reload();
  await page.locator('[data-screen="today"], [data-screen="say"]').first().waitFor();
  if (await page.locator('[data-screen="today"]').isVisible()) {
    await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', '2');
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
    await page.getByTestId('start').click();
  }
  await screen(page, 'say');
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
  expect(await page.getByTestId('duty').evaluateAll((els) => els.map((e) => e.getAttribute('data-duty')))).toEqual(['review', 'ch:u-task', 'ch:u-again']);
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

test('Fehlergrenze (lx:crash-once) in Block 2 der Einheit: Hinweis statt weißer Seite, Überspringen, Einheit läuft weiter', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    now: MON_9,
    localStorage: crashOnce('inputUnit'),
    fake: { patch: { ...WEEK_W39, ...profileWith(MON, mondayPlan(), []), ...reviewedLog(MON) } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-in');
  await page.getByTestId('start').click();
  // Die Schritt-Grenze der Übung fängt den Fehler (G4): Leiste der Einheit bleibt, Hinweis mit „Überspringen“.
  await screen(page, 'inputUnit');
  await expect(page.getByTestId('boundary-step')).toBeVisible();
  await expect(page.getByTestId('boundary-exercise')).toHaveCount(0);
  await page.getByTestId('boundary-skip').click();
  // Überspringen führt ohne Bewertung zum nächsten Schritt (Fragen); Block 2 läuft bis zum Ende weiter,
  // mit Sprachausgabe folgt das Nachsprechen (plan.md §1.5).
  await expect(page.getByTestId('input-block')).toHaveAttribute('data-step', 'q');
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('option').first().click();
    await page.getByTestId('next').click();
  }
  await page.getByTestId('block-next').click();
  await screen(page, 'pron');
  await expect(page.getByTestId('pron')).toHaveAttribute('data-kind', 'shadow');
  expect(errors.filter((e) => !e.includes('crash-once'))).toEqual([]);
});
