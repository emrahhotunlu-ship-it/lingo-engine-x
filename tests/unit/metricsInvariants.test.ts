import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { FEST_DAYS, FEST_STAGE, buildTrainCards, counts, dueCount, isDue, isFest, isOverdue, overdueCount, streak, streakWeek, unitState, UNIT_STATES, festCount, retention28, expectedKnown } from '../../src/domain/metrics';
import { buildOverview } from '../../src/domain/overview';
import { streakView } from '../../src/domain/progress/weekDots';
import { buildQueue, dueCards } from '../../src/domain/srs/queue';
import { deckCounts, isDueCard } from '../../src/domain/srs/decks';
import { toTrainCard } from '../../src/domain/srs/cards';
import { vocabStatistics } from '../../src/domain/srs/retention';
import { filterCards, vocabStats } from '../../src/domain/srs/vocabList';
import type { TrainCard } from '../../src/domain/srs/types';
import { vocabGoal } from '../../src/domain/vocab/goal';
import { overdueCount as backlogOverdue } from '../../src/domain/unit/backlog';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

// Invarianten „eine Quelle je Zahl“ (Gesamtkonzept Kap. 4 und 8): dieselbe Zahl heißt überall gleich und kommt aus `domain/metrics`.

const seed = loadSeed();
const coll = (name: string): Map<string, Doc> => new Map(Object.entries(seed).filter(([p]) => p.startsWith(`${name}/`)).map(([p, d]) => [p.slice(name.length + 1), d]));
const MOMENTS = [berlin(SEED_ANCHOR, 3), berlin(SEED_ANCHOR, 10), berlin(SEED_ANCHOR, 23, 30), berlin(addDays(SEED_ANCHOR, 6), 9), berlin(addDays(SEED_ANCHOR, 45), 9)];

/** Feste Pseudo-Zufallsfolge (Mulberry32), damit der Test immer dieselben Karten baut. */
function rng(seedN: number): () => number {
  let a = seedN;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomCards(n: number, nowMs: number, seedN: number): TrainCard[] {
  const r = rng(seedN);
  const out: TrainCard[] = [];
  for (let i = 0; i < n; i++) {
    const stage = Math.floor(r() * 6);
    const isNew = r() < 0.15;
    const S = [0.5, 3, 8, 21, 30, 60][Math.floor(r() * 6)] as number;
    const due = nowMs + Math.round((r() - 0.5) * 6) * 86_400_000 + Math.round((r() - 0.5) * 20) * 3_600_000;
    const doc: Doc = { word: `w${i}`, de: `de${i}`, def: `d${i}`, ex: `We use [w${i}] here.`, pos: 'noun', state: isNew ? 'new' : 'review', stage: isNew ? 0 : stage, reps: isNew ? 0 : 3, S, D: 5, due, last: nowMs - 3 * 86_400_000, src: 'lookup', lapses: Math.floor(r() * 3), hidden: r() < 0.05 };
    const c = toTrainCard(`w${i}`, doc, true, nowMs);
    if (c) out.push(c);
  }
  return out;
}

describe('Fällig: eine Definition, überall dieselbe Zahl', () => {
  for (const now of MOMENTS) {
    it(`Heute-Zahl = Hub-Zahl = Rundenlänge (${new Date(now).toISOString()})`, () => {
      for (const cards of [buildTrainCards(coll('vocab'), now), randomCards(120, now, now % 997)]) {
        const n = counts(cards, now).due;
        const visible = cards.filter((c) => !c.hidden);
        expect(dueCount(cards, now)).toBe(n);
        expect(dueCards(visible, now).length).toBe(n);
        expect(visible.filter((c) => isDueCard(c, now)).length).toBe(n);
        const dc = deckCounts(cards, now);
        expect(dc.due + dc.learning).toBe(n);
        expect(vocabStats(cards, now, '2000-01-01', 5).due).toBe(n);
        expect(filterCards(cards, { filter: 'due', query: '', sort: 'az', nowMs: now }).length).toBe(n);
        // Runde ohne neue Karten: genau die fälligen (Dauerfehler-Kappe greift erst ab 5 Fehlversuchen, die es hier nicht gibt).
        const q = buildQueue({ cards, nowMs: now, target: n, newQuotaLeft: 0, exclude: new Set(), lang: 'de' });
        expect(q.filter((x) => x.reason === 'due').length).toBe(q.length);
        expect(q.length).toBeLessThanOrEqual(n);
        if (cards[0]?.word.startsWith('w')) expect(q.length).toBe(n);
        // Die Übersicht „Dein Stand“ rechnet aus den rohen Dokumenten und kommt auf dieselbe Anzahl.
        const ov = buildOverview({ nowMs: now, profile: seed['app/profile'], course: null, assess: null, schema: null, vocab: coll('vocab'), grammar: new Map() });
        if (!cards[0]?.word.startsWith('w')) expect(ov.vocab.due).toBe(n);
      }
    });
  }

  it('überfällig ist immer eine Teilmenge von fällig; die zweite Rechnung im Rückstand-Plan liefert dieselbe Zahl', () => {
    for (const now of MOMENTS) {
      const cards = randomCards(150, now, 7);
      const od = overdueCount(cards, now);
      expect(backlogOverdue(cards, now)).toBe(od);
      expect(counts(cards, now).overdue).toBe(od);
      for (const c of cards) if (isOverdue(c, now)) expect(isDue(c, now)).toBe(true);
      expect(od).toBeLessThanOrEqual(dueCount(cards, now));
    }
  });
});

describe('Fest: eine Definition', () => {
  it('Stufe ≥ 4 und Stabilität ≥ 21 Tage; Fortschritt, Wörter-Statistik, Ziel und Liste zählen dasselbe', () => {
    expect(FEST_STAGE).toBe(4);
    expect(FEST_DAYS).toBe(21);
    for (const now of MOMENTS) {
      for (const cards of [buildTrainCards(coll('vocab'), now), randomCards(200, now, 11)]) {
        const fest = festCount(cards);
        expect(counts(cards, now).fest).toBe(fest);
        expect(cards.filter(isFest).length).toBe(fest);
        expect(vocabStatistics(cards, now).active).toBe(fest);
        expect(filterCards(cards, { filter: 'solid', query: '', sort: 'az', nowMs: now }).length).toBe(fest);
        expect(cards.filter((c) => !c.hidden && !c.isNew && c.stage >= 4 && c.fsrs.stability >= 21).length).toBe(fest);
      }
    }
    const goal = vocabGoal({ profile: seed['app/profile'], cards: buildTrainCards(coll('vocab'), MOMENTS[1] as number), today: SEED_ANCHOR });
    expect(goal.fest).toBe(festCount(buildTrainCards(coll('vocab'), MOMENTS[1] as number).filter((c) => c.path.startsWith('vocab/'))));
  });

  it('die vier Zustände summieren sich zur Zahl der sichtbaren Karten; Fest = Zustand „firm“', () => {
    for (const now of MOMENTS) {
      const cards = randomCards(200, now, 3);
      const c = counts(cards, now);
      expect(UNIT_STATES.reduce((a, s) => a + c.byState[s], 0)).toBe(c.total);
      expect(c.byState.firm).toBe(c.fest);
      expect(cards.filter((x) => !x.hidden && unitState(x) === 'new').length).toBe(c.new);
    }
  });

  it('Erinnerungsquote und „Erwartet gekonnt“ der Wörter-Seite sind die der Fortschritts-Seite', () => {
    const now = MOMENTS[1] as number;
    const cards = buildTrainCards(coll('vocab'), now);
    const s = vocabStatistics(cards, now);
    expect(s.retention).toBe(retention28(cards, now).rate);
    expect(s.answers).toBe(retention28(cards, now).n);
    expect(s.expected).toBe(expectedKnown(cards, now));
  });
});

describe('Serie: eine Rechnung, sinkt nie durch Neuberechnung', () => {
  const profile = seed['app/profile'] as Doc;
  it('Übersicht, Profil-Knopf und Wochenstreifen liefern dieselbe Serie', () => {
    const now = berlin(SEED_ANCHOR, 21);
    const a = streak({ nowMs: now, profile, schema: null });
    expect(a.count).toBe(12);
    const ov = buildOverview({ nowMs: now, profile, course: null, assess: null, schema: null, vocab: new Map(), grammar: new Map() });
    expect(ov.streak).toEqual(a);
    expect(streakView({ nowMs: now, profile, schema: null }).streak).toEqual(a);
    expect(streakWeek({ nowMs: now, profile, schema: null }).streak).toEqual(a);
  });

  it('mehr Aktivität oder ein späterer Zeitpunkt am selben Tag senkt die Serie nie', () => {
    const base = streak({ nowMs: berlin(SEED_ANCHOR, 9), profile, schema: null }).count;
    for (const h of [10, 15, 21, 23]) expect(streak({ nowMs: berlin(SEED_ANCHOR, h), profile, schema: null }).count).toBeGreaterThanOrEqual(base);
    const days = { ...((profile.days as Record<string, number>) ?? {}) };
    let prev = base;
    for (let k = 1; k <= 5; k++) {
      days[addDays(SEED_ANCHOR, k)] = 1;
      const c = streak({ nowMs: berlin(addDays(SEED_ANCHOR, k), 20), profile: { ...profile, days }, schema: null }).count;
      expect(c).toBeGreaterThanOrEqual(prev);
      prev = c;
    }
  });
});
