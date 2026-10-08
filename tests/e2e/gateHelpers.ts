import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { findContext } from '../../src/domain/srs/context';
import { boot, openTab, screen } from './fixtures';
import { dump, writes } from './trainerHelpers';

// Gemeinsame Helfer der Kapitelprüfung-Tests (gate.spec.ts, r4kpShots.spec.ts): Kapitel 1 bereit machen, die Prüfung mit Antworten aus dem Vorrat durchspielen.

export type Doc = Record<string, unknown>;
type Item = {
  id: string;
  kind: 'ocl' | 'kwt' | 'err';
  text?: string;
  accept?: string[];
  key?: string;
  keys?: Array<{ a: string[]; b: string[] }>;
  tiles?: string[];
  bad?: { span: string } | null;
};

export const GATE = (JSON.parse(readFileSync(new URL('../../src/content/c1x/src/gate/k1.json', import.meta.url), 'utf8')) as { items: Item[] }).items;
export const BY_ID = new Map(GATE.map((i) => [i.id, i]));
const PROGRAM = JSON.parse(readFileSync(new URL('../../src/content/c1/program.json', import.meta.url), 'utf8')) as { chapters: Array<{ id: string; topics: string[] }> };
export const K1 = PROGRAM.chapters[0]?.topics ?? [];
export const LAST = Date.parse('2026-09-19T12:00:00+02:00');

/** Thema, das gelernt und sicher ist, mit Einführung am `intro`-Tag und Beherrschung `p`. */
export function topicDoc(topic: string, o: { intro?: string; p?: number } = {}): Doc {
  const file = JSON.parse(readFileSync(new URL(`../../src/content/grammar/patterns/${topic}.json`, import.meta.url), 'utf8')) as { patterns: Array<{ id: string }> };
  const pats: Doc = {};
  for (const p of file.patterns) pats[p.id] = { n: 3, c: 3, last: LAST, h: 0, r: 3, k: 2, dd: ['2026-09-17', '2026-09-18'], i: o.intro ?? '2026-08-01', s: '2026-09-18' };
  const p = o.p ?? 0.85;
  return { id: topic, p, anchor: p, anchorD: '2026-09-01', n: 12, c: 10, due: LAST, last: LAST, recent: [1, 1, 1, 1], seen: [], seenText: [], hist: [{ d: o.intro ?? '2026-08-01', p: 0.5 }], errors: [], pats };
}
export const chapterOnePatch = (o: { intro?: string; p?: number; skip?: string[] } = {}): Record<string, Doc> =>
  Object.fromEntries(K1.filter((t) => !(o.skip ?? []).includes(t)).map((t) => [`grammar/${t}`, topicDoc(t, o)]));

export async function start(page: Page, patch: Record<string, Doc>, now?: string) {
  const booted = await boot(page, { migrated: true, ...(now ? { now } : {}), fake: { patch } });
  await screen(page, 'today');
  await openTab(page, 'learn');
  await expect(page.getByTestId('learn-hub')).toBeVisible();
  return booted;
}

/** Zahl der bisherigen Schreibvorgänge (vor dem Start der Prüfung); `since` liefert nur, was danach dazukam. */
export const mark = async (page: Page): Promise<number> => (await writes(page)).length;
export const since = async (page: Page, n: number): Promise<string[]> => (await writes(page)).slice(n).map((w) => w.path);

export async function openChapterOne(page: Page): Promise<void> {
  await page.locator('[data-testid="program-chapter"][data-chapter="k1"] [data-testid="program-chapter-open"]').click();
  await expect(page.getByTestId('chapter-sheet')).toBeVisible();
}

/** Eine Grammatikaufgabe der Prüfung richtig beantworten (Antwort aus dem Vorrat); `wrong` = „Weiß ich nicht“. */
export async function answerItem(page: Page, wrong: boolean): Promise<string> {
  const el = page.getByTestId('place-item');
  await expect(el).toBeVisible();
  const id = (await el.getAttribute('data-id')) ?? '';
  const it = BY_ID.get(id);
  if (!it) throw new Error(`Aufgabe ${id} nicht im Vorrat`);
  if (wrong) {
    await page.getByTestId('place-dontknow').click();
    return id;
  }
  if (it.kind === 'ocl') {
    await page.getByTestId('place-gap').fill(it.accept?.[0] ?? '');
    await page.getByTestId('place-next').click();
  } else if (it.kind === 'err') {
    if (!it.bad) await page.getByTestId('place-none').click();
    else {
      const words = (it.text ?? '').split(/\s+/);
      const span = it.bad.span.split(/\s+/).map((w) => w.replace(/[.,;:!?"“”]/g, '').toLowerCase());
      const at = words.findIndex((_, i) => span.every((s, j) => (words[i + j] ?? '').replace(/[.,;:!?"“”]/g, '').toLowerCase() === s));
      await page.getByTestId('place-word').nth(at).click();
    }
    await page.getByTestId('place-next').click();
  } else {
    const k = it.keys?.[0];
    const solution = `${k?.a[0] ?? ''} ${k?.b[0] ?? ''}`.toLowerCase().replace(/[^a-z' ]/g, '').split(/\s+/).filter(Boolean);
    for (const w of solution) {
      // Die Bausteine tragen die Schreibweise des Vorrats (Dana, Thursday, I, QA …); das Schlüsselwort steht in Großbuchstaben.
      const text = w === (it.key ?? '').toLowerCase() ? (it.key as string) : ((it.tiles ?? []).find((t) => t.toLowerCase() === w) ?? w);
      await page.locator(`[data-testid="tile-pool"] [data-testid="tile"][data-tile="${text}"]`).first().click();
    }
    await page.getByTestId('place-next').click();
  }
  return id;
}

/** Ein Kapitelwort richtig tippen (Vokabelkarten); bei Wendungskarten „Weiß ich nicht“. Liefert, ob es beantwortet wurde. */
export async function answerWord(page: Page, wrong: boolean): Promise<boolean> {
  const el = page.getByTestId('gate-word');
  await expect(el).toBeVisible();
  if (wrong) {
    await page.getByTestId('gate-word-dontknow').click();
    return false;
  }
  const id = (await el.getAttribute('data-card')) ?? '';
  const doc = (await dump(page))[`vocab/${id}`];
  const gap = doc && typeof doc.word === 'string' ? findContext(doc.ex, doc.word)?.gap : undefined;
  if (!gap) {
    await page.getByTestId('gate-word-dontknow').click();
    return false;
  }
  await page.getByTestId('gate-word-input').fill(gap);
  await page.getByTestId('gate-word-next').click();
  return true;
}

/** Die ganze Prüfung durchspielen. `grammarRight` / `wordsRight` bestimmen, ob richtig beantwortet wird. */
export async function runGate(page: Page, o: { grammarRight: boolean; wordsRight: boolean }): Promise<{ items: string[]; wordsAnswered: number }> {
  await page.getByTestId('gate-go').click();
  const items: string[] = [];
  for (let k = 0; k < 30; k++) {
    await expect(page.getByTestId('place-item').or(page.getByTestId('gate-word')).or(page.getByTestId('gate-result'))).toBeVisible();
    if (await page.getByTestId('place-item').count()) items.push(await answerItem(page, !o.grammarRight));
    else break;
  }
  let wordsAnswered = 0;
  for (let k = 0; k < 10; k++) {
    await expect(page.getByTestId('gate-word').or(page.getByTestId('gate-result'))).toBeVisible();
    if (!(await page.getByTestId('gate-word').count())) break;
    if (await answerWord(page, !o.wordsRight)) wordsAnswered++;
  }
  await expect(page.getByTestId('gate-result')).toBeVisible();
  return { items, wordsAnswered };
}

