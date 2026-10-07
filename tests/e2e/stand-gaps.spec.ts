import { expect, test, type Page } from '@playwright/test';
import { boot, openSettings, layoutProblems, openOverview, screen } from './fixtures';
import { typeInGap } from './learnHelpers';
import { answerCheckItem, playCheck } from './progressHelpers';
import { dump, planPatch } from './trainerHelpers';
import { openChecks, openProfileContent } from './profilHelpers';

// Lücken aus dem Abgleich (Kap. 9/14, M7, M10, M13, M18, M20, M21, M22, W5, Kap. 4.1):
// alte Daten sichtbar, Wochen-Check, Wochenstreifen und Niveau-Leiste, Farbthema und beruflicher
// Kontext, Nachtragen-Hinweis auf Heute, Ladepunkt, „Was ist neu" und die
// Lücke über der iPhone-Tastatur. Gegen den Produktions-Build mit eingespieltem Adapter.

test.use({ viewport: { width: 1440, height: 900 } });

type Doc = Record<string, unknown>;
const profileOf = async (page: Page): Promise<Doc> => (await dump(page))['app/profile'] ?? {};

async function openHistory(page: Page): Promise<void> {
  await openOverview(page);
  await page.getByTestId('tab-review').click();
  await expect(page.getByTestId('history')).toBeVisible();
}


test('Kap. 9/14: alte Wochen-Checks sind sichtbar, die „Letzten Fortschritte“ der alten App nicht mehr (nur lesen, Daten bleiben)', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await openChecks(page);
  const card = page.getByTestId('checks-card');
  await card.getByTestId('checks-toggle').click();
  await expect(card.getByTestId('check-row')).toHaveCount(2);
  await expect(card.getByTestId('check-row').first()).toContainText('75 %');
  await expect(card.getByTestId('check-row').first()).toContainText('4/5');
  await expect(card.getByTestId('check-last')).toContainText('75 %');
  await expect(card.getByTestId('check-last')).toContainText('67 %');
  // Fokus-Umbau: die Tabelle „Letzte Fortschritte“ (Entdecken, Preply …) ist nicht mehr in der Oberfläche; `profile.feed` bleibt.
  await openHistory(page);
  await expect(page.getByTestId('legacy-feed')).toHaveCount(0);
  expect(await layoutProblems(page)).toEqual([]);
  // Nur lesen: das Öffnen schreibt nichts an checks/feed.
  const p = await profileOf(page);
  expect((p.checks as unknown[]).length).toBe(2);
  expect((p.feed as unknown[]).length).toBe(8);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('M10: Wochen-Check – 12 Aufgaben ohne Tipps, Ergebnis im alten Format, Vergleich, nie Pflicht, einmal je Woche', async ({ page }) => {
  test.setTimeout(90_000);
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  const before = { done: await page.getByTestId('today-status').getAttribute('data-done'), status: await page.getByTestId('today-status').getAttribute('data-status') };
  const seedProfile = await profileOf(page);
  const gramBefore = ((seedProfile.act as Record<string, Doc>)['2026-09-20'] ?? {}).gram;

  await openChecks(page);
  await page.getByTestId('check-start').click();
  await expect(page.locator('[data-screen="check"]')).toBeVisible();
  await expect(page.getByTestId('check-screen')).toContainText('Extra');
  await playCheck(page);

  const summary = page.getByTestId('check-summary');
  await expect(summary).toBeVisible();
  await expect(summary).toHaveAttribute('data-saved', 'saved');
  await expect(page.getByTestId('check-compare')).toContainText('75 %');
  for (const a of ['vocab', 'colloc', 'gram']) await expect(page.getByTestId(`check-area-${a}`)).toBeVisible();
  expect(await layoutProblems(page)).toEqual([]);

  const p = await profileOf(page);
  const checks = p.checks as Doc[];
  expect(checks).toHaveLength(3);
  expect(checks.slice(0, 2)).toEqual(seedProfile.checks);
  const rec = checks[2]!;
  expect(rec).toMatchObject({ d: '2026-09-20', n: 12 });
  expect(Object.keys(rec).sort()).toEqual(['colloc', 'd', 'gram', 'n', 'ok', 't', 'topics', 'vocab', 'words']);
  expect(rec.vocab).toEqual([expect.any(Number), 5]);
  expect(rec.colloc).toEqual([expect.any(Number), 2]);
  expect(rec.gram).toEqual([expect.any(Number), 5]);
  // Rundenende als `check`, nie als Grammatik-Pflichtkanal.
  await expect.poll(async () => (((await profileOf(page)).act as Record<string, Doc>)['2026-09-20'] ?? {}).check).toBe(1);
  expect((((await profileOf(page)).act as Record<string, Doc>)['2026-09-20'] ?? {}).gram).toBe(gramBefore);
  // Alle Antworten als Extra protokolliert.
  const entries = ((await dump(page))['log/2026-09-20']?.entries as Doc[]).filter((e) => typeof e.t === 'number' && (e.t) > (rec.t as number) - 600_000);
  expect(entries.length).toBeGreaterThanOrEqual(12);
  expect(entries.every((e) => e.ctx === 'xtra')).toBe(true);

  // Zurück: „Diese Woche erledigt", kein zweiter Check; Heute unverändert.
  await page.getByTestId('session-end-next').waitFor();
  await page.getByTestId('session-end-secondary').or(page.getByTestId('session-end-next')).first().click();
  await expect(page.getByTestId('check-week-done')).toBeVisible();
  await expect(page.getByTestId('check-start')).toHaveCount(0);
  await page.getByTestId('checks-toggle').click();
  await expect(page.getByTestId('check-row')).toHaveCount(3);
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', before.done ?? '');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', before.status ?? '');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('M10: kein Angebot auf Heute, Einstieg über Profil → Wochen-Check; Abbruch vor 6 Antworten speichert kein Ergebnis', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(0) } } });
  await screen(page, 'today');
  // Neubau (plan.md B12, §1.4): Heute beherbergt nichts doppelt – nach der Pflicht nur „Lohnt sich jetzt“,
  // der Wochen-Check liegt im Profil unter Tests (Extra).
  await expect(page.getByTestId('today-extra')).toBeVisible();
  await expect(page.getByTestId('check-offer')).toHaveCount(0);
  await openChecks(page);
  await page.getByTestId('check-start').click();
  await expect(page.locator('[data-screen="check"]')).toBeVisible();
  await expect(page.getByTestId('check-screen')).toContainText('Extra');
  await answerCheckItem(page, 1, 12);
  await answerCheckItem(page, 2, 12);
  // ✕ führt dorthin zurück, woher der Check kam (UX-Beratung Nr. 3): zur Seite Wochen-Check, Start wieder da.
  await page.getByTestId('round-close').click();
  await screen(page, 'checks');
  await expect(page.getByTestId('check-start')).toBeVisible();
  expect(((await profileOf(page)).checks as unknown[]).length).toBe(2);
  expect(errors).toEqual([]);
});

test('M10: ist diese Woche schon ein Check gespeichert, gibt es kein Angebot', async ({ page }) => {
  const done = { d: '2026-09-15', t: Date.parse('2026-09-15T18:00:00+02:00'), n: 12, ok: 10, vocab: [5, 5], colloc: [1, 2], gram: [4, 5], topics: [], words: [] };
  const seedChecks = [
    { d: '2026-09-05', t: 1788631200000, n: 12, ok: 8, vocab: [4, 5], colloc: [1, 2], gram: [3, 5], topics: ['passive', 'reported'], words: ['affect'], lvl: 61 },
    { d: '2026-09-12', t: 1789236000000, n: 12, ok: 9, vocab: [4, 5], colloc: [2, 2], gram: [3, 5], topics: ['mixed-cond'], words: ['afford'], lvl: 63 },
  ];
  await boot(page, { migrated: true, fake: { patch: { 'app/profile': { ...planPatch(0), checks: [...seedChecks, done] } } } });
  await screen(page, 'today');
  await expect(page.getByTestId('today-extra')).toBeVisible();
  await expect(page.getByTestId('check-offer')).toHaveCount(0);
  await openChecks(page);
  await expect(page.getByTestId('check-week-done')).toBeVisible();
  await expect(page.getByTestId('check-last')).toContainText('83 %');
});

test('M7: Wochenstreifen (7 Tagesringe, dieselbe Regel wie die Serie) und Niveau-Leiste in der Kopfzeile', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  // Neubau: Serie und Wochenstreifen stehen im Profil (Pflicht · nur Extra · Ruhetag · offen).
  await openProfileContent(page);
  const strip = page.getByTestId('week-strip');
  await expect(strip.getByTestId('week-day')).toHaveCount(7);
  await expect(strip.getByTestId('week-day').last()).toHaveAttribute('data-today', '');
  await expect(strip.getByTestId('week-day').first()).toHaveAttribute('data-day', '2026-09-14');
  // Nie nur Farbe: jeder Ring hat eine Beschriftung für Vorleseprogramme.
  await expect(strip.getByTestId('week-day').first()).toContainText('Montag, 14. September');
  const states = await strip.getByTestId('week-day').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
  expect(states.every((s) => s && ['done', 'extra', 'rest', 'open'].includes(s))).toBe(true);
  // Serie 12 nach alter Regel: die ganze Woche zählt.
  expect(states).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'done']);
  await expect(page.getByTestId('profile-sheet-streak')).toContainText('12');
  // Das Profil-Blatt ist schon offen: „Dein Stand ›“ direkt darin (ein zweiter Profil-Tipp träfe den Hintergrund).
  await page.getByTestId('profile-overview').click();
  await page.getByTestId('profile-sheet').waitFor({ state: 'detached' });
  await screen(page, 'overview');

  const scale = page.getByTestId('level-scale');
  await expect(scale).toBeVisible();
  const cefr = await page.getByTestId('assess-cefr').getAttribute('data-cefr');
  await expect(page.getByTestId('level-caption')).toContainText(`Claudes Stufe ${cefr}`);
  const dot = await page.getByTestId('level-dot').boundingBox();
  const band = await page.getByTestId('level-band').boundingBox();
  expect(dot && band && dot.x + dot.width / 2 >= band.x - 1 && dot.x + dot.width / 2 <= band.x + band.width + 1).toBe(true);
  expect(await layoutProblems(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test('M21 + M22: Farbthema aus theme.p, umschaltbar; beruflicher Kontext wird in app/profile.ctx gespeichert', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  // Seed: theme {m: dark, p: ocean} – die App übernimmt das Farbthema der alten App.
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'ocean');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lx-accent').trim())).toBe('#60a5fa');
  await openSettings(page);
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: 'Pflaume' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'plum');
  await expect.poll(async () => (await profileOf(page)).theme).toEqual({ m: 'dark', p: 'plum' });
  await dialog.getByRole('radio', { name: 'Hell' }).click();
  await expect.poll(async () => (await profileOf(page)).theme).toEqual({ m: 'light', p: 'plum' });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--lx-accent').trim())).toBe('#7a3e6c');

  const ctx = dialog.getByTestId('work-ctx');
  await expect(ctx.getByTestId('work-ctx-save')).toBeDisabled();
  await ctx.getByTestId('work-ctx-input').fill('  Projektleiter für Cloud-Software,\n viele Kundentermine  ');
  await ctx.getByTestId('work-ctx-save').click();
  await expect.poll(async () => (await profileOf(page)).ctx).toBe('Projektleiter für Cloud-Software, viele Kundentermine');
  await expect(ctx.getByTestId('work-ctx-save')).toBeDisabled();
  await expect(ctx.getByTestId('work-ctx-input')).toHaveAttribute('maxlength', '400');
  expect(errors).toEqual([]);
});

test('W5: Nachtragen-Hinweis auch auf Heute – leise Zeile, führt zu „Dein Stand"', async ({ page }) => {
  const { errors } = await boot(page, {
    migrated: true,
    localStorage: {
      'sw2:__dirty': JSON.stringify({ 'vocab/vom-handy': 1_789_950_000_000 }),
      'sw2:vocab/vom-handy': JSON.stringify({ word: 'from the phone', de: 'vom Handy', state: 'new', S: 0 }),
    },
  });
  await screen(page, 'today');
  const hint = page.getByTestId('late-rescue-hint');
  await expect(hint).toContainText('1 Änderung aus der alten App');
  // Keine konkurrierende Karte: genau ein großer Knopf bleibt der Pflichtknopf.
  await expect(hint.locator('button')).toHaveCount(1);
  await expect(page.getByTestId('late-rescue')).toHaveCount(0);
  await hint.getByTestId('late-rescue-open').click();
  await screen(page, 'overview');
  await expect(page.getByTestId('late-rescue')).toBeVisible();
  expect(errors).toEqual([]);
});

test('W5: ohne Kopien der alten App kein Hinweis auf Heute', async ({ page }) => {
  await boot(page, { migrated: true });
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toBeVisible();
  await expect(page.getByTestId('late-rescue-hint')).toHaveCount(0);
});

test('„Was ist neu“ ist entfernt (Emrahs Wunsch 27.09.) – auch nach einem Update kein Hinweis', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, whatsNew: true });
  await screen(page, 'today');
  await expect(page.getByTestId('start')).toBeVisible();
  await expect(page.getByTestId('whats-new')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test.describe('Kap. 4.1: Lücke und Prüfen-Knopf bleiben über der iPhone-Tastatur sichtbar', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('öffnet sich die Tastatur (visualViewport schrumpft), rollt die Seite genau so weit wie nötig', async ({ page }) => {
    // Nachgebildetes `visualViewport` (Chromium hat keine Bildschirmtastatur) und Mitschnitt von scrollBy.
    await page.addInitScript(() => {
      const vv = Object.assign(new EventTarget(), { height: window.innerHeight, width: window.innerWidth, offsetTop: 0, offsetLeft: 0, pageTop: 0, pageLeft: 0, scale: 1 });
      Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
      const calls: number[] = [];
      const orig = window.scrollBy.bind(window);
      (window as unknown as { __scrolls: number[] }).__scrolls = calls;
      window.scrollBy = ((a: ScrollToOptions | number, b?: number) => {
        calls.push(typeof a === 'number' ? (b ?? 0) : (a.top ?? 0));
        if (typeof a === 'number') orig(a, b ?? 0);
        else orig(a);
      }) as typeof window.scrollBy;
    });
    const forced = { 'vocab/overcome': { state: 'learning', stage: 4, S: 1, D: 5, due: 1_700_000_000_000, last: 1_699_900_000_000, reps: 3, lapses: 0, xs: { cloze: { c: 0, w: 6 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } } } };
    await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(1), ...forced } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'cloze');
    await typeInGap(page, 'ov');
    await page.waitForTimeout(250);
    // Ohne Tastatur wird nicht gerollt.
    expect(await page.evaluate(() => (window as unknown as { __scrolls: number[] }).__scrolls.length)).toBe(0);

    // Tastatur öffnet sich: nur noch die obersten 300 px sind sichtbar.
    const expected = await page.evaluate(() => {
      const vv = window.visualViewport as unknown as EventTarget & { height: number };
      vv.height = 300;
      // Die feste Aktionsleiste (Prüfen) folgt der Tastatur selbst: Es zählt nur der Bereich darüber.
      const bar = document.querySelector<HTMLElement>('[data-testid="actionbar"]')!;
      const gap = document.querySelector('[data-testid="gap"]')!.getBoundingClientRect();
      const top = gap.top;
      const bottom = gap.bottom;
      const h = 300 - bar.offsetHeight;
      vv.dispatchEvent(new Event('resize'));
      if (bottom - top > h - 24) return Math.round(top - 12);
      if (bottom > h - 12) return Math.round(bottom - (h - 12));
      if (top < 12) return Math.round(top - 12);
      return 0;
    });
    expect(expected).not.toBe(0);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __scrolls: number[] }).__scrolls)).toEqual([expected]);
    // Das Tippen geht weiter in die Lücke.
    await page.keyboard.type('er');
    await expect(page.getByTestId('gap')).toContainText('over');
  });
});
