import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { answerCurrent, dump, planPatch, TYPE_MODE } from './trainerHelpers';
import { sentKey } from '../../src/domain/srs/variety';

// Lernplattform 3.0 P52 (Wörter-Tutor, word-ctx@1): ein schwaches Wort zeigt in der nächsten Runde einen Claude-Satz (`wx`) mit Kennzeichnung;
// „Welches Wort passt?“ (Kontrast, `cfx`) kommt nur, wenn beide Karten mindestens Stufe 2 haben. Am Rundenende fragt die App im Hintergrund
// genau einmal `word-ctx` (quick) und speichert die geprüften Sätze ergänzend. Die Testlaufzeit antwortet fest (`canned/lp3/p52.ts`).

type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'word-ctx').map((c) => `${c.id}:${c.tier}`));

/** LP3 P25: Hintergrundaufrufe erst nach einem beantworteten Nutzer-Aufruf (wie drills.spec.ts): eine Nachricht an Claude. */
async function confirmSample(page: Page): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('open-companion').click();
  await expect(page.getByTestId('companion')).toBeVisible();
  await page.getByTestId('chat-input').fill('Hallo');
  await page.getByTestId('chat-send').click();
  await expect(page.locator('[data-testid="chat-msg"][data-role="assistant"]').last()).toHaveAttribute('data-state', 'done');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('companion')).toHaveCount(0);
}

const NOW = Date.parse('2026-09-20T21:00:00+02:00');
const ORIGIN = 'He convinced me that the plan would work.';
const WX = 'During the budget review, Lena convinced the board to approve a smaller pilot project.';
const CONTRAST = 'We should avoid long meetings on Friday afternoons when the whole team is tired.';
const WHY = { de: 'avoid heißt vermeiden; convince heißt jemanden überzeugen.', en: 'Avoid means to stay away from something; convince means to persuade someone.' };

/** `convince`: fällig, Stufe 2, schwach (2 Rückfälle), „Wort zuordnen“ ist die schwächste Übung; zuletzt im Ursprungssatz gezeigt. */
const convince = (over: Record<string, unknown> = {}) => ({
  state: 'learning',
  stage: 2,
  S: 3,
  D: 6,
  due: 1_690_000_000_000,
  last: 1_689_900_000_000,
  reps: 6,
  lapses: 2,
  xs: { match: { c: 0, w: 6 }, mc_de: { c: 6, w: 0 }, mc_en: { c: 6, w: 0 }, cloze_hint: { c: 6, w: 0 } },
  hist: [{ t: NOW - 86_400_000, m: 'recog', g: 3, x: 'mc_de', s: sentKey(ORIGIN) }],
  ...over,
});
const patch = (conv: Record<string, unknown>, avoidStage: number) => ({
  ...TYPE_MODE,
  'app/profile': planPatch(1),
  'vocab/convince': conv,
  'vocab/avoid': { stage: avoidStage, due: NOW + 30 * 86_400_000 },
});

test('schwaches Wort: der Claude-Satz kommt in der nächsten Runde mit Kennzeichnung; am Rundenende genau ein Hintergrund-Aufruf, ergänzend gespeichert', async ({ page }) => {
  const { errors, external } = await boot(page, {
    migrated: true,
    fake: {
      patch: patch(
        convince({
          wx: [{ en: WX, de: 'Bei der Budgetprüfung hat Lena den Vorstand überzeugt, ein kleineres Pilotprojekt zu genehmigen.', sit: 'budget review', t: NOW - 3_600_000, pv: 'word-ctx@1' }],
        }),
        1,
      ),
    },
  });
  // Hintergrundaufrufe erst nach einem beantworteten Nutzer-Aufruf in dieser Ansicht (P25).
  await confirmSample(page);
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  const exEl = page.getByTestId('exercise');
  await expect(exEl).toHaveAttribute('data-ex', 'match');
  await expect(exEl).toHaveAttribute('data-card', 'convince');
  await expect(exEl).toContainText('Lena');
  await expect(page.getByTestId('word-ctx-mark')).toContainText('von Claude');
  // Die vier Pflichtfragen bleiben an ihrer Stelle (Aufgabe, Wozu, danach Ergebnis und Warum).
  await expect(page.getByTestId('task')).toBeVisible();
  expect(await calls(page)).toEqual([]);
  await answerCurrent(page);
  await expect(page.getByTestId('summary')).toBeVisible();
  await expect.poll(() => calls(page)).toEqual(['word-ctx:quick']);
  await expect.poll(async () => ((await dump(page))['vocab/convince']?.wx as unknown[] | undefined)?.length ?? 0).toBe(3);
  const doc = (await dump(page))['vocab/convince'] ?? {};
  expect(doc.lapses).toBe(2);
  expect((doc.wx as Array<{ en: string }>)[0]?.en).toBe(WX);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

const withCfx = () => convince({ cfx: [{ w: 'to avoid', en: CONTRAST, why: WHY, t: NOW - 3_600_000, pv: 'word-ctx@1' }], hist: [] });

test('kein Kontrast, solange eine der beiden Karten unter Stufe 2 ist', async ({ page }) => {
  const conv = withCfx();
  // `avoid` auf Stufe 1: kein Kontrast, die Runde fragt wie geplant.
  await boot(page, { migrated: true, fake: { patch: patch(conv, 1) } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  await expect(page.getByTestId('exercise')).toHaveAttribute('data-card', 'convince');
  await expect(page.getByTestId('exercise')).not.toHaveAttribute('data-ex', 'contrast');
  await expect(page.getByTestId('exercise')).not.toContainText('Friday afternoons');
});

test('beide Karten ab Stufe 2: „Welches Wort passt?“ mit Kontrast-Satz, Kennzeichnung und Begründung von Claude', async ({ page }) => {
  const conv = withCfx();
  await boot(page, { migrated: true, fake: { patch: patch(conv, 2) } });
  await screen(page, 'today');
  await page.getByTestId('start').click();
  await screen(page, 'trainer');
  const exEl = page.getByTestId('exercise');
  await expect(exEl).toHaveAttribute('data-ex', 'contrast');
  await expect(exEl).toContainText('Friday afternoons');
  await expect(page.getByTestId('word-ctx-mark')).toBeVisible();
  const labels = (await page.getByTestId('choice').locator('[lang]').allInnerTexts()).map((l) => l.trim());
  expect([...labels].sort()).toEqual(['avoid', 'convince']);
  await page.getByTestId('choice').nth(labels.indexOf('avoid')).click();
  await page.getByTestId('check').click();
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(exEl).toContainText(WHY.de);
});
