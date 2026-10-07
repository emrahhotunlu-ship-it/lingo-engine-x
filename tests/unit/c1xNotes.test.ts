// Notenschlüssel der c1x-Arten (Lernplattform 3.0 §3.4, P12).
import { describe, expect, it } from 'vitest';
import { GRADE_TABLE, gradeAnswer, PER_UNIT_MS } from '../../src/domain/grade';
import { C1_WEIGHT, gradeKeyOf, noteNameOf, weightOf, type C1NoteName } from '../../src/domain/c1x/notes';
import { C1_KINDS } from '../../src/domain/c1x/types';

const NAMES = Object.keys(C1_WEIGHT) as C1NoteName[];

describe('c1x-Notenschlüssel', () => {
  it('jeder Name hat eine Zeile in der Notentabelle', () => {
    expect(NAMES).toHaveLength(15);
    for (const n of NAMES) expect(GRADE_TABLE[gradeKeyOf(n)], n).toBeDefined();
  });

  it('Grenzen laut §3.4 (Gut bis / Leicht bis)', () => {
    const g = (n: C1NoteName) => GRADE_TABLE[gradeKeyOf(n)];
    expect([g('mcc').good, g('mcc').easy]).toEqual([9000, null]);
    expect([g('ocl').good, g('ocl').easy]).toEqual([6000, 2500]);
    expect([g('wf').good, g('wf').easy]).toEqual([9000, 3500]);
    expect([g('kwt').good, g('kwt').easy]).toEqual([20_000, 8000]);
    expect([g('kwt_tiles').good, g('kwt_tiles').easy]).toEqual([14_000, null]);
    expect([g('kwt_part').good, g('kwt_part').easy]).toEqual([14_000, 6000]);
    expect([g('err_tap').good, g('err_tap').easy]).toEqual([10_000, null]);
    expect([g('err_tapfix').good, g('err_tapfix').easy]).toEqual([12_000, 5000]);
    expect([g('err_fix').good, g('err_fix').easy]).toEqual([8000, 3000]);
    expect([g('pair').good, g('cnet').good, g('reg_chips').good, g('para_pick').good]).toEqual([14_000, 15_000, 12_000, 16_000]);
    expect([g('reg').good, g('reg').easy, g('para').good, g('para').easy]).toEqual([25_000, 10_000, 35_000, 15_000]);
  });

  it('Auswahl und Bausteine geben nie „Leicht“ (Note 4), egal wie schnell', () => {
    for (const n of ['mcc', 'kwt_tiles', 'err_tap', 'pair', 'cnet', 'reg_chips', 'para_pick'] as const) {
      expect(gradeAnswer({ key: gradeKeyOf(n), verdict: 'correct', timeMs: 100, units: 3 }), n).toBeLessThanOrEqual(3);
    }
  });

  it('getippte Formen: schnell = 4, innerhalb von „Gut“ = 3, langsam = 2; Handy dehnt um 1,4', () => {
    const k = gradeKeyOf('ocl');
    expect(gradeAnswer({ key: k, verdict: 'correct', timeMs: 2000, firstKeyMs: 2000 })).toBe(4);
    expect(gradeAnswer({ key: k, verdict: 'correct', timeMs: 5000, firstKeyMs: 5000 })).toBe(3);
    expect(gradeAnswer({ key: k, verdict: 'correct', timeMs: 7000, firstKeyMs: 7000 })).toBe(2);
    expect(gradeAnswer({ key: k, verdict: 'correct', timeMs: 7000, firstKeyMs: 7000, profile: 'touch' })).toBe(3);
  });

  it('kwt_tiles: 14 s + 0,6 s je Baustein', () => {
    const key = gradeKeyOf('kwt_tiles');
    expect(gradeAnswer({ key, verdict: 'correct', timeMs: 14_000 + 5 * PER_UNIT_MS, units: 5 })).toBe(3);
    expect(gradeAnswer({ key, verdict: 'correct', timeMs: 14_000 + 5 * PER_UNIT_MS + 1, units: 5 })).toBe(2);
  });

  it('Gewichte laut §3.4', () => {
    expect(weightOf('mcc')).toBe(0.55);
    expect(weightOf('kwt_tiles')).toBe(0.8);
    expect(weightOf('para')).toBe(1.1);
    expect(weightOf('kwt')).toBe(1);
    expect(weightOf('err_tap')).toBe(0.55);
  });

  it('noteNameOf wählt den Schlüssel nach Art und Eingabeform', () => {
    expect(noteNameOf('kwt', 'tiles')).toBe('kwt_tiles');
    expect(noteNameOf('kwt', 'part')).toBe('kwt_part');
    expect(noteNameOf('kwt', 'typed')).toBe('kwt');
    expect(noteNameOf('err', 'tap')).toBe('err_tap');
    expect(noteNameOf('err', 'tapfix')).toBe('err_tapfix');
    expect(noteNameOf('err', 'typed')).toBe('err_fix');
    expect(noteNameOf('reg', 'chips')).toBe('reg_chips');
    expect(noteNameOf('para', 'pick')).toBe('para_pick');
    for (const k of C1_KINDS) expect(NAMES).toContain(noteNameOf(k));
  });
});
