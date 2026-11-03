import { expect, test } from '@playwright/test';
import { boot, layoutProblems, openProfile, openSettings, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Großpaket B10 (Emrahs Wahl 03.11.2026): „Urlaub ankündigen“ in den Einstellungen und die Seite „So funktioniert’s“ aus dem Profil-Blatt.
// Seed-Lerntag 20.09.2026 (Sonntag).

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
  });
}
