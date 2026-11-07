import { describe, expect, it } from 'vitest';
import { capPlanToDone, nextPace, PACE_ALPHA, PLAN_START_FACTOR, planMed } from '../../../src/modules/vocab/domain/pace';
import { DEFAULT_FORM_MS, type Form } from '../../../src/modules/vocab/domain/types';
import { buildDayPlan } from '../../../src/modules/vocab/domain/day';

// Emrah 07.11.2026 (Tageszeit „A“): 37 Wörter in einem 10-Minuten-Plan, weil mit 14 s je Lücke gerechnet wurde. Echte Zeit + Zeitdeckel.

describe('Planungszeiten', () => {
  it('ohne Messwerte: Startwerte × 3; gemessene Formen gewinnen', () => {
    const m = planMed(null);
    expect(m.gap).toBe(DEFAULT_FORM_MS.gap * PLAN_START_FACTOR);
    expect(planMed({ gap: 50_000 }).gap).toBe(50_000);
    expect(planMed({ gap: 50_000 }).nosent).toBe(DEFAULT_FORM_MS.nosent * PLAN_START_FACTOR);
  });
  it('nach einer Runde: Median der Kosten, gleitend gemittelt; zu wenig Beobachtungen ändern nichts', () => {
    expect(nextPace(null, new Map<Form, number[]>([['gap', [40_000]]]))).toBeNull();
    const first = nextPace(null, new Map<Form, number[]>([['gap', [30_000, 50_000, 70_000]]]))!;
    expect(first.med.gap).toBe(50_000);
    const second = nextPace({ gap: 50_000 }, new Map<Form, number[]>([['gap', [20_000, 20_000]]]))!;
    expect(second.med.gap).toBe(Math.round(50_000 * (1 - PACE_ALPHA) + 20_000 * PACE_ALPHA));
  });
  it('Zeitdeckel: nur Erledigtes bleibt, der Rest wird gezählt', () => {
    const plan = [
      ['vocab/a', 'b', 'gap'],
      ['vocab/b', 'b', 'gap'],
      ['vocab/c', 'n', 'intro'],
    ] as const;
    expect(capPlanToDone(plan, (e) => e[0] === 'vocab/a')).toEqual({ kept: [plan[0]], dropped: 2 });
    expect(capPlanToDone(plan, () => true)).toBeNull();
  });
});

describe('10 Minuten Wörter mit realistischen Zeiten', () => {
  it('ein Plan mit 37 fälligen Lücken passt nicht mehr ganz hinein (höchstens ~15 Wiederholungen)', () => {
    const T = Date.parse('2026-11-07T09:00:00+01:00');
    const lex = (i: number) => ({
      path: `vocab/w${i}`,
      order: i,
      lex: { v: 1, k: 'w', of: null, core: null, sense: null, lv: 3, u: { due: T - 86_400_000, s: 5, d: 5, st: 2, reps: 3, lapses: 0, last: T - 5 * 86_400_000, sd: 4, ls: 0 }, b: { due: T - 86_400_000, s: 5, d: 5, st: 2, reps: 3, lapses: 0, last: T - 5 * 86_400_000, sd: 4, ls: 0 }, day: null, dayU: null, step: null, ev: { f: [], o: 0, s: 0 }, sn: [], gr: null, reg: null, pri: 'core', lc: 0, pair: null, mv: 0, sync: 0, mig: null, intro: '2026-10-01' },
    });
    return import('../../../src/modules/vocab/domain/catalog').then(({ Catalog }) => {
      const cat = new Catalog(Array.from({ length: 37 }, (_, i) => lex(i)) as never);
      const { plan } = buildDayPlan(cat, T, { min: 10, ret: 0.9, mod: 1, newPerDay: 2, restDow: null } as never, planMed(null));
      const reviews = plan.plan.filter((e) => e[1] !== 'n').length;
      expect(reviews).toBeLessThanOrEqual(15);
      expect(reviews).toBeGreaterThan(0);
    });
  });
});

describe('Schreibwege vmod/day (Deckel) und vmod/pace (data-guard 07.11.2026)', () => {
  const setup = async (seed: Record<string, unknown>) => {
    const { createMemoryDb } = await import('../../../src/platform/dev/memoryDb');
    const { createWriter } = await import('../../../src/data/writer');
    const h = createMemoryDb({ seed: seed as never });
    return { h, w: createWriter(h.db) };
  };
  const plan = {
    v: 1,
    d: '2026-11-07',
    plan: [
      ['vocab/a', 'b', 'gap'],
      ['vocab/b', 'b', 'gap'],
      ['vocab/c', 'n', 'intro'],
    ],
    min: 6,
    due: 2,
    fresh: 1,
    ahead: 0,
    moved: 0,
    why: '2 due',
  };
  it('Deckel kürzt nur den bekannten Plan desselben Tages; Rest zählt morgen; ein zweiter Deckel ändert nichts mehr', async () => {
    const { capToday } = await import('../../../src/modules/vocab/data/shrink');
    const { h, w } = await setup({ 'vmod/day': plan });
    const next = await capToday(w, plan as never, (p) => p === 'vocab/a');
    expect(next?.plan).toEqual([['vocab/a', 'b', 'gap']]);
    const d = h.dump()['vmod/day'] as Record<string, unknown>;
    expect(d.plan).toEqual([['vocab/a', 'b', 'gap']]);
    expect(d.sp).toEqual([['2026-11-08', 2]]);
    expect(await capToday(w, plan as never, (p) => p === 'vocab/a')).toBeNull();
  });
  it('anderer Tag oder anderer Plan im Speicher: nichts angefasst', async () => {
    const { capToday } = await import('../../../src/modules/vocab/data/shrink');
    const other = { ...plan, d: '2026-11-08' };
    const { h, w } = await setup({ 'vmod/day': other });
    expect(await capToday(w, plan as never, () => false)).toBeNull();
    expect(h.dump()['vmod/day']).toEqual(other);
    const changed = { ...plan, plan: [['vocab/x', 'b', 'gap']] };
    const s2 = await setup({ 'vmod/day': changed });
    expect(await capToday(s2.w, plan as never, () => false)).toBeNull();
    expect(s2.h.dump()['vmod/day']).toEqual(changed);
  });
  it('vmod/pace: neu anlegen, gleitend fortschreiben; unbekannter Aufbau bleibt unberührt', async () => {
    const { writePace, readPace } = await import('../../../src/modules/vocab/data/shrink');
    const { h, w } = await setup({});
    await writePace(w, 1_000, new Map<Form, number[]>([['gap', [40_000, 60_000]]]));
    expect(readPace(h.dump()['vmod/pace'])?.gap).toBe(50_000);
    await writePace(w, 2_000, new Map<Form, number[]>([['gap', [20_000, 20_000]]]));
    expect(readPace(h.dump()['vmod/pace'])?.gap).toBe(Math.round(50_000 * (1 - PACE_ALPHA) + 20_000 * PACE_ALPHA));
    const odd = { v: 2, med: { gap: 1 }, extra: true };
    const s2 = await setup({ 'vmod/pace': odd });
    await writePace(s2.w, 3_000, new Map<Form, number[]>([['gap', [40_000, 60_000]]]));
    expect(s2.h.dump()['vmod/pace']).toEqual(odd);
    expect(readPace(odd)).toBeNull();
  });
});
