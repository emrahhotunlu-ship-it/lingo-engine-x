import { readFileSync } from 'node:fs';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { checkoutV86 } from '../../scripts/v86-checkout.mjs';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { loadSeed, type Doc } from './helpers';

// Rückweg-Test Unit (Relaunch Stufe 1, docs/relaunch/stufe1-plan.md §4.6; Auflage 2 an P6):
// Ein Datenstand mit ALLEN neuen Feldern aus Stufe 1 (hist fk/ms/in …, Log fk/in/left …, theme.a, dk, app/today) wird mit den Schemas
// von v86 (Live, Commit 3377252, per scripts/v86-checkout.mjs nach .cache/v86/) gelesen. Danach bewertet v86 eine Karte und ändert das
// Thema (eigener Writer, eigene Review-Logik), und die neuen Felder stehen noch da. Erfundene Daten (Seed + tests/fixtures/s1-seed.json).

checkoutV86();
const v86Validate = await import('../../.cache/v86/src/data/validate');
const v86Paths = await import('../../.cache/v86/src/data/paths');
const v86Review = await import('../../.cache/v86/src/domain/srs/applyReview');
const v86Writer = await import('../../.cache/v86/src/data/writer');

type S1Seed = { histExtra: Doc; logExtra: Doc; docs: { 'app/profile': Doc; 'app/today': Doc } };
const S1 = JSON.parse(readFileSync(new URL('../fixtures/s1-seed.json', import.meta.url), 'utf8')) as S1Seed;

const oldHist = (): Doc[] => [
  { t: Date.parse('2026-09-12T10:00:00+02:00'), m: 'cloze', g: 3, ...S1.histExtra },
  { t: Date.parse('2026-09-15T10:00:00+02:00'), m: 'recog', g: 4, ...S1.histExtra },
];

/** Seed + alle neuen Felder aus Stufe 1. `dk` darf fehlen (P7 läuft parallel): beide Fassungen werden geprüft. */
function stateWithS1(withDk: boolean): { docs: Record<string, Doc>; card: string; log: string } {
  const docs = loadSeed();
  const card = Object.keys(docs).find((p) => p.startsWith('vocab/') && v86Validate.validateDoc(p, docs[p]).ok && typeof docs[p]?.last === 'number');
  const log = Object.keys(docs).find((p) => p.startsWith('log/') && Array.isArray((docs[p] as { entries?: unknown }).entries) && ((docs[p] as { entries: unknown[] }).entries.length > 0));
  if (!card || !log) throw new Error('Seed ohne Karte oder Log');
  docs[card] = { ...docs[card], hist: oldHist() };
  const lg = docs[log] as { entries: Doc[] } & Doc;
  docs[log] = { ...lg, entries: [{ ...lg.entries[0], ...S1.logExtra }, ...lg.entries.slice(1)] };
  const { dk, ...profileNew } = S1.docs['app/profile'];
  docs['app/profile'] = { ...docs['app/profile'], ...profileNew, ...(withDk ? { dk } : {}), theme: { ...((docs['app/profile']?.theme) ?? {}), ...(S1.docs['app/profile'].theme as Doc) } };
  docs['app/today'] = S1.docs['app/today'];
  return { docs, card, log };
}

afterAll(() => {
  vi.restoreAllMocks();
});

describe('Rückweg v86: Lesen', () => {
  for (const withDk of [true, false]) {
    it(`alle Dokumente sind unter den v86-Schemas gültig (${withDk ? 'mit' : 'ohne'} dk)`, () => {
      const { docs } = stateWithS1(withDk);
      const bad = Object.entries(docs)
        .map(([p, d]) => v86Validate.validateDoc(p, d))
        .filter((r) => !r.ok);
      expect(bad).toEqual([]);
    });
  }

  it('v86 kennt app/today nicht (kein Schema, nicht in APP_DOCS) und liest es deshalb nie', () => {
    expect(v86Paths.schemaForPath('app/today')).toBeFalsy();
    expect(Object.keys((v86Paths as { APP_DOCS?: Record<string, unknown> }).APP_DOCS ?? {})).not.toContain('app/today');
  });
});

describe('Rückweg v86: Zurückschreiben', () => {
  it('v86 bewertet eine Karte und ändert das Thema: hist fk/ms/in, theme.a, dk und app/today bleiben', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { docs, card } = stateWithS1(true);
    const h = createMemoryDb({ seed: docs });
    const writer = v86Writer.createWriter(h.db);
    const before = h.dump();

    // 1) Review durch v86 (reine Review-Logik von v86, geschrieben mit dem v86-Writer).
    const cur = before[card] as Doc;
    const t = Math.max(Number(cur.last) || 0, Date.parse('2026-09-20T10:00:00+02:00')) + 1000;
    const answer = { t, day: '2026-09-20', kind: 'v', id: card.slice('vocab/'.length), ex: 'type', grade: 3, given: 'x', ans: 'x', ms: 1200, lang: 'de', ctx: 'rev' } as Parameters<typeof v86Review.reviewWrite>[2];
    const w = v86Review.reviewWrite(card, cur, answer, null);
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    await writer.update(card, w.patch);

    // 2) Thema ändern wie v86 (`changeTheme` → writer.patch mit `{ theme: { m } }`, verschmolzen).
    await writer.patch('app/profile', { theme: { m: 'light' } }, h.dump()['app/profile']);

    const after = h.dump();
    const hist = (after[card] as { hist: Doc[] }).hist;
    expect(hist.length).toBeGreaterThan(oldHist().length);
    // Die älteren Einträge sind unverändert da (mit fk/ms/in und den übrigen neuen Zeitfeldern).
    for (const old of oldHist()) expect(hist).toContainEqual(old);
    const profile = after['app/profile'] as { theme: Doc; dk: Doc };
    expect(profile.theme.m).toBe('light');
    expect(profile.theme.a).toBe((S1.docs['app/profile'].theme as Doc).a);
    expect(profile.dk).toEqual(S1.docs['app/profile'].dk);
    expect(after['app/today']).toEqual(S1.docs['app/today']);
    // Alles danach weiter gültig unter v86.
    expect(Object.entries(after).filter(([p, d]) => !v86Validate.validateDoc(p, d).ok)).toEqual([]);
  });
});
