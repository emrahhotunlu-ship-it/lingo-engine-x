import { describe, expect, it } from 'vitest';
import { atlasEntries } from '../../src/domain/atlas/atlas';
import { SKY_RING_RANK, rankRadius, skyCounts, skyGrid, skyHit, skyLayout, skyTones, skyVeil } from '../../src/domain/atlas/sky';

// Wort-Himmel (P59): Lage deterministisch, Rang → Radius, Zählung = Atlas-Zeile, Schleier nur mit gültigem Test, Antipp-Suche.

const NOW = Date.UTC(2026, 8, 20, 19, 0);
const DAY = 86_400_000;
const BANDS = [1, 1, 0.97, 0.93, 0.86, 0.74, 0.6, 0.45, 0.31, 0.2];

describe('Wort-Himmel: Lage', () => {
  it('ist deterministisch und liegt im Einheitskreis', () => {
    const e = atlasEntries();
    const a = skyLayout(e);
    const b = skyLayout(e);
    expect(Array.from(a.xs.slice(0, 50))).toEqual(Array.from(b.xs.slice(0, 50)));
    for (let i = 0; i < e.length; i++) expect(Math.hypot(a.xs[i]!, a.ys[i]!)).toBeLessThanOrEqual(1.0001);
  });

  it('Radius wächst mit dem Rang (häufig innen, selten außen)', () => {
    expect(rankRadius(0, 10000)).toBe(0);
    expect(rankRadius(10000, 10000)).toBe(1);
    expect(rankRadius(2500, 10000)).toBeCloseTo(0.5, 6);
    expect(rankRadius(3000, 10000)).toBeLessThan(rankRadius(6000, 10000));
    expect(rankRadius(99999, 10000)).toBe(1);
    expect(rankRadius(5, 0)).toBe(0);
  });

  it('Ring bei Rang 5.000 liegt innerhalb des Himmels', () => {
    const l = skyLayout(atlasEntries());
    const r = rankRadius(SKY_RING_RANK, l.rMax);
    expect(r).toBeGreaterThan(0.3);
    expect(r).toBeLessThan(0.6);
  });
});

describe('Wort-Himmel: Zählung', () => {
  it('Sterne = Einträge mit Karte, nach Zustand getrennt', () => {
    const entries = [{ r: 3000 }, { r: 4000 }, { r: 6000 }, { r: 9000 }, { r: 12000 }];
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const cards = new Set(['a', 'c', 'd', 'e']);
    const state: Record<string, 'firm' | 'safe' | 'learning'> = { a: 'firm', c: 'safe', d: 'learning' };
    const tones = skyTones(ids, (id) => cards.has(id), (id) => state[id]);
    expect(tones).toEqual(['firm', 'none', 'safe', 'learning', 'new']);
    expect(skyCounts(entries, tones)).toEqual({ words: 5, stars: 4, firm: 1, safe: 1, learning: 1, fresh: 1, inRing: 2 });
  });
});

describe('Wort-Himmel: Schleier', () => {
  const prof = (t: number, bands: unknown = BANDS) => ({ vtests: [{ t: t - 30 * DAY, d: 'alt', bands: BANDS.map(() => 0) }, { t, d: '2026-08-30', bands }] });

  it('nimmt den jüngsten gültigen Test', () => {
    const v = skyVeil(prof(NOW - 21 * DAY), NOW);
    expect(v?.d).toBe('2026-08-30');
    expect(v?.bands).toEqual(BANDS);
  });

  it('kein Schleier ohne Test, mit Test älter als 90 Tage oder mit kaputten Bändern', () => {
    expect(skyVeil(null, NOW)).toBeNull();
    expect(skyVeil({}, NOW)).toBeNull();
    expect(skyVeil(prof(NOW - 91 * DAY), NOW)).toBeNull();
    expect(skyVeil(prof(NOW - 5 * DAY, [1, 1]), NOW)).toBeNull();
    expect(skyVeil(prof(NOW - 5 * DAY, [...BANDS.slice(0, 9), 'x']), NOW)).toBeNull();
  });

  it('klemmt Werte auf 0…1', () => {
    const v = skyVeil(prof(NOW - DAY, [2, ...BANDS.slice(1, 9), -1]), NOW);
    expect(v?.bands[0]).toBe(1);
    expect(v?.bands[9]).toBe(0);
  });
});

describe('Wort-Himmel: Antippen', () => {
  it('findet den nächsten Punkt und bevorzugt Sterne', () => {
    const px = new Float32Array([10, 18, 200]);
    const py = new Float32Array([10, 10, 200]);
    const g = skyGrid(px, py);
    expect(skyHit(g, px, py, 11, 10, () => false)).toBe(0);
    expect(skyHit(g, px, py, 13, 10, (i) => i === 1)).toBe(1);
    expect(skyHit(g, px, py, 100, 100, () => true)).toBeNull();
  });
});
