import { describe, expect, it } from 'vitest';
import { assessLevel, CEFR_SCALE, inBand, parseCefr, targetLevel } from '../../src/domain/input/level';
import { loadSeed } from './helpers';

describe('Zielniveau i+1 (Plan F3)', () => {
  it('Skala und Lesen von Niveaus', () => {
    expect(CEFR_SCALE).toEqual(['B1', 'B1+', 'B2', 'B2+', 'C1', 'C1+']);
    expect(parseCefr('B2')).toBe('B2');
    expect(parseCefr('b2+')).toBe('B2+');
    expect(parseCefr('Solides B2 mit klaren Ansätzen zu B2+')).toBe('B2');
    expect(parseCefr('A2')).toBe('B1');
    expect(parseCefr('C2')).toBe('C1+');
    expect(parseCefr('')).toBeNull();
    expect(parseCefr(42)).toBeNull();
  });

  it('eine Stufe über der Einschätzung, gedeckelt bei C1+; ohne Einschätzung B2+', () => {
    expect(targetLevel(null)).toBe('B2+');
    expect(targetLevel({})).toBe('B2+');
    expect(targetLevel({ data: { cefr: 'B2' } })).toBe('B2+');
    expect(targetLevel({ cefr: 'B2+' })).toBe('C1');
    expect(targetLevel({ data: { level: 'C1+' } })).toBe('C1+');
    expect(targetLevel({ data: { cefr: 'C1+' } })).toBe('C1+');
  });

  it('Hülle vor flach (A6.10), cefr vor level', () => {
    expect(assessLevel({ cefr: 'B1', data: { cefr: 'C1' } })).toBe('C1');
    expect(assessLevel({ level: 'B1', cefr: 'B2' })).toBe('B2');
    const seed = loadSeed();
    expect(targetLevel(seed['app/assess'])).toBe('B2+');
  });

  it('Band: Ziel ± 1 Stufe; Unbekanntes liegt nie im Band', () => {
    expect(inBand('B2', 'B2+')).toBe(true);
    expect(inBand('C1', 'B2+')).toBe(true);
    expect(inBand('B1+', 'B2+')).toBe(false);
    expect(inBand('C1+', 'B2+')).toBe(false);
    expect(inBand('Z9', 'B2+')).toBe(false);
    expect(inBand(undefined, 'B2+')).toBe(false);
  });
});
