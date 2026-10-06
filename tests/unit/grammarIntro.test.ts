import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/domain/content';
import { freezeGrammarDay } from '../../src/domain/grammar/path';
import { patternsOf } from '../../src/domain/grammar/patterns';
import { allSeedTasks, selectRound } from '../../src/domain/grammar/tasks';
import { grammarWrite } from '../../src/domain/grammar/write';
import { patsOf } from '../../src/domain/metrics/pattern';
import type { GrammarAnswer, GrammarTask } from '../../src/domain/learn/types';
import { addLocalDays } from '../../src/domain/date';
import { berlin } from './helpers';

type D = Record<string, unknown>;
const ans = (task: GrammarTask, day: string, t: number, over: Partial<GrammarAnswer> = {}): GrammarAnswer => ({ kind: 'g', t, day, lang: 'de', ctx: 'duty', task, given: task.answer, dontKnow: false, verdict: 'correct', grade: 3, ms: 4000, help: { level: 0 }, judged: 'local', ...over });
const merge = (cur: D | undefined, a: GrammarAnswer): D | undefined => {
  const w = grammarWrite(cur, a);
  if (w.kind === 'create') return w.doc;
  if (w.kind === 'update') return { ...cur, ...w.patch };
  return cur;
};

describe('Schreibweg pats und vt (§8)', () => {
  const t0 = berlin('2026-10-06', 10);
  const gap = allSeedTasks().find((t) => t.topic === 'mixed-cond' && t.type === 'gap' && t.pat)!;

  it('schreibt pats mit Einführungstag, Zählern und Bits', () => {
    const doc = merge(undefined, ans(gap, '2026-10-06', t0))!;
    const e = patsOf(doc)[gap.pat!]!;
    expect(e).toMatchObject({ n: 1, c: 1, i: '2026-10-06', k: 1, r: 1, last: t0 });
    expect(Object.keys(patsOf(doc))).toEqual([gap.pat]);
    const doc2 = merge(doc, ans(gap, '2026-10-07', t0 + 5000, { verdict: 'wrong', given: 'x', grade: 1 }))!;
    expect(patsOf(doc2)[gap.pat!]).toMatchObject({ n: 2, c: 1, k: 2, r: 2, i: '2026-10-06' });
  });

  it('Bestand: ein begonnenes Thema legt beim ersten Schreiben alle Muster mit dem Tag des ersten hist an', () => {
    const cur = { id: 'mixed-cond', p: 0.5, n: 7, c: 5, last: t0 - 1000, hist: [{ d: '2026-09-15', p: 0.4 }], recent: [], seen: [], seenText: [], errors: [] };
    const doc = merge(cur, ans(gap, '2026-10-06', t0))!;
    const pats = patsOf(doc);
    const all = patternsOf('mixed-cond')!.patterns.map((p) => p.id);
    expect(Object.keys(pats).sort()).toEqual([...all].sort());
    for (const id of all) if (id !== gap.pat) expect(pats[id]).toMatchObject({ n: 0, i: '2026-09-15' });
    expect(pats[gap.pat!]).toMatchObject({ n: 1, i: '2026-09-15' });
  });

  it('Vortest bestanden: vt steht im Thema; p ≥ 0,6 nur, wenn alle Muster getestet sind', () => {
    const all = patternsOf('mixed-cond')!.patterns.map((p) => p.id);
    const two = all.slice(0, 2);
    const w1 = merge(undefined, ans(gap, '2026-10-06', t0, { vt: { ok: true, pats: two } }))!;
    expect(w1.vt).toEqual({ d: '2026-10-06', ok: true, pats: two });
    expect(w1.p as number).toBeLessThan(0.6);
    const w2 = merge(undefined, ans(gap, '2026-10-06', t0, { vt: { ok: true, pats: all } }))!;
    expect(w2.p as number).toBeGreaterThanOrEqual(0.6);
    const w3 = merge(undefined, ans(gap, '2026-10-06', t0, { vt: { ok: false, pats: two } }))!;
    expect(w3.vt).toMatchObject({ ok: false });
  });

  it('Aufgaben ohne Fehlerfassung: meaning und fehlerfreies find legen keinen Fehlersatz an', () => {
    const m = allSeedTasks().find((t) => t.type === 'meaning')!;
    const doc = merge(undefined, ans(m, '2026-10-06', t0, { verdict: 'wrong', given: 'b', grade: 1 }))!;
    expect(doc.errors).toEqual([]);
    expect(patsOf(doc)[m.pat!]).toMatchObject({ n: 1, c: 0 });
  });
});

describe('Einführung über mehrere Tage (§3.2)', () => {
  it('mixed-cond: an mindestens 3 Lerntagen, nie mehr als 2 Muster je Tag, kein Muster vor seiner Einführung, die 4 Einführungsaufgaben am Stück', () => {
    const plan = (topic: string) => patternsOf(topic)?.introPlan ?? null;
    let docs = new Map<string, D>(TOPICS.filter((tp) => tp.id !== 'mixed-cond').map((tp) => [tp.id, { id: tp.id, p: 0.97, n: 40, c: 38, due: berlin('2027-01-01', 10), last: berlin('2026-09-30', 10), hist: [{ d: '2026-08-20', p: 0.4 }], recent: [1, 1], seen: [], seenText: [], errors: [] }]));
    let day = '2026-10-01';
    const introDays: string[] = [];
    let k = 0;
    for (let n = 0; n < 14; n++) {
      const nowMs = berlin(day, 10);
      const { gt } = freezeGrammarDay({ docs, today: day, nowMs, introPlanOf: plan, seed: day });
      const block = gt.intro === 'mixed-cond' && gt.pats.length ? { topic: 'mixed-cond', pats: gt.pats } : null;
      const round = selectRound({ mode: 'duty', grammarDocs: docs, dailyOpen: [], pool: [], nowMs, size: 6, seed: `${day}|x`, errorsMax: 0, gt, ...(block ? { introBlock: block } : {}) });
      if (block) {
        introDays.push(day);
        expect(block.pats.length).toBeLessThanOrEqual(2);
        for (const t of round.slice(0, 4)) {
          expect(t.topic).toBe('mixed-cond');
          expect(block.pats).toContain(t.pat);
        }
      }
      // Kein Muster vor seiner Einführung (außer dem heutigen Schritt).
      const known = new Set(Object.entries(patsOf(docs.get('mixed-cond'))).filter(([, e]) => e.i !== undefined).map(([id]) => id));
      for (const t of round) if (t.topic === 'mixed-cond' && !block?.pats.includes(t.pat!)) expect(known.has(t.pat!), `${day}: ${t.pat}`).toBe(true);
      for (const t of round) {
        k++;
        const next = merge(docs.get(t.topic), ans(t, day, nowMs + k));
        if (next) docs = new Map(docs).set(t.topic, next);
      }
      day = addLocalDays(berlin(day, 10), 1) === 0 ? day : new Date(addLocalDays(berlin(day, 10), 1)).toLocaleDateString('sv', { timeZone: 'Europe/Berlin' });
    }
    expect(introDays.length).toBeGreaterThanOrEqual(3);
    expect(new Set(introDays).size).toBe(introDays.length);
    const all = patternsOf('mixed-cond')!.patterns.map((p) => p.id);
    expect(Object.keys(patsOf(docs.get('mixed-cond'))).sort()).toEqual(expect.arrayContaining(all.slice(0, 4)));
  });
});
