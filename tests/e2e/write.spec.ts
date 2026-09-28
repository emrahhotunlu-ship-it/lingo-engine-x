import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen } from './fixtures';
import { DAY, dump, openModule, sampleCalls } from './inputHelpers';

// Schreiben (Plan §4.3, §8.3): Aufgabe stabil je Lerntag, Entwurf überlebt Neuladen, Abgeben
// (erledigt ohne KI), Korrektur mit Markierungen und US-Hinweis, Überarbeiten (rev = 1),
// Verlauf mit beiden Formen, genau ein Neuversuch bei Schemafehler, kein Aufruf ohne Klick.

const TEXT =
  'Dear Mr. Walker, thank you for your patience. Unfortunately the new scanning feature will be released three weeks later than planned. It depends of the final tests with your data. I will summarise the results for you next week and I look forward to hear from you soon.';

async function typeText(page: Page, text: string): Promise<void> {
  await page.getByTestId('draft').fill(text);
  await expect(page.getByTestId('word-count')).toHaveAttribute('data-n', String(text.split(/\s+/).length));
}

test('Schreiben: Aufgabe des Tages, Abgeben, Korrektur mit Stellen, Überarbeiten, Schreibwege', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true });
  await openModule(page, 'write');
  const card = page.getByTestId('prompt-card');
  await expect(card).toBeVisible();
  const promptId = await card.getAttribute('data-id');
  await expect.poll(async () => ((await dump(page))[`wprompt/${DAY}`]?.p as { id?: string } | undefined)?.id).toBe(promptId);
  expect(await layoutProblems(page)).toEqual([]);

  // Englisch antippbar (Prüfbericht W5): Wörter der Wendungen und der englischen Aufgabe.
  await page.getByTestId('useful-chip').first().locator('xpath=..').locator('button.lx-word').first().click();
  await expect(page.getByTestId('lookup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lookup')).toHaveCount(0);
  await card.getByRole('button', { name: /Aufgabe auf Englisch|English/ }).click();
  await page.getByTestId('prompt-task-en').locator('button.lx-word').first().click();
  await expect(page.getByTestId('lookup')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lookup')).toHaveCount(0);

  // Wendungen: Tippen fügt ein, benutzte haken sich ab (M12).
  const chip = page.getByTestId('useful-chip').first();
  await expect(chip).toHaveAttribute('data-used', 'false');
  await typeText(page, TEXT);
  await chip.click();
  await expect(chip).toHaveAttribute('data-used', 'true');
  await expect(page.getByTestId('submit')).toBeEnabled();
  await page.getByTestId('submit').click();

  // Erledigt beim Abgeben; die Korrektur läuft als App-Aufgabe.
  await expect(page.getByTestId('unit-done')).toBeVisible();
  await expect(page.getByTestId('review')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('review')).toHaveAttribute('data-cefr', 'B2');
  await expect(page.getByTestId('us-hint')).toContainText('summarize');
  await expect(page.getByTestId('error-mark')).toHaveCount(2);
  await page.getByTestId('error-mark').first().click();
  await expect(page.getByTestId('error-detail')).toBeVisible();
  await expect(page.getByTestId('improved')).toBeVisible();

  let db = await dump(page);
  const [path, doc] = Object.entries(db).find(([p, d]) => p.startsWith('writing/w') && d.date === DAY) ?? [];
  expect(path).toBeTruthy();
  expect(doc).toMatchObject({ promptId, rev: 0, lang: 'de', res: { lang: 'de', pv: 'writing-review@2', rev: 0 } });
  const res = (doc as { res: { errors: Array<{ orig: string }>; usHints: Array<{ orig: string; us: string }> } }).res;
  expect(res.errors.map((e) => e.orig)).not.toContain('summarise');
  expect(res.usHints).toEqual([{ orig: 'summarise', us: 'summarize' }]);
  const profile = db['app/profile'] as { act: Record<string, Record<string, number>> };
  expect(profile.act[DAY]?.write).toBe(1);
  const radar = db['app/radar'] as { events: Array<Record<string, unknown>> };
  expect(radar.events.filter((e) => e.s === 'w' && e.g === 'depends of')).toHaveLength(1);
  expect(radar.events.some((e) => e.g === 'summarise')).toBe(false);
  // Kategorie der alten App (topicCat): gerund-inf → pattern.
  expect(radar.events.find((e) => e.g === 'look forward to hear')).toMatchObject({ c: 'pattern', s: 'w' });

  // Überarbeiten: rev + 1, kein zweiter Einheitsabschluss.
  await page.getByTestId('revise').click();
  // Die Aufgabenstellung bleibt beim Überarbeiten sichtbar, aber nicht wechselbar.
  await expect(page.getByTestId('prompt-card')).toBeVisible();
  await expect(page.getByTestId('prompt-other')).toHaveCount(0);
  await page.getByTestId('draft').fill(TEXT.replace('depends of', 'depends on').replace('to hear', 'to hearing'));
  await page.getByTestId('resubmit').click();
  await expect(page.getByTestId('review')).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => ((await dump(page))[path ?? '']?.res as { rev?: number } | undefined)?.rev).toBe(1);
  db = await dump(page);
  expect(db[path ?? '']).toMatchObject({ rev: 1 });
  expect((db['app/profile'] as { act: Record<string, Record<string, number>> }).act[DAY]?.write).toBe(1);
  expect((await sampleCalls(page)).filter((c) => c.id === 'writing-review')).toHaveLength(2);

  // Verlauf zeigt beide Formen (Aufgabe und Lektion).
  await page.getByTestId('open-history').click();
  await expect(page.getByTestId('history-screen')).toHaveAttribute('data-kind', 'write');
  await expect(page.getByTestId('history-item')).toHaveCount(3);
  await expect(page.getByTestId('history')).toContainText('Lektion l05');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Schreiben: Aufgabe und Entwurf überleben ein Neuladen', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, fake: { persist: true } });
  await openModule(page, 'write');
  const id = await page.getByTestId('prompt-card').getAttribute('data-id');
  await expect.poll(async () => Boolean((await dump(page))[`wprompt/${DAY}`])).toBe(true);
  const t1 = (await dump(page))[`wprompt/${DAY}`]?.t;
  await typeText(page, 'This is my first draft about the delay.');
  await page.waitForTimeout(1000);
  await page.reload();
  // Neubau (Fortsetzen): Nach dem Neuladen ist die Übung selbst wieder offen (ohne Reiterleiste).
  await screen(page, 'write');
  await expect(page.getByTestId('prompt-card')).toHaveAttribute('data-id', id ?? '');
  await expect(page.getByTestId('draft')).toHaveValue('This is my first draft about the delay.');
  expect((await dump(page))[`wprompt/${DAY}`]?.t).toBe(t1);
});

test('Schreiben: Schemafehler → genau ein Neuversuch (2 Aufrufe), dann gültige Rückmeldung', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true });
  await openModule(page, 'write');
  await typeText(page, `${TEXT} We need zzqx more time.`);
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('review')).toBeVisible({ timeout: 15_000 });
  expect((await sampleCalls(page)).filter((c) => c.id === 'writing-review')).toHaveLength(2);
});

test('Schreiben: rate_limited → Fehlerhinweis, kein zweiter Aufruf ohne Klick; Abgabe bleibt gespeichert', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, fake: { sampleMode: 'rate_limited' } });
  await openModule(page, 'write');
  await typeText(page, TEXT);
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('ai-error')).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  expect((await sampleCalls(page)).filter((c) => c.id === 'writing-review')).toHaveLength(1);
  const db = await dump(page);
  expect(Object.entries(db).some(([p, d]) => p.startsWith('writing/w') && d.date === DAY)).toBe(true);
});

test('Schreiben: Korrektur läuft beim Bildschirmwechsel weiter und meldet sich (M14)', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, fake: { sampleDelayMs: 1500 } });
  await openModule(page, 'write');
  await typeText(page, TEXT);
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('ai-phase')).toBeVisible();
  await page.getByTestId('unit-close').click();
  await expect(page.getByTestId('ai-task-notice')).toBeVisible();
  await expect(page.getByTestId('ai-task-notice')).toHaveAttribute('data-status', 'done', { timeout: 15_000 });
  await page.getByTestId('ai-task-view').click();
  await expect(page.getByTestId('review')).toBeVisible();
  await expect(page.getByTestId('ai-task-notice')).toHaveCount(0);
});

test('Schreiben ohne KI (?fake=nosample): keine KI-Knöpfe, kein Notenknopf, gespeichert ohne Urteil', async ({ page }) => {
  test.setTimeout(60_000);
  const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openModule(page, 'write');
  await expect(page.getByTestId('prompt-card')).toBeVisible();
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  await typeText(page, TEXT);
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('unit-done')).toBeVisible();
  await expect(page.getByTestId('review')).toHaveCount(0);
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  const db = await dump(page);
  const doc = Object.entries(db).find(([p, d]) => p.startsWith('writing/w') && d.date === DAY)?.[1];
  expect(doc).toMatchObject({ rev: 0, lang: 'de' });
  expect(doc?.res).toBeUndefined();
  expect((db['app/profile'] as { act: Record<string, Record<string, number>> }).act[DAY]?.write).toBe(1);
  expect(await sampleCalls(page)).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
