import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { invalidIdsOf, useLive } from '../../data/live';
import { dayKey } from '../../domain/date';
import { mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import { applyUpdate, cardPatch, contrastMissOp } from '../../domain/srs/applyReview';
import { buildTrainCards } from '../../domain/metrics';
import { toTrainCard } from '../../domain/srs/cards';
import { buildChunkCards, toChunkCard } from '../../domain/srs/chunkCards';
import { buildExercise, type SceneLookup } from '../../domain/srs/exercise';
import { sentKey } from '../../domain/srs/variety';
import { chooseExercise, makeEnv, NO_ENV, supports, type ExerciseEnv } from '../../domain/srs/modes';
import { inputProfile } from '../../platform/input';
import { knownOp } from '../../domain/srs/vocabList';
import { catchUpOn, overdueCount } from '../../domain/unit/backlog';
import { againPos, calibration, controlAllowed, controlCounts, dirFor, lastRating, pickMode, weekStartMs, type FlipDir, type PickedMode, type RequestedMode } from '../../domain/srs/flip';
import { deckCards, isBuiltinDeck, type DeckCtx } from '../../domain/srs/decks';
import { listenExercise } from '../../domain/srs/listen';
import { REPAIR_MAX } from '../../domain/unit/block1';
import { unitDone } from '../../app/unit/done';
import { unitStepArgs } from '../../domain/unit/plan';
import { clearResume } from '../../app/resume';
import { useDecks } from './decksStore';
import { cardGo } from './cardMark';
import { entryCardKey } from '../../domain/progress/logPatch';
import { sceneView } from '../../domain/speak/library';
import { selectAiAvailable } from '../../ai/scope';
import { useCapabilities } from '../../platform/capabilities';
import { useSpeech } from '../../platform/speech';
import { useWatched } from '../../data/watch';
import { legacySceneDoc } from '../../domain/chunks/legacyScene';
import { buildQueue, mixIntroducedToday, newQuotaLeft as newQuotaLeftFor } from '../../domain/srs/queue';
import { isLearningState } from '../../domain/srs/scheduler';
import type { AnswerEvent, Exercise, ExerciseId, Grade, Lang, QueueItem, TrainCard } from '../../domain/srs/types';
import { markExhausted, useTodayPlan } from '../today/store';
import { nextT, recordAnswer, recordRoundEnd, saveCard, saveContrastMiss, saveKnown, usePending } from './persist';
import { flushOnHide } from '../progress/persist';
import { pickDailyRepairs, repairsDoneToday, repairsDutyToday } from '../../domain/repair/daily';
import type { RepairItem } from '../../domain/repair/repair';
import { commitRepairAnswer } from '../repair/review';
import { contrastReady, noteConfusion, requestWordCtx } from './wordCtx';

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
  /** Aufholmodus dieser Runde (viele überfällige Karten, Modus `auto`). */
  catchUp: boolean;
  /** Eigene Sätze (`produce`) in dieser Runde (Deckel `PRODUCE_MAX`). */
  produced: number;
  /** P52: „Welches Wort passt?“ (Kontrast) kam in dieser Runde schon (höchstens 1 je Runde). */
  contrasted: boolean;
};

const EXTRA_TARGET = 10;
const AGAIN_WINDOW_MS = 20 * 60_000;
const MAX_SHOWN = 3;
/** Eigene Sätze je Runde (teuerste Übung). */
const PRODUCE_MAX = 2;
/** Wartung reifer Karten: ab dieser Stabilität (Tage) und nur jede so vielte Wiederholung in voller Form. */
const MAINTENANCE_S = 21;
const MAINTENANCE_EVERY = 3;
const IDLE_CAP_MS = 60_000;
const ROUND_MIN = 10;

export const useSession = create<SessionState>(() => ({
  active: false,
  status: 'running',
  round: 'pflicht',
  day: '',
  lang: 'de',
  env: NO_ENV,
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
  catchUp: false,
  produced: 0,
  contrasted: false,
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
  // Das Eingabeprofil wird je Runde einmal gelesen und mit der Runde eingefroren (Lernplattform 2.0 §4.1).
  return makeEnv(useSpeech.getState().status === 'ready', selectAiAvailable(useCapabilities.getState()), inputProfile() === 'touch');
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

type ExCtx = Pick<SessionState, 'cards' | 'pool' | 'lang' | 'day' | 'shown' | 'recentEx' | 'env' | 'mode' | 'dir' | 'controls' | 'ctlWeek' | 'ctlDay' | 'catchUp' | 'produced' | 'contrasted'>;

/** Modus je Karte nach anki-regeln §1 (`pickMode`, die Regel steht nur in domain/srs/flip.ts). */
export function modeFor(s: ExCtx, card: TrainCard, item: QueueItem): PickedMode {
  return pickMode({
    card,
    requested: s.mode,
    day: s.day,
    lang: s.lang,
    due: item.reason === 'due',
    controlAllowed: controlAllowed({ week: s.ctlWeek, day: s.ctlDay, session: s.controls }),
    catchUp: s.catchUp && s.mode === 'auto',
    key: card.key,
  });
}

/** `origin`: Prüfabfrage und Kontrolle bleiben beim Ursprungssatz (sonst wechselt der Satz ab Stufe 3, `domain/srs/rotate.ts`). */
function build(s: ExCtx, card: TrainCard, ex: ExerciseId, origin = false): Exercise {
  return buildExercise(card, ex, s.lang, s.pool, `${s.day}|${s.shown[card.key] ?? 0}`, { sceneOf: sceneLookup(s.lang), origin });
}

function exerciseFor(s: ExCtx, item: QueueItem): Exercise | null {
  const card = s.cards.get(item.key);
  if (!card || item.phase !== 'quiz') return null;
  // P52: „Welches Wort passt?“ steht als eigener Schritt direkt nach der regulären Abfrage (nur, solange der Kontrast noch möglich ist).
  if (item.reason === 'contrast') return contrastReady(card, s.pool) ? build(s, card, 'contrast') : null;
  const hit = takePrebuilt(s, item);
  if (hit) return hit;
  // N35 Hör-Modus: die Sprachausgabe spricht, getippt wird in die Lücke (sonst die Leiter).
  if (s.mode === 'listen') {
    const lx = listenExercise(card, s.lang, s.pool.length - 1, s.env);
    if (lx) return build(s, card, lx);
  }
  const picked = modeFor(s, card, item);
  if (picked === 'flip') return { ...build(s, card, 'flip'), dir: dirFor(card.key, s.dir, s.day) };
  if (picked === 'control') {
    // Kontrolle (§4): frei im Ursprungssatz (`cloze`), ohne Satz `type`; die App bewertet.
    const n = s.pool.length - 1;
    const ex: ExerciseId | null = supports(card, 'cloze', s.lang, n, s.env) ? 'cloze' : supports(card, 'type', s.lang, n, s.env) ? 'type' : null;
    if (ex) return { ...build(s, card, ex, true), check: 'control' };
  }
  if (picked === 'probe') {
    // Prüfabfrage (§1 Regel 6): tippen mit Stütze, Leiter auf Stufe 3 (cloze_hint/tiles).
    const ex = chooseExercise({ ...card, stage: 3 }, s.lang, s.pool.length - 1, s.recentEx, s.env);
    if (ex) return { ...build(s, card, ex, true), check: 'probe' };
  }
  const lighter = item.reason === 'due' ? lighterExercise(s, card) : null;
  if (lighter) return build(s, card, lighter);
  const ex = chooseExercise(card, s.lang, s.pool.length - 1, s.recentEx, s.env);
  if (!ex) return null;
  if (ex === 'produce' && s.produced >= PRODUCE_MAX) {
    const other = chooseExercise({ ...card, stage: 4 }, s.lang, s.pool.length - 1, s.recentEx, s.env);
    if (other && FREE_TYPED.has(other)) return build(s, card, other);
  }
  return build(s, card, ex);
}

/** Frei getippte Arten (Stufe 4) – ohne Auswahl und ohne Stütze. */
const FREE_TYPED: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['type', 'cloze', 'situation']);

/**
 * Billigere, aber gleichwertige Abfrage in zwei Fällen (Methodenplan Lernwissenschaft 02.10.2026), nur im Modus `auto`:
 * - L5: Nach einer bestandenen Stützen-Abfrage an einem früheren Tag (Stufe 3, Lücke mit Hilfe oder Bausteine) kommt der nächste
 *   getippte Termin FREI (ohne Anfangsbuchstaben) – sonst läuft Stufe 3 zweimal mit Hilfe und der erste freie Abruf käme erst am 4. Termin.
 * - L4: Reife Karten (Stufe 5, Stabilität ≥ 21 Tage) bekommen die volle „Sicher anwenden“-Form nur bei jeder dritten Wiederholung;
 *   sonst genügt freies Tippen (Stufe 4).
 */
function lighterExercise(s: ExCtx, card: TrainCard): ExerciseId | null {
  if (s.mode !== 'auto') return null;
  const n = s.pool.length - 1;
  const freeOne = (): ExerciseId | null => {
    const ex = chooseExercise({ ...card, stage: 4 }, s.lang, n, s.recentEx, s.env);
    return ex && FREE_TYPED.has(ex) ? ex : null;
  };
  if (card.stage === 3) {
    const last = lastRating(card.doc);
    if (last && (last.x === 'cloze_hint' || last.x === 'tiles') && (last.g ?? 0) >= 3 && dayKey(last.t) !== s.day) return freeOne();
  }
  const reps = typeof card.doc.reps === 'number' ? card.doc.reps : 0;
  if (card.stage >= 5 && card.fsrs.stability >= MAINTENANCE_S && reps % MAINTENANCE_EVERY !== 0) return freeOne();
  return null;
}

// n+1 vorberechnen (leistung.md §4 Nr. 4): nach dem Prüfen im Leerlauf, beim „Weiter“ nur noch tauschen.
let prebuilt: { sig: string; ex: Exercise } | null = null;
const sigOf = (s: ExCtx, item: QueueItem, recent: readonly ExerciseId[]) => `${item.key}|${s.shown[item.key] ?? 0}|${recent.join(',')}|${s.controls}|${s.mode}|${s.dir}|${s.day}|${s.contrasted ? 1 : 0}`;

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
  const ctx: ExCtx = { ...s, recentEx: recent, produced: s.produced + (s.exercise.ex === 'produce' ? 1 : 0), contrasted: s.contrasted || s.exercise.ex === 'contrast' };
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
  commitHeld();
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
  const ctx: DeckCtx = { nowMs: now, weekStartMs: weekStartMs(now) };
  // Lernberatung V2: fällige Reparatur-Sätze zählen zur Runde (Pflicht bzw. freie Runde „alle“).
  // Lernplattform 2.0 §2.3: Im Plan der Regelversion 2 steht Schritt 1 für Karten allein (`repairs: 0`); die Fehlersätze
  // gehören dann in Schritt 4. Ohne Argument im Plan gilt die alte Regel (bis zu 3 Reparatur-Sätze).
  const repairMax = round === 'pflicht' ? (unitStepArgs(plan, 1).repairs ?? REPAIR_MAX) : REPAIR_MAX;
  const repairs = !opts.only && !opts.pick && (round === 'pflicht' || deck === 'all') && repairMax > 0 ? pickDailyRepairs(live.docs['app/repair'], now, repairsDoneToday(entries), Math.min(target, repairMax), repairsDutyToday(entries)) : [];
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
    : buildQueue({ cards: chosen, nowMs: now, target: cardTarget, newQuotaLeft: allowNew ? newQuotaLeft : 0, exclude: round === 'pflicht' ? reviewed : answeredToday, lang, mix: { introduced: mixIntroducedToday(cards, day), phrases: introducedToday - introducedLessonToday + newQuotaLeft <= 2 ? 1 : 2 } });
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
    catchUp: mode === 'auto' && catchUpOn(overdueCount(pool, now)),
    produced: 0,
    contrasted: false,
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
 * Fortschritt „n / gesamt“ (R4: Nenner fest, Zähler nur vorwärts). Gesamt ist die geplante Runde (`doneBefore + target`)
 * und wächst nie. Karten, die wegen „Nochmal“ wieder eingereiht werden, und Reparatur-Sätze darüber hinaus zählen
 * getrennt als `extra` („+2“); `extra` steigt nur. n zählt die verschiedenen schon beantworteten Einträge der geplanten Runde.
 */
export function roundProgress(s: Pick<SessionState, 'status' | 'round' | 'queue' | 'pos' | 'target' | 'doneBefore' | 'answered' | 'repairs' | 'repairPos'>): { n: number; total: number; extra: number } | null {
  if (s.status !== 'running') return null;
  const base = s.round === 'pflicht' ? s.doneBefore : 0;
  // Der Kontrast-Schritt (P52) ist ein Zusatz zur schon beantworteten Karte: er zählt weder vorwärts noch als „+1“.
  const left = s.queue.slice(Math.max(0, s.pos)).filter((q) => q.reason !== 'contrast').length + Math.max(0, s.repairs.length - s.repairPos);
  const onContrast = s.queue[s.pos]?.reason === 'contrast';
  const done = base + s.answered.length;
  const planned = base + s.target;
  const total = Math.max(planned, 1);
  if (planned <= 0 && done + left <= 0) return null;
  const extra = Math.max(0, done + left - planned);
  const distinct = base + new Set(s.answered).size;
  return { n: Math.min(total, Math.max(1, distinct + (onContrast ? 0 : 1))), total: Math.max(total, 1), extra };
}

export const currentRepair = (s: Pick<SessionState, 'status' | 'repairs' | 'repairPos'>): RepairItem | null => (s.status === 'running' ? (s.repairs[s.repairPos] ?? null) : null);

/** Ergebnis eines Reparatur-Satzes übernehmen (Protokoll, `app/repair`); weiter geht es mit `nextRepair`. */
export function answerRepair(ok: boolean, given: string, ms: number, near = false): void {
  touch();
  const s = useSession.getState();
  const r = currentRepair(s);
  if (!r) return;
  const key = `repair/${r.id}`;
  if (s.answered.includes(key)) return;
  commitRepairAnswer({ item: r, ok, near, given, ms, day: s.day, lang: s.lang, ctx: s.round === 'pflicht' ? 'rev' : 'xtra', first: s.results.length === 0 });
  useSession.setState({ answered: [...s.answered, key], results: [...s.results, { key, word: r.right.split(/\s+/).slice(0, 4).join(' ') + (r.right.split(/\s+/).length > 4 ? ' …' : ''), grade: near ? 2 : ok ? 3 : 1, ok }] });
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
  // P52: Wörter-Tutor im Hintergrund (höchstens 1 Aufruf je Tag, nie im Aufholmodus; still bei Fehlern).
  if (n > 0) requestWordCtx({ answered: s.answered, cards: s.cards, pool: s.pool, catchUp: s.catchUp });
}

/** Einführung einer neuen Karte gesehen: die erste Abfrage folgt zwei Karten später. */
export function continueIntro(): FirstKind {
  touch();
  commitHeld();
  const s = useSession.getState();
  const item = s.queue[s.pos];
  if (!item) return null;
  const queue = [...s.queue];
  queue.splice(Math.min(queue.length, s.pos + 3), 0, { key: item.key, reason: item.reason, phase: 'quiz' });
  return advanceFrom({ ...s, queue });
}

/**
 * „Kenne ich“ in der Einführung (Lernplattform 2.0 §4.8): keine Behauptung, sondern eine Prüffrage – frei tippen im Ursprungssatz
 * (am Handy mit Buchstaben-Platzhaltern). Richtig ohne Hilfe → `commitAnswer` schreibt Stufe 3 / 10 Tage / `m:'known'`; sonst
 * zählt die Antwort wie jede andere. Die Einführungskarte wird dafür durch die Prüffrage ersetzt.
 */
export function startKnownProbe(): FirstKind {
  touch();
  commitHeld();
  const s = useSession.getState();
  const item = s.queue[s.pos];
  const card = item ? s.cards.get(item.key) : null;
  if (!item || !card) return null;
  const n = s.pool.length - 1;
  const ex: ExerciseId | null = supports(card, 'cloze', s.lang, n, s.env) ? 'cloze' : supports(card, 'type', s.lang, n, s.env) ? 'type' : null;
  if (!ex) return continueIntro();
  const queue = [...s.queue];
  queue[s.pos] = { ...item, phase: 'quiz' };
  const exercise: Exercise = { ...build({ ...s, queue } as ExCtx, card, ex, true), check: 'known' };
  prebuilt = null;
  useSession.setState({ queue, exercise, step: s.step + 1 });
  return firstKindOf(exercise);
}

/** Nächster Zustand ohne Seiteneffekte (Ende → `summary`). */
function advanceState(s: SessionState): SessionState {
  const next = { ...s, ...settle(s, s.pos + 1) };
  if (next.pos >= next.queue.length) next.status = 'summary';
  return next;
}

/** Zustand übernehmen; am Rundenende `finish`. */
function applyAdvance(next: SessionState): FirstKind {
  if (next.status === 'summary') finish(next, false);
  useSession.setState(next);
  const item = next.queue[next.pos];
  if (!item || next.status === 'summary') return null;
  return item.phase === 'intro' ? 'intro' : firstKindOf(next.exercise);
}

function advanceFrom(s: SessionState): FirstKind {
  return applyAdvance(advanceState(s));
}

export type Answer = {
  grade: Grade;
  given: string;
  ms: number;
  ok: boolean;
  override?: boolean;
  /** Genutzte Hilfe der Antwort (`weight.ts`). */
  hint?: 0 | 1 | 2;
  /** Aufdecken: beim Aufdecken reservierter Zeitstempel (gleich für Vorschau und Speichern, architektur.md §4.3). */
  t?: number;
};

/** Bewertete Antwort übernehmen: Karte sofort speichern, Protokoll und Zähler vormerken, weiter. */
export function commitAnswer(ans: Answer): FirstKind {
  touch();
  cardGo();
  // B4: eine zurückgehaltene Aufdeck-Bewertung gilt, sobald die nächste Antwort kommt.
  commitHeld();
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
  if ((e.ex === 'colloc' || e.ex === 'colloc_gap') && e.colloc && e.colloc.index >= 0) a.colIndex = e.colloc.index;
  a.dev = s.env.touch ? 't' : 'k';
  if (e.sentence?.sentence) a.sx = sentKey(e.sentence.sentence);
  if (card.kind === 'chunk') a.q = card.word;
  if (ans.override) a.override = true;
  if (ans.hint) a.hint = ans.hint;
  if (e.check === 'control' || e.check === 'probe') a.check = e.check;
  // „Kenne ich“: richtig ohne Hilfe → die Karte bekommt Stufe 3 und 10 Tage statt der gewöhnlichen Planung.
  const knownPass = e.check === 'known' && ans.ok && !ans.hint && !ans.override && card.kind === 'vocab';
  if (e.ex === 'flip' && s.catchUp && card.stage >= 3) a.catchUp = true;
  // P52: getippte falsche Antwort = Wort einer anderen eigenen Karte → Verwechslung für den Wörter-Tutor merken.
  if (!ans.ok && e.input === 'typed' && ans.given.trim()) noteConfusion(card, ans.given, s.pool);

  // P52 „Welches Wort passt?“: ein zusätzlicher Schritt, der NUR protokolliert. Die Planung (FSRS, S, D, due, lapses, stage) bleibt, wie die reguläre
  // Abfrage sie gesetzt hat; die Karte wird nie als „Nochmal“ eingereiht. Kartenwort gewählt → zusätzlich ein reiner Verlaufseintrag
  // `{x: 'contrast', g: 1}`, der für „schwach“ (Fehler der letzten 14 Tage) zählt.
  if (e.ex === 'contrast') {
    if (!ans.ok) a.grade = 1;
    recordAnswer(a, s.results.length === 0);
    const missOp = ans.ok ? null : contrastMissOp(card.path, card.doc, a);
    let cards = s.cards;
    if (missOp) {
      const missDoc = applyUpdate({ ...card.doc }, missOp.update);
      const upd = (card.kind === 'chunk' ? toChunkCard(card.id, missDoc, a.t) : toTrainCard(card.id, missDoc, card.inDb, a.t)) ?? card;
      cards = new Map(s.cards);
      cards.set(card.key, upd);
    }
    if (!ans.ok) void saveContrastMiss(card.path, a);
    return applyAdvance(
      advanceState({
        ...s,
        cards,
        recentEx: [...s.recentEx, e.ex].slice(-2),
        contrasted: true,
        results: [...s.results, { key: card.key, word: card.word, grade: a.grade, ok: ans.ok }],
      }),
    );
  }

  // Lokal sofort weiterrechnen (optimistisch); gespeichert wird auf dem frischen Stand.
  const knownDoc = knownPass ? knownOp({ ...card.doc }, card.path, null, a.t, s.day) : null;
  const nextDoc = knownDoc && 'update' in knownDoc ? applyUpdate({ ...card.doc }, knownDoc.update) : applyUpdate({ ...card.doc }, cardPatch({ ...card.doc }, a));
  const updated = (card.kind === 'chunk' ? toChunkCard(card.id, nextDoc, a.t) : toTrainCard(card.id, nextDoc, true, a.t)) ?? card;
  const cards = new Map(s.cards);
  cards.set(card.key, updated);
  const seed = card.inDb || card.kind === 'chunk' ? null : { ...card.doc };
  const immediate = s.results.length === 0;

  const shown = { ...s.shown, [card.key]: (s.shown[card.key] ?? 0) + 1 };
  const queue = [...s.queue];
  const again = isLearningState(updated.fsrs) && updated.fsrs.due - a.t <= AGAIN_WINDOW_MS && (shown[card.key] ?? 0) < MAX_SHOWN;
  // anki-regeln §2: Aufdecken nach 5 anderen Karten (pos + 6), Tippen nach 3 (pos + 4).
  if (again) queue.splice(againPos(s.pos, queue.length, e.ex === 'flip', ans.grade >= 3), 0, { key: card.key, reason: 'again', phase: 'quiz' });
  // P52: Kontrast ZUSÄTZLICH direkt nach der regulären Abfrage (die reguläre Abfrage benotet die Karte wie immer), nur wenn sie richtig war,
  // höchstens 1 je Runde, nie bei neuen Karten, im Anki- oder Hör-Modus und nicht nach Kontrolle/Prüfabfrage; beide Karten mindestens Stufe 2.
  const addContrast = ans.ok && !s.contrasted && e.ex !== 'flip' && !e.check && item.reason !== 'new' && s.mode !== 'listen' && contrastReady(updated, s.pool);
  if (addContrast) queue.splice(s.pos + 1, 0, { key: card.key, reason: 'contrast', phase: 'quiz' });
  const control = e.check === 'control' ? 1 : 0;
  const answered = s.answered.includes(card.key) ? s.answered : [...s.answered, card.key];
  const next = advanceState({
    ...s,
    cards,
    queue,
    shown,
    answered,
    controls: s.controls + control,
    ctlDay: s.ctlDay + control,
    ctlWeek: s.ctlWeek + control,
    recentEx: [...s.recentEx, e.ex].slice(-2),
    produced: s.produced + (e.ex === 'produce' ? 1 : 0),
    contrasted: s.contrasted || addContrast,
    results: [...s.results, { key: card.key, word: card.word, grade: ans.grade, ok: ans.ok }],
  });
  // B4: Aufdecken-Bewertungen 5 s zurückhalten (Karte, Protokoll, Zähler), solange die Runde
  // weiterläuft. Die letzte Antwort einer Runde gilt sofort: Rundenende, Pflicht, act/Serie und der
  // Einheits-Ablauf bleiben so unverändert (keine zurückgenommenen Zähler, die nie sinken dürfen).
  if (e.ex === 'flip' && next.status !== 'summary') {
    holdAnswer({ a, seed, immediate, before: s, step: next.step, word: card.word });
    return applyAdvance(next);
  }
  if (knownPass) void saveKnown(card.path, s.day, seed);
  else void saveCard(a, seed);
  recordAnswer(a, immediate);
  return applyAdvance(next);
}

// ------------------------------------------------------------------ Rückgängig (B4, markt AN2)

/** So lange bleibt eine Aufdeck-Bewertung rückgängig machbar. */
export const UNDO_MS = 5000;

type Held = {
  a: AnswerEvent;
  seed: Doc | null;
  immediate: boolean;
  /** Sitzung vor der Bewertung (wird bei „Rückgängig“ wiederhergestellt). */
  before: SessionState;
  /** `step` der Ansicht direkt nach der Bewertung: nur dort gilt „Rückgängig“. */
  step: number;
  word: string;
  timer: ReturnType<typeof setTimeout> | null;
};

/**
 * Die letzte Aufdeck-Bewertung – bis zum Festschreiben ist NICHTS gespeichert: keine Karte, kein
 * Protokolleintrag, kein Zähler. „Rückgängig“ muss deshalb nie ein Dokument
 * zurückschreiben (der Schreibpfad kennt kein Löschen von Feldern) und kann nie Neueres überschreiben.
 */
let held: Held | null = null;

/** Für die Anzeige: gibt es gerade etwas rückgängig zu machen? */
export const useUndo = create<{ t: number | null; word: string }>(() => ({ t: null, word: '' }));

let guarded = false;
/** Seite wird verborgen oder verlassen: sofort festschreiben und gesammelt speichern. */
function installHeldGuard(): void {
  if (guarded || typeof window === 'undefined') return;
  guarded = true;
  const onHide = () => {
    if (!held) return;
    commitHeld();
    void flushOnHide();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  window.addEventListener('pagehide', onHide);
}

function holdAnswer(h: Omit<Held, 'timer'>): void {
  commitHeld();
  installHeldGuard();
  // Fenster abgelaufen: festschreiben und gleich gesammelt speichern (Emrah ist gerade nicht am Antworten).
  held = { ...h, timer: setTimeout(() => commitHeld(true), UNDO_MS) };
  useUndo.setState({ t: h.a.t, word: h.word });
}

/**
 * Zurückgehaltene Bewertung festschreiben (Zeitablauf, nächste Antwort, Weitergehen, Verlassen, neue
 * Runde) – genau einmal, über denselben Weg wie jede andere Antwort (`saveCard` → `transform`).
 */
export function commitHeld(flushNow = false): void {
  const h = held;
  if (!h) return;
  held = null;
  if (h.timer !== null) clearTimeout(h.timer);
  useUndo.setState({ t: null, word: '' });
  void saveCard(h.a, h.seed);
  recordAnswer(h.a, h.immediate || flushNow);
}

/**
 * „Rückgängig“: Die letzte Aufdeck-Bewertung verwerfen und dieselbe Karte wieder von vorn zeigen.
 * Nur solange die Ansicht direkt danach steht (sonst `false`). Die Runde (Zähler, Warteschlange,
 * Wiedervorlage, Kontrollen) ist danach genau wie vor der Bewertung; aktive Zeit zählt weiter.
 */
export function undoLast(): FirstKind | false {
  const h = held;
  const s = useSession.getState();
  if (!h || !s.active || s.step !== h.step) return false;
  held = null;
  if (h.timer !== null) clearTimeout(h.timer);
  useUndo.setState({ t: null, word: '' });
  prebuilt = null;
  touch();
  const cur = useSession.getState();
  useSession.setState({ ...h.before, step: cur.step + 1, activeMs: cur.activeMs, lastInteract: cur.lastInteract });
  return firstKindOf(h.before.exercise);
}

/** Runde verlassen (alles Beantwortete ist gespeichert bzw. vorgemerkt). */
export function leaveSession(): void {
  commitHeld();
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
  commitHeld();
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
  commitHeld();
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
    catchUp: false,
    produced: 0,
    contrasted: queue.some((q) => q.reason === 'contrast'),
  };
  prebuilt = null;
  const next = { ...base, ...settle(base, pos) };
  if (next.pos >= next.queue.length && next.repairPos >= repairs.length) return false;
  useSession.setState(next);
  return true;
}
