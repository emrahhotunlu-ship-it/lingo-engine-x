import { describe, expect, it } from 'vitest';
import { weekStrip } from '../../src/domain/streak';
import { firstSentence, practicedOn, weekDots } from '../../src/domain/progress/weekDots';

// P6 (plan.md §1.2): Wochenstreifen im Profil mit „Pflicht · nur Extra · Ruhetag · offen“.

describe('weekDots', () => {
  // Mittwoch, 23.09.2026; Pflicht-Regel ab Montag.
  const base = { today: '2026-09-23', pflichtSince: '2026-09-21' };

  it('Pflicht erledigt = done, nur geübt = extra, nichts = offen, danach future', () => {
    const profile = { minutes: { '2026-09-22': 12 }, act: { '2026-09-23': { vocab: 1 } } };
    const week = weekStrip({ ...base, pflichtDone: new Set(['2026-09-21']) });
    const dots = weekDots(week, profile);
    expect(dots.map((d) => d.dot)).toEqual(['done', 'extra', 'extra', 'future', 'future', 'future', 'future']);
  });

  it('Ruhetag bleibt Ruhetag, auch ohne Aktivität', () => {
    const week = weekStrip({ ...base, pflichtDone: new Set(['2026-09-21', '2026-09-23']) });
    const dots = weekDots(week, {});
    expect(dots.slice(0, 3).map((d) => d.dot)).toEqual(['done', 'rest', 'done']);
  });

  it('vor pflichtSince zählt die alte Regel (Tageszähler = done, nie extra)', () => {
    const week = weekStrip({ today: '2026-09-23', days: { '2026-09-22': 3 } });
    expect(weekDots(week, { days: { '2026-09-22': 3 } })[1]?.dot).toBe('done');
  });

  it('practicedOn liest Minuten, alte Zähler und act (Objekt oder Liste)', () => {
    expect(practicedOn({ minutes: { d: 0 } }, 'd')).toBe(false);
    expect(practicedOn({ xpDays: { d: 5 } }, 'd')).toBe(true);
    expect(practicedOn({ act: { d: { read: 0, say: 1 } } }, 'd')).toBe(true);
    expect(practicedOn({ act: { d: ['x'] } }, 'd')).toBe(true);
    expect(practicedOn(null, 'd')).toBe(false);
  });
});

describe('firstSentence', () => {
  it('nimmt den ersten Satz und kürzt an Wortgrenzen', () => {
    expect(firstSentence('Solides B2+. Im Verhandeln fast C1.')).toBe('Solides B2+.');
    expect(firstSentence('  ')).toBe('');
    const long = `${'word '.repeat(60)}end.`;
    const out = firstSentence(long, 40);
    expect(Array.from(out).length).toBeLessThanOrEqual(40);
    expect(out.endsWith('…')).toBe(true);
  });
});
