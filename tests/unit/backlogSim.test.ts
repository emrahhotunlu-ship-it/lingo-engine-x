import { plannedCardSec } from '../../src/domain/srs/cost';
import { describe, expect, it } from 'vitest';
import { dayKey, learningDayEnd } from '../../src/domain/date';
import { mulberry32 } from '../../src/domain/random';
import { applyUpdate, cardPatch } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { buildQueue, dueCards, newCards, newQuotaLeft, quizzable } from '../../src/domain/srs/queue';
import { isLearningState, retrievability } from '../../src/domain/srs/scheduler';
import type { TrainCard } from '../../src/domain/srs/types';
import { unitReviewGoal } from '../../src/domain/unit/review';
import { REVIEW_SEC, dowOf } from '../../src/domain/week/plan';
import { block1Order } from '../../src/domain/week/review';

// Langzeit-Prüfung der Wiederholungs-Planung (Emrah 02.10.2026, Kap. 15 „Tests, die nur den heutigen Datensatz prüfen“):
// 120 Tage Pflicht-Wiederholen mit dem echten Tagesplan (`unitReviewGoal` → Warteschlange → FSRS). Startstand wie auf Emrahs
// Handy am 02.10.2026: 150 gefestigte Karten, 60 fällige (52 überfällig), 53 neue. Geantwortet wird mit der Wahrscheinlichkeit,
// dass die Karte wirklich noch abrufbar ist (FSRS-Abrufwahrscheinlichkeit), neue Karten mit 80 %.
// Ohne Rückstand-Steuerung wuchs der Berg fälliger Karten auf rund 370 und die Trefferquote reifer Karten fiel von 0,89 auf 0,79.

const DAY = 86_400_000;
type Doc = Record<string, unknown>;

function newDoc(i: number, added: string): Doc {
  return { id: `w${i}`, word: `word${i}`, pos: 'noun', de: `Wort${i}`, def: `meaning of word number ${i}`, ex: `We often discuss the [word${i}] in meetings.`, col: [], level: 'C1', state: 'new', S: 0, D: 5, last: 0, due: 0, reps: 0, lapses: 0, modes: {}, order: 900, src: 'ai', added };
}

type Row = { dueBefore: number; overdueBefore: number; goal: number; planSec: number; sec: number; newDone: number; matureTry: number; matureOk: number; studied: boolean };
type Out = { rows: Row[]; learned: number };

function simulate(days: number, opts: { control: boolean; pause?: [number, number]; newPerDay?: number }): Out {
  const rng = mulberry32(777);
  const base = new Date(2026, 9, 5, 9, 0, 0).getTime(); // Montag, 09:00
  const docs = new Map<string, Doc>();
  let n = 0;
  for (let k = 0; k < 150; k++) {
    const S = 20 + rng() * 100;
    const last = base - rng() * S * 0.9 * DAY;
    docs.set(`w${n}`, { ...newDoc(n, '2026-08-01'), state: 'review', S, D: 4 + rng() * 3, last, due: last + S * DAY, reps: 6, stage: 4, hist: [{ t: last, m: 'type', g: 3, x: 'type' }], intro: '2026-08-01' });
    n++;
  }
  for (let k = 0; k < 60; k++) {
    const S = 3 + rng() * 12;
    const due = base - rng() * 8 * DAY;
    const last = due - S * DAY;
    docs.set(`w${n}`, { ...newDoc(n, '2026-09-01'), state: 'review', S, D: 5 + rng() * 2, last, due, reps: 3, stage: 3, hist: [{ t: last, m: 'type', g: 3, x: 'type' }], intro: '2026-09-01' });
    n++;
  }
  for (let k = 0; k < 53; k++) docs.set(`w${n}`, newDoc(n++, '2026-09-20'));
  const mk = (nowMs: number): TrainCard[] => [...docs.entries()].map(([id, d]) => toTrainCard(id, d, true, nowMs)).filter((c): c is TrainCard => !!c);
  const rows: Row[] = [];
  const perDay = opts.newPerDay ?? 5;

  for (let day = 0; day < days; day++) {
    const now = base + day * DAY;
    // Nachschub: es sind immer genug neue Karten da (geprüft wird die Planung, nicht der Wortvorrat).
    let fresh = [...docs.values()].filter((d) => d.state === 'new').length;
    while (fresh++ < 30) docs.set(`w${n}`, newDoc(n++, dayKey(now)));
    const cards = mk(now);
    const dueBefore = cards.filter((c) => !c.isNew && c.fsrs.due < learningDayEnd(now)).length;
    const overdueBefore = cards.filter((c) => !c.isNew && c.fsrs.due < now - DAY).length;
    if (opts.pause && day >= opts.pause[0] && day < opts.pause[1]) {
      rows.push({ dueBefore, overdueBefore, goal: 0, planSec: 0, sec: 0, newDone: 0, matureTry: 0, matureOk: 0, studied: false });
      continue;
    }
    const quota = newQuotaLeft(perDay, 0, 0);
    const budget = dowOf(dayKey(now)) === 7 ? REVIEW_SEC.sun : REVIEW_SEC.full;
    let goal: number;
    let planNew: number;
    let planSec: number;
    if (opts.control) {
      const g = unitReviewGoal({ cards, repairs: 1, nowMs: now, lang: 'de', budgetSec: budget, quotaLeft: quota });
      goal = g.goal;
      planNew = g.fresh;
      planSec = g.sec ?? 0;
    } else {
      // Zur Kontrolle: das alte Verhalten (festes Budget, keine Bremse).
      const pool = cards.filter((c) => !c.hidden);
      const act = pool.filter((c) => quizzable(c, 'de', pool.length - 1));
      const sec = (c: TrainCard) => (c.stage <= 2 ? 12 : c.stage <= 4 ? 20 : 35);
      const r = block1Order<TrainCard | null>({ repairs: [{ item: null, sec: 40 }], due: dueCards(act, now).map((c) => ({ item: c, sec: sec(c) })), fresh: newCards(act).map((c) => ({ item: c, sec: 50 })), budgetSec: budget, quotaLeft: quota });
      goal = r.goal;
      planNew = r.fresh;
      planSec = r.sec;
    }
    const queue = buildQueue({ cards, nowMs: now, target: Math.max(0, goal - 1), newQuotaLeft: Math.min(quota, planNew), exclude: new Set(), lang: 'de' });
    const shown: Record<string, number> = {};
    let t = now;
    let sec = 0;
    let newDone = 0;
    let matureTry = 0;
    let matureOk = 0;
    for (let pos = 0; pos < queue.length; pos++) {
      const item = queue[pos]!;
      const card = mk(t).find((c) => c.key === item.key);
      if (!card) continue;
      t += 15_000;
      // Wie die App seit Paket 3 plant: reife Karten billiger (Wartung), im Aufholmodus (≥ 40 überfällig) aufgedeckt.
      sec += card.isNew ? 50 : plannedCardSec(card, overdueBefore >= 40);
      const p = card.isNew ? 0.8 : isLearningState(card.fsrs) ? Math.max(0.9, retrievability(card.fsrs, t)) : retrievability(card.fsrs, t);
      const ok = rng() < p;
      const doc = docs.get(card.id)!;
      docs.set(card.id, applyUpdate(doc, cardPatch(doc, { t, day: dayKey(now), kind: 'v', id: card.id, ex: 'type', grade: ok ? 3 : 1, given: '', ans: '', ms: 3000, lang: 'de', ctx: 'rev' })));
      const upd = toTrainCard(card.id, docs.get(card.id)!, true, t)!;
      shown[card.key] = (shown[card.key] ?? 0) + 1;
      if (card.isNew) newDone++;
      else if (!isLearningState(card.fsrs)) {
        matureTry++;
        if (ok) matureOk++;
      }
      // „Nochmal“ in der Runde (wie der Trainer): Karten in der Lernphase kommen wieder.
      if (isLearningState(upd.fsrs) && upd.fsrs.due - t <= 20 * 60_000 && (shown[card.key] ?? 0) < 3) queue.splice(Math.min(queue.length, pos + 4), 0, { key: card.key, reason: 'again', phase: 'quiz' });
    }
    rows.push({ dueBefore, overdueBefore, goal, planSec, sec, newDone, matureTry, matureOk, studied: true });
  }
  return { rows, learned: [...docs.values()].filter((d) => d.state !== 'new').length };
}

const retention = (rows: readonly Row[]): number => {
  const tried = rows.reduce((s, r) => s + r.matureTry, 0);
  return tried ? rows.reduce((s, r) => s + r.matureOk, 0) / tried : 0;
};
const max = (rows: readonly Row[], f: (r: Row) => number): number => rows.reduce((m, r) => Math.max(m, f(r)), 0);

describe('Wiederholungs-Planung über 120 Tage (echter Tagesplan)', () => {
  const withControl = simulate(120, { control: true });
  const without = simulate(120, { control: false });

  it('Kontrolle: ohne Rückstand-Steuerung wächst der Berg fälliger Karten weit über den Startwert (das Modell zeigt das Problem)', () => {
    expect(max(without.rows, (r) => r.dueBefore)).toBeGreaterThan(150);
    expect(retention(without.rows.slice(-30))).toBeLessThan(0.88);
  });

  it('mit Steuerung bleibt der Berg klein und die Trefferquote reifer Karten nahe am Ziel (90 %)', () => {
    expect(max(withControl.rows, (r) => r.dueBefore)).toBeLessThanOrEqual(140);
    expect(withControl.rows.at(-1)!.overdueBefore).toBeLessThanOrEqual(60);
    expect(retention(withControl.rows.slice(-30))).toBeGreaterThanOrEqual(0.85);
  });

  it('neue Wörter kommen an jedem Tag (mindestens 2, Kap. 15) und im Mittel mehr als 2', () => {
    for (const r of withControl.rows) expect(r.newDone).toBeGreaterThanOrEqual(2);
    const avg = withControl.rows.reduce((s, r) => s + r.newDone, 0) / withControl.rows.length;
    expect(avg).toBeGreaterThan(2);
    expect(withControl.learned).toBeGreaterThan(400);
  });

  it('die geplante Wiederholzeit bleibt im Rahmen: nie über 12 Minuten (8 + 50 %), im Mittel höchstens 10', () => {
    const plan = withControl.rows.map((r) => r.planSec);
    expect(Math.max(...plan)).toBeLessThanOrEqual(12 * 60);
    expect(plan.reduce((s, x) => s + x, 0) / plan.length).toBeLessThanOrEqual(10 * 60);
    // Tatsächlich gebraucht (mit „Nochmal“-Wiederholungen in der Lernphase): höchstens 15 Minuten.
    expect(Math.max(...withControl.rows.map((r) => r.sec))).toBeLessThanOrEqual(15 * 60);
  });

  it('nach 7 Tagen Pause baut sich der Rückstand wieder ab', () => {
    const pause = simulate(120, { control: true, pause: [40, 47] });
    const peak = max(pause.rows.slice(40, 60), (r) => r.overdueBefore);
    expect(peak).toBeGreaterThan(40);
    expect(max(pause.rows.slice(-30), (r) => r.overdueBefore)).toBeLessThanOrEqual(60);
    expect(retention(pause.rows.slice(-30))).toBeGreaterThanOrEqual(0.85);
  });
});
