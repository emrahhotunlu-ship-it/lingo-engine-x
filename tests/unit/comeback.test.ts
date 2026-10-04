import { describe, expect, it } from 'vitest';
import { comebackBand, comebackGap, lastActiveDay } from '../../src/domain/plan/comeback';

const P = { days: { '2026-09-20': 12, '2026-09-25': 0 }, pflicht: { '2026-09-22': 1 }, minutes: { '2026-09-23': 4 } };

describe('Wiedereinstieg', () => {
  it('letzter aktiver Tag aus days, pflicht und minutes; heute zählt nie', () => {
    expect(lastActiveDay(P, '2026-10-04')).toBe('2026-09-23');
    expect(lastActiveDay({ days: { '2026-10-04': 3 } }, '2026-10-04')).toBeNull();
    expect(lastActiveDay(null, '2026-10-04')).toBeNull();
  });
  it('Lücke und Band: gestern aktiv = 0; 3–6 kurz; ab 7 lang; Erststart ohne Band', () => {
    expect(comebackGap({ days: { '2026-10-03': 1 } }, '2026-10-04')).toBe(0);
    expect(comebackGap({ days: { '2026-09-30': 1 } }, '2026-10-04')).toBe(3);
    expect(comebackGap(P, '2026-10-04')).toBe(10);
    expect(comebackBand(2)).toBe('none');
    expect(comebackBand(3)).toBe('short');
    expect(comebackBand(6)).toBe('short');
    expect(comebackBand(7)).toBe('long');
    expect(comebackBand(null)).toBe('none');
  });
});
