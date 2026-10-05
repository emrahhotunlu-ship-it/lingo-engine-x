import { describe, expect, it } from 'vitest';
import { comebackBand, comebackGap, comebackMode, lastActiveDay, lastReturn, restartActive } from '../../src/domain/plan/comeback';

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
    expect(comebackBand(13)).toBe('long');
    expect(comebackBand(14)).toBe('restart');
    expect(comebackBand(40)).toBe('restart');
    expect(comebackBand(null)).toBe('none');
  });
});

describe('Wiedereinstieg: Form des Plans', () => {
  const ago = (today: string, n: number) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  const T = '2026-10-05';

  it('lastReturn: Pause und Tage seit der Rückkehr, aus days/pflicht/minutes', () => {
    expect(lastReturn({ days: { [ago(T, 10)]: 3 } }, T)).toEqual({ gap: 9, since: 0 });
    expect(lastReturn({ days: { [ago(T, 23)]: 1, [ago(T, 2)]: 4, [ago(T, 1)]: 4 } }, T)).toEqual({ gap: 20, since: 2 });
    expect(lastReturn({ days: { [ago(T, 3)]: 1 } }, T)).toBeNull();
    expect(lastReturn(null, T)).toBeNull();
    expect(lastReturn({ days: { [ago(T, 40)]: 1, [ago(T, 20)]: 1 } }, T)).toEqual({ gap: 19, since: 0 });
  });

  it('Neustart-Woche: ab 14 Tagen Pause an den ersten 7 Lerntagen, solange überfällig ≥ 40 (oder unbekannt); danach Kurz-Plan', () => {
    for (const since of [0, 3, 6]) {
      const p = { days: { [ago(T, 30 + since)]: 1, [ago(T, since)]: 2 } };
      expect(restartActive(p, T)).toBe(true);
      expect(comebackMode(p, T, 40)).toBe('restart');
      expect(comebackMode(p, T, null)).toBe('restart');
      // Unter 40 überfällig endet die Neustart-Woche vorzeitig.
      expect(comebackMode(p, T, 39)).toBeNull();
    }
    const late = { days: { [ago(T, 37)]: 1, [ago(T, 7)]: 2 } };
    expect(restartActive(late, T)).toBe(false);
    expect(comebackMode(late, T, 100)).toBe('reduced');
    expect(comebackMode(late, T, 39)).toBeNull();
    expect(restartActive({ days: { [ago(T, 15)]: 1 } }, T)).toBe(true);
  });

  it('7–13 Tage Pause: Kurz-Plan nur bei überfällig ≥ 40, höchstens 14 Lerntage lang', () => {
    const p = { days: { [ago(T, 10)]: 1 } };
    expect(comebackMode(p, T, 39)).toBeNull();
    expect(comebackMode(p, T, 40)).toBe('reduced');
    const back = { days: { [ago(T, 11)]: 1, [ago(T, 1)]: 2 } };
    expect(comebackMode(back, T, 55)).toBe('reduced');
    expect(comebackMode(back, T, 12)).toBeNull();
    const days: Record<string, number> = { [ago(T, 30)]: 1 };
    for (let n = 1; n <= 20; n++) days[ago(T, n)] = 1;
    expect(lastReturn({ days }, T)).toEqual({ gap: 9, since: 20 });
    expect(comebackMode({ days }, T, 90)).toBeNull();
  });
});
