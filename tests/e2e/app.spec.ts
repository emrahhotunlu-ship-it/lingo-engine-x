import { expect, test } from '@playwright/test';
import { hash32 } from '../../src/domain/random';
import { boot, layoutProblems, placedProfile, playSession } from './fixtures';

// Kernabläufe des neuen Trainers (docs/neustart.md) gegen den echten Produktions-Build.

test.describe('Start und Übernahme', () => {
  test('alte Daten werden übernommen, Einstufung ist der eine Knopf', async ({ page }) => {
    const { external, errors } = await boot(page);
    await expect(page.getByTestId('home')).toBeVisible();
    await expect(page.getByTestId('start-placement')).toBeEnabled();
    // Übernahme: Karten aus der alten App liegen jetzt im Trainer.
    await expect
      .poll(() => page.evaluate(() => Object.keys(window.__LINGO_FAKE__!.db.dump()).filter((p) => p.startsWith('coach/cards-')).length))
      .toBeGreaterThan(0);
    expect(await layoutProblems(page)).toEqual([]);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ohne Datenbank: klarer Hinweis statt leerer Seite', async ({ page }) => {
    await boot(page, { fake: { capabilities: { db: false, sample: false, downloads: false } } });
    await expect(page.getByTestId('no-db')).toBeVisible();
  });
});

test('Einstufung von Anfang bis Ende', async ({ page }) => {
  await boot(page, { fake: { seed: 'empty' } });
  await page.getByTestId('start-placement').click();
  await page.getByTestId('placement-start').click();
  // Wortschatz: abwechselnd Ja und Nein; Prüffragen mit der ersten Option beantworten.
  for (let i = 0; i < 200; i++) {
    const grammar = page.getByTestId('grammar-test');
    if (await grammar.isVisible()) break;
    const verify = page.getByTestId('vocab-verify');
    if (await verify.isVisible()) {
      await verify.getByRole('button').first().click();
      continue;
    }
    await page.getByTestId(i % 2 ? 'vocab-no' : 'vocab-yes').click();
  }
  await expect(page.getByTestId('grammar-test')).toBeVisible();
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId('placement-result').isVisible()) break;
    await page.getByTestId('grammar-skip').click();
  }
  await expect(page.getByTestId('placement-level')).toHaveText(/^(A2|B1|B1\+|B2|B2\+|C1|C1\+)$/);
  expect(await layoutProblems(page)).toEqual([]);
  await page.getByTestId('placement-done').click();
  await expect(page.getByTestId('start-training')).toBeVisible();
  await expect(page.getByTestId('home-way')).toBeVisible();
});

test('Training: Einheit durchspielen, danach ist Heute erledigt', async ({ page }) => {
  const { errors } = await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile() } } });
  await expect(page.getByTestId('brief')).toContainText('3 neue Wörter');
  await page.getByTestId('start-training').click();
  await expect(page.getByTestId('session')).toBeVisible();
  const steps = await playSession(page);
  expect(steps).toBeGreaterThan(3);
  await page.getByTestId('to-home').click();
  await expect(page.getByTestId('today-done')).toBeVisible();
  await expect(page.getByTestId('streak')).toContainText('3');
  // Erledigt heißt erledigt: kein Trainings-Knopf mehr, nur das freiwillige Extra.
  await expect(page.getByTestId('start-training')).toHaveCount(0);
  await expect(page.getByTestId('extra-new')).toBeVisible();
  // Grammatik-Stand gespeichert, Blitzrunde als Extra erreichbar.
  expect(await page.evaluate(() => Object.keys((window.__LINGO_FAKE__!.db.dump()['coach/grammar'] as { t?: object } | undefined)?.t ?? {}).length)).toBeGreaterThan(0);
  await page.getByTestId('open-blitz').click();
  await expect(page.getByTestId('blitz')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Lücke: richtige Antwort wird als richtig gewertet', async ({ page }) => {
  // Eine fällige Karte auf Stufe 2 (frei abrufen): „negotiate".
  const due = Date.parse('2026-09-19T10:00:00+02:00');
  const card = {
    src: 'bank',
    lv: 2,
    add: due - 10 * 86_400_000,
    f: { v: 1, due, stability: 3, difficulty: 5, state: 2, reps: 3, lapses: 0, last: due - 3 * 86_400_000, scheduledDays: 3, learningSteps: 0, src: 'lx' },
  };
  await boot(page, {
    fake: { seed: 'empty', patch: { 'coach/profile': placedProfile({ newPerDay: 5 }), [`coach/cards-${hash32('negotiate') % 8}`]: { c: { negotiate: card } } } },
  });
  await page.getByTestId('start-training').click();
  const exercise = page.getByTestId('exercise');
  await expect(exercise).toBeVisible();
  await expect(exercise).toHaveAttribute('data-format', 'recall');
  await page.locator('.lx-hidden-input').click();
  await page.keyboard.type('negotiate');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'correct');
  await expect(page.getByTestId('next-due')).toContainText(/Tagen|morgen/);
});

test('Sprache und Darstellung umschalten', async ({ page }) => {
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile() } } });
  await page.getByTestId('open-settings').click();
  await page.getByTestId('set-lang').getByText('English').click();
  await page.getByTestId('set-theme').getByText('Light').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('start-training')).toHaveText(/Start training/);
  const stored = await page.evaluate(() => (window.__LINGO_FAKE__!.db.dump()['coach/profile'] as { ui?: unknown }).ui);
  expect(stored).toEqual({ lang: 'en', theme: 'light' });
});

test('Übersetzer: Wörterbuch ohne KI, Satz mit Claude', async ({ page }) => {
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile() } } });
  await page.getByTestId('open-translate').click();
  await page.getByTestId('translate-input').fill('verhandeln');
  await expect(page.getByTestId('translate-hits')).toContainText('negotiate');
  const callsBefore = await page.evaluate(() => window.__LINGO_FAKE__!.sampleCalls.length);
  expect(callsBefore).toBe(0);
  await page.getByTestId('translate-input').fill('Wir müssen einen besseren Preis verhandeln.');
  await page.getByTestId('translate-ai').click();
  await expect(page.getByTestId('translate-result')).toContainText('negotiate');
});

test('Claude fragen mit Bezug zur Aufgabe', async ({ page }) => {
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile() } } });
  await page.getByTestId('open-ask').click();
  await page.getByTestId('ask-input').fill('Was heißt negotiate?');
  await page.getByTestId('ask-send').click();
  await expect(page.getByTestId('ask-answer')).toContainText('verhandeln');
});

test('Fahrplan zeigt Etappen, Wortschatz und Grammatik', async ({ page }) => {
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile() } } });
  await page.getByTestId('tab-plan').click();
  await expect(page.getByTestId('meter-vocab')).toContainText('4.200');
  await expect(page.getByTestId('meter-grammar')).toBeVisible();
  await expect(page.getByTestId('stage-1')).toHaveAttribute('aria-current', 'step');
  expect(await layoutProblems(page)).toEqual([]);
});

test('Input des Tages: Beitrag lesen, bewerten, Teil 2 erledigt', async ({ page }) => {
  const item = {
    id: 'ai-chips',
    kind: 'article',
    title: 'Why AI chips are so hard to make',
    source: 'The Verge',
    url: 'https://www.theverge.com/example',
    mins: 8,
    level: 'B2+',
    topic: 'tech',
    why_de: 'Passt zu deinem Interesse an KI.',
    why_en: 'Fits your interest in AI.',
    words: [{ en: 'supply chain', de: 'Lieferkette' }],
  };
  await boot(page, { fake: { seed: 'empty', patch: { 'coach/profile': placedProfile(), 'input/2026-09-20': { d: '2026-09-20', items: [item] } } } });
  await expect(page.getByTestId('part-input')).toContainText('Why AI chips');
  await page.getByTestId('tab-input').click();
  await expect(page.getByTestId('input-item')).toContainText('The Verge');
  await page.getByTestId('input-finish').click();
  await page.getByRole('radio', { name: 'Spannend' }).click();
  await page.getByRole('radio', { name: 'Passend' }).click();
  await page.getByTestId('input-save').click();
  await expect(page.getByTestId('input-done-badge')).toBeVisible();
  await page.getByTestId('own-20').click();
  await expect(page.getByTestId('own-time')).toContainText('20');
  await page.getByTestId('tab-home').click();
  await expect(page.getByTestId('part-input')).toHaveAttribute('data-done', '1');
  // Zusammenfassung für den Tagesauftrag enthält die Bewertung.
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.__LINGO_FAKE__!.db.dump()['coach/summary'] ?? {})), { timeout: 8000 }).toContain('"tech":1');
});
