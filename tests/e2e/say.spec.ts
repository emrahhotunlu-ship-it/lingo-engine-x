import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, screen, type Lang } from './fixtures';
import { DAY, dump, type Dump } from './trainerHelpers';

// „Sag es“ (Lernberatung 27.09., V1/V2):
// - Plan: am Sag-es-Tag (23.09.2026) ist „Sag es“ Pflichtkanal – nur mit Claude; Satzbau nie Pflicht.
// - Ablauf: Situation → Antwort → Prüfen → drei Schichten → „Nochmal, aber besser“ → zweite Prüfung
//   → beide Fassungen. Korrekturen des ersten Durchgangs landen in `app/repair`, der Eintrag in
//   `say/<Monat>`, `act.say` erfüllt die Pflicht (erst nach dem zweiten Durchgang).
// - Ohne Claude blockiert der Baustein die Pflicht nicht: Speichern ohne Prüfung.

type Doc = Record<string, unknown>;
const SAY_DAY = '2026-09-23';

const FIRST =
  'Thank you for your honest feedback. I understand that the price looks high compared to your current archive. ' +
  'We are working with them since 2019 and they save many hours every month. Can we discuss about the numbers next week? ' +
  'I will prepare a short calculation for your team.';
const SECOND =
  'Thank you for your honest feedback. I understand that the price may seem high at first glance. ' +
  'We have been working with similar companies since 2019, and they save many hours every month. ' +
  "I'd suggest that we go through the numbers together next week.";

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

/** Gespeicherter Plan des Stichtags mit „Sag es“ als einzigem Pflichtpunkt. */
const SAY_PLAN = { d: DAY, v: 1, ids: ['say', 'gram', 'cloze'], why: [[['whySay']], [['whyRotation']], [['whyRotation']]], duty: ['ch:say'], goal: { review: 0, ch: 1 }, lesson: null, at: 1 };

const planOf = async (page: Page) => (await dump(page))['app/profile']?.plan as { d: string; ids: string[]; duty: string[] } | undefined;
const actOf = (d: Dump, day: string): Doc => (d['app/profile']?.act as Record<string, Doc> | undefined)?.[day] ?? {};

const TEXT: Record<Lang, { title: string; task: string; before: string; hero: string }> = {
  de: { title: 'Sag es', task: 'Antworte in 3–6 Sätzen auf Englisch.', before: 'Vorher', hero: 'Sag es · etwa 8 Min.' },
  en: { title: 'Say it', task: 'Answer in 3–6 sentences in English.', before: 'Before', hero: 'Say it · about 8 min' },
};

test.describe('Tagesplan', () => {
  test.use({ viewport: DESKTOP });

  test('am Sag-es-Tag mit Claude ist „Sag es“ Pflicht (8 Min.), ohne Claude die bisherige Wahl', async ({ page, browser }) => {
    const { errors, external } = await boot(page, { migrated: true, now: `${SAY_DAY}T20:00:00+02:00` });
    await screen(page, 'today');
    await expect.poll(async () => (await planOf(page))?.d).toBe(SAY_DAY);
    const plan = (await planOf(page))!;
    expect(plan.ids[0]).toBe('say');
    expect(plan.duty.at(-1)).toBe('ch:say');
    const row = page.locator('[data-testid="duty"][data-duty="ch:say"]');
    await expect(row).toHaveAttribute('data-state', 'open');
    await expect(row).toContainText('Sag es');
    await expect(row.getByTestId('reason')).toHaveAttribute('data-why', 'whySay');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);

    const ctx = await browser.newContext({ viewport: DESKTOP, timezoneId: 'Europe/Berlin', locale: 'de-DE' });
    const p2 = await ctx.newPage();
    await boot(p2, { migrated: true, now: `${SAY_DAY}T20:00:00+02:00`, fake: { capabilities: { sample: false } } });
    await screen(p2, 'today');
    await expect.poll(async () => (await planOf(p2))?.d).toBe(SAY_DAY);
    const without = (await planOf(p2))!;
    expect(['gram', 'cloze']).toContain(without.ids[0]);
    expect(without.duty).not.toContain('ch:say');
    await ctx.close();
  });
});

async function fullRun(page: Page, lang: Lang, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  const { errors, external } = await boot(page, { migrated: true, lang, fake: { patch: { 'app/profile': { plan: SAY_PLAN } } } });
  await screen(page, 'today');
  await expect(page.getByTestId('hero')).toHaveAttribute('data-duty', 'ch:say');
  await expect(page.getByTestId('hero')).toContainText(TEXT[lang].hero);
  await page.getByTestId('start').click();

  const say = page.getByTestId('say');
  await expect(say).toHaveAttribute('data-phase', 'write1');
  await expect(page.getByTestId('task')).toHaveText(TEXT[lang].task);
  // Zweck nur hinter dem Info-Symbol (A7).
  await expect(page.getByTestId('purpose')).toHaveCount(0);
  await page.getByTestId('purpose-info').click();
  await expect(page.getByTestId('purpose')).toBeVisible();
  await expect(page.getByTestId('say-timer')).toHaveAttribute('data-left', '180');
  // „Andere Situation“ wechselt, solange noch nichts geschrieben ist.
  const sit0 = await page.getByTestId('say-situation').getAttribute('data-sit');
  await page.getByTestId('say-other').click();
  await expect(page.getByTestId('say-situation')).not.toHaveAttribute('data-sit', sit0 ?? '');
  const sit = await page.getByTestId('say-situation').getAttribute('data-sit');

  // Unter 20 Wörtern: Prüfen gesperrt.
  await page.getByTestId('say-draft').fill('Thank you for your feedback.');
  await expect(page.getByTestId('say-check')).toBeDisabled();
  await expect(page.getByTestId('say-other')).toHaveCount(0);
  await page.getByTestId('say-draft').fill(FIRST);
  await page.getByTestId('say-check').click();

  // Rückmeldung in drei Schichten.
  await expect(say).toHaveAttribute('data-phase', 'feedback');
  await expect(page.getByTestId('say-praise')).not.toBeEmpty();
  await expect(page.getByTestId('say-correction')).toHaveCount(2);
  await expect(page.getByTestId('say-correction').first()).toContainText('We have been working with them since 2019');
  await expect(page.getByTestId('say-upgrade')).toHaveCount(1);
  await expect(page.getByTestId('say-better')).toContainText('at first glance');
  // Englische Wörter antippbar.
  expect(await page.getByTestId('say-better').locator('button.lx-word').count()).toBeGreaterThan(10);
  // Korrekturen des ersten Durchgangs → Reparatur-Sätze (ganzer eigener Satz).
  await expect(page.getByTestId('say-repairs')).toHaveAttribute('data-n', '2');
  await expect.poll(async () => (((await dump(page))['app/repair']?.items as Doc[] | undefined) ?? []).length).toBe(2);
  const repairs = (await dump(page))['app/repair']?.items as Doc[];
  expect(repairs.every((r) => r.src === 'say' && typeof r.ctx === 'string' && r.box === 0)).toBe(true);
  expect(repairs.map((r) => r.wrong)).toContain('We are working with them since 2019 and they save many hours every month.');
  expect(repairs.map((r) => r.right)).toContain('Can we discuss the numbers next week?');
  // Wendung aus der Aufwertung merken.
  await page.getByTestId('say-upgrade').getByTestId('take-chunk').getByRole('button').click();
  await expect(page.getByTestId('say-upgrade').getByTestId('take-chunk')).toHaveAttribute('data-state', 'taken');
  await expect.poll(async () => Object.entries(await dump(page)).some(([k, v]) => k.startsWith('chunk/') && (v.src as Doc | undefined)?.kind === 'say')).toBe(true);
  // Zwischenstand gespeichert, Pflicht noch offen (erst nach dem zweiten Durchgang).
  await expect.poll(async () => ((await dump(page))['say/2026-09']?.items as Doc[] | undefined)?.length ?? 0).toBe(1);
  expect(actOf(await dump(page), DAY).say).toBeUndefined();
  expect(await layoutProblems(page)).toEqual([]);

  // „Nochmal, aber besser“: Rückmeldung ausgeblendet, 2 Minuten.
  await page.getByTestId('say-again').click();
  await expect(say).toHaveAttribute('data-phase', 'write2');
  await expect(page.getByTestId('say-feedback')).toHaveCount(0);
  await expect(page.getByTestId('say-better')).toHaveCount(0);
  await expect(page.getByTestId('say-timer')).toHaveAttribute('data-left', '120');
  await page.getByTestId('say-draft2').fill(SECOND);
  await page.getByTestId('say-check2').click();

  // Beide Fassungen nebeneinander, darunter die bessere Fassung.
  await expect(say).toHaveAttribute('data-phase', 'final');
  await expect(page.getByTestId('say-before')).toContainText('We are working with them since 2019');
  await expect(page.getByTestId('say-after')).toContainText('We have been working with similar companies');
  await expect(page.getByTestId('say-compare')).toContainText(TEXT[lang].before);
  await expect(page.getByTestId('say-better')).toBeVisible();
  if (viewport.width >= 640) {
    const a = await page.getByTestId('say-before').boundingBox();
    const b = await page.getByTestId('say-after').boundingBox();
    expect(!!a && !!b && Math.abs(a.y - b.y) < 2 && b.x > a.x).toBe(true);
  }
  expect(await layoutProblems(page)).toEqual([]);

  // Gespeichert: Monatsdokument, Log, act.say; Reparatur-Sätze nur aus dem ersten Durchgang.
  await expect.poll(async () => actOf(await dump(page), DAY).say).toBe(1);
  const d = await dump(page);
  const item = (d['say/2026-09']?.items as Doc[])[0]!;
  expect(item).toMatchObject({ day: DAY, sit, lang, ai: true, a1: FIRST, a2: SECOND });
  expect((item.fb1 as Doc).corrections).toHaveLength(2);
  expect((item.fb2 as Doc).corrections).toHaveLength(0);
  expect((d['app/repair']?.items as Doc[]).length).toBe(2);
  const log = ((d[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.type === 'say');
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ id: sit, m: 'say', ctx: 'say', n: 2, ok: true });

  // Heute: der Pflichtkanal ist Zustand, kein Knopf.
  await page.getByTestId('summary-back').click();
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', 'allDone');
  const done = page.locator('[data-testid="done-item"], [data-testid="duty"]').filter({ hasText: TEXT[lang].title });
  await expect(done).toHaveAttribute('data-state', 'done');
  await expect(done.locator('button, a, input, textarea')).toHaveCount(0);
  await expect(page.getByTestId('hero')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
}

test.describe('Ablauf', () => {
  test('Handy 390, Deutsch: ganzer Ablauf mit zweitem Durchgang', async ({ page }) => {
    await fullRun(page, 'de', MOBILE);
  });

  test('Desktop, English: whole flow, both versions side by side', async ({ page }) => {
    await fullRun(page, 'en', DESKTOP);
  });
});

test.describe('ohne Claude', () => {
  test.use({ viewport: MOBILE });

  test('Pflicht wird nicht blockiert: ohne Prüfung speichern erfüllt „Sag es“', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false }, patch: { 'app/profile': { plan: SAY_PLAN } } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'write1');
    await expect(page.getByTestId('say-noai-hint')).toBeVisible();
    await expect(page.getByTestId('say-check')).toHaveCount(0);
    await expect(page.getByTestId('say-noai')).toBeDisabled();
    await page.getByTestId('say-draft').fill(FIRST);
    await page.getByTestId('say-noai').click();
    await expect(page.getByTestId('say')).toHaveAttribute('data-phase', 'final');
    await expect(page.getByTestId('say-before')).toContainText('We are working with them since 2019');
    await expect(page.getByTestId('say-better')).toHaveCount(0);
    await expect.poll(async () => actOf(await dump(page), DAY).say).toBe(1);
    const d = await dump(page);
    expect((d['say/2026-09']?.items as Doc[])[0]).toMatchObject({ ai: false, a1: FIRST, a2: '' });
    expect(d['app/repair']).toBeUndefined();
    await page.getByTestId('summary-back').click();
    await screen(page, 'today');
    await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', 'allDone');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
});
