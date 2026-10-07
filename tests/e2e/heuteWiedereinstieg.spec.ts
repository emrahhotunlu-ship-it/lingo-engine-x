import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { MON, MON_9, profileWith, reviewedLog, vgPlan } from './heuteHelpers';

// Heute nach Gesamtkonzept 3.2: Neustart-Woche, „Serie 0“ nie, Schritt „Fehler korrigieren“ entfällt ohne fällige Fehlersätze,
// Abschluss mit Wahrheitszeile und Meilenstein, Wochenrückblick-Band.

type Doc = Record<string, unknown>;
const SEED_PROFILE = (JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>)['app/profile'] as Doc;

/** Profil aus dem Seed mit zusätzlichen Lerntagen (die Tage der Testdaten bleiben stehen). */
const withDays = (extra: Record<string, number>): Record<string, Doc> => ({ 'app/profile': { days: { ...(SEED_PROFILE.days as Doc), ...extra }, minutes: { ...(SEED_PROFILE.minutes as Doc), ...extra } } });

test('Neustart-Woche: nach 14+ Tagen Pause eine Willkommens-Karte statt der Tageskarte, nie „Serie 0“, danach kleiner Plan', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true, now: '2026-10-06T09:00:00+02:00' });
  await screen(page, 'today');
  const card = page.getByTestId('restart-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Willkommen zurück.');
  await expect(card).toContainText('Tage Pause sind kein Problem.');
  await expect(page.getByTestId('restart-start')).toContainText('Neustart-Woche beginnen · ');
  await expect(page.getByTestId('today-card')).toHaveCount(0);
  await expect(page.getByTestId('comeback-band')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/Serie|verpasst|Rückstand|Vorwurf/);
  await expect(page.getByTestId('profile-streak')).toHaveCount(0);
  // Der Plan ist schon der kleine Plan (3 + 4 + 2 Minuten), Merker `cb` im eingefrorenen Plan.
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as Doc | undefined)?.d).toBe('2026-10-06');
  const plan = (await dump(page))['app/profile']?.plan as { u: { cb?: string; b: Array<[number, string, number]> } };
  expect(plan.u.cb).toBe('restart');
  expect(plan.u.b.map(([, kind]) => kind)).not.toContain('task.order');
  await page.getByTestId('restart-start').click();
  await screen(page, 'trainer');
  expect(errors).toEqual([]);
});

test('Neustart-Woche, Tag 2: Plan bleibt klein, ein ruhiges Band „Tag 2 von 7“ statt der Willkommens-Karte', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    now: '2026-10-07T09:00:00+02:00',
    fake: { patch: withDays({ '2026-10-06': 5 }) },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('restart-card')).toHaveCount(0);
  await expect(page.getByTestId('comeback-band')).toHaveAttribute('data-band', 'restart');
  await expect(page.getByTestId('comeback-band')).toContainText('Neustart-Woche · Tag 2 von 7');
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as { u?: { cb?: string } } | undefined)?.u?.cb).toBe('restart');
  await expect(page.getByTestId('duty')).not.toHaveCount(4);
  expect(errors).toEqual([]);
});

test('Kein Fehlersatz fällig: der Schritt „Fehler korrigieren“ entfällt, auf Heute steht „keine fällig ✓“, Pflicht bleibt erfüllbar', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    now: '2026-10-05T09:00:00+02:00',
    fake: { seed: 'empty', patch: { 'app/profile': { name: 'Test', days: { '2026-10-04': 3 }, pflicht: { '2026-10-04': 1 } } } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('fix-none')).toContainText('Fehler korrigieren: keine fällig ✓');
  await expect(page.locator('[data-testid="duty"][data-duty="ch:u-again"]')).toHaveCount(0);
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as Doc | undefined)?.d).toBe('2026-10-05');
  const plan = (await dump(page))['app/profile']?.plan as { duty: string[]; u: { b: Array<[number, string, number]>; min: number } };
  expect(plan.duty).not.toContain('ch:u-again');
  expect(plan.duty.length).toBe(plan.u.b.length);
  expect(plan.u.min).toBe(plan.u.b.reduce((s, b) => s + b[2], 0));
  expect(errors).toEqual([]);
});

test('Serie: im Kopf nie, auf Heute nur im Kartenfuß ab 1 Tag, nach einer Pause nichts', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, now: MON_9 });
  await screen(page, 'today');
  await expect(page.getByTestId('profile-streak')).toHaveCount(0);
  await expect(page.getByTestId('today-streak')).toHaveText('Serie: 12 Tage');
  await expect(page.getByTestId('today-card').getByTestId('today-streak')).toHaveCount(1);
  // Profil-Blatt zeigt sie auch.
  await page.getByTestId('open-profile').click();
  await expect(page.getByTestId('profile-sheet-streak')).toHaveText('Serie: 12 Tage');
  await page.keyboard.press('Escape');
  await page.close();
  // Nach einer Pause: keine Zahl, kein „Serie 0“ – weder in der Unterzeile noch im Kopf noch im Blatt.
  const p = await page.context().newPage();
  const b = await boot(p, { migrated: true, now: '2026-10-02T09:00:00+02:00' });
  await screen(p, 'today');
  await expect(p.getByTestId('today-streak')).toHaveCount(0);
  await expect(p.locator('body')).not.toContainText('Serie: 0');
  await p.getByTestId('open-profile').click();
  await expect(p.getByTestId('profile-sheet')).toBeVisible();
  await expect(p.getByTestId('profile-sheet-streak')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(b.errors).toEqual([]);
});

test('Abschluss: eine Zahl, Wahrheitszeile nur mit belegten Teilen, Meilenstein einmalig und gemerkt', async ({ page }) => {
  const plan = { ...vgPlan(), u: { ...(vgPlan().u as Doc), ov: 900, sure: 0 } };
  const t0 = Date.parse(`${MON}T08:00:00+02:00`);
  const repair = { id: 'rdone', wrong: 'He go home.', right: 'He goes home.', src: 'say', t: t0 - 9 * 86_400_000, box: 3, due: t0 + 9 * 86_400_000, done: true, last: t0 };
  const { errors } = await boot(page, {
    migrated: true,
    now: MON_9,
    fake: { patch: { ...profileWith(MON, plan, ['u-task', 'u-focus', 'u-again'], {}), ...reviewedLog(MON), 'app/repair': { items: [repair] } } },
  });
  await screen(page, 'today');
  await expect(page.getByTestId('today-card')).toHaveAttribute('data-done', 'true');
  // §5.10: nie eine Antwortzahl, sondern Gefestigtes bzw. die Schritte.
  await expect(page.getByTestId('balance')).toHaveText(/^(\+\d+ (Wörter|Muster) sicher|\d+ von \d+ Schritten)$/);
  const truth = page.getByTestId('today-truth');
  await expect(truth).toContainText('Fehlersätze erledigt: 1');
  await expect(truth).toContainText('überfällig −');
  await expect(truth).not.toContainText('Heute neu sicher: 0');
  await expect(page.getByTestId('start')).toHaveCount(0);
  await expect(page.getByTestId('today-card').locator('button')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Wochenrückblick-Band: montags einmal, führt zur Seite, danach weg', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, now: '2026-09-28T09:00:00+02:00', fake: { patch: withDays({ '2026-09-27': 4 }) } });
  await screen(page, 'today');
  const band = page.getByTestId('weekly-band');
  await expect(band).toContainText('Dein Wochenrückblick ist da.');
  await page.getByTestId('weekly-band-open').click();
  await screen(page, 'weekly');
  await page.getByTestId('page-back').click();
  await screen(page, 'today');
  await expect(page.getByTestId('weekly-band')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Wochenrückblick-Band: an anderen Tagen nicht', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, now: '2026-09-29T09:00:00+02:00', fake: { patch: withDays({ '2026-09-28': 4 }) } });
  await screen(page, 'today');
  await expect(page.getByTestId('weekly-band')).toHaveCount(0);
  expect(errors).toEqual([]);
});
