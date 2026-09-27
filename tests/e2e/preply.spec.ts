import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openOverview, screen, type BootOptions } from './fixtures';
import { dump, writes } from './trainerHelpers';

// Phase 5: Preply-Brücke (Plan §8.3, §10.2 preply.spec.ts, P-01 … P-07).

type Doc = Record<string, unknown>;
const DAY = '2026-09-20';
const RAW = 'Teacher: "It depends of the budget" -> depends on.\nHW: write 5 sentences with "would rather".';

async function openPreply(page: Page, opts: BootOptions = {}) {
  const booted = await boot(page, { migrated: true, ...opts });
  await openOverview(page);
  await page.getByTestId('open-preply').click();
  await page.locator('[data-screen="preply"]').waitFor({ state: 'visible' });
  return booted;
}

const docsOf = async (page: Page, prefix: string): Promise<Array<[string, Doc]>> => Object.entries(await dump(page)).filter(([k]) => k.startsWith(prefix));
const countWrites = async (page: Page, path: string) => (await writes(page)).filter((w) => w.path === path).length;

test.describe('Desktop 1440 DE', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('P-01 Vorbereiten → Plan mit allen Bereichen, Fokus aus echten Fehlern, pp<ms> einmal angelegt, Kopieren', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://lingo.artifact.test' });
    const { errors, external } = await openPreply(page);
    await expect(page.getByTestId('pp-ctx')).toBeVisible();
    await page.getByTestId('pp-create').click();
    const plan = page.getByTestId('pp-plan');
    await expect(plan).toBeVisible();
    for (const id of ['pp-goal', 'pp-warmup', 'pp-talk', 'pp-say', 'pp-watch', 'pp-message']) await expect(page.getByTestId(id)).toBeVisible();
    const pps = (await docsOf(page, 'preply/pp')).filter(([k]) => k !== 'preply/pp1789581600000');
    expect(pps).toHaveLength(1);
    const [path, pp] = pps[0]!;
    expect(await countWrites(page, path)).toBe(1);
    expect(pp).toMatchObject({ lang: 'de', pv: 'preply-prep@2', done: false, minutes: 50 });
    // `watch` nur aus echten Fehlern (Grammatik offen).
    const givens = Object.entries(await dump(page))
      .filter(([k]) => k.startsWith('grammar/'))
      .flatMap(([, g]) => ((g.errors as Doc[] | undefined) ?? []).map((e) => e.given));
    for (const w of pp.watch as Doc[]) expect(givens).toContain(w.mistake);
    await page.getByTestId('pp-copy').click();
    await expect(page.getByTestId('pp-copied')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('P-01b Kopieren ohne Zwischenablage → Text markiert mit Hinweis', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('blocked')) }, configurable: true });
    });
    await openPreply(page);
    await page.getByTestId('pp-create').click();
    await page.getByTestId('pp-copy').click();
    await expect(page.getByTestId('copy-manual')).toBeVisible();
  });

  test('P-02 „Stunde gehalten" → Zustand, act.preply +1, Minuten +50, keine Serienfelder; Heute zeigt Extra ohne Zähler zu ändern', async ({ page }) => {
    await openPreply(page);
    const before = (await dump(page))['app/profile']!;
    await page.getByTestId('pp-create').click();
    await page.getByTestId('pp-held').click();
    await page.getByTestId('pp-held-confirm').click();
    await expect(page.getByTestId('pp-held-state')).toBeVisible();
    await expect(page.getByTestId('pp-held-state')).toContainText('50 Min.');
    await expect(page.getByTestId('pp-plan').getByTestId('pp-held')).toHaveCount(0);
    const d = await dump(page);
    const pp = (await docsOf(page, 'preply/pp')).find(([k]) => k !== 'preply/pp1789581600000')![1];
    expect(pp).toMatchObject({ done: true, heldDay: DAY, heldMin: 50 });
    const act = (p: Doc) => ((p.act as Record<string, Doc> | undefined)?.[DAY]?.preply as number | undefined) ?? 0;
    const min = (p: Doc) => ((p.minutes as Record<string, number> | undefined)?.[DAY] ?? 0);
    expect(act(d['app/profile']!)).toBe(act(before) + 1);
    expect(min(d['app/profile']!)).toBe(min(before) + 50);
    expect(d['app/profile']!.days).toEqual(before.days);
    expect(d['app/profile']!.xpDays).toEqual(before.xpDays);
    await page.getByTestId('pp-back').click();
    await screen(page, 'today');
    await expect(page.getByTestId('td-extra-preply')).toContainText('Preply-Stunde · 50 Min.');
    await expect(page.getByTestId('td-extra-preply').locator('button')).toHaveCount(0);
  });

  test('P-03 Import: pi<ms> vor der Übernahme, Vorschau mit Zuständen, je Ziel genau ein Schreibvorgang, Doppelklick ohne Doppel', async ({ page }) => {
    await openPreply(page);
    await page.getByTestId('pp-tab-import').click();
    await page.getByTestId('pi-raw').fill(RAW);
    await page.getByTestId('pi-analyze').click();
    await expect(page.getByTestId('pi-review')).toBeVisible();
    const pis = (await docsOf(page, 'preply/pi')).filter(([k]) => k !== 'preply/pi1789668000000');
    expect(pis).toHaveLength(1);
    const [piPath, pi] = pis[0]!;
    expect(pi).toMatchObject({ kind: 'import', applied: false, pv: 'preply-import@2' });
    expect(pi.tasks).toEqual(['It depends ___ the budget.', 'I ___ with your proposal.']);
    const words = page.locator('[data-testid="pi-item"][data-group="w"]');
    expect(await words.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))).toEqual(['selected', 'exists', 'invalid']);
    // Eine Übung abwählen.
    await page.locator('[data-testid="pi-item"][data-group="t"]').nth(1).getByRole('checkbox').uncheck();
    const writesBefore = (await writes(page)).length;
    await page.getByTestId('pi-apply').dblclick();
    await expect(page.getByTestId('pi-applied')).toBeVisible();
    // Nur die Schreibvorgänge der Übernahme zählen (beim Start verarbeitet der Tagesplan daily/* → app/pool, Phase 2).
    const applyWrites = (await writes(page)).slice(writesBefore);
    for (const p of ['vocab/would-rather', 'grammar/prepositions', 'app/radar', 'app/pool']) expect(applyWrites.filter((w) => w.path === p).length, p).toBe(1);
    expect(await countWrites(page, piPath)).toBe(2);
    expect(applyWrites.length).toBe(5);
    const d = await dump(page);
    expect(d[piPath]).toMatchObject({ applied: true, sel: { c: [0, 1], t: [0], w: [0] } });
    expect(d['vocab/would-rather']).toMatchObject({ src: 'preply', ex: 'I [would rather] start with a small pilot.', origin: { kind: 'preply' } });
    expect((d['grammar/prepositions']!.errors as Doc[])[0]).toMatchObject({ given: 'It depends of the budget.', box: 0, src: 'preply' });
    const pool = d['app/pool']!.items as Doc[];
    expect(pool.filter((i) => typeof i.id === 'string' && i.id.startsWith(piPath.slice(7)))).toHaveLength(1);
    const radar = d['app/radar']!.events as Doc[];
    // Sammel-Warteschlange (phase2-plan D5): nach Zeit sortiert, neueste hinten; Kategorien der alten App.
    expect(radar.slice(-2).map((e) => e.c).sort()).toEqual(['prep', 'wordchoice']);
  });

  test('P-04 Teilfehler (Übungsspeicher) → „Erneut übernehmen" → übernommen, keine Doppel', async ({ page }) => {
    await openPreply(page);
    await page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { failWritesTo(p: string, c: string): void } } }).__LINGO_FAKE__.db.failWritesTo('app/pool', 'resource_exhausted'));
    await page.getByTestId('pp-tab-import').click();
    await page.getByTestId('pi-raw').fill(RAW);
    await page.getByTestId('pi-analyze').click();
    await page.getByTestId('pi-apply').click();
    await expect(page.getByTestId('pi-partial')).toBeVisible();
    await page.getByTestId('pi-retry-apply').click();
    await expect(page.getByTestId('pi-applied')).toBeVisible();
    const d = await dump(page);
    const ids = (d['app/pool']!.items as Doc[]).map((i) => i.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
    expect(((d['grammar/prepositions']!.errors as Doc[]) ?? []).length).toBe(1);
    expect(await countWrites(page, 'vocab/would-rather')).toBe(1);
  });

  test('P-06 ohne Claude: keine KI-Knöpfe; „Stunde ohne Plan" funktioniert', async ({ page }) => {
    await openPreply(page, { fake: { capabilities: { sample: false } } });
    await expect(page.locator('[data-ai]')).toHaveCount(0);
    await page.getByTestId('pp-tab-import').click();
    await expect(page.locator('[data-ai]')).toHaveCount(0);
    await page.getByTestId('pp-tab-history').click();
    await page.getByTestId('pp-held-noplan').click();
    await page.getByTestId('pp-held-confirm').click();
    await expect(page.locator('[data-testid="pv-item"][data-kind="plan"][data-state="done"]')).toHaveCount(2);
    const act = ((await dump(page))['app/profile']!.act as Record<string, Doc>)[DAY]!;
    expect(act.preply).toBe(1);
  });

  test('P-07 Stopp während der Analyse → Text bleibt, nichts geschrieben', async ({ page }) => {
    await openPreply(page, { fake: { sampleDelayMs: 20_000 } });
    await page.getByTestId('pp-tab-import').click();
    await page.getByTestId('pi-raw').fill(RAW);
    await page.getByTestId('pi-analyze').click();
    await expect(page.getByTestId('ai-phase')).toBeVisible();
    await page.getByTestId('ai-stop').click();
    await expect(page.getByTestId('pi-raw')).toHaveValue(RAW);
    expect((await writes(page)).filter((w) => w.path.startsWith('preply/'))).toHaveLength(0);
  });
});

test.describe('EN', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('P-05 Verlauf zeigt Seed-Plan (gehalten) und Seed-Import (übernommen, Aufgaben als Text)', async ({ page }) => {
    await openPreply(page, { lang: 'en' });
    await page.getByTestId('pp-tab-history').click();
    await expect(page.locator('[data-testid="pv-item"][data-id="pp1789581600000"]')).toHaveAttribute('data-state', 'done');
    await expect(page.locator('[data-testid="pv-item"][data-id="pi1789668000000"]')).toHaveAttribute('data-state', 'applied');
    await page.locator('[data-testid="pv-item"][data-id="pi1789668000000"] button').click();
    await expect(page.getByTestId('pi-detail')).toContainText('Write five sentences with "would rather".');
    await page.getByTestId('pi-hw').first().getByRole('checkbox').click();
    await expect(page.getByTestId('pi-hw').first()).toHaveAttribute('data-state', 'done');
    expect(((await dump(page))['preply/pi1789668000000']!.hwDone as Record<string, string>)['0']).toBe(DAY);
    expect(await layoutProblems(page)).toEqual([]);
  });

  test('neuer Plan auf Englisch: Ziel steht genau einmal', async ({ page }) => {
    await openPreply(page, { lang: 'en' });
    await page.getByTestId('pp-create').click();
    const goal = page.getByTestId('pp-goal');
    await expect(goal).toBeVisible();
    const first = (await goal.locator('p').first().innerText()).trim();
    expect(first.length).toBeGreaterThan(0);
    await expect(page.getByTestId('pp-goal-en')).toHaveCount(0);
    expect((await goal.innerText()).split(first).length - 1).toBe(1);
  });
});

test.describe('Handy 390 (Touch)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('P-03 mobil: Import und Übernahme, kein Querscrollen', async ({ page }) => {
    await openPreply(page);
    await page.getByTestId('pp-tab-import').tap();
    await page.getByTestId('pi-raw').fill(RAW);
    await page.getByTestId('pi-analyze').tap();
    await expect(page.getByTestId('pi-review')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('pi-apply').tap();
    await expect(page.getByTestId('pi-applied')).toBeVisible();
  });
});
