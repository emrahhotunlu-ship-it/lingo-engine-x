import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey } from './learnHelpers';

// Die EINE Fehler-Karte der Grammatik (Politur P3, 13.11.2026; vorher Neustart E1 vom 08.11.): bei falscher eigener Antwort zuerst der
// geprüfte Warum-Satz (hinterlegte Erklärung bzw. Begründung der Lösung, sonst die Satzvorlage) – ohne von selbst Claude zu fragen. Darunter
// leise Wege auf Tipp: „Gleich nochmal“ (neuer Lückensatz desselben Musters aus dem geprüften Vorrat), „Regel ansehen“, „Claude fragen, warum“
// (genau ein Aufruf mistake-why@1). Die Lösung steht nur im Satz. Die Testlaufzeit antwortet fest (`canned/mistakeWhy.ts`).

const solve = grammarKey();
type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.map((c) => `${c.id}:${c.tier}`));
const TYPED = new Set(['gap', 'kwt', 'transform']);

/** Bis zur ersten getippten Aufgabe gehen und sie falsch beantworten (`zzz`); mit `again` nur eine, deren Karte „Gleich nochmal“ anbietet. */
async function firstWrongTyped(page: Page, o: { again?: boolean } = {}): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    const type = (await item.getAttribute('data-type')) ?? '';
    if (TYPED.has(type)) {
      await answerGrammar(page, solve, { given: 'zzz' });
      const card = page.getByTestId('mistake-card');
      await expect(card).toBeVisible();
      if (!o.again || (await card.getByTestId('mistake-again-open').count())) return;
    } else await answerGrammar(page, solve);
    await page.getByTestId('next').click();
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  throw new Error('keine passende getippte Aufgabe in 10 Schritten');
}

test('falsche Antwort: geprüfter Warum-Satz sofort, Claude nur auf Tipp (genau ein Aufruf), Regel nur auf Tipp', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { grammarNew: true });
  await firstWrongTyped(page);
  const card = page.getByTestId('mistake-card');
  await expect(card.getByTestId('mistake-why')).toHaveAttribute('data-src', /^(catalog|ok|fallback)$/);
  await expect(card.getByTestId('mistake-why')).not.toBeEmpty();
  // Kein Kasten mit „Du → richtig“: die Lösung steht nur im Satz.
  await expect(card.getByTestId('mistake-spot')).toHaveCount(0);
  // Von selbst fragt die Karte Claude nicht.
  await page.waitForTimeout(300);
  expect((await calls(page)).filter((c) => c.startsWith('mistake-why') || c.startsWith('explain-answer'))).toEqual([]);
  // Regel erst auf Tipp.
  await expect(page.getByTestId('rule-side')).toHaveCount(0);
  await card.getByTestId('mistake-rule').click();
  await expect(card.getByTestId('rule-side')).toBeVisible();
  // Claude auf Tipp: genau ein Aufruf, der Satz erscheint unter dem geprüften Text; der Knopf verschwindet.
  await card.getByTestId('mistake-ask').click();
  await expect(card.getByTestId('mistake-ai')).toBeVisible();
  await expect.poll(async () => (await calls(page)).filter((c) => c.startsWith('mistake-why'))).toEqual(['mistake-why:quick']);
  await expect(card.getByTestId('mistake-ask')).toHaveCount(0);
  expect((await calls(page)).filter((c) => c.startsWith('explain-answer'))).toEqual([]);
  expect(errors).toEqual([]);
});

test('Gleich nochmal: neuer Satz desselben Musters aus dem Vorrat, falsch und richtig selbst prüfbar, zählt nicht', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { grammarNew: true });
  await firstWrongTyped(page, { again: true });
  const card = page.getByTestId('mistake-card');
  const shown = await page.getByTestId('gr-item').getAttribute('data-type');
  await expect(card.getByTestId('mistake-again')).toHaveCount(0);
  await card.getByTestId('mistake-again-open').click();
  const again = card.getByTestId('mistake-again');
  await expect(again).toBeVisible();
  // Der Satz kommt aus dem geprüften Vorrat (nicht von Claude): kein Aufruf.
  expect((await calls(page)).filter((c) => c.startsWith('mistake-why'))).toEqual([]);
  // Satz wie im Vorrat; ein eigenes Stichwort der Aufgabe (`hint`, z. B. „(sign)“) steht zusätzlich hinter der Lücke.
  const text = await again.locator('p[lang="en"]').innerText();
  const answer = solve(text) ?? solve(text.replace(/\([^)]*\)/g, ' '));
  expect(answer, 'Lösung des Vorrat-Satzes').not.toBeNull();
  const input = card.getByTestId('mistake-again-input');
  await input.fill(answer ?? '');
  await card.getByTestId('mistake-again-check').click();
  await expect(card.getByTestId('mistake-again-result')).toHaveAttribute('data-ok', '1');
  // Auch bei richtig eine Zeile Warum aus dem Vorrat (Kap. 2 Nr. 4, Prüfbefund 13.11.2026).
  await expect(card.getByTestId('mistake-again-why')).not.toBeEmpty();
  // Die Karte bleibt (Enter/Prüfen geht nicht zur nächsten Aufgabe), die Aufgabe ist dieselbe.
  await expect(page.getByTestId('mistake-card')).toBeVisible();
  await expect(page.getByTestId('gr-item')).toHaveAttribute('data-type', shown ?? '');
  expect(errors).toEqual([]);
});
