import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { schemaForPath } from '../../src/data/paths';
import { loadSeed, type Doc } from './helpers';

// Anhang B als Vorlage: aus jeder Typangabe ein Beispielwert.
function exampleFrom(spec: unknown): unknown {
  if (spec === 'string') return 'x';
  if (spec === 'number') return 1;
  if (spec === 'boolean') return true;
  if (spec === 'null') return null;
  if (spec === '…') return 'x';
  if (Array.isArray(spec)) return spec.length ? [exampleFrom(spec[0])] : [];
  if (spec && typeof spec === 'object') {
    return Object.fromEntries(Object.entries(spec).map(([k, v]) => [k === '<schlüssel>' ? 'key' : k === '<datum>' ? '2026-09-20' : k, exampleFrom(v)]));
  }
  return spec;
}

const anhangB = JSON.parse(readFileSync(new URL('../../docs/datenstruktur.json', import.meta.url), 'utf8')) as Record<string, unknown>;

describe('Schemas gegen Anhang B', () => {
  it.each(Object.keys(anhangB))('%s hat ein Schema und akzeptiert die Struktur aus Anhang B', (key) => {
    const path = key.replace('<id>', 'k1');
    expect(schemaForPath(path), path).not.toBeNull();
    const doc = exampleFrom(anhangB[key]) as Doc;
    if (path.startsWith('vocab/')) expect(doc.word).toBe('x');
    const res = validateDoc(path, doc);
    expect(res.ok, res.ok ? '' : res.issues.join('; ')).toBe(true);
  });

  it('jedes Dokument der Testdaten ist gültig', () => {
    const seed = loadSeed();
    const bad = Object.entries(seed)
      .map(([p, d]) => validateDoc(p, d))
      .filter((r) => !r.ok);
    expect(bad).toEqual([]);
  });

  it('unbekannte Felder bleiben erhalten', () => {
    const res = validateDoc('vocab/probe', { word: 'probe', neuesFeld: { a: 1 }, S: 2 });
    expect(res.ok && res.value).toMatchObject({ word: 'probe', neuesFeld: { a: 1 }, S: 2 });
  });

  it('liest die Einschätzung flach (Anhang B) und mit Hülle (alte App)', () => {
    expect(validateDoc('app/assess', { level: 'B2', cefr: 'B2', blockers: [] }).ok).toBe(true);
    expect(validateDoc('app/assess', { d: '2026-09-20', t: 1, lang: 'de', answers: 3, writings: 1, data: { level: 'B2', cefr: 'B2' } }).ok).toBe(true);
  });

  it('meldet kaputte Dokumente, statt sie zu übernehmen', () => {
    const noWord = validateDoc('vocab/leer', { de: 'ohne Wort' });
    expect(noWord.ok).toBe(false);
    const wrongType = validateDoc('grammar/passive', { p: 'hoch' });
    expect(wrongType.ok).toBe(false);
    expect(!wrongType.ok && wrongType.issues[0]).toContain('p');
  });

  it('Pfade aus der Analyse der alten App haben Schemas', () => {
    for (const p of ['chunk/c1', 'scene/s1', 'preply/pp1', 'articles/a1', 'reading/r1', 'lpool/l1', 'wprompt/2026-09-20', 'app/schema']) {
      expect(schemaForPath(p), p).not.toBeNull();
    }
  });
});
