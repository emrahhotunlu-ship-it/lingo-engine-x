import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, layoutProblems, openProfile, openSettings, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Großpaket B10 (Emrahs Wahl 03.11.2026): „Urlaub ankündigen“ in den Einstellungen und die Seite „So funktioniert’s“ aus dem Profil-Blatt.
// Seed-Lerntag 20.09.2026 (Sonntag).

type Doc = Record<string, unknown>;
const SEED_PROFILE = (JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>)['app/profile'] as Doc;
/** Der Seed hat am 20.09. schon gelernt; für den kurzen Tag ein unberührter Tag: ohne Aktivität und ohne gespeicherten Plan von heute. */
const without = (k: string): Doc => Object.fromEntries(Object.entries((SEED_PROFILE[k] ?? {}) as Doc).filter(([d]) => d !== '2026-09-20'));
const UNTOUCHED: Doc = { days: without('days'), xpDays: without('xpDays'), minutes: without('minutes'), act: without('act'), plan: null };

for (const vp of [
  { name: 'Handy', width: 390, height: 844 },
  { name: 'Monitor', width: 1440, height: 900 },
]) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Urlaub eintragen, prüfen und aufheben: steht in app/profile.vac, Aufheben setzt x (nichts gelöscht)', async ({ page }) => {
      const { errors } = await boot(page, { migrated: true });
      await screen(page, 'today');
      await openSettings(page);
      const sec = page.getByTestId('vacation-section');
      await sec.scrollIntoViewIfNeeded();
      await expect(sec).toBeVisible();
      // Vergangenheit und zu lange Spannen werden abgelehnt, ohne zu speichern.
      await sec.getByTestId('vac-from').fill('2026-09-10');
      await sec.getByTestId('vac-to').fill('2026-09-12');
      await expect(sec.getByTestId('vac-problem')).toBeVisible();
      await expect(sec.getByTestId('vac-save')).toBeDisabled();
      await sec.getByTestId('vac-from').fill('2026-09-22');
      await sec.getByTestId('vac-to').fill('2026-11-30');
      await expect(sec.getByTestId('vac-problem')).toBeVisible();
      await sec.getByTestId('vac-to').fill('2026-09-28');
      await expect(sec.getByTestId('vac-problem')).toHaveCount(0);
      await sec.getByTestId('vac-save').click();
      await expect(sec.getByTestId('vac-item')).toHaveCount(1);
      await expect.poll(async () => ((await dump(page))['app/profile'] as { vac?: unknown[] }).vac?.length).toBe(1);
      const v = ((await dump(page))['app/profile'] as { vac: Array<{ from: string; to: string; x?: number }> }).vac[0]!;
      expect([v.from, v.to, v.x]).toEqual(['2026-09-22', '2026-09-28', undefined]);
      expect(await layoutProblems(page)).toEqual([]);
      await sec.getByTestId('vac-cancel').click();
      await expect(sec.getByTestId('vac-item')).toHaveCount(0);
      await expect.poll(async () => typeof ((await dump(page))['app/profile'] as { vac: Array<{ x?: number }> }).vac[0]?.x).toBe('number');
      expect(errors).toEqual([]);
    });

    test('„So funktioniert’s“: aus dem Profil-Blatt, vier Teile, ohne Überlauf', async ({ page }) => {
      const { errors } = await boot(page, { migrated: true });
      await screen(page, 'today');
      await openProfile(page);
      await page.getByTestId('profile-howto').click();
      await screen(page, 'howto');
      await expect(page.getByTestId('howto-part')).toHaveCount(4);
      await expect(page.getByTestId('howto-part').last()).toContainText('4 Uhr');
      expect(await layoutProblems(page)).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Ruhetag wählen: Einstellungen speichern restDow, Heute sagt es am Sonntag (Seed) ehrlich an', async ({ page }) => {
      const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { restDow: 7 } } } });
      await screen(page, 'today');
      const note = page.getByTestId('rest-day-note');
      await expect(note).toBeVisible();
      await expect(note).toContainText(/Ruhetag/);
      await openSettings(page);
      const sec = page.getByTestId('rest-section');
      await sec.scrollIntoViewIfNeeded();
      await sec.getByRole('radio', { name: 'Mi' }).click();
      await expect.poll(async () => ((await dump(page))['app/profile'] as { restDow?: number }).restDow).toBe(3);
      await page.keyboard.press('Escape');
      await expect(note).toHaveCount(0);
      expect(errors).toEqual([]);
    });

    // Kurzer Tag (Emrahs Entscheidung 2A, 04.11.2026): nur solange heute nichts angefasst ist, höchstens zweimal je Woche; Pflicht und
    // Serie bleiben (dieselben Schritte, kleiner). Seed-Lerntag 20.09.2026 (Sonntag: Schritt 3 ist der Wochen-Check und behält 5 Minuten).
    test('Kurzer Tag: einmal antippen → Tagesweg ca. 10 Minuten, kt im Profil, Wörter-Plan kleiner, Link danach weg', async ({ page }) => {
      // Wie bei Emrah: die Wörter-App schaltet sich selbst ein; erst danach tippen (sie übernimmt die Karten einige Sekunden nach dem Start).
      const { errors } = await boot(page, { migrated: true, vocabAuto: true, fake: { patch: { 'app/profile': UNTOUCHED } } });
      await screen(page, 'today');
      await expect
        .poll(async () => ((await dump(page))['app/schema'] as { vocabModule?: { state?: string } } | undefined)?.vocabModule?.state, { timeout: 20_000 })
        .toBe('done');
      const go = page.getByTestId('short-day-go');
      await expect(go).toBeVisible();
      await expect(page.getByTestId('short-day')).toContainText('noch 2-mal');
      await go.click();
      await expect(page.getByTestId('short-day-on')).toBeVisible();
      await expect(go).toHaveCount(0);
      const d = await dump(page);
      const prof = d['app/profile'] as { kt?: Record<string, number>; plan?: { u?: { kt?: number; min?: number; goalMin?: number; b?: unknown[][] } } };
      expect(prof.kt).toEqual({ '2026-09-20': 1 });
      expect(prof.plan?.u?.kt).toBe(1);
      expect(prof.plan?.u?.goalMin).toBe(10);
      expect(prof.plan?.u?.b?.map((b) => b[2])).toEqual([5, 3, 5]);
      // Die Wörter-Runde friert den heutigen Wörter-Plan mit ca. 5 Minuten ein (statt 10).
      await page.getByTestId('start').click();
      await expect.poll(async () => ((await dump(page))['vmod/day'] as { min?: number } | undefined)?.min ?? 99, { timeout: 15_000 }).toBeLessThanOrEqual(7);
      expect(errors).toEqual([]);
    });

    test('Kurzer Tag: nach zwei kurzen Tagen in dieser Woche kein Link mehr', async ({ page }) => {
      const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { ...UNTOUCHED, kt: { '2026-09-14': 1, '2026-09-16': 1 } } } } });
      await screen(page, 'today');
      await expect(page.getByTestId('today-goal-change')).toBeVisible();
      await expect(page.getByTestId('short-day-go')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}
