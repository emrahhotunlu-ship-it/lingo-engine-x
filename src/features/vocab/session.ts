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
import { chooseExercise, supports, type ExerciseEnv } from '../../domain/srs/modes';
import { againPos, calibration, controlAllowed, controlCounts, dirFor, pickMode, weekStartMs, type FlipDir, type PickedMode, type RequestedMode } from '../../domain/srs/flip';
import { deckCards, isBuiltinDeck, type DeckCtx } from '../../domain/srs/decks';
import { isThemeCard } from '../../domain/week/cards';
import type { WeekTheme } from '../../domain/week/types';
import { unitDone } from '../../app/unit/done';
import { clearResume } from '../../app/resume';
import { useDecks } from './decksStore';
import { cardGo } from './cardMark';
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
  /** Anki (anki-regeln.md): gewünschter Modus, Richtung der Aufdeck-Karten, Stapel. */
  mode: RequestedMode;
  dir: FlipDir;
  deck: string;
  /** Anzeige-Name der Runde (Stapel) für „Weiter, wo du warst“. */
  label: string | null;
  /** Kontrollen dieser Sitzung und (beim Start gezählt) dieser Woche/dieses Tages (§4). */
  controls: number;
  ctlWeek: number;
  ctlDay: number;
  /** Schwache Kalibrierung: strenge Leicht-Grenze (§4). */
  strict: boolean;
  /** Block 1 der Tageseinheit (Abschluss → `unitDone(1)`). */
  unit: boolean;
  /** Ausgewählte Karten (nur `only`): fürs Fortsetzen. */
  only: string[] | null;
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
  mode: 'type',
  dir: 'de-en',
  deck: 'all',
  label: null,
  controls: 0,
  ctlWeek: 0,
  ctlDay: 0,
  strict: false,
  unit: false,
  only: null,
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

type ExCtx = Pick<SessionState, 'cards' | 'pool' | 'lang' | 'day' | 'shown' | 'recentEx' | 'env' | 'mode' | 'dir' | 'controls' | 'ctlWeek' | 'ctlDay'>;

/** Modus je Karte nach anki-regeln §1 (`pickMode`, die Regel steht nur in domain/srs/flip.ts). */
export function modeFor(s: ExCtx, card: TrainCard, item: QueueItem): PickedMode {
  return pickMode({
    card,
    requested: s.mode,
    day: s.day,
    lang: s.lang,
    due: item.reason === 'due',
    controlAllowed: controlAllowed({ week: s.ctlWeek, day: s.ctlDay, session: s.controls }),
  });
}

function build(s: ExCtx, card: TrainCard, ex: ExerciseId): Exercise {
  return buildExercise(card, ex, s.lang, s.pool, `${s.day}|${s.shown[card.key] ?? 0}`, { sceneOf: sceneLookup(s.lang) });
}

function exerciseFor(s: ExCtx, item: QueueItem): Exercise | null {
  const card = s.cards.get(item.key);
  if (!card || item.phase !== 'quiz') return null;
  const hit = takePrebuilt(s, item);
  if (hit) return hit;
  const picked = modeFor(s, card, item);
  if (picked === 'flip') return { ...build(s, card, 'flip'), dir: dirFor(card.key, s.dir, s.day) };
  if (picked === 'control') {
    // Kontrolle (§4): frei im Ursprungssatz (`cloze`), ohne Satz `type`; die App bewertet.
    const n = s.pool.length - 1;
    const ex: ExerciseId | null = supports(card, 'cloze', s.lang, n, s.env) ? 'cloze' : supports(card, 'type', s.lang, n, s.env) ? 'type' : null;
    if (ex) return { ...build(s, card, ex), check: 'control' };
  }
  if (picked === 'probe') {
    // Prüfabfrage (§1 Regel 6): tippen mit Stütze, Leiter auf Stufe 3 (cloze_hint/tiles).
    const ex = chooseExercise({ ...card, stage: 3 }, s.lang, s.pool.length - 1, s.recentEx, s.env);
    if (ex) return { ...build(s, card, ex), check: 'probe' };
  }
  const ex = chooseExercise(card, s.lang, s.pool.length - 1, s.recentEx, s.env);
  if (!ex) return null;
  return build(s, card, ex);
}

// n+1 vorberechnen (leistung.md §4 Nr. 4): nach dem Prüfen im Leerlauf, beim „Weiter“ nur noch tauschen.
let prebuilt: { sig: string; ex: Exercise } | null = null;
const sigOf = (s: ExCtx, item: QueueItem, recent: readonly ExerciseId[]) => `${item.key}|${s.shown[item.key] ?? 0}|${recent.join(',')}|${s.controls}|${s.mode}|${s.dir}|${s.day}`;

function takePrebuilt(s: ExCtx, item: QueueItem): Exercise | null {
  const p = prebuilt;
  prebuilt = null;
  if (!p || p.sig !== sigOf(s, item, s.recentEx)) return null;
  return p.ex.card === s.cards.get(item.key) ? p.ex : null;
}

/** Nächste Karte vorbereiten (aus der Übung nach dem Prüfen, im Leerlauf). Rein lesend. */
export function prepareNext(): void {
  const s = useSession.getState();
  if (!s.active || s.status !== 'running' || !s.exercise) return;
  const item = s.queue[s.pos + 1];
  if (!item || item.phase !== 'quiz' || item.key === s.exercise.card.key) return;
  const recent = [...s.recentEx, s.exercise.ex].slice(-2);
  const ctx: ExCtx = { ...s, recentEx: recent };
  prebuilt = null;
  const ex = exerciseFor(ctx, item);
  if (ex) prebuilt = { sig: sigOf(ctx, item, recent), ex };
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

/** Karte im Aufdecken-Modus? */
export const isFlip = (e: Exercise | null): boolean => e?.ex === 'flip';

/**
 * Optionen der Runde. `deck`: `all`, ein eingebauter Stapel (`hard`, `job`, `phrases`, `inbox` …)
 * oder die Kennung eines eigenen Stapels (`app/decks`). `only` = genau diese Karten („Jetzt üben“).
 * `pick` = zeitweilige Auswahl (Blatt Extra-Runde, kein neues Dokument). `mode`/`dir` wie anki-regeln
 * §1/§8; ohne Angabe gilt der gemerkte Modus des Stapels bzw. der Standard-Modus.
 */
export type SessionOpts = {
  deck?: string;
  size?: number;
  only?: readonly string[];
  mode?: RequestedMode;
  dir?: FlipDir;
  pick?: (c: TrainCard) => boolean;
  /** Neue Karten (aus dem Rest-Kontingent) zulassen – Standard: ja, außer bei `pick`. */
  allowNew?: boolean;
  label?: string;
  /** Block 1 der Tageseinheit. */
  unit?: boolean;
  /** Wochenthema (Block 1: Themenkarten zuerst; Korb-Stufe 4). */
  theme?: WeekTheme | null;
};

/** Modus und Richtung ohne ausdrückliche Angabe: Stapel-Merker, sonst Standard (Einstellungen „Wortschatz“). */
export function defaultsFor(round: Round, deck: string): { mode: RequestedMode; dir: FlipDir } {
  const d = useDecks.getState().decks;
  const std = d.prefs.mode;
  // Tageseinheit und „Alle fälligen“: immer Deutsch → Englisch (§8), Modus `auto` bzw. der Standard.
  if (round === 'pflicht' || deck === 'all') return { mode: std ?? 'auto', dir: 'de-en' };
  const own = isBuiltinDeck(deck) ? d.builtin[deck] : d.decks[deck];
  // Stapel: gemerkter Modus, sonst Aufdecken (Emrahs Wunsch); ist der Standard „Tippen“, gilt er auch hier.
  return { mode: own?.mode ?? (std === 'type' ? 'type' : 'flip'), dir: own?.dir ?? d.prefs.dir ?? 'de-en' };
}

/** Runde bauen (synchron). Rückgabe: Art der ersten Übung (für den Fokus im selben Handler). */
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
  const defaults = defaultsFor(round, deck);
  const mode = opts.mode ?? defaults.mode;
  // §8: Tageseinheit und „Alle fälligen“ immer Deutsch → Englisch.
  const dir: FlipDir = round === 'pflicht' || deck === 'all' ? 'de-en' : (opts.dir ?? defaults.dir);
  const theme = opts.theme ?? null;
  const isTheme = theme ? (c: TrainCard) => isThemeCard(c, theme) : undefined;
  const ctx: DeckCtx = { nowMs: now, weekStartMs: weekStartMs(now), isTheme };
  // Lernberatung V2: fällige Reparatur-Sätze zählen zur Runde (Pflicht bzw. freie Runde „alle“).
  const repairs = !opts.only && !opts.pick && (round === 'pflicht' || deck === 'all') ? pickDailyRepairs(live.docs['app/repair'], now, repairsDoneToday(entries), target) : [];
  const cardTarget = Math.max(0, target - repairs.length);
  const deckPool = round === 'extra' && deck !== 'all' ? deckCards(cards, deck, useDecks.getState().decks, ctx) : cards;
  const chosen = opts.pick ? deckPool.filter(opts.pick) : deckPool;
  // anki-regeln §5: EIN Kontingent für alle Wege; Stapel bekommen neue Karten aus dem Rest, nur passende.
  const allowNew = opts.allowNew ?? !opts.pick;
  const queue = opts.only
    ? opts.only
        .map((k) => byKey.get(k))
        .filter((c): c is TrainCard => !!c && !c.hidden)
        .map((c): QueueItem => ({ key: c.key, reason: c.isNew ? 'new' : 'due', phase: c.stage === 0 ? 'intro' : 'quiz' }))
    : buildQueue({ cards: chosen, nowMs: now, target: cardTarget, newQuotaLeft: allowNew ? newQuotaLeft : 0, exclude: round === 'pflicht' ? reviewed : answeredToday, lang, isTheme });
  const docs = pool.map((c) => c.doc);
  const ctl = mode === 'flip' ? controlCounts(docs, now) : { week: 0, day: 0 };
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
    mode,
    dir,
    deck,
    label: opts.label ?? null,
    controls: 0,
    ctlWeek: ctl.week,
    ctlDay: ctl.day,
    strict: mode !== 'type' && calibration(docs, now).strict,
    unit: opts.unit === true,
    only: opts.only ? [...opts.only] : null,
  };
  prebuilt = null;
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
/**
 * Fortschritt „n von gesamt“ (Emrahs Befund 27.09.: „15/15 erledigt, trotzdem weitere Fragen“).
 * Gesamt ist nie kleiner als das, was wirklich noch kommt: Reparatur-Sätze und wieder eingereihte
 * Karten („Nochmal“) zählen mit. n = gesamt − noch offen + 1, solange die Runde läuft.
 */
export function roundProgress(s: Pick<SessionState, 'status' | 'round' | 'queue' | 'pos' | 'target' | 'doneBefore' | 'answered' | 'repairs' | 'repairPos'>): { n: number; total: number } | null {
  if (s.status !== 'running') return null;
  const base = s.round === 'pflicht' ? s.doneBefore : 0;
  const left = Math.max(0, s.queue.length - s.pos) + Math.max(0, s.repairs.length - s.repairPos);
  const done = base + s.answered.length;
  const total = Math.max(base + s.target, done + left);
  if (total <= 0) return null;
  return { n: Math.min(total, Math.max(1, total - left + 1)), total };
}

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

export const TRAINER_RESUME_ID = 'trainer';

function finish(s: SessionState, aborted: boolean): void {
  const n = s.results.length;
  // Reguläres Ende löscht die Momentaufnahme; ✕ behält sie (architektur.md §3.2).
  if (!aborted) clearResume(TRAINER_RESUME_ID);
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
  if (!aborted && s.unit) unitDone(1);
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

export type Answer = {
  grade: Grade;
  given: string;
  ms: number;
  ok: boolean;
  override?: boolean;
  /** Aufdecken: beim Aufdecken reservierter Zeitstempel (gleich für Vorschau und Speichern, architektur.md §4.3). */
  t?: number;
};

/** Bewertete Antwort übernehmen: Karte sofort speichern, Protokoll und Zähler vormerken, weiter. */
export function commitAnswer(ans: Answer): FirstKind {
  touch();
  cardGo();
  const s = useSession.getState();
  const e = s.exercise;
  const item = s.queue[s.pos];
  if (!e || !item) return null;
  const card = e.card;
  const a: AnswerEvent = {
    t: ans.t ?? nextT(),
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
  // anki-regeln §2: Aufdecken nach 5 anderen Karten (pos + 6), Tippen nach 3 (pos + 4).
  if (again) queue.splice(againPos(s.pos, queue.length, e.ex === 'flip'), 0, { key: card.key, reason: 'again', phase: 'quiz' });
  const control = e.check === 'control' ? 1 : 0;
  const answered = s.answered.includes(card.key) ? s.answered : [...s.answered, card.key];
  return advanceFrom({
    ...s,
    cards,
    queue,
    shown,
    answered,
    controls: s.controls + control,
    ctlDay: s.ctlDay + control,
    ctlWeek: s.ctlWeek + control,
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


/**
 * Karte ohne Bewertung überspringen (Fehlergrenze „Diese Aufgabe überspringen“, architektur.md §3.1):
 * nichts wird geschrieben, die Runde läuft mit der nächsten Karte weiter.
 */
export function skipCurrent(): FirstKind {
  const s = useSession.getState();
  if (!s.active || s.status !== 'running') return null;
  if (currentRepair(s)) return nextRepair();
  return advanceFrom(s);
}

// ------------------------------------------------------------------ Fortsetzen (architektur.md §3.2)

export type TrainerSnapshot = {
  round: Round;
  mode: RequestedMode;
  dir: FlipDir;
  deck: string;
  label: string | null;
  day: string;
  /** Zeitpunkt der Momentaufnahme: Karten mit `last` ≥ `at` gelten als inzwischen beantwortet. */
  at: number;
  queue: QueueItem[];
  pos: number;
  shown: Record<string, number>;
  answered: string[];
  results: ResultRow[];
  repairs: string[];
  repairPos: number;
  target: number;
  doneBefore: number;
  unit: boolean;
  controls: number;
};

const RESULTS_MAX = 100;

/** Reiner Lesezugriff (JSON, nur Schlüssel und Positionen – nie Karteninhalte). */
export function trainerSnapshot(): TrainerSnapshot | null {
  const s = useSession.getState();
  if (!s.active || s.status !== 'running') return null;
  return {
    round: s.round,
    mode: s.mode,
    dir: s.dir,
    deck: s.deck,
    label: s.label,
    day: s.day,
    at: Date.now(),
    queue: s.queue.map((q) => ({ key: q.key, reason: q.reason, phase: q.phase })),
    pos: s.pos,
    shown: s.shown,
    answered: s.answered,
    results: s.results.slice(-RESULTS_MAX),
    repairs: s.repairs.map((r) => r.id),
    repairPos: s.repairPos,
    target: s.target,
    doneBefore: s.doneBefore,
    unit: s.unit,
    controls: s.controls,
  };
}

const lastOf = (c: TrainCard): number => (typeof c.doc.last === 'number' ? c.doc.last : 0);

/**
 * Sitzung SYNCHRON herstellen (Klick-Handler, iPhone-Tastatur); schreibt nie in die db. Karten werden
 * aus den Live-Daten neu gebaut. Übersprungen: fehlende Karten und offene Karten, die seit der
 * Momentaufnahme beantwortet wurden (`last` ≥ `at`). Ein offener Prüf-Zustand wird nicht nachgebaut.
 */
export function restoreTrainer(snap: TrainerSnapshot): boolean {
  if (!snap || !Array.isArray(snap.queue) || typeof snap.pos !== 'number') return false;
  const now = useClock.getState().now;
  const day = dayKey(Date.now());
  if (snap.day !== day) return false;
  const cards = allTrainCards(now);
  const byKey = new Map(cards.map((c) => [c.key, c]));
  const pool = cards.filter((c) => !c.hidden);
  const live = useLive.getState();
  const repairsAll = pickDailyRepairs(live.docs['app/repair'], now, new Set(), 50);
  const repairs = (snap.repairs ?? []).map((id) => repairsAll.find((r) => r.id === id)).filter((r): r is RepairItem => !!r);
  const keep = snap.queue.map((q, i) => {
    const c = byKey.get(q.key);
    if (!c || c.hidden) return false;
    return !(i >= snap.pos && lastOf(c) >= snap.at);
  });
  const queue = snap.queue.filter((_, i) => keep[i]);
  const removedBefore = keep.slice(0, snap.pos).filter((k) => !k).length;
  const pos = Math.max(0, Math.min(queue.length, snap.pos - removedBefore));
  const docs = pool.map((c) => c.doc);
  const ctl = snap.mode === 'flip' ? controlCounts(docs, now) : { week: 0, day: 0 };
  const base: SessionState = {
    active: true,
    status: 'running',
    round: snap.round,
    day,
    lang: useSettings.getState().lang,
    env: currentEnv(),
    cards: byKey,
    pool,
    queue,
    pos,
    exercise: null,
    step: useSession.getState().step,
    shown: snap.shown ?? {},
    recentEx: [],
    answered: snap.answered ?? [],
    results: snap.results ?? [],
    target: snap.target,
    doneBefore: snap.doneBefore,
    // Nur die neuen aktiven Minuten zählen (§3.2).
    activeMs: 0,
    lastInteract: performance.now(),
    repairs,
    repairPos: Math.min(snap.repairPos ?? 0, repairs.length),
    mode: snap.mode,
    dir: snap.dir,
    deck: snap.deck,
    label: snap.label,
    controls: snap.controls ?? 0,
    ctlWeek: ctl.week,
    ctlDay: ctl.day,
    strict: snap.mode !== 'type' && calibration(docs, now).strict,
    unit: snap.unit === true,
    only: null,
  };
  prebuilt = null;
  const next = { ...base, ...settle(base, pos) };
  if (next.pos >= next.queue.length && next.repairPos >= repairs.length) return false;
  useSession.setState(next);
  return true;
}
