import { expect, test } from '@playwright/test';
import { boot, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { VG_BLOCKS, VG_DUTY, profileWith, reviewedLog, vgPlan } from './heuteHelpers';

// Format-Runde (Lernplattform 3.0 §2.1, P23): Dienstag Schritt 3 = „Kleines Wort“ (ocl) als Pflicht. Mit genug eingeführten Mustern startet die
// Runde der Art; ohne passende Aufgaben bleibt es beim Satzbau (nie ein leerer Schritt).

type Doc = Record<string, unknown>;
const TUE = '2026-09-22';
const TUE_9 = '2026-09-22T09:00:00+02:00';
const NOW = Date.parse(TUE_9);

const topicDoc = (topic: string, pats: string[]): Doc => ({
  id: topic,
  p: 0.6,
  anchor: 0.6,
  anchorD: '2026-09-15',
  n: 8,
  c: 6,
  due: NOW,
  last: NOW - 3 * 86_400_000,
  recent: [1, 1, 1, 1],
  seen: [],
  seenText: [],
  hist: [{ d: '2026-09-15', p: 0.6 }],
  errors: [],
  pats: Object.fromEntries(pats.map((p, k) => [p, { n: 3, c: 2, last: k + 1, i: '2026-09-10' }])),
});

const PATTERNS: Record<string, Doc> = {
  'grammar/pres-simple-cont': topicDoc('pres-simple-cont', ['psc.habit', 'psc.now', 'psc.state', 'psc.dual', 'psc.always']),
  'grammar/past-simple-perfect': topicDoc('past-simple-perfect', ['psp.finished-time', 'psp.since-for', 'psp.experience', 'psp.result-now']),
};

/** Plan von Dienstag mit Format in Schritt 3 (Schritt 1 und 2 erledigt). */
function formatPlan(fmt: 'ocl' | 'wf' = 'ocl'): Doc {
  const plan = vgPlan(TUE);
  const u = plan.u as Doc;
  u.rv = 2;
  u.b = VG_BLOCKS.map(([n, k, m]) => (n === 3 ? [n, k, m, { mode: 'format', fmt }] : [n, k, m]));
  return plan;
}

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('mit eingeführten Mustern: Schritt 3 startet die Runde „Kleines Wort“ als Pflicht', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...PATTERNS, ...profileWith(TUE, formatPlan(), ['u-focus']), ...reviewedLog(TUE) } } });
    await screen(page, 'today');
    const row = page.locator('[data-testid="duty"][data-duty="ch:u-task"]');
    await expect(row).toContainText('Kleines Wort');
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
    await page.getByTestId('start').click();
    await screen(page, 'grammarSession');
    await expect(page.getByTestId('grammar-session')).toHaveAttribute('data-ctx', 'duty');
    await expect(page.getByTestId('gr-item')).toHaveAttribute('data-c1x', 'ocl');
    expect(errors).toEqual([]);
  });

  test('Mittwoch: „Wort umbauen“ (wf) läuft auch ohne eingeführte Muster, weil die Wortbildungs-Aufgaben zu keinem Grammatikthema gehören', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...profileWith(TUE, formatPlan('wf'), ['u-focus']), ...reviewedLog(TUE) } } });
    await screen(page, 'today');
    const row = page.locator('[data-testid="duty"][data-duty="ch:u-task"]');
    await expect(row).toContainText('Wort umbauen');
    await page.getByTestId('start').click();
    await screen(page, 'grammarSession');
    await expect(page.getByTestId('grammar-session')).toHaveAttribute('data-ctx', 'duty');
    await expect(page.getByTestId('gr-item')).toHaveAttribute('data-c1x', 'wf');
    await expect(page.getByTestId('gr-item').getByTestId('wf-stem')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('ohne eingeführte Muster: kein leerer Schritt, es läuft der Satzbau', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...profileWith(TUE, formatPlan(), ['u-focus']), ...reviewedLog(TUE) } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'drill');
    await expect(page.getByTestId('drill')).toHaveAttribute('data-kind', 'order');
    expect(errors).toEqual([]);
  });

  test('Pflichtpunkte und Zähler unverändert: vier Punkte, der Plan bleibt wie gespeichert', async ({ page }) => {
    await boot(page, { migrated: true, now: TUE_9, fake: { patch: { ...PATTERNS, ...profileWith(TUE, formatPlan(), ['u-focus']), ...reviewedLog(TUE) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-status')).toHaveAttribute('data-total', '4');
    await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', '2');
    const plan = (await dump(page))['app/profile']?.plan as Doc;
    expect(plan.duty).toEqual(VG_DUTY);
  });
});
