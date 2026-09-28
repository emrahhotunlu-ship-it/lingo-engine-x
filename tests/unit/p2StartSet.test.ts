import { describe, expect, it } from 'vitest';
import { TRAPS, trapById } from '../../src/content/nb/traps';
import { mixStartSet, startSetDrill, startTraps, START_MIX, type DrillTask } from '../../src/domain/patterns/drill';

// N43 (lehrer.md W9): Der Fallen-Drill mischt 3 Startsatz-Fallen mit den eigenen Sätzen.

const own: DrillTask[] = [
  { kind: 'fix', wrong: 'a', right: 'b' },
  { kind: 'fix', wrong: 'c', right: 'd' },
  { kind: 'free', task: 'e' },
  { kind: 'free', task: 'f' },
];

describe('Startsatz im Fallen-Drill', () => {
  it('3 Fallen: zuerst die im Beispiel erkannte, dann die der Woche, dann der Startsatz – fest je Tag', () => {
    const traps = startTraps({ examples: [{ wrong: 'Did you become my email?', right: 'Did you get my email?' }] }, '2026-09-20', ['f05']);
    expect(traps).toHaveLength(START_MIX);
    expect(traps.map((t) => t.id).slice(0, 2)).toEqual(['f03', 'f05']);
    expect(startTraps(null, '2026-09-20').map((t) => t.id)).toEqual(startTraps(null, '2026-09-20').map((t) => t.id));
  });

  it('verschachtelt: eigene Aufgaben bleiben in Reihenfolge, 3 Startsatz-Sätze dazwischen', () => {
    const mixed = mixStartSet(own, startTraps(null, '2026-09-20'), '2026-09-20');
    expect(mixed).toHaveLength(own.length + START_MIX);
    expect(mixed.filter((m) => m.kind !== 'trap')).toEqual(own);
    expect(mixed.map((m) => m.kind)).toEqual(['fix', 'trap', 'fix', 'free', 'trap', 'free', 'trap']);
    expect(mixed.filter((m) => m.kind === 'trap').every((m) => m.kind === 'trap' && m.right.length > 0)).toBe(true);
    // Ohne eigene Aufgaben: nur die 3 Startsatz-Sätze.
    expect(mixStartSet([], startTraps(null, 'x'), 'x')).toHaveLength(3);
  });

  it('Drill einer einzelnen Startsatz-Falle: ihre 3 Sätze', () => {
    const d = startSetDrill(trapById('f01')!);
    expect(d.map((x) => x.wrong)).toEqual(TRAPS[0]!.drills.map((x) => x.wrong));
  });
});
