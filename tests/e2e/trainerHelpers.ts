import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';

// Hilfen für Heute und Trainer: Datenbank-Abzug und die erwartete Lösung je Übung,
// berechnet aus den Testdaten (nicht aus der Oberfläche).

type Doc = Record<string, unknown>;
export type Dump = Record<string, Doc>;

export const dump = (page: Page): Promise<Dump> =>
  page.evaluate(() => (window as unknown as { __LINGO_FAKE__: { db: { dump(): Dump } } }).__LINGO_FAKE__.db.dump());

export const writes = (page: Page): Promise<Array<{ op: string; path: string }>> =>
  page.evaluate(() => [...(window as unknown as { __LINGO_FAKE__: { db: { writes(): Array<{ op: string; path: string }> } } }).__LINGO_FAKE__.db.writes()]);

const SEED = JSON.parse(readFileSync(new URL('../../seed/sample-data.json', import.meta.url), 'utf8')) as Record<string, Doc>;

export const DAY = '2026-09-20';

/** Plan dieser App für den Stichtag mit fester Zielmenge (sonst berechnet die App ihn selbst). */
export const planPatch = (review: number) => ({
  newPerDay: 0,
  plan: { d: DAY, v: 1, ids: [], why: [], duty: review > 0 ? ['review'] : [], goal: { review }, lesson: null, at: 1 },
});

/** Karten, die an erster Stelle fällig sind und deren schwächste Übung feststeht. */
export const FORCED: Record<string, { stage: number; xs: Record<string, { c: number; w: number }> }> = {
  deserve: { stage: 1, xs: { mc_en: { c: 0, w: 6 }, mc_de: { c: 6, w: 0 } } },
  convince: { stage: 2, xs: { mc_de: { c: 0, w: 6 }, cloze_hint: { c: 6, w: 0 }, mc_en: { c: 6, w: 0 } } },
  avoid: { stage: 3, xs: { cloze_hint: { c: 0, w: 6 }, type: { c: 6, w: 0 } } },
  overcome: { stage: 4, xs: { cloze: { c: 0, w: 6 }, type: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } } },
  struggle: { stage: 4, xs: { type: { c: 0, w: 6 }, cloze: { c: 6, w: 0 }, colloc: { c: 6, w: 0 } } },
  handle: { stage: 4, xs: { colloc: { c: 0, w: 6 }, type: { c: 6, w: 0 }, cloze: { c: 6, w: 0 } } },
};

export function forcedPatch(): Record<string, Doc> {
  const out: Record<string, Doc> = {};
  Object.entries(FORCED).forEach(([id, f], i) => {
    out[`vocab/${id}`] = { state: 'learning', stage: f.stage, S: 1, D: 5, due: 1_700_000_000_000 + i * 1000, last: 1_699_900_000_000, reps: 3, lapses: 0, xs: f.xs };
  });
  return out;
}

const bracket = (ex: unknown) => /\[([^\]]+)\]/.exec(typeof ex === 'string' ? ex : '')?.[1]?.trim() ?? '';

/** Richtige Antwort je Übung – aus den Testdaten. */
export function expected(ex: string, id: string, col: number | null): string {
  const d = SEED[`vocab/${id}`] ?? {};
  switch (ex) {
    case 'mc_en':
      return (String(d.de).split(/[;,]/)[0] ?? '').trim();
    case 'mc_de':
    case 'type':
      return String(d.word);
    case 'cloze':
    case 'cloze_hint':
      return bracket(d.ex);
    case 'colloc':
      {
        const gap = (Array.isArray(d.col) ? (d.col[col ?? 0] as Doc) : {}).gap;
        return typeof gap === 'string' ? gap : '';
      }
    default:
      throw new Error(`unbekannte Übung ${ex}`);
  }
}

/** Beantwortet die aktuelle Übung richtig (Tastatur) und übernimmt den Vorschlag. Rückgabe: Übungsart. */
export async function answerCurrent(page: Page, opts: { wrong?: boolean } = {}): Promise<string> {
  // Erst antworten, wenn genau eine Übung steht (kein Übergang mehr läuft).
  await expect(page.locator('[data-step]')).toHaveCount(1);
  const step = await page.locator('[data-step]').getAttribute('data-step');
  const exEl = page.getByTestId('exercise');
  await expect(exEl).toBeVisible();
  const ex = (await exEl.getAttribute('data-ex')) ?? '';
  const id = (await exEl.getAttribute('data-card')) ?? '';
  const colAttr = await exEl.getAttribute('data-col');
  const answer = expected(ex, id, colAttr === null ? null : Number(colAttr));
  if (ex === 'mc_en' || ex === 'mc_de' || ex === 'colloc') {
    const labels = await page.getByTestId('choice').allInnerTexts();
    const idx = labels.findIndex((l) => l.replace(/^\d+\s*/, '').trim() === answer);
    expect(idx, `${ex} ${id}: „${answer}" in ${labels.join(' | ')}`).toBeGreaterThanOrEqual(0);
    const pick = opts.wrong ? (idx + 1) % labels.length : idx;
    await page.keyboard.press(String(pick + 1));
  } else {
    await page.getByTestId('gap-input').click();
    await page.keyboard.type(opts.wrong ? 'zzzz' : answer, { delay: 30 });
    await page.keyboard.press('Enter');
  }
  await expect(page.getByTestId('why')).toBeVisible();
  await expect(page.getByTestId('rating')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page.locator(`[data-step="${step ?? ''}"]`)).toHaveCount(0);
  return ex;
}
