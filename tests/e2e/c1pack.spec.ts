import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boot, layoutProblems, openTab, screen } from './fixtures';
import { TYPE_MODE, dump, planPatch, type Dump } from './trainerHelpers';
import { ankiPatch } from './wortschatzHelpers';

// Paket 2 (Emrah 02.10.2026, Gutachten des Englischlehrers): das C1-Paket kommt täglich mit höchstens 2 Einträgen als neue
// Karten in den Wortschatz, und Claude liefert beim ersten Aufdecken typische Wortpartner, die als „von Claude“ gekennzeichnet
// sind und per „Ich lag richtig“ bestritten werden dürfen.

type Doc = Record<string, unknown>;
const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Dump;

type Calls = Array<{ id: string | null; tier: string; input: string }>;
const sampleCalls = (page: Page): Promise<Calls> => page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { sampleCalls: Calls } }).__LINGO_FAKE__.sampleCalls]);

/** Karten aus dem C1-Paket in der Datenbank (Herkunft `c1pack/<id>` in `origin.ref` bzw. `src.ref`). */
function packDocs(all: Dump): Array<{ path: string; doc: Doc; ref: string }> {
  return Object.entries(all).flatMap(([path, doc]) => {
    if (!path.startsWith('vocab/') && !path.startsWith('chunk/')) return [];
    const o = doc.origin as { ref?: unknown } | undefined;
    const s = doc.src as { ref?: unknown } | undefined;
    const ref = typeof o?.ref === 'string' ? o.ref : typeof s?.ref === 'string' ? s.ref : '';
    return ref.startsWith('c1pack/') ? [{ path, doc, ref }] : [];
  });
}

test.describe('Desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Zulauf: der erste Start des Lerntages legt genau 2 Paket-Karten an, nach dem Neuladen am selben Tag kommen keine dazu; Stapel „C1-Paket“ im Wortschatz', async ({ page }) => {
    const { errors, external } = await boot(page, { migrated: true, fake: { persist: true } });
    await screen(page, 'today');
    await expect.poll(async () => packDocs(await dump(page)).length).toBe(2);
    const first = packDocs(await dump(page));
    expect(new Set(first.map((p) => p.ref)).size).toBe(2);
    for (const p of first) {
      expect(p.ref).toMatch(/^c1pack\/[a-z]+-\d{2,3}$/);
      expect(p.doc.state).toBe('new');
    }

    // Neuladen am selben Tag (gleiche Datenbank): es kommt nichts dazu, die beiden Karten bleiben unverändert.
    await page.reload();
    await screen(page, 'today');
    await page.waitForTimeout(1000);
    const again = packDocs(await dump(page));
    expect(again.map((p) => p.ref).sort()).toEqual(first.map((p) => p.ref).sort());
    for (const p of again) expect(p.doc).toEqual(first.find((f) => f.path === p.path)?.doc);

    // Der Stapel „C1-Paket“ ist sichtbar, mit allen Karten als „neu“.
    await openTab(page, 'vocab');
    await page.getByTestId('ws-decks-all').click();
    const row = page.locator('[data-testid="ws-deck"][data-deck="src:pack"]');
    await expect(row).toBeVisible();
    await expect(row).toContainText('C1-Paket');
    await row.click();
    await screen(page, 'deck');
    await expect(page.getByTestId('deck-cards').locator('li')).toHaveCount(2);
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Zulauf: bei „Neue Wörter pro Tag“ = 0 kommt nichts aus dem Paket', async ({ page }) => {
    const { errors } = await boot(page, { migrated: true, fake: { patch: { 'app/profile': { newPerDay: 0 } } } });
    await screen(page, 'today');
    await page.waitForTimeout(1200);
    expect(packDocs(await dump(page))).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Wortpartner von Claude: beim ersten Aufdecken ergänzt, geprüft gespeichert (ai), als „von Claude“ gekennzeichnet; nur eine Anfrage je Karte', async ({ page }) => {
    const { patch } = ankiPatch(0);
    const card: Doc = {
      word: 'colqrun',
      de: 'vorantreiben',
      def: 'to move something forward (test word)',
      ex: 'We [colqrun] the project together every week.',
      pos: 'verb',
      level: 'B2',
      state: 'review',
      stage: 1,
      S: 3,
      D: 5,
      due: 1_600_000_000_000,
      last: 1_599_000_000_000,
      reps: 3,
      lapses: 0,
      hist: [],
      src: 'lookup',
      added: '2026-09-01',
    };
    const { errors } = await boot(page, { migrated: true, fake: { patch: { ...patch, 'app/profile': planPatch(1), 'app/decks': { v: 1, prefs: { mode: 'flip', dir: 'de-en', grades: 4 } }, 'vocab/colqrun': card } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('flip')).toHaveAttribute('data-card', 'colqrun');
    await page.keyboard.press(' ');
    await page.getByTestId('word-more').click();
    const col = page.getByTestId('word-col');
    await expect(col).toBeVisible();
    await expect(col).toContainText('colqrun the plan');
    await expect(page.getByTestId('word-col-ai')).toContainText('von Claude');
    await expect.poll(async () => ((await dump(page))['vocab/colqrun']?.col as Doc[] | undefined)?.length ?? 0).toBe(1);
    const saved = ((await dump(page))['vocab/colqrun']?.col as Doc[])[0];
    expect(saved).toMatchObject({ p: 'colqrun the plan', gap: 'plan', ai: 1 });
    expect((saved?.opts as string[]).length).toBeGreaterThanOrEqual(2);
    const calls = (await sampleCalls(page)).filter((c) => c.id === 'card-examples');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.tier).toBe('quick');
    expect(errors).toEqual([]);
  });

  /** Karte `handle` auf Stufe 4 mit dem Wortpartner als schwächster Übung, mit oder ohne Kennzeichnung „von Claude“. */
  async function collocRound(page: Page, ai: boolean) {
    const { patch } = ankiPatch(0);
    const own = { p: 'handle a complaint', de: 'eine Beschwerde bearbeiten', gap: 'complaint', opts: ['request', 'proposal', 'invoice'], ex: 'We [handle a complaint] politely.', ...(ai ? { ai: 1 } : {}) };
    const handle = { ...(SEED['vocab/handle'] ?? {}), col: [own], state: 'learning', stage: 4, S: 1, D: 5, due: 1_700_000_000_000, last: 1_699_900_000_000, reps: 3, lapses: 0, xs: { colloc: { c: 0, w: 6 }, type: { c: 6, w: 0 }, cloze: { c: 6, w: 0 } } };
    const booted = await boot(page, { migrated: true, fake: { patch: { ...patch, ...TYPE_MODE, 'app/profile': planPatch(1), 'vocab/handle': handle } } });
    await screen(page, 'today');
    await page.getByTestId('start').click();
    await screen(page, 'trainer');
    await expect(page.getByTestId('exercise')).toHaveAttribute('data-ex', 'colloc');
    // Der Wortpartner wird getippt; eine falsche Eingabe bekommt erst einen Hinweis, dann das Ergebnis.
    await page.getByTestId('gap-input').click();
    await page.keyboard.type('zzzz', { delay: 20 });
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hint-line')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'wrong');
    return booted;
  }

  test('Wortpartner von Claude: bei falscher Wahl der Hinweis „kann Fehler enthalten“ und der Einspruch „Ich lag richtig“ wertet als richtig', async ({ page }) => {
    const { errors } = await collocRound(page, true);
    await expect(page.getByTestId('colloc-ai-note')).toContainText('kann Fehler enthalten');
    await page.getByTestId('exercise-menu').click();
    await page.getByTestId('menu-override').click();
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-verdict', 'ok');
    expect(errors).toEqual([]);
  });

  test('eigene Wortpartner (ohne ai): kein Hinweis „von Claude“', async ({ page }) => {
    const { errors } = await collocRound(page, false);
    await expect(page.getByTestId('colloc-ai-note')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
