import { describe, expect, it } from 'vitest';
import { dayKey } from '../../../src/domain/date';
import { Catalog } from '../../../src/modules/vocab/domain/catalog';
import { buildDayPlan } from '../../../src/modules/vocab/domain/day';
import { applyAnswer, emptyLex, introduce } from '../../../src/modules/vocab/domain/planner';
import { interleave, SessionRun, type Task } from '../../../src/modules/vocab/domain/session';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';

// Wörter-Modul V1, Runde (plan.md §2.2 startSession, §4.3, §4.4; N2; M9 Regel, M72 Grundform).

const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const ctx = { cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set<number>() };

function learned(i: number, dueIn = 0): { path: string; lex: Lex; order: number } {
  const t = T0 - 10 * D;
  let l = introduce(emptyLex('w', 'edge', t), t);
  l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: null }, ctx).lex;
  l = applyAnswer(l, { t: t + 400_000, form: 'gap', outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: null }, ctx).lex;
  return { path: `vocab/r${i}`, lex: { ...l, u: { ...l.u, due: T0 + dueIn * D }, b: { ...l.b!, due: T0 + dueIn * D } }, order: i };
}
const fresh = (i: number) => ({ path: `vocab/n${i}`, lex: emptyLex('w', 'edge', T0), order: 1000 + i });

/** Spielt eine Runde durch: jede Antwort richtig, außer `wrong` enthält den Pfad (beim ersten Mal). */
function play(run: SessionRun, cat: Catalog, wrong = new Set<string>(), start = T0): Task[] {
  const out: Task[] = [];
  let now = start;
  const failed = new Set<string>();
  for (let g = 0; g < 300; g++) {
    const t = run.next(now);
    if (!t) break;
    out.push(t);
    const it = cat.get(t.path)!;
    if (t.intro) cat.set(t.path, introduce(it.lex, now));
    else {
      const bad = wrong.has(t.path) && !failed.has(t.path);
      if (bad) failed.add(t.path);
      cat.set(t.path, applyAnswer(it.lex, { t: now, form: t.form, outcome: bad ? 'wrong' : 'ok', hint: 0, ms: 9000, fk: 1000, sentence: null }, { ...ctx, path: t.path, planned: t.planned }).lex);
    }
    run.done(t, now);
    now += 25_000;
  }
  return out;
}

describe('Pflichtrunde', () => {
  it('neue Lexeme eingestreut: erstes nach 4 Wiederholungen, letztes spätestens bei der Hälfte (M72)', () => {
    const r = Array.from({ length: 20 }, (_, i) => ({ path: `r${i}`, form: 'gap' as const, step: 0 as const, why: 'due' }));
    const n = Array.from({ length: 4 }, (_, i) => ({ path: `n${i}`, form: 'intro' as const, step: 0 as const, intro: true, why: 'new' }));
    const q = interleave(r, n).map((s) => s.path);
    const pos = n.map((x) => q.indexOf(x.path));
    expect(q.slice(0, pos[0]).filter((p) => p.startsWith('r'))).toHaveLength(4);
    expect(q.slice(0, pos[3]).filter((p) => p.startsWith('r')).length).toBeLessThanOrEqual(10);
  });
  it('Einführung → Schritt A nach ≥ 3 anderen Karten → Schritt B nach ≥ 8 Karten und ≥ 3 Min.; nur Lernschritte zeigen ein Lexem mehrfach', () => {
    const cat = new Catalog([...Array.from({ length: 25 }, (_, i) => learned(i)), fresh(1), fresh(2)]);
    const { plan } = buildDayPlan(cat, T0, DEFAULT_CFG, {});
    const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
    const tasks = play(run, cat);
    const idx = (p: string, pred: (t: Task) => boolean) => tasks.findIndex((t) => t.path === p && pred(t));
    for (const p of ['vocab/n1', 'vocab/n2']) {
      const i0 = idx(p, (t) => t.intro);
      const iA = idx(p, (t) => t.step === 1);
      const iB = idx(p, (t) => t.step === 2);
      expect(i0).toBeGreaterThanOrEqual(0);
      expect(iA - i0 - 1).toBeGreaterThanOrEqual(3);
      expect(iB - iA - 1).toBeGreaterThanOrEqual(7);
      expect((iB - iA) * 25_000).toBeGreaterThanOrEqual(3 * 60_000);
    }
    const multi = new Map<string, Task[]>();
    for (const t of tasks) multi.set(t.path, [...(multi.get(t.path) ?? []), t]);
    for (const [p, l] of multi) if (l.length > 1) expect(l.slice(1).every((t) => t.step > 0), p).toBe(true);
  });
  it('Fehler → Wiederkehr nach 3–5 Karten, frei', () => {
    const cat = new Catalog(Array.from({ length: 12 }, (_, i) => learned(i)));
    const { plan } = buildDayPlan(cat, T0, { ...DEFAULT_CFG, newPerDay: 0 }, {});
    const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
    const tasks = play(run, cat, new Set(['vocab/r3']));
    const first = tasks.findIndex((t) => t.path === 'vocab/r3');
    const again = tasks.findIndex((t, i) => i > first && t.path === 'vocab/r3');
    expect(again - first).toBeGreaterThanOrEqual(4);
    expect(again - first).toBeLessThanOrEqual(6);
    expect(['gap', 'nosent']).toContain(tasks[again]!.form);
  });
});

describe('Nebenwege laufen durch dieselbe Tagesmarke (F2, N2)', () => {
  it('„Dieses Wort üben“ und Wochen-Check: ein heute gebuchtes Lexem zählt nur als Übung', () => {
    const cat = new Catalog(Array.from({ length: 6 }, (_, i) => learned(i)));
    const { plan } = buildDayPlan(cat, T0, { ...DEFAULT_CFG, newPerDay: 0 }, {});
    play(new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG }), cat);
    const before = cat.get('vocab/r1')!.lex;
    const word = new SessionRun('word', cat, plan, T0 + 3_600_000, { cfg: DEFAULT_CFG, paths: ['vocab/r1'] });
    const t = word.next(T0 + 3_600_000)!;
    expect(t.planned).toBe(false);
    expect(t.why).toBe('practice');
    const r = applyAnswer(before, { t: T0 + 3_600_000, form: t.form, outcome: 'ok', hint: 0, ms: 1, fk: 1, sentence: null }, { ...ctx, path: t.path });
    expect(r.booked).toEqual([]);
  });
  it('„Noch 5“ nimmt nie heute Gesehenes', () => {
    const cat = new Catalog([...Array.from({ length: 10 }, (_, i) => learned(i)), ...Array.from({ length: 8 }, (_, i) => fresh(i))]);
    const { plan } = buildDayPlan(cat, T0, DEFAULT_CFG, {});
    const seen = new Set(play(new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG }), cat).map((t) => t.path));
    const more = new SessionRun('more5', cat, plan, T0 + 3_600_000, { cfg: DEFAULT_CFG, seenToday: seen });
    const got: string[] = [];
    for (let t = more.next(T0 + 3_600_000); t; t = more.next(T0 + 3_600_000)) {
      if (t.step === 0) got.push(t.path);
      more.done(t, T0 + 3_600_000);
      if (got.length > 10) break;
    }
    expect(got.filter((p) => seen.has(p))).toEqual([]);
  });
  it('Abend-Check: heute Eingeführtes, offene Lernschritte kommen als Lernschritt', () => {
    const cat = new Catalog([learned(1), fresh(1)]);
    cat.set('vocab/n1', introduce(cat.get('vocab/n1')!.lex, T0));
    const ev = new SessionRun('evening', cat, null, T0 + 3_600_000, { cfg: DEFAULT_CFG });
    const t = ev.next(T0 + 3_600_000)!;
    expect(t.path).toBe('vocab/n1');
    expect(t.step).toBe(1);
    expect(t.planned).toBe(true);
    expect(dayKey(T0)).toBe(cat.get('vocab/n1')!.lex.intro);
  });
});
