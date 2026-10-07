import { describe, expect, it } from 'vitest';
import { demoJourney } from '../../src/features/c1/journey/JourneyDemo';
import { programChapters } from '../../src/domain/c1/chapters';

// C1-Reise, Vorführung (P58): feste, erfundene Daten in Programmreihenfolge, genau ein aktuelles Kapitel, Zahlen nie über dem Gesamt.

describe('JourneyDemo', () => {
  it('liefert 7 Kapitel in Programmreihenfolge mit genau einem aktuellen', () => {
    const p = demoJourney();
    expect(p.map((c) => c.id)).toEqual(programChapters().map((c) => c.id));
    expect(p.filter((c) => c.status === 'current')).toHaveLength(1);
    for (const c of p) expect(c.patSafe).toBeLessThanOrEqual(c.patTotal);
    expect(p.filter((c) => c.status === 'done').every((c) => c.allSafe)).toBe(true);
  });
});
