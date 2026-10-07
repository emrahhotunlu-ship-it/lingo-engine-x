import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/domain/content';
import { addDays, dayKey } from '../../src/domain/date';
import { checkMean, vtestView, errorSentenceStats, expectedKnown, festCount, festForecast, festGrowth28, grammarDistribution, retention28, topicStage } from '../../src/domain/metrics';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { berlin } from './helpers';

// Neue Fortschrittszahlen (Gesamtkonzept 3.5, K1 bis K3, K5, K6): jede Funktion mit Grenzfällen.

type Doc = Record<string, unknown>;
const NOW = berlin('2026-10-05', 10);
const TODAY = dayKey(NOW);
const D = 86_400_000;

const doc = (over: Doc = {}): Doc => ({ word: 'leverage', de: 'nutzen', def: 'to use', ex: 'We can [leverage] it.', pos: 'verb', state: 'review', S: 30, D: 5, due: NOW + 5 * D, last: NOW - 2 * D, stage: 4, reps: 6, lapses: 0, src: 'lookup', added: '2026-06-01', ...over });
const card = (over: Doc = {}, id = 'w'): TrainCard => toTrainCard(id, doc(over), true, NOW) as TrainCard;

describe('festCount', () => {
  it('Fest = Stufe ≥ 4 und Stabilität ≥ 21 Tage; Neue, Ausgeblendete und Stufe 3 nie', () => {
    const cards = [
      card({ stage: 4, S: 21 }, 'a'),
      card({ stage: 5, S: 80 }, 'b'),
      card({ stage: 3, S: 40 }, 'c'),
      card({ stage: 4, S: 20.9 }, 'd'),
      card({ stage: 4, S: 40, hidden: true }, 'e'),
      card({ state: 'new', stage: 0, S: 0, due: 0, last: 0 }, 'f'),
    ];
    expect(festCount(cards)).toBe(2);
  });
  it('ohne Karten null', () => expect(festCount([])).toBe(0));
});

describe('expectedKnown', () => {
  it('summiert die Abrufwahrscheinlichkeit gelernter Karten und sinkt bei Pausen', () => {
    const cards = [card({ S: 10, last: NOW - D }, 'a'), card({ S: 10, last: NOW - D }, 'b'), card({ state: 'new', stage: 0, S: 0, due: 0, last: 0 }, 'c')];
    const now1 = expectedKnown(cards, NOW);
    expect(now1).toBeGreaterThanOrEqual(1);
    expect(now1).toBeLessThanOrEqual(2);
    expect(expectedKnown(cards, NOW + 120 * D)).toBeLessThan(now1);
    expect(expectedKnown([], NOW)).toBe(0);
  });
});

describe('retention28', () => {
  const hist = (entries: Array<[number, number]>): Doc => ({ hist: entries.map(([daysAgo, g]) => ({ t: NOW - daysAgo * D, g, m: 'recog' })) });
  it('zählt nur Antworten nach mindestens sieben Tagen Pause, Note ≥ 2 = behalten', () => {
    const cards = [
      // Vorige Antwort vor 20 Tagen, jetzt vor 10: Pause 10 Tage → zählt (Note 3).
      card(hist([[20, 3], [10, 3]]), 'a'),
      // Pause nur 3 Tage → zählt nicht.
      card(hist([[20, 3], [17, 1]]), 'b'),
      // Pause 12 Tage, Note 1 → zählt als nicht behalten.
      card(hist([[24, 3], [12, 1]]), 'c'),
    ];
    const r = retention28(cards, NOW);
    expect(r.n).toBe(2);
    expect(r.rate).toBe(0.5);
    expect(r.enough).toBe(false);
    expect(r.band).toBeNull();
  });
  it('die erste Antwort ohne Vorgänger und Antworten außerhalb von 28 Tagen zählen nicht', () => {
    const r = retention28([card(hist([[40, 3], [35, 3]]), 'a'), card(hist([[5, 3]]), 'b')], NOW);
    expect(r).toMatchObject({ n: 0, rate: null, enough: false });
  });
  it('die Untergrenze 85 Prozent liegt noch im Korridor, 29 Antworten sind zu wenig', () => {
    const mk = (okN: number, total: number) => Array.from({ length: total }, (_, i) => card(hist([[30, 3], [10, i < okN ? 3 : 1]]), `c${i}`));
    expect(retention28(mk(51, 60), NOW)).toMatchObject({ n: 60, rate: 0.85, enough: true, band: 'in' });
    expect(retention28(mk(29, 29), NOW)).toMatchObject({ n: 29, enough: false, band: null });
  });
  it('Lage zum Korridor: niedrig, im Korridor, hoch', () => {
    const mk = (okN: number, total: number) => Array.from({ length: total }, (_, i) => card(hist([[30, 3], [10, i < okN ? 3 : 1]]), `c${i}`));
    expect(retention28(mk(24, 30), NOW).band).toBe('low'); // 80 %
    expect(retention28(mk(27, 30), NOW).band).toBe('in'); // 90 %
    expect(retention28(mk(30, 30), NOW).band).toBe('high'); // 100 %
  });
  it('mehrere Antworten am selben Tag zählen einmal', () => {
    const c = card({ hist: [{ t: NOW - 30 * D, g: 3 }, { t: NOW - 10 * D, g: 3 }, { t: NOW - 10 * D + 1000, g: 1 }] }, 'a');
    expect(retention28([c], NOW).n).toBe(1);
  });
});

describe('festGrowth28 und festForecast', () => {
  const snap = (daysAgo: number, va: number) => ({ d: addDays(TODAY, -daysAgo), va });
  it('ohne Tagesbilder oder unter 21 Tagen Datenbasis keine Zahl', () => {
    expect(festGrowth28(50, undefined, TODAY)).toBeNull();
    expect(festGrowth28(50, [], TODAY)).toBeNull();
    expect(festGrowth28(50, [snap(20, 40)], TODAY)).toBeNull();
    expect(festGrowth28(50, [{ d: addDays(TODAY, -27) }], TODAY)).toBeNull();
  });
  it('nimmt den ältesten Eintrag der letzten 28 Tage', () => {
    const g = festGrowth28(60, [snap(40, 5), snap(28, 40), snap(10, 52)], TODAY);
    expect(g).toEqual({ delta: 20, days: 28, per28: 20 });
  });
  it('Fest darf sinken, die Prognose entfällt dann', () => {
    const g = festGrowth28(35, [snap(25, 40)], TODAY);
    expect(g?.delta).toBe(-5);
    expect(festForecast(35, g, 1500)).toBeNull();
  });
  it('Prognose als Zeitraum, nie als einzelne Zahl', () => {
    const g = festGrowth28(100, [snap(28, 72)], TODAY); // +28 in 28 Tagen = 7 je Woche
    const f = festForecast(100, g, 1500);
    expect(f).not.toBeNull();
    expect(f!.weeksLo).toBeLessThan(f!.weeksHi);
    expect(f!.weeksLo).toBeLessThan(1400 / 7);
    expect(f!.weeksHi).toBeGreaterThan(1400 / 7);
  });
  it('ohne Datenbasis oder Ziel erreicht keine Prognose', () => {
    expect(festForecast(10, null, 1500)).toBeNull();
    expect(festForecast(1500, { delta: 30, days: 28, per28: 30 }, 1500)).toBeNull();
  });
});

describe('grammarDistribution', () => {
  const ids = TOPICS.map((t) => t.id);
  it('alle Themen ohne Dokumente: Verteilung nach Startwert, Neu = nie geübt', () => {
    const d = grammarDistribution(ids, new Map(), NOW);
    expect(d.total).toBe(ids.length);
    expect(ids.length).toBe(47);
    expect(d.counts.new).toBe(ids.length);
    expect(d.safe).toBe(0);
    expect(d.perTopic).toHaveLength(ids.length);
  });
  it('Zustände: Lernt, Sicher, Fest nach p, n und Belegtagen', () => {
    const hist3 = [{ d: '2026-09-01', p: 0.7 }, { d: '2026-09-10', p: 0.8 }, { d: '2026-09-20', p: 0.85 }];
    expect(topicStage(0.5, { n: 10 })).toBe('learning');
    expect(topicStage(0.9, { n: 3 })).toBe('learning');
    expect(topicStage(0.7, { n: 10 })).toBe('safe');
    expect(topicStage(0.9, { n: 20, hist: hist3.slice(0, 2) })).toBe('safe');
    expect(topicStage(0.9, { n: 14, hist: hist3 })).toBe('safe');
    expect(topicStage(0.9, { n: 20, hist: hist3 })).toBe('firm');
    expect(topicStage(0.8, { n: 20, hist: hist3 })).toBe('safe');
    expect(topicStage(0.9, { n: 0 })).toBe('new');
  });
  it('Verfall: ohne Übung sinkt ein Thema von Fest zurück', () => {
    const id = ids[0] as string;
    const hist3 = [{ d: '2026-04-01', p: 0.7 }, { d: '2026-04-10', p: 0.8 }, { d: '2026-04-20', p: 0.95 }];
    const g = new Map<string, Doc>([[id, { p: 0.95, n: 30, last: NOW - 2 * D, hist: hist3 }]]);
    expect(grammarDistribution(ids, g, NOW).counts.firm).toBe(1);
    const later = grammarDistribution(ids, g, NOW + 200 * D);
    expect(later.counts.firm).toBe(0);
    expect(later.perTopic[0]!.stage).not.toBe('firm');
  });
  it('Summe der Zustände ist immer die Themenzahl', () => {
    const g = new Map<string, Doc>(ids.slice(0, 5).map((id, i) => [id, { p: 0.3 + i * 0.15, n: i * 5, last: NOW - D }]));
    const d = grammarDistribution(ids, g, NOW);
    expect(d.counts.new + d.counts.learning + d.counts.safe + d.counts.firm).toBe(d.total);
  });
});

describe('errorSentenceStats', () => {
  const repair = {
    items: [
      { id: 'a', wrong: 'He go', right: 'He goes', src: 'say', t: NOW - 10 * D, box: 0, due: NOW + D },
      { id: 'b', wrong: 'I has', right: 'I have', src: 'say', t: NOW - 10 * D, box: 3, due: NOW + 9 * D, done: true },
      { id: 'c', wrong: 'She do', right: 'She does', src: 'say', t: NOW - 10 * D, box: 0, due: NOW - D, last: NOW - 2 * D },
      { id: 'd', wrong: 'We is', right: 'We are', src: 'say', t: NOW - 10 * D, box: 1, due: NOW - 3 * D, last: NOW - 4 * D },
    ],
  };
  it('offen, fest, wiederkehrend und überfällig aus Reparatur-Sätzen und Themen-Fehlern', () => {
    const grammar = new Map<string, Doc>([['passive', { errors: [{ q: 'q', given: 'g', ans: 'a', t: NOW - D }, { q: 'q2', given: 'g', ans: 'a', t: NOW - 20 * D, box: 3, done: true }] }]]);
    const s = errorSentenceStats(repair, grammar, NOW);
    expect(s).toEqual({ open: 4, firm: 2, recurring: 1, due: 2 });
  });
  it('ohne Daten alles null', () => {
    expect(errorSentenceStats(undefined, new Map(), NOW)).toEqual({ open: 0, firm: 0, recurring: 0, due: 0 });
  });
});

describe('checkMean (K7)', () => {
  const chk = (i: number, v: [number, number], g: [number, number]) => ({ d: addDays(TODAY, -7 * i), t: NOW - 7 * i * D, n: v[1] + g[1], ok: v[0] + g[0], vocab: v, colloc: [0, 0], gram: g, topics: [], words: [] });
  it('unter 3 Checks keine Zahl', () => {
    expect(checkMean({ checks: [chk(1, [4, 5], [4, 5]), chk(0, [5, 5], [5, 5])] })).toMatchObject({ n: 2, enough: false, vocab: null, gram: null });
    expect(checkMean({})).toMatchObject({ n: 0, enough: false });
  });
  it('ab 3 Checks das Mittel der letzten vier, Wörter und Grammatik getrennt', () => {
    const profile = { checks: [chk(4, [0, 5], [0, 5]), chk(3, [5, 5], [3, 5]), chk(2, [4, 5], [3, 5]), chk(1, [4, 5], [4, 5]), chk(0, [5, 5], [4, 5])].map((c) => ({ ...c, vocab: [c.vocab[0], c.vocab[1]], colloc: [0, 0], gram: [c.gram[0], c.gram[1]] })) };
    const m = checkMean(profile);
    expect(m).toMatchObject({ n: 5, enough: true, k: 4, vocab: 90, gram: 70 });
  });
});

describe('vtestView (K8)', () => {
  it('ohne Test none, nach 90 Tagen old ohne Zahl, sonst valid mit Spanne', () => {
    expect(vtestView({}, NOW)).toEqual({ state: 'none' });
    expect(vtestView({ vtests: [{ t: NOW - 100 * D, d: '2026-06-27', passive: 4000 }] }, NOW)).toMatchObject({ state: 'old' });
    const v = vtestView({ vtests: [{ t: NOW - 100 * D, passive: 3000 }, { t: NOW - 10 * D, passive: 4200, pLo: 3900, pHi: 4500 }] }, NOW);
    expect(v).toMatchObject({ state: 'valid', passive: 4200, lo: 3900, hi: 4500 });
    expect(vtestView({ vtests: [{ t: NOW - 10 * D, passive: 4200 }] }, NOW)).toMatchObject({ state: 'valid', lo: null, hi: null });
  });
});
