import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';

// Phase 6 (Plan §5, §13): Kanalgewichtung – jede offene Zeile nennt ihren Grund, Neuladen ergibt
// denselben Plan, der Fokus der Einschätzung wirkt ab dem nächsten Plan und nur solange er gilt.

type Dump = Record<string, Record<string, unknown>>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Dump;
const dump = (page: Page) => page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());
type Plan = { d: string; ids: string[]; why: unknown[][]; duty: string[] };
const planOf = async (page: Page): Promise<Plan> => (await dump(page))['app/profile']?.plan as Plan;

test.use({ viewport: { width: 1440, height: 900 } });

test('jede offene Pflichtzeile nennt ihren Grund; neu geladen ergibt der gespeicherte Plan denselben Plan', async ({ page, browser }) => {
  const { errors } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', 'open');
  await expect.poll(async () => (await planOf(page))?.d).toBe('2026-09-20');
  const first = await planOf(page);
  const open = page.locator('[data-testid="duty"][data-state="open"]');
  expect(await open.count()).toBeGreaterThan(0);
  for (const row of await open.all()) {
    const reason = row.getByTestId('reason');
    await expect(reason).not.toBeEmpty();
    expect(await reason.getAttribute('data-why')).toBeTruthy();
  }
  // Neuzeichnen: Reiter wechseln und zurück – der Plan bleibt.
  for (let k = 0; k < 3; k++) {
    await page.getByTestId('tab-vocab').click();
    await page.getByTestId('tab-today').click();
    await screen(page, 'today');
    expect(await planOf(page)).toEqual(first);
  }
  expect(errors).toEqual([]);
  // Neu geladen mit dem gespeicherten Plan (anderes Gerät, andere Einschätzung): unverändert.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const p2 = await ctx.newPage();
  const focus = { title: 'Satzbau', why: 'Wortstellung.', action: 'order', days: 3, channels: ['order'] };
  await boot(p2, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/profile': { plan: first }, 'app/assess': { d: '2026-09-20', data: { ...(SEED['app/assess']?.data as Record<string, unknown>), focus } } } } });
  await screen(p2, 'today');
  await expect(p2.getByTestId('today-status')).toBeVisible();
  await p2.waitForTimeout(500);
  expect(await planOf(p2)).toEqual(first);
  await ctx.close();
});

/** Plan von heute ohne offene Pflicht: „Lohnt sich jetzt“ erscheint sofort (B6/B10: die Gewichtung wählt die Zeile). */
const donePlan = (d: string) => ({ plan: { d, v: 1, ids: [], why: [], duty: [], goal: { review: 0 }, lesson: null, at: 1 } });
const offerWhy = async (page: Page): Promise<{ channel: string | null; why: string | null }> => {
  const offer = page.getByTestId('offer');
  await expect(offer).toHaveCount(1);
  return { channel: await offer.getAttribute('data-channel'), why: await offer.getByTestId('reason').getAttribute('data-why') };
};

test('Claudes Fokus (Mixed Conditionals, gültig bis 20.09.) wirkt auf „Lohnt sich jetzt“ mit Grund', async ({ page }) => {
  await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/profile': donePlan('2026-09-20') } } });
  await screen(page, 'today');
  const o = await offerWhy(page);
  // Der Fokus hebt seinen Kanal an; die eine Zeile nennt ihn als Grund.
  expect(o.why).toContain('whyFocus');
});

test('am nächsten Tag: abgelaufener Fokus wirkt nicht mehr, eine neue Einschätzung wirkt', async ({ browser }) => {
  const at = '2026-09-21T09:00:00+02:00';
  const ctx1 = await browser.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const p1 = await ctx1.newPage();
  await boot(p1, { migrated: true, now: at, fake: { capabilities: { sample: false }, patch: { 'app/profile': donePlan('2026-09-21') } } });
  await screen(p1, 'today');
  expect((await offerWhy(p1)).why ?? '').not.toContain('whyFocus');
  await ctx1.close();

  const ctx2 = await browser.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const p2 = await ctx2.newPage();
  const focus = { title: 'Lückenjagd', why: 'Kollokationen.', action: 'cloze', days: 3, channels: ['cloze'] };
  await boot(p2, { migrated: true, now: at, fake: { capabilities: { sample: false }, patch: { 'app/profile': donePlan('2026-09-21'), 'app/assess': { d: '2026-09-20', data: { ...(SEED['app/assess']?.data as Record<string, unknown>), focus } } } } });
  await screen(p2, 'today');
  const o = await offerWhy(p2);
  expect(o.channel).toBe('cloze');
  expect(o.why).toContain('whyFocus');
  await ctx2.close();
});
