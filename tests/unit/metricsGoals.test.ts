import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { computeStreak, weekStrip, type StreakInput } from '../../src/domain/streak';
import { WEEK_GOAL, festGrowthUnits, festUnits, motivationSignals, nextGoal, restInfo, weekGoal } from '../../src/domain/metrics';
import { toTrainCard } from '../../src/domain/srs/cards';
import { berlin } from './helpers';

// P22: Wochenziel, Ruhetag, nächstes Ziel, Zuwachs auf `vu`, Messwerte S1 bis S4.

const MON = '2026-09-07'; // Montag
const SINCE = addDays(MON, -7);

/** Eingabe für die Woche ab MON: Muster = 7 Bit (Mo = Bit 0), davor eine volle Woche, damit die Brücke sichtbar wird. */
function week(pattern: number, today: string): StreakInput {
  const pflicht = new Set<string>();
  for (let k = 0; k < 7; k++) pflicht.add(addDays(SINCE, k));
  for (let k = 0; k < 7; k++) if (pattern & (1 << k)) pflicht.add(addDays(MON, k));
  return { pflichtDone: pflicht, pflichtSince: SINCE, today };
}

describe('weekGoal', () => {
  it('alle 128 Wochenmuster: erreicht genau dann, wenn die Serie die Woche überbrückt', () => {
    const next = addDays(MON, 7); // Folgemontag, Pflicht erledigt
    for (let p = 0; p < 128; p++) {
      const input = week(p, next);
      input.pflichtDone = new Set([...(input.pflichtDone as Set<string>), next]);
      const bits = p.toString(2).split('1').length - 1;
      const strip = weekStrip({ ...input, today: addDays(MON, 6) });
      const g = weekGoal(strip);
      expect(g.done, `Muster ${p}`).toBe(bits);
      expect(g.reached, `Muster ${p}`).toBe(bits >= 6);
      // Brücke: Serie zählt von „next“ aus auch die Vorwoche (7 Tage) mit.
      const bridged = computeStreak(input).count === 1 + bits + 7;
      expect(g.reached, `Brücke ${p}`).toBe(bridged);
    }
  });

  it('Extra-Tage zählen nicht, zukünftige Tage machen 6 noch möglich', () => {
    const input = week(0b0000111, addDays(MON, 3)); // Mo–Mi erledigt, Do heute offen
    const g = weekGoal(weekStrip(input));
    expect(g).toMatchObject({ done: 3, goal: WEEK_GOAL, reached: false, possible: true });
    const late = weekGoal(weekStrip(week(0b0000001, addDays(MON, 5)))); // nur Mo, heute Sa
    expect(late.possible).toBe(false);
  });
});

describe('restInfo', () => {
  it('frei, solange kein vergangener Tag ohne Pflicht; genutzt mit Datum; sonst keine Aussage', () => {
    expect(restInfo(weekStrip(week(0b0000011, addDays(MON, 2))))).toEqual({ state: 'free', day: null });
    const used = restInfo(weekStrip(week(0b0000101, addDays(MON, 3)))); // Di fehlt, Mi erledigt, heute Do offen
    expect(used).toEqual({ state: 'used', day: addDays(MON, 1) });
  });
});

describe('nextGoal', () => {
  const today = '2026-10-05';
  it('wählt die Fest-Marke und nennt den Zeitraum nur mit Daten', () => {
    const g = nextGoal({ festUnits: 212, history: [], today });
    expect(g).toEqual({ id: 'fest250', have: 212, need: 250, weeks: null });
    const hist = [{ d: addDays(today, -28), vu: 180 }];
    const g2 = nextGoal({ festUnits: 212, history: hist, today });
    expect(g2?.weeks).not.toBeNull();
  });
  it('kleinster relativer Restweg gewinnt, bei Gleichstand die Fest-Marke', () => {
    const ch = { id: 'ch3' as const, have: 8, need: 9 };
    expect(nextGoal({ festUnits: 130, today, chapter: ch })?.id).toBe('ch3');
    expect(nextGoal({ festUnits: 245, today, chapter: ch })?.id).toBe('fest250');
    const tie = nextGoal({ festUnits: 175, today, chapter: { id: 'ch1', have: 5, need: 10, from: 0 } });
    expect(tie?.id).toBe('fest250');
  });
  it('nach der letzten Marke und ohne Kandidaten: null', () => {
    expect(nextGoal({ festUnits: 1500, today })).toBeNull();
  });
});

describe('festGrowthUnits', () => {
  const today = '2026-10-05';
  it('bleibt bei `va`, bis 28 Tage `vu` vorliegen, und springt dabei nicht', () => {
    const va = [{ d: addDays(today, -28), va: 100 }];
    const early = [...va, { d: addDays(today, -10), va: 120, vu: 160 }];
    const a = festGrowthUnits({ vocabFest: 130, unitsFest: 175, history: early, today });
    expect(a?.delta).toBe(30);
    const late = [...va, { d: addDays(today, -28), vu: 140 }];
    const b = festGrowthUnits({ vocabFest: 130, unitsFest: 175, history: late, today });
    expect(b?.delta).toBe(35);
  });
  it('ohne Daten null', () => expect(festGrowthUnits({ vocabFest: 1, unitsFest: 1, history: [], today })).toBeNull());
});

describe('festUnits', () => {
  const NOW = berlin('2026-10-05', 10);
  const mk = (id: string, over: Record<string, unknown> = {}) =>
    toTrainCard(id, { word: id, de: 'x', def: 'x y', ex: `We [${id}] it.`, pos: 'verb', state: 'review', S: 30, D: 5, due: NOW + 86_400_000, last: NOW - 86_400_000, stage: 4, reps: 6, lapses: 0, src: 'lookup', added: '2026-06-01', ...over }, true, NOW)!;
  it('zählt Wörter und Wendungen zusammen, Neue und Ausgeblendete nie', () => {
    expect(festUnits([mk('a'), mk('b'), mk('c', { hidden: true }), mk('d', { stage: 3 })])).toBe(2);
  });
});

describe('motivationSignals', () => {
  const today = '2026-10-05';
  it('ohne Daten überall null', () => {
    expect(motivationSignals({ profile: {}, logs: [], today })).toEqual({ weekQuota: null, voluntary: null, returnGap: null, abort: null });
  });
  it('S1 bis S4 aus Verläufen', () => {
    const pflicht: Record<string, boolean> = {};
    // Vier volle Wochen vor der laufenden: Wochen 1–2 mit 6 Tagen, Wochen 3–4 mit 4 Tagen.
    const curMon = '2026-10-05';
    for (let w = 1; w <= 4; w++) for (let k = 0; k < (w <= 2 ? 6 : 4); k++) pflicht[addDays(curMon, -7 * w + k)] = true;
    const profile = { pflicht, days: {}, act: { [addDays(today, -2)]: { review: 3, 'grammar~': 1 } } };
    const schema = { pflichtSince: addDays(curMon, -28) };
    const logDay = addDays(curMon, -7);
    const logs = [
      { date: logDay, entries: [{ ctx: 'duty' }, { ctx: 'xtra' }] },
      { date: addDays(curMon, -6), entries: [{ ctx: 'duty' }] },
    ];
    const s = motivationSignals({ profile, schema, logs, today });
    expect(s.weekQuota).toEqual({ n: 4, hit: 2 });
    expect(s.voluntary).toEqual({ n: 2, hit: 1 });
    expect(s.abort).toEqual({ n: 4, hit: 1 });
    expect(s.returnGap?.n).toBeGreaterThan(0);
  });
});
