import { expect, test } from '@playwright/test';
import { boot, openSettings, screen } from './fixtures';
import { MON, MON_9, VG_BLOCKS, profileWith, reviewedLog, vgPlan } from './heuteHelpers';
import { dump } from './trainerHelpers';

// Lernplattform 3.0 P53: Lernzeit in Einstellungen › Lernen (`app/profile.ii`, < 100 Bytes), die Anleitung „Erinnerung im iPhone einrichten“ und
// die Zeile „Morgen um 7:30 · …“ nur auf der Abschlusskarte (nie während der Pflicht, ohne Lernzeit keine Zeile).

type Doc = Record<string, unknown>;
const DONE = ['u-focus', 'u-task', 'u-again'];
const BAD = /verlier|verloren|gerissen|!/;

function donePlan(day: string): Doc {
  const p = vgPlan(day);
  return { ...p, u: { ...(p.u as Doc), b: VG_BLOCKS } };
}

test('Einstellungen › Lernen: Uhrzeit und Anker speichern (ein Feld, < 100 Bytes), Anleitung mit den genauen Tipps', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await openSettings(page);
  const sec = page.getByTestId('set-group-learn').getByTestId('study-time');
  await expect(sec).toBeVisible();
  await expect(sec).toContainText('keine Bedingung');
  await sec.getByTestId('study-time-input').fill('07:30');
  await sec.locator('[data-value="coffee"]').click();
  await expect(sec.locator('[data-value="coffee"]')).toHaveAttribute('aria-pressed', 'true');
  await sec.getByTestId('study-time-save').click();
  await expect.poll(async () => (await dump(page))['app/profile']?.ii).toEqual({ t: '07:30', cue: 'coffee' });
  const ii = (await dump(page))['app/profile']?.ii;
  expect(Buffer.byteLength(JSON.stringify(ii), 'utf8')).toBeLessThan(100);

  // Eigener Anker statt Chip (höchstens 40 Zeichen).
  await sec.getByTestId('study-cue-own').fill('nach dem Sport im Studio an der Ecke und noch mehr Text');
  await expect(sec.locator('[data-value="coffee"]')).toHaveAttribute('aria-pressed', 'false');
  await sec.getByTestId('study-time-save').click();
  await expect.poll(async () => ((await dump(page))['app/profile']?.ii as Doc | undefined)?.cue).toBe('nach dem Sport im Studio an der Ecke und');

  await sec.getByTestId('reminder-guide-open').click();
  const guide = page.getByTestId('reminder-guide');
  await expect(guide).toBeVisible();
  const steps = await guide.getByTestId('reminder-step').allInnerTexts();
  expect(steps).toHaveLength(7);
  expect(steps[0]).toContain('Erinnerungen');
  expect(steps[1]).toContain('＋ Neue Erinnerung');
  expect(steps[2]).toContain('Englisch 25 Min.');
  expect(steps[3]).toContain('ⓘ');
  expect(steps[4]).toContain('7:30');
  expect(steps[5]).toContain('Täglich');
  expect(steps[6]).toContain('URL');
  await expect(guide.getByTestId('reminder-home')).toContainText('Zum Home-Bildschirm');
  await expect(guide.getByTestId('reminder-home')).toContainText('keine Installation');
  await expect(guide).not.toContainText(BAD);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test.describe('Abschlusskarte', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('mit Lernzeit: „Morgen um 7:30 · nach dem ersten Kaffee“', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: MON_9, fake: { patch: { ...profileWith(MON, donePlan(MON), DONE, { ii: { t: '07:30', cue: 'coffee' } }), ...reviewedLog(MON) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('today-studytime')).toHaveText('Morgen um 7:30 · nach dem ersten Kaffee');
    await expect(page.getByTestId('today-card')).not.toContainText(BAD);
    expect(errors).toEqual([]);
  });

  test('Englisch im 12-Stunden-Format', async ({ page }) => {
    await boot(page, { migrated: true, lang: 'en', now: MON_9, fake: { patch: { ...profileWith(MON, donePlan(MON), DONE, { ii: { t: '19:15', cue: 'train' } }), ...reviewedLog(MON) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-studytime')).toHaveText('Tomorrow at 7:15 PM · on the train');
  });

  test('ohne Lernzeit keine Zeile', async ({ page }) => {
    await boot(page, { migrated: true, now: MON_9, fake: { patch: { ...profileWith(MON, donePlan(MON), DONE, {}), ...reviewedLog(MON) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('today-studytime')).toHaveCount(0);
  });

  test('während der Pflicht nie', async ({ page }) => {
    await boot(page, { migrated: true, now: MON_9, fake: { patch: { ...profileWith(MON, donePlan(MON), [], { ii: { t: '07:30', cue: 'coffee' } }) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('today-card')).not.toHaveAttribute('data-done', 'true');
    await expect(page.getByTestId('today-studytime')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Morgen um 7:30');
  });
});
