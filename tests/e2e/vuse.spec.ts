import { expect, test, type Page } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, SEED_EVENING, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Großpaket A S5c-4: Anwenden (Bilder s2-07 … s2-12). Drei gelernte Wörter, deren Benutzen-Termin ansteht → Anwenden-Karte mit Lage.
// Mit Claude: schreiben → Prüfen → Urteil je Wort → Weiter bucht je Wort einmal. `#odd` (Testantwort) → fast richtig, bessere Fassung erst
// auf Wunsch. Ohne Claude: Muster zum Vergleich, „Später prüfen lassen“ merkt den Text in `vmod/use`.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const D = 86_400_000;
const PATHS = ['vocab/access-rights', 'vocab/achieve', 'vocab/affect'];
const TEXT = 'We cannot achieve the launch date unless IT fixes the access rights, and the delay will affect the budget.';

/** Gelerntes Wort auf Stufe 5 (Form wie `learned()` in tests/unit/vocab/learnUse.test.ts), Benutzen-Termin in zwei Tagen. */
function learnedLex(): Doc {
  const t = NOW - 30 * D;
  const day = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const fs = { s: 2.3065, d: 2.1181, st: 2, reps: 1, lapses: 0, last: t + 300_000, sd: 1, ls: 0 };
  return {
    v: 1, k: 'w', of: null, core: null, sense: null, lv: 5,
    u: { due: NOW + 30 * D, ...fs }, b: { due: NOW + 2 * D, ...fs },
    day, dayU: null, step: null, ev: { f: [], o: 0, s: 0 }, sn: [['a', day]], gr: null, reg: null, pri: 'core', lc: 0, pair: null, mv: 0, sync: 0, mig: null, intro: day,
    fq: { l: 'gap', c: 0, h: { gap_hint: [1, 1], gap: [1, 1] }, nb: 0, ak: null, ew: [] },
  };
}

function patch(): Record<string, Doc> {
  const p: Record<string, Doc> = {
    'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
    // Keine neuen Wörter: sonst füllt S7 Neues nach, und die Anwenden-Karte kommt später (die Runde beginnt mit neuen Wörtern).
    'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1 }, newPerDay: 0 },
  };
  for (const path of PATHS) p[path] = { lex: learnedLex() };
  return p;
}

const vlogEntries = (d: Record<string, Doc>): number =>
  Object.entries(d)
    .filter(([p]) => /^vlog\/\d/.test(p))
    .reduce((n, [, doc]) => n + Object.values((doc.e as Doc | undefined) ?? {}).filter(Boolean).length, 0);

async function toUse(page: Page): Promise<void> {
  await screen(page, 'vlearn');
  const go = page.getByTestId('vm-start-go');
  await expect(go.or(page.getByTestId('vm-use-input')).or(page.getByTestId('vm-check')).first()).toBeVisible();
  if (await go.isVisible()) await go.click();
  await expect(page.getByTestId('vm-use-sit')).toBeVisible();
}

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('mit Claude: Lage, Wörter leuchten beim Schreiben, Prüfen → je Wort richtig, Weiter bucht je Wort einmal', async ({ page }) => {
    const { errors, external } = await bootAt(page, { name: 'vlearn', kind: 'pflicht' }, { migrated: false, fake: { patch: patch() } });
    await toUse(page);
    await expect(page.getByTestId('vm-use-chip')).toHaveCount(3);
    await expect(page.getByTestId('vm-use-check')).toBeDisabled();
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vm-use-input').fill('We need to achieve more.');
    await expect(page.locator('[data-testid="vm-use-chip"][data-used]')).toHaveCount(1);
    await page.getByTestId('vm-use-input').fill(TEXT);
    await expect(page.locator('[data-testid="vm-use-chip"][data-used]')).toHaveCount(3);
    await page.getByTestId('vm-use-check').click();
    await expect(page.getByTestId('vm-use-judged')).toBeVisible();
    await expect(page.locator('[data-testid="vm-use-row"][data-v="ok"]')).toHaveCount(3);
    await expect(page.getByTestId('vm-use-text-mark')).toHaveCount(3);
    await expect(page.getByTestId('vm-use-fx')).toContainText('rücken weiter');
    // Bessere Fassung erst auf Wunsch.
    await expect(page.getByTestId('vm-use-better')).toHaveCount(0);
    await page.getByTestId('vm-use-reveal').click();
    await expect(page.getByTestId('vm-use-better')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(vlogEntries(await dump(page))).toBe(0);
    await page.getByTestId('vm-use-next').click();
    await expect.poll(async () => vlogEntries(await dump(page))).toBe(3);
    await expect.poll(async () => {
      const d = await dump(page);
      return PATHS.map((p) => ((d[p]?.lex as Doc).ev as Doc).o);
    }).toEqual([1, 1, 1]);
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('fast richtig: Warum offen, Selbst verbessern zeigt danach Korrektur und bessere Fassung', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'pflicht' }, { migrated: false, fake: { patch: patch() } });
    await toUse(page);
    await page.getByTestId('vm-use-input').fill(`${TEXT} #odd`);
    await page.getByTestId('vm-use-check').click();
    await expect(page.locator('[data-testid="vm-use-row"][data-v="odd"]')).toHaveCount(1);
    // Falsch/fast richtig steht oben, das Warum ist offen.
    await expect(page.getByTestId('vm-use-row').first()).toHaveAttribute('data-v', 'odd');
    await expect(page.getByTestId('vm-use-row').first().getByTestId('vm-use-why')).toContainText('Präposition');
    await page.getByTestId('vm-use-redo').click();
    await expect(page.getByTestId('vm-use-redo-input')).toBeVisible();
    await page.getByTestId('vm-use-redo-input').fill(TEXT);
    await page.getByTestId('vm-use-redo').click();
    await expect(page.getByTestId('vm-use-redo-text')).toBeVisible();
    await expect(page.getByTestId('vm-use-better')).toBeVisible();
    await expect(page.getByTestId('vm-use-fixed')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('ohne Claude: Muster zum Vergleich, „Später prüfen lassen“ merkt den Text', async ({ page }) => {
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'pflicht' }, { migrated: false, fake: { patch: patch(), capabilities: { sample: false } } });
    await toUse(page);
    await page.getByTestId('vm-use-input').fill(TEXT);
    await page.getByTestId('vm-use-check').click();
    await expect(page.getByTestId('vm-use-self')).toBeVisible();
    await expect(page.getByTestId('vm-use-noai')).toBeVisible();
    await expect(page.getByTestId('vm-use-model')).toContainText('access rights');
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vm-use-later').click();
    await expect(page.getByTestId('vm-use-later-on')).toBeVisible();
    await page.getByTestId('vm-use-next').click();
    await expect.poll(async () => (((await dump(page))['vmod/use']?.later as Doc[] | undefined) ?? []).length).toBe(1);
    expect(errors).toEqual([]);
  });
});
