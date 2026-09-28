import { describe, expect, it } from 'vitest';
import { perfText, readPerfMarks } from '../../src/features/settings/perfMarks';

// N95: Die Diagnose zeigt lx:boot/live/status (Zeitpunkt) und lx:card (letzte Dauer), kopierbar.

type E = { name: string; entryType: string; startTime: number; duration: number; detail?: unknown };
const fake = (entries: E[]) => ({
  getEntriesByName: (name: string, type?: string) => entries.filter((e) => e.name === name && (!type || e.entryType === type)) as unknown as PerformanceEntryList,
});

describe('readPerfMarks', () => {
  it('liest Zeitpunkte und die letzte Kartendauer; Fehlendes bleibt null', () => {
    const rows = readPerfMarks(
      fake([
        { name: 'lx:boot', entryType: 'mark', startTime: 412.4, duration: 0 },
        { name: 'lx:live', entryType: 'mark', startTime: 600, duration: 0 },
        { name: 'lx:card', entryType: 'measure', startTime: 5000, duration: 12.34 },
        { name: 'lx:card', entryType: 'measure', startTime: 6000, duration: 8.26 },
      ]),
    );
    expect(rows).toEqual([
      { name: 'lx:boot', ms: 412 },
      { name: 'lx:live', ms: 600 },
      { name: 'lx:status', ms: null },
      { name: 'lx:card', ms: 8.3 },
    ]);
    expect(perfText(rows)).toBe('lx:boot=412ms lx:live=600ms lx:status=– lx:card=8.3ms');
  });

  it('lx:card als Marke mit detail.ms; ohne performance alles null', () => {
    expect(readPerfMarks(fake([{ name: 'lx:card', entryType: 'mark', startTime: 1, duration: 0, detail: { ms: 21 } }]))[3]).toEqual({ name: 'lx:card', ms: 21 });
    expect(readPerfMarks(null).every((r) => r.ms === null)).toBe(true);
  });
});
