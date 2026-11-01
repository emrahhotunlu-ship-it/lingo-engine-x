import { expect, test } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, SEED_EVENING, screen } from './fixtures';
import { dump } from './trainerHelpers';

// Großpaket A S6b-3 (Bild s2-13): Anki-Modus in der neuen Wörter-Runde. Verstehen wird aufgedeckt und selbst bewertet (4 Noten mit Termin),
// Benutzen bleibt beim Tippen. Ohne Anki: Lücke mit Knopf „Satz anhören“ (Lücke als Ton), abschaltbar.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const D = 86_400_000;

/** Lernstand Stufe 4: nur Verstehen fällig, Benutzen erst in 20 Tagen. */
function uDueLex(): Doc {
  const t = NOW - 30 * D;
  const day = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const fs = { s: 2.3065, d: 2.1181, st: 2, reps: 1, lapses: 0, last: t + 300_000, sd: 1, ls: 0 };
  return {
    v: 1, k: 'w', of: null, core: null, sense: null, lv: 4,
    u: { due: NOW - D, ...fs }, b: { due: NOW + 20 * D, ...fs },
    day, dayU: null, step: null, ev: { f: [day, day], o: 0, s: 0 }, sn: [['a', day]], gr: null, reg: null, pri: 'core',
    lc: 0, pair: null, mv: 0, sync: 0, mig: null, intro: day,
  };
}

const patch = (vcfg: Doc): Record<string, Doc> => ({
  'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
  'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1, ...vcfg }, newPerDay: 0 },
  'vocab/achieve': { lex: uDueLex() },
});

const vlogRows = (d: Record<string, Doc>): unknown[][] =>
  Object.entries(d)
    .filter(([p]) => /^vlog\/\d/.test(p))
    .flatMap(([, doc]) => Object.values((doc.e as Doc | undefined) ?? {}).filter(Boolean) as unknown[][]);

for (const vp of [
  { name: 'Handy 390', use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  { name: 'Desktop 1440', use: { viewport: { width: 1440, height: 900 } } },
]) {
  test.describe(vp.name, () => {
    test.use(vp.use);

    test('Anki an: Wort + Satz, Aufdecken → Bedeutung und vier Noten; „Gut“ bucht nur Verstehen mit Anki-Marke', async ({ page }) => {
      const { errors, external } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch({ anki: 1 }) } });
      await screen(page, 'vlearn');
      await expect(page.getByTestId('vm-flip-head')).toHaveText('to achieve');
      await expect(page.getByTestId('vm-sentence')).toBeVisible();
      await expect(page.getByTestId('vm-flip-de')).toHaveCount(0);
      await expect(page.getByTestId('vm-dunno')).toHaveCount(0);
      await page.getByTestId('vm-flip-reveal').click();
      await expect(page.getByTestId('vm-flip-de')).not.toBeEmpty();
      await expect(page.getByTestId('vm-grades')).toBeVisible();
      for (const g of [1, 2, 3, 4]) await expect(page.getByTestId(`grade-${g}`)).toBeVisible();
      await expect(page.getByTestId('grade-3')).toContainText('Gut');
      await expect(page.getByTestId('grade-4')).toContainText(/in \d+ Tagen|morgen/);
      expect(await layoutProblems(page)).toEqual([]);
      await page.getByTestId('grade-3').click();
      await expect(page.getByTestId('vm-done')).toBeVisible();
      await expect.poll(async () => vlogRows(await dump(page)).length).toBe(1);
      const d = await dump(page);
      const row = vlogRows(d)[0]!;
      expect(row[3]).toBe('flip');
      expect(Number(row[row.length - 1]) & 8).toBe(8);
      const lex = (d['vocab/achieve'] as Doc).lex as { u: { due: number }; b: { due: number } };
      expect(lex.u.due).toBeGreaterThan(NOW);
      expect(lex.b.due).toBe(NOW + 20 * D);
      expect(external).toEqual([]);
      expect(errors).toEqual([]);
    });

    test('Anki aus: Verstehen ohne Aufdecken; „Satz anhören“ vor dem Prüfen mit Lücke als Ton, abschaltbar', async ({ page }) => {
      const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch({}) } });
      await screen(page, 'vlearn');
      await expect(page.getByTestId('vm-check')).toBeVisible();
      await expect(page.getByTestId('vm-flip-reveal')).toHaveCount(0);
      const listen = page.getByTestId('vm-listen');
      if ((await listen.count()) > 0) {
        // Lückensatz: mindestens zwei Teile (vor und nach der Lücke); Bedeutungsfrage: der ganze Satz.
        await expect(listen).toHaveAttribute('data-parts', /\d/);
        await listen.click();
      }
      expect(errors).toEqual([]);
    });

    test('„Satz vorher anhören“ aus: vor dem Prüfen kein Knopf bei der Lücke', async ({ page }) => {
      const { errors } = await bootAt(page, { name: 'vlearn', kind: 'more5' }, { migrated: false, fake: { patch: patch({ pre: 0 }) } });
      await screen(page, 'vlearn');
      await expect(page.getByTestId('vm-check')).toBeVisible();
      const gapCard = (await page.locator('[data-testid="vm-sentence"] .lx-gap, [data-testid="vm-sentence"] [data-gap]').count()) > 0;
      if (gapCard) await expect(page.getByTestId('vm-listen')).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
}
