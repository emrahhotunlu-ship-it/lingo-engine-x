import { expect, test, type Page } from '@playwright/test';
import { boot, bootAt, openTab, screen, SEED_EVENING } from './fixtures';
import { answerGrammar, grammarKey, nextItem, shownPrompt, skipMiniLesson } from './learnHelpers';
import { DAY, dump, type Dump } from './trainerHelpers';

// Grammatik (phase2-plan §5.2, §9.3): Runden mit allen vier Aufgabentypen, Ergebnis an fester
// Stelle auch bei richtiger Antwort (Vergleich, Form-Hinweis, Beispiele), kein Notenknopf (U-01),
// Lösung vor dem Prüfen nicht im DOM (U-04), KI-Urteil bei freier Antwort, Fehler in der
// Wiederholung am nächsten Tag, Regelblatt mit antippbaren Wörtern, ohne KI kein Absturz.

type Doc = Record<string, unknown>;
const solve = grammarKey();

async function openGrammar(page: Page): Promise<void> {
  await screen(page, 'today');
  await openTab(page, 'learn');
  await expect(page.getByTestId('learn-hub')).toBeVisible();
}

/** Lösung vor dem Prüfen nicht im DOM (U-04; bei Auswahl steht sie natürlich unter den Optionen). */
async function solutionHidden(page: Page, type: string): Promise<void> {
  const answer = solve(await shownPrompt(page));
  expect(answer, `Lösung für „${await shownPrompt(page)}" in den Testdaten`).not.toBeNull();
  if (type === 'mc' || !answer || answer.length < 5) return;
  // Die Musterkarte der Lernphase (Formel, Beispiel) darf die Form zeigen; der Aufgabentext und die Eingabe nie.
  const html = await page.locator('main').evaluate((el) => {
    const c = el.cloneNode(true) as HTMLElement;
    c.querySelectorAll('[data-slot="aid"], [data-slot="status"], [data-col="side"]').forEach((x) => x.remove());
    return c.outerHTML;
  });
  expect(html.toLowerCase()).not.toContain(answer.toLowerCase());
  await expect(page.getByTestId('result')).toHaveCount(0);
}

/** Ergebnis an fester Stelle (U-02): Urteil, Erklär-Karte (Muster, Warum) und – falls vorhanden – Beispiele nur aus dem Muster. */
async function resultComplete(page: Page): Promise<void> {
  const item = page.getByTestId('gr-item');
  await expect(item.getByTestId('verdict')).toBeVisible();
  // Auch bei richtiger Antwort steht mindestens eine Zeile der Begründung da (Kap. 2 Nr. 4); die Lösung steht nie doppelt (Lücke ODER Vergleich).
  await expect(item.getByTestId('explanation')).toBeVisible();
  const verdict = await item.getByTestId('verdict').getAttribute('data-verdict');
  if (verdict === 'ok' || (await item.getAttribute('data-type')) === 'mc') await expect(item.getByTestId('sentence-diff')).toHaveCount(0);
  const shown = item.getByTestId('example');
  for (let i = 0; i < (await shown.count()); i++) await expect(shown.nth(i)).not.toHaveText('');
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  await expect(page.getByTestId('next')).toBeVisible();
}

/** Eine ganze Runde spielen; Rückgabe: Typen und Urteile je Aufgabe. */
async function playRound(page: Page, opts: { wrongAt?: number } = {}): Promise<Array<{ type: string; verdict: string; prompt: string; topic: string }>> {
  // Eine falsche Antwort ab Platz `wrongAt`; ein Bedeutungspaar und ein fehlerfreier Satz haben keine „falsch → richtig“-Fassung (kein Fehlersatz) und zählen dafür nicht.
  let wrongDone = false;
  await expect(page.getByTestId('grammar-session')).toBeVisible();
  const out: Array<{ type: string; verdict: string; prompt: string; topic: string }> = [];
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    const item = page.getByTestId('gr-item');
    await expect(item.getByTestId('task')).toBeVisible();
    const type = (await item.getAttribute('data-type')) ?? '';
    const topic = (await item.getAttribute('data-topic')) ?? '';
    const prompt = await shownPrompt(page);
    await solutionHidden(page, type);
    const wrong = opts.wrongAt !== undefined && i >= opts.wrongAt && !wrongDone && type !== 'meaning' && type !== 'find';
    if (wrong) wrongDone = true;
    await answerGrammar(page, solve, { wrong });
    await resultComplete(page);
    out.push({ type, topic, verdict: (await item.getByTestId('verdict').getAttribute('data-verdict')) ?? '', prompt });
    await nextItem(page);
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  return out;
}

test('freie Runde vollständig: richtig und falsch mit Vergleich, Form-Hinweis und Beispielen; Schreibwege', async ({ page }) => {
  // Lange Runde (seit dem C1-Werkzeugkasten 23 Themen); unter Last mehr Zeit.
  test.slow();
  const { errors, external } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  const before = await dump(page);
  const rows = await playRound(page, { wrongAt: 1 });
  // N47: Die falsche Aufgabe kommt am Rundenende einmal wieder (nicht gezählt, nicht gespeichert).
  // Seit Lernplattform 2.0: eine ungesehene Variante desselben Musters (ohne Muster dieselbe Aufgabe), nie als Zähler der Runde.
  // Gibt es keine ungesehene Variante, entfällt die Wiederholung (nie dieselbe Aufgabe in Plänen der neuen Regel).
  expect([8, 9]).toContain(rows.length);
  const wrongAt = rows.findIndex((r) => r.verdict === 'wrong');
  expect(wrongAt).toBeGreaterThanOrEqual(1);
  if (rows.length === 9) expect(rows[8]?.topic).toBe(rows[wrongAt]?.topic);
  expect(rows.filter((_, i) => i !== wrongAt && i < 8).every((r) => r.verdict === 'ok'), JSON.stringify(rows)).toBe(true);
  expect(new Set(rows.map((r) => r.type)).size).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('session-end')).toHaveAttribute('data-total', '8');
  await expect(page.getByTestId('session-end')).toHaveAttribute('data-right', '7');

  // Schreibwege: grammar/<topic> sofort, Log und Profil über die Sammel-Warteschlange.
  const gBefore = ((before[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g').length;
  await expect.poll(async () => (((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g').length).toBe(gBefore + 8);
  const d = await dump(page);
  const log = (d[`log/${DAY}`]?.entries as Doc[]).filter((e) => e.k === 'g').slice(gBefore);
  expect(log.every((e) => e.ctx === 'xtra' && typeof e.topic === 'string' && typeof e.ms === 'number' && e.lang === 'de')).toBe(true);
  expect(log.filter((e) => e.ok === false)).toHaveLength(1);
  const topics = new Set(log.map((e) => String(e.topic)));
  for (const tp of topics) {
    const b = (before[`grammar/${tp}`]?.n as number | undefined) ?? 0;
    expect((d[`grammar/${tp}`]?.n as number) ?? 0, tp).toBeGreaterThan(b);
  }
  // Der Fehler steht im Thema (Form der alten App: q, given, ans, t).
  const wrong = log.find((e) => e.ok === false) as Doc;
  const errs = (d[`grammar/${String(wrong.topic)}`]?.errors as Doc[] | undefined) ?? [];
  expect(errs.some((e) => e.given === wrong.given && typeof e.t === 'number')).toBe(true);
  const gramBefore = Number(((before['app/profile']?.act as Record<string, Doc>)[DAY] ?? {}).gram ?? 0);
  await expect.poll(async () => (((await dump(page))['app/profile']?.act as Record<string, Doc>)[DAY] ?? {}).gram).toBe(gramBefore + 1);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Themenrunde: Satzkorrektur, Umformen und Lücke; deutlich andere freie Antwort ist sofort falsch, ohne auf Claude zu warten (27.09.)', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openGrammar(page);
  await page.locator('[data-testid="topic"][data-topic="used-to"]').click();
  await expect(page.getByTestId('rule-sheet')).toBeVisible();
  await page.getByTestId('topic-start').click();
  await expect(page.getByTestId('grammar-session')).toHaveAttribute('data-mode', 'topic');
  await skipMiniLesson(page);
  const seen = new Set<string>();
  let judged = false;
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    const item = page.getByTestId('gr-item');
    const type = (await item.getAttribute('data-type')) ?? '';
    seen.add(type);
    if (type === 'correct' && !judged) {
      // Emrahs Wunsch 27.09.: Bewertung sofort. Deutlich andere Antwort → Hinweis, dann falsch; kein Claude-Aufruf.
      await answerGrammar(page, solve, { given: 'Getting up early is something I have been used to for many years.' });
      await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
      judged = true;
    } else {
      await answerGrammar(page, solve);
    }
    await resultComplete(page);
    await nextItem(page);
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  expect([...seen].sort()).toEqual(expect.arrayContaining(['correct', 'gap']));
  expect(judged).toBe(true);
  const calls = await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { sampleCalls: Array<{ id: string | null; tier: string }> } }).__LINGO_FAKE__.sampleCalls.map((c) => `${c.id}:${c.tier}`));
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test('Auswahl, Lücke, Umformen, Satzkorrektur: alle vier Typen über zwei Runden, alle richtig, ohne Notenknopf', async ({ page }) => {
  // Lange Runde (seit dem C1-Werkzeugkasten 23 Themen); unter Last mehr Zeit.
  test.slow();
  // Freie Runde (Auswahl, Lücke, Umformen) + Themenrunde (Satzkorrektur) – jeweils bis zum Ende.
  const { errors } = await bootAt(page, { name: 'grammarSession', mode: 'xtra' });
  const a = await playRound(page);
  await page.getByTestId('session-end-secondary').or(page.getByTestId('session-end-next')).first().click();
  await openGrammar(page);
  await page.locator('[data-testid="topic"][data-topic="used-to"]').click();
  await page.getByTestId('topic-start').click();
  await skipMiniLesson(page);
  const b = await playRound(page);
  // Auswahl, Lücke und Satzkorrektur kommen vor; dazu die neuen Arten (Bedeutung, Fehler finden, Schlüsselwort), sobald das Thema sie hat.
  const kinds = new Set([...a, ...b].map((r) => r.type));
  expect(kinds.size).toBeGreaterThanOrEqual(3);
  expect([...kinds]).toEqual(expect.arrayContaining(['gap']));
  expect([...a, ...b].every((r) => r.verdict === 'ok'), JSON.stringify([...a, ...b])).toBe(true);
  expect(errors).toEqual([]);
});

test('Fehler von heute kommt am nächsten Tag in der Wiederholung', async ({ browser }) => {
  // Tag 1: eine Aufgabe falsch.
  const ctx1 = await browser.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const p1 = await ctx1.newPage();
  const b1 = await bootAt(p1, { name: 'grammarSession', mode: 'xtra' });
  const logged = async () => (((await dump(p1))[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.k === 'g').length;
  const gBefore = await logged();
  const rows = await playRound(p1, { wrongAt: 3 });
  const missed = rows.find((r) => r.verdict === 'wrong')!;
  await expect.poll(logged).toBe(gBefore + 8);
  const state: Dump = await dump(p1);
  expect(b1.errors).toEqual([]);
  await ctx1.close();

  // Tag 2 (Testuhr +1 Tag und 2 Stunden): Datenbank von gestern, der Fehler ist fällig und steht
  // in der Themenrunde vorn in der Wiederholung.
  const ctx2 = await browser.newContext({ timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const p2 = await ctx2.newPage();
  const next = new Date(Date.parse(SEED_EVENING) + 26 * 3_600_000).toISOString();
  const b2 = await boot(p2, { now: next, fake: { seed: state } });
  await openGrammar(p2);
  await expect(p2.getByTestId('hub-errors')).toBeVisible();
  await p2.locator(`[data-testid="topic"][data-topic="${missed.topic}"]`).click();
  await p2.getByTestId('topic-start').click();
  await expect(p2.getByTestId('grammar-session')).toHaveAttribute('data-mode', 'topic');
  await skipMiniLesson(p2);
  const reviewed: string[] = [];
  for (let i = 0; i < 12; i++) {
    await expect(p2.getByTestId('gr-item').or(p2.getByTestId('summary')).first()).toBeVisible();
    if (await p2.getByTestId('summary').isVisible()) break;
    const item = p2.getByTestId('gr-item');
    if ((await item.getAttribute('data-review')) === null) break;
    reviewed.push(await shownPrompt(p2));
    await item.getByTestId('dont-know').click();
    await nextItem(p2);
    await expect(p2.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  const squash = (x: string) => x.toLowerCase().replace(/[^a-z]/g, '');
  expect(reviewed.map(squash), `${missed.prompt} in ${reviewed.join(' | ')}`).toContain(squash(missed.prompt));
  expect(b2.errors).toEqual([]);
  await ctx2.close();
});

test('Regelblatt: Wörter antippbar (Bedeutung, Lautschrift)', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true });
  await openGrammar(page);
  await page.locator('[data-testid="topic"][data-topic="passive"]').click();
  const sheet = page.getByTestId('rule-sheet');
  await expect(sheet).toBeVisible();
  const word = sheet.locator('button.lx-word').first();
  await expect(word).toBeVisible();
  const w = (await word.getAttribute('data-word')) ?? '';
  await word.click();
  await expect(page.getByTestId('lk-headword')).toBeVisible();
  expect((await page.getByTestId('lk-headword').innerText()).toLowerCase()).toContain(w.toLowerCase().slice(0, 3));
  expect(errors).toEqual([]);
});

test('Pfad: 39 Themen in Lehrreihenfolge mit Zustand; Englisch: Formmuster ohne deutsche Fachwörter', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, lang: 'en' });
  await openGrammar(page);
  const ids = await page.getByTestId('topic').evaluateAll((els) => els.map((e) => e.getAttribute('data-topic') ?? ''));
  // 16 alte + 16 neue Themen des Grammatik-Pfads + 7 des C1-Werkzeugkastens, alle in einer Liste (Lehrplan Kap. 4).
  expect(ids).toHaveLength(39);
  expect(new Set(ids).size).toBe(39);
  expect(ids[0]).toBe('pres-simple-cont');
  expect(ids.at(-1)).toBe('comparison');
  expect(ids.indexOf('past-simple-perfect')).toBeLessThan(ids.indexOf('time-clauses'));
  expect(ids.indexOf('c1-hedging')).toBeGreaterThan(ids.indexOf('time-clauses'));
  const states = await page.getByTestId('topic').evaluateAll((els) => els.map((e) => e.getAttribute('data-state') ?? ''));
  expect(states.every((x) => ['new', 'learning', 'safe', 'firm'].includes(x))).toBe(true);
  // Genau ein Thema wird als „up next“ markiert, und die Weiter-Karte nennt es.
  await expect(page.locator('[data-testid="topic"][aria-current="step"]')).toHaveCount(1);
  const next = await page.getByTestId('hub-next-topic').getAttribute('data-topic');
  await expect(page.locator(`[data-testid="topic"][data-topic="${next}"]`)).toHaveAttribute('aria-current', 'step');
  await page.locator('[data-testid="topic"][data-topic="passive"]').click();
  // Mit Musterdatei (passive hat eine) zeigt das Themenblatt die Formeln der Muster; ohne das Regelblatt die Formmuster.
  const patterns = page.getByTestId('rule-sheet').locator('[data-testid="rule-pattern"], [data-testid="pattern-formula"]');
  await expect(patterns.first()).toBeVisible();
  const text = (await patterns.allInnerTexts()).join(' | ');
  expect(text).toContain('participle');
  expect(text).not.toMatch(/3\. Form|Grundform/);
  expect(errors).toEqual([]);
});

test('ohne KI (?fake=nosample): kein Absturz, keine KI-Knöpfe, freie Antwort „nicht sicher prüfbar"', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  await openGrammar(page);
  await page.locator('[data-testid="topic"][data-topic="used-to"]').click();
  await expect(page.getByTestId('rule-sheet')).toBeVisible();
  await expect(page.locator('[data-ai]')).toHaveCount(0);
  await page.getByTestId('topic-start').click();
  await skipMiniLesson(page);
  let sawCorrect = false;
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('gr-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    const item = page.getByTestId('gr-item');
    if ((await item.getAttribute('data-type')) === 'correct' && !sawCorrect) {
      // Fast gleiche Variante der Lösung (ein Wort mehr) → „nicht sicher prüfbar“.
      const sol = solve(await shownPrompt(page)) ?? '';
      await answerGrammar(page, solve, { given: sol.replace(/^(\S+)/, '$1 really') });
      await expect(item.getByTestId('verdict')).toHaveAttribute('data-verdict', 'near');
      await expect(item.getByTestId('verdict-sub')).toHaveText('Nicht sicher prüfbar – zählt nicht gegen dich');
      sawCorrect = true;
    } else await answerGrammar(page, solve);
    await expect(page.locator('[data-ai]')).toHaveCount(0);
    await nextItem(page);
    await expect(page.getByTestId('gr-item').getByTestId('result')).toHaveCount(0);
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(sawCorrect).toBe(true);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
