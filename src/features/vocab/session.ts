import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { invalidIdsOf, useLive } from '../../data/live';
import { dayKey } from '../../domain/date';
import { mergeEntries, type DayEntry } from '../../domain/plan/buildPlan';
import { applyUpdate, cardPatch, chunkPatch, contrastMissOp, isPartnerMiss, noteOnlyOp } from '../../domain/srs/applyReview';
import { introWasYesterday, recallStep, wantsFreeRecall } from '../../domain/srs/spacing';
import { buildTrainCards } from '../../domain/metrics';
import { toTrainCard } from '../../domain/srs/cards';
import { buildChunkCards, toChunkCard } from '../../domain/srs/chunkCards';
import { buildExercise, exTextKey, type SceneLookup } from '../../domain/srs/exercise';
import { guardedExercise, reportViolations } from '../../domain/srs/guard';
import { isActivationEx } from '../../domain/srs/actBase';
import { buildActTask, EX_OF_FMT, type ActTask } from '../../domain/srs/actTask';
import type { ActStep } from '../../domain/srs/actBrief';
import { planActivations, type DueStep } from '../../domain/srs/fahrplan';
import { actId, type ActEntry, type ActVerdict, type TargetVerdict } from '../../domain/activation/actDoc';
import { reusableSentencesOf, saveActEntry } from './actStore';
import { sentKey } from '../../domain/srs/variety';
import { reportWlDiagnostics, reportWordKern } from '../../domain/srs/wlDiagnose';
import { availableExercises, chooseExercise, makeEnv, NO_ENV, supports, type ExerciseEnv } from '../../domain/srs/modes';
import { inputProfile } from '../../platform/input';
import { knownOp, knownPendingDue } from '../../domain/srs/vocabList';
import { catchUpOn, overdueCount } from '../../domain/unit/backlog';
import { againPos, calibration, controlAllowed, controlCounts, DAY0_FIRST_GAP, DAY0_SECOND_GAP, dirFor, lastRating, pickMode, weekStartMs, type FlipDir, type PickedMode, type RequestedMode } from '../../domain/srs/flip';
import { deckCards, isBuiltinDeck, type DeckCtx } from '../../domain/srs/decks';
import { listenExercise } from '../../domain/srs/listen';
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
import { legacySceneDoc } from '../../domain/chunks/legacyScene';
import { buildQueue, introducedKindsToday, longIntroducedToday, mixIntroducedToday, newQuotaLeft as newQuotaLeftFor } from '../../domain/srs/queue';
import { isLearningState, previewIntervals, readFsrs, reviewFsrs } from '../../domain/srs/scheduler';
import { noteWeight } from '../../domain/srs/weight';
import type { AnswerEvent, AttemptInput, AttemptMeta, Exercise, ExerciseId, Grade, Lang, QueueItem, TrainCard } from '../../domain/srs/types';
import { pickAttempt } from '../../engine/inputKind';
import { markExhausted, useTodayPlan } from '../today/store';
import { nextT, recordAnswer, recordRoundEnd, saveCard, saveContrastMiss, saveKnown, saveNoteOnly, usePending } from './persist';
import { flushOnHide } from '../progress/persist';
import { flushLeaveBook } from '../../ui/exercise/leaveBook';
import { contrastReady, noteConfusion, requestWordCtx } from './wordCtx';
import { requestWordBank } from './sentenceBank';
import { werkstattDue, werkstattRoom } from '../../domain/srs/werkstatt';

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
  /**
   * Fahrplan der Aktivierung (Wörter aktivieren, Stufe 2, `domain/srs/fahrplan.ts`): fällige Karten dieser Runde, die statt der gewöhnlichen Wiederholung
   * eine Aktivierung bekommen (Schlüssel → Schritt). Beim Rundenstart festgelegt und danach unverändert (nichts würfelt neu).
   */
  acts: ReadonlyMap<string, DueStep>;
  /** P52: „Welches Wort passt?“ (Kontrast) kam in dieser Runde schon (höchstens 1 je Runde). */
  contrasted: boolean;
  /** Wort-Lernen 2, „Abend-Check“: nur freier Abruf (tippen ohne Anfangsbuchstaben), keine Werkstatt, keine Aktivierung. */
  free: boolean;
};

const EXTRA_TARGET = 10;
const AGAIN_WINDOW_MS = 20 * 60_000;
const MAX_SHOWN = 3;
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
  acts: new Map(),
  contrasted: false,
  free: false,
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

type ExCtx = Pick<SessionState, 'cards' | 'pool' | 'lang' | 'day' | 'shown' | 'recentEx' | 'env' | 'mode' | 'dir' | 'controls' | 'ctlWeek' | 'ctlDay' | 'catchUp' | 'acts' | 'contrasted' | 'free'>;

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
function build(s: ExCtx, card: TrainCard, ex: ExerciseId, origin = false, act?: ActTask): Exercise {
  // Wächter (Q1): eine Aufgabe, die durch R1–R14 fällt, wird nicht gezeigt; stattdessen die nächste Aufgabenart (`domain/srs/guard.ts`).
  return guardedExercise(card, ex, s.lang, s.pool, `${s.day}|${s.shown[card.key] ?? 0}`, { sceneOf: sceneLookup(s.lang), origin, ...(act ? { act } : {}) }, s.env);
}

/**
 * Aktivierung statt der gewöhnlichen Wiederholung (Fahrplan, `domain/srs/fahrplan.ts`): A1 ist „Eigener Satz“ (`produce`), A2–A5 sind die Aufgaben aus
 * `actTask.ts`. Gibt es keine brauchbare Aufgabe (nichts zum Umformen, keine Partnerkarte, Wächter R13/R14), folgt die gewöhnliche Wiederholung – die
 * Karte wird nie übergangen und es gibt keinen zweiten Zeitplan.
 */
function activationFor(s: ExCtx, card: TrainCard, due: DueStep): Exercise | null {
  if (due.step === 1) {
    const e = build(s, card, 'produce');
    return e.ex === 'produce' ? e : null;
  }
  const task = buildActTask({ card, step: due.step, maintenance: due.maintenance, pool: s.pool, day: s.day, lang: s.lang, own: reusableSentencesOf(card.key) });
  if (!task) return null;
  const e = build(s, card, EX_OF_FMT[task.fmt], false, task);
  return e.act ? e : null;
}

function exerciseFor(s: ExCtx, item: QueueItem): Exercise | null {
  const card = s.cards.get(item.key);
  if (!card || item.phase !== 'quiz') return null;
  // P52: „Welches Wort passt?“ steht als eigener Schritt direkt nach der regulären Abfrage (nur, solange der Kontrast noch möglich ist).
  if (item.reason === 'contrast') {
    if (!contrastReady(card, s.pool)) return null;
    // Zusatzschritt: fällt er beim Wächter durch, entfällt er (kein Ersatz).
    const c = buildExercise(card, 'contrast', s.lang, s.pool, `${s.day}|${s.shown[card.key] ?? 0}`, { sceneOf: sceneLookup(s.lang) });
    return reportViolations(c, card, s.lang).length ? null : c;
  }
  const hit = takePrebuilt(s, item);
  if (hit) return hit;
  if (item.wk) return werkstattRecall(s, card);
  // „Abend-Check“: nur freier Abruf ohne Stütze (Wort: Lücke frei, sonst tippen; Wendung: ein Wort frei, Lücke, tippen).
  if (s.free) {
    const n = s.pool.length - 1;
    const order: readonly ExerciseId[] = card.kind === 'chunk' ? ['cloze_part', 'cloze', 'type'] : ['cloze', 'type'];
    const ex = order.find((x) => supports(card, x, s.lang, n, s.env));
    if (ex) return build(s, card, ex);
  }
  // N35 Hör-Modus: die Sprachausgabe spricht, getippt wird in die Lücke (sonst die Leiter).
  if (s.mode === 'listen') {
    const lx = listenExercise(card, s.lang, s.pool.length - 1, s.env);
    if (lx) return build(s, card, lx);
  }
  const picked = modeFor(s, card, item);
  if (picked === 'flip') return { ...build(s, card, 'flip'), dir: dirFor(card.key, s.dir, s.day) };
  // Wort-Lernen 2: Tag 0 (Abruf 1 mit Anfangsbuchstaben, Abruf 2 frei) und der erste Abruf an einem späteren Tag („Gestern-Check“, frei) – vor der Leiter.
  if (picked === 'type' && (s.mode === 'auto' || s.mode === 'type')) {
    const r = recallExercise(s, card);
    if (r) return r;
  }
  if (picked === 'control') {
    // Kontrolle (§4): frei (`cloze`), ohne Satz `type`; die App bewertet. WL: nicht im Ursprungssatz, sondern im Satz der Vorderseite (Tag 1) bzw. in einem dritten Satz.
    const n = s.pool.length - 1;
    const ex: ExerciseId | null = supports(card, 'cloze', s.lang, n, s.env) ? 'cloze' : supports(card, 'type', s.lang, n, s.env) ? 'type' : null;
    if (ex) return { ...build(s, card, ex, false), check: 'control' };
  }
  if (picked === 'probe') {
    // Prüfabfrage (§1 Regel 6): tippen mit Stütze, Leiter auf Stufe 3 (cloze_hint/tiles).
    const ex = chooseExercise({ ...card, stage: 3 }, s.lang, s.pool.length - 1, s.recentEx, s.env);
    if (ex) return { ...build(s, card, ex, true), check: 'probe' };
  }
  // Fahrplan: Diese fällige Karte bekommt heute eine Aktivierung (festgelegt beim Rundenstart) – sie ERSETZT die gewöhnliche Wiederholung.
  const planned = picked === 'type' && item.reason === 'due' ? s.acts.get(item.key) : undefined;
  if (planned) {
    const a = activationFor(s, card, planned);
    if (a) return a;
  }
  const lighter = item.reason === 'due' ? lighterExercise(s, card) : null;
  if (lighter) return build(s, card, lighter);
  const ex = chooseExercise(card, s.lang, s.pool.length - 1, s.recentEx, s.env);
  if (!ex) return null;
  if (ex === 'produce') {
    // „Eigener Satz“ kommt nur noch über den Fahrplan (A1, mit Abstand und Tagesgrenze), nie über die Leiter: eine freie Art, sonst irgendeine andere Art der Stufe;
    // „Eigener Satz“ nur, wenn es gar nichts anderes gibt (kein Leck, Lernwissenschaft M1).
    const other = chooseExercise({ ...card, stage: 4 }, s.lang, s.pool.length - 1, s.recentEx, s.env);
    if (other && other !== 'produce' && FREE_TYPED.has(other)) return build(s, card, other);
    const alt = availableExercises({ ...card, stage: 4 }, s.lang, s.pool.length - 1, s.env).find((x) => x !== 'produce');
    if (alt) return build(s, card, alt);
  }
  return build(s, card, ex);
}

/**
 * Abruf nach `recallStep` (`domain/srs/spacing.ts`), getippt und nie per Aufdecken/Auswahl:
 *  - `hint`  Abruf 1 am Tag 0: Lücke mit Anfangsbuchstaben im Ursprungssatz; Wendung: ein Wort der Wendung (mit Anfangsbuchstaben), sonst Bausteine
 *  - `free`  Abruf 2 am Tag 0: freie Lücke, ohne Satz Deutsch → Englisch; Wendung: ein Wort frei, sonst die ganze Wendung
 *  - `check` erster Abruf an einem späteren Tag: wie `free`
 * Fällt die Art beim Wächter durch, gilt dessen Ersatz (wie überall).
 */
function recallExercise(s: ExCtx, card: TrainCard): Exercise | null {
  const step = recallStep(card, s.day);
  if (!step) return null;
  const n = s.pool.length - 1;
  const order: readonly ExerciseId[] =
    step === 'hint' ? (card.kind === 'chunk' ? ['cloze_hint', 'tiles'] : ['cloze_hint', 'type']) : card.kind === 'chunk' ? ['cloze_part', 'cloze', 'type'] : ['cloze', 'type'];
  const ex = order.find((x) => supports(card, x, s.lang, n, s.env));
  if (!ex) return null;
  const recall: NonNullable<Exercise['recall']> = step === 'hint' ? 'day0a' : step === 'free' ? 'day0b' : introWasYesterday(card.doc, s.day) ? 'yesterday' : 'first';
  return { ...build(s, card, ex, step === 'hint'), recall };
}

/**
 * Abruf der Wort-Werkstatt (drei Karten nach der Werkstatt, `QueueItem.wk`): gestützt im Ursprungssatz (Wort: Lücke mit Anfangsbuchstaben, sonst tippen;
 * Wendung: Lücke mit Anfangsbuchstaben, sonst Bausteine). Er benotet die Karte wie jede Wiederholung (`Exercise.wk` → `AnswerEvent.wk`, `applyReview.ts`).
 */
function werkstattRecall(s: ExCtx, card: TrainCard): Exercise | null {
  const n = s.pool.length - 1;
  const order: readonly ExerciseId[] = card.kind === 'chunk' ? ['cloze_hint', 'tiles', 'cloze_part'] : ['cloze_hint', 'type', 'cloze'];
  const ex = order.find((x) => supports(card, x, s.lang, n, s.env)) ?? chooseExercise(card, s.lang, n, s.recentEx, s.env);
  return ex ? { ...build(s, card, ex, true), wk: true } : null;
}

/** Frei getippte Arten (Stufe 4) – ohne Auswahl und ohne Stütze. */
const FREE_TYPED: ReadonlySet<ExerciseId> = new Set<ExerciseId>(['type', 'cloze', 'cloze_part', 'situation']);

/**
 * Billigere, aber gleichwertige Abfrage in zwei Fällen (Methodenplan Lernwissenschaft 02.10.2026), nur im Modus `auto`:
 * - L5: Nach einer bestandenen Stützen-Abfrage an einem früheren Tag (Stufe 3, Lücke mit Hilfe oder Bausteine) kommt der nächste
 *   getippte Termin FREI (ohne Anfangsbuchstaben) – sonst läuft Stufe 3 zweimal mit Hilfe und der erste freie Abruf käme erst am 4. Termin.
 * - L4: Reife Karten (Stufe 5, Stabilität ≥ 21 Tage) bekommen die volle „Frei anwenden“-Form nur bei jeder dritten Wiederholung;
 *   sonst genügt freies Tippen (Stufe 4).
 * - Wort-Lernen 2 (S3): Tag 2–21 frei, solange die Karte 1–2 freie Tage hat und die letzte Antwort nicht falsch war (`wantsFreeRecall`).
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
  // Wort-Lernen 2 (S3): Tag 2–21 mit mindestens einem, aber weniger als drei freien Tagen und ohne Fehler zuletzt: frei statt Stütze oder Auswahl.
  if (card.stage <= 3 && wantsFreeRecall(card.doc)) return freeOne();
  const reps = typeof card.doc.reps === 'number' ? card.doc.reps : 0;
  if (card.stage >= 5 && card.fsrs.stability >= MAINTENANCE_S && reps % MAINTENANCE_EVERY !== 0) return freeOne();
  return null;
}

// n+1 vorberechnen (leistung.md §4 Nr. 4): nach dem Prüfen im Leerlauf, beim „Weiter“ nur noch tauschen.
let prebuilt: { sig: string; ex: Exercise } | null = null;
const sigOf = (s: ExCtx, item: QueueItem, recent: readonly ExerciseId[]) =>
  `${item.key}|${s.shown[item.key] ?? 0}|${recent.join(',')}|${s.controls}|${s.mode}|${s.dir}|${s.day}|${s.contrasted ? 1 : 0}|${item.wk ?? 0}`;

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
  const ctx: ExCtx = { ...s, recentEx: recent, contrasted: s.contrasted || s.exercise.ex === 'contrast' };
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
    if (item.phase === 'intro' || item.phase === 'werkstatt') return { pos, exercise: null, step: s.step + 1 };
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
  /** Nur freier Abruf („Abend-Check“, Wort-Lernen 2): keine Werkstatt, keine Aktivierung, keine Stütze. */
  free?: boolean;
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

/**
 * Plan der Aktivierungen für eine Runde (nur im Modus `auto` und `type`, nie beim Aufdecken oder Hören, und nur mit erreichbarer KI). Festgelegt beim Rundenstart,
 * damit beim Neuzeichnen nichts neu gewürfelt wird (Kap. 15); der Pflicht-Zähler von „Heute“ bleibt unberührt: Eine Aktivierung ersetzt eine fällige Wiederholung.
 */
function actPlanFor(i: { queue: readonly QueueItem[]; cards: ReadonlyMap<string, TrainCard>; pool: readonly TrainCard[]; day: string; now: number; mode: RequestedMode; env: ExerciseEnv; lang: Lang; catchUp: boolean; ctl: { week: number; day: number } }): ReadonlyMap<string, DueStep> {
  if (i.mode !== 'auto' && i.mode !== 'type') return new Map();
  // Nur Karten, die diese Runde getippt abgefragt werden: Im Aufholmodus kommen reife Karten oft als Aufdeckkarte, der reservierte Platz würde verfallen (N1).
  const allow = (key: string): boolean => {
    const card = i.cards.get(key);
    return (
      !!card &&
      pickMode({ card, requested: i.mode, day: i.day, lang: i.lang, due: true, controlAllowed: controlAllowed({ week: i.ctl.week, day: i.ctl.day, session: 0 }), catchUp: i.catchUp && i.mode === 'auto', key: card.key }) === 'type'
    );
  };
  return planActivations({ queue: i.queue, cards: i.cards, pool: i.pool, day: i.day, overdue: overdueCount(i.pool, i.now), ai: i.env.ai, allow });
}

/**
 * Wort-Werkstatt (`domain/srs/werkstatt.ts`): Fällige Karten, die haken (3 freie Fehlversuche oder Fehler an 2 Lerntagen in 14 Tagen) und nicht in der Ruhe
 * nach der letzten Werkstatt stehen, bekommen statt der gewöhnlichen Wiederholung die Werkstatt – höchstens 2 je Lerntag, nur im Modus `auto`/`type`, nie im
 * Aufholmodus und nur, wenn die Karte diese Runde getippt abgefragt würde. Festgelegt beim Rundenstart (nichts würfelt neu); die Karte bleibt EIN Eintrag der
 * Runde (gleiches Zählen für die Pflicht). Ändert `queue` an Ort und Stelle.
 */
function markWerkstatt(i: { queue: QueueItem[]; cards: ReadonlyMap<string, TrainCard>; pool: readonly TrainCard[]; day: string; mode: RequestedMode; lang: Lang; catchUp: boolean; ctl: { week: number; day: number } }): void {
  if ((i.mode !== 'auto' && i.mode !== 'type') || i.catchUp) return;
  let room = werkstattRoom(
    i.pool.map((c) => c.doc),
    i.day,
  );
  const seen = new Set<string>();
  for (let k = 0; k < i.queue.length && room > 0; k++) {
    const q = i.queue[k] as QueueItem;
    if (q.reason !== 'due' || q.phase !== 'quiz' || seen.has(q.key)) continue;
    seen.add(q.key);
    const card = i.cards.get(q.key);
    if (!card || card.hidden || !werkstattDue(card.doc, i.day)) continue;
    const picked = pickMode({ card, requested: i.mode, day: i.day, lang: i.lang, due: true, controlAllowed: controlAllowed({ week: i.ctl.week, day: i.ctl.day, session: 0 }), catchUp: false, key: card.key });
    if (picked !== 'type') continue;
    i.queue[k] = { ...q, phase: 'werkstatt' };
    room--;
  }
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
  reportWlDiagnostics(cards, day);
  reportWordKern(cards, day);
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
  // 11.10.2026: Eine Wortschatz-Runde enthält nur Karten, nie Fehlersätze (Entscheidung „Vokabelübungen enthalten nie Grammatik“).
  const deckPool = round === 'extra' && deck !== 'all' ? deckCards(cards, deck, useDecks.getState().decks, ctx) : cards;
  const chosen = opts.pick ? deckPool.filter(opts.pick) : deckPool;
  // anki-regeln §5: EIN Kontingent für alle Wege; Stapel bekommen neue Karten aus dem Rest, nur passende.
  const allowNew = opts.allowNew ?? !opts.pick;
  const queue = opts.only
    ? opts.only
        .map((k) => byKey.get(k))
        .filter((c): c is TrainCard => !!c && !c.hidden)
        .map((c): QueueItem => ({ key: c.key, reason: c.isNew ? 'new' : 'due', phase: c.stage === 0 ? 'intro' : 'quiz' }))
    : buildQueue({ cards: chosen, nowMs: now, target, newQuotaLeft: allowNew ? newQuotaLeft : 0, exclude: round === 'pflicht' ? reviewed : answeredToday, lang, mix: { introduced: mixIntroducedToday(cards, day), longToday: longIntroducedToday(cards, day), ...introducedKindsToday(cards, day) } });
  const docs = pool.map((c) => c.doc);
  const ctl = mode === 'flip' ? controlCounts(docs, now) : { week: 0, day: 0 };
  const catchUp = mode === 'auto' && catchUpOn(overdueCount(pool, now));
  // Wort-Werkstatt (Wort-Lernen 2): fällige Karten, die haken, werden erst neu verankert – vor dem Fahrplan, damit sie keine Aktivierung bekommen.
  const free = opts.free === true;
  if (!free) markWerkstatt({ queue, cards: byKey, pool, day, mode, lang, catchUp, ctl });
  const acts = free ? new Map<string, DueStep>() : actPlanFor({ queue, cards: byKey, pool, day, now, mode, env, lang, catchUp, ctl });
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
    catchUp,
    acts,
    contrasted: false,
    free,
  };
  prebuilt = null;
  const next = { ...base, ...settle(base, 0) };
  if (next.pos >= next.queue.length) next.status = 'summary';
  // H1: Pflichtrunde ohne abfragbare Karte (z. B. nach dem Neuladen) – „Wiederholen" ist erschöpft.
  if (round === 'pflicht' && target > 0 && next.status === 'summary') markExhausted(day);
  useSession.setState(next);
  const item = next.queue[next.pos];
  if (!item || next.status === 'summary') return null;
  if (item.phase === 'intro' || item.phase === 'werkstatt') return 'intro';
  return firstKindOf(next.exercise);
}

/**
 * Fortschritt „n / gesamt“ (R4: Nenner fest, Zähler nur vorwärts). Gesamt ist die geplante Runde (`doneBefore + target`)
 * und wächst nie. Karten, die wegen „Nochmal“ wieder eingereiht werden, zählen darüber hinaus
 * getrennt als `extra` („+2“); `extra` steigt nur. n zählt die verschiedenen schon beantworteten Einträge der geplanten Runde.
 */
export function roundProgress(s: Pick<SessionState, 'status' | 'round' | 'queue' | 'pos' | 'target' | 'doneBefore' | 'answered'>): { n: number; total: number; extra: number } | null {
  if (s.status !== 'running') return null;
  const base = s.round === 'pflicht' ? s.doneBefore : 0;
  // Der Kontrast-Schritt (P52) ist ein Zusatz zur schon beantworteten Karte: er zählt weder vorwärts noch als „+1“.
  const left = s.queue.slice(Math.max(0, s.pos)).filter((q) => q.reason !== 'contrast').length;
  const onContrast = s.queue[s.pos]?.reason === 'contrast';
  const done = base + s.answered.length;
  const planned = base + s.target;
  const total = Math.max(planned, 1);
  if (planned <= 0 && done + left <= 0) return null;
  const extra = Math.max(0, done + left - planned);
  const distinct = base + new Set(s.answered).size;
  return { n: Math.min(total, Math.max(1, distinct + (onContrast ? 0 : 1))), total: Math.max(total, 1), extra };
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
  // Satzbank (Engine-Verdrahtung 19.10.2026): gebündelt für Karten mit Bedarf, Hintergrund, höchstens 3 je Tag; Sätze erst nach Quarantäne sichtbar.
  if (n > 0) requestWordBank({ answered: s.answered, cards: s.cards, pool: s.pool, catchUp: s.catchUp });
}

/** Einführung einer neuen Karte gesehen: Abruf 1 folgt nach drei anderen Karten (Wort-Lernen 2, `DAY0_FIRST_GAP`; höchstens ans Ende). */
export function continueIntro(): FirstKind {
  touch();
  commitHeld();
  const s = useSession.getState();
  const item = s.queue[s.pos];
  if (!item) return null;
  const queue = [...s.queue];
  queue.splice(Math.min(queue.length, s.pos + DAY0_FIRST_GAP), 0, { key: item.key, reason: item.reason, phase: 'quiz' });
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

/**
 * Wort-Werkstatt gesehen („Weiter“): Der Abruf folgt nicht sofort, sondern nach drei anderen Karten (`DAY0_FIRST_GAP`, höchstens ans Ende;
 * Lernwissenschaft S5 – sonst prüft er nur das Kurzzeitgedächtnis). Gestützt im Ursprungssatz (`werkstattRecall`); bei Note 1 einmal erneut nach
 * drei Karten. Ruhe 2–3 Lerntage nur nach gelungenem Abruf (`applyReview.ts` → `wkPatch`).
 */
export function continueWerkstatt(): FirstKind {
  touch();
  commitHeld();
  const s = useSession.getState();
  const item = s.queue[s.pos];
  const card = item ? s.cards.get(item.key) : null;
  if (!item || !card || item.phase !== 'werkstatt') return null;
  const queue = [...s.queue];
  queue.splice(Math.min(queue.length, s.pos + DAY0_FIRST_GAP), 0, { key: item.key, reason: item.reason, phase: 'quiz', wk: 1 });
  return advanceFrom({ ...s, queue });
}

/** Nächste fällige Karte, die noch nicht in der Runde steht und heute nicht beantwortet wurde (Ersatz nach „pausieren“, der Nenner bleibt fest). */
function replacementFor(s: SessionState, skip: string): QueueItem | null {
  const inQueue = new Set(s.queue.map((q) => q.key));
  const today = new Set(todayEntries(s.day).map(entryCardKey).filter((k): k is string => !!k));
  const now = useClock.getState().now;
  const next = s.pool
    .filter((c) => c.key !== skip && !c.hidden && !c.isNew && c.fsrs.due <= now && !inQueue.has(c.key) && !today.has(c.key))
    .sort((a, b) => a.fsrs.due - b.fsrs.due || a.key.localeCompare(b.key))[0];
  return next ? { key: next.key, reason: 'due', phase: 'quiz' } : null;
}

/**
 * „Pausieren“ in der Werkstatt (ab 6 Vergessen) bzw. „Nein, ausblenden“ auf die Frage „Brauchst du dieses Wort wirklich?“: Die Karte wird ausgeblendet
 * (`hidden`, nichts gelöscht, in der Wortliste wieder einblendbar) und verlässt die Runde ohne Bewertung. Eine andere fällige Karte rückt nach, damit die
 * Pflichtrunde nicht kürzer wird. `hide` schreibt über den einen Schreibweg der Wortliste (`list/actions.ts` → `writer.transform`).
 */
export function pauseWord(hide: (card: TrainCard) => Promise<boolean>): FirstKind {
  commitHeld();
  const s = useSession.getState();
  const item = s.queue[s.pos];
  const card = item ? s.cards.get(item.key) : null;
  if (!s.active || s.status !== 'running' || !item || !card) return null;
  void hide(card);
  const queue = s.queue.filter((q, i) => i <= s.pos || q.key !== card.key);
  const rep = s.round === 'pflicht' ? replacementFor(s, card.key) : null;
  if (rep) queue.push(rep);
  const pool = s.pool.filter((c) => c.key !== card.key);
  return advanceFrom({ ...s, queue, pool });
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
  return item.phase === 'intro' || item.phase === 'werkstatt' ? 'intro' : firstKindOf(next.exercise);
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
  /** Richtig, aber nach einer Unterbrechung (> 60 s): Note 3, hebt die Stufe nicht. */
  interrupted?: true;
  /** Satzantwort ohne Prüfung durch Claude: zählt nicht als freier Beleg. */
  unverified?: true;
  /** „Sag es“ ohne erkanntes Zielwort: nur ein Verlaufseintrag (`u: 1`), keine Änderung der Planung (`noteOnlyOp`). */
  noteOnly?: true;
  /** Aufdecken: beim Aufdecken reservierter Zeitstempel (gleich für Vorschau und Speichern, architektur.md §4.3). */
  t?: number;
  /** Aktivierung: Satz und Urteil für die Sammelakte `act/<Monat>` (nur „Eigener Satz“ und A2–A5). */
  rec?: ActRecord;
  /** S1-ZEIT (P4): ms bis zum ersten Kontakt und Eingabeart; nur gespeichert (`hist`, Log), nie ausgewertet. */
  fk?: number;
  in?: AttemptInput;
  /** S1-ZEIT (P4-Nacharbeit): gemischt, Senden vor Claude, Prompt-Länge, zweiter Versuch, verborgene Seite (siehe `AttemptMeta`). */
  mx?: AttemptMeta['mx'];
  sm?: number;
  pl?: number;
  n?: AttemptMeta['n'];
  bg?: AttemptMeta['bg'];
  /** Hinweisrunde (LS10): der erste, falsche Versuch – zählt als getippter Fehler (`hist[].v`, Verwechslung), auch wenn der zweite stimmt. */
  firstWrong?: string;
};

/**
 * Korrekturrunde P3 (Punkt 4, LS3): Antwort beim Verlassen buchen. `stay` (Seite verborgen): speichern, aber NICHT weitergehen – die Karte
 * bleibt mit ihrem Ergebnis stehen, „Weiter“ geht später ohne zweites Speichern weiter (`releaseLeft`). `go` (Runde, Reiter oder Bildschirm
 * verlassen): speichern und weiterrechnen wie „Weiter“. Beide tragen `left: true` ins Protokoll.
 */
export type LeaveMode = 'stay' | 'go';

/** Beim Verbergen gebucht, Weitergehen steht noch aus: der fertig gerechnete nächste Stand (nur gültig, solange dieselbe Aufgabe steht). */
let leftHeld: { exercise: Exercise; next: SessionState } | null = null;

/**
 * Nach einer `stay`-Buchung weitergehen (Weiter, Verlassen, Rückkehr): genau einmal, ohne zweites Speichern. `undefined`, wenn nichts
 * aussteht; `null`, wenn inzwischen eine andere Aufgabe steht (dann bleibt es bei der Buchung).
 */
export function releaseLeft(): FirstKind | undefined {
  const h = leftHeld;
  if (!h) return undefined;
  leftHeld = null;
  const cur = useSession.getState();
  if (!cur.active || cur.exercise !== h.exercise) return null;
  return applyAdvance({ ...h.next, activeMs: cur.activeMs, lastInteract: cur.lastInteract });
}

/** Für Tests und die Anzeige: steht eine beim Verbergen gebuchte Antwort noch vor dem Weitergehen? */
export const hasLeftHeld = (): boolean => leftHeld !== null;

/** Was die Oberfläche von einer Aktivierung festhält; `commitAnswer` ergänzt Karte, Schritt, Format und Code zum Eintrag der Sammelakte. */
export type ActRecord = { s: string; b?: string; w?: string; v: ActVerdict; k: 0 | 1; r?: boolean; /** Mit Hilfe der Vorprüfung (Hinweis): zählt nicht für den Fahrplan. */ hp?: true; ts?: Array<[string, TargetVerdict]>; et?: string };

/** Aufdecken im Aufholmodus: die Bewertung zählt mit dem Aufhol-Gewicht (`noteWeight`). EINE Regel für Knopf-Vorschau und Speichern. */
const flipCatchUp = (s: Pick<SessionState, 'catchUp'>, card: Pick<TrainCard, 'stage'>): boolean => s.catchUp && card.stage >= 3;

/**
 * Abstände auf den Aufdeck-Knöpfen (Rückmeldung 6): genau das, was `commitAnswer` → `cardPatch` speichert – mit demselben Gewicht.
 * Vorher zeigte der Knopf im Aufholmodus den ungewichteten Abstand („Gut – 7 Tage“), gespeichert wurde ein kürzerer.
 */
export function flipIntervals(card: TrainCard, t: number): Record<Grade, number> {
  const s = useSession.getState();
  const out = previewIntervals(card.fsrs, t, noteWeight('flip', 0, flipCatchUp(s, card)));
  // Wort-Lernen 2: Tag-0-Regel und Abstands-Deckel wie beim Speichern (`cardPatch`) – derselbe reine Weg, nur ohne Schreiben.
  for (const g of [1, 2, 3, 4] as const) out[g] = plannedDueIn(card, { t, day: s.day || dayKey(t), ex: 'flip', grade: g, ...(flipCatchUp(s, card) ? { catchUp: true as const } : {}) }) ?? out[g];
  return out;
}

/** Abstand bis zur Fälligkeit, den `cardPatch`/`chunkPatch` für diese Antwort speichern würde (rein; `null`, wenn der Patch keine Fälligkeit setzt). */
function plannedDueIn(card: TrainCard, p: Pick<AnswerEvent, 't' | 'day' | 'ex' | 'grade'> & Partial<Pick<AnswerEvent, 'hint' | 'catchUp' | 'free' | 'unverified' | 'colIndex'>>): number | null {
  const a: AnswerEvent = { kind: card.kind === 'chunk' ? 'chunk' : 'v', id: card.id, given: '', ans: card.word, ms: 0, lang: 'de', ctx: 'rev', ...p };
  const patch = (card.kind === 'chunk' ? chunkPatch : cardPatch)({ ...card.doc }, a);
  return typeof patch.due === 'number' ? Math.max(0, patch.due - p.t) : null;
}

/** „Kenne ich“: richtig ohne Hilfe → die Prüffrage zählt erst am nächsten Lerntag (`knownOp` mit `pending`, Wort-Lernen 2). */
const isKnownPass = (e: Pick<Exercise, 'check' | 'card'>, ans: Pick<Answer, 'ok' | 'hint' | 'override'>): boolean => e.check === 'known' && ans.ok && !ans.hint && !ans.override && e.card.kind === 'vocab';

/** „Satz vervollständigen“ ohne Satzanfang: ein ganzer eigener Satz (Gewicht wie `produce`). Die App baut es nicht mehr; alte Daten bleiben lesbar. */
const isFreeSentence = (e: Pick<Exercise, 'ex' | 'start'>): boolean => e.ex === 'complete' && exTextKey(e) === 'produce';

/**
 * „Wieder in …“ (Lernprüfung 10.10.2026): genau der Abstand, den `commitAnswer` → `cardPatch` bzw. `knownOp` zum Zeitpunkt `t` speichert –
 * dieselbe Note (Einspruch = 3), dasselbe Gewicht, derselbe Zeitpunkt (die ts-fsrs-Streuung hängt von der Zeit ab). EINE Regel für Anzeige und Speichern.
 */
export function answerDueIn(e: Exercise, ans: Pick<Answer, 'grade' | 'ok' | 'override' | 'hint' | 'unverified'>, t: number): number {
  const s = useSession.getState();
  const day = s.day || dayKey(t);
  if (isKnownPass(e, ans)) return Math.max(0, knownPendingDue(day) - t);
  const grade: Grade = ans.override ? 3 : ans.grade;
  const hint = ans.override ? 0 : (ans.hint ?? 0);
  const catchUp = e.ex === 'flip' && flipCatchUp(s, e.card);
  // Fehler am Partnerwort: Fälligkeit der Hauptkarte bleibt, wie sie war.
  if (e.card.kind === 'vocab' && (e.ex === 'colloc' || e.ex === 'colloc_gap') && e.colloc && isPartnerMiss(e.card.doc, { ex: e.ex, grade, colIndex: e.colloc.index })) return Math.max(0, readFsrs(e.card.doc, t).due - t);
  // Wort-Lernen 2: Tag-0-Regel und Abstands-Deckel – derselbe reine Weg wie beim Speichern (`cardPatch`/`chunkPatch`).
  const planned = plannedDueIn(e.card, {
    t,
    day,
    ex: e.ex,
    grade,
    ...(hint ? { hint } : {}),
    ...(catchUp ? { catchUp: true as const } : {}),
    ...(isFreeSentence(e) ? { free: true as const } : {}),
    ...(ans.unverified ? { unverified: true as const } : {}),
    ...(e.colloc && e.colloc.index >= 0 && (e.ex === 'colloc' || e.ex === 'colloc_gap') ? { colIndex: e.colloc.index } : {}),
  });
  if (planned !== null) return planned;
  const after = reviewFsrs(readFsrs(e.card.doc, t), grade, t, noteWeight(e.ex, hint, catchUp, isFreeSentence(e)));
  return Math.max(0, after.due - t);
}

/**
 * Bewertete Antwort übernehmen: Karte sofort speichern, Protokoll und Zähler vormerken, weiter. `left` (Punkt 4): beim Verlassen gebucht –
 * sofort gespeichert, mit `left: true` im Protokoll; bei `stay` ohne Weitergehen (siehe `LeaveMode`).
 */
export function commitAnswer(ans: Answer, left?: LeaveMode): FirstKind {
  if (!left) touch();
  if (!left) cardGo();
  // B4: eine zurückgehaltene Aufdeck-Bewertung gilt, sobald die nächste Antwort kommt.
  commitHeld();
  // Eine schon beim Verbergen gebuchte Antwort geht zuerst weiter (nie zweimal speichern).
  if (leftHeld) releaseLeft();
  const s = useSession.getState();
  const e = s.exercise;
  const item = s.queue[s.pos];
  if (!e || !item) return null;
  const advance = (next: SessionState): FirstKind => {
    if (left !== 'stay') return applyAdvance(next);
    leftHeld = { exercise: e, next };
    return null;
  };
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
  if (e.brief) a.act = e.brief.code;
  // Wörter aktivieren, Stufe 2: Code der Vorgabe in den Verlauf und Schritt des Fahrplans (der Kartenzähler `na` steigt im selben Schreibschritt, Note ≥ 2).
  if (e.act) a.act = e.act.code;
  // Wort-Lernen 2: Wendungen haben A1/A2 (`fahrplan.ts` → `chunkDueStep`).
  const actStep: ActStep | null = !isActivationEx(e.ex) ? null : (e.act?.step ?? (e.ex === 'produce' ? 1 : null));
  if (actStep) a.actStep = actStep;
  // Nur eine von Claude geprüfte Leistung ohne Hilfe der Vorprüfung rückt den Fahrplan weiter (Lernwissenschaft H1): nicht abgeschrieben, nicht ungeprüft, nicht „falsch“.
  if (actStep && !(ans.rec && ans.rec.k === 1 && ans.rec.v !== 'w' && !ans.rec.hp)) a.actUnverified = true;
  if (card.kind === 'chunk') a.q = card.word;
  if (ans.override) a.override = true;
  // S1-ZEIT (P4): Messwerte der Oberfläche und die Lernstufe VOR der Antwort (nur gespeichert, nie ausgewertet).
  Object.assign(a, pickAttempt(ans));
  a.st = card.stage;
  if (ans.hint) a.hint = ans.hint;
  if (ans.interrupted && ans.ok && !ans.override) a.interrupted = true;
  if (ans.unverified) a.unverified = true;
  // Wort-Werkstatt: falsch Getipptes für die Diagnose (`hist[].v`, gekürzt) und der Abruf am Ende der Werkstatt (Ruhe danach, `wk`).
  if (!ans.ok && e.input === 'typed' && ans.given.trim()) a.wrong = ans.given;
  // Hinweisrunde (LS10): der erste, falsche Versuch zählt als getippter Fehler, auch wenn der zweite stimmt.
  else if (e.input === 'typed' && ans.firstWrong?.trim()) a.wrong = ans.firstWrong;
  if (e.wk) a.wk = true;
  if (left) a.left = true;
  if (e.check === 'control' || e.check === 'probe') a.check = e.check;
  const knownPass = isKnownPass(e, ans);
  if (e.ex === 'flip' && flipCatchUp(s, card)) a.catchUp = true;
  if (isFreeSentence(e)) a.free = true;
  // P52: getippte falsche Antwort = Wort einer anderen eigenen Karte → Verwechslung für den Wörter-Tutor merken.
  if (!ans.ok && e.input === 'typed' && ans.given.trim()) noteConfusion(card, ans.given, s.pool);
  else if (e.input === 'typed' && ans.firstWrong?.trim()) noteConfusion(card, ans.firstWrong, s.pool);

  // P52 „Welches Wort passt?“: ein zusätzlicher Schritt, der NUR protokolliert. Die Planung (FSRS, S, D, due, lapses, stage) bleibt, wie die reguläre
  // Abfrage sie gesetzt hat; die Karte wird nie als „Nochmal“ eingereiht. Kartenwort gewählt → zusätzlich ein reiner Verlaufseintrag
  // `{x: 'contrast', g: 1}`, der für „schwach“ (Fehler der letzten 14 Tage) zählt.
  if (e.ex === 'contrast') {
    if (!ans.ok) a.grade = 1;
    recordAnswer(a, s.results.length === 0 || !!left);
    const missOp = ans.ok ? null : contrastMissOp(card.path, card.doc, a);
    let cards = s.cards;
    if (missOp) {
      const missDoc = applyUpdate({ ...card.doc }, missOp.update);
      const upd = (card.kind === 'chunk' ? toChunkCard(card.id, missDoc, a.t) : toTrainCard(card.id, missDoc, card.inDb, a.t)) ?? card;
      cards = new Map(s.cards);
      cards.set(card.key, upd);
    }
    if (!ans.ok) void saveContrastMiss(card.path, a);
    return advance(
      advanceState({
        ...s,
        cards,
        recentEx: [...s.recentEx, e.ex].slice(-2),
        contrasted: true,
        results: [...s.results, { key: card.key, word: card.word, grade: a.grade, ok: ans.ok }],
      }),
    );
  }

  // „Sag es“ ohne erkanntes Zielwort (Lernwissenschaft S7): nur ein Verlaufseintrag `u: 1`, Planung unverändert, kein „Nochmal“, kein Kontrast.
  if (ans.noteOnly && e.ex === 'say_it') {
    a.unverified = true;
    const op = noteOnlyOp(card.path, card.doc, a);
    const cards = new Map(s.cards);
    if (op) {
      const noteDoc = applyUpdate({ ...card.doc }, op.update);
      cards.set(card.key, (card.kind === 'chunk' ? toChunkCard(card.id, noteDoc, a.t) : toTrainCard(card.id, noteDoc, card.inDb, a.t)) ?? card);
    }
    if (card.inDb || card.kind === 'chunk') void saveNoteOnly(card.path, a);
    recordAnswer(a, s.results.length === 0 || !!left);
    return advance(
      advanceState({
        ...s,
        cards,
        shown: { ...s.shown, [card.key]: (s.shown[card.key] ?? 0) + 1 },
        answered: s.answered.includes(card.key) ? s.answered : [...s.answered, card.key],
        recentEx: [...s.recentEx, e.ex].slice(-2),
        results: [...s.results, { key: card.key, word: card.word, grade: a.grade, ok: ans.ok }],
      }),
    );
  }

  // Lokal sofort weiterrechnen (optimistisch); gespeichert wird auf dem frischen Stand.
  const knownDoc = knownPass ? knownOp({ ...card.doc }, card.path, null, a.t, s.day, { pending: true }) : null;
  const nextDoc = knownDoc && 'update' in knownDoc ? applyUpdate({ ...card.doc }, knownDoc.update) : applyUpdate({ ...card.doc }, cardPatch({ ...card.doc }, a));
  const updated = (card.kind === 'chunk' ? toChunkCard(card.id, nextDoc, a.t) : toTrainCard(card.id, nextDoc, true, a.t)) ?? card;
  const cards = new Map(s.cards);
  cards.set(card.key, updated);
  const seed = card.inDb || card.kind === 'chunk' ? null : { ...card.doc };
  const immediate = s.results.length === 0 || !!left;

  const shown = { ...s.shown, [card.key]: (s.shown[card.key] ?? 0) + 1 };
  const queue = [...s.queue];
  // Fehler am Partnerwort ändert die Planung nicht (Lernwissenschaft H2): die Hauptkarte kommt in dieser Runde nicht wieder.
  const partnerOnly = card.kind === 'vocab' && isPartnerMiss(card.doc, a);
  // Nach der Werkstatt ruht die Karte (kein „Nochmal“, kein Kontrast in derselben Runde).
  const again = !partnerOnly && !e.wk && isLearningState(updated.fsrs) && updated.fsrs.due - a.t <= AGAIN_WINDOW_MS && (shown[card.key] ?? 0) < MAX_SHOWN;
  // anki-regeln §2: Aufdecken nach 5 anderen Karten (pos + 6), Tippen nach 3 (pos + 4).
  // Wort-Lernen 2: Nach gelungenem Abruf 1 am Tag 0 kommt Abruf 2 frühestens nach 8 weiteren Karten (`DAY0_SECOND_GAP`).
  const day0Passed = e.recall === 'day0a' && ans.grade >= 3;
  if (again) queue.splice(againPos(s.pos, queue.length, e.ex === 'flip', ans.grade >= 3, day0Passed ? DAY0_SECOND_GAP : 0), 0, { key: card.key, reason: 'again', phase: 'quiz' });
  // Wort-Werkstatt: Fehler beim verzögerten Abruf → genau eine Wiederholung nach drei anderen Karten (`wk: 2`, danach nicht mehr).
  if (e.wk && item.wk === 1 && ans.grade === 1) queue.splice(Math.min(queue.length, s.pos + DAY0_FIRST_GAP), 0, { key: card.key, reason: 'again', phase: 'quiz', wk: 2 });
  // P52: Kontrast ZUSÄTZLICH direkt nach der regulären Abfrage (die reguläre Abfrage benotet die Karte wie immer), nur wenn sie richtig war,
  // höchstens 1 je Runde, nie bei neuen Karten, im Anki- oder Hör-Modus und nicht nach Kontrolle/Prüfabfrage; beide Karten mindestens Stufe 2.
  const addContrast = ans.ok && !e.wk && !s.contrasted && e.ex !== 'flip' && !e.check && item.reason !== 'new' && s.mode !== 'listen' && contrastReady(updated, s.pool);
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
    contrasted: s.contrasted || addContrast,
    results: [...s.results, { key: card.key, word: card.word, grade: ans.grade, ok: ans.ok }],
  });
  // B4: Aufdecken-Bewertungen 5 s zurückhalten (Karte, Protokoll, Zähler), solange die Runde
  // weiterläuft. Die letzte Antwort einer Runde gilt sofort: Rundenende, Pflicht, act/Serie und der
  // Einheits-Ablauf bleiben so unverändert (keine zurückgenommenen Zähler, die nie sinken dürfen).
  if (e.ex === 'flip' && next.status !== 'summary' && !left) {
    holdAnswer({ a, seed, immediate, before: s, step: next.step, word: card.word });
    return applyAdvance(next);
  }
  // Mit dem Zeitstempel der Antwort: gespeichert wird genau der Abstand, den „Wieder in …“ zeigte (`answerDueIn`).
  if (knownPass) void saveKnown(card.path, s.day, seed, a.t);
  else void saveCard(a, seed);
  recordAnswer(a, immediate);
  // Sammelakte der Aktivierungen: Satz, Urteil, Vorgabe. Eigener, idempotenter Schreibvorgang (`saveActEntry`); schlägt er fehl, ist nur dieser Eintrag verloren,
  // die Karte (Note, Zähler `na`) ist gespeichert und der Zähler aus `act/…` jederzeit neu berechenbar.
  if (ans.rec && actStep) {
    const r = ans.rec;
    const entry: ActEntry = {
      id: actId(a.t, card.key),
      t: a.t,
      d: s.day,
      c: card.key,
      st: actStep,
      f: e.act?.fmt ?? 'pr',
      a: a.act ?? '',
      s: r.s,
      ...(r.b ? { b: r.b } : {}),
      ...(r.w ? { w: r.w } : {}),
      g: Math.min(3, Math.max(1, a.grade)) as 1 | 2 | 3,
      v: r.v,
      k: r.k,
      ...(r.r ? { r: 1 as const } : {}),
      ...(e.act && !e.act.showTarget ? { ns: 1 as const } : {}),
      ...(r.ts && r.ts.length > 1 ? { ts: r.ts } : {}),
      ...(r.et ? { et: r.et } : {}),
    };
    void saveActEntry(entry);
  }
  return advance(next);
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
  // Punkt 4 (LS3): ein geprüftes, noch nicht mit „Weiter“ bestätigtes Ergebnis wird gebucht – genau einmal.
  flushLeaveBook();
  releaseLeft();
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
  target: number;
  doneBefore: number;
  unit: boolean;
  controls: number;
  /** „Abend-Check“ (nur freier Abruf). */
  free?: boolean;
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
    target: s.target,
    doneBefore: s.doneBefore,
    unit: s.unit,
    controls: s.controls,
    ...(s.free ? { free: true } : {}),
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
    acts: snap.free ? new Map<string, DueStep>() : actPlanFor({ queue: queue.slice(pos), cards: byKey, pool, day, now, mode: snap.mode, env: currentEnv(), lang: useSettings.getState().lang, catchUp: false, ctl }),
    contrasted: queue.some((q) => q.reason === 'contrast'),
    free: snap.free === true,
  };
  prebuilt = null;
  const next = { ...base, ...settle(base, pos) };
  if (next.pos >= next.queue.length) return false;
  useSession.setState(next);
  return true;
}
