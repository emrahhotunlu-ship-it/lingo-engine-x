import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addDays } from '../../src/domain/date';
import { addError } from '../../src/domain/grammar/errors';
import { AGAIN_OLD, againSource } from '../../src/domain/repair/unit';
import { dueFehlersaetze } from '../../src/domain/repair/fehlersaetze';
import { atlasSize, buildTrainCards, dayLeft, ringShare, todaySummary, fehlersaetzeDue, festNow, fixAll, fixToday, grammarErrorsDue, laptopDeepen, dueLineSplit, newToday, reviewAll, reviewFigures, reviewToday, vocabEstimate, wordsToday } from '../../src/domain/metrics';
import { deckCounts } from '../../src/domain/srs/decks';
import { dueCount } from '../../src/domain/metrics/definitions';
import { newQuotaLeft } from '../../src/domain/srs/queue';
import { expectedNewPerDay } from '../../src/domain/unit/backlog';
import { FIX_LIMIT } from '../../src/domain/unit/planFor';
import { buildUnitStored, unitStepArgs } from '../../src/domain/unit/plan';
import type { StoredPlan } from '../../src/domain/plan/types';
import type { TrainCard } from '../../src/domain/srs/types';
import { vocabGoal } from '../../src/domain/vocab/goal';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

// Lernplattform 2.0 §4.9 (P4): eine Quelle je Zahl für Heute, Wörter und Grammatik. Für den Seed und drei erfundene Stände liefern die Selektoren dieselben
// Zahlen wie die Stellen, die sie bisher selbst gerechnet haben, und jede Zahl auf einem Knopf ist die Zahl der Dinge, die der Knopf startet.

const seed = loadSeed();
const coll = (name: string): Map<string, Doc> => new Map(Object.entries(seed).filter(([p]) => p.startsWith(`${name}/`)).map(([p, d]) => [p.slice(name.length + 1), d]));
const NOW = berlin(SEED_ANCHOR, 10);
const TODAY = SEED_ANCHOR;

/** Erfundene Stände: viele fällige Fehlersätze, wenige, keine. */
function state(nWrong: number): { grammar: Map<string, Doc>; repair: Doc } {
  const grammar = coll('grammar');
  let k = 0;
  for (const topic of ['conditionals', 'future-forms', 'passive']) {
    let list = (Array.isArray(grammar.get(topic)?.errors) ? (grammar.get(topic)!.errors as []) : []) as readonly Record<string, unknown>[];
    for (let i = 0; i < nWrong && k < nWrong; i++, k++) list = addError(list, { q: `We has ${k} issue.`, given: 'has', ans: `We have ${k} issues.`, t: NOW - (5 + k) * 86_400_000, src: 'review' });
    grammar.set(topic, { ...(grammar.get(topic) ?? { n: 5 }), errors: list });
  }
  const repair: Doc = { v: 1, items: Array.from({ length: Math.min(nWrong, 4) }, (_, i) => ({ id: `r${i}`, wrong: `I am agree ${i}.`, right: `I agree ${i}.`, src: 'say', t: NOW - 9 * 86_400_000, box: 0, due: NOW - 86_400_000 })) };
  return { grammar, repair };
}
const STATES = [0, 3, 12, 30].map((n) => ({ n, ...state(n) }));

/** Ein Montag (der Stichtag des Seeds ist ein Sonntag, dessen Plan eine andere Form hat). */
const PLAN_DAY = '2026-09-21';
const stored = (rv: 1 | 2, fixDue: number, day = PLAN_DAY): StoredPlan => buildUnitStored({ day, nowMs: NOW, week: null, goalMin: 25, review: { goal: 24, due: 20, fresh: 3, repairs: 0, sec: 470 }, fixDue, rv });

describe('Wörter: reviewAll, reviewToday, newToday', () => {
  const cards = buildTrainCards(coll('vocab'), NOW);
  it('reviewAll = Neu (höchstens Kontingent) + Lernen + Fällig, wie die Zählung der Decks', () => {
    for (const quota of [0, 2, 5, Infinity]) {
      const c = deckCounts(cards, NOW);
      expect(reviewAll(cards, NOW, quota)).toBe(Math.min(c.new, quota) + c.learning + c.due);
    }
  });

  it('reviewToday mit Pflichtrunde: Umfang aus dem Plan, Rest nach Antworten, Minuten anteilig; ohne Pflicht die freiwillige Runde (höchstens 20)', () => {
    const plan = stored(2, 5);
    const full = reviewToday({ plan, cards, nowMs: NOW });
    expect(full).toEqual({ total: 24, left: 24, minutes: 8 });
    const half = reviewToday({ plan, cards, nowMs: NOW, done: 12 });
    expect(half.left).toBe(12);
    expect(half.minutes).toBe(4);
    expect(reviewToday({ plan, cards, nowMs: NOW, done: 99 }).left).toBe(0);
    const extra = reviewToday({ plan: null, cards, nowMs: NOW, quotaLeft: 5 });
    expect(extra.total).toBeLessThanOrEqual(20);
    expect(extra.total).toBe(Math.min(20, reviewAll(cards, NOW, 5)));
  });

  it('UX-Audit U1 (eine Zahl überall): reviewFigures liefert „fällig“ und „heute im Plan“ für Heute, Wörter-Reiter und Wortliste', () => {
    const plan = stored(2, 5);
    const visible = cards.filter((c) => !c.hidden);
    const f = reviewFigures({ plan, cards, nowMs: NOW });
    // „heute im Plan“ ist genau der Pflichtumfang, den die Heute-Karte nennt; „fällig“ genau die Zählung der Wortliste.
    expect(f.planned).toBe(plan.goal.review);
    expect(f.planned).toBe(reviewToday({ plan, cards: visible, nowMs: NOW }).total);
    expect(f.due).toBe(dueCount(visible, NOW));
    expect(f.left).toBe(f.planned);
    expect(reviewFigures({ plan, cards, nowMs: NOW, done: 10 }).left).toBe(f.planned - 10);
    // Ohne Pflichtschritt gibt es keine Plan-Zahl, also auch keine zweite Zahl in der Zeile.
    const none = reviewFigures({ plan: null, cards, nowMs: NOW });
    expect(none.planned).toBe(0);
    expect(dueLineSplit(none)).toBe(false);
    expect(dueLineSplit({ due: 62, planned: 52 })).toBe(true);
    expect(dueLineSplit({ due: 40, planned: 40 })).toBe(false);
    expect(dueLineSplit({ due: 20, planned: 24 })).toBe(false);
  });

  it('newToday: nach Plan eingefroren, sonst Kontingent und Bremse; nie mehr als vorhanden', () => {
    const plan = stored(2, 0);
    const n = newToday({ plan, cards, nowMs: NOW, newPerDay: 5 });
    expect(n.n).toBeLessThanOrEqual(n.cap);
    expect(n.n).toBeLessThanOrEqual(plan.goal.new ?? 0);
    expect(n.cap).toBe(newQuotaLeft(5, cards.filter((c) => c.intro === TODAY).length, cards.filter((c) => c.intro === TODAY && c.src === 'lesson').length));
    const none = newToday({ plan: null, cards: cards.filter((c) => !c.isNew), nowMs: NOW, newPerDay: 5 });
    expect(none).toMatchObject({ n: 0, reason: 'pack' });
    const free = newToday({ plan: null, cards, nowMs: NOW, newPerDay: 5 });
    expect(free.n).toBe(Math.min(cards.filter((c) => c.isNew && !c.hidden).length, expectedNewPerDay(free.cap, free.braked)));
  });

  it('wordsToday: Lemmata fälliger und heute neuer Karten, klein, ohne Doppelte', () => {
    const words = wordsToday({ cards, plan: stored(2, 0), nowMs: NOW });
    expect(new Set(words).size).toBe(words.length);
    for (const w of words) expect(w).toBe(w.toLowerCase());
    expect(words.length).toBeGreaterThan(0);
  });

  it('vocabEstimate, festNow, atlasSize', () => {
    const goal = vocabGoal({ profile: seed['app/profile'], cards, today: TODAY });
    const est = vocabEstimate({ profile: seed['app/profile'], cards, today: TODAY });
    if (goal.measured && goal.now !== null) expect(est).toMatchObject({ n: goal.now, c1Reached: goal.now >= 4500 });
    else expect(est).toBeNull();
    expect(vocabEstimate({ profile: {}, cards: [], today: TODAY })).toBeNull();
    expect(festNow(cards)).toBe(goal.fest);
    expect(atlasSize()).toBe((JSON.parse(readFileSync(new URL('../../src/content/atlas/meta.json', import.meta.url), 'utf8')) as { atlas: number }).atlas);
  });

  it('laptopDeepen: nur Einträge vom Handy (dev „t“) zu Karten ab Stufe 4 oder heute neu', () => {
    const solid = cards.find((c) => c.stage >= 4 && !c.hidden && c.path.startsWith('vocab/'))!;
    const weak = cards.find((c) => c.stage < 4 && c.intro !== TODAY && !c.hidden && c.path.startsWith('vocab/'))!;
    const log: Doc = {
      entries: [
        { t: 1, ok: true, k: 'v', id: solid.id, dev: 't' },
        { t: 2, ok: true, k: 'v', id: weak.id, dev: 't' },
        { t: 3, ok: true, k: 'v', id: solid.id, dev: 'k' },
      ],
    };
    expect(laptopDeepen({ log, cards, today: TODAY })).toEqual([solid.word.trim()]);
    expect(laptopDeepen({ log: null, cards, today: TODAY })).toEqual([]);
    expect(laptopDeepen({ log: { entries: [{ id: solid.id, k: 'v' }] }, cards, today: TODAY })).toEqual([]);
  });
});

describe('Tag: dayLeft', () => {
  it('offene Schritte und Restminuten aus dem Plan und den erledigten Blocknummern', () => {
    const plan = stored(2, 5);
    expect(dayLeft(plan, new Set())).toEqual({ blocks: 4, minutes: plan.u!.min });
    expect(dayLeft(plan, new Set([1, 2]))).toEqual({ blocks: 2, minutes: plan.u!.b.filter(([b]) => b > 2).reduce((s, [, , m]) => s + m, 0) });
    expect(dayLeft(plan, new Set([1, 2, 3, 5]))).toEqual({ blocks: 0, minutes: 0 });
    expect(dayLeft(null, new Set())).toEqual({ blocks: 0, minutes: 0 });
  });

  it('P5 S1-ZAHL: dayLeft rechnet wie todaySummary().rest (Wiederholung anteilig), Ring und Zähler aus denselben Pflichtpunkten', () => {
    const plan = stored(2, 5);
    const blockOf = (id: string): number => plan.u!.b[plan.duty.indexOf(id as StoredPlan['duty'][number])]![0];
    for (const review of [null, { done: 0, total: 24 }, { done: 7, total: 24 }, { done: 24, total: 24 }]) {
      for (const doneIds of [[], [plan.duty[1]!], plan.duty.slice(1), plan.duty]) {
        const items = plan.duty.map((id) => ({ id, state: doneIds.includes(id) ? ('done' as const) : ('open' as const), progress: id === 'review' ? review : null }));
        const sum = todaySummary({ plan, items });
        expect(dayLeft(plan, new Set(doneIds.map(blockOf)), review).minutes).toBe(sum.rest);
        expect(sum.done).toBe(doneIds.length);
        expect(sum.total).toBe(plan.duty.length);
        expect(sum.fills).toHaveLength(plan.duty.length);
        expect(sum.ring).toBe(ringShare(items));
        expect(sum.ring === 1).toBe(doneIds.length === plan.duty.length);
        expect(sum.ring).toBeLessThanOrEqual(1);
      }
    }
    expect(todaySummary({ plan: null, items: [] })).toEqual({ rest: 0, fills: [], ring: 0, done: 0, total: 0 });
  });
});

describe('Fehlersätze: eine Zahl, die der Knopf wirklich startet', () => {
  for (const s of STATES) {
    it(`Stand mit ${s.n} falschen Sätzen: fehlersaetzeDue = dueFehlersaetze; Grammatik-Teil ≤ alle`, () => {
      const all = dueFehlersaetze({ grammarDocs: s.grammar, repairDoc: s.repair, nowMs: NOW, today: TODAY });
      const due = fehlersaetzeDue({ grammarDocs: s.grammar, repairDoc: s.repair, nowMs: NOW, today: TODAY });
      expect(due).toBe(all.length);
      expect(fixAll(due)).toBe(due);
      const g = grammarErrorsDue({ grammarDocs: s.grammar, nowMs: NOW });
      expect(g).toBe(all.filter((f) => f.store === 'grammar').length);
      expect(g).toBeLessThanOrEqual(due);
    });

    it(`Stand mit ${s.n} falschen Sätzen: fixToday = Zahl der Sätze, die Schritt 4 (rv 2), Schritt 4 (alte Regel) und die Extra-Runde starten`, () => {
      const due = fehlersaetzeDue({ grammarDocs: s.grammar, repairDoc: s.repair, nowMs: NOW, today: TODAY });
      // rv 2: Schritt 4 nimmt `limit` Sätze (Grenze aus dem Plan).
      const p2 = stored(2, due);
      const limit2 = unitStepArgs(p2, 5).limit ?? 0;
      const started2 = due === 0 ? 0 : dueFehlersaetze({ grammarDocs: s.grammar, repairDoc: s.repair, nowMs: NOW, today: TODAY, limit: limit2 }).length;
      expect(fixToday({ plan: p2, fixDue: due })).toBe(started2);
      // Alte Regel: `startAgain` nimmt die ältesten `AGAIN_OLD` Sätze (ohne Aufgabe von heute).
      const p1 = stored(1, due);
      const olds = againSource({ day: TODAY, task: null, repairDoc: s.repair, grammarDocs: s.grammar, now: NOW }).olds?.length ?? 0;
      expect(fixToday({ plan: p1, fixDue: due })).toBe(due === 0 ? 0 : olds);
      expect(olds).toBeLessThanOrEqual(AGAIN_OLD);
      // Extra-Runde ohne Plan: höchstens `REPAIR_ROUND_MAX` (5), wie `RepairRound.tsx`.
      const extra = readFileSync(new URL('../../src/features/apply/RepairRound.tsx', import.meta.url), 'utf8').match(/REPAIR_ROUND_MAX = (\d+)/)?.[1];
      expect(Number(extra)).toBe(FIX_LIMIT.min);
      expect(fixToday({ plan: null, fixDue: due })).toBe(Math.min(FIX_LIMIT.min, due));
    });
  }

  it('Heute, Grammatik und Wörter lesen dieselben Zahlen: Schritt-4-Zeile des Plans und fixToday', () => {
    for (const s of STATES) {
      const due = fehlersaetzeDue({ grammarDocs: s.grammar, repairDoc: s.repair, nowMs: NOW, today: addDays(TODAY, 0) });
      const plan = stored(2, due);
      const hasStep = plan.duty.includes('ch:u-again');
      expect(hasStep).toBe(due > 0);
      if (hasStep) expect(fixToday({ plan, fixDue: due })).toBeLessThanOrEqual(unitStepArgs(plan, 5).limit!);
    }
  });
});

describe('Ohne Verhaltensänderung: erledigte Hilfsfunktionen bleiben gleich', () => {
  it('Karten ohne Hand: Selektoren ändern keine Eingabe', () => {
    const cards: TrainCard[] = buildTrainCards(coll('vocab'), NOW);
    const before = JSON.stringify(cards);
    reviewAll(cards, NOW);
    wordsToday({ cards, plan: null, nowMs: NOW });
    expect(JSON.stringify(cards)).toBe(before);
  });
});
