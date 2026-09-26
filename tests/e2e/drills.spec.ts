import { expect, test, type Page } from '@playwright/test';
import { boot, screen } from './fixtures';
import { clozeSolution, orderSolution, shiftPerf, typeInGap } from './learnHelpers';
import { DAY, dump, writes, type Dump } from './trainerHelpers';

// Übungen ohne KI (phase2-plan §5.4–5.7, §9.3): je Übung eine vollständige Runde. Diktat mit
// nachgebildeter Sprachausgabe; Lückenjagd: Buchstaben landen in der Lücke, Platzhalter per Tipp;
// Satzbau mit Tippen und Ziehen; Sprint bis zum Ende. Kein Notenknopf (U-01), Lösung vor dem
// Prüfen nicht im DOM (U-04), Übungen schreiben nie vocab/* oder grammar/* (D12).

type Doc = Record<string, unknown>;

async function openDrill(page: Page, kind: 'dictate' | 'cloze' | 'order' | 'sprint'): Promise<void> {
  await screen(page, 'today');
  await page.getByTestId('tab-learn').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  await page.getByTestId(`hub-drill-${kind}`).click();
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
  for (let i = 0; i < 12; i++) {
    await expect(page.getByTestId('drill-item').or(page.getByTestId('summary')).first()).toBeVisible();
    if (await page.getByTestId('summary').isVisible()) break;
    await expect(page.getByTestId('dictate-input')).toBeVisible();
    await expect.poll(async () => (await spoken(page)).length).toBeGreaterThan(i);
    const said = (await spoken(page)).at(-1) ?? '';
    // U-04: der gesprochene Satz steht vor dem Prüfen nirgends im DOM.
    expect(await page.locator('main').evaluate((el) => el.outerHTML)).not.toContain(said);
    if (i === 0) {
      const n = (await spoken(page)).length;
      await page.getByTestId('drill-replay').click();
      await expect.poll(async () => (await spoken(page)).length).toBe(n + 1);
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
  expect(verdicts.every((v) => v === 'correct'), verdicts.join(',')).toBe(true);
  await expect.poll(async () => logOf(await dump(page), 'cloze').length).toBe(logOf(before, 'cloze').length + 8);
  await expect.poll(async () => actOf(await dump(page), 'cloze')).toBe(actOf(before, 'cloze') + 1);
  await noCardOrTopicWrites(page);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('Satzbau: Tippen und Ziehen, Runde vollständig; Pflichtkanal auf Heute erledigt', async ({ page }) => {
  const { errors, external } = await boot(page, { migrated: true });
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
    const pool = item.getByTestId('tile-pool').getByTestId('tile');
    const texts = await pool.evaluateAll((els) => els.map((e) => e.getAttribute('data-tile') ?? ''));
    const order = orderSolution(texts, '');
    expect(order, `Satz aus ${texts.join(' | ')}`).not.toBeNull();
    const ids = (order ?? []).map((k) => texts[k] ?? '');
    for (const [n, text] of ids.entries()) {
      const tile = item.getByTestId('tile-pool').locator(`[data-testid="tile"][data-tile="${text.replace(/"/g, '\\"')}"]`).first();
      if (i === 0 && n % 2 === 1) {
        // Ziehen: Baustein in die Satzzeile (ans Ende).
        const from = await tile.boundingBox();
        const line = await item.getByTestId('tile-line').boundingBox();
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
  // Heute: der Pflichtkanal ist Zustand, kein Knopf.
  await page.getByTestId('summary-back').click();
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  await page.getByTestId('tab-today').click();
  await screen(page, 'today');
  const duty = page.locator('[data-testid="duty"][data-duty="ch:order"]');
  await expect(duty).toHaveAttribute('data-state', 'done');
  await expect(duty.locator('button, a, input')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
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
