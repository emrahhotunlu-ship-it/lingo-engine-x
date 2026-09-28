import { describe, expect, it } from 'vitest';
import { preplyNextOp, readPreplyNext, validNext } from '../../src/domain/preply/next';

// Paket P5 (Neubau N80): `app/week.preplyNext` feldweise (data-guard 00:35).

describe('Preply: nächste Stunde', () => {
  it('feldweise schreiben, nie bei ungültigem Dokument, v nie verringern', () => {
    expect(preplyNextOp(undefined, true, '2026-10-01')).toEqual({ set: { v: 1, preplyNext: '2026-10-01' } });
    expect(preplyNextOp(undefined, true, '')).toBeNull();
    expect(preplyNextOp({ v: 1, cur: { wk: 'x' } }, true, '2026-10-01')).toEqual({ update: { preplyNext: '2026-10-01' } });
    expect(preplyNextOp({ v: 1, preplyNext: '2026-10-01' }, true, '2026-10-01')).toBeNull();
    expect(preplyNextOp({ v: 2 }, false, '2026-10-01')).toBeNull();
    expect(preplyNextOp({ v: 3 }, true, '2026-10-01')).toEqual({ update: { preplyNext: '2026-10-01' } });
    expect(preplyNextOp({ cur: {} }, true, '')).toEqual({ update: { preplyNext: '', v: 1 } });
  });

  it('nur künftige Termine gelten', () => {
    expect(validNext('2026-09-27', '2026-09-28')).toBe(false);
    expect(validNext('2026-09-28', '2026-09-28')).toBe(true);
    expect(readPreplyNext({ preplyNext: '2026-09-30' }, '2026-09-28')).toBe('2026-09-30');
    expect(readPreplyNext({ preplyNext: '2026-09-01' }, '2026-09-28')).toBeNull();
    expect(readPreplyNext(null, '2026-09-28')).toBeNull();
  });
});
