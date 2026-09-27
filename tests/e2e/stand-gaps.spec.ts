import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen } from './fixtures';
import { typeInGap } from './learnHelpers';
import { openModule } from './inputHelpers';
import { answerCheckItem, playCheck } from './progressHelpers';
import { dump, planPatch } from './trainerHelpers';
import { WHATS_NEW_KEY, WHATS_NEW_VERSION } from '../../src/features/system/whatsNew';

// Lücken aus dem Abgleich (Kap. 9/14, M7, M10, M13, M18, M20, M21, M22, W5, Kap. 4.1):
// alte Daten sichtbar, Wochen-Check, Wochenstreifen und Niveau-Leiste, Farbthema und beruflicher
// Kontext, „Als Preply-Stunde", Nachtragen-Hinweis auf Heute, Ladepunkt, „Was ist neu" und die
// Lücke über der iPhone-Tastatur. Gegen den Produktions-Build mit eingespieltem Adapter.

test.use({ viewport: { width: 1440, height: 900 } });

type Doc = Record<string, unknown>;
const profileOf = async (page: Page): Promise<Doc> => (await dump(page))['app/profile'] ?? {};

async function openHistory(page: Page): Promise<void> {
  await openOverview(page);
  await page.getByTestId('tab-history').click();
  await expect(page.getByTestId('history')).toBeVisible();
}


test('Kap. 9/14: alte Wochen-Checks und „Letzte Fortschritte" sind im Verlauf sichtbar (nur lesen)', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await openHistory(page);
  const card = page.getByTestId('checks-card');
  await expect(card.getByTestId('check-row')).toHaveCount(2);
  await expect(card.getByTestId('check-row').first()).toContainText('75 %');
  await expect(card.getByTestId('check-row').first()).toContainText('4/5');
  await expect(card.getByTestId('check-last')).toContainText('75 %');
  await expect(card.getByTestId('check-last')).toContainText('67 %');
  const feed = page.getByTestId('legacy-feed');
  await expect(feed.getByTestId('feed-row')).toHaveCount(6);
  await feed.getByRole('button', { name: /ältere Zeilen/ }).click();
  await expect(feed.getByTestId('feed-row')).toHaveCount(8);
  // Keine Punktestände (Kap. 2.3).
  await expect(feed).not.toContainText('XP');
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

  await page.getByTestId('tab-overview').click();
  await screen(page, 'overview');
  await page.getByTestId('tab-history').click();
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
  await page.getByTestId('summary-back').or(page.getByTestId('summary-next')).first().waitFor();
  await page.getByTestId('summary-back').click();
  await expect(page.getByTestId('check-week-done')).toBeVisible();
  await expect(page.getByTestId('check-start')).toHaveCount(0);
  await expect(page.getByTestId('check-row')).toHaveCount(3);
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-done', before.done ?? '');
  await expect(page.getByTestId('today-status')).toHaveAttribute('data-status', before.status ?? '');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('M10: Angebot auf Heute erst nach der Pflicht; Abbruch vor 6 Antworten speichert kein Ergebnis', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': planPatch(0) } } });
  await screen(page, 'today');
  await expect(page.getByTestId('extra')).toBeVisible();
  const offer = page.getByTestId('check-offer');
  await expect(offer).toBeVisible();
  await offer.getByTestId('check-offer-start').click();
  await expect(page.locator('[data-screen="check"]')).toBeVisible();
  await answerCheckItem(page, 1, 12);
  await answerCheckItem(page, 2, 12);
  await page.getByTestId('round-close').click();
  await screen(page, 'overview');
  await expect(page.getByTestId('tab-history')).toHaveAttribute('aria-selected', 'true');
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
  await expect(page.getByTestId('extra')).toBeVisible();
  await expect(page.getByTestId('check-offer')).toHaveCount(0);
  await openHistory(page);
  await expect(page.getByTestId('check-week-done')).toBeVisible();
  await expect(page.getByTestId('check-last')).toContainText('83 %');
});

test('M7: Wochenstreifen (7 Tagesringe, dieselbe Regel wie die Serie) und Niveau-Leiste in der Kopfzeile', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openOverview(page);
  const strip = page.getByTestId('week-strip');
  await expect(strip.getByTestId('week-day')).toHaveCount(7);
  await expect(strip.getByTestId('week-day').last()).toHaveAttribute('data-today', '');
  await expect(strip.getByTestId('week-day').first()).toHaveAttribute('data-day', '2026-09-14');
  // Nie nur Farbe: jeder Ring hat eine Beschriftung für Vorleseprogramme.
  await expect(strip.getByTestId('week-day').first()).toContainText('Montag, 14. September');
  const states = await strip.getByTestId('week-day').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
  expect(states.every((s) => s && ['done', 'rest', 'open'].includes(s))).toBe(true);
  // Serie 12 nach alter Regel: die ganze Woche zählt.
  expect(states).toEqual(['done', 'done', 'done', 'done', 'done', 'done', 'done']);
  await expect(page.getByTestId('week-summary')).toHaveText('7 Tage erledigt');

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
  await page.getByTestId('open-settings').click();
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

test('M18: „Als Preply-Stunde" im Text, an der Szene und im Wochenbericht', async ({ page }) => {
  test.setTimeout(60_000);
  const { errors } = await boot(page, { migrated: true });
  // Lesen
  await openModule(page, 'read');
  await expect(page.getByTestId('as-preply')).toBeVisible();
  await page.getByTestId('unit-close').click();
  await screen(page, 'today');
  // Szene (Einweisung)
  await page.getByTestId('tab-speak').click();
  await page.getByTestId('scene-card').first().click();
  await expect(page.getByTestId('briefing').getByTestId('as-preply')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('briefing')).toHaveCount(0);
  // Wochenbericht
  await page.getByTestId('tab-overview').click();
  await screen(page, 'overview');
  await page.getByTestId('tab-history').click();
  await page.getByTestId('weekly').getByTestId('as-preply').click();
  await expect(page.locator('[data-screen="preply"]')).toBeVisible();
  await expect(page.locator('[data-testid="pp-ctx"] [data-value="about"]')).toHaveAttribute('aria-checked', 'true');
  expect(errors).toEqual([]);
});

test('M18: vom Regelblatt zu „Vorbereiten" mit Anlass „Zu: Passiv"', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await page.getByTestId('hub-grammar').click();
  await page.locator('[data-testid="topic"][data-topic="passive"]').click();
  const sheet = page.getByTestId('rule-sheet');
  await expect(sheet).toBeVisible();
  await sheet.getByTestId('as-preply').click();
  await expect(page.locator('[data-screen="preply"]')).toBeVisible();
  await expect(page.getByTestId('rule-sheet')).toHaveCount(0);
  const about = page.locator('[data-testid="pp-ctx"] [data-value="about"]');
  await expect(about).toHaveAttribute('aria-checked', 'true');
  await expect(about).toContainText('Passiv');
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

test('M13: Ladepunkt am Reiter, solange eine KI-Korrektur im Hintergrund läuft', async ({ page }) => {
  test.setTimeout(60_000);
  await boot(page, { migrated: true, fake: { sampleDelayMs: 1500 } });
  await openModule(page, 'write');
  await expect(page.getByTestId('tab-busy')).toHaveCount(0);
  await page
    .getByTestId('draft')
    .fill('Dear Mr. Walker, thank you for your patience. Unfortunately the new scanning feature will be released three weeks later than planned. It depends of the final tests with your data. I will summarise the results for you next week and I look forward to hear from you soon.');
  await expect(page.getByTestId('submit')).toBeEnabled();
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('ai-phase')).toBeVisible();
  await page.getByTestId('unit-close').click();
  const dot = page.getByTestId('tab-learn').getByTestId('tab-busy');
  await expect(dot).toBeVisible();
  await expect(page.getByTestId('tab-learn')).toContainText('Claude korrigiert gerade im Hintergrund');
  await expect(page.getByTestId('ai-task-notice')).toHaveAttribute('data-status', 'done', { timeout: 15_000 });
  await expect(page.getByTestId('tab-busy')).toHaveCount(0);
});

test('M20: „Was ist neu" erscheint einmal nach dem Update, ist schließbar und bleibt dann weg', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, whatsNew: true, fake: { persist: true } });
  await screen(page, 'today');
  const note = page.getByTestId('whats-new');
  await expect(note).toBeVisible();
  // Keine konkurrierende Karte: der Pflichtknopf bleibt der einzige große Knopf.
  await expect(page.getByTestId('start')).toBeVisible();
  await note.getByTestId('whats-new-more').click();
  await expect(note.getByTestId('whats-new-list').locator('li')).toHaveCount(4);
  expect(await layoutProblems(page)).toEqual([]);
  await note.getByTestId('whats-new-close').click();
  await expect(note).toHaveCount(0);
  expect(await page.evaluate((k) => window.localStorage.getItem(k), WHATS_NEW_KEY)).toBe(WHATS_NEW_VERSION);
  await page.reload();
  await screen(page, 'today');
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
      const btn = document.querySelector('[data-testid="exercise"] [data-testid="check"]')!.getBoundingClientRect();
      const gap = document.querySelector('[data-testid="gap"]')!.getBoundingClientRect();
      const top = Math.min(gap.top, btn.top);
      const bottom = Math.max(gap.bottom, btn.bottom);
      vv.dispatchEvent(new Event('resize'));
      if (bottom - top > 300 - 24) return Math.round(top - 12);
      if (bottom > 288) return Math.round(bottom - 288);
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
