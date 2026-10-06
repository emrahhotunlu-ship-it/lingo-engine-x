import { describe, expect, it } from 'vitest';
import { EFFECT_RULES, learningEffect } from '../../src/domain/metrics/effect';
import { addDays } from '../../src/domain/date';

// Messgrößen der Lernmethode (Lernplattform 2.0 §4.9): ohne Daten `null`, mit einem erfundenen 14-Tage-Stand die fünf Größen.

type Doc = Record<string, unknown>;
const TODAY = '2026-10-20';
const at = (day: string, h = 10): number => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00+02:00`);
const day = (n: number): string => addDays(TODAY, -n);

const err = (o: Doc): Doc => ({ q: 'x', given: 'y', ans: 'z', src: 'review', ...o });

/** Erfundener Stand: 2 Themen, Fehler mit Muster und Wiederholungen. */
function fixture(): { docs: Map<string, Doc>; logs: Doc[] } {
  const a: Doc = {
    n: 20,
    vt: { d: day(30), ok: true, pats: ['a.x'] },
    errors: [
      // Erledigt vor 20 Tagen, danach binnen 14 Tagen wieder falsch (anderer Eintrag, gleiches Muster) → Rückfall.
      err({ q: 'a1', t: at(day(40)), pat: 'a.x', done: true, box: 3, last: at(day(30)), due: at(day(21)), rh: [[at(day(39)), 0, 1], [at(day(36)), 1, 1], [at(day(30)), 2, 1]] }),
      err({ q: 'a2', t: at(day(25)), pat: 'a.x', done: false, box: 0, due: at(day(1)), last: at(day(20)), rh: [[at(day(24)), 0, 0], [at(day(20)), 0, 1]] }),
      // Erledigt vor 20 Tagen, kein Rückfall.
      err({ q: 'a3', t: at(day(45)), pat: 'a.y', done: true, box: 3, last: at(day(20)), due: at(day(11)), rh: [[at(day(44)), 0, 1], [at(day(41)), 1, 0], [at(day(40)), 1, 1], [at(day(31)), 2, 1]] }),
      // Erledigt vor 5 Tagen: Beobachtungsfenster noch nicht vorbei → zählt nicht.
      err({ q: 'a4', t: at(day(30)), pat: 'a.y', done: true, box: 3, last: at(day(5)), due: at(day(1)) }),
    ],
  };
  const b: Doc = { n: 8, vt: { d: day(10), ok: false, pats: ['b.x'] }, errors: [err({ q: 'b1', t: at(day(3)), pat: 'b.x', done: false, due: at(day(0)) })] };
  const logs: Doc[] = [
    { date: day(2), entries: [], um: { 1: { s: 480, dev: 'k' }, 2: { s: 420, dev: 'k' }, 5: { s: 150, dev: 'k' } } },
    { date: day(1), entries: [], um: { 1: { s: 600, dev: 't' }, 2: { s: 540, dev: 't' }, 3: { s: 300, dev: 't' } } },
    { date: day(0), entries: [], um: { 1: { s: 360, dev: 't' }, 2: { s: 300, dev: 'k' } } },
  ];
  return { docs: new Map([['a', a], ['b', b]]), logs };
}

describe('learningEffect', () => {
  it('liefert null ohne Daten', () => {
    expect(learningEffect({ grammarDocs: new Map(), repairDoc: null, logs: [], today: TODAY })).toBeNull();
    expect(learningEffect({ grammarDocs: new Map([['a', { n: 3 }]]), repairDoc: null, logs: [{ date: TODAY, entries: [] }], today: TODAY })).toBeNull();
  });

  it('die fünf Größen aus einem erfundenen Stand', () => {
    const { docs, logs } = fixture();
    const e = learningEffect({ grammarDocs: docs, repairDoc: null, logs, today: TODAY })!;
    expect(e).not.toBeNull();
    // Treffer je Box (Box VOR der Antwort): Box 0 = „Box 1“: a1 1, a2 0, a2 1, a3 1, a3? (a3: [0,1],[1,0],[1,1],[2,1])
    expect(e.firstTry.box1).toEqual({ n: 4, hit: 3 });
    expect(e.firstTry.box3).toEqual({ n: 3, hit: 2 });
    expect(e.firstTry.box9).toEqual({ n: 2, hit: 2 });
    // Rückfall: nur a1 und a3 (fertig vor mindestens 14 Tagen) zählen; nach a1 kam a2 (gleiches Muster, 5 Tage später falsch), nach a3 nichts.
    expect(e.relapse14).toEqual({ n: 2, hit: 1 });
    expect(e.pretest).toEqual({ n: 2, hit: 1 });
    expect(e.minutesPerStep[1]).toEqual({ t: 8, k: 8 });
    expect(e.minutesPerStep[2]).toEqual({ t: 9, k: 6 });
    expect(e.minutesPerStep[3]).toEqual({ t: 5, k: null });
    expect(e.minutesPerStep[5]).toEqual({ t: null, k: 2.5 });
    expect(e.queue.today).toBeGreaterThanOrEqual(0);
    expect(e.queue.max7).toBeGreaterThanOrEqual(e.queue.today);
  });

  it('Rückfall: ein neuer falscher Satz zum selben Muster binnen 14 Tagen nach „erledigt“ zählt', () => {
    const docs = new Map<string, Doc>([
      ['a', { errors: [err({ q: 'r1', t: at(day(50)), pat: 'a.x', done: true, last: at(day(30)), due: at(day(21)) }), err({ q: 'r2', t: at(day(25)), pat: 'a.x', done: false, due: at(day(24)) })] }],
    ]);
    const e = learningEffect({ grammarDocs: docs, repairDoc: null, logs: [], today: TODAY })!;
    expect(e.relapse14).toEqual({ n: 1, hit: 1 });
    // Zusatzsatz in `more` zählt auch
    const docs2 = new Map<string, Doc>([
      ['a', { errors: [err({ q: 'r1', t: at(day(50)), pat: 'a.x', done: true, last: at(day(30)) }), err({ q: 'r3', t: at(day(40)), pat: 'a.x', done: false, more: [{ q: 'm', given: 'g', ans: 'a', t: at(day(25)) }] })] }],
    ]);
    expect(learningEffect({ grammarDocs: docs2, repairDoc: null, logs: [], today: TODAY })!.relapse14).toEqual({ n: 1, hit: 1 });
  });

  it('Warteschlange: heute und größter Wert der letzten 7 Tage', () => {
    const list: Doc[] = [];
    // 18 offene Sätze, seit gestern fällig, angelegt vor 5 Tagen
    for (let k = 0; k < 18; k++) list.push(err({ q: `q${k}`, t: at(day(5)) + k, due: at(day(1)) }));
    const e = learningEffect({ grammarDocs: new Map([['a', { errors: list }]]), repairDoc: null, logs: [], today: TODAY })!;
    expect(e.queue.today).toBe(18);
    expect(e.queue.max7).toBe(18);
    expect(e.queue.max7).toBeGreaterThan(EFFECT_RULES.queueOver);
  });

  it('Entscheidungsregeln sind Konstanten', () => {
    expect(EFFECT_RULES.queueDays).toBe(7);
    expect(EFFECT_RULES.queueOver).toBe(15);
    expect(EFFECT_RULES.queueWindow).toBe(14);
    expect(EFFECT_RULES.firstTryBox1Min).toBe(0.5);
    expect(EFFECT_RULES.relapseMax).toBe(0.4);
    expect(EFFECT_RULES.relapseDays).toBe(14);
    expect(EFFECT_RULES.pretestMax).toBe(0.7);
    expect(EFFECT_RULES.touchOverKeys).toBe(1.5);
    expect(EFFECT_RULES.box9Min).toBe(0.85);
  });
});
