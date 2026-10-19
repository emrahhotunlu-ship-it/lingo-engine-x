import { expect, test, type Page } from '@playwright/test';
import { bootAt } from './fixtures';
import { grammarKey, nextItem, skipMiniLesson, answerGrammar } from './learnHelpers';

// „Auch richtig“ (19.10.2026, Emrah: „had“ statt „used to have“ galt als Fehler). Der Entwicklungs-Adapter antwortet auf `grammar-fit@2`
// für Antworten, die mit „fit“ beginnen, mit fits:true/certain:true; alles andere passt nicht.

const solve = grammarKey();
const BEGUN = { id: 'used-to', p: 0.5, n: 14, c: 10, last: Date.parse('2026-09-18T10:00:00+02:00'), hist: [{ d: '2026-09-10', p: 0.4 }], recent: [1, 1, 1], seen: [], seenText: [], errors: [] };

/** Die erste Lückenaufgabe der Runde erreichen (andere Arten werden richtig gelöst und weitergeklickt). */
async function toGap(page: Page): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const item = page.getByTestId('gr-item');
    await expect(item).toBeVisible();
    if ((await item.getAttribute('data-type')) === 'gap') return;
    await answerGrammar(page, solve);
    await nextItem(page);
  }
  throw new Error('keine Lückenaufgabe in der Runde');
}

for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`Lücke: eine richtige, aber andere Antwort wird „Auch richtig“ – nie rot (${vp.width})`, async ({ page }) => {
    await page.setViewportSize(vp);
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': BEGUN } } });
    await skipMiniLesson(page);
    await toGap(page);
    await answerGrammar(page, solve, { given: 'fitx' });
    // Tutor-Engine v3: ohne Zustimmung in dieser Ansicht fragt die App nie von selbst, sondern bietet „Claude fragen“ an.
    await page.getByTestId('ask-claude').click();
    const verdict = page.getByTestId('verdict');
    await expect(verdict).toHaveAttribute('data-verdict', 'ok');
    await expect(verdict).toContainText('Auch richtig');
    await expect(page.getByTestId('verdict-sub')).toContainText('Geübt wird hier:');
    await expect(page.getByText('Noch nicht', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('gap')).toHaveAttribute('data-state', 'correct');
    // Der Hinweis „zählt nicht als Fehler“ steht sichtbar (nicht unter „Mehr“).
    await expect(page.getByTestId('explanation')).toContainText('Zählt nicht als Fehler');
    expect(errors).toEqual([]);
  });
}

test('Lücke: eine falsche Antwort bleibt falsch (Leitfrage, kein „Auch richtig“)', async ({ page }) => {
  await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': BEGUN } } });
  await skipMiniLesson(page);
  await toGap(page);
  await answerGrammar(page, solve, { given: 'zzzz wrong' });
  await expect(page.getByText('Auch richtig')).toHaveCount(0);
});
