import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { chapterIndexOf, programTopics, topicExists } from '../../src/domain/c1/chapters';
import { FMT_OF_KIND, isPlaceKind, placeItems, toPlaceItem } from '../../src/domain/c1/placement/items';
import { FORMAT_B, STAGE_B, difficulty, pCorrect, type PlaceItem } from '../../src/domain/c1/placement/model';
import { LIMITS, answerItem, nextItem, placementResult, startRun, topicDifficulty, type RunState } from '../../src/domain/c1/placement/run';
import { c1File } from '../../src/domain/c1x/schema';
import type { C1Item } from '../../src/domain/c1x/types';

// Einstufungsvorrat (Lernplattform 3.0 P35): die echten Inhalte mit `pool: 'place'` gegen das Verfahren aus P33.
// Aufbau: je Thema genau zwei Aufgaben, eine Auswahl (`mcc`) und eine zweite Art (`ocl`, `err` oder `kwt`); die Schwierigkeit `b` im Inhalt ist
// Stufe + Formatwert + Lehrerkorrektur (höchstens ±0,3). Die Schwierigkeiten sind begründete Startwerte, nicht geeicht (mit einem Nutzer nicht eichbar).

const ROOT = join(process.cwd(), 'src/content/c1x/src');
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith('.json') ? [join(dir, e.name)] : []));
}
const all: C1Item[] = files(ROOT).flatMap((p) => c1File.parse(JSON.parse(readFileSync(p, 'utf8'))).items);
const place = all.filter((i) => i.pool === 'place');
const { items: POOL, byId } = placeItems(all);
const live = programTopics().filter(topicExists);

describe('Einstufungsvorrat: Inhalt', () => {
  it('alle Aufgaben mit pool place sind gültig für die Einstufung (Art, Thema, Schwierigkeit)', () => {
    expect(place.length).toBeGreaterThan(0);
    for (const it of place) {
      expect(isPlaceKind(it.kind), `${it.id}: Art ${it.kind}`).toBe(true);
      expect(it.area).toBe('gram');
      expect(it.b, `${it.id}: b fehlt`).toBeTypeOf('number');
      expect(it.probe).toBeUndefined();
      expect(chapterIndexOf(it.topic ?? ''), `${it.id}: Thema ${it.topic} nicht im Programm`).toBeGreaterThanOrEqual(0);
    }
    expect(POOL).toHaveLength(place.length);
  });
  it('b = Stufe + Formatwert + Lehrerkorrektur, die Korrektur liegt in ±0,3', () => {
    for (const it of place) {
      if (!isPlaceKind(it.kind)) continue;
      const base = STAGE_B[it.level] + FORMAT_B[FMT_OF_KIND[it.kind]];
      expect(Math.abs((it.b ?? 0) - base), `${it.id}: Korrektur zu groß`).toBeLessThanOrEqual(0.3 + 1e-9);
      const p = toPlaceItem(it);
      expect(difficulty(p!), it.id).toBeCloseTo(it.b ?? 0, 6);
    }
  });
  it('je Thema genau zwei Aufgaben: eine Auswahl (mcc) und eine zweite Art; kein Thema doppelt belegt', () => {
    const by = new Map<string, C1Item[]>();
    for (const it of place) by.set(it.topic ?? '', [...(by.get(it.topic ?? '') ?? []), it]);
    for (const [topic, list] of by) {
      expect(list, `Thema ${topic}`).toHaveLength(2);
      expect(list.filter((i) => i.kind === 'mcc'), `Thema ${topic}: eine Auswahl`).toHaveLength(1);
      expect(list.filter((i) => i.kind !== 'mcc')).toHaveLength(1);
    }
  });
  it('jedes vorhandene Thema des Programms hat seine zwei Aufgaben', () => {
    const have = new Set(place.map((i) => i.topic));
    expect(live.filter((t) => !have.has(t))).toEqual([]);
  });
  it('die zweiten Arten sind gemischt (ocl, err, kwt je mindestens ein Drittel des Möglichen)', () => {
    const rest = place.filter((i) => i.kind !== 'mcc');
    for (const k of ['ocl', 'err', 'kwt']) expect(rest.filter((i) => i.kind === k).length / rest.length, k).toBeGreaterThan(0.25);
  });
  it('die Stufen sind gemischt: B2, B2+ und C1 kommen vor, mit Schwerpunkt auf B2 bis B2+', () => {
    const lv = (l: string) => place.filter((i) => i.level === l).length;
    expect(lv('B2')).toBeGreaterThan(0);
    expect(lv('B2+')).toBeGreaterThan(0);
    expect(lv('C1')).toBeGreaterThan(0);
  });
  it('in jedem Kapitel liegt etwas Leichtes und etwas Schweres (Kapitel reihum bleibt sinnvoll)', () => {
    for (let c = 1; c <= 7; c++) {
      const bs = POOL.filter((p) => p.chapter === c).map(difficulty);
      expect(bs.length, `Kapitel ${c}`).toBeGreaterThan(0);
      expect(Math.max(...bs) - Math.min(...bs), `Kapitel ${c}`).toBeGreaterThan(0.3);
    }
  });
  it('Inversion kommt in der Einstufung höchstens zweimal vor (Lehrer-Befund)', () => {
    const inv = place.filter((i) => /^inv\.|neg-inv|only-inv|not-only|hardly-sooner/.test(i.pat ?? ''));
    expect(inv.map((i) => i.id)).toHaveLength(inv.length);
    expect(inv.length).toBeLessThanOrEqual(2);
  });
  it('die Aufgaben stehen nie im Training', async () => {
    const { trainable } = await import('../../src/domain/c1x/select');
    for (const it of place) expect(trainable(it)).toBe(false);
  });
  it('byId liefert zu jeder Aufgabe des Vorrats die Inhaltsaufgabe', () => {
    for (const p of POOL) expect(byId.get(p.id)?.id).toBe(p.id);
  });
});

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

describe('Einstufungsvorrat: Simulation mit den echten Aufgaben', () => {
  const T0 = 1_000_000;
  function simulate(pool: readonly PlaceItem[], theta: number, seed: number) {
    const rand = rng(seed);
    let s: RunState = startRun(pool, T0);
    let now = T0;
    for (;;) {
      now += 20_000;
      const it = nextItem(s, now);
      if (!it) break;
      s = answerItem(s, it.id, rand() < pCorrect(theta, it));
    }
    return { r: placementResult(s), asked: s.asked.length };
  }
  for (const theta of [-1, 0, 1.5]) {
    it(`θ = ${theta}: nie mehr als 22 Aufgaben, mindestens 90 % richtig eingeordnet`, () => {
      let ok = 0;
      let maxAsked = 0;
      for (let run = 0; run < 200; run++) {
        const { r, asked } = simulate(POOL, theta, 2000 + run * 11 + Math.round((theta + 3) * 100));
        maxAsked = Math.max(maxAsked, asked);
        const falseSkip = r.skip.filter((t) => topicDifficulty(POOL, t) > theta + 0.5);
        const clearlyKnown = [...new Set(POOL.map((i) => i.topic))].filter((t) => topicDifficulty(POOL, t) <= theta - 1.0);
        const found = clearlyKnown.filter((t) => r.skip.includes(t)).length;
        if (falseSkip.length === 0 && found >= Math.ceil(clearlyKnown.length / 2)) ok++;
      }
      expect(maxAsked).toBeLessThanOrEqual(LIMITS.maxN);
      expect(ok / 200).toBeGreaterThanOrEqual(0.9);
    });
  }
  it('θ wird grob getroffen (Mittel über 200 Läufe)', () => {
    for (const theta of [-0.5, 0.5, 1.2]) {
      const est = Array.from({ length: 200 }, (_, run) => simulate(POOL, theta, 9000 + run).r.theta);
      const mean = est.reduce((s, x) => s + x, 0) / est.length;
      expect(Math.abs(mean - theta), `θ ${theta}`).toBeLessThan(0.6);
    }
  });
});
