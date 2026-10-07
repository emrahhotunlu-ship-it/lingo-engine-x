import { describe, expect, it } from 'vitest';
import { programTopics } from '../../src/domain/c1/chapters';
import { c1Update, emptyC1, readC1 } from '../../src/domain/c1/c1doc';
import { GRID, GRID_N, bandOf, difficulty, estimate, information, pCorrect, prior, reliabilityOf, update, type PlaceFmt, type PlaceItem, type PlaceLevel } from '../../src/domain/c1/placement/model';
import {
  LIMITS,
  RETAKE_DAYS,
  SKIP,
  answerItem,
  canRetake,
  endReason,
  nextItem,
  placeEntry,
  placementResult,
  retakeFrom,
  startRun,
  topicDifficulty,
  withPlacement,
  type RunState,
} from '../../src/domain/c1/placement/run';
import { FIRST_MC, pickNext, placePool } from '../../src/domain/c1/placement/select';
import { chapterIndexOf } from '../../src/domain/c1/chapters';

// Einstufung, Verfahren (P33): Rasch-Modell mit Ratekorrektur, Auswahl nach Information mit Inhaltsausgleich, Ende, Kurzweg. Simulation mit drei
// künstlichen Lernern (θ = −1 / 0 / +1,5), je 200 Läufe: ≥ 90 % richtig eingeordnet, nie mehr als 22 Aufgaben. Der Vorrat ist künstlich (je Thema 2 Aufgaben).

/** Zufall mit festem Startwert (mulberry32): jeder Lauf ist wiederholbar. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Künstlicher Vorrat: 47 Themen des Programms, je zwei Aufgaben; die Stufe steigt mit der Position im Programm. */
function makePool(): PlaceItem[] {
  const topics = programTopics();
  const out: PlaceItem[] = [];
  topics.forEach((topic, k) => {
    const level: PlaceLevel = k < 8 ? 'B1' : k < 24 ? 'B2' : k < 36 ? 'B2+' : 'C1';
    const formats: PlaceFmt[] = ['mc', (['gap', 'find', 'kwt'] as const)[k % 3] ?? 'gap'];
    formats.forEach((fmt, j) => out.push({ id: `${topic}#${j}`, topic, chapter: chapterIndexOf(topic) + 1, level, fmt, adj: ((k * 7 + j * 3) % 7) * 0.1 - 0.3, pool: 'place' }));
  });
  return out;
}
const POOL = makePool();
const T0 = 1_000_000;

type Sim = { r: ReturnType<typeof placementResult>; asked: number };
function simulate(theta: number, seed: number): Sim {
  const rand = rng(seed);
  let s: RunState = startRun(POOL, T0);
  let now = T0;
  for (;;) {
    now += 20_000; // 20 s je Aufgabe: das Zeitlimit bleibt unberührt
    const it = nextItem(s, now);
    if (!it) break;
    s = answerItem(s, it.id, rand() < pCorrect(theta, it));
  }
  return { r: placementResult(s), asked: s.asked.length };
}

describe('Modell', () => {
  it('Raster: 61 Punkte von −3 bis +3, Startverteilung Normal(0; 1) auf Summe 1', () => {
    expect(GRID_N).toBe(61);
    expect(GRID).toHaveLength(61);
    expect(GRID[0]).toBe(-3);
    expect(GRID[60]).toBe(3);
    const p = prior();
    expect(p.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
    const e = estimate(p);
    expect(e.theta).toBeCloseTo(0, 6);
    expect(e.se).toBeGreaterThan(0.9);
    expect(e.se).toBeLessThan(1.0);
  });
  it('Schwierigkeit: Stufe + Format + Lehrerkorrektur (begrenzt auf ±0,3)', () => {
    const base: PlaceItem = { id: 'a', topic: 't', chapter: 1, level: 'B2+', fmt: 'kwt' };
    expect(difficulty(base)).toBeCloseTo(0.5 + 0.6, 10);
    expect(difficulty({ ...base, level: 'B1', fmt: 'mc', adj: -0.3 })).toBeCloseTo(-1 - 0.4 - 0.3, 10);
    expect(difficulty({ ...base, adj: 5 })).toBeCloseTo(0.5 + 0.6 + 0.3, 10);
  });
  it('Ratekorrektur: Auswahl hat mindestens 25 % auch bei sehr niedrigem θ, getippte Aufgaben nicht', () => {
    const mc: PlaceItem = { id: 'm', topic: 't', chapter: 1, level: 'B2', fmt: 'mc' };
    const gap: PlaceItem = { ...mc, id: 'g', fmt: 'gap' };
    expect(pCorrect(-3, mc)).toBeGreaterThan(0.25);
    expect(pCorrect(-3, mc)).toBeLessThan(0.32);
    expect(pCorrect(-3, gap)).toBeLessThan(0.05);
    expect(pCorrect(3, gap)).toBeGreaterThan(0.95);
  });
  it('eine richtige Antwort hebt θ, eine falsche senkt es; schwere Aufgaben bewegen mehr als leichte, wenn man sie schafft', () => {
    const easy: PlaceItem = { id: 'e', topic: 't', chapter: 1, level: 'B1', fmt: 'gap' };
    const hard: PlaceItem = { id: 'h', topic: 't', chapter: 1, level: 'C1', fmt: 'kwt' };
    const p0 = prior();
    expect(estimate(update(p0, easy, true)).theta).toBeGreaterThan(0);
    expect(estimate(update(p0, easy, false)).theta).toBeLessThan(0);
    expect(estimate(update(p0, hard, true)).theta).toBeGreaterThan(estimate(update(p0, easy, true)).theta);
    expect(update(p0, easy, true).reduce((s, x) => s + x, 0)).toBeCloseTo(1, 10);
  });
  it('Information ist bei θ nahe an der Schwierigkeit am größten; Auswahl trägt weniger bei als Tippen', () => {
    const gap: PlaceItem = { id: 'g', topic: 't', chapter: 1, level: 'B2', fmt: 'gap' };
    expect(information(0, gap)).toBeGreaterThan(information(2.5, gap));
    expect(information(0, gap)).toBeGreaterThan(information(-2.5, gap));
    const mc: PlaceItem = { ...gap, id: 'm', fmt: 'mc', adj: 0.4 };
    expect(information(0, { ...mc, adj: 0.3 })).toBeLessThan(information(0, { ...gap, adj: 0 }) + 1e-9);
  });
  it('Bänder und Belastbarkeit', () => {
    expect(['B1+', 'B2', 'B2+', 'C1'].map((_, i) => bandOf([-0.6, 0, 0.8, 1.2][i] ?? 0))).toEqual(['B1+', 'B2', 'B2+', 'C1']);
    expect([0.3, 0.5, 0.9].map(reliabilityOf)).toEqual(['good', 'ok', 'thin']);
  });
});

describe('Auswahl', () => {
  it('Anfang: Auswahlaufgaben; höchstens eine Aufgabe je Thema; Kapitel reihum', () => {
    let s = startRun(POOL, T0);
    const topics = new Set<string>();
    const chapters: number[] = [];
    for (let k = 0; k < 14; k++) {
      const it = nextItem(s, T0)!;
      if (k < FIRST_MC) expect(it.fmt).toBe('mc');
      expect(topics.has(it.topic)).toBe(false);
      topics.add(it.topic);
      chapters.push(it.chapter);
      s = answerItem(s, it.id, k % 2 === 0);
    }
    // Nach 14 Aufgaben sind alle sieben Kapitel gleich oft (zweimal) dran gewesen.
    const counts = [1, 2, 3, 4, 5, 6, 7].map((c) => chapters.filter((x) => x === c).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });
  it('gleiche Eingabe gleiche Aufgabe; Einstufungsvorrat filtert fremde Herkunft', () => {
    const p = prior();
    expect(pickNext(p, POOL, [])?.id).toBe(pickNext(p, POOL, [])?.id);
    const mixed = [...POOL, { ...POOL[0]!, id: 'x', pool: 'train' }];
    expect(placePool(mixed)).toHaveLength(POOL.length);
    expect(pickNext(p, [], [])).toBeNull();
  });
});

describe('Ablauf', () => {
  it('Ende: höchstens 22 Aufgaben, 8 Minuten, oder SE ≤ 0,40 ab 14 Aufgaben', () => {
    let s = startRun(POOL, T0);
    expect(endReason(s, T0)).toBeNull();
    expect(endReason(s, T0 + LIMITS.maxMs)).toBe('time');
    expect(nextItem(s, T0 + LIMITS.maxMs)).toBeNull();
    for (let k = 0; k < LIMITS.maxN; k++) {
      const it = nextItem(s, T0)!;
      s = answerItem(s, it.id, true);
    }
    expect(endReason(s, T0)).toBe('max');
    expect(s.asked).toHaveLength(22);
  });
  it('eine Aufgabe zählt nur einmal; unbekannte Kennungen ändern nichts', () => {
    const s = startRun(POOL, T0);
    const it = nextItem(s, T0)!;
    const a = answerItem(s, it.id, true);
    expect(answerItem(a, it.id, false)).toBe(a);
    expect(answerItem(s, 'gibt-es-nicht', true)).toBe(s);
  });
  it('wenige Antworten: kein Kurzweg (zu dünn)', () => {
    let s = startRun(POOL, T0);
    for (let k = 0; k < SKIP.minN - 1; k++) s = answerItem(s, nextItem(s, T0)!.id, true);
    expect(placementResult(s).skip).toEqual([]);
  });
  it('ein Thema, das im Test falsch beantwortet wurde, bekommt nie den Kurzweg', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const rand = rng(seed);
      let s = startRun(POOL, T0);
      for (;;) {
        const it = nextItem(s, T0);
        if (!it) break;
        s = answerItem(s, it.id, rand() < pCorrect(1.5, it));
      }
      const wrongTopics = s.asked.filter((a) => a.ok === 0).map((a) => POOL.find((i) => i.id === a.id)!.topic);
      const { skip } = placementResult(s);
      for (const t of wrongTopics) expect(skip).not.toContain(t);
    }
  });
});

describe('Simulation: drei künstliche Lerner, je 200 Läufe', () => {
  for (const theta of [-1, 0, 1.5]) {
    it(`θ = ${theta}: nie mehr als 22 Aufgaben, mindestens 90 % richtig eingeordnet (Kurzweg-Menge)`, () => {
      let ok = 0;
      let maxAsked = 0;
      let minAsked = 99;
      let skipSum = 0;
      for (let run = 0; run < 200; run++) {
        const { r, asked } = simulate(theta, 1000 + run * 7 + Math.round((theta + 3) * 100));
        maxAsked = Math.max(maxAsked, asked);
        minAsked = Math.min(minAsked, asked);
        skipSum += r.skip.length;
        // Richtig eingeordnet: (a) kein Thema im Kurzweg, das deutlich über dem wahren Können liegt, (b) von den Themen, die deutlich darunter
        // liegen, ist mindestens die Hälfte im Kurzweg (bei sehr niedrigem θ gibt es keine, dann gilt nur (a)).
        const falseSkip = r.skip.filter((t) => topicDifficulty(POOL, t) > theta + 0.5);
        const clearlyKnown = [...new Set(POOL.map((i) => i.topic))].filter((t) => topicDifficulty(POOL, t) <= theta - 1.0);
        const found = clearlyKnown.filter((t) => r.skip.includes(t)).length;
        if (falseSkip.length === 0 && found >= Math.ceil(clearlyKnown.length / 2)) ok++;
      }
      expect(maxAsked).toBeLessThanOrEqual(22);
      expect(minAsked).toBeGreaterThanOrEqual(LIMITS.minN);
      expect(ok / 200).toBeGreaterThanOrEqual(0.9);
      // Wegweiser statt Urteil: wer wenig kann, bekommt kaum Kurzweg.
      if (theta <= -1) expect(skipSum / 200).toBeLessThan(4);
    });
  }
  it('θ wird grob getroffen: Mittel über 200 Läufe liegt nahe am wahren Wert', () => {
    for (const theta of [-1, 0, 1.5]) {
      const est = Array.from({ length: 200 }, (_, run) => simulate(theta, 5000 + run).r.theta);
      const mean = est.reduce((s, x) => s + x, 0) / est.length;
      expect(Math.abs(mean - theta)).toBeLessThan(0.6);
    }
  });
});

describe('Speichern', () => {
  const TODAY = '2026-10-07';
  const res = simulate(0, 42).r;
  it('Eintrag für app/c1.place: Tag, se, n, th, Kurzweg, Aufgabenliste ≤ 22; unter 2 KB', () => {
    const e = placeEntry(res, TODAY);
    expect(e).toMatchObject({ d: TODAY, n: res.n });
    expect(e.it!.length).toBeLessThanOrEqual(22);
    expect(JSON.stringify(e).length).toBeLessThan(2048);
    expect(Math.abs((e.th ?? 99) - res.theta)).toBeLessThan(0.006);
  });
  it('schreibt nur place und lässt alles andere unberührt (Updateform), legt das Dokument sonst an', () => {
    const e = placeEntry(res, TODAY);
    const cur = { v: 1, bad: ['a1'], checks: [], zukunft: { x: 1 } };
    const op = c1Update(cur, (d) => withPlacement(d, e), TODAY);
    expect(op).toEqual({ update: { place: e } });
    const created = c1Update(undefined, (d) => withPlacement(d, e), TODAY);
    expect(created).toMatchObject({ set: { v: 1, place: e } });
    expect(readC1({ v: 1, place: e }).place).toEqual(e);
    expect(withPlacement(emptyC1(), e).bad).toEqual([]);
  });
  it('Abbrechen schreibt nichts: der Ablauf selbst ruft nie die Datenbank (reine Zustände)', () => {
    let s = startRun(POOL, T0);
    for (let k = 0; k < 6; k++) s = answerItem(s, nextItem(s, T0)!.id, true);
    // Zustand wegwerfen = Abbruch. Ein Schreibvorgang entsteht nur, wenn `withPlacement` bewusst aufgerufen wird.
    expect(c1Update(undefined, () => null, TODAY)).toBeNull();
  });
  it('Neu einstufen frühestens nach 3 Monaten; alte Einstufung wird erst durch eine neue ersetzt', () => {
    expect(canRetake(undefined, TODAY)).toBe(true);
    expect(canRetake({ d: '2026-07-10' }, TODAY)).toBe(false);
    expect(canRetake({ d: '2026-07-01' }, TODAY)).toBe(true);
    expect(RETAKE_DAYS).toBe(91);
    expect(retakeFrom({ d: '2026-07-10' })).toBe('2026-10-09');
  });
});
