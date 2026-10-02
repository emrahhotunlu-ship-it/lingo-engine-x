import { expect, test, type Locator, type Page } from '@playwright/test';
import { boot, screen, openEntry } from './fixtures';
import { clozeSolution, orderSolution, orderSolutions, shiftPerf, typeInGap } from './learnHelpers';
import { DAY, dump, writes, type Dump } from './trainerHelpers';

// Übungen ohne KI (phase2-plan §5.4–5.7, §9.3): je Übung eine vollständige Runde. Diktat mit
// nachgebildeter Sprachausgabe; Lückenjagd: Buchstaben landen in der Lücke, Platzhalter per Tipp;
// Satzbau mit Tippen und Ziehen; Sprint bis zum Ende. Kein Notenknopf (U-01), Lösung vor dem
// Prüfen nicht im DOM (U-04), Übungen schreiben nie vocab/* oder grammar/* (D12).

type Doc = Record<string, unknown>;

async function openDrill(page: Page, kind: 'dictate' | 'cloze' | 'order' | 'sprint'): Promise<void> {
  await screen(page, 'today');
  await openEntry(page, `hub-drill-${kind}`);
  await expect(page.getByTestId('drill')).toHaveAttribute('data-kind', kind);
}

const spoken = (page: Page): Promise<string[]> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { spoken: string[] } }).__LINGO_FAKE__.spoken]);
const logOf = (d: Dump, type: string): Doc[] => ((d[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).filter((e) => e.type === type);
const actOf = (d: Dump, key: string): number => Number((((d['app/profile']?.act as Record<string, Doc> | undefined) ?? {})[DAY] ?? {})[key] ?? 0);

/** Ergebnis ohne Notenknopf (U-01), dann weiter. */
async function finishItem(page: Page): Promise<string> {
  await expect(page.getByTestId('verdict')).toBeVisible();
  await expect(page.locator('button[data-grade]')).toHaveCount(0);
  const verdict = (await page.getByTestId('verdict').getAttribute('data-verdict')) ?? '';
  const next = page.getByTestId('next');
  if (await next.isVisible().catch(() => false)) await next.click().catch(() => undefined);
  await expect(page.getByTestId('drill-item').getByTestId('verdict')).toHaveCount(0);
  return verdict;
}

/** Keine Schreibvorgänge auf Karten oder Grammatikthemen (D12). */
async function noCardOrTopicWrites(page: Page): Promise<void> {
  const paths = (await writes(page)).map((w) => w.path);
  expect(paths.filter((p) => p.startsWith('vocab/') || p.startsWith('grammar/'))).toEqual([]);
}

test('Diktat: Satz wird gesprochen, nicht angezeigt; Runde vollständig; Log und act', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  const before = await (async () => {
    await screen(page, 'today');
    return dump(page);
  })();
  await openDrill(page, 'dictate');
  const verdicts: string[] = [];
  // Zahl der bisher gehörten Sätze (inkl. „Nochmal hören"): Jede Aufgabe wartet auf ihren EIGENEN Satz.
  let heard = 0;
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('drill-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    await expect(page.getByTestId('dictate-input')).toBeVisible();
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(heard);
    const all = await spoken(page);
    const said = all.at(-1) ?? '';
    heard = all.length;
    // U-04: der gesprochene Satz steht vor dem Prüfen nirgends im DOM.
    expect(await page.locator('main').evaluate((el) => el.outerHTML)).not.toContain(said);
    if (i === 0) {
      const n = (await spoken(page)).length;
      await page.getByTestId('drill-replay').click();
      await expect.poll(async () => (await spoken(page)).length).toBe(n + 1);
      heard = n + 1;
    }
    await page.getByTestId('dictate-input').fill(i === 2 ? said.replace(/\w+/, 'Zzzz') : said);
    await page.getByTestId('check').click();
    verdicts.push(await finishItem(page));
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(verdicts).toHaveLength(8);
  expect(verdicts.filter((v) => v === 'correct').length).toBeGreaterThanOrEqual(7);
  await expect.poll(async () => logOf(await dump(page), 'dictate').length).toBe(logOf(before, 'dictate').length + 8);
  await expect.poll(async () => actOf(await dump(page), 'dictate')).toBe(actOf(before, 'dictate') + 1);
  await noCardOrTopicWrites(page);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Lückenjagd: Buchstaben landen in der Lücke, Tipp zeigt Platzhalter; Runde vollständig', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  const before = await dump(page);
  await openDrill(page, 'cloze');
  const verdicts: string[] = [];
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('drill-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    const item = page.getByTestId('drill-item');
    await expect(item).toHaveAttribute('data-kind', 'cloze');
    await expect(item.getByTestId('task-line')).toBeVisible();
    // Statuszeile ohne eigenen Beherrschungswert: 0 Punkte mit dem Wort „neu", nie leer.
    await expect(item.getByTestId('confidence')).toHaveText('neu');
    const gap = item.getByTestId('gap');
    // U-04: die Lücke ist leer, kein Ergebnisbereich, keine Wendung.
    await expect(gap).toHaveText(/^\s*$/);
    await expect(item.getByTestId('meaning')).toHaveCount(0);
    const answer = await clozeSolution(page);
    expect(answer, 'Lösung aus den Testdaten').not.toBeNull();
    if (i === 0) {
      // Tipp: ein Platzhalter je Buchstabe (zählt als Hilfe).
      await item.getByTestId('hint').click();
      await expect(gap).toHaveAttribute('data-masked', '');
    }
    await typeInGap(page, answer ?? 'zzzz');
    // Die getippten Buchstaben landen in der Lücke (kinetische Lücke, kein Feld darunter).
    await expect.poll(async () => (await gap.innerText()).replace(/\s+/g, '')).toBe((answer ?? '').replace(/\s+/g, ''));
    await page.keyboard.press('Enter');
    verdicts.push(await finishItem(page));
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(verdicts).toHaveLength(8);
  // „near“ = akzeptierte andere Wortstellung (seit dem C1-Werkzeugkasten gibt es Sätze mit mehreren gültigen Stellungen).
  expect(verdicts.every((v) => v === 'correct' || v === 'near'), verdicts.join(',')).toBe(true);
  await expect.poll(async () => logOf(await dump(page), 'cloze').length).toBe(logOf(before, 'cloze').length + 8);
  await expect.poll(async () => actOf(await dump(page), 'cloze')).toBe(actOf(before, 'cloze') + 1);
  await noCardOrTopicWrites(page);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

/** Maße eines Elements, sobald sie sich zwischen zwei Messungen (50 ms) nicht mehr ändern. */
async function stableBox(loc: Locator): Promise<{ x: number; y: number; width: number; height: number } | null> {
  let prev = await loc.boundingBox();
  for (let k = 0; k < 20; k++) {
    await loc.page().waitForTimeout(50);
    const cur = await loc.boundingBox();
    if (prev && cur && Math.abs(prev.x - cur.x) < 0.5 && Math.abs(prev.y - cur.y) < 0.5 && Math.abs(prev.width - cur.width) < 0.5) return cur;
    prev = cur;
  }
  return prev;
}

test('Satzbau: Tippen und Ziehen, Runde vollständig; Pflichtkanal auf Heute erledigt', async ({ page }) => {
  // Seit „Sag es“ wählt ein neuer Plan Satzbau nie mehr als Pflicht; ein schon gespeicherter Plan
  // mit `ch:order` gilt aber unverändert weiter (nie umgewürfelt) – genau das prüft dieser Test.
  const plan = { d: DAY, v: 1, ids: ['order', 'cloze', 'gram'], why: [[['whyRotation']], [['whyRotation']], [['whyRotation']]], duty: ['ch:order'], goal: { review: 0, ch: 6 }, lesson: null, at: 1 };
  const { errors, external } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { plan } } } });
  await screen(page, 'today');
  await expect(page.locator('[data-testid="duty"][data-duty="ch:order"]')).toHaveAttribute('data-state', 'open');
  const before = await dump(page);
  await openDrill(page, 'order');
  // Satzbau ist heute Pflicht (Plan: ch:order) → die Runde läuft als Pflicht.
  await expect(page.getByTestId('drill')).toHaveAttribute('data-ctx', 'duty');
  const verdicts: string[] = [];
  for (let i = 0; i < 10; i++) {
    await expect(page.getByTestId('drill-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    const item = page.getByTestId('drill-item');
    await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(0);
    await expect(item.getByTestId('diff-correct')).toHaveCount(0);
    // Die deutsche Bedeutung steht vorab da, die Warum-Zeile erst nach dem Prüfen.
    await expect(item.getByTestId('order-de')).toBeVisible();
    await expect(item.getByTestId('order-why')).toHaveCount(0);
    const pool = item.getByTestId('tile-pool').getByTestId('tile');
    const texts = await pool.evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));
    const order = orderSolution(texts);
    expect(order, `Satz aus ${texts.join(' | ')}`).not.toBeNull();
    const ids = (order ?? []).map((k) => texts[k] ?? '');
    for (const [n, text] of ids.entries()) {
      const tile = item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${text.replace(/"/g, '\\"')}"]`).first();
      if (i === 0 && n % 2 === 1) {
        // Ziehen: Baustein in die Satzzeile (ans Ende).
        // Erst messen, wenn die Bausteine stillstehen (Layout-Animation nach dem letzten Zug).
        const from = await stableBox(tile);
        const line = await stableBox(item.getByTestId('tile-line'));
        if (!from || !line) throw new Error('keine Maße');
        await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
        await page.mouse.down();
        await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 - 10, { steps: 3 });
        await page.mouse.move(line.x + line.width - 12, line.y + line.height / 2, { steps: 8 });
        await page.mouse.up();
      } else await tile.click();
      await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(n + 1);
    }
    const line = await item.getByTestId('tile-line').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile')));
    expect(line).toEqual(ids);
    await item.getByTestId('check').click();
    await expect(item.getByTestId('order-why')).toBeVisible();
    if (i === 0) {
      // Kein automatisches Weiter: Emrah liest die Warum-Zeile in Ruhe (nur der Knopf geht weiter).
      await page.waitForTimeout(1500);
      await expect(item.getByTestId('order-why')).toBeVisible();
    }
    verdicts.push(await finishItem(page));
  }
  await expect(page.getByTestId('summary')).toBeVisible();
  expect(verdicts).toHaveLength(6);
  expect(verdicts.every((v) => v === 'correct'), verdicts.join(',')).toBe(true);
  await expect.poll(async () => logOf(await dump(page), 'order').length).toBe(logOf(before, 'order').length + 6);
  const d = await dump(page);
  expect(logOf(d, 'order').slice(-6).every((e) => e.ctx === 'duty')).toBe(true);
  await expect.poll(async () => actOf(await dump(page), 'order')).toBe(actOf(before, 'order') + 1);
  await noCardOrTopicWrites(page);
  // Heute: der einzige Pflichtkanal ist erledigt → Fertig-Karte (Zustand, kein Knopf; Neubau N15).
  await page.getByTestId('summary-back').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  const status = page.getByTestId('today-status');
  await expect(status).toHaveAttribute('data-status', 'allDone');
  await expect(status).toHaveAttribute('data-done', '1');
  await expect(status).toHaveAttribute('data-total', '1');
  const card = page.locator('[data-testid="today-card"][data-done="true"]');
  await expect(card).toBeVisible();
  await expect(card.locator('button, a, input')).toHaveCount(0);
  await expect(page.getByTestId('start')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

const ORDER_PLAN = { d: DAY, v: 1, ids: ['order', 'cloze', 'gram'], why: [[['whyRotation']], [['whyRotation']], [['whyRotation']]], duty: ['ch:order'], goal: { review: 0, ch: 6 }, lesson: null, at: 1 };

/** Bausteine des aktuellen Satzes (Texte in der Reihenfolge des Vorrats). */
const poolTexts = (item: Locator): Promise<string[]> => item.getByTestId('tile-pool').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));

async function clickTiles(item: Locator, texts: readonly string[]): Promise<void> {
  for (const [n, text] of texts.entries()) {
    await item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${text.replace(/"/g, '\\"')}"]`).first().click();
    await expect(item.getByTestId('tile-line').getByTestId('tile')).toHaveCount(n + 1);
  }
}

test('Satzbau: eine zweite gültige Reihenfolge zählt als richtig, „Auch richtig“ nennt sie', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { plan: ORDER_PLAN } } } });
  await openDrill(page, 'order');
  let used = 0;
  for (let i = 0; i < 6 && used < 2; i++) {
    const item = page.getByTestId('drill-item');
    await expect(item.getByTestId('order-de')).toBeVisible();
    const texts = await poolTexts(item);
    const sols = orderSolutions(texts);
    expect(sols.length, `Satz aus ${texts.join(' | ')}`).toBeGreaterThan(0);
    const pick = sols.length > 1 ? 1 : 0;
    if (pick === 1) used++;
    await clickTiles(item, (sols[pick] ?? []).map((k) => texts[k] ?? ''));
    await item.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'correct');
    if (pick === 1) {
      await expect(item.getByTestId('also-right')).toBeVisible();
      await expect(item.getByTestId('diff-correct')).toBeVisible();
    } else await expect(item.getByTestId('also-right')).toHaveCount(0);
    await finishItem(page);
  }
  expect(used, 'mindestens ein Satz mit zweiter Reihenfolge in der Runde').toBeGreaterThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('Satzbau: ein versetzter Baustein ist „fast richtig“, die falsche Stelle ist markiert; zwei vertauschte sind falsch', async ({ page }) => {
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { plan: ORDER_PLAN } } } });
  await openDrill(page, 'order');
  for (let round = 0; round < 2; round++) {
    const item = page.getByTestId('drill-item');
    await expect(item.getByTestId('order-de')).toBeVisible();
    const texts = await poolTexts(item);
    const sols = orderSolutions(texts);
    const seq = (sols[0] ?? []).map((k) => texts[k] ?? '');
    expect(seq.length).toBeGreaterThanOrEqual(5);
    // Runde 0: letzten Baustein vor den vorletzten (ein Baustein versetzt, aber nur wenn das keine andere gültige Reihenfolge ist).
    // Runde 1: die ersten beiden und die letzten beiden vertauschen → falsch.
    const swapped = [...seq];
    if (round === 0) [swapped[swapped.length - 2], swapped[swapped.length - 1]] = [swapped[swapped.length - 1] as string, swapped[swapped.length - 2] as string];
    else {
      [swapped[0], swapped[1]] = [swapped[1] as string, swapped[0] as string];
      [swapped[swapped.length - 2], swapped[swapped.length - 1]] = [swapped[swapped.length - 1] as string, swapped[swapped.length - 2] as string];
    }
    const valid = sols.map((s) => s.map((k) => texts[k] ?? '').join('|'));
    if (valid.includes(swapped.join('|'))) {
      // Zufällig selbst eine gültige Umstellung: dieser Satz taugt nicht für den Test, nächsten nehmen.
      await clickTiles(item, seq);
      await item.getByTestId('check').click();
      await finishItem(page);
      round--;
      continue;
    }
    await clickTiles(item, swapped);
    await item.getByTestId('check').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', round === 0 ? 'near' : 'wrong');
    // Die falsch gelegten Bausteine sind markiert (Zustand am Baustein, nicht nur Farbe im Verlauf).
    const states = await item.getByTestId('tile-line').getByTestId('tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')));
    expect(states.some((x) => x === 'near' || x === 'off')).toBe(true);
    await expect(item.getByTestId('order-why')).toBeVisible();
    await expect(item.getByTestId('diff-correct')).toBeVisible();
    await finishItem(page);
  }
  expect(errors).toEqual([]);
});

test('Satzbau am Handy (390 × 844): Bedeutung, Bausteine und Prüfen ohne Seitwärtsrollen sichtbar', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin', locale: 'de-DE' });
  const page = await context.newPage();
  const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { plan: ORDER_PLAN } } } });
  await openDrill(page, 'order');
  const item = page.getByTestId('drill-item');
  await expect(item.getByTestId('order-de')).toBeVisible();
  await expect(item.getByTestId('check')).toBeVisible();
  await expect(page.getByTestId('tiles-type')).toHaveCount(0);
  const box = await item.getByTestId('tile-pool').boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});

test('Sprint: 90 Sekunden bis zum Ende; nur sprints, act und Radar, kein Log', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
  await screen(page, 'today');
  const before = await dump(page);
  await openDrill(page, 'sprint');
  await expect(page.getByTestId('sprint-timer')).toHaveAttribute('data-left-ms', '90000');
  await page.getByTestId('sprint-start').click();
  for (let i = 0; i < 5; i++) {
    const it = page.getByTestId('sprint-item');
    await expect(it).toBeVisible();
    if ((await it.getByTestId('choice').count()) > 0) await it.getByTestId('choice').first().click();
    else {
      await typeInGap(page, 'zzzz');
      await page.keyboard.press('Enter');
    }
  }
  const left = Number(await page.getByTestId('sprint-timer').getAttribute('data-left-ms'));
  expect(left).toBeGreaterThan(0);
  expect(left).toBeLessThan(90_000);
  // Testuhr: 91 s vorspulen (der Sprint misst mit performance.now()).
  await shiftPerf(page, 91_000);
  await expect(page.getByTestId('sprint-summary')).toBeVisible();
  await expect(page.getByTestId('sprint-tempo')).toBeVisible();
  await expect(page.getByTestId('sprint-list')).toBeVisible();
  const nBefore = ((before['app/profile']?.sprints as unknown[] | undefined) ?? []).length;
  await expect.poll(async () => (((await dump(page))['app/profile']?.sprints as unknown[] | undefined) ?? []).length).toBe(Math.min(60, nBefore + 1));
  const last = ((await dump(page))['app/profile']?.sprints as Doc[]).at(-1) as Doc;
  expect(last).toMatchObject({ n: 5 });
  await expect.poll(async () => actOf(await dump(page), 'sprint')).toBe(actOf(before, 'sprint') + 1);
  // Sprint schreibt keine Log-Einträge (wie die alte App).
  expect(((await dump(page))[`log/${DAY}`]?.entries as Doc[] | undefined)?.length ?? 0).toBe(((before[`log/${DAY}`]?.entries as Doc[] | undefined) ?? []).length);
  await noCardOrTopicWrites(page);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('ohne KI (?fake=nosample): alle Übungen öffnen ohne Absturz, keine KI-Knöpfe', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true, fake: { capabilities: { sample: false } } });
  for (const kind of ['cloze', 'order', 'dictate', 'sprint'] as const) {
    await openDrill(page, kind);
    await expect(page.getByTestId('drill-item')).toBeVisible();
    await expect(page.locator('[data-ai]')).toHaveCount(0);
    await page.getByTestId('round-close').click();
    await page.getByTestId('tab-today').click().catch(() => undefined);
  }
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
