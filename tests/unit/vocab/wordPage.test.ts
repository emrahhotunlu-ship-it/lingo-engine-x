import { describe, expect, it } from 'vitest';
import { createWriter } from '../../../src/data/writer';
import { createMemoryDb } from '../../../src/platform/dev/memoryDb';
import { dayKey, dayStartOf, addDays } from '../../../src/domain/date';
import { applyAnswer, emptyLex, introduce, type PlanCtx } from '../../../src/modules/vocab/domain/planner';
import { DEFAULT_CFG, type Lex } from '../../../src/modules/vocab/domain/types';
import { againTomorrow, restartLex } from '../../../src/modules/vocab/domain/manage';
import { writeManage } from '../../../src/modules/vocab/data/store';
import { lexOf, lexPatch } from '../../../src/modules/vocab/data/lex';
import { nextStepText, outcomeKey, trackStatus } from '../../../src/modules/vocab/ui/WordPage';
import type { Attempt } from '../../../src/modules/vocab/domain/stats';

// Großpaket A S6: Wort-Seite. „Morgen wieder“ und „Von vorn“ (rein + Schreibpfad) und die Texte aus dem Lernstand.

const T0 = Date.parse('2026-11-02T18:00:00Z');
const D = 86_400_000;
const ctx = (over: Partial<PlanCtx> = {}): PlanCtx => ({
  cfg: DEFAULT_CFG,
  path: 'vocab/x',
  planned: true,
  load: () => 0,
  siblings: new Set(),
  ...over,
});
const t = (k: string, v?: Record<string, string | number>) => (v ? `${k}:${JSON.stringify(v)}` : k);

function learned(at: number): Lex {
  let l = introduce(emptyLex('w', 'edge', at), at);
  l = applyAnswer(
    l,
    {
      t: at + 60_000,
      form: 'gap_hint',
      outcome: 'ok',
      hint: 0,
      ms: 9000,
      fk: 2000,
      sentence: 'x#0',
    },
    ctx(),
  ).lex;
  return applyAnswer(
    l,
    {
      t: at + 300_000,
      form: 'gap',
      outcome: 'ok',
      hint: 0,
      ms: 9000,
      fk: 2000,
      sentence: 'x#0',
    },
    ctx(),
  ).lex;
}

describe('againTomorrow', () => {
  it('holt beide Spuren auf den Beginn des nächsten Lerntags, ohne FSRS-Werte zu ändern', () => {
    const l0 = learned(T0);
    const l = {
      ...l0,
      u: { ...l0.u, due: T0 + 9 * D },
      b: l0.b ? { ...l0.b, due: T0 + 12 * D } : l0.b,
    };
    const next = againTomorrow(l, T0 + D)!;
    const tomorrow = dayStartOf(addDays(dayKey(T0 + D), 1));
    expect(next.u.due).toBe(tomorrow);
    expect(next.u.s).toBe(l.u.s);
    expect(next.lv).toBe(l.lv);
    if (l.b) expect(next.b!.due).toBe(tomorrow);
  });
  it('null bei neuem Wort und wenn schon früher fällig', () => {
    expect(againTomorrow(emptyLex('w', 'edge', T0), T0)).toBeNull();
    const l0 = learned(T0);
    const early = {
      ...l0,
      u: { ...l0.u, due: T0 },
      b: l0.b ? { ...l0.b, due: T0 } : null,
    };
    expect(againTomorrow(early, T0)).toBeNull();
  });
});

describe('restartLex', () => {
  it('Stand wie neu; eigene Sätze, Bedeutung und Umrechnungs-Marke bleiben', () => {
    const l0 = learned(T0);
    const l = {
      ...l0,
      lv: 5,
      sense: 'n1',
      os: [[T0, 'We procured the parts.', 0]] as Lex['os'],
    };
    const r = restartLex(l, T0 + D);
    expect(r.intro).toBeNull();
    expect(r.lv).toBe(1);
    expect(r.b).toBeNull();
    expect(r.ev.f).toEqual([]);
    expect(r.os).toEqual(l.os);
    expect(r.sense).toBe('n1');
  });
});

describe('writeManage', () => {
  it('schreibt über den einen Schreibpfad; nichts zu tun → false und kein Schreiben', async () => {
    const l0 = learned(T0);
    const lex = { ...l0, u: { ...l0.u, due: T0 + 9 * D } };
    const h = createMemoryDb({
      seed: {
        'vocab/x': {
          word: 'procure',
          de: 'beschaffen',
          ex: 'We [procure] parts.',
          lex: lexPatch(undefined, lex),
        },
      },
    });
    const w = createWriter(h.db);
    expect(await writeManage(w, 'vocab/x', (cur) => againTomorrow(cur, T0 + D))).toBe(true);
    const doc = h.dump()['vocab/x'] as Record<string, unknown>;
    expect(lexOf(doc)!.u.due).toBe(dayStartOf(addDays(dayKey(T0 + D), 1)));
    expect(doc.word).toBe('procure');
    expect(await writeManage(w, 'vocab/x', () => null)).toBe(false);
    expect(await writeManage(w, 'vocab/missing', (cur) => restartLex(cur, T0))).toBe(false);
  });
});

describe('Texte der Wort-Seite', () => {
  it('nächster Schritt je Stufe', () => {
    const l = learned(T0);
    expect(nextStepText(emptyLex('w', 'edge', T0), t)).toBe('vmWpNextNew');
    expect(nextStepText({ ...l, lv: 3, ev: { f: ['2026-10-20'], o: 0, s: 0 } }, t)).toBe('vmWpNext3One');
    expect(nextStepText({ ...l, lv: 4, ev: { f: ['2026-10-20', '2026-10-22', '2026-10-25'], o: 0, s: 0 } }, t)).toBe('vmWpNext4Week');
    expect(nextStepText({ ...l, lv: 6, pri: 'core', ev: { f: [], o: 1, s: 0 } }, t)).toBe('vmWpNext6Core:{"n":1,"s":0}');
    expect(nextStepText({ ...l, lv: 7 }, t)).toBe('vmWpNext7');
  });
  it('Spuren: neu, lernst du, sicher; Schreiben noch nicht dran', () => {
    const l = learned(T0);
    expect(trackStatus(emptyLex('w', 'edge', T0), 'u')).toBe('vmWpStNew');
    expect(trackStatus({ ...l, lv: 3 }, 'u')).toBe('vmWpStSure');
    expect(trackStatus({ ...l, b: null }, 'b')).toBe('vmWpStNotYet');
  });
  it('Ergebnis in Worten', () => {
    const a = (o: Partial<Attempt>): Attempt => ({
      t: T0,
      form: 'gap',
      outcome: 'ok',
      note: 3,
      hint: 0,
      track: 1,
      lv: 2,
      fx: 'stay',
      from: null,
      mig: false,
      ext: false,
      ...o,
    });
    expect(outcomeKey(a({}))).toBe('vmWpOutOk');
    expect(outcomeKey(a({ hint: 1 }))).toBe('vmWpOutHelp');
    expect(outcomeKey(a({ outcome: 'dunno', note: 1 }))).toBe('vmWpOutDunno');
    expect(outcomeKey(a({ outcome: 'wrong', note: 1 }))).toBe('vmWpOutWrong');
    expect(outcomeKey(a({ outcome: 'typo', note: 2 }))).toBe('vmWpOutAlmost');
    expect(outcomeKey(a({ note: 0 }))).toBe('vmWpOutPractice');
    expect(outcomeKey(a({ mig: true }))).toBe('vmWpOutMig');
  });
});
