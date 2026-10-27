import { expect, test } from '@playwright/test';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey, nextItem, shownPrompt, skipMiniLesson } from './learnHelpers';

// Tutor-Engine (S3, Rang 3) – Mini-Lektion statt Abfrage: zweimal dieselbe Ursache (Formfehler „use to“) am selben Muster (`used to`)
// → die zweite Rückmeldung ist eine kurze Lektion (Ziel, deine Antwort mit Grund, Regel, Beispiel) mit dem Untertitel „Abfragen hilft hier gerade nicht“.
// Handy (390) und Desktop (1440); mit `UX_OUT` legt der Test Bilder für die UX-Prüfung ab.

const solve = grammarKey();
const begun = (id: string) => ({ id, p: 0.5, n: 14, c: 10, last: Date.parse('2026-09-18T10:00:00+02:00'), hist: [{ d: '2026-09-10', p: 0.4 }], recent: [1, 1, 1], seen: [], seenText: [], errors: [] });

for (const vp of [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
]) {
  test(`Mini-Lektion nach zweitem gleichen Formfehler (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'topic', topic: 'used-to' }, { fake: { patch: { 'grammar/used-to': begun('used-to') } } });
    await skipMiniLesson(page);
    const item = page.getByTestId('gr-item');
    let wrongs = 0;
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      await expect(item).toBeVisible();
      const type = (await item.getAttribute('data-type')) ?? '';
      const sol = solve(await shownPrompt(page));
      const typed = type !== 'mc' && type !== 'meaning' && type !== 'find' && (await item.getByTestId('correct-input').count()) === 0;
      if (typed && sol && /\bused to\b/i.test(sol)) {
        await answerGrammar(page, solve, { given: sol.replace(/\bused to\b/i, 'use to') });
        wrongs++;
        if ((await item.getAttribute('data-lesson')) !== null) found = true;
      } else {
        await answerGrammar(page, solve);
      }
      if (!found) await nextItem(page);
    }
    expect(found, `keine Mini-Lektion nach ${wrongs} Formfehlern`).toBe(true);
    expect(wrongs).toBeGreaterThanOrEqual(2);
    await expect(page.getByTestId('verdict-sub')).toContainText('Kurz die Regel, dann geht’s weiter');
    const ex = page.getByTestId('explanation');
    await expect(ex).toBeVisible();
    // Regel in Kürze: höchstens drei Zeilen ohne die Zielzeile, keine Doppelung der Formel.
    expect(await ex.locator('[data-line]').count()).toBeLessThanOrEqual(4);
    if (process.env.UX_OUT) {
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${process.env.UX_OUT}/minilektion-${vp.name}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
