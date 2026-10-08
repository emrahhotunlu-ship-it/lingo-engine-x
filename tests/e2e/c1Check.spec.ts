import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems } from './fixtures';
import { SAT, SAT_9, WED, WED_9, bootCheck, checkDayPatch, donePatch, runCheck, answerCheckItem, type Doc } from './c1CheckHelpers';
import { dump, writes } from './trainerHelpers';

// C1-Check (Lernplattform 3.0 §4.3, P40): Karte unter „Extra“ im Check-Fenster, 30 Aufgaben ohne Rückmeldung, Ergebnis mit Spanne, Teilen, schwächsten
// Mustern und Fehlersätzen; genau ein Eintrag in `app/c1.checks`; Abbrechen speichert nichts; am Check-Tag ersetzt er Schritt 2 und 3.

type C1 = { checks?: Array<Record<string, unknown>> };
const checksOf = async (page: Page): Promise<Array<Record<string, unknown>>> => ((await dump(page))['app/c1'] as C1 | undefined)?.checks ?? [];
const mark = async (page: Page): Promise<number> => (await writes(page)).length;
const since = async (page: Page, n: number): Promise<string[]> => (await writes(page)).slice(n).map((w) => w.path);
const setFail = (page: Page, code: string | undefined) =>
  page.evaluate((c) => (window as unknown as { __LINGO_FAKE__: { db: { setFailWrites(c?: string): void } } }).__LINGO_FAKE__.db.setFailWrites(c), code);

async function openFromCard(page: Page): Promise<void> {
  await expect(page.getByTestId('ck-card')).toBeVisible();
  await page.getByTestId('ck-start').click();
  await expect(page.getByTestId('ck-intro')).toBeVisible();
}

test.describe('Laptop', () => {
  test.setTimeout(120_000);

  test('Karte nur im Check-Fenster nach der Pflicht; Ablauf ohne Rückmeldung; alles richtig = 36 von 36; genau ein Eintrag, nur app/c1 geschrieben', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: WED_9, patch: donePatch(WED) });
    await openFromCard(page);
    // Die Schreibvorgänge des Starts (Pflicht des geschafften Tages, Tageswerte) sind durch, bevor gemessen wird.
    await expect
      .poll(async () => {
        const p = (await dump(page))['app/profile'] as { pflicht?: Doc; history?: Array<{ d?: string }> };
        return [p.pflicht?.[WED] ?? null, p.history?.at(-1)?.d ?? null];
      })
      .toEqual([1, WED]);
    const before = await dump(page);
    await expect(page.getByTestId('ck')).toHaveAttribute('data-form', 'A');
    await expect(page.getByTestId('ck')).toHaveAttribute('data-inp', 'desk');
    const w0 = await mark(page);
    await page.getByTestId('ck-go').click();
    await expect(page.getByTestId('ck-part')).toContainText('Teil 1 von 4');
    await expect(page.getByTestId('ck-count')).toContainText('Aufgabe 1 von 30');
    // Keine Rückmeldung, kein Tipp während des Checks; nichts gespeichert, bevor er fertig ist.
    await answerCheckItem(page, 'right');
    await expect(page.getByTestId('verdict')).toHaveCount(0);
    await expect(page.getByTestId('explanation')).toHaveCount(0);
    await expect(page.getByTestId('ck-count')).toContainText('Aufgabe 2 von 30');
    expect(await since(page, w0)).toEqual([]);
    for (let i = 1; i < 30; i++) await answerCheckItem(page, 'right');
    await expect(page.getByTestId('ck-result')).toHaveAttribute('data-pts', '36');
    await expect(page.getByTestId('ck-res-total')).toContainText('36 von 36');
    await expect(page.getByTestId('ck-res-range')).toContainText('33–36');
    await expect(page.getByTestId('ck-res-guide')).toContainText('nicht geeicht');
    await expect(page.getByTestId('ck-res-part-kwt')).toContainText('12 von 12');
    await expect(page.getByTestId('ck-res-history')).toHaveCount(0);
    await expect(page.getByTestId('ck-weak')).toHaveCount(0);
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-state', 'saved');
    await expect.poll(async () => (await checksOf(page)).length).toBe(1);
    const [c] = await checksOf(page);
    expect(c).toEqual({ d: WED, f: 'A', inp: 'desk', p: [8, 8, 8, 12], pts: 36, max: 36 });
    // Nur app/c1: kein Thema, keine Karte, kein Tagesprotokoll, keine Serie, keine Pflicht.
    // Geschrieben: der Eintrag und der vorhandene Meilenstein „erster C1-Check“ (`app/profile.ms.c1check1`), sonst nichts im Profil.
    expect(new Set(await since(page, w0).then((w) => w.filter((p) => p !== 'app/profile')))).toEqual(new Set(['app/c1']));
    await expect.poll(async () => (((await dump(page))['app/profile'] as { ms?: Doc }).ms ?? {}).c1check1).toBe(WED);
    const after = await dump(page);
    const bp = before['app/profile'] as Doc;
    const ap = after['app/profile'] as Doc;
    expect(Object.keys({ ...bp, ...ap }).filter((k) => JSON.stringify(bp[k]) !== JSON.stringify(ap[k]))).toEqual(['ms']);
    for (const k of Object.keys(before).filter((k) => k.startsWith('grammar/') || k.startsWith('vocab/') || k.startsWith('log/'))) expect(after[k]).toEqual(before[k]);
    // Fertig: Blatt zu, die Karte ist weg (Abstand 21 Tage).
    await page.getByTestId('ck-done').click();
    await expect(page.getByTestId('ck')).toHaveCount(0);
    await expect(page.getByTestId('ck-card')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Wertung: Wortbildung falsch → 28 von 36, schwächste Muster mit „Üben“, Fehlersätze (Quelle check, höchstens 8) und m im Eintrag', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: WED_9, patch: donePatch(WED) });
    const rep0 = (((await dump(page))['app/repair'] as { items?: unknown[] } | undefined)?.items ?? []).length;
    await openFromCard(page);
    await runCheck(page, (_i, kind) => (kind === 'wf' ? 'wrong' : 'right'));
    await expect(page.getByTestId('ck-res-total')).toContainText('28 von 36');
    await expect(page.getByTestId('ck-res-range')).toContainText('25–31');
    await expect(page.getByTestId('ck-res-part-wf')).toContainText('0 von 8');
    const weak = page.getByTestId('ck-weak');
    expect(await weak.count()).toBeGreaterThanOrEqual(1);
    expect(await weak.count()).toBeLessThanOrEqual(2);
    await expect(weak.first().getByTestId('ck-practice')).toBeVisible();
    await expect(page.getByTestId('ck-res-repairs')).toContainText('8 Fehlersätze');
    // Rückblick: jede Aufgabe mit deiner Antwort und „Warum?“.
    await expect(page.getByTestId('ck-review')).toHaveCount(30);
    await expect(page.locator('[data-testid="ck-review"][data-full="false"]')).toHaveCount(8);
    await expect.poll(async () => (await checksOf(page)).length).toBe(1);
    const [c] = await checksOf(page);
    expect(c).toMatchObject({ p: [8, 8, 0, 12], pts: 28, max: 36 });
    expect(Array.isArray(c?.m)).toBe(true);
    await expect
      .poll(async () => (((await dump(page))['app/repair'] as { items?: Array<{ src?: string }> } | undefined)?.items ?? []).filter((x) => x.src === 'check').length)
      .toBe(8);
    const rep1 = (((await dump(page))['app/repair'] as { items?: unknown[] } | undefined)?.items ?? []).length;
    expect(rep1 - rep0).toBe(8);
    // „Üben“ (Wortbildung) schließt das Blatt und startet die Runde „Wort umbauen“.
    await weak.first().getByTestId('ck-practice').click();
    await expect(page.getByTestId('ck')).toHaveCount(0);
    await expect(page.locator('[data-screen="grammarSession"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('Abbrechen speichert nichts: Nachfrage beim Schließen, „Ja, abbrechen“ schließt ohne Eintrag', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: WED_9, patch: donePatch(WED) });
    await openFromCard(page);
    const w0 = await mark(page);
    await page.getByTestId('ck-go').click();
    for (let i = 0; i < 3; i++) await answerCheckItem(page, 'right');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('ck-ask-cancel')).toBeVisible();
    await page.getByTestId('ck-cancel-no').click();
    await expect(page.getByTestId('ck-item')).toBeVisible();
    await page.getByTestId('ck-cancel').click();
    await page.getByTestId('ck-cancel-yes').click();
    await expect(page.getByTestId('ck')).toHaveCount(0);
    // Kein Check und keine Fehlersätze (Profil-Schreibvorgänge vom Start des Tages können unter Last später eintreffen).
    expect((await since(page, w0)).filter((p) => p === 'app/c1' || p === 'app/repair')).toEqual([]);
    expect(await checksOf(page)).toEqual([]);
    // Neu geöffnet beginnt er von vorn.
    await openFromCard(page);
    expect(errors).toEqual([]);
  });

  test('zwei Tabs: Hat ein anderer Tab denselben Check schon gespeichert, bleibt es bei genau einem Eintrag', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: WED_9, patch: donePatch(WED) });
    await openFromCard(page);
    await page.getByTestId('ck-go').click();
    for (let i = 0; i < 29; i++) await answerCheckItem(page, 'skip');
    // Der andere Tab speichert in diesem Moment (gleicher Tag, gleiche Form, Laptop).
    const other = { d: WED, f: 'A', inp: 'desk', p: [8, 8, 8, 12], pts: 36, max: 36 };
    await page.evaluate(
      (o) =>
        (window as unknown as { __LINGO_FAKE__: { db: { db: { doc(p: string): { set(d: unknown): Promise<void> } } } } }).__LINGO_FAKE__.db.db
          .doc('app/c1')
          .set({ v: 1, checks: [o], gates: [], prod: [], bad: [] }),
      other,
    );
    await answerCheckItem(page, 'skip');
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-state', 'saved');
    await page.waitForTimeout(300);
    expect(await checksOf(page)).toEqual([other]);
    expect(errors).toEqual([]);
  });

  test('Fehlerfall: Speichern scheitert → Hinweis mit „Erneut versuchen“, danach genau ein Eintrag', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: WED_9, patch: donePatch(WED) });
    await openFromCard(page);
    await page.getByTestId('ck-go').click();
    for (let i = 0; i < 29; i++) await answerCheckItem(page, 'skip');
    await setFail(page, 'invalid_argument');
    await answerCheckItem(page, 'skip');
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-state', 'failed');
    await expect(page.getByTestId('ck-res-total')).toContainText('0 von 36');
    expect(await checksOf(page)).toEqual([]);
    await setFail(page, undefined);
    await page.getByTestId('ck-save-retry').click();
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-state', 'saved');
    await expect.poll(async () => (await checksOf(page)).length).toBe(1);
    expect(errors.filter((e) => !/invalid_argument|simulated/.test(e))).toEqual([]);
  });

  test('Check-Tag (letzter Samstag): Schritt 2 wird zur Wahl; der Check ersetzt Schritt 2 und 3; Serie und Tagesprotokoll bleiben', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: SAT_9, patch: checkDayPatch() });
    const before = await dump(page);
    await expect(page.getByTestId('start')).toHaveAttribute('data-duty', 'ch:u-focus');
    // Während der Pflicht: keine Extra-Karte.
    await expect(page.getByTestId('ck-card')).toHaveCount(0);
    await page.getByTestId('start').click();
    await expect(page.getByTestId('unit-c1check')).toBeVisible();
    await page.getByTestId('unit-c1check-start').click();
    await expect(page.getByTestId('ck-intro')).toBeVisible();
    await runCheck(page, () => 'skip');
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-state', 'saved');
    await expect.poll(async () => (await checksOf(page)).length).toBe(1);
    expect((await checksOf(page))[0]).toMatchObject({ d: SAT, f: 'A', inp: 'desk' });
    await expect
      .poll(async () => {
        const act = ((await dump(page))['app/profile'] as { act?: Record<string, Record<string, number>> }).act?.[SAT] ?? {};
        return [act.focus ?? act['u-focus'] ?? 0, act.task ?? act['u-task'] ?? 0];
      })
      .toEqual([1, 1]);
    await page.getByTestId('ck-done').click();
    await expect(page.getByTestId('ck')).toHaveCount(0);
    await expect(page.locator('[data-testid="unit-step"][data-step="c1check"]')).toHaveCount(0);
    const after = await dump(page);
    expect(after[`log/${SAT}`]).toEqual(before[`log/${SAT}`]);
    expect((after['app/profile'] as Doc).plan).toEqual((before['app/profile'] as Doc).plan);
    expect(errors).toEqual([]);
  });

  test('Check-Tag: Ist die Form inzwischen am Laptop benutzt (anderer Tab), heißt es „nicht gespeichert“; Schritt 2 und 3 bleiben offen', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: SAT_9, patch: checkDayPatch() });
    await page.getByTestId('start').click();
    await page.getByTestId('unit-c1check-start').click();
    await page.getByTestId('ck-go').click();
    for (let i = 0; i < 29; i++) await answerCheckItem(page, 'skip');
    // Ein anderer Tab hat Form A am Laptop schon an einem früheren Tag gespeichert: dieser Check darf nicht dazukommen.
    const other = { d: '2026-10-27', f: 'A', inp: 'desk', p: [8, 8, 8, 12], pts: 36, max: 36 };
    await page.evaluate(
      (o) =>
        (window as unknown as { __LINGO_FAKE__: { db: { db: { doc(p: string): { set(d: unknown): Promise<void> } } } } }).__LINGO_FAKE__.db.db
          .doc('app/c1')
          .set({ v: 1, checks: [o], gates: [], prod: [], bad: [] }),
      other,
    );
    await answerCheckItem(page, 'skip');
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-state', 'failed');
    await expect(page.getByTestId('ck-save')).toHaveAttribute('data-why', 'rejected');
    await expect(page.getByTestId('ck-save-retry')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(await checksOf(page)).toEqual([other]);
    const act = ((await dump(page))['app/profile'] as { act?: Record<string, Record<string, number>> }).act?.[SAT] ?? {};
    expect([act.focus ?? act['u-focus'] ?? 0, act.task ?? act['u-task'] ?? 0]).toEqual([0, 0]);
    expect(errors.filter((e) => !/check:save|rejected/.test(e))).toEqual([]);
  });

  test('Check-Tag: „Heute nicht“ führt in den normalen Schritt 2, nichts wird gespeichert', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: SAT_9, patch: checkDayPatch() });
    await page.getByTestId('start').click();
    await expect(page.getByTestId('unit-c1check')).toBeVisible();
    const w0 = await mark(page);
    await page.getByTestId('unit-c1check-skip').click();
    await expect(page.locator('[data-testid="unit-step"][data-step="c1check"]')).toHaveCount(0);
    expect((await since(page, w0)).filter((p) => p === 'app/c1')).toEqual([]);
    expect(await checksOf(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});

test.describe('Handy 390, hell', () => {
  test.setTimeout(150_000);
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('Handy-Fassung: Hinweis „leichter als die Prüfung“, Bausteine bei kwt, kein Querscrollen und axe 0 in allen Schritten; Eintrag inp touch', async ({ page }) => {
    const { errors } = await bootCheck(page, { now: WED_9, patch: donePatch(WED), touch: true, theme: 'light' });
    const axe = async (): Promise<string[]> =>
      (await new AxeBuilder({ page }).include('[data-testid="ck"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map((v) => v.id);
    await expect(page.getByTestId('ck-card-touch')).toBeVisible();
    await openFromCard(page);
    await expect(page.getByTestId('ck-intro-touch')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    await page.getByTestId('ck-go').click();
    await expect(page.getByTestId('ck-item')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    let sawKwt = false;
    for (let i = 0; i < 30; i++) {
      const kind = await page.getByTestId('ck-item').getAttribute('data-kind');
      if (kind === 'kwt' && !sawKwt) {
        sawKwt = true;
        await expect(page.getByTestId('ck-touch-note')).toBeVisible();
        await expect(page.getByTestId('tile-pool')).toBeVisible();
        await expect(page.getByTestId('ck-input')).toHaveCount(0);
        expect(await layoutProblems(page)).toEqual([]);
        expect(await axe()).toEqual([]);
      }
      await answerCheckItem(page, i % 3 === 0 ? 'skip' : kind === 'kwt' ? 'skip' : 'right');
    }
    expect(sawKwt).toBe(true);
    await expect(page.getByTestId('ck-result')).toBeVisible();
    await expect(page.getByTestId('ck-res-touch')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(await axe()).toEqual([]);
    await expect.poll(async () => (await checksOf(page)).length).toBe(1);
    expect((await checksOf(page))[0]).toMatchObject({ d: WED, f: 'A', inp: 'touch' });
    expect(errors).toEqual([]);
  });
});
