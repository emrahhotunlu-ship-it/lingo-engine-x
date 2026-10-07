import { mkdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { boot, layoutProblems, screen, SEED_EVENING, type Lang, type Theme, openOverview, expectStreak } from './fixtures';
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
  // Tageseinheit (plan.md §1.5): Stichtag ist ein Sonntag → Wiederholen + Wochen-Check + (Plan v2, Seed hat fällige Fehlersätze) Fehler korrigieren.
  await expect(status).toHaveAttribute('data-total', '3');
  await expect.poll(async () => ((await dump(page))['app/profile']?.plan as { v?: number } | undefined)?.v).toBe(1);
  type Plan = { d: string; v: number; ids: string[]; duty: string[]; goal: { review: number; due: number; new: number; ahead: number }; lesson: string | null; at: number; u: { shape: string; b: unknown[] } };
  const plan = (await dump(page))['app/profile']?.plan as Plan;
  expect(plan.d).toBe(DAY);
  expect(plan.duty).toEqual(['review', 'ch:u-check', 'ch:u-again']);
  expect(plan.u.shape).toBe('sun');
  expect(plan.lesson).toBeNull();
  expect(plan.goal.review).toBeGreaterThan(0);
  expect(plan.goal.due + plan.goal.new + plan.goal.ahead).toBeLessThanOrEqual(plan.goal.review);
  expect(plan.at).toBe(Date.parse(SEED_EVENING));
  const text = await status.innerText();
  await expect(page.getByTestId('duty')).toHaveCount(3);
  expect((await writes(page)).filter((w) => w.path === 'app/profile').length).toBeGreaterThanOrEqual(1);
  await page.reload();
  await screen(page, 'today');
  await expect(status).toHaveText(text);
  await page.waitForTimeout(300);
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
  // Fertig-Karte ist Zustand: kein Knopf in der Karte, keine Blockliste mehr (Kap. 2.2).
  const card = page.getByTestId('today-card');
  await expect(card).toHaveAttribute('data-done', 'true');
  await expect(card.locator('button')).toHaveCount(0);
  await expect(page.getByTestId('duty')).toHaveCount(0);
  await expect(page.getByTestId('start')).toHaveCount(0);
  // Abschluss: EINE zählende Zahl; die Wahrheitszeile erscheint nur mit belegten Morgenwerten (dieser Plan hat keine).
  await expect(page.getByTestId('balance')).toHaveText(/^(\+\d+ (Wörter|Muster) sicher|\d+ von \d+ Schritten)$/);
  await expect(page.getByTestId('today-truth')).toHaveCount(0);
  // Nach der Pflicht genau EINE Zeile „Extra ›“ (Lernplattform 2.0 §2.2), kein eigener Vorschlag mehr.
  await expect(page.getByTestId('today-extra')).toBeVisible();
  await expect(page.getByTestId('offer')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('„Dein Stand" über die Navigation, zurück zu Heute', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await expect(page.getByTestId('today-streak')).toHaveText('Serie: 12 Tage');
  await expectStreak(page, '12');
  await openOverview(page);
  await screen(page, 'overview');
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  expect(errors).toEqual([]);
});
