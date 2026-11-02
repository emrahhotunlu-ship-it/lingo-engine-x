import { expect, test } from '@playwright/test';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey, nextItem } from './learnHelpers';
import { DAY, dump, type Dump } from './trainerHelpers';

// UX-Neuanfang D (02.11.2026): „Aufgabe melden“ hat Wirkung. Eine gemeldete falsche Antwort zählt nicht (kein Eintrag im Tagesprotokoll,
// kein Fehlersatz), die Aufgabe steht in `app/c1.bad` für die Lehrkraft-Prüfung. Kein neuer Datenbank-Pfad.

const solve = grammarKey();
type Doc = Record<string, unknown>;
const gLog = (d: Dump): number => (((d[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g')).length;

test('Grammatik: gemeldete falsche Antwort zählt nicht und steht in app/c1.bad', async ({ page }) => {
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  await expect(page.getByTestId('gr-item')).toBeVisible();
  const before = await dump(page);
  await answerGrammar(page, solve, { wrong: true });
  await page.getByTestId('exercise-menu').click();
  await page.getByTestId('menu-report').click();
  await page.getByTestId('report-solution').click();
  await expect(page.getByText('Diese Aufgabe zählt nicht.')).toBeVisible();
  await expect.poll(async () => (((await dump(page))['app/c1']?.bad ?? []) as string[]).some((x) => x.startsWith('gr:'))).toBe(true);
  await nextItem(page);
  await expect(page.getByTestId('gr-item')).toBeVisible();
  await page.waitForTimeout(600);
  expect(gLog(await dump(page))).toBe(gLog(before));
  expect(errors).toEqual([]);
});
