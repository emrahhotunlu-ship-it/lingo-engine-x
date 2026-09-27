import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { isWrongLang } from '../../src/domain/lang/detect';
import { mergeScenes, sceneView } from '../../src/domain/speak/library';
import fixedScenes from '../../src/content/speak/scenes.json';
import legacyScenes from '../../src/content/legacy/scenes.json';

// Kap. 6.5: „Preisverhandlung“ und „Partner-Pitch“ als feste Szenen neben den vier alten.

type Doc = Record<string, unknown>;
const fixed = fixedScenes as unknown as Doc[];
const legacy = legacyScenes as unknown as Doc[];

describe('feste Szenen Preisverhandlung und Partner-Pitch', () => {
  it('zwei Szenen mit eigenen Kennungen, keine Überschneidung mit den alten', () => {
    expect(fixed.map((s) => s.id)).toEqual(['sc-price', 'sc-pitch']);
    const legacyIds = new Set(legacy.map((s) => s.id));
    for (const s of fixed) expect(legacyIds.has(s.id)).toBe(false);
  });

  it('gleiches Format wie scene/<id>: gültig, startbar, zweisprachig', () => {
    const keys = Object.keys(legacy[0]!).sort();
    for (const s of fixed) {
      expect(Object.keys(s).sort()).toEqual(keys);
      expect(validateDoc(`scene/${String(s.id)}`, s).ok).toBe(true);
      for (const lang of ['de', 'en'] as const) {
        const v = sceneView(String(s.id), s, 'legacy', lang);
        expect(v.valid).toBe(true);
        expect(v.useful).toHaveLength(5);
        expect(v.persona?.name).toBeTruthy();
      }
      for (const k of ['title', 'situation', 'goal', 'stake', 'objection', 'opening']) expect(isWrongLang(String(s[k]), 'en', 4)).toBe(false);
      for (const k of ['title_de', 'situation_de', 'goal_de']) expect(isWrongLang(String(s[k]), 'de', 4)).toBe(false);
    }
  });

  it('Beruflicher Kontext DMS/Cloud aus der Berufswelt', () => {
    const text = JSON.stringify(fixed);
    expect(text).toMatch(/cloud DMS/);
    expect(text).toMatch(/e-invoice/);
    expect(text).not.toMatch(/colour|behaviour|organis|sceptic/);
  });

  it('Bibliothek: sechs feste Szenen, Datenbank überlagert je id, nie gelöscht', () => {
    const all = [...legacy, ...fixed];
    const empty = mergeScenes(all, new Map(), new Set(), 'de');
    expect(empty.map((s) => s.id).sort()).toEqual(['sc-arch', 'sc-escal', 'sc-pitch', 'sc-price', 'sc-scope', 'sc-vida']);
    const db = new Map<string, Doc>([['sc-price', { runs: 2, lastRun: 5 }]]);
    const merged = mergeScenes(all, db, new Set(), 'en');
    const price = merged.find((s) => s.id === 'sc-price')!;
    expect(price.runs).toBe(2);
    expect(price.src).toBe('legacy');
    expect(price.opening).toMatch(/twenty-five percent/);
    expect(merged.find((s) => s.id === 'sc-pitch')!.title).toBe('Pitching a reseller partnership');
    expect(mergeScenes(all, new Map(), new Set(), 'de').find((s) => s.id === 'sc-pitch')!.title).toBe('Eine Vertriebspartnerschaft vorschlagen');
  });
});
