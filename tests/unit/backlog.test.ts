import { describe, expect, it } from 'vitest';
import { toTrainCard } from '../../src/domain/srs/cards';
import type { TrainCard } from '../../src/domain/srs/types';
import { BACKLOG_BRAKE_AT, BACKLOG_MAX_SHARE, BACKLOG_SEC_PER_CARD, backlogBraked, backlogBudget, capacityNew, overdueCount } from '../../src/domain/unit/backlog';
import { buildUnitStored, unitPlanOf } from '../../src/domain/unit/plan';
import { unitReviewGoal } from '../../src/domain/unit/review';
import { REVIEW_MIN_MAX, REVIEW_SEC, VG_MIN, unitPlanFor } from '../../src/domain/unit/planFor';
import { berlin } from './helpers';

// Rückstand-Steuerung des Tagesplans (Emrah 02.10.2026): Zeit wächst mit überfälligen Karten (höchstens +50 %), ab 15
// überfälligen Karten nur noch die Mindestzahl neuer Wörter, die Minuten von Block 1 in der Anzeige bleiben wahr.

const DAY = 86_400_000;
const MON = '2026-10-05';
const NOW = berlin(MON, 9);

type Doc = Record<string, unknown>;
const reviewDoc = (i: number, dueOffsetDays: number): Doc => {
  const due = NOW + dueOffsetDays * DAY;
  return { id: `w${i}`, word: `word${i}`, pos: 'noun', de: `Wort${i}`, def: `meaning ${i}`, ex: `We often discuss the [word${i}] in meetings.`, col: [], level: 'C1', state: 'review', S: 10, D: 5, last: due - 10 * DAY, due, reps: 4, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-08-01', stage: 3, hist: [{ t: due - 10 * DAY, m: 'type', g: 3, x: 'type' }], intro: '2026-08-01' };
};
const freshDoc = (i: number): Doc => ({ id: `n${i}`, word: `fresh${i}`, pos: 'noun', de: `Neu${i}`, def: `new meaning ${i}`, ex: `A [fresh${i}] idea came up.`, col: [], level: 'C1', state: 'new', S: 0, D: 5, last: 0, due: 0, reps: 0, lapses: 0, modes: {}, order: 900, src: 'ai', added: '2026-09-20' });

/** `late` überfällige, `today` heute fällige Karten und `fresh` neue. */
function cards(late: number, today: number, fresh: number): TrainCard[] {
  const out: TrainCard[] = [];
  let i = 0;
  for (let k = 0; k < late; k++) out.push(toTrainCard(`w${i}`, reviewDoc(i++, -2 - (k % 5)), true, NOW)!);
  for (let k = 0; k < today; k++) out.push(toTrainCard(`w${i}`, reviewDoc(i++, -0.1), true, NOW)!);
  for (let k = 0; k < fresh; k++) out.push(toTrainCard(`n${k}`, freshDoc(k), true, NOW)!);
  return out;
}
const goal = (cs: TrainCard[], budgetSec: number = REVIEW_SEC.full, quotaLeft = 5) => unitReviewGoal({ cards: cs, repairs: 1, nowMs: NOW, lang: 'de', budgetSec, quotaLeft });

describe('Rückstand: Zählen, Zeit, Bremse', () => {
  it('überfällig = gestern oder früher fällig; neue und ausgeblendete Karten zählen nie', () => {
    const cs = cards(7, 4, 6);
    expect(overdueCount(cs, NOW)).toBe(7);
    const hidden = cs.map((c, k) => (k === 0 ? ({ ...c, hidden: true }) : c));
    expect(overdueCount(hidden, NOW)).toBe(6);
    // Nach Mitternacht (vor 04:00) gehört der Abend noch zum Vortag: dann ist erst der Vortag-Mittag überfällig.
    expect(overdueCount(cs, berlin('2026-10-06', 2))).toBeLessThan(7 + 1);
  });

  it('Zuschlag: 8 s je überfälliger Karte, höchstens +50 %, nie negativ', () => {
    expect(backlogBudget(480, 0)).toBe(480);
    expect(backlogBudget(480, 10)).toBe(480 + 10 * BACKLOG_SEC_PER_CARD);
    expect(backlogBudget(480, 500)).toBe(480 + 480 * BACKLOG_MAX_SHARE);
    expect(backlogBudget(180, 500)).toBe(270);
    expect(backlogBudget(480, -3)).toBe(480);
    expect(backlogBudget(Number.NaN, 20)).toBe(0);
  });

  it('Bremse greift genau ab der Schwelle', () => {
    expect(backlogBraked(BACKLOG_BRAKE_AT - 1)).toBe(false);
    expect(backlogBraked(BACKLOG_BRAKE_AT)).toBe(true);
  });
});

describe('unitReviewGoal mit Rückstand', () => {
  it('ohne Rückstand ändert sich nichts: Budget und Zahl neuer Wörter wie bisher', () => {
    const g = goal(cards(0, 40, 20));
    expect(g.overdue).toBe(0);
    // Kapazitätsregel (02.10.2026): ist viel Platz, kommen bis zu 6 neue Wörter; jedes über die üblichen 3 hinaus bringt seine 50 s mit.
    expect(g.fresh).toBeGreaterThanOrEqual(2);
    expect(g.fresh).toBeLessThanOrEqual(5);
    expect(g.sec).toBeLessThanOrEqual(REVIEW_SEC.full + Math.max(0, g.fresh - 3) * 50);
    expect(g.goal).toBe(g.repairs + g.due + g.fresh);
  });

  it('mit Rückstand: mehr Karten als ohne, aber höchstens +50 % Zeit', () => {
    const calm = goal(cards(0, 60, 20));
    const behind = goal(cards(40, 20, 20));
    expect(behind.overdue).toBe(40);
    expect(behind.due).toBeGreaterThan(calm.due);
    expect(behind.sec).toBeGreaterThan(REVIEW_SEC.full);
    expect(behind.sec).toBeLessThanOrEqual(REVIEW_SEC.full * (1 + BACKLOG_MAX_SHARE));
  });

  it('ab 15 überfälligen Karten nur noch die Mindestzahl neuer Wörter (2), darunter bis zum Kontingent', () => {
    expect(goal(cards(BACKLOG_BRAKE_AT, 30, 20), REVIEW_SEC.full, 10).fresh).toBe(2);
    expect(goal(cards(BACKLOG_BRAKE_AT - 1, 30, 20), REVIEW_SEC.full, 10).fresh).toBeGreaterThan(2);
  });

  it('neue Wörter steigen mit dem Rückstand nie: bei gleich vielen fälligen Karten von 0 bis 40 überfälligen', () => {
    let prev = Infinity;
    for (let late = 0; late <= 40; late++) {
      const fresh = goal(cards(late, 60 - late, 20), REVIEW_SEC.full, 5).fresh;
      expect(fresh, `${late} überfällig`).toBeLessThanOrEqual(prev);
      expect(fresh).toBeGreaterThanOrEqual(2);
      prev = fresh;
    }
  });

  it('die Bremse hebt ein kleineres Kontingent nie an (Kontingent 0 bleibt 0, 1 bleibt 1)', () => {
    expect(goal(cards(30, 10, 20), REVIEW_SEC.full, 0).fresh).toBe(0);
    expect(goal(cards(30, 10, 20), REVIEW_SEC.full, 1).fresh).toBe(1);
  });

  it('auch Kurz- und Sonntagsbudget wachsen höchstens um die Hälfte', () => {
    for (const base of [REVIEW_SEC.short, REVIEW_SEC.tiny, REVIEW_SEC.sun]) {
      const g = goal(cards(80, 10, 5), base);
      expect(g.sec).toBeLessThanOrEqual(Math.round(base * 1.5));
    }
  });
});

describe('Minuten von Block 1 in der Anzeige', () => {
  const review = (sec: number) => ({ goal: 30, due: 25, fresh: 3, repairs: 1, sec, overdue: 40 });
  const b1 = (p: { u?: { b: Array<[number, string, number]> } }) => p.u?.b.find((b) => b[1] === 'review')?.[2];

  it('Grundwert bleibt, solange die geplante Zeit hineinpasst (8 Min. am vollen Tag)', () => {
    expect(b1(buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review: review(470) }))).toBe(8);
    expect(b1(buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review: { goal: 12, due: 8, fresh: 3, repairs: 1 } }))).toBe(8);
  });

  it('bei Rückstand wächst die Anzeige auf die geplanten Minuten, gedeckelt bei 15', () => {
    expect(b1(buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review: review(700) }))).toBe(12);
    expect(b1(buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review: review(5000) }))).toBe(REVIEW_MIN_MAX);
  });

  it('der gespeicherte Plan liefert dieselben Minuten zurück (Neuladen, zweites Gerät)', () => {
    const stored = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review: review(700) });
    const up = unitPlanOf(stored as typeof stored & { u: NonNullable<typeof stored.u> }, null);
    expect(up.blocks.find((b) => b.kind === 'review')?.min).toBe(12);
    expect(up.minutes).toBe(stored.u?.min);
    // Gesamtzeit = Grundplan + Zuschlag
    expect(up.minutes).toBe(unitPlanFor(MON, null, { goalMin: 25, reviewCount: 30 }).minutes + 4);
  });

  it('ein älterer Plan ohne Zuschlag bleibt unverändert', () => {
    const old = buildUnitStored({ day: MON, nowMs: NOW, week: null, goalMin: 25, review: { goal: 12, due: 8, fresh: 3, repairs: 1 } });
    // Volle Einheit seit 04.10.2026: Wortschatz 8 · Grammatik 7 · Satzbau 5 · Fehler korrigieren 3 = 23 Min.
    const base = VG_MIN.full.review + VG_MIN.full.grammar + VG_MIN.full.order + VG_MIN.full.again;
    expect(base).toBe(23);
    expect(old.u?.min).toBe(base);
    expect(unitPlanOf(old as typeof old & { u: NonNullable<typeof old.u> }, null).minutes).toBe(base);
  });
});

describe('Kapazitätsregel für neue Wörter', () => {
  it('capacityNew: wenig Last → bis 5, viel Last → Untergrenze 2, dazwischen nach 72 s je Wort', () => {
    expect(capacityNew(0)).toBe(5);
    expect(capacityNew(300)).toBe(3); // (720 − 300) / 140 = 3
    expect(capacityNew(600)).toBe(2); // 0,9 → Untergrenze
    expect(capacityNew(5000)).toBe(2);
    expect(capacityNew(Number.NaN)).toBe(5);
  });

  it('wenig fällig und Kontingent 5: bis 4 neue Wörter am Tag, Zeit wächst nur um die 50 s je zusätzliches Wort', () => {
    const g = goal(cards(0, 6, 20), REVIEW_SEC.full, 5);
    expect(g.fresh).toBeGreaterThanOrEqual(4);
    expect(g.fresh).toBeLessThanOrEqual(5);
    expect(g.sec).toBeLessThanOrEqual(REVIEW_SEC.full + 1 * 50);
  });

  it('viel Last (viele Karten fällig in den nächsten Tagen): bleibt bei den üblichen höchstens 3', () => {
    const g = goal(cards(0, 40, 20), REVIEW_SEC.full, 5);
    expect(g.fresh).toBeLessThanOrEqual(3);
  });

  it('bei Bremse (≥ 15 überfällig) bleibt es bei der Mindestzahl, Kontingent 0 liefert keine neuen', () => {
    expect(goal(cards(20, 10, 20), REVIEW_SEC.full, 5).fresh).toBe(2);
    expect(goal(cards(0, 6, 20), REVIEW_SEC.full, 0).fresh).toBe(0);
  });
});
