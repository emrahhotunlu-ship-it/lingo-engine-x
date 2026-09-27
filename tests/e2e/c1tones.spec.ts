import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, type Lang } from './fixtures';
import { answerGrammar, grammarKey, nextItem } from './learnHelpers';
import { DAY, dump, type Dump } from './trainerHelpers';

// Lernberatung 27.09.:
// - Vorschlag 7 „C1-Werkzeugkasten“: die 7 Themen stehen in der Grammatik-Übersicht, haben ein
//   Regelblatt und eine eigene Runde; ein Fehler landet in `grammar/c1-*` (Fehler-Wiederholung).
// - Vorschlag 8 „Eine Botschaft, drei Tonlagen“: Sachverhalt → drei Fassungen → tone-check@1 →
//   Tonurteil, Musterfassung, echte Fehler; Fehler → `app/repair` (Quelle tone), Eintrag in
//   `tones/<Monat>`, `act.tones`, Log. Freiwillig. Ohne Claude: speichern ohne Prüfung.

type Doc = Record<string, unknown>;
const solve = grammarKey();
const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

const TEXTS = {
  slack: 'Hey, quick heads-up: the migration will delay for two weeks because the export takes longer.',
  cfo: 'The migration will delay for two weeks. The export from the old system takes longer than we planned, sorry. Can we discuss about the new plan next week?',
  meeting: 'We hereby inform you that the migration is postponed by two weeks.',
};

const TEXT: Record<Lang, { title: string; task: string; verdicts: string[]; group: string }> = {
  de: { title: 'Eine Botschaft, drei Tonlagen', task: 'Formuliere den Sachverhalt dreimal auf Englisch – passend für jeden Empfänger.', verdicts: ['Passend', 'Zu direkt', 'Zu steif'], group: 'C1-Werkzeugkasten' },
  en: { title: 'One message, three tones', task: 'Write the message three times in English – right for each audience.', verdicts: ['Just right', 'Too direct', 'Too stiff'], group: 'C1 toolkit' },
};

const actOf = (d: Dump, day: string): Doc => (d['app/profile']?.act as Record<string, Doc> | undefined)?.[day] ?? {};

/** Direkter Einstieg (bis der Navigations-Umbau den Knopf auf der Übersicht setzt). */
async function openTones(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('lx:open', { detail: 'tones' })));
  await expect(page.locator('[data-screen="tones"]')).toBeVisible();
  await expect(page.getByTestId('tones')).toHaveAttribute('data-phase', 'write');
}

async function fullRun(page: Page, lang: Lang, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  const { errors, external } = await boot(page, { migrated: true, lang });
  await openTones(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(TEXT[lang].title);
  await expect(page.getByTestId('task')).toHaveText(TEXT[lang].task);
  // Zweck nur hinter dem Info-Symbol (A7).
  await expect(page.getByTestId('purpose')).toHaveCount(0);
  await page.getByTestId('purpose-info').click();
  await expect(page.getByTestId('purpose')).toBeVisible();
  // „Anderer Sachverhalt“ wechselt, solange nichts geschrieben ist.
  const msg0 = await page.getByTestId('tones-message').getAttribute('data-msg');
  await page.getByTestId('tones-other').click();
  await expect(page.getByTestId('tones-message')).not.toHaveAttribute('data-msg', msg0 ?? '');
  const msg = await page.getByTestId('tones-message').getAttribute('data-msg');
  await expect(page.getByTestId('tones-field')).toHaveCount(3);
  expect(await layoutProblems(page)).toEqual([]);

  // Erst mit allen drei Fassungen prüfbar.
  await page.getByTestId('tones-draft-slack').fill(TEXTS.slack);
  await expect(page.getByTestId('tones-check')).toBeDisabled();
  await expect(page.getByTestId('tones-other')).toHaveCount(0);
  await page.getByTestId('tones-draft-cfo').fill(TEXTS.cfo);
  await page.getByTestId('tones-draft-meeting').fill(TEXTS.meeting);
  await page.getByTestId('tones-check').click();

  // Ergebnis: je Tonlage Urteil, Grund, Musterfassung (antippbar); echte Fehler; Merksatz.
  await expect(page.getByTestId('tones')).toHaveAttribute('data-phase', 'result');
  const versions = page.getByTestId('tones-version');
  await expect(versions).toHaveCount(3);
  expect(await versions.evaluateAll((els) => els.map((e) => e.getAttribute('data-tone')))).toEqual(['fits', 'too_direct', 'too_stiff']);
  expect(await page.getByTestId('tones-verdict').allInnerTexts()).toEqual(TEXT[lang].verdicts);
  await expect(page.getByTestId('tones-why').first()).not.toBeEmpty();
  await expect(page.getByTestId('tones-tip')).not.toBeEmpty();
  expect(await page.getByTestId('tones-model').nth(1).locator('button.lx-word').count()).toBeGreaterThan(10);
  await expect(page.getByTestId('tones-correction')).toHaveCount(3);
  await expect(page.getByTestId('tones-corrections')).toContainText('will be delayed by two weeks');
  // Keine Selbstbewertung: keine Notenknöpfe.
  await expect(page.getByRole('button', { name: /^(Nochmal|Schwer|Gut|Leicht|Again|Hard|Good|Easy)$/ })).toHaveCount(0);
  await expect(page.getByTestId('unit-done')).toHaveAttribute('data-state', 'done');

  // Reparatur-Sätze (ganzer eigener Satz, Quelle tone).
  await expect(page.getByTestId('tones-repairs')).toHaveAttribute('data-n', '3');
  await expect.poll(async () => (((await dump(page))['app/repair']?.items as Doc[] | undefined) ?? []).length).toBe(3);
  const repairs = (await dump(page))['app/repair']?.items as Doc[];
  expect(repairs.every((r) => r.src === 'tone' && r.box === 0)).toBe(true);
  expect(repairs.map((r) => r.wrong)).toContain('The migration will delay for two weeks.');
  expect(repairs.map((r) => r.right)).toContain('Can we discuss the new plan next week?');

  // Gespeichert: Monatsdokument, Log, act.tones (Extra).
  await expect.poll(async () => actOf(await dump(page), DAY).tones).toBe(1);
  const d = await dump(page);
  const item = (d['tones/2026-09']?.items as Doc[])[0]!;
  expect(item).toMatchObject({ day: DAY, msg, lang, ai: true, texts: TEXTS });
  expect(((item.fb as Doc).versions as Doc[]).map((v) => v.tone)).toEqual(['fits', 'too_direct', 'too_stiff']);
  const log = ((d[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.type === 'tones');
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ id: msg, m: 'tones', ctx: 'tones', n: 3, ok: true });
  expect(await layoutProblems(page)).toEqual([]);

  await page.getByTestId('summary-back').click();
  await screen(page, 'today');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
}

test.describe('Eine Botschaft, drei Tonlagen', () => {
  test('Handy 390, Deutsch: ganzer Ablauf', async ({ page }) => {
    await fullRun(page, 'de', MOBILE);
  });

  test('Desktop, English: whole flow', async ({ page }) => {
    await fullRun(page, 'en', DESKTOP);
  });

  test('ohne Claude: speichern ohne Prüfung, zählt als Extra, keine Reparatur-Sätze', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
    await openTones(page);
    await expect(page.getByTestId('tones-noai-hint')).toBeVisible();
    await expect(page.getByTestId('tones-check')).toHaveCount(0);
    await expect(page.getByTestId('tones-noai')).toBeDisabled();
    await page.getByTestId('tones-draft-slack').fill(TEXTS.slack);
    await page.getByTestId('tones-draft-cfo').fill(TEXTS.cfo);
    await page.getByTestId('tones-draft-meeting').fill(TEXTS.meeting);
    await page.getByTestId('tones-noai').click();
    await expect(page.getByTestId('tones')).toHaveAttribute('data-phase', 'result');
    await expect(page.getByTestId('tones-result')).toHaveAttribute('data-ai', 'no');
    await expect(page.getByTestId('tones-version')).toHaveCount(3);
    await expect(page.getByTestId('tones-model')).toHaveCount(0);
    await expect.poll(async () => actOf(await dump(page), DAY).tones).toBe(1);
    const d = await dump(page);
    expect((d['tones/2026-09']?.items as Doc[])[0]).toMatchObject({ ai: false, fb: null });
    expect(d['app/repair']).toBeUndefined();
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});

async function openGrammar(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await page.getByTestId('hub-grammar').click();
  await expect(page.getByTestId('grammar')).toBeVisible();
}

test.describe('C1-Werkzeugkasten', () => {
  for (const [lang, viewport] of [['de', MOBILE], ['en', DESKTOP]] as const) {
    test(`Übersicht, Regelblatt und eigene Runde (${lang}, ${viewport.width})`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const { errors, external } = await boot(page, { migrated: true, lang });
      await openGrammar(page);
      const c1 = page.locator('[data-testid="topic"][data-topic^="c1-"]');
      await expect(c1).toHaveCount(7);
      await expect(page.locator('[data-testid="topic"][data-topic="c1-hedging"]')).toContainText(TEXT[lang].group);
      expect(await layoutProblems(page)).toEqual([]);

      await page.locator('[data-testid="topic"][data-topic="c1-emphasis"]').click();
      const sheet = page.getByTestId('rule-sheet');
      await expect(sheet).toHaveAttribute('data-topic', 'c1-emphasis');
      await expect(sheet).toContainText('Not only did we cut costs');
      expect(await sheet.locator('button.lx-word').count()).toBeGreaterThan(5);
      expect(await layoutProblems(page)).toEqual([]);

      await page.getByTestId('topic-start').click();
      await screen(page, 'grammarSession');
      // Erste Aufgabe falsch, der Rest richtig – alle aus dem Thema.
      const topics: string[] = [];
      for (let k = 0; k < 12; k++) {
        await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
        if (await page.getByTestId('summary').isVisible()) break;
        topics.push((await page.getByTestId('gr-item').getAttribute('data-topic')) ?? '');
        const r = await answerGrammar(page, solve, { wrong: k === 0 });
        expect(r.answer, `Lösung für Aufgabe ${k + 1} bekannt`).not.toBeNull();
        if (k === 0) expect(await layoutProblems(page)).toEqual([]);
        await nextItem(page);
        await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
      }
      await expect(page.getByTestId('summary')).toBeVisible();
      expect(topics).toHaveLength(8);
      expect(topics.every((t) => t === 'c1-emphasis')).toBe(true);
      await expect.poll(async () => (((await dump(page))['grammar/c1-emphasis']?.errors as Doc[] | undefined) ?? []).length).toBe(1);
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });
  }
});
