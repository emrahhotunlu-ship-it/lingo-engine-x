import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startLive, useLive } from '../../src/data/live';
import { resetValidationStats, validateCached, validateDoc, validationStats } from '../../src/data/validate';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { loadSeed, type Doc } from './helpers';

// A7 H6 Validierungs-Cache: Ein unverändertes Dokument kommt als dasselbe, eingefrorene Objekt
// (contract/db.d.ts) und wird nur einmal mit zod geprüft. Messbar über `validationStats()`.

const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

function bigSeed(n: number): Record<string, Doc> {
  const seed = loadSeed();
  const base = Object.entries(seed).find(([k]) => k.startsWith('vocab/'))![1];
  for (let i = 0; i < n; i++) seed[`vocab/perf-${i}`] = { ...base, word: `perfword${i}`, due: 1_700_000_000_000 + i };
  return seed;
}

beforeEach(() => resetValidationStats());

describe('validateCached', () => {
  it('gleiches Objekt und Pfad: Treffer mit demselben Ergebnis; anderer Pfad oder neues Objekt: neu geprüft', () => {
    const doc = Object.freeze({ word: 'avoid', de: 'vermeiden', stage: 2, due: 1 });
    const a = validateCached('vocab/avoid', doc);
    const b = validateCached('vocab/avoid', doc);
    expect(b).toBe(a);
    expect(a.ok && b.ok && a.value === b.value).toBe(true);
    expect(validationStats()).toMatchObject({ hits: 1, misses: 1 });
    validateCached('vocab/other', doc);
    validateCached('vocab/avoid', { ...doc });
    expect(validationStats()).toMatchObject({ hits: 1, misses: 3 });
    // Gleiches Ergebnis wie ohne Zwischenspeicher, auch für ungültige Dokumente.
    const bad = Object.freeze({ word: 5 });
    expect(validateCached('vocab/bad', bad)).toEqual(validateDoc('vocab/bad', bad));
    expect(validateCached('vocab/bad', bad).ok).toBe(false);
  });

  it('Treffer sind viel billiger als echte Prüfungen (1.500 Karten)', () => {
    const docs = Object.entries(bigSeed(1500)).filter(([k]) => k.startsWith('vocab/')).map(([k, v]) => [k, Object.freeze(v)] as const);
    const t0 = performance.now();
    for (const [k, v] of docs) validateCached(k, v);
    const cold = performance.now() - t0;
    const t1 = performance.now();
    for (let r = 0; r < 5; r++) for (const [k, v] of docs) validateCached(k, v);
    const warm = (performance.now() - t1) / 5;
    expect(validationStats().misses).toBe(docs.length);
    expect(validationStats().hits).toBe(docs.length * 5);
    expect(warm).toBeLessThan(cold / 3);
  });
});

describe('Live-Abo: eine geänderte Karte prüft nur diese Karte', () => {
  let stop: (() => void) | null = null;
  afterEach(() => {
    stop?.();
    stop = null;
  });

  it('1.500 + Seed-Karten: nach einer Änderung genau 1 echte Prüfung, alle anderen Karten behalten ihre Referenz', async () => {
    const { db } = createMemoryDb({ seed: bigSeed(1500) });
    stop = startLive(db);
    for (let i = 0; i < 200 && useLive.getState().status !== 'ready'; i++) await tick();
    expect(useLive.getState().status).toBe('ready');
    const before = useLive.getState().collections.vocab!;
    expect(before.size).toBeGreaterThan(1500);
    resetValidationStats();
    await db.doc('vocab/perf-7').update({ stage: 3 });
    for (let i = 0; i < 100 && useLive.getState().collections.vocab === before; i++) await tick();
    const after = useLive.getState().collections.vocab!;
    expect(after).not.toBe(before);
    expect(validationStats().misses).toBe(1);
    expect(validationStats().hits).toBe(after.size - 1);
    expect(after.get('perf-7')!.stage).toBe(3);
    expect(after.get('perf-8')).toBe(before.get('perf-8'));
    expect(after.get('perf-7')).not.toBe(before.get('perf-7'));
  });
});
