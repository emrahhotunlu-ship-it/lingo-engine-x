// Tempo-Runde (Lernplattform 3.0 §2.3, P24): Auswahl, Zielzeiten, Messwerte aus dem Protokoll.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { flags } from '../../src/app/flags';
import { resetPackedCache } from '../../src/content/store';
import { c1Items, preloadC1x, resetC1Store } from '../../src/domain/c1x/preload';
import { kwtSplit, safePatterns, selectTempo, spreadKinds, targetMs, tempoEligible, TEMPO_MIN, TEMPO_SIZE } from '../../src/domain/c1x/tempo';
import type { C1Item, C1Kind, Err } from '../../src/domain/c1x/types';
import type { GrammarAnswer } from '../../src/domain/learn/types';
import { median, medianTm, MIN_SAMPLES, recentMedian, slownessByPattern, summarizeTempo, typedSamples, weeklyMedians } from '../../src/domain/metrics/tempo';
import { grammarLogEntry } from '../../src/domain/progress/logPatch';

const TODAY = '2026-09-20';
type Doc = Record<string, unknown>;

/** Muster-Eintrag mit Zustand „Sicher“ (2 von 3 richtig ohne Hilfe an 2 Tagen). */
const SAFE: Doc = { n: 5, c: 5, last: 1, h: 0, r: 31, k: 5, dd: ['2026-09-18', '2026-09-19'], s: '2026-09-18', i: '2026-09-01' };
/** Muster-Eintrag mit Zustand „Lernt“. */
const LEARNING: Doc = { n: 3, c: 1, last: 1, h: 2, r: 0, k: 3, dd: [] };

function docsFor(items: readonly C1Item[], safeIf: (pat: string) => boolean): Map<string, Doc> {
  const docs = new Map<string, Doc>();
  for (const i of items) {
    const topic = i.topic ?? 'lex';
    const d = docs.get(topic) ?? { pats: {} };
    (d.pats as Record<string, Doc>)[i.pat] = safeIf(i.pat) ? SAFE : LEARNING;
    docs.set(topic, d);
  }
  return docs;
}

let all: C1Item[] = [];
beforeAll(async () => {
  resetC1Store();
  resetPackedCache();
  await preloadC1x(['ocl', 'kwt', 'err']);
  all = (['ocl', 'kwt', 'err'] as const).flatMap((k) => [...c1Items(k)]);
});
beforeEach(() => {
  for (const k of ['ocl', 'kwt', 'err'] as const) flags.c1xKinds[k] = true;
});
afterEach(() => {
  flags.c1xKinds.ocl = true;
  flags.c1xKinds.kwt = true;
  flags.c1xKinds.err = true;
});

const AVAIL = new Set<C1Kind>(['ocl', 'kwt', 'err']);

describe('Zielzeit (§2.3)', () => {
  it('= „Gut bis“ der Note, am Handy mal 1,4', () => {
    expect(targetMs('ocl', 'desk')).toBe(6000);
    expect(targetMs('ocl', 'touch')).toBe(8400);
    expect(targetMs('kwt', 'desk')).toBe(14000);
    expect(targetMs('kwt', 'touch')).toBe(19600);
    expect(targetMs('err', 'desk')).toBe(8000);
    expect(targetMs('err', 'touch')).toBe(16800);
  });
});

describe('Eignung', () => {
  it('der Bestand enthält genug passende Aufgaben aller drei Arten', () => {
    for (const k of ['ocl', 'kwt', 'err'] as const) expect(c1Items(k).filter(tempoEligible).length, k).toBeGreaterThan(5);
  });
  it('kwt: Teil B höchstens 3 Wörter, der Anfang steht fest; err: fehlerfrei oder 1-Wort-Korrektur', () => {
    for (const i of c1Items('kwt').filter(tempoEligible)) expect(kwtSplit(i as never)).not.toBeNull();
    for (const i of c1Items('err').filter(tempoEligible)) {
      const e = i as Err;
      if (e.bad) expect(e.bad.fix[0]?.trim()).toMatch(/^\S+$/);
    }
  });
  it('andere Arten sind nie geeignet', () => {
    expect(tempoEligible({ kind: 'mcc' } as C1Item)).toBe(false);
  });
});

describe('selectTempo', () => {
  const docs = (): Map<string, Doc> => docsFor(all, () => true);

  it('12 Aufgaben aus Mustern ab „Sicher“, ≥ 3 Themen, Quote 6 · 4 · 2', () => {
    const sel = selectTempo({ grammarDocs: docs(), today: TODAY, seed: 'a', avail: AVAIL });
    expect(sel).toHaveLength(TEMPO_SIZE);
    const by = (k: string): number => sel.filter((i) => i.kind === k).length;
    expect([by('ocl'), by('kwt'), by('err')]).toEqual([6, 4, 2]);
    expect(new Set(sel.map((i) => i.topic ?? 'lex')).size).toBeGreaterThanOrEqual(3);
    expect(new Set(sel.map((i) => i.id)).size).toBe(sel.length);
    for (const i of sel) expect(tempoEligible(i)).toBe(true);
  });

  it('nur Muster ab „Sicher“: „Lernt“-Muster kommen nie vor', () => {
    const pats = [...new Set(all.map((i) => i.pat))].sort();
    const safeSet = new Set(pats.filter((_, n) => n % 2 === 0));
    const d = docsFor(all, (p) => safeSet.has(p));
    expect(safePatterns(d, TODAY).size).toBe(safeSet.size);
    for (const seed of ['a', 'b', 'c', 'd']) {
      const sel = selectTempo({ grammarDocs: d, today: TODAY, seed, avail: AVAIL });
      expect(sel.length).toBeGreaterThanOrEqual(TEMPO_MIN);
      for (const i of sel) expect(safeSet.has(i.pat), i.pat).toBe(true);
    }
  });

  it('nie 3 gleiche Arten hintereinander, über viele Startwerte', () => {
    for (let n = 0; n < 40; n++) {
      const sel = selectTempo({ grammarDocs: docs(), today: TODAY, seed: `s${n}`, avail: AVAIL });
      for (let k = 2; k < sel.length; k++) expect(sel[k]?.kind === sel[k - 1]?.kind && sel[k]?.kind === sel[k - 2]?.kind, `seed s${n} pos ${k}`).toBe(false);
    }
  });

  it('mindestens ein fehlerfreier err-Satz', () => {
    for (let n = 0; n < 20; n++) {
      const sel = selectTempo({ grammarDocs: docs(), today: TODAY, seed: `e${n}`, avail: AVAIL });
      expect(sel.some((i) => i.kind === 'err' && (i).bad === null), `seed e${n}`).toBe(true);
    }
  });

  it('die langsamsten Muster zuerst', () => {
    const slowPat = c1Items('ocl').find(tempoEligible)?.pat as string;
    const slow = new Map<string, number>([[slowPat, 3]]);
    const sel = selectTempo({ grammarDocs: docs(), today: TODAY, seed: 'x', slow, avail: AVAIL });
    expect(sel[0]?.pat).toBe(slowPat);
  });

  it('weniger als 4 passende Aufgaben oder keine sicheren Muster: leer (Rückfall auf Sätze bauen)', () => {
    expect(selectTempo({ grammarDocs: docsFor(all, () => false), today: TODAY, seed: 'a', avail: AVAIL })).toEqual([]);
    expect(selectTempo({ grammarDocs: new Map(), today: TODAY, seed: 'a', avail: AVAIL })).toEqual([]);
    // Nur 3 passende Aufgaben übrig (alle anderen gemeldet): unter dem Mindestwert.
    const keep = all.filter((i) => tempoEligible(i)).slice(0, TEMPO_MIN - 1);
    const bad = new Set(all.filter((i) => !keep.includes(i)).map((i) => i.id));
    expect(selectTempo({ grammarDocs: docsFor(all, () => true), today: TODAY, seed: 'a', avail: AVAIL, bad })).toEqual([]);
    // Genau 4: die Runde gibt es, kürzer als 12.
    const keep4 = all.filter((i) => tempoEligible(i)).slice(0, TEMPO_MIN);
    const bad4 = new Set(all.filter((i) => !keep4.includes(i)).map((i) => i.id));
    expect(selectTempo({ grammarDocs: docsFor(all, () => true), today: TODAY, seed: 'a', avail: AVAIL, bad: bad4 })).toHaveLength(TEMPO_MIN);
  });

  it('gesehene Aufgaben kommen erst nach den ungesehenen', () => {
    const d = docs();
    const sel0 = selectTempo({ grammarDocs: d, today: TODAY, seed: 'seen', avail: AVAIL });
    for (const i of sel0) {
      const doc = d.get(i.topic ?? 'lex') as Doc;
      doc.seen = [...((doc.seen as string[] | undefined) ?? []), `c1:${i.id}`];
    }
    const sel1 = selectTempo({ grammarDocs: d, today: TODAY, seed: 'seen', avail: AVAIL });
    const ids0 = new Set(sel0.map((i) => i.id));
    expect(sel1.filter((i) => ids0.has(i.id)).length).toBeLessThan(sel1.length / 2);
  });

  it('abgeschaltete Arten fehlen in der Runde', () => {
    const sel = selectTempo({ grammarDocs: docs(), today: TODAY, seed: 'a', avail: new Set<C1Kind>(['ocl']) });
    expect(sel.length).toBeGreaterThan(0);
    expect(sel.every((i) => i.kind === 'ocl')).toBe(true);
  });
});

describe('spreadKinds', () => {
  it('trennt Serien und lässt die Reihenfolge sonst', () => {
    const k = (kind: C1Kind) => ({ kind });
    const out = spreadKinds([k('ocl'), k('ocl'), k('ocl'), k('kwt'), k('kwt'), k('err')]);
    for (let n = 2; n < out.length; n++) expect(out[n]?.kind === out[n - 1]?.kind && out[n]?.kind === out[n - 2]?.kind).toBe(false);
    expect(out.map((x) => x.kind).sort()).toEqual(['err', 'kwt', 'kwt', 'ocl', 'ocl', 'ocl']);
  });
});

// ------------------------------------------------------------------ Messwerte

const g = (over: Record<string, unknown>) => ({ k: 'g', ok: true, free: true, c1k: 'ocl', tm: 5000, pat: 'p.a', dev: 'k', t: 1, ...over });

describe('Messwerte (domain/metrics/tempo)', () => {
  it('typedSamples: nur richtige, getippte Antworten mit gültiger Zeit', () => {
    const s = typedSamples([g({}), g({ ok: false }), g({ free: false }), g({ tm: 0 }), g({ tm: 'x' }), g({ k: 'v' }), g({ c1k: undefined })]);
    expect(s).toHaveLength(1);
  });
  it('median', () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(medianTm([g({ tm: 4000 }), g({ tm: 8000 })])).toBe(6000);
  });
  it('slownessByPattern: Median / Zielzeit, Handy mit Faktor, nur die drei Arten', () => {
    const m = slownessByPattern([g({ tm: 12000 }), g({ tm: 6000 }), g({ pat: 'p.b', tm: 8400, dev: 't' }), g({ pat: 'p.c', c1k: 'wf', tm: 9000 })]);
    expect(m.get('p.a')).toBe(1.5);
    expect(m.get('p.b')).toBe(1);
    expect(m.has('p.c')).toBe(false);
  });
  it('recentMedian erst ab genug Antworten', () => {
    const day = (n: number) => ({ day: TODAY, entries: Array.from({ length: n }, (_, i) => g({ tm: 1000 * (i + 1) })) });
    expect(recentMedian([day(MIN_SAMPLES - 1)])).toBeNull();
    expect(recentMedian([day(5)])).toEqual({ ms: 3000, n: 5 });
  });
  it('weeklyMedians: vier Wochen, neueste zuerst', () => {
    const entries = Array.from({ length: 5 }, () => g({ tm: 4000 }));
    const w = weeklyMedians([{ day: '2026-09-18', entries }, { day: '2026-09-05', entries: entries.map((e) => ({ ...e, tm: 9000 })) }], TODAY, 4);
    expect(w).toHaveLength(4);
    expect(w[0]).toMatchObject({ n: 5, ms: 4000 });
    expect(w[1]?.ms).toBeNull();
    expect(w[2]).toMatchObject({ n: 5, ms: 9000 });
  });
  it('summarizeTempo: richtig, in der Zielzeit, Schnitt über die richtigen', () => {
    const rows = [
      { kind: 'ocl' as const, ok: true, ms: 4000, target: 6000 },
      { kind: 'ocl' as const, ok: true, ms: 8000, target: 6000 },
      { kind: 'kwt' as const, ok: false, ms: 1000, target: 14000 },
    ];
    expect(summarizeTempo(rows)).toEqual({ total: 3, right: 2, inTarget: 1, avgMs: 6000 });
    expect(summarizeTempo([]).avgMs).toBeNull();
  });
});

describe('Protokoll: tm', () => {
  const answer = (over: Partial<GrammarAnswer>): GrammarAnswer =>
    ({
      kind: 'g', t: 1, day: TODAY, lang: 'de', ctx: 'xtra', given: 'x', dontKnow: false, verdict: 'correct', grade: 3, ms: 4321, help: { level: 0 }, judged: 'local',
      task: { key: 'k', topic: 'tp', type: 'gap', prompt: 'p ___', answer: 'a', accepted: [], options: null, hint: null, expl: { de: null, en: null }, src: 'seed', ref: null, errorT: null, pat: 'p.a' },
      ...over,
    });

  it('jede getippte c1x-Antwort bekommt tm (ms), Auswahl und alte Aufgaben nicht', () => {
    expect(grammarLogEntry(answer({ pts: [1, 1], free: true, c1k: 'ocl' })).tm).toBe(4321);
    expect(grammarLogEntry(answer({ pts: [1, 1], free: false, c1k: 'mcc' })).tm).toBeUndefined();
    expect(grammarLogEntry(answer({})).tm).toBeUndefined();
  });
});
