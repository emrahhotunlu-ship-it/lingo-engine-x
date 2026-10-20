import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey, nextItem, shownPrompt, skipMiniLesson, typeInGap } from './learnHelpers';

// Tutor-Engine v3 in der Übung (docs/umbau/tutor-engine-v3.md §2.1, §4.1, §6.4): Urteil über `judge`, „Auch richtig“ mit Zielform-Angebot,
// andere gültige Korrektur bei „Fehler finden“, unsicher ohne Claude, Knopf „Claude fragen“ ohne Zustimmung, Einspruch „Ich lag richtig“.
// Der Entwicklungs-Adapter antwortet auf `grammar-fit@2` (cannedReplies): „had“, „fit…“, „used to…“ passen; „used to…“ trifft auch das Ziel.

type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page): Promise<Dump> => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());
const fitCalls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string }> } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id.startsWith('grammar-fit')).length);

const solve = grammarKey();
const begun = (id: string) => ({ id, p: 0.5, n: 14, c: 10, last: Date.parse('2026-09-18T10:00:00+02:00'), hist: [{ d: '2026-09-10', p: 0.4 }], recent: [1, 1, 1], seen: [], seenText: [], errors: [] });

/** Bis zur Aufgabe mit diesem Wortlaut (andere werden richtig gelöst und weitergeklickt). */
async function toPrompt(page: Page, needle: string): Promise<void> {
  for (let i = 0; i < 16; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    if ((await shownPrompt(page)).includes(needle)) return;
    await answerGrammar(page, solve);
    await nextItem(page);
  }
  throw new Error(`Aufgabe „${needle}“ nicht in der Runde`);
}

const ARCHIVE = 'paper archive';

/** Prüfen; ein erster Fehlversuch zeigt erst einen Hinweis, dann zählt der zweite Klick (unverändert) als Ergebnis. */
async function checkToVerdict(page: Page): Promise<void> {
  const item = page.getByTestId('gr-item');
  await page.getByTestId('check').click();
  const near = item.locator('[data-testid="hint-line"][data-tone="near"]');
  await expect(item.getByTestId('verdict').or(near)).toBeVisible();
  if (await near.isVisible()) await page.getByTestId('check').click();
  await expect(item.getByTestId('verdict')).toBeVisible();
}

test('had: „Auch richtig“, Zielform-Angebot, keine Buchung', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': begun('used-to') } } });
  await skipMiniLesson(page);
  await toPrompt(page, ARCHIVE);
  const n0 = (await dump(page))['grammar/used-to']?.n;
  await typeInGap(page, 'had');
  await page.getByTestId('check').click();
  const verdict = page.getByTestId('verdict');
  await expect(verdict).toHaveAttribute('data-verdict', 'ok');
  await expect(verdict).toContainText('Auch richtig');
  await expect(page.getByTestId('judge-foot')).toHaveAttribute('data-action', 'targetForm');
  await expect(page.getByTestId('target-form')).toBeVisible();
  await expect(page.getByTestId('ask-claude')).toHaveCount(0);
  await page.getByTestId('next').click();
  await expect.poll(async () => ((await dump(page))['grammar/used-to']?.seen as string[] | undefined)?.length ?? 0).toBeGreaterThan(0);
  const doc = (await dump(page))['grammar/used-to']!;
  expect(doc.n).toBe(n0);
  expect(doc.errors).toEqual([]);
  expect(await fitCalls(page)).toBe(0);
  expect(errors).toEqual([]);
});

test('had → Zielform „used to have“: die App prüft selbst und bucht halb', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': begun('used-to') } } });
  await skipMiniLesson(page);
  await toPrompt(page, ARCHIVE);
  const n0 = Number((await dump(page))['grammar/used-to']?.n);
  await typeInGap(page, 'had');
  await page.getByTestId('check').click();
  await page.getByTestId('target-input').fill('used to have');
  await page.getByTestId('target-check').click();
  await expect(page.getByTestId('target-result')).toHaveAttribute('data-ok', '1');
  await page.getByTestId('next').click();
  await expect.poll(async () => Number((await dump(page))['grammar/used-to']?.n)).toBe(n0 + 1);
  expect((await dump(page))['grammar/used-to']?.errors).toEqual([]);
  expect(errors).toEqual([]);
});

test('ohne Zustimmung: unsicher → nur der Knopf „Claude fragen“; nach Claudes Ja mit Ziel → „Zählt“', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': begun('used-to') } } });
  await skipMiniLesson(page);
  await toPrompt(page, ARCHIVE);
  await typeInGap(page, 'used to keep');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  expect(await fitCalls(page)).toBe(0);
  const ask = page.getByTestId('ask-claude');
  await expect(ask).toBeVisible();
  await ask.click();
  await expect(page.getByTestId('verdict')).toContainText('Auch richtig');
  expect(await fitCalls(page)).toBe(1);
  // Nur EIN KI-Einstieg je Karte: nach „Claude fragen“ kein „Erklär mir meine Antwort“ daneben.
  await expect(page.getByTestId('counts')).toHaveText('Als richtig werten');
  await page.getByTestId('counts').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  // UX-Prüfung 19.10.2026: keine widersprechende „Richtig: …“-Zeile, sondern die neutrale Zeile zur Wertung.
  await expect(page.getByTestId('explanation-yours')).toContainText('Als richtig gewertet');
  await expect(page.getByRole('region', { name: 'Erklärung' })).not.toContainText('Richtig:');
  await page.getByTestId('next').click();
  await expect.poll(async () => JSON.stringify((await dump(page))['grammar/used-to']?.fitAlt ?? {})).toContain('used to keep');
  expect(JSON.stringify((await dump(page))['grammar/used-to']?.fitAlt)).toContain('"by":"me"');
  expect(errors).toEqual([]);
});

test('ohne Claude (?fake=nosample): unsicher wird wie „Fast“ gebucht, kein Claude-Knopf', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { capabilities: { sample: false }, patch: { 'grammar/used-to': begun('used-to') } } });
  await skipMiniLesson(page);
  await toPrompt(page, ARCHIVE);
  await typeInGap(page, 'used to keep');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'near');
  await expect(page.getByTestId('ask-claude')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Einspruch „Ich lag richtig“: als richtig gewertet und gemerkt, kein Claude-Knopf mehr', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': begun('used-to') } } });
  await skipMiniLesson(page);
  await toPrompt(page, ARCHIVE);
  await typeInGap(page, 'used to keep');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('ask-claude')).toBeVisible();
  await page.getByTestId('exercise-menu').click();
  await page.getByTestId('menu-override').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('ask-claude')).toHaveCount(0);
  // Die Erklärung widerspricht der Entscheidung nicht: neutrale Zeile statt „Richtig: used to have“.
  await expect(page.getByTestId('explanation-yours')).toContainText('Du hast gesagt, deine Antwort stimmt.');
  await expect(page.getByRole('region', { name: 'Erklärung' })).not.toContainText('Richtig:');
  await page.getByTestId('next').click();
  await expect.poll(async () => JSON.stringify((await dump(page))['grammar/used-to']?.fitAlt ?? {})).toContain('"by":"me"');
  expect(errors).toEqual([]);
});

test('Einspruch bei eindeutigem Formfehler („use to have“): erst „Sicher?“, Abbrechen lässt alles, Ja speichert', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': begun('used-to') } } });
  await skipMiniLesson(page);
  await toPrompt(page, ARCHIVE);
  await typeInGap(page, 'use to have');
  await checkToVerdict(page);
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
  await page.getByTestId('exercise-menu').click();
  await page.getByTestId('menu-override').click();
  const sure = page.getByTestId('override-sure');
  await expect(sure).toBeVisible();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
  await page.getByTestId('override-sure-no').click();
  await expect(sure).toHaveCount(0);
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
  await page.getByTestId('exercise-menu').click();
  await page.getByTestId('menu-override').click();
  await page.getByTestId('override-sure-yes').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('explanation-yours')).toContainText('Du hast gesagt, deine Antwort stimmt.');
  await page.getByTestId('next').click();
  await expect.poll(async () => JSON.stringify((await dump(page))['grammar/used-to']?.fitAlt ?? {})).toContain('use to have');
  expect(errors).toEqual([]);
});

test('Esc bei offenem ⋯-Menü schließt nur das Menü, nicht die Runde', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': begun('used-to') } } });
  await skipMiniLesson(page);
  await toPrompt(page, ARCHIVE);
  await typeInGap(page, 'use to have');
  await checkToVerdict(page);
  await page.getByTestId('exercise-menu').click();
  await expect(page.getByTestId('menu-override')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('menu-override')).toHaveCount(0);
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await expect(page.getByTestId('verdict')).toBeVisible();
  expect(errors).toEqual([]);
});

test('„Walking …“: die Korrektur im Hauptsatz (andere gültige Stelle) zählt', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'c1-participle' }, { fake: { patch: { 'grammar/c1-participle': begun('c1-participle') } } });
  await skipMiniLesson(page);
  await toPrompt(page, 'Walking to work, my phone rang');
  const item = page.getByTestId('gr-item');
  // Wörter: Walking(0) to(1) work,(2) my(3) phone(4) rang(5) twice.(6)
  await item.getByTestId('spot-word').nth(4).click();
  await page.getByTestId('check').click();
  await typeInGap(page, 'I heard my phone ring twice.');
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('verdict-sub')).toContainText('auch richtig korrigiert');
  // Belegt: richtig gebucht (keine Fehlersätze), die Antwort steht im Thema als gesehen.
  await page.getByTestId('next').click();
  await expect.poll(async () => ((await dump(page))['grammar/c1-participle']?.seen as string[] | undefined)?.length ?? 0).toBeGreaterThan(0);
  expect((await dump(page))['grammar/c1-participle']?.errors).toEqual([]);
  expect(errors).toEqual([]);
});
