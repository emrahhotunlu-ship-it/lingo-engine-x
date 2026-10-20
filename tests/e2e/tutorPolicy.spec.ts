import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey, nextItem } from './learnHelpers';

// Tutor-Engine v3 (S2/S3) in der Grammatikrunde: nach drei getippten Fehlern in Folge kommt etwas Bekanntes („Kurz etwas Bekanntes, dann
// weiter.“), die Zahl der Aufgaben bleibt gleich; „Warum diese Aufgabe?“ zeigt je Aufgabe einen Grund aus den Daten. Alle Daten sind erfunden.

const solve = grammarKey();
const OLD = Date.parse('2020-01-01T10:00:00+01:00');
/** Zuletzt geübt vor zwei Tagen (sonst sinkt die angezeigte Beherrschung und die Runde fragt nur Auswahl ab). */
const RECENT = Date.parse('2026-09-18T10:00:00+02:00');
const doc = (topic: string, p: number, pats: Record<string, unknown>): Record<string, unknown> => ({
  id: topic,
  p,
  anchor: p,
  anchorD: '2026-09-15',
  n: 6,
  c: 4,
  due: RECENT + 30 * 86_400_000,
  last: RECENT,
  recent: [1, 1, 0, 1],
  seen: [],
  seenText: [],
  hist: [{ d: '2026-09-15', p }],
  errors: [],
  pats,
});
/** Sicher beherrscht: die letzten 5 Ergebnisse richtig ohne Hilfe, an zwei Tagen. */
const strong = { n: 6, c: 6, last: OLD, h: 0, r: 31, k: 5, dd: ['2026-09-18', '2026-09-19'], i: '2026-09-01', s: '2026-09-10' };
const TOPIC_IDS = (JSON.parse(readFileSync(new URL('../../src/content/grammar/path.json', import.meta.url), 'utf8')) as { chapters: Array<{ topics: string[] }> }).chapters.flatMap((c) => c.topics);
/** Alle Themen ohne offene Fehlersätze; „Präsens einfach/Verlaufsform“ ist sicher beherrscht (das Bekannte für den Tausch). */
const patches = (): Record<string, Record<string, unknown>> => ({
  ...Object.fromEntries(TOPIC_IDS.map((t) => [`grammar/${t}`, doc(t, 0.5, {})])),
  'grammar/pres-simple-cont': doc('pres-simple-cont', 0.95, { 'psc.now': strong, 'psc.habit': strong, 'psc.state': strong }),
});

const total = async (page: Page): Promise<string | null> => page.getByTestId('exercise-bar').getByRole('progressbar').getAttribute('aria-valuemax');

test('drei getippte Fehler in Folge: etwas Bekanntes, die Runde wird nicht kürzer', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { fake: { patch: patches() } });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  const before = await total(page);
  expect(Number(before)).toBeGreaterThan(3);
  let typedWrong = 0;
  for (let i = 0; i < 6 && typedWrong < 3; i++) {
    const { type } = await answerGrammar(page, solve, { wrong: true });
    if (type !== 'mc' && type !== 'meaning') typedWrong++;
    await expect(page.getByTestId('tutor-win')).toHaveCount(0);
    await nextItem(page);
    await expect(page.getByTestId('gr-item')).toBeVisible();
  }
  expect(typedWrong).toBe(3);
  await expect(page.getByTestId('tutor-win')).toHaveText('Kurz etwas Bekanntes, dann weiter.');
  await expect(page.getByTestId('gr-item')).toHaveAttribute('data-topic', 'pres-simple-cont');
  // Der Grund steht schon als Statuszeile da: im ⓘ kein zweiter Grund.
  await page.getByTestId('purpose-info').click();
  await expect(page.getByTestId('why-line')).toHaveCount(0);
  await page.getByTestId('purpose-info').click();
  expect(await total(page)).toBe(before);
  // Richtig beantwortet: die Statuszeile verschwindet mit der nächsten Aufgabe.
  await answerGrammar(page, solve);
  await nextItem(page);
  await expect(page.getByTestId('tutor-win')).toHaveCount(0);
  expect(await total(page)).toBe(before);
  expect(errors).toEqual([]);
});

test('„Warum diese Aufgabe?“: ein Satz aus den Daten im ⓘ der Übung (eine feste Stelle, ohne Lösungsformel vor dem Prüfen)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { fake: { patch: patches() } });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  // UX-Prüfung 19.10.2026: kein eigener Knopf mehr unter der Übung, der Grund steht im ⓘ.
  await expect(page.getByTestId('why-toggle')).toHaveCount(0);
  const btn = page.getByTestId('purpose-info');
  await expect(btn).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('why-line')).toHaveCount(0);
  await btn.click();
  await expect(btn).toHaveAttribute('aria-expanded', 'true');
  const line = page.getByTestId('why-line');
  await expect(line).toBeVisible();
  await expect(line).toHaveAttribute('data-code', /^(due|intro|chapter|focus|need|family|chosen|mix|plan)$/);
  expect(((await line.innerText()) ?? '').length).toBeGreaterThan(15);
  await expect(line).not.toContainText('{');
  // Vor dem Prüfen keine Formel („+ Grundform“ o. Ä.) im Grund und im Musternamen.
  await expect(page.getByTestId('purpose')).not.toContainText('+');
  // Nachprüfung N3: vor dem Prüfen nur der Themenname (kein Muster dahinter), am Handy höchstens drei Zeilen.
  await expect(page.getByTestId('purpose').locator('span.text-fg')).not.toContainText(' · ');
  const lines = await page.getByTestId('purpose').evaluate((el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)));
  expect(lines).toBeLessThanOrEqual(3);
  await btn.click();
  await expect(page.getByTestId('why-line')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Why this task? in the English interface', async ({ page }) => {
  await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { lang: 'en', fake: { patch: patches() } });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await page.getByTestId('purpose-info').click();
  await expect(page.getByTestId('why-line')).toBeVisible();
  await expect(page.getByTestId('why-line')).not.toContainText(/[äöüß]|Aufgabe|Fehler/);
});
