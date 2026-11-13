import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { answerGrammar, grammarKey, nextItem, openHubDetails, typeInGap } from './learnHelpers';
import { dumpDb } from './diagnoseHelpers';

// Grammatik-Buch (Emrah 08.11.2026): Reiter Grammatik → Buch → Lektion → Übung A (mit Rückmeldung) → Ergebnis gespeichert; Klausur ohne
// Rückmeldung je Aufgabe, am Ende Note + Prozent und jeder Fehler mit Erklärung.

const solve = grammarKey();
const bookDoc = async (page: Page) => (await dumpDb(page))['app/book'] ?? null;

async function openBook(page: Page) {
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await openHubDetails(page);
  await expect(page.getByTestId('hub-book')).toBeVisible();
  await page.getByTestId('hub-book').click();
  await expect(page.getByTestId('book')).toBeVisible();
}

test('Buch: Lektion öffnen, Übung A mit Rückmeldung, Ergebnis auf der Lektionsseite', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, grammarNew: true, localStorage: { 'lx:input': 'keys' } });
  await openBook(page);
  await expect(page.getByTestId('book-next')).toBeVisible();
  await page.getByTestId('book-lesson-pres-simple-cont').click();
  await expect(page.getByTestId('book-lesson')).toHaveAttribute('data-topic', 'pres-simple-cont');
  await page.getByTestId('book-part-A').click();
  await expect(page.getByTestId('grammar-session')).toBeVisible();
  for (let i = 0; i < 6; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    expect(await item.getAttribute('data-type')).toBe('gap');
    await answerGrammar(page, solve, i === 0 ? { given: 'zzz' } : {});
    if (i === 0) await expect(page.getByTestId('mistake-card')).toBeVisible();
    await nextItem(page);
    if (await page.getByTestId('summary').isVisible()) break;
  }
  // Die falsche Aufgabe kommt am Ende noch einmal (Übung, nicht gezählt).
  for (let i = 0; i < 3 && !(await page.getByTestId('summary').isVisible()); i++) {
    await answerGrammar(page, solve);
    await nextItem(page);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect(page.getByTestId('summary')).toContainText('5 von 6');
  await expect.poll(async () => JSON.stringify(await bookDoc(page))).toContain('"pres-simple-cont"');
  expect(errors).toEqual([]);
});

test('Klausur: ohne Rückmeldung je Aufgabe, am Ende Note und Fehler mit Erklärung', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, grammarNew: true, localStorage: { 'lx:input': 'keys' } });
  await openBook(page);
  await page.getByTestId('book-exam-k1').click();
  await expect(page.getByTestId('grammar-session')).toBeVisible();
  for (let i = 0; i < 20; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    const type = (await item.getAttribute('data-type')) ?? '';
    // Die ersten 4 falsch, der Rest richtig (wo die Lösung bekannt ist).
    const wrong = i < 4;
    if (type === 'mc' || type === 'meaning' || type === 'find') {
      await answerGrammarBlind(page);
    } else {
      await typeInGap(page, wrong ? 'zzz' : (solve.full?.(await item.innerText())?.answer ?? solveShown(await item.innerText()) ?? 'zzz'));
      await page.getByTestId('check').click();
    }
    // Kein Urteil, keine Lösung: sofort die nächste Aufgabe bzw. die Auswertung.
    await expect(page.getByTestId('verdict')).toHaveCount(0);
    if (await page.getByTestId('summary').isVisible()) break;
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  const res = page.getByTestId('book-exam-result');
  await expect(res).toBeVisible();
  expect(Number(await res.getAttribute('data-grade'))).toBeGreaterThanOrEqual(1);
  await expect(page.getByTestId('session-end-mistakes')).toBeVisible();
  await expect.poll(async () => JSON.stringify(await bookDoc(page))).toContain('"k1"');
  expect(errors).toEqual([]);
});

function solveShown(text: string): string | null {
  return solve(text.replace(/\s+/g, ' ').trim());
}

/** Auswahl, Bedeutungspaar oder Fehler finden in der Klausur: irgendeine Antwort geben (ohne auf ein Urteil zu warten). */
async function answerGrammarBlind(page: Page): Promise<void> {
  const item = page.getByTestId('gr-item');
  const type = (await item.getAttribute('data-type')) ?? '';
  if (type === 'find') {
    await page.getByTestId('no-error').click();
    return;
  }
  await item.getByTestId('choice').first().click();
  await page.getByTestId('check').click();
}

test('Heute: begonnenes Buch – die Grammatik-Zeile nennt genau die nächste Buch-Seite (Untertitel = Klickziel)', async ({ page }) => {
  const t = Date.parse('2026-09-01T10:00:00+02:00');
  const { errors } = await boot(page, {
    migrated: true,
    grammarNew: true,
    fake: { patch: { 'app/book': { v: 1, ls: { 'pres-simple-cont': { A: { c: 5, n: 6, t, k: 1, best: 5 } } } } } },
  });
  await screen(page, 'today');
  const row = page.getByTestId('duty').filter({ hasText: 'Buch ·' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Übung B');
  expect(errors).toEqual([]);
});
