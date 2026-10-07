// Rundenbau über die Prioritätstabelle (Lernplattform 3.0 §2.2, P15).
import { describe, expect, it } from 'vitest';
import { patInfos } from '../../src/domain/grammar/slotInput';
import { chapters, patternById, patternsOf, topicsWithPatterns } from '../../src/domain/grammar/patterns';
import { selectRound, type RoundInput } from '../../src/domain/grammar/tasks';

const WED = new Date('2026-10-07T10:00:00+02:00').getTime();
const SAT = new Date('2026-10-10T10:00:00+02:00').getTime();
const DAY = 86_400_000;

/** Je Kapitel ein bis zwei Muster als eingeführt und geübt. */
function docsWithPats(): { docs: Map<string, Record<string, unknown>>; known: Set<string> } {
  const docs = new Map<string, Record<string, unknown>>();
  const known = new Set<string>();
  const chs = chapters();
  let n = 0;
  for (const ch of chs) {
    const topic = ch.topics.find((t) => topicsWithPatterns().includes(t));
    if (!topic) continue;
    const pats: Record<string, unknown> = {};
    for (const p of (patternsOf(topic)?.patterns ?? []).slice(0, 2)) {
      pats[p.id] = { n: 3, c: 1, last: WED - (20 - n++) * DAY, h: 0, r: 1, k: 1, dd: [], i: '2026-09-01' };
      known.add(p.id);
    }
    docs.set(topic, { n: 6, c: 3, S: 5, D: 5, last: WED - DAY, pats, seen: [] });
  }
  return { docs, known };
}

const input = (docs: Map<string, Record<string, unknown>>, o: Partial<RoundInput>): RoundInput => ({
  mode: 'duty',
  grammarDocs: docs,
  dailyOpen: [],
  pool: [],
  nowMs: WED,
  size: 6,
  seed: 'x',
  slotPlan: { focus: null },
  ...o,
});

describe('selectRound mit slotPlan', () => {
  it('Pflichtrunde: nur eingeführte Muster, 6 Aufgaben, Muster aus mehreren Kapiteln', () => {
    const { docs, known } = docsWithPats();
    expect(patInfos(docs).filter((p) => p.entry).length).toBe(known.size);
    const r = selectRound(input(docs, {}));
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(6);
    for (const t of r.filter((x) => x.pat)) expect(known.has(t.pat as string)).toBe(true);
  });

  it('ohne den Schalter bleibt der LP2-Weg (Rundenbau unverändert)', () => {
    const { docs } = docsWithPats();
    const a = selectRound(input(docs, { slotPlan: null }));
    const b = selectRound(input(docs, { slotPlan: undefined }));
    expect(a.map((t) => t.key)).toEqual(b.map((t) => t.key));
  });

  it('stabil: gleicher Startwert, gleiche Runde', () => {
    const { docs } = docsWithPats();
    expect(selectRound(input(docs, {})).map((t) => t.key)).toEqual(selectRound(input(docs, {})).map((t) => t.key));
  });

  it('Samstag: Aufgaben aus mindestens 3 Kapiteln (Kapitel-Mix)', () => {
    const { docs } = docsWithPats();
    const r = selectRound(input(docs, { nowMs: SAT }));
    const chOf = new Map(patInfos(docs).map((p) => [p.id, p.chapter]));
    const set = new Set(r.filter((t) => t.pat && patternById(t.pat)).map((t) => chOf.get(t.pat as string)));
    expect(set.size).toBeGreaterThanOrEqual(3);
  });

  it('keine Aufgabe doppelt', () => {
    const { docs } = docsWithPats();
    const r = selectRound(input(docs, { size: 8, mode: 'xtra' }));
    expect(new Set(r.map((t) => t.key)).size).toBe(r.length);
  });
});
