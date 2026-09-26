import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { invalidIdsOf, useLive } from '../../data/live';
import { dayKey } from '../../domain/date';
import { mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import { applyUpdate, cardPatch } from '../../domain/srs/applyReview';
import { buildTrainCards, toTrainCard } from '../../domain/srs/cards';
import { buildExercise } from '../../domain/srs/exercise';
import { chooseExercise } from '../../domain/srs/modes';
import { buildQueue, newQuotaLeft as newQuotaLeftFor } from '../../domain/srs/queue';
import { isLearningState } from '../../domain/srs/scheduler';
import type { AnswerEvent, Exercise, ExerciseId, Grade, Lang, QueueItem, TrainCard } from '../../domain/srs/types';
import { useTodayPlan } from '../today/store';
import { nextT, recordAnswer, recordRoundEnd, saveCard, usePending } from './persist';

// Eine Runde im Vokabeltrainer. Die Warteschlange wird synchron im Klick-Handler von „Starten"
// gebaut – so kann derselbe Handler die Tastatur öffnen (iPhone). Die Karten sind für die Runde
// eingefroren; Live-Änderungen mischen sie nicht neu (Architektur-Entwurf §4.3).

type Doc = Record<string, unknown>;
export type Round = 'pflicht' | 'extra';
export type ResultRow = { key: string; word: string; grade: Grade; ok: boolean };

type SessionState = {
  active: boolean;
  status: 'running' | 'summary';
  round: Round;
  day: string;
  lang: Lang;
  cards: Map<string, TrainCard>;
  pool: TrainCard[];
  queue: QueueItem[];
  pos: number;
  exercise: Exercise | null;
  /** Zähler für React-Schlüssel: jede gezeigte Übung ist eine neue Instanz. */
  step: number;
  shown: Record<string, number>;
  recentEx: ExerciseId[];
  answered: string[];
  results: ResultRow[];
  target: number;
  doneBefore: number;
  activeMs: number;
  lastInteract: number;
};

const EXTRA_TARGET = 10;
const AGAIN_WINDOW_MS = 20 * 60_000;
const MAX_SHOWN = 3;
const IDLE_CAP_MS = 60_000;
const ROUND_MIN = 10;

export const useSession = create<SessionState>(() => ({
  active: false,
  status: 'running',
  round: 'pflicht',
  day: '',
  lang: 'de',
  cards: new Map(),
  pool: [],
  queue: [],
  pos: 0,
  exercise: null,
  step: 0,
  shown: {},
  recentEx: [],
  answered: [],
  results: [],
  target: 0,
  doneBefore: 0,
  activeMs: 0,
  lastInteract: 0,
}));

/** Heutige Einträge: Datenbank und noch nicht gespeicherter Puffer. */
export function todayEntries(day: string): DayEntry[] {
  const live = useLive.getState().day;
  const liveEntries = live?.key === day && live.doc && Array.isArray(live.doc.entries) ? (live.doc.entries as DayEntry[]) : [];
  return mergeEntries(
    liveEntries,
    usePending.getState().entries.filter((e) => e.day === day),
  );
}

function exerciseFor(s: Pick<SessionState, 'cards' | 'pool' | 'lang' | 'day' | 'shown' | 'recentEx'>, item: QueueItem): Exercise | null {
  const card = s.cards.get(item.key);
  if (!card || item.phase !== 'quiz') return null;
  const ex = chooseExercise(card, s.lang, s.pool.length - 1, s.recentEx);
  if (!ex) return null;
  return buildExercise(card, ex, s.lang, s.pool, `${s.day}|${s.shown[item.key] ?? 0}`);
}

/** Nächste zeigbare Stelle ab `from` (Karten ohne mögliche Übung werden übersprungen). */
function settle(s: SessionState, from: number): Partial<SessionState> {
  for (let pos = from; pos < s.queue.length; pos++) {
    const item = s.queue[pos] as QueueItem;
    if (item.phase === 'intro') return { pos, exercise: null, step: s.step + 1 };
    const exercise = exerciseFor(s, item);
    if (exercise) return { pos, exercise, step: s.step + 1 };
  }
  return { pos: s.queue.length, exercise: null, step: s.step + 1 };
}

export type FirstKind = 'typed' | 'choice' | 'intro' | null;

/** Runde bauen (synchron). Rückgabe: Art der ersten Übung (für den Fokus im selben Handler). */
export function startSession(round: Round): FirstKind {
  const live = useLive.getState();
  const now = useClock.getState().now;
  const day = dayKey(Date.now());
  const lang = useSettings.getState().lang;
  const vocab = live.collections.vocab ?? new Map<string, Doc>();
  const cards = buildTrainCards(vocab, now, invalidIdsOf(live.invalid, 'vocab'));
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const pool = cards.filter((c) => !c.hidden);
  const entries = todayEntries(day);
  const reviewed = new Set(entries.filter((e) => e.ctx === 'rev' && typeof e.id === 'string').map((e) => `vocab/${String(e.id)}`));
  const answeredToday = new Set(entries.filter((e) => e.k === 'v' && typeof e.id === 'string').map((e) => `vocab/${String(e.id)}`));
  const plan = useTodayPlan.getState().plan;
  const goal = plan?.goal.review ?? 0;
  const doneBefore = round === 'pflicht' ? Math.min(goal, reviewed.size) : 0;
  const target = round === 'pflicht' ? Math.max(0, goal - reviewed.size) : EXTRA_TARGET;
  const profile = live.docs['app/profile'] ?? {};
  const introducedToday = cards.filter((c) => c.intro === day).length;
  // D17: Lektionswörter zählen mit, verdrängen aber nie alle eigenen neuen Karten.
  const introducedLessonToday = cards.filter((c) => c.intro === day && c.src === 'lesson').length;
  const newQuotaLeft = newQuotaLeftFor(profile.newPerDay, introducedToday, introducedLessonToday);
  const queue = buildQueue({ cards, nowMs: now, target, newQuotaLeft, exclude: round === 'pflicht' ? reviewed : answeredToday, lang });
  const base: SessionState = {
    active: true,
    status: 'running',
    round,
    day,
    lang,
    cards: byKey,
    pool,
    queue,
    pos: 0,
    exercise: null,
    step: useSession.getState().step,
    shown: {},
    recentEx: [],
    answered: [],
    results: [],
    target,
    doneBefore,
    activeMs: 0,
    lastInteract: performance.now(),
  };
  const next = { ...base, ...settle(base, 0) };
  if (next.pos >= next.queue.length) next.status = 'summary';
  useSession.setState(next);
  const item = next.queue[next.pos];
  if (!item || next.status === 'summary') return null;
  if (item.phase === 'intro') return 'intro';
  return next.exercise?.input ?? null;
}

/** Aktivität für die aktiven Minuten (Hintergrundzeit zählt nie, Ruhe über 60 s wird gekappt). */
export function touch(): void {
  const s = useSession.getState();
  if (!s.active) return;
  const now = performance.now();
  const add = s.lastInteract > 0 ? Math.min(IDLE_CAP_MS, Math.max(0, now - s.lastInteract)) : 0;
  useSession.setState({ activeMs: s.activeMs + add, lastInteract: now });
}

export function pauseActivity(hidden: boolean): void {
  const s = useSession.getState();
  if (!s.active) return;
  if (hidden) {
    touch();
    useSession.setState({ lastInteract: 0 });
  } else {
    useSession.setState({ lastInteract: performance.now() });
  }
}

function finish(s: SessionState, aborted: boolean): void {
  const n = s.results.length;
  const rest = s.queue.length - s.pos;
  void recordRoundEnd({
    day: s.day,
    act: s.round === 'pflicht' ? 'review' : 'cards',
    partial: aborted && n < ROUND_MIN && rest > 0,
    n,
    right: s.results.filter((r) => r.ok).length,
    activeMs: s.activeMs,
  });
}

/** Einführung einer neuen Karte gesehen: die erste Abfrage folgt zwei Karten später. */
export function continueIntro(): FirstKind {
  touch();
  const s = useSession.getState();
  const item = s.queue[s.pos];
  if (!item) return null;
  const queue = [...s.queue];
  queue.splice(Math.min(queue.length, s.pos + 3), 0, { key: item.key, reason: item.reason, phase: 'quiz' });
  return advanceFrom({ ...s, queue });
}

function advanceFrom(s: SessionState): FirstKind {
  const next = { ...s, ...settle(s, s.pos + 1) };
  if (next.pos >= next.queue.length) {
    next.status = 'summary';
    finish(next, false);
  }
  useSession.setState(next);
  const item = next.queue[next.pos];
  if (!item || next.status === 'summary') return null;
  return item.phase === 'intro' ? 'intro' : (next.exercise?.input ?? null);
}

export type Answer = { grade: Grade; given: string; ms: number; ok: boolean };

/** Bewertete Antwort übernehmen: Karte sofort speichern, Protokoll und Zähler vormerken, weiter. */
export function commitAnswer(ans: Answer): FirstKind {
  touch();
  const s = useSession.getState();
  const e = s.exercise;
  const item = s.queue[s.pos];
  if (!e || !item) return null;
  const card = e.card;
  const a: AnswerEvent = {
    t: nextT(),
    day: s.day,
    kind: 'v',
    id: card.id,
    ex: e.ex,
    grade: ans.grade,
    given: ans.given,
    ans: e.accepted[0] ?? card.word,
    ms: ans.ms,
    lang: s.lang,
    ctx: s.round === 'pflicht' ? 'rev' : 'xtra',
  };
  if (e.ex === 'colloc' && e.colloc) a.colIndex = e.colloc.index;

  // Lokal sofort weiterrechnen (optimistisch); gespeichert wird auf dem frischen Stand.
  const nextDoc = applyUpdate({ ...card.doc }, cardPatch({ ...card.doc }, a));
  const updated = toTrainCard(card.id, nextDoc, true, a.t) ?? card;
  const cards = new Map(s.cards);
  cards.set(card.key, updated);
  void saveCard(a, card.inDb ? null : { ...card.doc });
  recordAnswer(a, s.results.length === 0);

  const shown = { ...s.shown, [card.key]: (s.shown[card.key] ?? 0) + 1 };
  const queue = [...s.queue];
  const again = isLearningState(updated.fsrs) && updated.fsrs.due - a.t <= AGAIN_WINDOW_MS && (shown[card.key] ?? 0) < MAX_SHOWN;
  if (again) queue.splice(Math.min(queue.length, s.pos + 4), 0, { key: card.key, reason: 'again', phase: 'quiz' });
  const answered = s.answered.includes(card.key) ? s.answered : [...s.answered, card.key];
  return advanceFrom({
    ...s,
    cards,
    queue,
    shown,
    answered,
    recentEx: [...s.recentEx, e.ex].slice(-2),
    results: [...s.results, { key: card.key, word: card.word, grade: ans.grade, ok: ans.ok }],
  });
}

/** Runde verlassen (alles Beantwortete ist gespeichert bzw. vorgemerkt). */
export function leaveSession(): void {
  const s = useSession.getState();
  if (!s.active) return;
  if (s.status === 'running' && s.results.length > 0) finish(s, true);
  useSession.setState({ active: false, exercise: null });
}

