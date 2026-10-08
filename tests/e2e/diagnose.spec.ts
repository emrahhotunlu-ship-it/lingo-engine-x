import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { layoutProblems, type Lang, type Theme } from './fixtures';
import { bootAt } from './fixtures';
import { answerGrammar, grammarKey, nextItem } from './learnHelpers';
import { diagCalls, diagPatch, dumpDb, openDiagnose, setDiagMode, WEEK } from './diagnoseHelpers';

// P49 (Lernplattform 3.0, KI-Tutor T5): Karte „Häufigste Verwechslungen · 28 Tage“ (ohne Claude immer da), Block „Diagnose von Claude“ (einmal je
// ISO-Woche, geräteübergreifend), Kontrast-Runde. Die Testlaufzeit antwortet fest (`canned/lp3/p49.ts`); Schalter per `lx:flags`.

const OTHER_DONE = {
  w: WEEK,
  t: Date.parse('2026-09-20T09:00:00+02:00'),
  st: 'done',
  dev: 'phone',
  pv: 'diagnose@1',
  lang: 'de',
  rep: 16,
  out: {
    headline: 'Du verwechselst a und the in neuen Sätzen.',
    findings: [{ title: 'a oder the', why: 'Du nimmst the, wo etwas zum ersten Mal genannt wird.', rule: 'Erstmals genannt? Dann a.', ev: ['p:art.definite'], action: 'contrast:art.indefinite|art.definite' }],
    better: null,
    next: 'Mach diese Woche eine Kontrast-Runde.',
  },
};

async function axe(page: Page): Promise<string[]> {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'));
  await page.waitForTimeout(200);
  const res = await new AxeBuilder({ page }).include('[data-testid="dx-card"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return res.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
}

for (const [label, width, height] of [
  ['Handy 390', 390, 844],
  ['Laptop', 1440, 900],
] as const) {
  test.describe(label, () => {
    test.use({ viewport: { width, height }, hasTouch: width < 600 });

    for (const theme of ['dark', 'dim', 'light'] as Theme[]) {
      for (const lang of ['de', 'en'] as Lang[]) {
        test(`Karte, Diagnose holen, Ergebnis · axe 0 · ${theme} · ${lang}`, async ({ page }) => {
          const { errors, external } = await openDiagnose(page, { theme, lang });
          const card = page.getByTestId('dx-card');
          await expect(card).toBeVisible();
          await expect(page.getByTestId('dx-pair')).toHaveCount(1);
          await expect(page.getByTestId('dx-pair')).toHaveAttribute('data-pair', 'art.indefinite|art.definite');
          await expect(page.getByTestId('dx-pair')).toHaveAttribute('data-confirmed', '1');
          await expect(page.getByTestId('dx-count')).toContainText('3');
          await expect(page.getByTestId('dx-bars')).toHaveAttribute('aria-label', /.+/);
          await expect(page.getByTestId('dx-contrast')).toBeVisible();
          // Noch keine Diagnose geholt: nur der Knopf, kein Aufruf beim Öffnen.
          await expect(page.getByTestId('dx-ask')).toBeVisible();
          expect(await diagCalls(page)).toEqual([]);
          expect(await axe(page)).toEqual([]);
          await page.getByTestId('dx-ask').click();
          await expect(page.getByTestId('dx-claude')).toBeVisible();
          await expect(page.getByTestId('dx-finding')).toHaveCount(2);
          await expect(card.locator('[data-ai-mark="diag"]')).toContainText(lang === 'de' ? 'Auswertung von Claude' : 'Analysis from Claude');
          await expect(page.getByTestId('dx-ask')).toHaveCount(0);
          // Genau ein Aufruf, Stufe complex.
          expect(await diagCalls(page)).toEqual([{ tier: 'complex' }]);
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

  test('Ergebnis steht in app/patterns.diag (additiv), das Muster-Dokument bleibt, zweites Öffnen ruft nicht erneut auf', async ({ page }) => {
    await openDiagnose(page);
    await page.getByTestId('dx-ask').click();
    await expect(page.getByTestId('dx-claude')).toBeVisible();
    const db = await dumpDb(page);
    const diag = (db['app/patterns']?.diag ?? []) as Array<Record<string, unknown>>;
    expect(diag).toHaveLength(1);
    expect(diag[0]).toMatchObject({ w: WEEK, st: 'done', pv: 'diagnose@1', lang: 'de' });
    expect((diag[0]?.out as { findings: unknown[] }).findings.length).toBeGreaterThan(0);
    // Die Beanspruchung (pending) ist ersetzt, nicht gehäuft.
    expect(diag.filter((e) => e.st === 'pending')).toEqual([]);
    // Wieder öffnen (anderer Reiter und zurück): kein weiterer Aufruf.
    await page.getByTestId('tab-words').click();
    await page.getByTestId('tab-grammar').click();
    await expect(page.getByTestId('dx-claude')).toBeVisible();
    expect(await diagCalls(page)).toHaveLength(1);
  });

  test('Ohne sample: Karte vollständig, kein Diagnose-Block, kein Aufruf', async ({ page }) => {
    await openDiagnose(page, { fake: { capabilities: { sample: false } } });
    await expect(page.getByTestId('dx-pair')).toHaveCount(1);
    await expect(page.getByTestId('dx-contrast')).toBeVisible();
    await expect(page.getByTestId('dx-claude-area')).toHaveCount(0);
    await expect(page.getByTestId('dx-ask')).toHaveCount(0);
    expect(await diagCalls(page)).toEqual([]);
  });

  test('Ohne Schalter: gar keine Karte', async ({ page }) => {
    await openDiagnose(page, { localStorage: { 'lx:flags': '{"tutor":{"diagnose":false}}' } });
    await expect(page.getByTestId('dx-card')).toHaveCount(0);
  });

  test('Zwei Geräte: ein Ergebnis eines anderen Geräts dieser Woche, also kein Aufruf und kein Knopf', async ({ page }) => {
    await openDiagnose(page, { patch: { 'app/patterns': { diag: [OTHER_DONE] } } });
    await expect(page.getByTestId('dx-claude')).toBeVisible();
    await expect(page.getByTestId('dx-headline')).toContainText('a und the');
    await expect(page.getByTestId('dx-ask')).toHaveCount(0);
    expect(await diagCalls(page)).toEqual([]);
  });

  test('Zwei Geräte: eine frische Beanspruchung eines anderen Geräts → „holt gerade“, kein Aufruf; abgelaufen → Knopf', async ({ page }) => {
    const pending = { w: WEEK, t: Date.parse('2026-09-20T20:55:00+02:00'), st: 'pending', dev: 'laptop' };
    await openDiagnose(page, { patch: { 'app/patterns': { diag: [pending] } } });
    await expect(page.getByTestId('dx-pending')).toBeVisible();
    await expect(page.getByTestId('dx-ask')).toHaveCount(0);
    expect(await diagCalls(page)).toEqual([]);
  });

  test('Zwei Geräte: eine abgelaufene Beanspruchung (älter als 10 Minuten) blockiert nicht', async ({ page }) => {
    const stale = { w: WEEK, t: Date.parse('2026-09-20T20:30:00+02:00'), st: 'pending', dev: 'laptop' };
    await openDiagnose(page, { patch: { 'app/patterns': { diag: [stale] } } });
    await page.getByTestId('dx-ask').click();
    await expect(page.getByTestId('dx-claude')).toBeVisible();
    expect(await diagCalls(page)).toHaveLength(1);
    const diag = ((await dumpDb(page))['app/patterns']?.diag ?? []) as Array<Record<string, unknown>>;
    expect(diag.filter((e) => e.w === WEEK)).toHaveLength(1);
    expect(diag[0]?.st).toBe('done');
  });

  test('Ein Ergebnis aus der Vorwoche sperrt nicht', async ({ page }) => {
    const old = { ...OTHER_DONE, w: '2026-W37', t: Date.parse('2026-09-13T09:00:00+02:00') };
    await openDiagnose(page, { patch: { 'app/patterns': { diag: [old] } } });
    await expect(page.getByTestId('dx-ask')).toBeVisible();
  });

  test('Zu wenige neue Fehler: Hinweis mit Zahlen, kein Knopf, kein Aufruf', async ({ page }) => {
    await openDiagnose(page, { patch: diagPatch({ wrong: 5 }) });
    const few = page.getByTestId('dx-few');
    await expect(few).toBeVisible();
    await expect(few).toHaveAttribute('data-have', '5');
    await expect(few).toHaveAttribute('data-need', '12');
    await expect(page.getByTestId('dx-ask')).toHaveCount(0);
    expect(await diagCalls(page)).toEqual([]);
  });

  test('Fehlerfall: kein JSON → ein Aufruf, Fehlertext, Beanspruchung freigegeben; „Erneut versuchen“ fragt einmal frisch', async ({ page }) => {
    await openDiagnose(page);
    await setDiagMode(page, 'zzjson');
    await page.getByTestId('dx-ask').click();
    await expect(page.getByTestId('ai-error')).toBeVisible();
    expect(await diagCalls(page)).toHaveLength(1);
    await page.waitForTimeout(400);
    expect(await diagCalls(page)).toHaveLength(1);
    const diag = ((await dumpDb(page))['app/patterns']?.diag ?? []) as Array<Record<string, unknown>>;
    expect(diag.filter((e) => e.st === 'pending')).toEqual([]);
    await setDiagMode(page, '');
    await page.getByTestId('ai-retry').click();
    await expect(page.getByTestId('dx-claude')).toBeVisible();
    expect(await diagCalls(page)).toHaveLength(2);
  });

  test('Schemaverletzung: genau zwei Aufrufe (der eine Neuversuch nach A6.3), dann das Ergebnis', async ({ page }) => {
    await openDiagnose(page);
    await setDiagMode(page, 'zzschema');
    await page.getByTestId('dx-ask').click();
    await expect(page.getByTestId('dx-claude')).toBeVisible();
    expect(await diagCalls(page)).toHaveLength(2);
  });

  test('Melden blendet die Diagnose aus, die Zählung bleibt; gespeichert als bad, nichts gelöscht', async ({ page }) => {
    await openDiagnose(page);
    await page.getByTestId('dx-ask').click();
    await expect(page.getByTestId('dx-claude')).toBeVisible();
    await page.getByTestId('ai-report').click();
    await page.getByTestId('report-explain').click();
    await expect(page.getByTestId('dx-claude')).toHaveCount(0);
    await expect(page.getByTestId('dx-gone')).toBeVisible();
    await expect(page.getByTestId('dx-pair')).toHaveCount(1);
    await expect.poll(async () => (((await dumpDb(page))['app/patterns']?.diag ?? []) as Array<{ bad?: number[]; out?: unknown }>)[0]?.bad).toEqual([0, 1]);
    const diag = ((await dumpDb(page))['app/patterns']?.diag ?? []) as Array<{ out?: unknown }>;
    expect(diag[0]?.out).toBeTruthy();
  });

  test('Kontrast-Runde: der Knopf startet 8 Aufgaben (A und B im Wechsel), freiwillig und ohne Aufruf von Claude', async ({ page }) => {
    await openDiagnose(page);
    await page.getByTestId('dx-contrast').click();
    await expect(page.getByTestId('gr-item')).toBeVisible();
    await expect(page.getByTestId('round-progress')).toHaveText(/\b1\b\D+\b8\b/);
    expect(await diagCalls(page)).toEqual([]);
  });

  test('Keine Befunde: ehrlicher Zustand „noch nichts Systematisches“, kein Befund, Woche belegt', async ({ page }) => {
    await openDiagnose(page);
    await setDiagMode(page, 'zzempty');
    await page.getByTestId('dx-ask').click();
    await expect(page.getByTestId('dx-none')).toBeVisible();
    await expect(page.getByTestId('dx-finding')).toHaveCount(0);
    await expect(page.getByTestId('dx-ask')).toHaveCount(0);
    const diag = ((await dumpDb(page))['app/patterns']?.diag ?? []) as Array<{ st?: string; out?: { findings: unknown[] } }>;
    expect(diag[0]?.st).toBe('done');
    expect(diag[0]?.out?.findings).toEqual([]);
    expect(await diagCalls(page)).toHaveLength(1);
  });

  test('Ein Muster-Dokument mit unerwartetem Aufbau wird nie angefasst: kein Aufruf, kein Schreiben, ein ruhiger Fehler', async ({ page }) => {
    await openDiagnose(page, { patch: { 'app/patterns': { items: 'kaputt' } } });
    const before = (await dumpDb(page))['app/patterns'];
    await page.getByTestId('dx-ask').click();
    await expect(page.getByTestId('ai-error')).toBeVisible();
    expect(await diagCalls(page)).toEqual([]);
    expect((await dumpDb(page))['app/patterns']).toEqual(before);
  });

  test('Zwei Seiten nacheinander: die zweite sieht das Ergebnis der ersten und ruft nie auf (genau ein Aufruf je Woche)', async ({ browser }) => {
    const opts = { viewport: { width: 390, height: 844 }, hasTouch: true, timezoneId: 'Europe/Berlin', locale: 'de-DE' };
    const c1 = await browser.newContext(opts);
    const p1 = await c1.newPage();
    await openDiagnose(p1);
    await p1.getByTestId('dx-ask').click();
    await expect(p1.getByTestId('dx-claude')).toBeVisible();
    const patterns = (await dumpDb(p1))['app/patterns'];
    expect(await diagCalls(p1)).toHaveLength(1);
    await c1.close();
    const c2 = await browser.newContext(opts);
    const p2 = await c2.newPage();
    await openDiagnose(p2, { patch: { 'app/patterns': patterns ?? {} } });
    await expect(p2.getByTestId('dx-claude')).toBeVisible();
    await expect(p2.getByTestId('dx-ask')).toHaveCount(0);
    expect(await diagCalls(p2)).toEqual([]);
    await c2.close();
  });

  test('Rundenende: der einzige automatische Auslöser fragt im Hintergrund, aber erst nach einem Nutzeraufruf dieser Ansicht', async ({ page }) => {
    test.slow();
    const solve = grammarKey();
    const onlyLogs = Object.fromEntries(Object.entries(diagPatch()).filter(([k]) => k.startsWith('log/')));
    await bootAt(page, { name: 'grammarSession', mode: 'xtra' }, { localStorage: { 'lx:flags': JSON.stringify({ tutor: { diagnose: true, explain: true } }) }, fake: { patch: onlyLogs } });
    // Ohne Nutzeraufruf (Zustimmung unbekannt) würde der Hintergrund schweigen: erst eine falsche Antwort und „Erklär mir meine Antwort“.
    await expect(page.getByTestId('gr-item')).toBeVisible();
    await answerGrammar(page, solve, { wrong: true });
    await page.getByTestId('tutor-ask').click();
    await page.getByTestId('tutor-go').click();
    await expect(page.getByTestId('tutor-text')).toBeVisible();
    expect(await diagCalls(page)).toEqual([]);
    await nextItem(page);
    for (let i = 0; i < 12; i++) {
      await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
      if (await page.getByTestId('summary').isVisible()) break;
      await answerGrammar(page, solve);
      await nextItem(page);
    }
    await expect(page.getByTestId('summary')).toBeVisible();
    await expect.poll(async () => (await diagCalls(page)).length).toBe(1);
    expect(await diagCalls(page)).toEqual([{ tier: 'complex' }]);
    await expect.poll(async () => (((await dumpDb(page))['app/patterns']?.diag ?? []) as Array<{ st?: string }>)[0]?.st).toBe('done');
    // Nicht noch einmal in derselben Woche.
    await page.waitForTimeout(500);
    expect(await diagCalls(page)).toHaveLength(1);
  });
});
