import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openEntry, openSpeak, screen } from './fixtures';
import { nbLog } from './trainingHelpers';

// Neubau N79 + B9 (Lehrer I7, I8, W10, S9, Markt DU5): kurze Sprechaufgaben unter Sprechen ›
// Training und der Anruf-Modus im Rollenspiel. Je Übung: öffnen, eine Antwort, Rückmeldung sichtbar.

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken]);

async function answer(page: Page, text: string): Promise<void> {
  await page.getByTestId('sptask-start').click();
  await page.getByTestId('sptask-input').fill(text);
  await page.getByTestId('sptask-check').click();
  await expect(page.getByTestId('sptask-review')).toBeVisible();
}

test('Einstiege unter Sprechen › Training, Pitch 30/60/120 mit Muster, Zeitbalken und Rückmeldung', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openSpeak(page);
  for (const id of ['training-pitch3', 'training-chart', 'training-circum', 'training-back']) await expect(page.getByTestId('speak-training').getByTestId(id)).toBeVisible();
  await page.getByTestId('training-pitch3').click();
  await screen(page, 'sptask');
  await expect(page.getByTestId('sptask')).toHaveAttribute('data-kind', 'pitch');
  await expect(page.getByTestId('training-status')).toContainText('30');
  await expect(page.getByTestId('sptask-model')).toBeVisible();
  await page.getByTestId('sptask-start').click();
  await expect(page.getByTestId('sptask-time')).toBeVisible();
  await page.getByTestId('sptask-input').fill('Most teams lose hours looking for documents. We fix that with a cloud archive. Can we discuss about your process next week?');
  await page.getByTestId('sptask-check').click();
  const fb = page.getByTestId('feedback');
  await expect(fb).toHaveAttribute('data-verdict', 'close');
  await expect(page.getByTestId('feedback-effect')).toContainText('Kernbotschaft');
  await expect(page.getByTestId('feedback-fixes')).toContainText('discuss');
  await expect(page.getByTestId('feedback-solution')).toBeVisible();
  await page.getByTestId('next').click();
  // Runde 2: 60 s, gleiche Kernbotschaft, ohne Muster
  await expect(page.getByTestId('sptask')).toHaveAttribute('data-pos', '1');
  await expect(page.getByTestId('training-status')).toContainText('60');
  await expect(page.getByTestId('sptask-model')).toHaveCount(0);
  await expect.poll(async () => (await nbLog(page)).filter((e) => e.type === 'nb-sp-pitch').length).toBe(1);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Zahlen und Grafiken: Diagramm lokal gezeichnet, Beschreibung, Claude-Rückmeldung', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openEntry(page, 'training-chart');
  await screen(page, 'sptask');
  await expect(page.getByTestId('sptask-figure')).toHaveAttribute('data-kind', 'bar');
  await expect(page.getByTestId('sptask-figure').locator('rect')).toHaveCount(6);
  await answer(page, 'The number of documents more than tripled from January to June, so the workflow pays off.');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'ok');
  await expect(page.getByTestId('feedback-effect')).toContainText('Trend');
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Umschreiben statt stocken: Zielwort benutzt → falsch; das Wort wird eine Karte', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openEntry(page, 'training-circum');
  await screen(page, 'sptask');
  await expect(page.getByTestId('sptask-stimulus')).toHaveText('Aufbewahrungsfrist');
  await answer(page, 'It is the retention period for invoices in a company.');
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'wrong');
  await expect(page.getByTestId('feedback-fixes')).toContainText('Zielwort');
  await page.getByTestId('sptask-save').click();
  await expect(page.getByTestId('sptask-save')).toHaveAttribute('data-state', 'saved');
  expect(errors).toEqual([]);
});

test('Rückübersetzung: lesen → verdecken → aus dem Deutschen wieder Englisch, Vergleich markiert', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openEntry(page, 'training-back');
  await screen(page, 'sptask');
  await expect(page.getByTestId('sptask-original')).toContainText('better sense');
  await page.getByTestId('sptask-start').click();
  await expect(page.getByTestId('sptask-original')).toHaveCount(0);
  await expect(page.getByTestId('sptask-german')).toContainText('Rechnungen');
  await page.getByTestId('sptask-input').fill("We'd like to understand better how your team handles invoices today.");
  await page.getByTestId('sptask-check').click();
  await expect(page.getByTestId('sptask-compare')).toBeVisible();
  await expect(page.getByTestId('sptask-compare').locator('[data-diff="x"]').first()).toBeVisible();
  await expect(page.getByTestId('feedback')).toHaveAttribute('data-verdict', 'ok');
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('Anruf-Modus: Figur spricht, Text verdeckt bis Tipp, Hinweis auf die Diktiertaste', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openSpeak(page);
  await page.locator('[data-testid="scene-card"][data-scene="sc-vida"]').click();
  await page.getByTestId('briefing-start').click();
  await screen(page, 'roleplay');
  await page.getByTestId('rp-call-toggle').click();
  await expect(page.getByTestId('rp-call-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rp-call-hint')).toBeVisible();
  const persona = page.locator('[data-testid="rp-turn"][data-role="persona"]');
  const before = await persona.count();
  await page.getByTestId('composer-input').fill('We can start the pilot next month.');
  await page.getByTestId('composer-send').click();
  await expect(persona).toHaveCount(before + 1);
  const last = persona.last();
  await expect(last.getByTestId('rp-call-reveal')).toBeVisible();
  await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(0);
  await last.getByTestId('rp-call-reveal').click();
  await expect(last.getByTestId('rp-call-reveal')).toHaveCount(0);
  await expect(last.locator('[lang="en"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});
