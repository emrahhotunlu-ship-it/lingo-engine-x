import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { bootAt, layoutProblems, type Lang, type Theme } from './fixtures';
import { dumpDb } from './diagnoseHelpers';
import { FLAGS, NOW, openReview, reviewPatch, type Doc } from './wochenrueckblickHelpers';

// P50 (Lernplattform 3.0, Wochenrückblick 3.0, K-15): eine große Zahl, neu Feste mit Namen, neu sichere Muster, EINE Karte „Für deinen Lehrer“ (Kapitel-Notiz
// zuerst, dann der Wochentext in reinem Englisch), Fokus für die Woche (wirkt erst ab dem nächsten Plan), Einsatz-Satz. Ohne `sample` fehlt nur Claudes Text.
// Stichtag: Montag 21.09.2026 10:00 (der Rückblick gilt der Woche 14.–20.09., KW 38; die Wahl zählt für KW 39).

async function axe(page: Page): Promise<string[]> {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await page.waitForTimeout(250);
  const res = await new AxeBuilder({ page }).include('[data-testid="weekly-page"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

const profileOf = async (page: Page): Promise<Doc> => (await dumpDb(page))['app/profile'] ?? {};

for (const [label, width, height] of [
  ['Handy 390', 390, 844],
  ['Laptop', 1440, 900],
] as const) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 600 });

    for (const theme of ['dark', 'dim', 'light'] as Theme[]) {
      for (const lang of ['de', 'en'] as Lang[]) {
        test(`Rückblick: Zahl, Namen, Muster, Lehrer, Fokus, Einsatz · axe 0 · ${theme} · ${lang}`, async ({ page }) => {
          const { errors, external } = await openReview(page, { theme, lang });
          await expect(page.getByTestId('wk-big')).toHaveAttribute('data-n', '31');
          await expect(page.getByTestId('wk-big')).toHaveAttribute('data-src', 'vu');
          await expect(page.getByTestId('wk-name')).toHaveCount(4);
          await expect(page.getByTestId('wk-name').filter({ hasText: 'on the same page' })).toHaveAttribute('data-unit', 'chunk');
          await expect(page.getByTestId('wk-pattern')).toHaveCount(1);
          await expect(page.getByTestId('wk-pattern')).toHaveAttribute('data-pat', 'art.definite');
          // EINE Karte für den Lehrer, die erste Zeile ist die Kapitel-Notiz.
          await expect(page.getByTestId('wk-teacher')).toHaveCount(1);
          const textarea = page.getByTestId('wk-teacher').locator('textarea');
          const value = await textarea.inputValue();
          expect(value.split('\n')[0]).toMatch(/^This month I'm working on /);
          expect(value).toContain('This week I worked on');
          expect(value).toContain('New in my active vocabulary:');
          expect(value).not.toMatch(/[äöüÄÖÜß]|verfehl|!/i);
          await expect(page.getByTestId('wk-focus-opt')).toHaveCount(3);
          await expect(page.getByTestId('wk-use')).toBeVisible();
          expect(await layoutProblems(page)).toEqual([]);
          expect(await axe(page)).toEqual([]);
          expect(errors).toEqual([]);
          expect(external).toEqual([]);
        });
      }
    }
  });
}

test.describe('Handy 390: Verhalten', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Fokus wählen: gespeichert in app/profile.wf für KW 39, der gespeicherte Plan von heute bleibt unverändert; zurück auf „Die App entscheidet“', async ({ page }) => {
    await openReview(page);
    // Der Plan von heute wird beim Start gespeichert; erst danach ist „vorher“ der eingefrorene Stand.
    await expect.poll(async () => ((await profileOf(page)).plan as { d?: string } | undefined)?.d).toBe('2026-09-21');
    await page.waitForTimeout(800);
    const before = await profileOf(page);
    await expect(page.getByTestId('wk-focus-opt').first()).toHaveAttribute('data-value', /.+/);
    const opts = await page.getByTestId('wk-focus-opt').evaluateAll((els) => els.map((e) => e.getAttribute('data-value') ?? ''));
    expect(opts.at(-1)).toBe('');
    const target = opts[0] as string;
    await page.getByTestId('wk-focus-opt').first().click();
    await expect(page.getByTestId('wk-focus-status')).toHaveAttribute('data-state', 'saved');
    await expect(page.getByTestId('wk-focus-opt').first()).toHaveAttribute('data-on', '1');
    const after = await profileOf(page);
    const wf = after.wf as Array<{ w: string; a: string; t: number }>;
    expect(wf).toHaveLength(1);
    expect(wf[0]).toMatchObject({ w: '2026-W39', a: target });
    expect(wf[0]?.t).toBeGreaterThan(0);
    // Nur `wf` kam dazu: der gespeicherte Plan von heute ist unverändert (Eintrag für Eintrag gleich), kein anderes Feld ist neu.
    expect(after.plan).toEqual(before.plan);
    expect(Object.keys(after).sort()).toEqual([...Object.keys(before), 'wf'].sort());
    // Zurück auf „Die App entscheidet“.
    await page.getByTestId('wk-focus-opt').last().click();
    await expect(page.getByTestId('wk-focus-opt').last()).toHaveAttribute('data-on', '1');
    await expect.poll(async () => ((await profileOf(page)).wf as Array<{ a: string }>)[0]?.a).toBe('');
    expect(((await profileOf(page)).wf as unknown[]).length).toBe(1);
  });

  test('Ohne sample: alles außer Claudes Text ist da, keine KI-Anfrage', async ({ page }) => {
    await openReview(page, { fake: { capabilities: { sample: false } } });
    await expect(page.getByTestId('wk-big')).toBeVisible();
    await expect(page.getByTestId('wk-teacher')).toBeVisible();
    await expect(page.getByTestId('wk-focus')).toBeVisible();
    await expect(page.getByTestId('wk-use')).toBeVisible();
    await expect(page.getByTestId('wk-claude')).toHaveCount(0);
    const calls = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: unknown[] } }).__LINGO_FAKE__.sampleCalls.length);
    expect(calls).toBe(0);
  });

  test('Mit sample: Claudes Text einmal, in der Karte; „Für deinen Lehrer“ bleibt eine einzige Karte', async ({ page }) => {
    await openReview(page);
    await expect(page.getByTestId('weekly-text')).toBeVisible();
    await expect(page.getByTestId('wk-claude')).toHaveCount(1);
    await expect(page.getByTestId('wk-teacher')).toHaveCount(1);
    await expect(page.getByText('Für deinen Lehrer')).toHaveCount(1);
    const n = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string | null }> } }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'weekly-report').length);
    expect(n).toBe(1);
  });

  test('Das Wort „verfehlt“ und Ausrufezeichen kommen auf der ganzen Seite nie vor (DE und EN)', async ({ page }) => {
    for (const lang of ['de', 'en'] as Lang[]) {
      await openReview(page, { lang });
      const text = await page.getByTestId('weekly-page').innerText();
      const area = await page.getByTestId('wk-teacher').locator('textarea').inputValue();
      expect(`${text}\n${area}`).not.toMatch(/verfehl|!/i);
      await page.reload();
    }
  });

  test('negative Zahl nach einer Pause: „−4“ mit ruhigem Satz; ohne Verlauf die Zahl der neu Festen; ohne alles ein ruhiger Leersatz', async ({ page }) => {
    await openReview(page, { patch: { 'app/profile': { history: [{ d: '2026-09-12', vu: 100 }, { d: '2026-09-19', vu: 96 }] } } });
    await expect(page.getByTestId('wk-big')).toHaveAttribute('data-n', '-4');
    await expect(page.getByTestId('wk3')).toContainText('Nach einer Pause');
    const second = await page.context().newPage();
    await second.setViewportSize({ width: 390, height: 844 });
    await openReview(second, { patch: { 'app/profile': { history: [] } } });
    await expect(second.getByTestId('wk-big')).toHaveAttribute('data-src', 'ff');
    await expect(second.getByTestId('wk-big')).toHaveAttribute('data-n', '4');
    const third = await page.context().newPage();
    await third.setViewportSize({ width: 390, height: 844 });
    await openReview(third, { bare: true, fake: { seed: 'empty' } });
    await expect(third.getByTestId('wk-big')).toHaveCount(0);
    await expect(third.getByTestId('wk-empty')).toBeVisible();
  });

  test('Fortschritt › Rückblick hat die Zeile „Wochenrückblick“, die die Seite öffnet; ohne Schalter bleibt der alte Bericht', async ({ page }) => {
    await bootAt(page, { name: 'overview' }, { now: NOW, localStorage: FLAGS, fake: { patch: reviewPatch() } });
    await page.getByTestId('tab-review').click();
    await page.getByTestId('wk-entry').click();
    await expect(page.getByTestId('wk3')).toBeVisible();
    const off = await page.context().newPage();
    await off.setViewportSize({ width: 390, height: 844 });
    await bootAt(off, { name: 'weekly' }, { now: NOW, localStorage: { 'lx:flags': '{"weekly3":false}' }, fake: { patch: reviewPatch() } });
    await expect(off.getByTestId('weekly')).toBeVisible();
    await expect(off.getByTestId('wk3')).toHaveCount(0);
  });

  test('Montag auf Heute: das Band führt in den neuen Rückblick', async ({ page }) => {
    await bootAt(page, { name: 'today' }, { now: NOW, localStorage: FLAGS, fake: { patch: reviewPatch() } });
    await expect(page.getByTestId('weekly-band')).toBeVisible();
    await page.getByTestId('weekly-band-open').click();
    await expect(page.getByTestId('wk3')).toHaveAttribute('data-state', 'ready');
  });
});
