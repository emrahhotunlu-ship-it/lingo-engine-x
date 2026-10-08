import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen, type BootOptions } from './fixtures';
import { WED, WED_9, donePatch } from './c1CheckHelpers';
import { dump } from './trainerHelpers';

// P46 (Lernplattform 3.0, KI-Tutor T4): Satz-Klinik und „Mein Arbeitsalltag“. Die Testlaufzeit antwortet fest (`canned/lp3/p46.ts`). Geprüft: genau die erlaubten
// Aufrufe (ein Aufruf, Neuversuch nur bei Schemaverletzung), Ergebnis ohne Querscrollen, Fehlersatz erst ab morgen, K7-Eintrag (nicht bei Einfügen),
// `out/<Monat>`, `ctx` unverändert, `ctx2` gespeichert, Wochenkarte nur am Handy und einmal, ohne Claude keine Kachel.

type Doc = Record<string, unknown>;
type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const FLAG = { 'lx:flags': JSON.stringify({ tutor: { clinic: true } }) };
const SENTENCE = 'We discussed about the budget yesterday.';
const AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'sentence-clinic').map((c) => `${c.id}:${c.tier}`));

async function start(page: Page, o: { touch?: boolean; theme?: BootOptions['theme']; lang?: BootOptions['lang']; flag?: boolean; fake?: BootOptions['fake']; now?: string; ls?: Record<string, string> } = {}): Promise<{ errors: string[]; external: string[] }> {
  const booted = await boot(page, {
    migrated: true,
    ...(o.now ? { now: o.now } : {}),
    ...(o.theme ? { theme: o.theme } : {}),
    ...(o.lang ? { lang: o.lang } : {}),
    ...(o.fake !== undefined ? { fake: o.fake } : {}),
    localStorage: { ...(o.flag === false ? {} : FLAG), 'lx:input': o.touch ? 'touch' : 'keys', ...(o.ls ?? {}) },
  });
  await screen(page, 'today');
  return booted;
}

async function openClinic(page: Page): Promise<void> {
  await openTab(page, 'apply');
  await page.getByTestId('hub-clinic').click();
  await expect(page.getByTestId('cl-flow')).toBeVisible();
}

async function check(page: Page, sentence: string): Promise<void> {
  await page.getByTestId('cl-input').fill(sentence);
  await page.getByTestId('cl-go').click();
}

const repairs = async (page: Page): Promise<Doc[]> => (((await dump(page))['app/repair'] as { items?: Doc[] } | undefined)?.items ?? []).filter((r) => r.src === 'clinic');
const prod = async (page: Page): Promise<Doc[]> => ((await dump(page))['app/c1'] as { prod?: Doc[] } | undefined)?.prod ?? [];

test.describe('Handy 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('ein Satz: genau ein Aufruf default; Ergebnis mit Urteil, Stelle, Grund, Muster, Fassungen; kein Querscrollen; axe 0 (hell)', async ({ page }) => {
    const { errors } = await start(page, { touch: true, theme: 'light' });
    await openClinic(page);
    expect(await layoutProblems(page)).toEqual([]);
    await expect(page.getByTestId('cl-go')).toBeDisabled();
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-result')).toBeVisible();
    expect(await calls(page)).toEqual(['sentence-clinic:default']);
    await expect(page.getByTestId('cl-verdict')).toHaveText('Fast richtig');
    await expect(page.getByTestId('cl-mark-0')).toHaveText('discussed about');
    await expect(page.getByTestId('cl-edit-why')).toContainText('kein „about“');
    await expect(page.getByTestId('cl-edit-pat')).toBeVisible();
    await expect(page.getByTestId('cl-fixed')).toContainText('We discussed the budget yesterday.');
    await expect(page.getByTestId('cl-mark')).toContainText('von Claude');
    await expect(page.getByTestId('ai-report')).toBeVisible();
    await page.getByTestId('cl-better').click();
    await expect(page.getByTestId('cl-better-text')).toBeVisible();
    await expect(page.getByTestId('cl-repairs')).toContainText('Ein Fehlersatz kommt morgen');
    await expect(page.getByTestId('cl-counted')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.waitForTimeout(500);
    expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Daten: Fehlersatz erst ab morgen, K7-Eintrag, out/<Monat>; ctx bleibt unverändert', async ({ page }) => {
    await start(page, { touch: true });
    const before = (await dump(page))['app/profile']?.ctx;
    await openClinic(page);
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-repairs')).toBeVisible();
    const r = await repairs(page);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ wrong: SENTENCE, right: 'We discussed the budget yesterday.', pat: 'prp.no-prep' });
    // Fällig erst nach dem Ende des heutigen Lerntags (Stichtag 20.09., 21:00 → ab 21.09., 04:00).
    expect(r[0]?.due as number).toBeGreaterThan(Date.parse('2026-09-21T04:00:00+02:00') - 1);
    expect(await prod(page)).toMatchObject([{ d: '2026-09-20', s: 'clinic', w: 6, e: 1 }]);
    expect((await prod(page))[0]?.id).toMatch(/^clinic-/);
    const out = (await dump(page))['out/2026-09'] as { items?: Doc[] } | undefined;
    const item = out?.items?.find((i) => i.k === 'clinic');
    expect(item).toMatchObject({ d: '2026-09-20', ok: false, text: SENTENCE });
    expect((await dump(page))['app/profile']?.ctx).toBe(before);
    expect((await dump(page))['app/profile']).not.toHaveProperty('ctx2');
  });

  test('Überarbeitung: ein ähnlicher Satz in derselben Sitzung liefert Ergebnis und Fehlersatz, aber keinen zweiten K7-Eintrag (M3)', async ({ page }) => {
    await start(page, { touch: true });
    await openClinic(page);
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-counted')).toBeVisible();
    await page.getByTestId('cl-again').click();
    await check(page, 'We discussed about the budget yesterday afternoon.');
    await expect(page.getByTestId('cl-result')).toBeVisible();
    await expect(page.getByTestId('cl-revision')).toBeVisible();
    await expect(page.getByTestId('cl-counted')).toHaveCount(0);
    expect(await prod(page)).toHaveLength(1);
    await page.getByTestId('cl-again').click();
    await check(page, 'We should align on the revised timeline before Friday.');
    await expect(page.getByTestId('cl-nothing')).toBeVisible();
    await expect(page.getByTestId('cl-revision')).toHaveCount(0);
    // Dritter, anderer Satz in derselben Woche: Wochendeckel, kein zweiter Eintrag, ehrlicher Hinweis statt „gezählt“.
    await expect(page.getByTestId('cl-weekdone')).toBeVisible();
    await expect(page.getByTestId('cl-counted')).toHaveCount(0);
    expect(await prod(page)).toHaveLength(1);
  });

  test('Einfügen: das Ergebnis erscheint, zählt aber nicht für K7 (kein Eintrag in prod)', async ({ page }) => {
    await start(page, { touch: true });
    await openClinic(page);
    await page.getByTestId('cl-input').fill(SENTENCE);
    await page.getByTestId('cl-input').dispatchEvent('paste');
    await page.getByTestId('cl-go').click();
    await expect(page.getByTestId('cl-result')).toBeVisible();
    await expect(page.getByTestId('cl-notcounted')).toBeVisible();
    await expect(page.getByTestId('cl-counted')).toHaveCount(0);
    await expect(page.getByTestId('cl-repairs')).toBeVisible();
    expect(await prod(page)).toEqual([]);
  });

  test('richtiger Satz: „nichts gefunden“, kein Fehlersatz, Eintrag mit 0 Fehlern', async ({ page }) => {
    await start(page, { touch: true });
    await openClinic(page);
    await check(page, 'We should align on the revised timeline before Friday.');
    await expect(page.getByTestId('cl-nothing')).toBeVisible();
    await expect(page.getByTestId('cl-verdict')).toHaveText('Richtig');
    await expect(page.getByTestId('cl-repairs')).toHaveCount(0);
    expect(await repairs(page)).toEqual([]);
    expect(await prod(page)).toMatchObject([{ d: '2026-09-20', s: 'clinic', w: 9, e: 0 }]);
    await expect(page.getByTestId('cl-good')).toBeVisible();
  });

  test('kein JSON: genau ein Aufruf, „Erneut versuchen“ fragt einmal frisch; kein Neuversuch von allein', async ({ page }) => {
    await start(page, { touch: true });
    await openClinic(page);
    await check(page, `zzjson ${SENTENCE}`);
    await expect(page.getByTestId('ai-error')).toBeVisible();
    expect(await calls(page)).toEqual(['sentence-clinic:default']);
    await page.waitForTimeout(400);
    expect(await calls(page)).toHaveLength(1);
    await page.getByTestId('cl-input').fill(SENTENCE);
    await page.getByTestId('ai-retry').click();
    await expect(page.getByTestId('cl-result')).toBeVisible();
    expect(await calls(page)).toHaveLength(2);
  });

  test('Schemafehler: genau zwei Aufrufe (der eine Neuversuch nach A6.3), dann das Ergebnis', async ({ page }) => {
    await start(page, { touch: true });
    await openClinic(page);
    await check(page, `zzschema ${SENTENCE}`);
    await expect(page.getByTestId('cl-result')).toBeVisible();
    expect(await calls(page)).toEqual(['sentence-clinic:default', 'sentence-clinic:default']);
  });

  test('„richtig“ mit Änderungen: ein Neuversuch; erfundene Stelle fällt still weg (kein Neuversuch)', async ({ page }) => {
    await start(page, { touch: true });
    await openClinic(page);
    await check(page, `zzcorrect ${SENTENCE}`);
    await expect(page.getByTestId('cl-result')).toBeVisible();
    expect(await calls(page)).toHaveLength(2);
    await page.getByTestId('cl-again').click();
    await check(page, `zzfake ${SENTENCE}`);
    await expect(page.getByTestId('cl-result')).toBeVisible();
    await expect(page.getByTestId('cl-mark-0')).toBeVisible();
    await expect(page.getByTestId('cl-mark-1')).toHaveCount(0);
    expect(await calls(page)).toHaveLength(3);
  });

  test('Melden: Ergebnis ausgeblendet, Fehlersatz erledigt (nie gelöscht), Aufgabe in app/c1.bad', async ({ page }) => {
    await start(page, { touch: true });
    await openClinic(page);
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-repairs')).toBeVisible();
    await page.getByTestId('ai-report').click();
    await page.getByTestId('report-explain').click();
    await expect(page.getByTestId('cl-reported')).toBeVisible();
    await expect(page.getByTestId('cl-result')).toHaveCount(0);
    await expect.poll(async () => ((await dump(page))['app/c1'] as { bad?: string[] } | undefined)?.bad?.length ?? 0).toBe(1);
    const r = await repairs(page);
    expect(r).toHaveLength(1);
    expect(r[0]?.done).toBe(true);
  });

  test('zu kurz: Hinweis, kein Aufruf; Tageslimit: Hinweis, kein Aufruf', async ({ page }) => {
    await start(page, { touch: true, ls: { 'lx:tutor-day': JSON.stringify({ d: '2026-09-20', n: 20 }) } });
    await openClinic(page);
    await check(page, 'Hello there');
    await expect(page.getByTestId('cl-short')).toBeVisible();
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-limit')).toBeVisible();
    expect(await calls(page)).toEqual([]);
  });

  test('Englisch: Oberfläche und Begründung in der Oberflächensprache', async ({ page }) => {
    await start(page, { touch: true, lang: 'en' });
    await openClinic(page);
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-verdict')).toHaveText('Almost right');
    await expect(page.getByTestId('cl-edit-why')).toContainText('no “about”');
    expect(await layoutProblems(page)).toEqual([]);
  });
});

test.describe('Heute (Handy)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('nach der Pflicht: erst die Karte „Mein Arbeitsalltag“ (einmal), dann einmal je Woche EIN Klinik-Satz; „diese Woche nicht“ gilt für die Woche', async ({ page }) => {
    await boot(page, { migrated: true, now: WED_9, localStorage: { ...FLAG, 'lx:input': 'touch' }, fake: { patch: donePatch(WED) } });
    await screen(page, 'today');
    await expect(page.getByTestId('wp-card')).toBeVisible();
    await expect(page.getByTestId('cl-card')).toHaveCount(0);
    await page.getByTestId('wp-card-later').click();
    await expect(page.getByTestId('wp-card')).toHaveCount(0);
    await expect(page.getByTestId('cl-card')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('cl-card-later').click();
    await expect(page.getByTestId('cl-card')).toHaveCount(0);
    expect(await calls(page)).toEqual([]);
  });

  test('Wochenkarte öffnet die Klinik; nach einem gespeicherten Satz kommt sie diese Woche nicht wieder', async ({ page }) => {
    await boot(page, { migrated: true, now: WED_9, localStorage: { ...FLAG, 'lx:input': 'touch', 'lx:ctx2-card': '1' }, fake: { patch: donePatch(WED) } });
    await screen(page, 'today');
    await page.getByTestId('cl-card-start').click();
    await expect(page.getByTestId('cl-flow')).toBeVisible();
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-repairs')).toBeVisible();
    await page.getByTestId('cl-done').click();
    await expect(page.getByTestId('cl-flow')).toHaveCount(0);
    await expect(page.getByTestId('cl-card')).toHaveCount(0);
  });

  test('Schalter aus: weder Karte noch Kachel; ohne Claude: keine Kachel, keine Karte', async ({ page }) => {
    await boot(page, { migrated: true, now: WED_9, localStorage: { 'lx:input': 'touch', 'lx:flags': JSON.stringify({ tutor: { clinic: false } }) }, fake: { patch: donePatch(WED) } });
    await screen(page, 'today');
    await expect(page.getByTestId('wp-card')).toHaveCount(0);
    await expect(page.getByTestId('cl-card')).toHaveCount(0);
  });

  test('ohne Claude (kein sample): keine Kachel, keine Karte', async ({ page }) => {
    await boot(page, { migrated: true, now: WED_9, localStorage: { ...FLAG, 'lx:input': 'touch' }, fake: { patch: donePatch(WED), capabilities: { sample: false } } });
    await screen(page, 'today');
    await expect(page.getByTestId('wp-card')).toHaveCount(0);
    await expect(page.getByTestId('cl-card')).toHaveCount(0);
    await openTab(page, 'apply');
    await expect(page.getByTestId('hub-clinic')).toHaveCount(0);
  });
});

test.describe('Laptop 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Kachel unter Anwenden, Klinik im Paneel, axe 0 (dunkel); Satz prüfen', async ({ page }) => {
    const { errors, external } = await start(page, { theme: 'dark' });
    await openClinic(page);
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-result')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.waitForTimeout(500);
    expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id)).toEqual([]);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Mein Arbeitsalltag: vorbelegt aus ctx, gespeichert in ctx2, ctx unverändert, Auswahl wirkt auf den Prompt', async ({ page }) => {
    await start(page);
    const ctx = (await dump(page))['app/profile']?.ctx;
    expect(typeof ctx).toBe('string');
    await openClinic(page);
    await page.getByTestId('cl-profile').click();
    await expect(page.getByTestId('work-profile')).toBeVisible();
    await expect(page.getByTestId('wp-role')).not.toHaveValue('');
    await page.getByTestId('wp-role').fill('Sales Director');
    await page.getByTestId('wp-field').fill('document management software');
    await page.getByTestId('wp-who').locator('[data-value="CFO"]').click();
    await page.getByTestId('wp-sit').locator('[data-value="objection"]').click();
    await page.getByTestId('wp-sit-own').fill('contract renewal');
    await page.getByTestId('wp-sit-add').click();
    await page.getByTestId('wp-terms').fill('audit trail, archive\nretention');
    await page.getByTestId('wp-save').click();
    await expect.poll(async () => ((await dump(page))['app/profile']?.ctx2 as Doc | undefined)?.role).toBe('Sales Director');
    const profile = (await dump(page))['app/profile'] as Doc;
    expect(profile.ctx).toBe(ctx);
    expect(profile.ctx2).toMatchObject({ v: 1, role: 'Sales Director', field: 'document management software', who: ['CFO'], sit: ['objection', 'contract renewal'], terms: ['audit trail', 'archive', 'retention'] });
    // Die Zwecke im Satz-Formular kommen jetzt aus dem Profil.
    await page.getByTestId('cl-purpose').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('cl-purpose').locator('[data-value="contract renewal"]')).toBeVisible();
    await page.getByTestId('cl-purpose').locator('[data-value="objection"]').click();
    await check(page, SENTENCE);
    await expect(page.getByTestId('cl-result')).toBeVisible();
    const input = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string | null; input: string }> } }).__LINGO_FAKE__.sampleCalls.find((c) => c.id === 'sentence-clinic')?.input ?? '');
    expect(input).toContain('Sales Director in document management software');
    expect(input).toContain('Purpose: objection');
    expect(input.length).toBeLessThan(8 * 1024);
  });

  test('Einstellungen: Abschnitt „Mein Arbeitsalltag“ (nur mit Schalter und Claude)', async ({ page }) => {
    await start(page);
    await page.getByTestId('open-settings').first().click();
    await expect(page.getByTestId('settings-work-profile')).toBeVisible();
  });
});
