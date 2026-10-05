import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, layoutProblems, openTab, screen } from './fixtures';
import { NO_GRAMMAR_ERRORS } from './heuteHelpers';
import { writes } from './trainerHelpers';

// Paket P2 (docs/neubau/plan.md §4.3), umgebaut zum Grammatik-Pfad (W5): Hub mit Weiter-Karte, Pfad, Fehler und Extra, jede Übung ≤ 2 Tipps ab
// Grammatik, Tageseinheit Block 4 (Fokus, Mini-Drill bei Fallen-Korrektur) und Block 5 (beide
// Fassungen), Werkzeug der Woche per `grammar?topic=`.

type Doc = Record<string, unknown>;
const TODAY_T = Date.parse('2026-09-20T18:00:00+02:00');
// Eine Korrektur aus Block 3 von heute (Reparatur-Satz) mit der Falle f01 „actual ≠ aktuell“.
const TRAP_REPAIR = { id: 'rf01', wrong: 'Please send me the actual version of the contract.', right: 'Please send me the current version of the contract.', why: '„actual“ heißt „tatsächlich“.', src: 'say', t: TODAY_T, box: 0, due: TODAY_T + 86_400_000 };

const dump = (page: Page): Promise<Record<string, Doc>> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Record<string, Doc> } } }).__LINGO_FAKE__.db.dump());

test('Grammatik-Reiter: Weiter-Karte, Pfad mit allen Themen, Fehler korrigieren, Extra – kein waagrechter Bildlauf (390)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'learn');
  const hub = page.getByTestId('learn-hub');
  await expect(hub.getByRole('heading', { name: 'Grammatik', level: 1 })).toBeVisible();
  await expect(page.getByTestId('hub-next-topic')).toBeVisible();
  await expect(page.getByTestId('hub-next-start')).toBeVisible();
  // Der Pfad: alle 39 Themen in Lehrreihenfolge, je Thema ein Zustand.
  await expect(page.locator('[data-testid="topic"]')).toHaveCount(39);
  const states = await page.getByTestId('topic').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
  expect(new Set(states)).toEqual(new Set(['new', 'learning', 'safe', 'firm'].filter((x) => states.includes(x))));
  expect(states.every((x) => ['new', 'learning', 'safe', 'firm'].includes(x ?? ''))).toBe(true);
  // Fehler, Regeln suchen, Deutsch-Fallen, Nachschlagen und Extra als Zeilen; der Kurs ist kein Eintrag des Reiters mehr.
  await expect(page.getByTestId('hub-errors').or(page.getByTestId('hub-errors-none')).first()).toBeVisible();
  await expect(page.getByTestId('hub-extra')).toBeVisible();
  for (const id of ['hub-lookup', 'hub-traps', 'hub-wissen']) await expect(page.getByTestId(id)).toBeVisible();
  for (const id of ['hub-course', 'hub-next-lesson']) await expect(page.getByTestId(id)).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  // Kurzübungen stehen seit „Go Anwenden“ im Reiter „Anwenden“.
  await openTab(page, 'apply');
  await page.getByTestId('hub-drill-cloze').click();
  await expect(page.getByTestId('drill-item')).toBeVisible();
  await page.getByTestId('round-close').click();
  expect(errors).toEqual([]);
});

test('Block 4 Fokus: Fallen-Korrektur → Hinweis, Versuch, Lösung mit Grund, danach Mini-Drill mit 3 Sätzen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await bootAt(page, { name: 'unitFocus' }, { fake: { patch: { ...NO_GRAMMAR_ERRORS, 'app/repair': { items: [TRAP_REPAIR] } } } });
  await screen(page, 'unitFocus');
  const item = page.getByTestId('focus-item');
  await expect(item).toHaveAttribute('data-kind', 'fix');
  await expect(item).toHaveAttribute('data-trap', 'f01');
  await expect(page.getByTestId('focus-wrong')).toContainText(TRAP_REPAIR.wrong);
  // Erst der Hinweis, dann der Versuch.
  await expect(page.getByTestId('focus-hint')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  await page.getByTestId('focus-input').fill(TRAP_REPAIR.right);
  await page.getByTestId('focus-check').click();
  // M9: auch bei richtiger Antwort Lösung und Grund.
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('feedback-solution')).toContainText('current version');
  await expect(page.getByTestId('feedback-fixes')).toContainText('tatsächlich');
  await page.getByTestId('next').click();

  // Mini-Drill: 3 Sätze der Falle f01.
  for (let n = 1; n <= 3; n++) {
    await expect(item).toHaveAttribute('data-drill', '');
    await expect(item).toHaveAttribute('data-trap', 'f01');
    await expect(page.getByTestId('focus-eyebrow')).toContainText(`Satz ${n} von 3`);
    if (n === 1) {
      // Falsch lassen → Lösung + Grund, Satz wird Reparatur-Karte (Startsatz-Lösung).
      await page.getByTestId('focus-check').click();
      await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'wrong');
      await expect(page.getByTestId('feedback-solution')).toContainText('current status');
    } else {
      await page.getByTestId('focus-dont-know').click();
      await expect(page.getByTestId('feedback-solution')).toBeVisible();
    }
    await page.getByTestId('next').click();
  }
  // Danach füllen fällige Fehler bzw. Fallen der Woche auf 3 Hauptaufgaben auf.
  await expect(page.getByTestId('unit-focus')).toHaveAttribute('data-main', '3');
  for (let i = 0; i < 2; i++) {
    const gr = page.getByTestId('gr-item');
    if (await gr.isVisible()) {
      await page.getByTestId('dont-know').click();
      await page.getByTestId('next').click();
    } else {
      await page.getByTestId('focus-dont-know').click();
      await page.getByTestId('next').click();
    }
  }
  await expect(page.getByTestId('session-end')).toBeVisible();
  await expect
    .poll(async () => ((await dump(page))['app/repair']?.items as Doc[] | undefined)?.some((e) => e.src === 'pattern' && String(e.wrong).includes('actual status')) ?? false)
    .toBe(true);
  expect(errors).toEqual([]);
});

test('Block 4 ohne Korrekturen und ohne KI: immer 3 Aufgaben', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'unitFocus' }, { fake: { capabilities: { sample: false } } });
  await screen(page, 'unitFocus');
  await expect(page.getByTestId('unit-focus')).toHaveAttribute('data-main', '3');
  expect(errors).toEqual([]);
});

test('Block 5: aus dem Kopf neu formulieren, danach beide Fassungen nebeneinander und Korrektur „jetzt drin“', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Seit 04.10.2026 nimmt „Fehler korrigieren“ fällige ältere Sätze (verteilt statt massiert): derselbe Satz, drei Tage alt und fällig.
  const old = { ...TRAP_REPAIR, t: TODAY_T - 3 * 86_400_000, due: TODAY_T - 2 * 86_400_000 };
  const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...NO_GRAMMAR_ERRORS, 'app/repair': { items: [old] } } } });
  await screen(page, 'unitAgain');
  await expect(page.getByTestId('again-remember')).toContainText('tatsächlich');
  await page.getByTestId('again-input').fill('Please send me the current version of the contract today.');
  await page.getByTestId('again-compare').click();
  await expect(page.getByTestId('again-new')).toContainText('current version of the contract today');
  await expect(page.getByTestId('again-better')).toContainText(TRAP_REPAIR.right);
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'ok');
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Block 5: Sätze von heute kommen nicht am selben Tag wieder – ohne fällige ältere Sätze ruhiger Leerzustand', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { ...NO_GRAMMAR_ERRORS, 'app/repair': { items: [TRAP_REPAIR] } } } });
  await screen(page, 'unitAgain');
  await expect(page.getByTestId('again-empty')).toBeVisible();
  await expect(page.getByTestId('again-done')).toBeVisible();
  await expect(page.getByTestId('again-input')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Block 5: nur Grammatik-Fehlersätze fällig – kein leeres Feld, die Antwort schreibt Box und Fälligkeit ins Thema', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errorsOf = async (): Promise<string> =>
    JSON.stringify(
      Object.entries(await dump(page))
        .filter(([k]) => k.startsWith('grammar/'))
        .map(([k, d]) => [k, d.errors]),
    );
  const { errors } = await bootAt(page, { name: 'unitAgain' }, { fake: { patch: { 'app/repair': null } } });
  await screen(page, 'unitAgain');
  const before = await errorsOf();
  await expect(page.getByTestId('again-empty')).toHaveCount(0);
  await expect(page.getByTestId('again-olds')).toBeVisible();
  const input = page.getByTestId('again-input');
  await expect(input).not.toHaveValue('');
  await input.fill(`${await input.inputValue()} (nochmal)`);
  await page.getByTestId('again-compare').click();
  await expect(page.getByTestId('again-better')).toBeVisible();
  await expect.poll(errorsOf).not.toBe(before);
  expect(errors).toEqual([]);
});

test('Werkzeug der Woche: grammar?topic=c1-hedging öffnet das Themenblatt, darunter der Pfad', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammar', topic: 'c1-hedging' });
  await expect(page.getByTestId('rule-sheet')).toHaveAttribute('data-topic', 'c1-hedging');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-testid="topic"]')).toHaveCount(39);
  expect(errors).toEqual([]);
});

test('Deutsch-Fallen ohne KI: Startsatz-Falle in 2 Tipps ab Üben, 3 Sätze mit Hinweis und Lösung', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'patterns' }, { fake: { capabilities: { sample: false } } });
  await expect(page.getByTestId('patterns-start')).toBeVisible();
  await page.getByTestId('pattern-start-f03').click();
  await expect(page.getByTestId('patterns')).toHaveAttribute('data-view', 'drill');
  for (let i = 0; i < 3; i++) {
    const item = page.locator('[data-testid="focus-item"][data-state="open"]');
    await expect(item).toHaveAttribute('data-trap', 'f03');
    await expect(page.getByTestId('focus-hint')).toBeVisible();
    await page.getByTestId('focus-dont-know').click();
    await expect(page.getByTestId('feedback-fixes')).not.toBeEmpty();
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('pattern-drill-end')).toHaveAttribute('data-total', '3');
  expect(errors).toEqual([]);
});

test('Grammatik-Runde: „Kurz erklärt“ vor der Aufgabe, zugeklappt (N46)', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await expect(page.getByTestId('gr-brief-text')).toHaveCount(0);
  await page.getByTestId('gr-brief').click();
  await expect(page.getByTestId('gr-brief-text')).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('Neuladen in der Grammatik-Runde bei Aufgabe 4: gleiche Aufgabe, keine doppelten Einträge (G3)', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { fake: { persist: true } });
  const logged = async () => (((await dump(page))['log/2026-09-20']?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g').length;
  const base = await logged();
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('gr-item')).toHaveCount(1);
    await page.getByTestId('dont-know').click();
    await page.getByTestId('next').click();
  }
  await expect(page.getByTestId('round-progress')).toHaveText(/\b4\b\D+\b8\b/);
  const prompt = await page.getByTestId('gr-item').getAttribute('data-topic');
  const text = await page.getByTestId('gr-item').getByTestId('task-line').innerText();
  await expect.poll(logged).toBe(base + 3);
  await page.waitForTimeout(600);
  await page.reload();
  await screen(page, 'grammarSession');
  await expect(page.getByTestId('round-progress')).toHaveText(/\b4\b\D+\b8\b/);
  await expect(page.getByTestId('gr-item')).toHaveAttribute('data-topic', prompt ?? '');
  await expect(page.getByTestId('gr-item').getByTestId('task-line')).toHaveText(text);
  expect(await logged()).toBe(base + 3);
  expect(errors).toEqual([]);
});

test('Reiter „Anwenden“: Diktat, Lücke, Satzbau und Rollenspiel stehen dort, nicht mehr bei Grammatik; nichts davon ist Pflicht', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await expect(page.getByTestId('apply-hub')).toBeVisible();
  await expect(page.getByTestId('hub-drill-cloze')).toBeVisible();
  await expect(page.getByTestId('hub-drill-order')).toBeVisible();
  await expect(page.getByTestId('hub-speak')).toBeVisible();
  // Wort-und-Regel-Übungen (Kollokationen, Umformung, Wortbildung …) stehen seit „Go Kombi“ hier.
  for (const id of ['training-colloc', 'training-transform', 'training-wordform']) await expect(page.getByTestId(id)).toBeVisible();
  await openTab(page, 'learn');
  await expect(page.getByTestId('hub-drill-cloze')).toHaveCount(0);
  await expect(page.getByTestId('hub-drill-order')).toHaveCount(0);
  await expect(page.getByTestId('training-colloc')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Anwenden › Hörübung mit Frage: Text verdeckt, erst Hören, dann Frage, danach Text mit Belegstelle; schreibt nichts', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await page.getByTestId('hub-listen-q').click();
  await expect(page.getByTestId('listen-q-item')).toBeVisible();
  // Vor dem Hören: weder Frage noch Text.
  await expect(page.getByTestId('listen-q-question')).toHaveCount(0);
  await expect(page.getByTestId('listen-q-text')).toHaveCount(0);
  const before = (await writes(page)).length;
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('listen-q-play').click();
    await expect(page.getByTestId('listen-q-question')).toBeVisible();
    await expect(page.getByTestId('listen-q-text')).toHaveCount(0);
    await page.getByTestId('listen-q-option').filter({ hasText: 'The client asked for it.' }).click();
    await expect(page.getByTestId('listen-q-result')).toBeVisible();
    await expect(page.getByTestId('listen-q-quote')).toContainText('because the client asked for it');
    await expect(page.getByTestId('listen-q-why')).toBeVisible();
    await page.getByTestId('listen-q-next').click();
  }
  await expect(page.getByTestId('session-end')).toHaveAttribute('data-right', '3');
  expect((await writes(page)).length).toBe(before);
  expect(errors).toEqual([]);
});

test('Anwenden › Hörübung: ohne Claude gibt es keine Kachel', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await expect(page.getByTestId('apply-hub')).toBeVisible();
  await expect(page.getByTestId('hub-listen-q')).toHaveCount(0);
});

test('Anwenden › Eigener Satz: Wort fehlt → lokal, keine KI; richtiger Satz → zwei Häkchen; falscher Satz → Korrektur und Reparatur-Satz', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'apply');
  await page.getByTestId('hub-combo-own').click();
  const item = page.getByTestId('combo-item');
  await expect(item).toBeVisible();
  const word = (await item.getAttribute('data-word')) ?? '';
  expect(word).not.toBe('');
  // 1) Wort fehlt: lokal erkannt, kein Claude-Aufruf.
  await page.getByTestId('combo-input').fill('This sentence has nothing to do with it at all.');
  await page.getByTestId('combo-check').click();
  await expect(page.getByTestId('combo-word-missing')).toBeVisible();
  await expect(page.getByTestId('combo-word-mark')).toHaveAttribute('data-ok', 'false');
  await page.getByTestId('combo-retry').click();
  // 2) Richtig: beide Häkchen.
  await page.getByTestId('combo-input').fill(`We talked about the ${word} yesterday.`);
  await page.getByTestId('combo-check').click();
  await expect(page.getByTestId('combo-word-mark')).toHaveAttribute('data-ok', 'true');
  await expect(page.getByTestId('combo-rule-mark')).toHaveAttribute('data-ok', 'true');
  await page.getByTestId('combo-next').click();
  // 3) Falsch: Korrektur sichtbar, Satz als Reparatur-Satz gespeichert.
  const wrong = `zzrule we talk about ${(await item.getAttribute('data-word')) ?? ''} tomorrow`;
  await page.getByTestId('combo-input').fill(wrong);
  await page.getByTestId('combo-check').click();
  await expect(page.getByTestId('combo-fixed')).toBeVisible();
  await expect(page.getByTestId('combo-rule-mark')).toHaveAttribute('data-ok', 'false');
  await expect.poll(async () => (((await dump(page))['app/repair'] as { items?: Array<Record<string, unknown>> } | undefined)?.items ?? []).some((e) => e.wrong === wrong)).toBe(true);
  expect(errors).toEqual([]);
});

test('Neues Thema: Mini-Lektion vor der ersten Aufgabe (Regel, Beispiele, typischer Fehler), „Los“ startet die Runde', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openTab(page, 'learn');
  const row = page.locator('[data-testid="topic"][data-topic="time-clauses"]');
  await expect(row).toHaveAttribute('data-state', 'new');
  await row.click();
  await expect(page.getByTestId('topic-start')).toBeVisible();
  await page.getByTestId('topic-start').click();
  await expect(page.getByTestId('mini-lesson')).toHaveAttribute('data-topic', 'time-clauses');
  await expect(page.getByTestId('mini-trap')).toBeVisible();
  await expect(page.getByTestId('gr-item')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  await page.getByTestId('mini-go').click();
  await expect(page.getByTestId('gr-item')).toHaveAttribute('data-topic', 'time-clauses');
  expect(errors).toEqual([]);
});
