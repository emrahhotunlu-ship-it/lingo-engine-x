import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { dump, forcedPatch, planPatch } from './trainerHelpers';

// Trainer nach Emrahs Rückmeldung (CLAUDE.md A7): keine Selbstbewertung, Status oben statt
// Erklärtexten, Platzhalter je Buchstabe, Beispielsätze, Wort-Antippen mit Wörterbuch,
// Lautschrift und „Claude fragen". Gegen den Produktions-Build mit eingespieltem Adapter.

test.use({ viewport: { width: 1440, height: 900 } });

type Calls = Array<{ id: string | null; tier: string; input: string }>;
const sampleCalls = (page: Page): Promise<Calls> =>
  page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Calls } }).__LINGO_FAKE__.sampleCalls]);

async function startWith(page: Page, patch: Record<string, Record<string, unknown>>, opts: { sample?: boolean } = {}) {
  const booted = await boot(page, {
    migrated: true,
    fake: { patch: { 'app/profile': planPatch(1), ...patch }, ...(opts.sample === false ? { capabilities: { sample: false } } : {}) },
  });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  return booted;
}

const avoid = () => forcedPatch()['vocab/avoid'] ?? {};
const overcome = () => forcedPatch()['vocab/overcome'] ?? {};

test('Status statt Erklärtexten, Platzhalter je Buchstabe, keine Bewertungsknöpfe, Beispiele', async ({ page }) => {
  const { errors } = await startWith(page, { 'vocab/avoid': avoid() });
  const ex = page.getByTestId('exercise');
  await expect(ex).toHaveAttribute('data-ex', 'cloze_hint');
  // Status: fünf Punkte mit Wort und Abfrageart; Aufgabe in einer Zeile.
  await expect(page.getByTestId('status')).toBeVisible();
  await expect(page.locator('.lx-dot')).toHaveCount(5);
  // Die Testkarte ist seit Jahren überfällig: niedrige Abrufwahrscheinlichkeit → unsicher.
  await expect(page.getByTestId('confidence')).toHaveText('unsicher');
  await expect(page.locator('.lx-dot[data-on]')).toHaveCount(2);
  await expect(page.getByTestId('ex-kind')).toContainText('Lücke mit Hilfe');
  await expect(page.getByTestId('task')).toHaveText('Ergänze die Lücke.');
  // „Wozu" nur hinter dem Info-Symbol.
  await expect(page.getByTestId('purpose')).toHaveCount(0);
  await page.getByTestId('purpose-info').click();
  await expect(page.getByTestId('purpose')).toBeVisible();
  await page.getByTestId('purpose-info').click();
  await expect(page.getByTestId('purpose')).toHaveCount(0);
  // Platzhalter: genau ein Platz je Buchstabe, der erste Buchstabe als Hilfe; die Lösung steht nicht im DOM.
  await expect(page.locator('[data-slot="letter"]')).toHaveCount('avoid'.length);
  await expect(page.locator('.lx-slot-hint')).toHaveText('a');
  expect(await page.getByTestId('exercise').innerHTML()).not.toContain('avoid');
  const text = await ex.innerText();
  for (const bad of ['Quelle', 'Vorschlag', 'Enter übernimmt', 'Wozu:', 'Warum']) expect(text, bad).not.toContain(bad);
  expect(text).not.toMatch(/\d+(,\d)? s\b/);

  await page.getByTestId('gap-input').click();
  await page.keyboard.type('avoid', { delay: 20 });
  await expect(page.locator('[data-slot="letter"][data-filled]')).toHaveCount(5);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  await expect(page.getByTestId('rating')).toHaveCount(0);
  await expect(page.getByTestId('why')).toHaveCount(0);
  await expect(page.getByTestId('meaning')).toContainText('vermeiden');
  await expect(page.getByTestId('meaning')).toContainText('Verb');
  await expect(page.getByTestId('due-in')).toHaveText(/^Wieder in \d+ (Min\.|Std\.|Tagen?)$/);
  // Beispiele: Kollokationssätze, nicht der schon sichtbare Satz.
  await expect(page.getByTestId('example')).toHaveCount(3);
  await expect(page.getByTestId('examples')).not.toContainText('Try to avoid driving');
  expect(await layoutProblems(page)).toEqual([]);
  if (process.env.LX_SHOTS) await page.screenshot({ path: `${process.env.LX_SHOTS}/desktop-result.png` });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('summary')).toBeVisible();
  const card = (await dump(page))['vocab/avoid'] as { hist: Array<{ g: number }> };
  expect(card.hist.at(-1)?.g).toBeGreaterThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('freie Stufe: „Tipp" deckt Platzhalter und ersten Buchstaben auf und zählt als Hilfe; Formhinweis', async ({ page }) => {
  const { errors } = await startWith(page, { 'vocab/overcome': overcome() });
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze');
  await expect(page.locator('[data-slot]')).toHaveCount(0);
  await page.getByTestId('hint').click();
  await expect(page.locator('[data-slot="letter"]')).toHaveCount('overcame'.length);
  await expect(page.locator('.lx-slot-hint')).toHaveCount(0);
  await expect(page.getByTestId('hint')).toHaveText('Erster Buchstabe');
  await page.getByTestId('hint').click();
  await expect(page.locator('.lx-slot-hint')).toHaveText('o');
  await expect(page.getByTestId('hint')).toHaveCount(0);
  // Die Tastatur bleibt im Feld: getippt wird direkt weiter.
  await page.keyboard.type('overcome', { delay: 20 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('verdict')).toHaveText('Fast richtig – andere Form');
  await expect(page.getByTestId('given')).toContainText('overcome');
  await expect(page.getByTestId('solution')).toHaveText('overcame');
  await expect(page.getByTestId('form-hint')).toHaveText('Vergangenheit: overcame · Grundform: overcome');
  await expect(page.getByTestId('due-in')).toHaveAttribute('data-grade', '2');
  if (process.env.LX_SHOTS) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.LX_SHOTS}/desktop-form.png` });
  }
  expect(errors).toEqual([]);
});

test('Wort antippen: Wörterbuch-Bedeutung und Lautschrift, „Claude fragen" mit dem Satz, Esc schließt', async ({ page }) => {
  const { errors } = await startWith(page, { 'vocab/avoid': avoid() });
  // Vor dem Prüfen: Wörter des Satzes antippbar, die Lücke nicht.
  const words = page.getByTestId('sentence').locator('button.lx-word');
  await expect(words.first()).toBeVisible();
  expect(await words.allInnerTexts()).not.toContain('avoid');
  await page.getByTestId('sentence').locator('button.lx-word[data-word="driving"]').click();
  const lk = page.getByTestId('lookup');
  await expect(lk).toBeVisible();
  await expect(page.getByTestId('lk-headword')).toHaveText('drive');
  await expect(page.getByTestId('lk-meaning')).not.toBeEmpty();
  await expect(page.getByTestId('lk-ipa')).toHaveText(/^\/.+\/$/);
  await expect(page.getByTestId('lk-form')).toContainText('driving');
  await expect(page.getByTestId('lk-listen')).toBeVisible();
  await page.getByTestId('lk-listen').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken)).toContain('drive');
  // Claude fragen: eine Anfrage (quick) mit dem Satz, Antwort in der Oberflächensprache.
  await page.getByTestId('lk-ask').click();
  await expect(page.getByTestId('lk-sense')).toBeVisible();
  await expect(page.getByTestId('lk-sense')).toContainText('Hier');
  const calls = (await sampleCalls(page)).filter((c) => c.id === 'word-lookup');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.tier).toBe('quick');
  expect(calls[0]?.input).toContain('Sentence: Try to avoid driving in rush hour.');
  await expect.poll(async () => ((await dump(page))['app/lookup']?.items as Record<string, unknown> | undefined)?.driving ?? null).not.toBeNull();
  await page.keyboard.press('Escape');
  await expect(lk).toHaveCount(0);
  await expect(page.getByTestId('trainer')).toBeVisible();
  // Als Karte speichern (mit Ursprungssatz).
  await page.getByTestId('sentence').locator('button.lx-word[data-word="rush"]').click();
  await expect(page.getByTestId('lk-save')).toBeVisible();
  await page.getByTestId('lk-save').click();
  await expect(page.getByTestId('lk-saved')).toBeVisible();
  const saved = (await dump(page))['vocab/rush'] as Record<string, unknown>;
  expect(saved).toMatchObject({ word: 'rush', src: 'lookup', state: 'new', ex: 'Try to avoid driving in [rush] hour.', origin: { v: 1, kind: 'trainer', ref: 'vocab/avoid' } });
  // Klick außerhalb schließt.
  await page.mouse.click(5, 5);
  await expect(page.getByTestId('lookup')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('fehlende Beispiele ergänzt Claude einmal (quick) und speichert sie an der Karte; ohne KI kein toter Knopf', async ({ page }) => {
  const { errors } = await startWith(page, { 'vocab/avoid': { ...avoid(), col: [] } });
  await page.getByTestId('gap-input').click();
  await page.keyboard.type('avoid', { delay: 20 });
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-testid="example"][data-src="ai"]')).toHaveCount(3);
  const calls = (await sampleCalls(page)).filter((c) => c.id === 'card-examples');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.tier).toBe('quick');
  // Beispielwörter sind antippbar.
  await expect(page.getByTestId('example').first().locator('button.lx-word').first()).toBeVisible();
  await expect.poll(async () => ((await dump(page))['vocab/avoid']?.xEx as unknown[] | undefined)?.length ?? 0).toBe(3);
  const card = (await dump(page))['vocab/avoid'] as Record<string, unknown>;
  expect(card.word).toBe('to avoid');
  expect(card.ex).toBe('Try to [avoid] driving in rush hour.');
  expect(errors).toEqual([]);
});

test('ohne KI: keine KI-Knöpfe, keine Beispiel-Anfrage, Wörterbuch funktioniert trotzdem', async ({ page }) => {
  const { errors } = await startWith(page, { 'vocab/avoid': { ...avoid(), col: [] } }, { sample: false });
  await page.getByTestId('gap-input').click();
  await page.keyboard.type('avoid', { delay: 20 });
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('next')).toBeVisible();
  await expect(page.getByTestId('examples')).toHaveCount(0);
  await page.getByTestId('sentence').locator('button.lx-word[data-word="driving"]').click();
  await expect(page.getByTestId('lk-meaning')).toBeVisible();
  await expect(page.getByTestId('lk-ask')).toHaveCount(0);
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Handy: Nachschlagen als Blatt von unten, kein Querscrollen', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(1), 'vocab/avoid': avoid() } } });
  await screen(page, 'today');
  await page.getByTestId('start').tap();
  await screen(page, 'trainer');
  if (process.env.LX_SHOTS) await page.screenshot({ path: `${process.env.LX_SHOTS}/mobile-question.png` });
  await page.getByTestId('gap-input').tap();
  await page.keyboard.type('avoid');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('next')).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);
  if (process.env.LX_SHOTS) await page.screenshot({ path: `${process.env.LX_SHOTS}/mobile-result.png`, fullPage: true });
  await page.getByTestId('sentence').locator('button.lx-word[data-word="driving"]').tap();
  const lk = page.getByTestId('lookup');
  await expect(lk).toBeVisible();
  await expect(lk).toHaveAttribute('aria-modal', 'true');
  const box = await lk.boundingBox();
  expect(box && Math.round(box.y + box.height)).toBeGreaterThanOrEqual(840);
  expect(await layoutProblems(page)).toEqual([]);
  if (process.env.LX_SHOTS) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${process.env.LX_SHOTS}/mobile-lookup.png` });
  }
  await page.getByTestId('lk-close').tap();
  await expect(lk).toHaveCount(0);
  expect(errors).toEqual([]);
  await context.close();
});
