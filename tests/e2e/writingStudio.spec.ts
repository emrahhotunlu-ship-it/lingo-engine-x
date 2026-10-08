import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen, type BootOptions } from './fixtures';
import { WED, WED_9, donePatch } from './c1CheckHelpers';
import { dump } from './trainerHelpers';

// P47 (Lernplattform 3.0, KI-Tutor T6): Schreibwerkstatt am Laptop. Die Testlaufzeit antwortet fest (`canned/lp3/p47.ts`). Geprüft: Editor, Wortzähler, Checkliste,
// genau die erlaubten Aufrufe (ein Aufruf, Neuversuch nur bei Schemaverletzung, bis zu drei Prüfungen je Text), Unterstreichungen, Stelle melden, Fehlersätze
// (`src: 'write'`, ab morgen), K7-Eintrag nur bei der ersten Prüfung und nie bei Einfügen, `out/<Monat>`, Handy nur mit der Karte, ohne Claude keine Kachel.

type Doc = Record<string, unknown>;
type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const FLAG = { 'lx:flags': JSON.stringify({ tutor: { write: true } }) };
const AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const MAIL = `Dear Ms Weber,

thank you for your message. We discussed about the budget yesterday and the team agreed on a first plan. I will tell you the details next week, because we still need more informations from the finance department. In the meantime, please let me know if you have any questions about the timeline or the next steps we have planned.

Best regards
Emrah`;

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.filter((c) => c.id === 'c1-mail').map((c) => `${c.id}:${c.tier}`));

async function start(page: Page, o: { touch?: boolean; theme?: BootOptions['theme']; lang?: BootOptions['lang']; fake?: BootOptions['fake']; ls?: Record<string, string> } = {}): Promise<{ errors: string[]; external: string[] }> {
  const booted = await boot(page, {
    migrated: true,
    ...(o.theme ? { theme: o.theme } : {}),
    ...(o.lang ? { lang: o.lang } : {}),
    ...(o.fake !== undefined ? { fake: o.fake } : {}),
    localStorage: { ...FLAG, 'lx:input': o.touch ? 'touch' : 'keys', ...(o.ls ?? {}) },
  });
  await screen(page, 'today');
  return booted;
}

async function openStudio(page: Page): Promise<void> {
  await openTab(page, 'apply');
  await page.getByTestId('hub-write').click();
  await expect(page.getByTestId('ws-flow')).toBeVisible();
}

async function write(page: Page, text: string): Promise<void> {
  await page.getByTestId('ws-input').fill(text);
}

const writeRepairs = async (page: Page): Promise<Doc[]> => (((await dump(page))['app/repair'] as { items?: Doc[] } | undefined)?.items ?? []).filter((r) => r.src === 'write');
const prod = async (page: Page): Promise<Doc[]> => ((await dump(page))['app/c1'] as { prod?: Doc[] } | undefined)?.prod ?? [];
const mails = async (page: Page): Promise<Doc[]> => ((((await dump(page))['out/2026-09'] as { items?: Doc[] } | undefined)?.items ?? []).filter((i) => i.k === 'c1mail'));

test.describe('Laptop 1440 px', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Aufgabe, Wortzähler, Checkliste lokal abgehakt; ein Aufruf default; Ergebnis mit Unterstreichungen, Grund, Mustern, Fassung; axe 0 und kein Überlaufen', async ({ page }) => {
    const { errors, external } = await start(page, { theme: 'dark' });
    await openStudio(page);
    await expect(page.getByTestId('ws-brief')).toContainText('Empfänger');
    await expect(page.getByTestId('ws-go')).toBeDisabled();
    await write(page, 'Dear Ms Weber, we have been working on it since May. Right now we are testing the workflow and so far everything is on track.');
    await expect(page.getByTestId('ws-count')).toHaveAttribute('data-words', /^2\d$/);
    await expect(page.getByTestId('ws-tooshort')).toBeVisible();
    // Checkliste: nach den Mustern und Wendungen der Situation, lokal beim Tippen abgehakt.
    const sit = (await page.getByTestId('ws-flow').getAttribute('data-situation')) ?? '';
    expect(sit).toMatch(/^ms\d\d$/);
    await write(page, MAIL);
    await expect(page.getByTestId('ws-tooshort')).toHaveCount(0);
    await expect(page.getByTestId('ws-go')).toBeEnabled();
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-result')).toBeVisible();
    expect(await calls(page)).toEqual(['c1-mail:default']);
    await expect(page.getByTestId('ws-summary')).toContainText('Gut gegliedert');
    await expect(page.getByTestId('ws-tone')).toContainText('passt zum Empfänger');
    await expect(page.getByTestId('ws-mark-0')).toHaveText('discussed about');
    await expect(page.getByTestId('ws-mark-0')).toHaveAttribute('data-sev', 'error');
    await expect(page.getByTestId('ws-text').locator('[data-sev="upgrade"]')).toHaveText('tell you');
    await expect(page.getByTestId('cl-edit-why')).toContainText('kein „about“');
    await page.getByTestId('ws-text').locator('[data-sev="upgrade"]').click();
    await expect(page.getByTestId('cl-edit')).toHaveAttribute('data-sev', 'upgrade');
    await expect(page.getByTestId('ws-used')).toBeVisible();
    await page.getByTestId('ws-better').click();
    await expect(page.getByTestId('ws-better-text')).toContainText('Best regards');
    await expect(page.getByTestId('ws-mark')).toContainText('von Claude');
    await expect(page.getByTestId('ws-repairs')).toContainText('2 Fehlersätze');
    await expect(page.getByTestId('ws-counted')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.waitForTimeout(500);
    expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id)).toEqual([]);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Daten: out/<Monat> (c1mail), 2 Fehlersätze src write ab morgen, K7-Eintrag (Wörter, Fehler = Mittel aus Liste und Nachzählung); Stilverbesserung wird nie Fehlersatz; ctx unverändert', async ({ page }) => {
    await start(page);
    const before = (await dump(page))['app/profile']?.ctx;
    await openStudio(page);
    await write(page, MAIL);
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-repairs')).toBeVisible();
    const r = await writeRepairs(page);
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.wrong)).toEqual(expect.arrayContaining(['We discussed about the budget yesterday and the team agreed on a first plan.']));
    expect(r.every((x) => (x.due as number) >= Date.parse('2026-09-21T04:00:00+02:00'))).toBe(true);
    expect(r.some((x) => String(x.right).includes('let you know'))).toBe(false);
    const p = await prod(page);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ d: '2026-09-20', s: 'mail', e: 2 });
    expect(p[0]?.w as number).toBeGreaterThan(55);
    const m = await mails(page);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ k: 'c1mail', d: '2026-09-20', ok: false });
    expect(String(m[0]?.text)).toContain('Dear Ms Weber');
    expect((await dump(page))['app/profile']?.ctx).toBe(before);
  });

  test('Text über 1.800 Zeichen ist nicht absendbar; unter 40 Wörtern zu kurz; kein Aufruf', async ({ page }) => {
    await start(page);
    await openStudio(page);
    await write(page, `${'word '.repeat(400)}`);
    await expect(page.getByTestId('ws-toolong')).toBeVisible();
    await expect(page.getByTestId('ws-go')).toBeDisabled();
    await write(page, 'Dear Ms Weber, short note.');
    await expect(page.getByTestId('ws-go')).toBeDisabled();
    expect(await calls(page)).toEqual([]);
  });

  test('Einfügen: Ergebnis und Fehlersätze ja, K7-Eintrag nein', async ({ page }) => {
    await start(page);
    await openStudio(page);
    await write(page, MAIL);
    await page.getByTestId('ws-input').dispatchEvent('paste');
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-result')).toBeVisible();
    await expect(page.getByTestId('ws-notcounted')).toBeVisible();
    await expect(page.getByTestId('ws-counted')).toHaveCount(0);
    await expect(page.getByTestId('ws-repairs')).toBeVisible();
    expect(await prod(page)).toEqual([]);
  });

  test('Überarbeiten: bis zu drei Prüfungen je Text, dieselbe Mail im Verlauf, nur die erste zählt für K7 und legt Fehlersätze an', async ({ page }) => {
    await start(page);
    await openStudio(page);
    await write(page, MAIL);
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-result')).toHaveAttribute('data-check', '1');
    await expect(page.getByTestId('ws-left')).toContainText('2');
    await page.getByTestId('ws-revise').click();
    await expect(page.getByTestId('ws-input')).toHaveValue(MAIL);
    await write(page, MAIL.replace('discussed about', 'discussed'));
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-result')).toHaveAttribute('data-check', '2');
    await expect(page.getByTestId('ws-revision')).toBeVisible();
    await expect(page.getByTestId('ws-counted')).toHaveCount(0);
    await page.getByTestId('ws-revise').click();
    await write(page, MAIL.replace('discussed about', 'discussed').replace('informations', 'information'));
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-result')).toHaveAttribute('data-check', '3');
    await expect(page.getByTestId('ws-revise')).toHaveCount(0);
    expect(await calls(page)).toHaveLength(3);
    expect(await prod(page)).toHaveLength(1);
    expect(await writeRepairs(page)).toHaveLength(2);
    expect(await mails(page)).toHaveLength(1);
    expect(String((await mails(page))[0]?.text)).not.toContain('informations');
    await page.getByTestId('ws-new').click();
    await expect(page.getByTestId('ws-input')).toHaveValue('');
  });

  test('Stelle melden: die Stelle verschwindet, der Fehlersatz dazu wird erledigt (nie gelöscht), Eintrag in app/c1.bad', async ({ page }) => {
    await start(page);
    await openStudio(page);
    await write(page, MAIL);
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-repairs')).toBeVisible();
    await page.getByTestId('cl-edit-report').click();
    await page.getByTestId('report-explain').click();
    await expect(page.getByTestId('ws-text').locator('[data-sev="error"]')).toHaveCount(1);
    await expect.poll(async () => ((await dump(page))['app/c1'] as { bad?: string[] } | undefined)?.bad?.length ?? 0).toBe(1);
    await expect.poll(async () => (await writeRepairs(page)).filter((r) => r.done === true).length).toBe(1);
    expect(await writeRepairs(page)).toHaveLength(2);
  });

  test('Fehlerfälle: kein JSON (1 Aufruf, Erneut versuchen fragt frisch), Schemafehler (2 Aufrufe), unplausible Nachzählung zählt nur die Liste', async ({ page }) => {
    await start(page);
    await openStudio(page);
    await write(page, `zzjson ${MAIL}`);
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ai-error')).toBeVisible();
    expect(await calls(page)).toEqual(['c1-mail:default']);
    await page.waitForTimeout(400);
    expect(await calls(page)).toHaveLength(1);
    await write(page, `zzschema zzcount ${MAIL}`);
    await page.getByTestId('ai-retry').click();
    await expect(page.getByTestId('ws-result')).toBeVisible();
    expect(await calls(page)).toHaveLength(3);
    // zzcount: Nachzählung 17, die Liste hat 2 belegte Fehler → nur die Liste zählt.
    expect((await prod(page))[0]).toMatchObject({ e: 2 });
  });

  test('Erfundene Stellen und Zitate fallen still weg (kein Neuversuch); Tageslimit: Hinweis, kein Aufruf', async ({ page }) => {
    await start(page);
    await openStudio(page);
    await write(page, `zzfake zzused ${MAIL}`);
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-result')).toBeVisible();
    await expect(page.getByTestId('ws-text').locator('[data-sev]')).toHaveCount(3);
    expect(await calls(page)).toHaveLength(1);
    await page.getByTestId('ws-used').locator('[data-state="ok"]').first().waitFor();
  });

  test('Tageslimit: Hinweis, kein Aufruf', async ({ page }) => {
    await start(page, { ls: { 'lx:tutor-day': JSON.stringify({ d: '2026-09-20', n: 20 }) } });
    await openStudio(page);
    await write(page, MAIL);
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-limit')).toBeVisible();
    expect(await calls(page)).toEqual([]);
  });

  test('„Andere Situation“ blättert; Englisch: Oberfläche in der Oberflächensprache; hell axe 0', async ({ page }) => {
    await start(page, { lang: 'en', theme: 'light' });
    await openStudio(page);
    const a = await page.getByTestId('ws-flow').getAttribute('data-situation');
    await page.getByTestId('ws-other').click();
    expect(await page.getByTestId('ws-flow').getAttribute('data-situation')).not.toBe(a);
    await write(page, MAIL);
    await page.getByTestId('ws-go').click();
    await expect(page.getByTestId('ws-tone')).toContainText('suits the reader');
    await expect(page.getByTestId('cl-edit-why')).toContainText('no “about”');
    expect(await layoutProblems(page)).toEqual([]);
    await page.waitForTimeout(500);
    expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id)).toEqual([]);
  });

  test('Heute am Laptop: nach der Pflicht und der Einrichtungskarte EIN Wochenvorschlag; „diese Woche nicht“ gilt für die Woche; öffnet die Schreibwerkstatt', async ({ page }) => {
    await boot(page, { migrated: true, now: WED_9, localStorage: { ...FLAG, 'lx:input': 'keys' }, fake: { patch: donePatch(WED) } });
    await screen(page, 'today');
    await expect(page.getByTestId('wp-card')).toBeVisible();
    await expect(page.getByTestId('ws-card')).toHaveCount(0);
    await page.getByTestId('wp-card-later').click();
    await expect(page.getByTestId('ws-card')).toBeVisible();
    await expect(page.getByTestId('cl-card')).toHaveCount(0);
    await page.getByTestId('ws-card-start').click();
    await expect(page.getByTestId('ws-flow')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByTestId('ws-card-later').click();
    await expect(page.getByTestId('ws-card')).toHaveCount(0);
  });

  test('Schalter aus oder ohne Claude: keine Kachel, keine Karte', async ({ page }) => {
    await start(page, { ls: { 'lx:flags': JSON.stringify({ tutor: { write: false } }) } });
    await openTab(page, 'apply');
    await expect(page.getByTestId('hub-write')).toHaveCount(0);
  });

  test('ohne Claude (kein sample): keine Kachel', async ({ page }) => {
    await start(page, { fake: { capabilities: { sample: false } } });
    await openTab(page, 'apply');
    await expect(page.getByTestId('hub-write')).toHaveCount(0);
    await expect(page.getByTestId('ws-phone-card')).toHaveCount(0);
  });
});

test.describe('Handy 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Anwenden zeigt nur die Karte „Am Laptop schreiben“: kein Editor, keine Kachel, kein Wochenvorschlag auf Heute', async ({ page }) => {
    await boot(page, { migrated: true, now: WED_9, localStorage: { ...FLAG, 'lx:input': 'touch', 'lx:ctx2-card': '1' }, fake: { patch: donePatch(WED) } });
    await screen(page, 'today');
    await expect(page.getByTestId('ws-card')).toHaveCount(0);
    await openTab(page, 'apply');
    await expect(page.getByTestId('ws-phone-card')).toBeVisible();
    await expect(page.getByTestId('hub-write')).toHaveCount(0);
    await expect(page.getByTestId('ws-input')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);
    await page.waitForTimeout(500);
    expect((await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id)).toEqual([]);
  });
});
