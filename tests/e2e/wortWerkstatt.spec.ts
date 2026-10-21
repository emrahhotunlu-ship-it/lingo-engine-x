import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openSettings, openTab, screen } from './fixtures';
import { RECALLED, TYPE_MODE, answerCurrent, dump, planPatch } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Wort-Lernen 2, Teil 2 (21.10.2026): Wort-Werkstatt im Trainer, Vorlesen neuer Wörter und „Sag es einmal laut“, Übung „Sag es“ (Diktiertaste),
// Berufsprofil in den Einstellungen, freiwillige Angebote „Abend-Check“ und „Sag es selbst“ im Reiter Wörter. Handy 390 px und Laptop 1440 px, mit axe.

type Doc = Record<string, unknown>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;
const OUT = process.env.WW_SHOTS ?? '/tmp/claude-0/-home-user-lingo-engine-x/6af5333d-eebb-5460-9a49-5f84302bde29/scratchpad/wort-werkstatt';
mkdirSync(OUT, { recursive: true });

const at = (d: string, h = 10): number => Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00+02:00`);
const fail = (d: string, x: string, v?: string): Doc => ({ t: at(d), m: x, g: 1, x, ...(v ? { v } : {}) });
const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken]);

async function axe(page: Page): Promise<void> {
  await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null))));
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

/** Nur diese Karten (alles andere aus dem Seed entfernt), Standard „Tippen“. */
function only(cards: Record<string, Doc>, profile: Doc = planPatch(1)): Record<string, Doc | null> {
  return { ...ankiPatch(0).patch, ...TYPE_MODE, 'app/profile': profile, ...cards };
}

/** „to avoid“: hakt (drei freie Fehlversuche an zwei Lerntagen, zuletzt „prevent“ getippt), lange fällig. */
const STRUGGLING: Doc = {
  ...SEED['vocab/avoid'],
  state: 'review',
  stage: 3,
  S: 1,
  D: 8,
  due: 1_690_000_000_000,
  last: at('2026-09-19'),
  reps: 6,
  lapses: 3,
  na: 9,
  fsrs: undefined,
  hist: [fail('2026-09-18', 'cloze'), fail('2026-09-19', 'type', 'prevent'), fail('2026-09-19', 'cloze_hint')],
};

for (const vp of [
  { name: 'Handy', w: 390, h: 844, mobile: true },
  { name: 'Laptop', w: 1440, h: 900, mobile: false },
] as const) {
  test.describe(`${vp.name} ${vp.w}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h }, ...(vp.mobile ? { isMobile: true, hasTouch: true } : {}) });

    test('Wort-Werkstatt: Diagnose, Deutsch denkt → Englisch sagt, eigene Merkhilfe zuerst, Vorschläge, dann ein Abruf mit Ruhe', async ({ page }) => {
      const { errors, external } = await boot(page, { migrated: true, fake: { patch: only({ 'vocab/avoid': STRUGGLING }) } });
      await screen(page, 'today');
      await page.getByTestId('start').click();
      await screen(page, 'trainer');
      const wk = page.getByTestId('werkstatt');
      await expect(wk).toBeVisible();
      await expect(page.getByTestId('werkstatt-row-diag')).toBeVisible();
      await expect(page.getByTestId('werkstatt-diag')).not.toBeEmpty();
      expect(await layoutProblems(page)).toEqual([]);
      await axe(page);
      await page.screenshot({ path: `${OUT}/ww-01-werkstatt-${vp.w}.png`, fullPage: true });

      // Eigene Merkhilfe: gespeichert über den einen Schreibweg (`mnemo.own = 1`), danach steht sie an erster Stelle.
      await page.getByTestId('werkstatt-memo-input').fill('a-VOID: ins Leere ausweichen');
      await page.getByTestId('werkstatt-memo-save').click();
      await expect(page.getByTestId('werkstatt-memo-own')).toContainText('a-VOID');
      await expect.poll(async () => ((await dump(page))['vocab/avoid']?.mnemo as Doc | undefined)?.own).toBe(1);

      // Vorschläge von Claude (ein gebündelter Aufruf auf Knopfdruck, ohne vorherige Zustimmung nie automatisch).
      await page.getByTestId('werkstatt-memo-ask').click();
      await expect(page.getByTestId('werkstatt-memo-ideas')).toHaveAttribute('data-phase', 'done');
      await expect(page.getByTestId('werkstatt-memo-option-0')).toBeVisible();
      await page.screenshot({ path: `${OUT}/ww-02-werkstatt-merkhilfe-${vp.w}.png`, fullPage: true });

      // Abruf: genau eine gewertete Antwort, danach `wk {n: 1}` und Fälligkeit 2–3 Tage später.
      await page.getByTestId('werkstatt-recall').click();
      await expect(page.getByTestId('exercise')).toBeVisible();
      await expect(page.getByTestId('exercise')).not.toHaveAttribute('data-ex', 'flip');
      await answerCurrent(page);
      await expect.poll(async () => ((await dump(page))['vocab/avoid']?.wk as Doc | undefined)?.n).toBe(1);
      const due = Number((await dump(page))['vocab/avoid']?.due);
      expect(due).toBeGreaterThanOrEqual(at('2026-09-22', 0));
      expect(due).toBeLessThan(at('2026-09-24', 6));
      expect(errors).toEqual([]);
      expect(external).toEqual([]);
    });

    test('Neues Wort: einmal vorgelesen nach der Berührung, „Sag es einmal laut“ freiwillig und unbewertet', async ({ page }) => {
      const fresh: Doc = { word: 'to streamline', de: 'vereinfachen, straffen', def: 'to make a process simpler and more efficient', ex: 'We want to [streamline] the approval process.', pos: 'verb', state: 'new', stage: 0, S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, src: 'lookup', added: '2026-09-20' };
      const { errors } = await boot(page, { migrated: true, fake: { patch: only({ 'vocab/streamline': fresh }, { ...planPatch(1), newPerDay: 2 }) } });
      await screen(page, 'today');
      await page.getByTestId('start').click();
      await page.getByTestId('intro-ask-dontknow').click();
      await page.getByTestId('intro-ask-next').click();
      await expect(page.getByTestId('intro')).toBeVisible();
      await expect.poll(async () => (await spoken(page)).join(' | ')).toContain('to streamline. We want to streamline the approval process.');
      const btn = page.getByTestId('intro-say-aloud');
      await expect(btn).toHaveAttribute('aria-pressed', 'false');
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      // Unbewertet: Der Knopf schreibt nichts in die Karte.
      expect(((await dump(page))['vocab/streamline'] as Doc).state).toBe('new');
      expect(await layoutProblems(page)).toEqual([]);
      await axe(page);
      await page.screenshot({ path: `${OUT}/ww-03-einfuehrung-laut-${vp.w}.png`, fullPage: true });
      expect(errors).toEqual([]);
    });

    test('Neue Wörter vorlesen lässt sich in den Einstellungen abschalten', async ({ page }) => {
      const fresh: Doc = { word: 'to streamline', de: 'vereinfachen', def: 'to make a process simpler', ex: 'We want to [streamline] the approval process.', pos: 'verb', state: 'new', stage: 0, S: 0, D: 5, due: 0, last: 0, reps: 0, lapses: 0, src: 'lookup', added: '2026-09-20' };
      await boot(page, { migrated: true, localStorage: { 'lx:speak-new': '0' }, fake: { patch: only({ 'vocab/streamline': fresh }, { ...planPatch(1), newPerDay: 2 }) } });
      await screen(page, 'today');
      await page.getByTestId('start').click();
      await page.getByTestId('intro-ask-dontknow').click();
      await page.getByTestId('intro-ask-next').click();
      await expect(page.getByTestId('intro')).toBeVisible();
      await page.waitForTimeout(400);
      expect((await spoken(page)).join(' | ')).not.toContain('approval process');
    });

    test('„Sag es“: deutsche Absicht, eigener Satz, Zielwort geprüft, sonst ehrlich ungeprüft', async ({ page }) => {
      const sayIt: Doc = { ...SEED['vocab/avoid'], state: 'learning', stage: 4, S: 1, D: 5, due: 1_690_000_000_000, last: 1_689_900_000_000, reps: 3, lapses: 0, na: 9, fsrs: undefined, hist: RECALLED, intro: '2023-07-01', xs: { say_it: { c: 0, w: 6 }, cloze: { c: 6, w: 0 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 }, produce: { c: 6, w: 0 }, dictation: { c: 6, w: 0 } } };
      const { errors } = await boot(page, { migrated: true, fake: { patch: only({ 'vocab/avoid': sayIt }) } });
      await screen(page, 'today');
      await page.getByTestId('start').click();
      await screen(page, 'trainer');
      await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'say_it');
      await expect(page.getByTestId('say-it-intent')).toContainText('vermeiden');
      await expect(page.getByTestId('say-it-intent')).toHaveAttribute('lang', 'de');
      expect(await layoutProblems(page)).toEqual([]);
      await axe(page);
      await page.screenshot({ path: `${OUT}/ww-04-sag-es-${vp.w}.png`, fullPage: true });
      await page.getByTestId('say-it-input').click();
      await page.getByTestId('say-it-input').fill('We try to avoid long meetings on Fridays.');
      await page.getByTestId('check').click();
      await expect(page.getByTestId('verdict')).toBeVisible();
      await expect(page.getByTestId('verdict')).not.toHaveAttribute('data-verdict', 'unchecked');
      await page.screenshot({ path: `${OUT}/ww-05-sag-es-ergebnis-${vp.w}.png`, fullPage: true });
      await axe(page);
      expect(errors).toEqual([]);
    });

    test('Berufsprofil in den Einstellungen: Branche, Rolle, bis zu 5 Situationen, ein Schreibweg', async ({ page }) => {
      const { errors } = await boot(page, { migrated: true });
      await screen(page, 'today');
      await openSettings(page);
      const wp = page.getByTestId('settings-work-profile');
      await wp.scrollIntoViewIfNeeded();
      await page.getByTestId('wp-role').fill('Account manager');
      await page.getByTestId('wp-field').fill('B2B software');
      const sit = page.getByTestId('wp-sit');
      for (const v of ['negotiation', 'objection', 'status update', 'client email', 'presentation']) {
        const chip = sit.locator(`button[data-value="${v}"]`);
        if ((await chip.getAttribute('aria-pressed')) !== 'true') await chip.click();
      }
      // Höchstens 5: die sechste Situation lässt sich nicht mehr wählen.
      const sixth = sit.locator('button[data-value="small talk"]');
      await sixth.click();
      await expect(sixth).not.toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('wp-save').click();
      await expect.poll(async () => ((await dump(page))['app/profile']?.ctx2 as Doc | undefined)?.role).toBe('Account manager');
      const ctx2 = (await dump(page))['app/profile']?.ctx2 as Doc;
      expect(ctx2.field).toBe('B2B software');
      expect((ctx2.sit as string[]).length).toBe(5);
      await page.screenshot({ path: `${OUT}/ww-06-berufsprofil-${vp.w}.png` });
      const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Angebote im Reiter Wörter: Abend-Check (heute eingeführt, nur freier Abruf) und „Sag es selbst“ (Claude prüft, nichts gespeichert)', async ({ page }) => {
      const learned = (word: string, de: string, intro: string, i: number): Doc => ({ word, de, def: `to ${word}`, ex: `We [${word}] it every week.`, pos: 'verb', state: 'learning', stage: 1, S: 1, D: 5, due: at('2026-09-22'), last: at(intro, 9), reps: 1, lapses: 0, src: 'lookup', added: intro, intro, order: i, hist: [] });
      const cards = {
        'vocab/settle': learned('settle', 'begleichen', '2026-09-20', 1),
        'vocab/verify': learned('verify', 'überprüfen', '2026-09-20', 2),
        'vocab/submit': learned('submit', 'einreichen', '2026-09-19', 3),
        'vocab/obtain': learned('obtain', 'erhalten', '2026-09-18', 4),
      };
      const profile = { ...planPatch(0), ctx2: { v: 1, role: 'Account manager', field: 'B2B software', who: [], sit: ['client email'], terms: [], t: 1 } };
      const { errors } = await boot(page, { migrated: true, fake: { patch: only(cards, profile) } });
      await screen(page, 'today');
      await openTab(page, 'vocab');
      const offers = page.getByTestId('ws-offers');
      await expect(offers).toBeVisible();
      await expect(page.getByTestId('ws-evening')).toHaveAttribute('data-n', '2');
      await expect(page.getByTestId('ws-say-own')).toBeVisible();
      await axe(page);
      await offers.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/ww-07-angebote-${vp.w}.png` });

      // „Sag es selbst“: Szene aus dem Berufsprofil, Claude prüft, Ergebnis mit Urteil; gespeichert wird nichts.
      const before = JSON.stringify((await dump(page))['vocab/submit']);
      await page.getByTestId('ws-say-own').click();
      await expect(page.getByTestId('say-own')).toHaveAttribute('data-n', '2');
      await expect(page.getByTestId('say-own-scene')).toContainText('Account manager');
      const item = page.getByTestId('say-own-item');
      const key = (await item.getAttribute('data-key')) ?? '';
      const word = key.replace('vocab/', '');
      await page.getByTestId('say-own-input').fill(`I will ${word} the documents for the client today.`);
      await page.getByTestId('say-own-check').click();
      await expect(page.getByTestId('say-own-result')).toBeVisible();
      await page.screenshot({ path: `${OUT}/ww-08-sag-es-selbst-${vp.w}.png` });
      const res = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
      expect(JSON.stringify((await dump(page))['vocab/submit'])).toBe(before);
      await page.getByTestId('say-own-next').click();
      await expect(page.getByTestId('say-own-item')).toHaveAttribute('data-pos', '2');
      await page.keyboard.press('Escape');

      // Abend-Check: genau die zwei heute eingeführten Wörter, freier Abruf (keine Aufdeckkarte, keine Auswahl).
      await page.getByTestId('ws-evening').click();
      await screen(page, 'trainer');
      const ex = page.getByTestId('exercise');
      await expect(ex).toBeVisible();
      expect(['cloze', 'type', 'cloze_part']).toContain(await ex.getAttribute('data-ex'));
      expect(errors).toEqual([]);
    });
  });
}
