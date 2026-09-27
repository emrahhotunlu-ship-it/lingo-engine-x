import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { invalidIdsOf, useLive } from '../../data/live';
import { dayKey } from '../../domain/date';
import { mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import { applyUpdate, cardPatch } from '../../domain/srs/applyReview';
import { buildTrainCards, toTrainCard } from '../../domain/srs/cards';
import { buildChunkCards, toChunkCard } from '../../domain/srs/chunkCards';
import { buildExercise, type SceneLookup } from '../../domain/srs/exercise';
import { chooseExercise, type ExerciseEnv } from '../../domain/srs/modes';
import { entryCardKey } from '../../domain/progress/logPatch';
import { sceneView } from '../../domain/speak/library';
import { selectAiAvailable } from '../../ai/scope';
import { useCapabilities } from '../../platform/capabilities';
import { useSpeech } from '../../platform/speech';
import { useWatched } from '../../data/watch';
import { legacySceneDoc } from '../speak/useSceneLibrary';
import { buildQueue, newQuotaLeft as newQuotaLeftFor } from '../../domain/srs/queue';
import { isLearningState } from '../../domain/srs/scheduler';
import type { AnswerEvent, Exercise, ExerciseId, Grade, Lang, QueueItem, TrainCard } from '../../domain/srs/types';
import { markExhausted, useTodayPlan } from '../today/store';
import { inDeck, type Deck } from '../../domain/srs/vocabList';
import { nextT, recordAnswer, recordRoundEnd, saveCard, usePending } from './persist';
import { pickDailyRepairs, repairsDoneToday } from '../../domain/repair/daily';
import type { RepairItem } from '../../domain/repair/repair';
import { commitRepairAnswer } from '../repair/review';

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
  /** Sprachausgabe und KI beim Start der Runde (listen_mc, dictation, produce). */
  env: ExerciseEnv;
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
  /** Lernberatung V2: fällige Reparatur-Sätze vor den Karten (höchstens 4 je Tag). */
  repairs: RepairItem[];
  repairPos: number;
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
  env: { tts: false, ai: false },
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
  repairs: [],
  repairPos: 0,
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

/** Umgebung jetzt: Sprachausgabe bereit, KI nutzbar (not_granted/nosample → ohne produce). */
export function currentEnv(): ExerciseEnv {
  return { tts: useSpeech.getState().status === 'ready', ai: selectAiAvailable(useCapabilities.getState()) };
}

/** Szene einer Wendung (Inhalt ⊕ geladene `scene/*`) für die Situationsübung (M15). */
function sceneLookup(lang: Lang): SceneLookup {
  return (id) => {
    const db = useWatched.getState().docs.scene?.get(id);
    const doc = db ?? legacySceneDoc(id);
    if (!doc) return null;
    const v = sceneView(id, doc, db ? 'db' : 'legacy', lang);
    return { title: v.title, situation: v.situation, counterpart: v.persona ? `${v.persona.name}, ${v.persona.role}` : '' };
  };
}

function exerciseFor(s: Pick<SessionState, 'cards' | 'pool' | 'lang' | 'day' | 'shown' | 'recentEx' | 'env'>, item: QueueItem): Exercise | null {
  const card = s.cards.get(item.key);
  if (!card || item.phase !== 'quiz') return null;
  const ex = chooseExercise(card, s.lang, s.pool.length - 1, s.recentEx, s.env);
  if (!ex) return null;
  return buildExercise(card, ex, s.lang, s.pool, `${s.day}|${s.shown[item.key] ?? 0}`, { sceneOf: sceneLookup(s.lang) });
}

/** Alle Karten der Runde: Vokabeln und Wendungen (`chunk/*`) mit derselben Planung. */
export function allTrainCards(nowMs: number): TrainCard[] {
  const live = useLive.getState();
  const vocab = buildTrainCards(live.collections.vocab ?? new Map<string, Doc>(), nowMs, invalidIdsOf(live.invalid, 'vocab'));
  const chunks = buildChunkCards(live.collections.chunk ?? new Map<string, Doc>(), nowMs, invalidIdsOf(live.invalid, 'chunk'));
  return [...vocab, ...chunks];
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

/** Tastatur nur für die Lücke (getippt); alles andere schließt sie (iPhone: im selben Handler). */
export const firstKindOf = (e: Exercise | null): FirstKind => (!e ? null : e.input === 'typed' ? 'typed' : 'choice');

/** Runde bauen (synchron). Rückgabe: Art der ersten Übung (für den Fokus im selben Handler). */
/** Freie Runde (M9): Stapel und Größe; `only` = genau diese Karten („Jetzt üben" am Wortblatt). */
export type SessionOpts = { deck?: Deck; size?: number; only?: readonly string[] };

export function startSession(round: Round, opts: SessionOpts = {}): FirstKind {
  const live = useLive.getState();
  const now = useClock.getState().now;
  const day = dayKey(Date.now());
  const lang = useSettings.getState().lang;
  const cards = allTrainCards(now);
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const pool = cards.filter((c) => !c.hidden);
  const entries = todayEntries(day);
  // B3 (Phase-3-Plan): nur Vokabel-Einträge zählen als „Wiederholen“, nie Sprech- oder Business-Einträge.
  // Wendungen zählen wie Vokabeln (Schlüssel `chunk/<id>`).
  const reviewed = new Set(entries.filter((e) => e.ctx === 'rev').map(entryCardKey).filter((k): k is string => !!k));
  const answeredToday = new Set(entries.map(entryCardKey).filter((k): k is string => !!k));
  const plan = useTodayPlan.getState().plan;
  const goal = plan?.goal.review ?? 0;
  const doneBefore = round === 'pflicht' ? Math.min(goal, reviewed.size) : 0;
  const target = round === 'pflicht' ? Math.max(0, goal - reviewed.size) : opts.only ? opts.only.length : (opts.size ?? EXTRA_TARGET);
  const profile = live.docs['app/profile'] ?? {};
  const introducedToday = cards.filter((c) => c.intro === day).length;
  // D17: Lektionswörter zählen mit, verdrängen aber nie alle eigenen neuen Karten.
  const introducedLessonToday = cards.filter((c) => c.intro === day && c.src === 'lesson').length;
  const quota = newQuotaLeftFor(profile.newPerDay, introducedToday, introducedLessonToday);
  const env = currentEnv();
  // W2: Die Pflichtrunde hält sich an die geplante Zahl neuer Karten (Wiederholungen haben Vorrang).
  const plannedNew = plan?.goal.new;
  const newQuotaLeft = round === 'pflicht' && plannedNew !== undefined ? Math.min(quota, Math.max(0, plannedNew - Math.max(0, introducedToday - introducedLessonToday))) : quota;
  const deck = opts.deck ?? 'all';
  // Lernberatung V2: fällige Reparatur-Sätze zählen zur Runde (Pflicht bzw. freie Runde „alle“).
  const repairs = !opts.only && (round === 'pflicht' || deck === 'all') ? pickDailyRepairs(live.docs['app/repair'], now, repairsDoneToday(entries), target) : [];
  const cardTarget = Math.max(0, target - repairs.length);
  const queue = opts.only
    ? opts.only
        .map((k) => byKey.get(k))
        .filter((c): c is TrainCard => !!c && !c.hidden)
        .map((c): QueueItem => ({ key: c.key, reason: c.isNew ? 'new' : 'due', phase: c.stage === 0 ? 'intro' : 'quiz' }))
    : buildQueue({ cards: round === 'extra' && deck !== 'all' ? cards.filter((c) => inDeck(c, deck)) : cards, nowMs: now, target: cardTarget, newQuotaLeft: round === 'extra' && deck !== 'all' ? 0 : newQuotaLeft, exclude: round === 'pflicht' ? reviewed : answeredToday, lang });
  const base: SessionState = {
    active: true,
    status: 'running',
    round,
    day,
    lang,
    env,
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
    repairs,
    repairPos: 0,
  };
  const next = { ...base, ...settle(base, 0) };
  if (next.pos >= next.queue.length && !repairs.length) next.status = 'summary';
  // H1: Pflichtrunde ohne abfragbare Karte (z. B. nach dem Neuladen) – „Wiederholen" ist erschöpft.
  if (round === 'pflicht' && target > 0 && next.status === 'summary') markExhausted(day);
  useSession.setState(next);
  if (repairs.length) return 'choice';
  const item = next.queue[next.pos];
  if (!item || next.status === 'summary') return null;
  if (item.phase === 'intro') return 'intro';
  return firstKindOf(next.exercise);
}

/** Aktueller Reparatur-Satz der Runde (vor den Karten), sonst `null`. */
export const currentRepair = (s: Pick<SessionState, 'status' | 'repairs' | 'repairPos'>): RepairItem | null => (s.status === 'running' ? (s.repairs[s.repairPos] ?? null) : null);

/** Ergebnis eines Reparatur-Satzes übernehmen (Protokoll, `app/repair`); weiter geht es mit `nextRepair`. */
export function answerRepair(ok: boolean, given: string, ms: number): void {
  touch();
  const s = useSession.getState();
  const r = currentRepair(s);
  if (!r) return;
  const key = `repair/${r.id}`;
  if (s.answered.includes(key)) return;
  commitRepairAnswer({ item: r, ok, given, ms, day: s.day, lang: s.lang, ctx: s.round === 'pflicht' ? 'rev' : 'xtra', first: s.results.length === 0 });
  useSession.setState({ answered: [...s.answered, key], results: [...s.results, { key, word: r.right.split(/\s+/).slice(0, 4).join(' ') + (r.right.split(/\s+/).length > 4 ? ' …' : ''), grade: ok ? 3 : 1, ok }] });
}

/** Zum nächsten Reparatur-Satz bzw. zu den Karten (oder zur Zusammenfassung). */
export function nextRepair(): FirstKind {
  touch();
  const s = useSession.getState();
  const repairPos = s.repairPos + 1;
  if (repairPos < s.repairs.length) {
    useSession.setState({ repairPos, step: s.step + 1 });
    return 'choice';
  }
  const next: SessionState = { ...s, repairPos, step: s.step + 1 };
  if (next.pos >= next.queue.length) {
    next.status = 'summary';
    finish(next, false);
  }
  useSession.setState(next);
  const item = next.queue[next.pos];
  if (!item || next.status === 'summary') return null;
  return item.phase === 'intro' ? 'intro' : firstKindOf(next.exercise);
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
  // Regel 1b: Die Pflichtrunde hatte nichts mehr abzufragen, obwohl das Ziel nicht erreicht ist.
  if (!aborted && s.round === 'pflicht' && s.doneBefore + new Set(s.answered).size < s.doneBefore + s.target) markExhausted(s.day);
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
  return item.phase === 'intro' ? 'intro' : firstKindOf(next.exercise);
}

export type Answer = { grade: Grade; given: string; ms: number; ok: boolean; override?: boolean };

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
    kind: card.kind === 'chunk' ? 'chunk' : 'v',
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
  if (card.kind === 'chunk') a.q = card.word;
  if (ans.override) a.override = true;

  // Lokal sofort weiterrechnen (optimistisch); gespeichert wird auf dem frischen Stand.
  const nextDoc = applyUpdate({ ...card.doc }, cardPatch({ ...card.doc }, a));
  const updated = (card.kind === 'chunk' ? toChunkCard(card.id, nextDoc, a.t) : toTrainCard(card.id, nextDoc, true, a.t)) ?? card;
  const cards = new Map(s.cards);
  cards.set(card.key, updated);
  void saveCard(a, card.inDb || card.kind === 'chunk' ? null : { ...card.doc });
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

