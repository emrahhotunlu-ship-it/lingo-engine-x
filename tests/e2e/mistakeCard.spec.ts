import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey } from './learnHelpers';

// Neustart E1 (Emrah 08.11.2026: „ich checke meinen Fehler nicht, weil du ihn nicht erklärst“). Bei falscher eigener Antwort in der neuen
// Grammatik: „Du → richtig“, EIN Satz warum (mistake-why@1, genau ein Aufruf), „Gleich nochmal“ selbst prüfbar; die Regel erst auf Tipp;
// kein zweiter automatischer Claude-Aufruf (explain-answer). Die Testlaufzeit antwortet fest (`canned/mistakeWhy.ts`).

const solve = grammarKey();
type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.map((c) => `${c.id}:${c.tier}`));

test('falsche Antwort: Du → richtig, ein Satz von Claude, Gleich nochmal; Regel nur auf Tipp', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { grammarNew: true });
  let typed = false;
  // Erste getippte Aufgabe (Auswahl/Fehler-finden werden richtig beantwortet und übersprungen).
  for (let i = 0; i < 8 && !typed; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    const type = (await item.getAttribute('data-type')) ?? '';
    typed = type === 'gap' || type === 'kwt' || type === 'transform';
    await answerGrammar(page, solve, typed ? { given: 'zzz' } : {});
    if (!typed) {
      await page.getByTestId('next').click();
      await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
    }
  }
  expect(typed).toBe(true);
  const card = page.getByTestId('mistake-card');
  await expect(card).toBeVisible();
  await expect(card.getByTestId('mistake-spot')).toContainText('zzz');
  await expect(card.getByTestId('mistake-why')).toHaveAttribute('data-src', /ai|catalog/);
  await expect(card.getByTestId('mistake-why')).toContainText('zzz');
  // Genau ein Aufruf der neuen Vorlage, keine zweite automatische Erklärung.
  await expect.poll(async () => (await calls(page)).filter((c) => c.startsWith('mistake-why'))).toEqual(['mistake-why:quick']);
  expect((await calls(page)).filter((c) => c.startsWith('explain-answer'))).toEqual([]);
  // Regel erst auf Tipp.
  await expect(page.getByTestId('rule-side')).toHaveCount(0);
  await card.getByTestId('mistake-rule').click();
  await expect(card.getByTestId('rule-side')).toBeVisible();
  // Gleich nochmal: falsch, dann neue Karte → richtig; Enter geht nicht weiter zur nächsten Aufgabe.
  const input = card.getByTestId('mistake-again-input');
  await input.fill('sign');
  await input.press('Enter');
  await expect(card.getByTestId('mistake-again-result')).toHaveAttribute('data-ok', '0');
  await expect(card.getByTestId('mistake-again-result')).toContainText('signs');
  await expect(page.getByTestId('mistake-card')).toBeVisible();
  expect(errors).toEqual([]);
});

test('richtige Lösung bei Gleich nochmal wird bestätigt', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { grammarNew: true });
  for (let i = 0; i < 8; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    const type = (await item.getAttribute('data-type')) ?? '';
    if (type === 'gap' || type === 'kwt' || type === 'transform') {
      await answerGrammar(page, solve, { given: 'zzz' });
      break;
    }
    await answerGrammar(page, solve);
    await page.getByTestId('next').click();
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  const input = page.getByTestId('mistake-again-input');
  await input.fill('Signs');
  await page.getByTestId('mistake-again-check').click();
  await expect(page.getByTestId('mistake-again-result')).toHaveAttribute('data-ok', '1');
  expect(errors).toEqual([]);
});
