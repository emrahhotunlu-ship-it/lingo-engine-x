// Vokabeln V0: Adapter für den HEUTIGEN Planer (Stand claude/umbau-fokus, 31.10.2026).
//
// Importiert wird die echte Logik: Umfang der Pflichtrunde wie im Tagesplan (`unitDraft` → `unitReviewGoal`, features/today/store.ts:200-229,
// mit Rückstand-Zuschlag und Neu-Bremse), Warteschlange (`buildQueue`, Gestern-Check, Kontingent, Leech-Deckel),
// Moduswahl (`pickMode`, `recallStep`, `chooseExercise`), Note (`autoGrade`), Schreiben je Antwort (`cardPatch`: FSRS mit Fuzz und
// Lernschritten, Dämpfung, Tag-0-Regel, Abstands-Deckel, Stufen) und die Wiedervorlage-Abstände (`againPos`, `DAY0_*`).
//
// Nachgebildet (weil `features/vocab/session.ts` an den Zustand der Oberfläche gebunden ist) sind nur die Verdrahtung der Runde:
// Einführung → Abruf nach 3 Karten (`continueIntro`), „Nochmal“ bei Lernzustand und Fälligkeit ≤ 20 Min., höchstens 3× je Runde
// (`session.ts:115-116, 995-999`), `lighterExercise` (`session.ts:338-357`) und der Ersatz für „Eigener Satz“ (`session.ts:276-285`).
// NICHT simuliert: Wort-Werkstatt, Fahrplan-Aktivierungen, Kontrast-Schritt, Anki/Aufdecken, Abend-Check, Wochen-Check, „Dieses Wort üben“,
// c1x-Wortbelege, Wendungen (`chunk/`). Diese Wege erzeugen in echt zusätzliche Abfragen; die Simulation unterschätzt deshalb Mehrfachabfragen.

import { applyUpdate, cardPatch } from '../../src/domain/srs/applyReview';
import { toTrainCard } from '../../src/domain/srs/cards';
import { againPos, DAY0_FIRST_GAP, DAY0_SECOND_GAP, lastRating, pickMode } from '../../src/domain/srs/flip';
import { autoGrade } from '../../src/domain/srs/grade';
import { availableExercises, chooseExercise, exerciseDef, makeEnv, supports } from '../../src/domain/srs/modes';
import { buildQueue, introducedKindsToday, longIntroducedToday, mixIntroducedToday, newQuotaLeft } from '../../src/domain/srs/queue';
import { unitDraft } from '../../src/domain/unit/plan';
import { unitReviewGoal } from '../../src/domain/unit/review';
import { normGoalMin } from '../../src/domain/progress/settings';
import { isLearningState } from '../../src/domain/srs/scheduler';
import { recallStep, wantsFreeRecall } from '../../src/domain/srs/spacing';
import type { AnswerEvent, ExerciseId, QueueItem, TrainCard } from '../../src/domain/srs/types';
import { dayKey, learningDayStart } from '../../src/domain/date';
import { isOverdue } from '../../src/domain/metrics/definitions';
import type { InputKind, Outcome, PlannerAdapter, PlannerSession, SimWord, Task } from './sim-core';

type Doc = Record<string, unknown>;
const DAY = 86_400_000;
const AGAIN_WINDOW_MS = 20 * 60_000; // session.ts:115
const MAX_SHOWN = 3; // session.ts:116
const MAINTENANCE_S = 21; // session.ts:118
const MAINTENANCE_EVERY = 3; // session.ts:119
const EXTRA_SIZE = 20; // „Alle fälligen“ → startExtra({ deck: 'all', size: 20 }), features/vocab/start.ts:26
const NEW_PER_DAY = 5; // Standard (domain/progress/settings.ts)
const FREE_TYPED: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['type', 'cloze', 'cloze_part', 'situation']);
const env = makeEnv(true, true, true); // Handy mit Sprachausgabe und KI (Emrahs Normalfall)

const docs = new Map<string, Doc>();
const entries = new Map<string, { key: string; ctx: 'rev' | 'xtra' }[]>();
const plans = new Map<string, { review: number; new: number }>();
let tick = 0;

const cardsAt = (now: number): TrainCard[] => [...docs].map(([id, d]) => toTrainCard(id, d, true, now)).filter((c): c is TrainCard => !!c);

function inputOf(ex: ExerciseId): InputKind {
  const i = exerciseDef(ex).input;
  if (i === 'choice' || i === 'spot' || i === 'flip') return 'choice';
  if (ex === 'cloze_hint' || i === 'tiles') return 'hint';
  if (i === 'sentence' || i === 'produce') return 'sentence';
  return 'typed';
}

/** Nachbildung von `exerciseFor` für den Modus `auto` (ohne Werkstatt, Fahrplan, Kontrast). */
function exerciseFor(card: TrainCard, item: QueueItem, day: string, pool: number, recent: ExerciseId[]): { ex: ExerciseId; recall: string | null } | null {
  const picked = pickMode({ card, requested: 'auto', day, lang: 'de', due: item.reason === 'due', controlAllowed: false, catchUp: false, key: card.key });
  if (picked === 'type') {
    const step = recallStep(card, day);
    if (step) {
      const order: readonly ExerciseId[] = step === 'hint' ? ['cloze_hint', 'type'] : ['cloze', 'type'];
      const ex = order.find((x) => supports(card, x, 'de', pool, env));
      if (ex) return { ex, recall: step === 'hint' ? 'day0a' : step === 'free' ? 'day0b' : 'check' };
    }
  }
  if (picked === 'control') {
    const ex: ExerciseId | null = supports(card, 'cloze', 'de', pool, env) ? 'cloze' : supports(card, 'type', 'de', pool, env) ? 'type' : null;
    if (ex) return { ex, recall: null };
  }
  if (picked === 'probe') {
    const ex = chooseExercise({ ...card, stage: 3 }, 'de', pool, recent, env);
    if (ex) return { ex, recall: null };
  }
  if (item.reason === 'due') {
    const freeOne = (): ExerciseId | null => {
      const ex = chooseExercise({ ...card, stage: 4 }, 'de', pool, recent, env);
      return ex && FREE_TYPED.has(ex) ? ex : null;
    };
    let lighter: ExerciseId | null = null;
    if (card.stage === 3) {
      const last = lastRating(card.doc);
      if (last && (last.x === 'cloze_hint' || last.x === 'tiles') && (last.g ?? 0) >= 3 && dayKey(last.t) !== day) lighter = freeOne();
    }
    if (!lighter && card.stage <= 3 && wantsFreeRecall(card.doc)) lighter = freeOne();
    const reps = typeof card.doc.reps === 'number' ? card.doc.reps : 0;
    if (!lighter && card.stage >= 5 && card.fsrs.stability >= MAINTENANCE_S && reps % MAINTENANCE_EVERY !== 0) lighter = freeOne();
    if (lighter) return { ex: lighter, recall: null };
  }
  const ex = chooseExercise(card, 'de', pool, recent, env);
  if (!ex) return null;
  if (ex === 'produce') {
    const other = chooseExercise({ ...card, stage: 4 }, 'de', pool, recent, env);
    if (other && other !== 'produce' && FREE_TYPED.has(other)) return { ex: other, recall: null };
    const alt = availableExercises({ ...card, stage: 4 }, 'de', pool, env).find((x) => x !== 'produce');
    if (alt) return { ex: alt, recall: null };
  }
  return { ex, recall: null };
}

function makeSession(kind: 'pflicht' | 'extra', now0: number): PlannerSession {
  const day = dayKey(now0);
  const cards = cardsAt(now0);
  const today = entries.get(day) ?? [];
  const reviewed = new Set(today.filter((e) => e.ctx === 'rev').map((e) => e.key));
  const answeredToday = new Set(today.map((e) => e.key));
  const introducedToday = cards.filter((c) => c.intro === day).length;
  const quota = newQuotaLeft(NEW_PER_DAY, introducedToday, 0);
  let plan = plans.get(day);
  if (!plan) {
    // Tagesplan einmal je Lerntag (eingefroren), wie `buildTodayPlan` (features/today/store.ts:200-229): Budget aus der Einheit (Ziel 25 Min., Standard),
    // Umfang und Zahl neuer Wörter aus `unitReviewGoal`.
    const draft = unitDraft({ day, week: null, goalMin: normGoalMin(undefined) });
    const review = draft.duty.includes('review') ? unitReviewGoal({ cards, repairs: 0, nowMs: now0, lang: 'de', budgetSec: draft.reviewSec, quotaLeft: quota }) : { goal: 0, fresh: 0 };
    plan = { review: review.goal, new: review.fresh };
    plans.set(day, plan);
  }
  const target = kind === 'pflicht' ? Math.max(0, plan.review - reviewed.size) : EXTRA_SIZE;
  const nq = kind === 'pflicht' ? Math.min(quota, Math.max(0, plan.new - introducedToday)) : quota;
  const mix = { introduced: mixIntroducedToday(cards, day), longToday: longIntroducedToday(cards, day), ...introducedKindsToday(cards, day) };
  const queue: QueueItem[] = buildQueue({ cards, nowMs: now0, target, newQuotaLeft: nq, exclude: kind === 'pflicht' ? reviewed : answeredToday, lang: 'de', mix });
  let pos = 0;
  const shown: Record<string, number> = {};
  const recent: ExerciseId[] = [];
  let current: { item: QueueItem; ex: ExerciseId; recall: string | null } | null = null;
  const pool = cards.filter((c) => !c.hidden).length - 1;

  return {
    next(now: number): Task | null {
      for (;;) {
        const item = queue[pos];
        if (!item) return null;
        const id = item.key.replace(/^vocab\//, '');
        const doc = docs.get(id);
        const card = doc ? toTrainCard(id, doc, true, now) : null;
        if (!card) {
          pos++;
          continue;
        }
        if (item.phase === 'intro') {
          current = { item, ex: 'mc_en', recall: null };
          return { lexeme: id, ex: 'intro', input: 'choice', stage: card.stage, step: true, intro: true };
        }
        const picked = exerciseFor(card, item, day, pool, recent);
        if (!picked) {
          pos++;
          continue;
        }
        current = { item, ...picked };
        const step = item.reason === 'again' || picked.recall === 'day0a' || picked.recall === 'day0b';
        return { lexeme: id, ex: picked.ex, input: inputOf(picked.ex), stage: card.stage, step };
      }
    },
    answer(task: Task, o: Outcome | null, now: number): void {
      const cur = current;
      if (!cur) return;
      current = null;
      if (task.intro) {
        // continueIntro (session.ts:643-652): Abruf 1 nach drei anderen Karten.
        queue.splice(Math.min(queue.length, pos + DAY0_FIRST_GAP), 0, { key: cur.item.key, reason: cur.item.reason, phase: 'quiz' });
        pos++;
        return;
      }
      if (!o) return;
      const id = task.lexeme;
      const doc = docs.get(id) as Doc;
      const t = Math.max(now, tick + 1);
      tick = t;
      const grade = autoGrade(cur.ex, { verdict: o.verdict }, { submitMs: o.submitMs, firstKeyMs: o.firstKeyMs, chars: o.chars, profile: 'touch' });
      const a: AnswerEvent = { t, day, kind: 'v', id, ex: cur.ex, grade, given: '', ans: '', ms: o.submitMs, lang: 'de', ctx: kind === 'pflicht' ? 'rev' : 'xtra', fk: o.firstKeyMs };
      const next = applyUpdate({ ...doc }, cardPatch({ ...doc }, a));
      docs.set(id, next);
      const list = entries.get(day) ?? [];
      list.push({ key: cur.item.key, ctx: a.ctx === 'rev' ? 'rev' : 'xtra' });
      entries.set(day, list);
      shown[cur.item.key] = (shown[cur.item.key] ?? 0) + 1;
      recent.push(cur.ex);
      if (recent.length > 2) recent.shift();
      const upd = toTrainCard(id, next, true, t);
      const again = !!upd && isLearningState(upd.fsrs) && upd.fsrs.due - t <= AGAIN_WINDOW_MS && (shown[cur.item.key] ?? 0) < MAX_SHOWN;
      const day0Passed = cur.recall === 'day0a' && grade >= 3;
      if (again) queue.splice(againPos(pos, queue.length, false, grade >= 3, day0Passed ? DAY0_SECOND_GAP : 0), 0, { key: cur.item.key, reason: 'again', phase: 'quiz' });
      pos++;
    },
  };
}

const adapter: PlannerAdapter = {
  name: 'heute (claude/umbau-fokus, 31.10.2026)',
  init(words: readonly SimWord[]): void {
    docs.clear();
    entries.clear();
    plans.clear();
    tick = 0;
    for (const w of words) docs.set(w.id, { id: w.id, word: w.word, pos: w.pos, de: w.de, def: w.def, ex: w.ex, level: 'C1', src: w.src, order: w.order, col: [], added: w.added, state: 'new' });
  },
  session: makeSession,
  overdue(now: number): number {
    return cardsAt(now).filter((c) => isOverdue(c, now)).length;
  },
  forecast(now: number, n: number): number[] {
    const start = learningDayStart(now);
    const out = Array.from({ length: n }, () => 0);
    for (const c of cardsAt(now)) {
      if (c.isNew || c.hidden) continue;
      const i = Math.floor((c.fsrs.due - start) / DAY) - 1;
      if (i >= 0 && i < n) out[i] = (out[i] as number) + 1;
    }
    return out;
  },
};

export default adapter;
