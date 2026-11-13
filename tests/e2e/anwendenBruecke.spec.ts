import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, MIGRATED, openTab, screen } from './fixtures';
import { TUE_9, TW_DUTY, profileWith, reviewedLog } from './heuteHelpers';
import { dump } from './trainerHelpers';

// Großpaket P „Politur“, P4 „Anwenden als Brücke“ (Entscheidung E2 vom 13.11.2026): Schritt 3 = täglich zwei eigene Sätze mit einem Wort aus der
// Wörter-App und einem Grammatik-Muster. Vorgabe sichtbar („Benutze: …“), Urteil je Element, Rückfluss an Wörter-App und Muster-Zähler.
// Die Testlaufzeit antwortet fest (`src/platform/dev/canned/applyBridge.ts`: `zzpat` → Muster falsch, `zzword` → Wort falsch).

type Doc = Record<string, unknown>;
type Fake = { sampleCalls: Array<{ id: string | null; tier: string }> };
const TUE = '2026-09-22';
const NOW = Date.parse(TUE_9);
const D = 86_400_000;
const AXE = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const calls = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: Fake }).__LINGO_FAKE__.sampleCalls.filter((c) => /^(apply-|c1-mail|combo-)/.test(c.id ?? '')).map((c) => `${c.id}:${c.tier}`));
const doc = async (page: Page, path: string): Promise<Doc> => (await dump(page))[path] ?? {};
const bridgeItems = async (page: Page): Promise<Doc[]> => (((await doc(page, 'out/2026-09')) as { items?: Doc[] }).items ?? []).filter((i) => i.k === 'bridge');
const axe = async (page: Page): Promise<string[]> => {
  await page.waitForTimeout(400);
  return (await new AxeBuilder({ page }).withTags(AXE).analyze()).violations.map((v) => v.id);
};

/** Lexem der Wörter-App auf Stufe `lv`; `day` = letzter Übungstag, `own` = eigene geprüfte Sätze; Termin weit in der Zukunft (keine Planwirkung). */
function lex(lv: number, o: { day?: string | null; own?: number } = {}): Doc {
  const t = NOW - 30 * D;
  const intro = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const fs = { s: 400, d: 4, st: 2, reps: 6, lapses: 0, last: NOW - D, sd: 30, ls: 0 };
  return {
    v: 1, k: 'w', of: null, core: null, sense: null, lv,
    u: { due: NOW + 60 * D, ...fs }, b: { due: NOW + 60 * D, ...fs },
    day: o.day ?? null, dayU: null, step: null, ev: { f: ['2026-09-01', '2026-09-05', '2026-09-10'], o: o.own ?? 0, s: 0 }, sn: [['a', intro]], gr: null, reg: null, pri: 'edge', lc: 0, pair: null, mv: 0, sync: NOW - D, mig: null, intro,
    fq: { l: 'gap', c: 0, h: { gap: [3, 3] }, nb: 0, ak: null, ew: [] },
  };
}

/** Tagesweg-Plan vom Dienstag: Schritt 3 „Anwenden“ mit 3 Minuten; Grammatik-Thema des Tages = Bedingungssätze, Muster „third conditional“. */
function twPlan(over: Doc = {}): Doc {
  return {
    d: TUE, v: 1, ids: [], why: [], duty: TW_DUTY, goal: { review: 2, due: 2, new: 0, ahead: 0 }, lesson: null, at: 1,
    u: { v: 1, shape: 'full', goalMin: 25, theme: '', min: 26, rv: 2, tw: 1, ap: 'combo', gt: { intro: null, pats: ['cn.third'], topics: ['conditionals'] }, b: [[1, 'review', 18, { repairs: 0 }], [2, 'grammar', 5, { errs: 0 }], [3, 'task.apply', 3]], ...over },
  };
}

/**
 * Wie bei Emrah: Wörter-App an; ein Wort wird gerade gelernt (Stufe 3, heute geübt), eines sitzt (Stufe 6, ein eigener Satz); ein sicheres Muster.
 * Schritt 1 und 2 sind erledigt: Schritt 3 ist der letzte, danach geht es zu Heute (Politur P1: ein offener Schritt würde direkt starten).
 */
function emrah(profile: Doc = {}, plan: Doc = twPlan()): Record<string, Doc> {
  const base = profileWith(TUE, plan, ['review', 'u-focus'], { vcfg: { min: 15, ret: 0.9, mod: 1 }, newPerDay: 0, ...profile });
  return {
    ...base,
    ...reviewedLog(TUE),
    'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
    'vocab/achieve': { lex: lex(3, { day: TUE }) },
    'vocab/affect': { lex: lex(6, { own: 1 }) },
    'grammar/reported': { pats: { 'rs.backshift': { n: 4, c: 4, last: Date.parse('2026-09-12T10:00:00+02:00'), h: 0, r: 7, k: 3, dd: ['2026-09-10', '2026-09-12'], s: '2026-09-12', i: '2026-09-01' } } },
  };
}

const S1_BAD = 'If we had called them earlier, we would have achieved our sales target zzpat.';
const S1_FIXED = 'If we had called them earlier, we would have achieved our sales target.';
// Eigener Satzanfang (nicht der vorgeschlagene „Their buyer told me that …“): nur dann zählt das Muster als „frei verwendet“ (Prüfbefund 13.11.2026).
const S2_OK = 'The client’s buyer told me that the delay would affect the budget.';

test.describe('Handy 375 × 700 (Außendisplay)', () => {
  test.use({ viewport: { width: 375, height: 700 }, hasTouch: true });

  test('Schritt 3: zwei Brücken-Sätze aus dem Lernstand; Vorgabe mit „steht im Satz“, Urteil je Element, erst selbst nochmal, Rückfluss, Schritt erledigt', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: false, now: TUE_9, localStorage: { 'lx:input': 'touch' }, fake: { patch: emrah({ apc: { n: 4, d: '2026-09-21' } }) } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    // Seite Anwenden: Pflicht = zwei eigene Sätze mit den Minuten aus dem Plan; Mails und Zusammenfassung freiwillig mit ehrlicher Zeit.
    await expect(page.getByTestId('apply-hub')).toHaveAttribute('data-v', '3');
    await expect(page.getByTestId('ax-today-start')).toHaveAttribute('data-kind', 'bridge');
    await expect(page.getByTestId('ax-today-start')).toContainText('Zwei eigene Sätze');
    await expect(page.getByTestId('ax-today-start')).toContainText('ca. 3 Min.');
    await expect(page.getByTestId('hub-combo-own')).toHaveCount(0);
    for (const id of ['ax-row-reply', 'ax-row-write', 'ax-row-summary']) {
      await expect(page.getByTestId(id)).toBeEnabled();
      await expect(page.getByTestId(id)).toContainText('6–9 Min.');
    }
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);

    await page.getByTestId('ax-today-start').click();
    await screen(page, 'applyBridge');
    await expect(page.getByTestId('bridge')).toHaveAttribute('data-mode', 'duty');
    // Satz 1: das gerade gelernte Wort (heute geübt) + das Muster des heutigen Grammatik-Schritts, mit Bedeutung, Formel, Situation und Satzanfang.
    const task = page.getByTestId('bx-task');
    await expect(task).toHaveAttribute('data-word', 'achieve');
    await expect(task).toHaveAttribute('data-pat', 'cn.third');
    await expect(page.getByTestId('bx-meaning')).toHaveText(/erreichen, schaffen/);
    await expect(page.getByTestId('bx-form')).toContainText('if + Past Perfect');
    await expect(page.getByTestId('bx-word-why')).toHaveAttribute('data-why', 'today');
    await expect(page.getByTestId('bx-word-why')).toHaveText('heute geübt – jetzt selbst benutzen');
    await expect(page.getByTestId('bx-pat-why')).toHaveText('dein Grammatik-Thema von heute');
    await expect(page.getByTestId('bx-situation')).toContainText('verlorenen Auftrag');
    await expect(page.getByTestId('purpose')).toContainText('Erst im eigenen Satz');
    await expect(page.getByTestId('bx-check')).toBeDisabled();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);

    // Satzanfang antippen übernimmt ihn; ohne das Wort kommt erst ein Hinweis – ohne Anfrage an Claude.
    await page.getByTestId('bx-starter-use').click();
    const input = page.getByTestId('bx-input');
    await expect(input).toHaveValue('Looking back, if we ');
    await input.fill('Looking back, if we had called them earlier, we would have won the order.');
    await expect(page.getByTestId('bx-word')).toHaveAttribute('data-in', 'false');
    await page.getByTestId('bx-check').click();
    await expect(page.locator('[data-slot="hint"]')).toContainText('„achieve“ steht noch nicht in deinem Satz');
    await expect(page.getByTestId('bx-check')).toHaveText('Trotzdem prüfen');
    expect(await calls(page)).toEqual([]);

    await input.fill(S1_BAD);
    await expect(page.getByTestId('bx-word')).toHaveAttribute('data-in', 'true');
    await expect(page.getByTestId('bx-word-dot')).toHaveText('steht im Satz');
    await page.getByTestId('bx-check').click();

    // Rückmeldung in drei Zeilen: Wort ✓, Muster ✕, „Merk dir“ – je mit einem Satz Warum. Die bessere Fassung steht noch nicht da.
    await expect(page.getByTestId('bx-result')).toBeVisible();
    expect(await calls(page)).toEqual(['apply-bridge:default']);
    await expect(page.getByTestId('bx-row-word')).toHaveAttribute('data-mark', 'ok');
    await expect(page.getByTestId('bx-row-word')).toContainText('richtig benutzt');
    await expect(page.getByTestId('bx-row-word-why')).not.toBeEmpty();
    await expect(page.getByTestId('bx-row-pat')).toHaveAttribute('data-mark', 'bad');
    await expect(page.getByTestId('bx-row-pat')).toContainText('noch nicht richtig');
    await expect(page.getByTestId('bx-row-pat-why')).toContainText('andere Verbform');
    await expect(page.getByTestId('bx-keep')).toContainText('Merk dir:');
    await expect(page.locator('[data-slot="comparison"]')).toHaveCount(0);
    await expect(page.getByTestId('bx-better')).toHaveCount(0);
    await expect(page.getByTestId('bx-repair-note')).toBeVisible();
    // Erst selbst nochmal schreiben, dann der Vergleich „Du → besser“; die Profi-Fassung ist aufklappbar.
    await page.getByTestId('bx-redo').click();
    await page.getByTestId('bx-redo-input').fill(S1_FIXED);
    await page.getByTestId('bx-redo-done').click();
    await expect(page.getByTestId('bx-redo-text')).toContainText(S1_FIXED);
    await expect(page.locator('[data-slot="comparison"]')).toContainText('achieved our sales target');
    await expect(page.getByTestId('bx-better-text')).toHaveCount(0);
    await page.getByTestId('bx-better').click();
    await expect(page.getByTestId('bx-better-text')).toContainText('achieved');
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe(page)).toEqual([]);
    await page.getByTestId('bx-next').click();

    // Satz 2: das Wort, das sitzt (Stufe 6, ein eigener Satz fehlt noch) + ein sicheres früheres Muster.
    await expect(task).toHaveAttribute('data-word', 'affect');
    await expect(task).toHaveAttribute('data-pat', 'rs.backshift');
    await expect(page.getByTestId('bx-word-why')).toHaveText('sitzt schon – eigener Satz 2 von 2 bis zur höchsten Stufe');
    await expect(page.getByTestId('bx-pat-why')).toHaveText('sitzt schon – so bleibt es frisch');
    await input.fill(S2_OK);
    await page.getByTestId('bx-check').click();
    await expect(page.getByTestId('bx-row-word')).toHaveAttribute('data-mark', 'ok');
    await expect(page.getByTestId('bx-row-pat')).toHaveAttribute('data-mark', 'ok');
    await expect(page.locator('[data-slot="comparison"]')).toHaveCount(0);
    // Rückfluss sichtbar: eigener Satz gezählt (2 von 2), Muster als frei verwendet gezählt.
    await expect(page.getByTestId('bx-ev')).toHaveAttribute('data-own', '2');
    await expect(page.getByTestId('bx-ev')).toContainText('damit hast du beide');
    await expect(page.getByTestId('bx-pat-counted')).toBeVisible();
    await expect(page.getByTestId('bx-next')).toHaveText('Fertig');
    await page.getByTestId('bx-next').click();
    // Politur P1: ein Abschluss je Schritt – nach dem letzten Schritt des Tages direkt zu Heute, keine Zwischenkarte.
    await screen(page, 'today');

    // Gespeichert: zwei Ergebnisse (Art bridge) mit Wort-Kennung und Schreibzeit; Schritt 3 erledigt, Anwenden-Tag gezählt.
    expect(await calls(page)).toEqual(['apply-bridge:default', 'apply-bridge:default']);
    const items = await bridgeItems(page);
    expect(items.map((i) => [i.theme, i.ok, (i.fb as Doc).w, (i.fb as Doc).p, (i.fb as Doc).pat])).toEqual([
      ['vocab/achieve', false, 'ok', 'wrong', 'cn.third'],
      ['vocab/affect', true, 'ok', 'ok', 'rs.backshift'],
    ]);
    expect(items.every((i) => typeof i.ms === 'number' && i.d === TUE)).toBe(true);
    const profile = await doc(page, 'app/profile');
    await expect.poll(async () => ((await doc(page, 'app/profile')).act as Record<string, Doc>)[TUE]?.['u-task']).toBe(1);
    await expect.poll(async () => (await doc(page, 'app/profile')).apc).toEqual({ n: 5, d: TUE });
    // Sätze unter 10 Sekunden sind keine Messung: der Zeit-Mittelwert bleibt unberührt.
    expect(profile.abm).toBeUndefined();
    // Fehlersatz mit Muster, Situation und korrigierter Fassung.
    const repairs = (((await doc(page, 'app/repair')) as { items?: Doc[] }).items ?? []).filter((r) => r.wrong === S1_BAD);
    expect(repairs).toHaveLength(1);
    expect(repairs[0]).toMatchObject({ right: S1_FIXED, src: 'write', pat: 'cn.third' });
    expect(String(repairs[0]?.ctx)).toContain('verlorenen Auftrag');
    // Muster: eigener Zähler „frei verwendet“ nur beim richtigen Muster; kein BKT-Schritt (p, n, last unverändert).
    const reported = await doc(page, 'grammar/reported');
    expect(reported.fu).toEqual({ 'rs.backshift': { n: 1, d: TUE } });
    expect((await doc(page, 'grammar/conditionals')).fu).toBeUndefined();
    expect([reported.p, reported.n]).toEqual([0.435, 37]);
    // Wörter-App: „affect“ hat jetzt zwei eigene Sätze und den Satz in „Deine Sätze“; „achieve“ (Stufe 3) nur den Verlaufseintrag.
    const affect = (await doc(page, 'vocab/affect')).lex as { ev: { o: number }; os?: unknown[][]; b: { due: number } };
    expect(affect.ev.o).toBe(2);
    expect(affect.os?.[0]?.[1]).toBe(S2_OK);
    expect(affect.b.due).toBe(NOW + 60 * D);
    expect(((await doc(page, 'vocab/achieve')).lex as { ev: { o: number } }).ev.o).toBe(0);
    const vlog = Object.entries(await dump(page)).filter(([p]) => /^vlog\/\d/.test(p)).flatMap(([, d]) => Object.values(((d).e as Record<string, unknown[]> | undefined) ?? {}));
    expect(vlog.map((r) => [r[1], r[3], r[5]]).sort()).toEqual([['vocab/achieve', 'own', 'ok'], ['vocab/affect', 'own', 'ok']]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Kurzer Tag: ein eigener Satz; überspringen erledigt den Schritt, zählt aber nicht als Anwenden-Tag', async ({ page }) => {
    const { errors } = await boot(page, { migrated: false, now: TUE_9, localStorage: { 'lx:input': 'touch' }, fake: { patch: emrah({ apc: { n: 2, d: '2026-09-21' }, kt: { [TUE]: 1 } }) } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await expect(page.getByTestId('ax-today-start')).toContainText('Kurzer Tag');
    await page.getByTestId('ax-today-start').click();
    await screen(page, 'applyBridge');
    await expect(page.getByTestId('bx-task')).toHaveAttribute('data-word', 'achieve');
    await expect(page.getByTestId('exercise')).toContainText('Satz 1 von 1');
    await page.getByTestId('bx-skip').click();
    await screen(page, 'today');
    await expect.poll(async () => ((await doc(page, 'app/profile')).act as Record<string, Doc>)[TUE]?.['u-task']).toBe(1);
    expect((await doc(page, 'app/profile')).apc).toEqual({ n: 2, d: '2026-09-21' });
    expect(await bridgeItems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('14-Tage-Sperre und Rückfluss aus: das gesperrte Wort kommt nicht; mit `acfg.rf = 0` bleibt die Wörter-App unberührt', async ({ page }) => {
    const patch = {
      ...emrah({ acfg: { rf: 0 } }),
      'vocab/handle': { lex: lex(4, { day: '2026-09-21' }) },
      'out/2026-09': { v: 1, items: [{ id: 'bridge-x1', k: 'bridge', d: '2026-09-15', t: 1, theme: 'vocab/achieve', ok: true }] },
    };
    const { errors } = await boot(page, { migrated: false, now: TUE_9, localStorage: { 'lx:input': 'touch' }, fake: { patch } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await page.getByTestId('ax-today-start').click();
    await screen(page, 'applyBridge');
    // „achieve“ war vor 7 Tagen dran: jetzt das andere gelernte Wort (gestern geübt).
    await expect(page.getByTestId('bx-task')).toHaveAttribute('data-word', 'handle');
    await expect(page.getByTestId('bx-word-why')).toHaveAttribute('data-why', 'yesterday');
    await page.getByTestId('bx-skip').click();
    await expect(page.getByTestId('bx-task')).toHaveAttribute('data-word', 'affect');
    await page.getByTestId('bx-input').fill(S2_OK);
    await page.getByTestId('bx-check').click();
    await expect(page.getByTestId('bx-row-pat')).toHaveAttribute('data-mark', 'ok');
    await expect.poll(async () => (await bridgeItems(page)).length).toBe(2);
    await expect(page.getByTestId('bx-ev')).toHaveCount(0);
    await expect(page.getByTestId('bx-pat-counted')).toHaveCount(0);
    expect(((await doc(page, 'vocab/affect')).lex as { ev: { o: number } }).ev.o).toBe(1);
    expect((await doc(page, 'grammar/reported')).fu).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

test.describe('Laptop 1440 × 900', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Ohne Wörter-App (alter Weg) über den Start-Knopf von Heute; nach der Pflicht eine freie Zusatzrunde mit anderen Wörtern', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, localStorage: { 'lx:input': 'keys' }, fake: { patch: { ...profileWith(TUE, twPlan(), ['u-focus']), ...reviewedLog(TUE) } } });
    await screen(page, 'today');
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-task');
    await page.getByTestId('start').click();
    await screen(page, 'applyBridge');
    const task = page.getByTestId('bx-task');
    // Rückfall: Wörter aus dem alten Wortschatz (Grundform ohne „to“), Muster von heute aus dem Plan.
    await expect(page.getByTestId('bx-word-why')).toHaveAttribute('data-why', 'legacy');
    await expect(task).toHaveAttribute('data-pat', 'cn.third');
    const first = (await task.getAttribute('data-word')) ?? '';
    expect(first).not.toMatch(/^to /);
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('bx-input').fill(`If we had called them earlier, we would have had to ${first} it zzword.`);
    await page.getByTestId('bx-check').click();
    await expect(page.getByTestId('bx-row-word')).toHaveAttribute('data-mark', 'bad');
    await expect(page.getByTestId('bx-row-word')).toContainText('falsch benutzt');
    // „Bessere Fassung zeigen“ ohne zweiten Versuch.
    await page.getByTestId('bx-reveal').click();
    await expect(page.locator('[data-slot="comparison"]')).toBeVisible();
    await page.getByTestId('bx-next').click();
    const second = (await task.getAttribute('data-word')) ?? '';
    expect(second).not.toBe(first);
    await page.getByTestId('bx-skip').click();
    // Politur P1: nach dem letzten Schritt direkt zu Heute (kein zweites Rundenende).
    await screen(page, 'today');
    await expect.poll(async () => ((await doc(page, 'app/profile')).act as Record<string, Doc>)[TUE]?.['u-task']).toBe(1);
    await expect.poll(async () => (await bridgeItems(page)).length).toBe(1);

    // Pflicht erledigt: die Seite zeigt den Zustand und bietet zwei weitere eigene Sätze an (freiwillig, andere Wörter).
    await openTab(page, 'apply');
    await expect(page.getByTestId('ax-today-done')).toContainText('Erledigt');
    await expect(page.getByTestId('hub-combo-own')).toContainText('Noch zwei eigene Sätze');
    await page.getByTestId('hub-combo-own').click();
    await screen(page, 'applyBridge');
    await expect(page.getByTestId('bridge')).toHaveAttribute('data-mode', 'free');
    const free = (await page.getByTestId('bx-task').getAttribute('data-word')) ?? '';
    expect(free).not.toBe(first);
    expect(errors).toEqual([]);
  });

  test('Ohne Claude: Seite sperrt mit Grund; Schritt 3 läuft als Satzbau', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, now: TUE_9, fake: { capabilities: { sample: false }, patch: { ...profileWith(TUE, twPlan(), ['u-focus']), ...reviewedLog(TUE) } } });
    await screen(page, 'today');
    await openTab(page, 'apply');
    await expect(page.getByTestId('ax-row-reply')).toBeDisabled();
    await expect(page.getByTestId('ax-row-reply')).toContainText('Braucht Claude');
    await page.getByTestId('ax-today-start').click();
    await screen(page, 'drill');
    expect(errors).toEqual([]);
  });
});
