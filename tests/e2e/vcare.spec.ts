import { expect, test } from '@playwright/test';
import { bootAt, layoutProblems, MIGRATED, SEED_EVENING, screen } from './fixtures';
import { dump } from './trainerHelpers';
import { carePatch, SAMPLE_FAM, SAMPLE_DUP } from '../../src/platform/dev/careSample';

// Wörter-Pflege und Wortfamilie (Emrah 25.11.2026, docs/umbau/vokabeln/pflege.md): Aufträge aus dem Pflege-Dokument werden beim Start
// angewendet (korrigieren, Familie, verknüpfen, zusammenführen; veralteter Auftrag übersprungen), die Wortseite zeigt Familie und
// „Gehört zusammen mit“, und die Abfrage „Wortfamilie“ erscheint in der Wiederholung und wird benotet. Nur erfundene Daten.

type Doc = Record<string, unknown>;
const NOW = Date.parse(SEED_EVENING);
const D = 86_400_000;
const CARE = 'vmod/care';

function lexAt(lv: number, gapN: number): Doc {
  const t = NOW - 30 * D;
  const day = new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const fs = { s: 12, d: 3, st: 2, reps: 4, lapses: 0, last: t, sd: 1, ls: 0 };
  return {
    v: 1,
    k: 'w',
    of: null,
    core: null,
    sense: null,
    lv,
    u: { due: NOW + 20 * D, ...fs },
    b: { due: NOW - D, ...fs },
    day: null,
    dayU: null,
    step: null,
    ev: { f: [day, day, day], o: 0, s: 0 },
    sn: [['a', day]],
    gr: null,
    reg: null,
    pri: 'core',
    lc: 0,
    pair: null,
    mv: 0,
    // Die alten Antworten gelten als übernommen (sonst holte der Start sie nach).
    sync: NOW,
    mig: null,
    intro: day,
    // Zwei Benutzen-Abfragen bisher (Lücke): die dritte ist der Platz der Wortfamilie (höchstens jede 3.).
    fq: { l: 'gap', c: 0, h: { gap: [gapN, gapN] }, nb: 0, ak: null, ew: [] },
  };
}

const base = (): Record<string, Doc> => ({
  'app/schema': { ...MIGRATED['app/schema'], vocabModule: { v: 1, t: NOW - 3_600_000, state: 'done' } },
  'app/profile': { vcfg: { min: 15, ret: 0.9, mod: 1 } },
});

test.describe('Handy 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Start wendet die Pflege an: korrigiert, Familie, verknüpft, Doppel stillgelegt (nicht gelöscht); veralteter Auftrag übersprungen', async ({ page }) => {
    const patch = { ...base(), ...carePatch(NOW - 60_000), 'vocab/achieve': { lex: lexAt(5, 2) }, 'vocab/achieve-dup': { ...SAMPLE_DUP, lex: lexAt(2, 0) } };
    const { errors } = await bootAt(page, { name: 'vword', path: 'vocab/achieve' }, { migrated: false, fake: { patch } });
    await screen(page, 'vword');
    await expect.poll(async () => ((await dump(page))[CARE]?.ops as Record<string, Doc> | undefined)?.['merge-achieve']?.st, { timeout: 15_000 }).toBe('done');
    const d = await dump(page);
    const ops = d[CARE]!.ops as Record<string, Doc>;
    expect(Object.fromEntries(Object.entries(ops).map(([k, v]) => [k, v.st]))).toEqual({ 'fix-feasible-de': 'done', 'fix-stale': 'skip', 'fam-achieve': 'done', 'link-convince': 'done', 'merge-achieve': 'done' });
    expect(d['vocab/feasible']!.de).toBe('machbar, durchführbar');
    expect(d['vocab/feasible']!.care).toEqual([expect.objectContaining({ id: 'fix-feasible-de', k: 'fix', old: { de: 'machbar' } })]);
    expect(d['vocab/achieve']!.famx).toEqual(SAMPLE_FAM['vocab/achieve']);
    expect(d['vocab/convince']!.rel).toEqual(['vocab/persuade']);
    const dup = d['vocab/achieve-dup']!;
    expect(dup).toMatchObject({ hidden: true, merged: { into: 'vocab/achieve' }, word: 'achieve' });
    expect((dup.lex as Doc).of).toBe('vocab/achieve');
    // Wortseite des Gewinners: Familie und Verweis auf den stillgelegten Doppel.
    await expect(page.getByTestId('vw-family-item')).toHaveCount(2);
    await expect(page.getByTestId('vw-merged-from')).toContainText('Zusammengeführt mit achieve');
    expect(errors).toEqual([]);
  });

  test('Wortseite des stillgelegten Doppels: Hinweis mit Verweis auf den Gewinner, keine Aktionen', async ({ page }) => {
    const patch = {
      ...base(),
      'vocab/achieve': { lex: lexAt(5, 0) },
      'vocab/achieve-dup': { ...SAMPLE_DUP, hidden: true, merged: { into: 'vocab/achieve', t: NOW, id: 'merge-achieve', h: 0 }, lex: { ...lexAt(2, 0), of: 'vocab/achieve' } },
    };
    const { errors } = await bootAt(page, { name: 'vword', path: 'vocab/achieve-dup' }, { migrated: false, fake: { patch } });
    await screen(page, 'vword');
    await expect(page.getByTestId('vw-merged')).toContainText('zusammengeführt und ruht');
    await expect(page.getByTestId('vw-paused')).toHaveCount(0);
    await expect(page.getByTestId('vw-actions')).toHaveCount(0);
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vw-merged-link').click();
    await expect(page.getByTestId('vw-head')).toHaveText('to achieve');
    await expect(page.getByTestId('vw-merged-from')).toContainText('achieve');
    expect(errors).toEqual([]);
  });

  test('Wortseite: Wortfamilie mit Wortart und Bedeutung, „Gehört zusammen mit“ antippbar', async ({ page }) => {
    const patch = {
      ...base(),
      'vocab/achieve': { lex: lexAt(5, 0), famx: SAMPLE_FAM['vocab/achieve'], rel: ['vocab/convince'] },
      'vocab/convince': { lex: lexAt(3, 0), rel: ['vocab/achieve'] },
    };
    const { errors, external } = await bootAt(page, { name: 'vword', path: 'vocab/achieve' }, { migrated: false, fake: { patch } });
    await screen(page, 'vword');
    const fam = page.getByTestId('vw-family-item');
    await expect(fam).toHaveCount(2);
    await expect(fam.nth(0)).toContainText('achievement');
    await expect(fam.nth(0)).toContainText('Nomen');
    await expect(fam.nth(0)).toContainText('Leistung, Erfolg');
    await expect(fam.nth(1)).toContainText('Adjektiv');
    await expect(page.getByTestId('vw-rel')).toContainText('Gehört zusammen mit');
    expect(await layoutProblems(page)).toEqual([]);
    await page.getByTestId('vw-rel-link').click();
    await expect(page.getByTestId('vw-head')).toHaveText('to convince');
    await expect(page.getByTestId('vw-rel-link')).toHaveText('to achieve');
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });

  test('Wiederholung: Lücke „Wortfamilie“ mit Stammwort in Klammern, benotet, Warum nennt Form, Wortart und Bedeutung', async ({ page }) => {
    const patch = { ...base(), 'vocab/achieve': { lex: lexAt(5, 2), famx: SAMPLE_FAM['vocab/achieve'] } };
    const { errors } = await bootAt(page, { name: 'vlearn', kind: 'word', path: 'vocab/achieve' }, { migrated: false, fake: { patch } });
    await screen(page, 'vlearn');
    const go = page.getByTestId('vm-start-go');
    const check = page.getByTestId('vm-check');
    await expect(go.or(check).first()).toBeVisible();
    if (await go.isVisible()) await go.click();
    await expect(page.getByTestId('vm-fam-stem')).toHaveText('(achieve)');
    await expect(page.getByTestId('vm-sentence')).toContainText('The new billing system was a real');
    await expect(page.getByText('Bilde aus dem Wort in Klammern die passende Form.')).toBeVisible();
    expect(await layoutProblems(page)).toEqual([]);
    await page.clock.setFixedTime(new Date(NOW + 60_000));
    await page.keyboard.type('achievement', { delay: 40 });
    await check.click();
    await expect(page.getByTestId('vm-why')).toContainText('achievement (n) – Leistung, Erfolg');
    await expect(page.getByTestId('vm-why')).toContainText('Nomen');
    // Gebucht als Form „family“ an DIESER Karte (kein eigener Lernstand): Verlaufseintrag und Formen-Statistik.
    await page.getByTestId('vm-next').click();
    await expect
      .poll(async () => (((await dump(page))['vocab/achieve']?.lex as Doc | undefined)?.fq as Doc | undefined)?.h as Doc | undefined)
      .toMatchObject({ family: [1, 1] });
    const d = await dump(page);
    expect(Object.keys(d).filter((p) => p.startsWith('vocab/achieve')).sort()).toEqual(['vocab/achieve']);
    expect(errors).toEqual([]);
  });
});
