import { describe, expect, it } from 'vitest';
import { bigGain, patternGains } from '../../src/features/today/doneCard';
import { patternById, topicsWithPatterns, patternsOf } from '../../src/domain/grammar/patterns';

// Abschlusskarte (Lernplattform 2.0 §5.10): große Zahl = echter Zuwachs, Wahrheitszeile nur bei echtem Zustandswechsel.

const topic = topicsWithPatterns()[0] as string;
const pat = (patternsOf(topic)?.patterns[0] ?? { id: '' }).id;
const TODAY = '2026-10-07';
// „Sicher“: von den letzten 3 Ergebnissen mindestens 2 richtig ohne Hilfe, an mindestens 2 Tagen (`r` Bits, `k` Zahl, `dd` Tage).
const safeEntry = { n: 6, c: 5, last: 1, r: 0b111, k: 3, dd: ['2026-10-05', '2026-10-06'], s: '2026-10-06' };

describe('patternGains', () => {
  it('nennt ein Muster, das seit dem Morgen sicher wurde, mit seinem Namen', () => {
    const docs = new Map([[topic, { pats: { [pat]: safeEntry } }]]);
    const r = patternGains({ ps: { [pat]: 1 }, grammarDocs: docs, today: TODAY, lang: 'de' });
    const name = patternById(pat)?.name.de;
    expect(r.count).toBe(1);
    expect(r.names).toEqual([name]);
  });
  it('nennt nichts, wenn das Muster schon am Morgen sicher war oder noch lernt', () => {
    const docs = new Map([[topic, { pats: { [pat]: safeEntry } }]]);
    expect(patternGains({ ps: { [pat]: 2 }, grammarDocs: docs, today: TODAY, lang: 'de' }).count).toBe(0);
    expect(patternGains({ ps: { [pat]: 0 }, grammarDocs: new Map(), today: TODAY, lang: 'de' }).count).toBe(0);
    expect(patternGains({ ps: undefined, grammarDocs: new Map(), today: TODAY, lang: 'de' })).toEqual({ count: 0, names: [] });
  });
});

describe('bigGain', () => {
  it('bevorzugt Wörter, dann Muster, sonst nichts – nie eine Antwortzahl', () => {
    expect(bigGain({ wordsSure: 3, patterns: 2 })).toEqual({ kind: 'words', n: 3 });
    expect(bigGain({ wordsSure: 0, patterns: 2 })).toEqual({ kind: 'patterns', n: 2 });
    expect(bigGain({ wordsSure: null, patterns: 0 })).toBeNull();
  });
});
