import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { openStandTab } from './profilHelpers';

// Paket B: „Claude merkt sich“ (B5) und die monatliche Vergleichsaufgabe (B1).

type Dump = Record<string, Record<string, unknown>>;
const dump = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());
const calls = (page: Page, id: string) =>
  page.evaluate((i) => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string | null; input: string }> } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === i), id);
const items = (d: Dump, path: string): Array<Record<string, unknown>> => (Array.isArray(d[path]?.items) ? (d[path]?.items as Array<Record<string, unknown>>) : []);

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('B5: „Merken“ im Gespräch → app/memory, fließt in die nächste Frage, in den Einstellungen sichtbar und löschbar', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await page.getByTestId('open-companion').tap();
  await page.getByTestId('companion-tab-chat').tap();
  await page.getByTestId('chat-input').fill('Ich habe am 14. Oktober eine Messe in London. Wie sage ich „Messestand“?');
  await page.getByTestId('chat-send').tap();
  await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
  await page.locator('[data-testid="chat-action"][data-action="remember"]').tap();
  await expect(page.getByTestId('chat-remembered')).toHaveAttribute('data-n', '2');
  await expect.poll(async () => items(await dump(page), 'app/memory').length).toBe(2);
  expect(items(await dump(page), 'app/memory')[0]).toMatchObject({ text: 'Hat am 14. Oktober eine Messe in London.', lang: 'de' });
  expect(await calls(page, 'memory-extract')).toHaveLength(1);
  // Die nächste Frage bringt die Fakten mit (companion-chat@3).
  await page.getByTestId('chat-input').fill('Und wie begrüße ich Besucher?');
  await page.getByTestId('chat-send').tap();
  await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
  const chat = await calls(page, 'companion-chat');
  expect(chat.at(-1)?.input).toContain('Hat am 14. Oktober eine Messe in London.');
  await page.getByTestId('companion-close').tap();
  // Einstellungen › Mein Kontext: sichtbar und einzeln löschbar.
  await page.getByTestId('topbar').getByTestId('open-settings').tap();
  const section = page.getByTestId('memory-section');
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByTestId('memory-fact')).toHaveCount(2);
  await section.getByTestId('memory-forget').first().tap();
  await expect(section.getByTestId('memory-fact')).toHaveCount(1);
  await expect.poll(async () => items(await dump(page), 'app/memory').length).toBe(1);
  expect(errors).toEqual([]);
});

const BASE = {
  month: '2026-08',
  day: '2026-08-27',
  t: Date.parse('2026-08-27T18:00:00+02:00'),
  task: 'ct1',
  speak: { text: 'I work on a project. It is difficult because the data is late.', sec: 45, m: { words: 13, traps: 0, per100: 0, wpm: 17, phrases: [] } },
  write: { text: 'Dear Anna, the delivery is late. Sorry for this. Best regards', m: { words: 12, traps: 0, per100: 0, phrases: [] } },
};

test('B1: Angebot in der letzten Monatswoche (nur noch im Stand, nicht auf Heute), dieselbe Aufgabe, beide Fassungen nebeneinander, Claude beschreibt den Fortschritt', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, now: '2026-09-26T10:00:00+02:00', fake: { patch: { 'app/compare': { v: 1, items: [BASE] } } } });
  await screen(page, 'today');
  // Seit 04.10.2026 (Fokus Vokabeln und Grammatik) keine Vergleichszeile mehr auf Heute; das Angebot steht im Stand › Verlauf.
  await expect(page.getByTestId('today-status')).toBeVisible();
  await expect(page.getByTestId('today-compare')).toHaveCount(0);
  await openStandTab(page, 'history');
  await expect(page.getByTestId('compare-card')).toHaveAttribute('data-n', '1');
  await page.getByTestId('compare-card-start').tap();
  await screen(page, 'compare');
  await expect(page.getByTestId('compare')).toHaveAttribute('data-base', '2026-08');
  await expect(page.getByTestId('exercise-bar').getByTestId('open-settings')).toBeVisible();
  await page.getByTestId('cmp-speak-input').fill('I am working on a new pricing project and we need to push back the deadline because the data is not ready yet.');
  await page.getByTestId('cmp-speak-done').tap();
  await page.getByTestId('cmp-write-input').fill('Dear Anna, I am sorry to let you know that the delivery will be two weeks late because our supplier had problems. We will send you a new plan by Friday. Best regards');
  await page.getByTestId('cmp-write-done').tap();
  await expect(page.getByTestId('cmp-result')).toHaveAttribute('data-saved', 'ok');
  await expect(page.getByTestId('cmp-pair-speak').getByTestId('cmp-before')).toContainText('I work on a project.');
  await expect(page.getByTestId('cmp-pair-write').getByTestId('cmp-now')).toContainText('Dear Anna, I am sorry');
  await expect(page.getByTestId('cmp-verdict')).toContainText('flüssiger');
  await expect.poll(async () => (items(await dump(page), 'app/compare')[1]?.verdict as { pv?: string } | undefined)?.pv).toBe('compare@1');
  const saved = items(await dump(page), 'app/compare');
  expect(saved).toHaveLength(2);
  expect(saved[1]).toMatchObject({ month: '2026-09', task: 'ct1', base: '2026-08' });
  expect(await calls(page, 'compare')).toHaveLength(1);
  await page.getByTestId('cmp-close-end').tap();
  // ✕ führt zur Herkunft zurück (Stand › Verlauf).
  await screen(page, 'overview');
  await expect(page.getByTestId('compare-card')).toHaveAttribute('data-n', '2');
  // Erledigt heißt erledigt: kein Angebot mehr in diesem Monat.
  await expect(page.getByTestId('compare-card-start')).toHaveCount(0);
  await expect(page.getByTestId('compare-card').getByTestId('cmp-verdict')).toBeVisible();
  expect(errors).toEqual([]);
});
