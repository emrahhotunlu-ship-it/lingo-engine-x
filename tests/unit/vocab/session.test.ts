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
  it('kurze Runde (nur neue Wörter): Schritt A kommt noch in derselben Runde, zuerst ein anderes Wort; Schritt B nicht verfrüht (UX V3 Nr. 3)', () => {
    const cat = new Catalog([fresh(1), fresh(2)]);
    const { plan } = buildDayPlan(cat, T0, DEFAULT_CFG, {});
    const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
    const tasks = play(run, cat);
    for (const p of ['vocab/n1', 'vocab/n2']) {
      expect(tasks.filter((t) => t.path === p && t.intro)).toHaveLength(1);
      expect(tasks.filter((t) => t.path === p && t.step === 1)).toHaveLength(1);
      expect(tasks.some((t) => t.path === p && t.step === 2)).toBe(false);
    }
    for (let i = 1; i < tasks.length; i++) if (tasks[i]!.path === tasks[i - 1]!.path) expect(tasks.slice(i).every((t) => t.path === tasks[i]!.path)).toBe(true);
  });
  it('Fortschritt „x von y“: ohne Fehler bleibt die Gesamtzahl fest und endet genau an der letzten Karte (UX-Nachprüfung V3)', () => {
    for (const items of [[fresh(1), fresh(2), fresh(3)], [...Array.from({ length: 10 }, (_, i) => learned(i)), fresh(1), fresh(2)]]) {
      const cat = new Catalog(items);
      const { plan } = buildDayPlan(cat, T0, DEFAULT_CFG, {});
      const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
      const totals: number[] = [];
      let now = T0;
      let n = 0;
      for (let g = 0; g < 300; g++) {
        const t = run.next(now);
        if (!t) break;
        // wie learnRun: Karten davor + diese + danach (ein neues Wort bringt seinen Schritt A mit)
        totals.push(n + 1 + run.remaining() + (t.intro ? 1 : 0));
        const it = cat.get(t.path)!;
        cat.set(t.path, t.intro ? introduce(it.lex, now) : applyAnswer(it.lex, { t: now, form: t.form, outcome: 'ok', hint: 0, ms: 9000, fk: 1000, sentence: null }, { ...ctx, path: t.path, planned: t.planned }).lex);
        run.done(t, now);
        n += 1;
        now += 25_000;
      }
      expect(new Set(totals)).toEqual(new Set([n]));
    }
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

describe('Kontrastkarten (M14)', () => {
  it('offene Kontrastkarten zuerst, höchstens zwei, jüngste vorn, ohne Planwirkung; nicht in „Dieses Wort“', () => {
    const withCt = (i: number, at: number) => {
      const it = learned(i, 5);
      return { ...it, lex: { ...it.lex, ct: { at, w: 'other' } } };
    };
    const cat = new Catalog([...Array.from({ length: 8 }, (_, i) => learned(i)), withCt(20, T0 - 3 * D), withCt(21, T0 - D), withCt(22, T0 - 2 * D)]);
    const { plan } = buildDayPlan(cat, T0, { ...DEFAULT_CFG, newPerDay: 0 }, {});
    const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
    const a = run.next(T0)!;
    const b = run.next(T0)!;
    expect([a.path, b.path]).toEqual(['vocab/r21', 'vocab/r22']);
    for (const t of [a, b]) expect([t.form, t.planned, t.why]).toEqual(['contrast', false, 'contrast']);
    expect(run.next(T0)!.form).not.toBe('contrast');
    const word = new SessionRun('word', cat, null, T0, { cfg: DEFAULT_CFG, paths: ['vocab/r21'] });
    expect(word.next(T0)!.form).not.toBe('contrast');
  });
});

describe('Kontrastkarte entfällt, wenn das Wort heute fällig abgefragt wird (learning-scientist V3 S3, B1)', () => {
  it('fällig und offener Kontrast: nur die fällige Abfrage, keine Kontrastkarte davor', () => {
    const due = learned(3, 0);
    const it3 = { ...due, lex: { ...due.lex, ct: { at: T0 - 2 * D, w: 'other' } } };
    const cat = new Catalog([...Array.from({ length: 3 }, (_, i) => learned(i)), it3]);
    const { plan } = buildDayPlan(cat, T0, { ...DEFAULT_CFG, newPerDay: 0 }, {});
    expect(plan.plan.map((e) => e[0])).toContain('vocab/r3');
    const run = new SessionRun('pflicht', cat, plan, T0, { cfg: DEFAULT_CFG });
    const forms: string[] = [];
    for (let t = run.next(T0); t; t = run.next(T0)) {
      forms.push(`${t.path}:${t.form}`);
      run.done(t, T0);
    }
    expect(forms.filter((f) => f.endsWith(':contrast'))).toEqual([]);
    expect(forms.some((f) => f.startsWith('vocab/r3:'))).toBe(true);
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

describe('Anwenden frei gestartet (Großpaket B3, Art `use`)', () => {
  it('nur die Anwenden-Aufgabe, ohne Lernschritte und Kontrastkarten; ohne Lexeme der Stufen 4–6 leer', () => {
    const low = new Catalog([learned(1), learned(2)]);
    expect(new SessionRun('use', low, null, T0, { cfg: DEFAULT_CFG }).next(T0)).toBeNull();
    const ripe = (i: number) => {
      const it = learned(i, 2);
      return { ...it, lex: { ...it.lex, lv: 5, ct: { at: T0 - D, w: 'x' } } };
    };
    const cat = new Catalog([ripe(1), ripe(2), ripe(3), learned(4)]);
    const run = new SessionRun('use', cat, null, T0, { cfg: DEFAULT_CFG });
    const t = run.next(T0)!;
    expect(t.form).toBe('transfer');
    expect(t.group?.length).toBe(3);
    run.done(t, T0);
    expect(run.next(T0)).toBeNull();
  });
});
