import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { answerGrammar, grammarKey, nextItem } from './learnHelpers';

// Live-Fehler 09.11.2026 (Emrah): „Grammatik-Übung für heute zweimal gestartet, muss zum dritten Mal von vorne anfangen.“
// Eine begonnene Buch-Seite geht nach dem Verlassen an derselben Aufgabe weiter – über „Weiter“ im Buch wie über die Heute-Zeile.

const solve = grammarKey();
const T0 = Date.parse('2026-09-01T10:00:00+02:00');
const BOOK = { 'app/book': { v: 1, ls: { 'pres-simple-cont': { A: { c: 5, n: 6, t: T0, k: 1, best: 5 } } } } };

async function bookNext(page: Page): Promise<void> {
  await page.getByTestId('tab-learn').click();
  const go = page.getByTestId('book-next-go');
  const hub = page.getByTestId('hub-book');
  await expect(go.or(hub)).toBeVisible();
  if (!(await go.isVisible())) await hub.click();
  await go.click();
}

async function answerTwo(page: Page): Promise<string> {
  for (let i = 0; i < 2; i++) {
    await answerGrammar(page, solve);
    await nextItem(page);
  }
  return shown(page);
}

/** Der Aufgabentext ohne das Status-Schild („neu für dich“/„lernst du gerade“ ändert sich mit den Antworten). */
async function shown(page: Page): Promise<string> {
  const item = page.getByTestId('gr-item');
  await expect(item).toBeVisible();
  const text = (await item.textContent()) ?? '';
  return text.slice(text.indexOf('Wozu?'));
}

test('Buch-Seite: nach Verlassen geht es über „Weiter“ im Buch an derselben Aufgabe weiter', async ({ page }) => {
  await boot(page, { migrated: true, grammarNew: true, localStorage: { 'lx:input': 'keys' }, fake: { patch: BOOK } });
  await screen(page, 'today');
  await bookNext(page);
  await expect(page.getByTestId('grammar-session')).toBeVisible();
  const at = await answerTwo(page);
  // Wie Emrah: Übung mit ✕ verlassen, zurück auf Heute.
  await page.getByTestId('round-close').click();
  await expect(page.getByTestId('gr-item')).toHaveCount(0);
  if (await page.getByTestId('tab-today').isVisible()) await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  await bookNext(page);
  await expect(page.getByTestId('gr-item')).toBeVisible();
  expect(await shown(page)).toBe(at);
});

test('Buch-Seite: nach Neuladen (Safari verwirft die Seite) öffnet sie an derselben Aufgabe', async ({ page }) => {
  await boot(page, { migrated: true, grammarNew: true, localStorage: { 'lx:input': 'keys' }, fake: { patch: BOOK } });
  await screen(page, 'today');
  await bookNext(page);
  await expect(page.getByTestId('grammar-session')).toBeVisible();
  const at = await answerTwo(page);
  await page.getByTestId('round-close').click();
  await expect(page.getByTestId('gr-item')).toHaveCount(0);
  await page.reload();
  // Innerhalb von 2 Minuten öffnet der Rahmen die Übung selbst wieder (app/resume.ts) – an derselben Aufgabe.
  await expect(page.getByTestId('gr-item')).toBeVisible();
  expect(await shown(page)).toBe(at);
});
