import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, layoutProblems, screen, SEED_EVENING, type Lang, type Theme } from './fixtures';
import { DAY, dump, planPatch, writes } from './trainerHelpers';

// „Heute": eine Statuszeile, EIN großer Knopf, Plan einmal je Lerntag (Tagesplan v2, phase2-plan §6),
// erledigt ist Zustand. Stichproben über Breiten, Modi und Sprachen (keine volle Matrix).

const SHOTS = 'test-results/screens';
mkdirSync(SHOTS, { recursive: true });
const GERMAN_IN_EN = /[äöüÄÖÜß]|\b(und|nicht|wird|Karten|Tage|Einstellungen|Serie|Heute|Wiederholen)\b/;
const BG: Record<Theme, string> = { dark: 'rgb(11, 15, 25)', dim: 'rgb(26, 32, 48)', light: 'rgb(245, 246, 250)' };

const SAMPLES: Array<{ width: number; theme: Theme; lang: Lang }> = [
  { width: 390, theme: 'dark', lang: 'de' },
  { width: 390, theme: 'light', lang: 'en' },
  { width: 1440, theme: 'dim', lang: 'de' },
  { width: 1440, theme: 'light', lang: 'de' },
  { width: 1440, theme: 'dark', lang: 'en' },
];

for (const s of SAMPLES) {
  test(`Heute rendert · ${s.width}px · ${s.theme} · ${s.lang}`, async ({ browser }) => {
    const mobile = s.width < 768;
    const context = await browser.newContext({ viewport: { width: s.width, height: mobile ? 844 : 900 }, isMobile: mobile, hasTouch: mobile, timezoneId: 'Europe/Berlin', locale: s.lang === 'de' ? 'de-DE' : 'en-US' });
    const page = await context.newPage();
    const { errors, external } = await boot(page, { migrated: true, theme: s.theme, lang: s.lang });
    await screen(page, 'today');
    await expect(page.getByTestId('today-status')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('data-theme', s.theme);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(BG[s.theme]);
    // Genau ein Primärknopf, ohne Scrollen sichtbar (Kap. 2.1).
    await expect(page.getByTestId('start')).toBeInViewport();
    await expect(page.locator('main button.bg-accent')).toHaveCount(1);
    expect(await layoutProblems(page)).toEqual([]);
    const text = await page.locator('body').innerText();
    if (s.lang === 'en') expect(GERMAN_IN_EN.exec(text)?.[0] ?? null).toBeNull();
    await page.screenshot({ path: `${SHOTS}/heute-${s.width}-${s.theme}-${s.lang}.png`, fullPage: true });
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
    await context.close();
  });
}

test('Plan wird einmal je Lerntag gespeichert und nach dem Neuladen nicht neu gewürfelt', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { persist: true } });
  await screen(page, 'today');
  const status = page.getByTestId('today-status');
  // Tagesplan v2 (phase2-plan §6.1): Wiederholen + Lektion + Pflichtkanal, zwei Angebote.
  await expect(status).toHaveText(/^Noch nicht fertig · 0 von 3 · es fehlt: /);
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as { v?: number } | undefined)?.v).toBe(1);
  type Plan = { d: string; v: number; ids: string[]; why: unknown[][]; duty: string[]; goal: { review: number; due: number; new: number; ahead: number; ch: number }; lesson: string | null; at: number };
  const plan = (await dump(page))['app/profile']?.plan as Plan;
  expect(plan.d).toBe(DAY);
  expect(plan.duty).toHaveLength(3);
  expect(plan.duty.slice(0, 2)).toEqual(['review', 'lesson']);
  expect(plan.duty[2]).toBe(`ch:${plan.ids[0]}`);
  expect(['gram', 'cloze', 'order']).toContain(plan.ids[0]);
  expect(plan.ids).toHaveLength(3);
  expect(new Set(plan.ids).size).toBe(3);
  expect(plan.why).toHaveLength(3);
  expect(plan.lesson).toMatch(/^l\d{2}$/);
  expect(plan.goal.review).toBeGreaterThanOrEqual(10);
  expect(plan.goal.due + plan.goal.new + plan.goal.ahead).toBe(plan.goal.review);
  expect(plan.goal.ch).toBe({ gram: 6, cloze: 8, order: 6 }[plan.ids[0] as 'gram' | 'cloze' | 'order']);
  expect(plan.at).toBe(Date.parse(SEED_EVENING));
  const text = await status.innerText();
  await expect(page.getByTestId('duty')).toHaveCount(3);
  expect((await writes(page)).filter((w) => w.path === 'app/profile')).toHaveLength(1);
  await page.reload();
  await screen(page, 'today');
  await expect(status).toHaveText(text);
  await page.waitForTimeout(300);
  expect((await writes(page)).filter((w) => w.path === 'app/profile')).toHaveLength(0);
  expect((await dump(page))['app/profile']?.plan).toEqual(plan);
  expect(errors).toEqual([]);
});

test('erledigt ist Zustand, kein Knopf; Extra zählt nie zur Pflicht', async ({ page }) => {
  const entries = [
    { t: 1, ok: true, lang: 'de', k: 'v', id: 'avoid', m: 'tr-mc_en', given: 'x', ans: 'x', g: 3, ms: 1000, ctx: 'rev' },
    { t: 2, ok: false, lang: 'de', k: 'v', id: 'deserve', m: 'tr-type', given: 'x', ans: 'y', g: 1, ms: 1000, ctx: 'rev' },
    { t: 3, ok: true, lang: 'de', k: 'v', id: 'handle', m: 'tr-type', given: 'x', ans: 'x', g: 3, ms: 1000, ctx: 'xtra' },
  ];
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(2), [`log/${DAY}`]: { date: DAY, entries } } } });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveText('Fertig für heute');
  const done = page.getByTestId('done-item');
  await expect(done).toHaveAttribute('data-state', 'done');
  await expect(done.locator('button')).toHaveCount(0);
  await expect(page.getByTestId('start')).toHaveCount(0);
  await expect(page.getByTestId('balance')).toHaveText('Heute: 3 Antworten · 67 % richtig · 15 Min. · Extra: 1 Karte');
  await expect(page.getByTestId('start-extra')).toBeVisible();
  expect(errors).toEqual([]);
});

test('„Dein Stand" über die Navigation, zurück zu Heute', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await expect(page.getByTestId('today-streak')).toHaveText('Serie: 12 Tage');
  await page.getByTestId('tab-overview').click();
  await screen(page, 'overview');
  await expect(page.getByTestId('streak-count')).toHaveText('12');
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  expect(errors).toEqual([]);
});
