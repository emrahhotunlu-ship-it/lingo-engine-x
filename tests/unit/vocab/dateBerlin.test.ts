import { describe, expect, it } from 'vitest';
import { addLocalDays, dayKey, dayKeyNoon, dayStartOf, learningDayEnd, learningDayStart, legacyDayKey } from '../../../src/domain/date';

// Paket V1 (docs/umbau/vokabeln/plan.md §4.4): eine Datumsquelle, zentral Europe/Berlin. Alle Zeitpunkte hier sind feste UTC-Werte,
// die Ergebnisse dürfen also nicht von der Zeitzone des Prozesses abhängen. Geprüft (V1-Bericht): dieselbe Datei grün unter
// TZ=Europe/Berlin, TZ=America/New_York und TZ=Asia/Tokyo; der letzte Test unten hält das auch im Normal-Lauf fest.

const U = (iso: string) => Date.parse(iso);

describe('date.ts: Lerntag Europe/Berlin', () => {
  it('03:59 / 04:00 Berliner Zeit im Winter (UTC+1)', () => {
    expect(dayKey(U('2026-11-10T02:59:00Z'))).toBe('2026-11-09');
    expect(dayKey(U('2026-11-10T03:00:00Z'))).toBe('2026-11-10');
  });
  it('03:59 / 04:00 Berliner Zeit im Sommer (UTC+2)', () => {
    expect(dayKey(U('2026-07-10T01:59:00Z'))).toBe('2026-07-09');
    expect(dayKey(U('2026-07-10T02:00:00Z'))).toBe('2026-07-10');
  });
  it('Tag der Umstellung auf Sommerzeit (29.03.2026, 02:00 → 03:00): Grenze bleibt 04:00 Ortszeit', () => {
    expect(dayKey(U('2026-03-29T01:59:00Z'))).toBe('2026-03-28'); // 03:59 MESZ
    expect(dayKey(U('2026-03-29T02:00:00Z'))).toBe('2026-03-29'); // 04:00 MESZ
    expect(learningDayStart(U('2026-03-29T12:00:00Z'))).toBe(U('2026-03-29T02:00:00Z'));
    expect(learningDayEnd(U('2026-03-28T12:00:00Z'))).toBe(U('2026-03-29T02:00:00Z'));
  });
  it('Tag der Umstellung auf Winterzeit (25.10.2026, 03:00 → 02:00): Grenze bleibt 04:00 Ortszeit', () => {
    expect(dayKey(U('2026-10-25T02:59:00Z'))).toBe('2026-10-24'); // 03:59 MEZ
    expect(dayKey(U('2026-10-25T03:00:00Z'))).toBe('2026-10-25'); // 04:00 MEZ
    expect(dayStartOf('2026-10-25')).toBe(U('2026-10-25T03:00:00Z'));
    expect(learningDayEnd(U('2026-10-24T20:00:00Z'))).toBe(U('2026-10-25T03:00:00Z'));
  });
  it('Monatswechsel und Jahreswechsel', () => {
    expect(dayKey(U('2026-11-01T02:30:00Z'))).toBe('2026-10-31');
    expect(dayKey(U('2027-01-01T02:00:00Z'))).toBe('2026-12-31');
    expect(dayKey(U('2027-01-01T03:00:00Z'))).toBe('2027-01-01');
    expect(legacyDayKey(U('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
  it('Mittag und gleiche Uhrzeit über die Zeitumstellung', () => {
    expect(dayKeyNoon('2026-11-10')).toBe(U('2026-11-10T11:00:00Z'));
    expect(dayKeyNoon('2026-07-10')).toBe(U('2026-07-10T10:00:00Z'));
    // 24.10. 20:00 MESZ + 1 Tag = 25.10. 20:00 MEZ (25 Stunden später)
    expect(addLocalDays(U('2026-10-24T18:00:00Z'), 1)).toBe(U('2026-10-25T19:00:00Z'));
  });

  it('unabhängig von der Zeitzone des Geräts: Ergebnis = Berliner Wanduhr laut Intl', () => {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
    for (let t = U('2026-01-01T00:00:00Z'); t < U('2027-01-01T00:00:00Z'); t += 3_600_000 * 7 + 60_000 * 13) {
      const p = Object.fromEntries(f.formatToParts(t).map((x) => [x.type, x.value]));
      const cal = `${p.year}-${p.month}-${p.day}`;
      const want = Number(p.hour) < 4 ? new Date(Date.parse(`${cal}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10) : cal;
      expect(dayKey(t)).toBe(want);
    }
  });
});
