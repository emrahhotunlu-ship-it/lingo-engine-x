import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { applyUse, sentenceWith, type UseInput, withOwnSentence } from '../../../src/modules/vocab/domain/apply';
import { Catalog, forecastMinutes } from '../../../src/modules/vocab/domain/catalog';
import { applyAnswer, emptyLex, FLAG, introduce, type PlanCtx, retOf } from '../../../src/modules/vocab/domain/planner';
import {
  attemptsOf,
  boostExtraMinutes,
  groupCounts,
  retention,
  retentionGap,
  safetyMinutes,
  timeline,
  youngBoost,
} from '../../../src/modules/vocab/domain/stats';
import { ivlFactor } from '../../../src/modules/vocab/domain/tracks';
import { DEFAULT_CFG, type Lex, OS_MAX } from '../../../src/modules/vocab/domain/types';
import { tuple, type VlogTuple } from '../../../src/modules/vocab/domain/vlog';
import { vlogIdsInRange } from '../../../src/modules/vocab/domain/vlogIndex';
import { readVlogRange } from '../../../src/modules/vocab/data/history';
import { freezeDay } from '../../../src/modules/vocab/data/store';
import { lexWriteSchema, vmodDayWriteSchema } from '../../../src/modules/vocab/data/schemas';

// Großpaket A S6a: Rechnungen für Wort-Seite, Übersicht und Einstellungen; „Junge Wörter früher“; „Deine Sätze“.

type Doc = Record<string, unknown>;
const T0 = Date.parse('2026-11-02T18:00:00Z'); // Mo 19:00 Berlin
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({ cfg: DEFAULT_CFG, path: 'vocab/x', planned: true, load: () => 0, siblings: new Set(), ...over });

const tp = (t: number, note: number, lv: number, o: { path?: string; flags?: number; hint?: number; form?: 'gap' | 'meaning' | 'intro' } = {}): VlogTuple =>
  tuple({ t, path: o.path ?? 'vocab/x', track: 0, form: o.form ?? 'gap', note, outcome: note === 1 ? 'wrong' : 'ok', ms: 9000, fk: 2000, hint: o.hint ?? 0, sentence: 'a', lv, flags: o.flags ?? 0 });

function many(n: number, ok: number, lv: number, at = T0 - 2 * D): VlogTuple[] {
  return Array.from({ length: n }, (_, i) => tp(at + i * 1000, i < ok ? 3 : 1, i < ok ? lv : Math.max(2, lv - 1)));
}

describe('retention', () => {
  it('zählt nur Antworten mit Planwirkung im Fenster, ohne Lernschritte; trennt jung (≤ 4) und gefestigt (≥ 5)', () => {
    const r = retention(
      [
        tp(T0 - D, 3, 5),
        tp(T0 - D, 1, 4), // falsch, vorher Stufe 5 → gefestigt
        tp(T0 - D, 3, 3),
        tp(T0 - D, 2, 4), // schwer zählt als richtig
        tp(T0 - D, 0, 4), // ohne Planwirkung
        tp(T0 - D, 3, 3, { flags: FLAG.step }),
        tp(T0 - 40 * D, 1, 3), // außerhalb des Fensters
        tp(T0 - D, 3, 0, { flags: FLAG.mig }), // Umstellung: nur im Ganzen
      ],
      T0,
    );
    expect(r.all).toEqual({ ok: 4, all: 5 });
    expect(r.mature).toEqual({ ok: 1, all: 2 });
    expect(r.young).toEqual({ ok: 2, all: 2 });
  });
});

describe('youngBoost und retentionGap (N7, Emrahs Wahl „Junge Wörter früher“)', () => {
  it('unter der Mindestzahl: kein Nachsteuern', () => {
    expect(youngBoost(0.9, retention(many(20, 10, 3), T0))).toBeNull();
  });
  it('junge Wörter mehr als 5 Punkte unter dem Ziel → Ziel + 3 Punkte; knapp darunter → nichts', () => {
    expect(youngBoost(0.9, retention(many(50, 40, 3), T0))).toBe(0.93); // 80 %
    expect(youngBoost(0.9, retention(many(50, 43, 3), T0))).toBeNull(); // 86 %
    expect(youngBoost(0.95, retention(many(50, 40, 3), T0))).toBe(0.97); // Deckel
  });
  it('nur gefestigte zu niedrig: Hinweis ohne Nachsteuern', () => {
    const r = retention(many(50, 40, 6), T0);
    expect(youngBoost(0.9, r)).toBeNull();
    expect(retentionGap(0.9, r)).toEqual({ group: 'mature', rate: 0.8 });
  });
  it('Mehrminuten wachsen mit dem höheren Ziel', () => {
    expect(boostExtraMinutes(0, 0.9, 0.93)).toBe(0);
    const x = boostExtraMinutes(3, 0.9, 0.93);
    expect(x).toBeGreaterThan(1);
    expect(x).toBeLessThan(3);
  });
});

describe('retOf und Planer', () => {
  it('junge Wörter buchen mit retY, gefestigte mit ret', () => {
    const cfg = { ...DEFAULT_CFG, retY: 0.93 };
    expect(retOf({ ...emptyLex('w', 'core', T0), lv: 4 }, cfg)).toBe(0.93);
    expect(retOf({ ...emptyLex('w', 'core', T0), lv: 5 }, cfg)).toBe(0.9);
    expect(retOf({ ...emptyLex('w', 'core', T0), lv: 3 }, DEFAULT_CFG)).toBe(0.9);
  });
  it('höheres Ziel ergibt kürzere oder gleiche Abstände', () => {
    const t = T0 - 20 * D;
    let l = introduce(emptyLex('w', 'core', t), t);
    l = applyAnswer(l, { t: t + 60_000, form: 'gap_hint', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
    l = applyAnswer(l, { t: t + 300_000, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'a' }, ctx()).lex;
    const young: Lex = { ...l, lv: 3, step: null };
    const a = applyAnswer(young, { t: T0, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'b' }, ctx()).lex;
    const b = applyAnswer(young, { t: T0, form: 'gap', outcome: 'ok', hint: 0, ms: 9000, fk: 2000, sentence: 'b' }, ctx({ cfg: { ...DEFAULT_CFG, retY: 0.95 } })).lex;
    expect(b.b!.s).toBeCloseTo(a.b!.s, 4);
    expect(b.b!.due).toBeLessThanOrEqual(a.b!.due);
  });
});

describe('Minuten (M63, B9)', () => {
  it('Sicherheit: 85 % weniger, 95 % mehr als 90 %; neue Wörter gleich', () => {
    const m = safetyMinutes(10, 3, 0.9, [0.85, 0.9, 0.95]);
    expect(m['0.9']).toBe(13);
    expect(m['0.85']!).toBeLessThan(13);
    expect(m['0.95']!).toBeGreaterThan(20);
    expect(ivlFactor(0.9, 0.9)).toBe(1);
  });
  it('Vorschau mit Filter zählt nur die gewählten Wörter', () => {
    const mk = (lv: number, due: number): Lex => ({ ...introduce(emptyLex('w', 'core', T0 - 9 * D), T0 - 9 * D), lv, step: null, u: { ...emptyLex('w', 'core', T0).u, due, st: 2, s: 5, last: T0 - D } });
    const cat = new Catalog([
      { path: 'vocab/a', lex: mk(3, T0 + D), order: 0 },
      { path: 'vocab/b', lex: mk(6, T0 + D), order: 1 },
    ]);
    const all = forecastMinutes(cat, {}, T0, 3);
    const young = forecastMinutes(cat, {}, T0, 3, (l) => l.lv <= 4);
    expect(all[0]!).toBeGreaterThan(young[0]!);
    expect(young[0]!).toBeGreaterThan(0);
  });
  it('Gruppen: neue extra, Stufen 1–7 in drei Gruppen', () => {
    const base = emptyLex('w', 'core', T0);
    const g = groupCounts([base, { ...base, intro: '2026-10-01', lv: 2 }, { ...base, intro: '2026-10-01', lv: 4 }, { ...base, intro: '2026-10-01', lv: 7 }]);
    expect(g).toMatchObject({ fresh: 1, recognize: 1, onway: 1, produce: 1, total: 4 });
    expect(g.lv).toEqual([0, 1, 0, 1, 0, 0, 1]);
  });
});

describe('Verlauf eines Worts (N5)', () => {
  it('Versuche mit Wirkung: Aufstieg, Abstieg, keine Wirkung; nur dieses Wort, ohne Dubletten', () => {
    const rows = attemptsOf(
      [tp(T0 - 3 * D, 3, 3), tp(T0 - 2 * D, 3, 4), tp(T0 - 2 * D, 3, 4), tp(T0 - D, 0, 4, { form: 'meaning' }), tp(T0, 1, 3), tp(T0, 3, 5, { path: 'vocab/y' })],
      'vocab/x',
    );
    expect(rows.map((r) => [r.fx, r.from])).toEqual([
      ['stay', null],
      ['up', 3],
      ['none', null],
      ['down', 4],
    ]);
  });
  it('Zeitleiste: ein Feld je Tag, schlechteste Antwort gewinnt, grau = nur Übung', () => {
    const rows = attemptsOf([tp(T0 - D, 3, 3), tp(T0 - D + 1000, 1, 3), tp(T0 - 2 * D, 3, 3, { hint: 1 }), tp(T0 - 3 * D, 0, 3), tp(T0, 4, 3)], 'vocab/x');
    const cells = timeline(rows, T0, 5);
    expect(cells).toEqual([null, 'none', 'help', 'wrong', 'ok']);
  });
});

describe('Deine Sätze (lex.os)', () => {
  const use = (over: Partial<UseInput> = {}): UseInput => ({ t: T0, form: 'own', v: 'ok', err: null, at: '', evade: false, spoken: false, lvAt: 5, evidenceOnly: true, sent: 'We need to narrow the scope.', ...over });
  it('nur richtige Sätze, neueste zuerst, gleicher Satz einmal, höchstens OS_MAX; Schema liest es', () => {
    let l = emptyLex('w', 'core', T0);
    l = withOwnSentence(l, use({ v: 'odd' }));
    expect(l.os).toBeUndefined();
    for (let i = 0; i < 7; i++) l = withOwnSentence(l, use({ t: T0 + i, sent: `Sentence ${i}.`, spoken: i === 6 }));
    l = withOwnSentence(l, use({ t: T0 + 99, sent: 'Sentence 6.' }));
    expect(l.os!.length).toBe(OS_MAX);
    expect(l.os![0]).toEqual([T0 + 6, 'Sentence 6.', 1]);
    expect(lexWriteSchema.safeParse(l).success).toBe(true);
  });
  it('applyUse speichert den Satz auch ohne Planwirkung', () => {
    const r = applyUse({ ...emptyLex('w', 'core', T0), lv: 5, intro: '2026-10-01' }, use(), ctx());
    expect(r.lex.os?.[0]?.[1]).toBe('We need to narrow the scope.');
  });
  it('sentenceWith: Satz mit der Fundstelle, sonst nur ein Ein-Satz-Text', () => {
    expect(sentenceWith('Hi Tom. We should narrow the scope first! Thanks.', 'narrow the scope')).toBe('We should narrow the scope first!');
    expect(sentenceWith('Hi Tom. Thanks.', 'scope')).toBeNull();
    expect(sentenceWith('Only one sentence here', 'nothing')).toBe('Only one sentence here');
  });
});

describe('Verlauf lesen und vmod/day.ry', () => {
  it('vlogIdsInRange: Verzeichnis-Einträge mit Fortsetzung und Teil 1 der berührten Halbmonate', () => {
    expect(vlogIdsInRange(['2026-09-b', '2026-10-a', '2026-10-a2', '2026-10-b'], '2026-10-10', '2026-11-02')).toEqual(['2026-10-a', '2026-10-a2', '2026-10-b', '2026-11-a']);
  });
  it('readVlogRange liest nur den Zeitraum, ohne rückgängig gemachte Einträge', async () => {
    const docs: Record<string, Doc> = {
      'vmod/ix': { v: 1, docs: { '2026-10-b': 1 } },
      'vlog/2026-10-b': { v: 1, e: { a: tp(T0 - 10 * D, 3, 3), b: null, c: tp(T0 - 20 * D, 3, 3) } },
      'vlog/2026-11-a': { v: 1, e: { d: tp(T0, 1, 2) } },
    };
    const got = await readVlogRange((p) => Promise.resolve(docs[p] ?? null), '2026-10-20', '2026-11-02');
    expect(got.map((x) => x[4])).toEqual([3, 1]);
  });
  it('freezeDay speichert ry mit dem Plan; Schema prüft die Grenzen', async () => {
    const h = createMemoryDb({ seed: {} });
    const writer = createWriter(h.db);
    const cat = new Catalog([]);
    const plan = await freezeDay({ writer, device: 'dev1' }, cat, T0, { ...DEFAULT_CFG, retY: 0.93 }, {}, null);
    expect(plan.ry).toBe(0.93);
    const snap = await h.db.doc('vmod/day').get();
    const stored = (snap.exists ? snap.data() : null) as Doc | null;
    expect(stored?.ry).toBe(0.93);
    expect(vmodDayWriteSchema.safeParse({ ...stored, ry: 0.99 }).success).toBe(false);
  });
});
