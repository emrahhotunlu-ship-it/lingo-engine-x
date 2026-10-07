import { create } from 'zustand';
import { unitDone } from '../../app/unit/done';
import type { UnitBlockNo } from '../../app/unit/types';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { answerRight } from '../../domain/learn/right';
import { useLive } from '../../data/live';
import { topicById } from '../../domain/content';
import { isNewTopic, introTopic, stepDownTasks } from '../../domain/grammar/path';
import { patternsOf } from '../../domain/grammar/patterns';
import {
  allSeedTasks,
  gramRoundPartial,
  INTRO_TASKS,
  planFocusTopic,
  ROUND_SIZE,
  selectRound,
  selectVortest,
  variantOf,
  wholeSentence,
  type InputProfile,
  type RoundInput,
  type RoundMode,
} from '../../domain/grammar/tasks';
import { patPush, patsOf, type PatEntry } from '../../domain/metrics/pattern';
import { DUTY_ROUND } from '../../domain/plan/channels';
import { planRvOf, unitGrammarArgs } from '../../domain/unit/plan';
import type { Ctx, GrammarAnswer, GrammarTask } from '../../domain/learn/types';
import type { Lang } from '../../domain/srs/types';
import { logWarn } from '../../platform/diagnostics';
import { inputProfile } from '../../platform/input';
import { learnRecorder } from '../progress/persist';
import { useLearnInputs } from '../learn/inputs';
import { roundCtx } from '../today/state';
import { useTodayPlan } from '../today/store';
import { allTrainCards } from '../vocab/session';
import { wordsToday } from '../../domain/metrics';

// Eine Grammatikrunde (phase2-plan §5.2): die Aufgaben werden synchron im Klick zusammengestellt
// (Tastatur am iPhone) und für die Runde eingefroren. Jede bewertete Antwort geht sofort über
// den `LearnRecorder` (grammar/<topic> sofort, Log/Zähler/Radar über die Sammel-Warteschlange).
//
// Lernplattform 2.0 (§5.3): Die Runde liest das eingefrorene Tagesthema (`u.gt`). Am Einführungstag eines neuen Themas stehen vorn
// zwei Vortest-Aufgaben; bestanden entfallen die Karten und es geht gemischt weiter, sonst folgen die Musterkarten und 4 Aufgaben
// am Stück. Ein Folgeschritt eines begonnenen Themas beginnt gleich mit den Karten. Das Eingabeprofil wird einmal eingefroren.

export type GrammarRow = {
  key: string;
  topic: string;
  ok: boolean;
  verdict: GrammarAnswer['verdict'];
  /** Ab Lernplattform 2.0; ältere gespeicherte Runden haben diese Felder nicht. */
  pat?: string | null;
  help?: boolean;
  given?: string;
  right?: string;
  dontKnow?: boolean;
  /** Richtig, ohne Hilfe und schnell genug (Vortest, §5.3). */
  clean?: boolean;
};

/** Einführung des Tages in dieser Runde (nur wenn es Karten oder einen Vortest gibt). */
export type IntroState = {
  topic: string;
  /** Muster des heutigen Schritts (leer: Thema ohne Musterdatei, dann die alte Regelkarte). */
  pats: string[];
  /** Erster Schritt eines neuen Themas. */
  fresh: boolean;
  /** Zahl der Vortest-Aufgaben vorn (0 oder 2). */
  vtN: number;
  /** Karten schon gesehen? */
  cards: 'pending' | 'done';
  /** Vortest: `null` = noch nicht entschieden. */
  passed: boolean | null;
  /** Gemischter Ersatz für die Einführungsaufgaben, falls der Vortest besteht. */
  alt: GrammarTask[];
  /** Position und Länge des Einführungsblocks in `tasks` (Ersatz-Stelle). */
  blockAt: number;
  blockLen: number;
};

type State = {
  active: boolean;
  status: 'running' | 'summary';
  mode: RoundMode;
  topic: string | null;
  ctx: Ctx;
  day: string;
  lang: Lang;
  /** Eingabeprofil der Runde, einmal beim Start eingefroren. */
  profile: InputProfile;
  /** Regelversion des Plans beim Start (2: keine identische Wiederholung). */
  rv: 1 | 2;
  tasks: GrammarTask[];
  pos: number;
  step: number;
  results: GrammarRow[];
  /** N47: Ab dieser Stelle stehen die falschen Aufgaben der Runde noch einmal (nur Übung, nicht gezählt). */
  repeatAt: number | null;
  startedAt: number;
  activeMs: number;
  lastInteract: number;
  /** Block der Tageseinheit (Grammatik als Block 2 seit 04.10.2026), sonst `null`. */
  block: UnitBlockNo | null;
  /** Einführung (Vortest, Karten), sonst `null`. */
  intro: IntroState | null;
  /** Muster-Einträge vom Start der Runde (für „was hat sich bewegt“ am Ende). */
  before: Record<string, PatEntry | undefined>;
  /** Beantwortete Aufgaben der Runde nach Muster, in Reihenfolge (für den Zuwachs am Ende). */
  patLog: Array<{ pat: string; ok: boolean; help: boolean; t: number }>;
};

export const useGrammarSession = create<State>(() => ({
  active: false,
  status: 'running',
  mode: 'xtra',
  topic: null,
  ctx: 'xtra',
  day: '',
  lang: 'de',
  profile: 'keys',
  rv: 1,
  tasks: [],
  pos: 0,
  step: 0,
  results: [],
  repeatAt: null,
  startedAt: 0,
  activeMs: 0,
  lastInteract: 0,
  block: null,
  intro: null,
  before: {},
  patLog: [],
}));

const IDLE_CAP_MS = 60_000;
let roundNo = 0;

/** Zusätzliche Aufgaben (z. B. frisch von Claude erzeugt), die in der nächsten Themenrunde vorn stehen. */
let extraTasks: GrammarTask[] = [];
export function setExtraTasks(tasks: readonly GrammarTask[]): void {
  extraTasks = [...tasks];
}

/** Auswahlzustand der laufenden Runde (für die Varianten am Rundenende). Nur im Speicher. */
let ctxInput: Pick<RoundInput, 'grammarDocs' | 'dailyOpen' | 'pool' | 'seed' | 'gt' | 'profile' | 'wordsToday'> | null = null;

/** `block`/`size`: als Block der Tageseinheit (immer Pflicht, Rundengröße aus dem Plan). `pat`: nur dieses Muster üben (Themenblatt, 4 Aufgaben). */
export type StartOpts = { mode: RoundMode; topic?: string | null; day?: string; block?: UnitBlockNo | null; size?: number; pat?: string | null };

/** Lemmata der Karten von heute (Gleichstand-Brecher der Rundenwahl); ohne Karten leer. */
function safeWords(nowMs: number, plan: ReturnType<typeof useTodayPlan.getState>['plan']): string[] {
  try {
    return wordsToday({ cards: allTrainCards(nowMs), plan, nowMs });
  } catch (err) {
    logWarn('grammar:words', err);
    return [];
  }
}

const kindOf = (t: GrammarTask | undefined): 'typed' | 'choice' | null => (!t ? null : t.type === 'mc' || t.type === 'meaning' ? 'choice' : wholeSentence(t) ? null : 'typed');

/** Anfangs gibt es für den ersten Handler noch keine Karten: dann ist die erste Aufgabe der Vortest oder die erste Aufgabe. */
function firstKind(s: Pick<State, 'tasks' | 'intro'>): 'typed' | 'choice' | null {
  if (s.intro && s.intro.vtN === 0 && s.intro.cards === 'pending') return null;
  return kindOf(s.tasks[0]);
}

/** Runde bauen. Rückgabe: Eingabeart der ersten Aufgabe (für den Fokus im selben Handler). */
export function startGrammar(o: StartOpts): 'typed' | 'choice' | null {
  const live = useLive.getState();
  const nowMs = useClock.getState().now;
  const day = o.day ?? useClock.getState().today;
  const lang = useSettings.getState().lang;
  const inputs = useLearnInputs.getState();
  // D9: Eine Grammatikrunde, solange „Grammatik" heute Pflicht und offen ist, zählt als Pflicht.
  const ctx: Ctx = o.block ? 'duty' : roundCtx('gram', day);
  let mode: RoundMode = o.mode;
  if (mode === 'xtra' && ctx === 'duty') mode = 'duty';
  if (mode === 'duty' && ctx !== 'duty') mode = 'xtra';
  const plan = useTodayPlan.getState().plan;
  const docs = live.collections.grammar ?? new Map<string, Record<string, unknown>>();
  const profile = inputProfile();
  // Der Plan von heute friert das Tagesthema ein (`u.gt`); ältere Pläne ohne `gt` rechnen wie bisher.
  const gt = mode === 'duty' ? (plan?.u?.gt ?? null) : null;
  const rv = planRvOf(plan);
  const errorsMax = mode === 'duty' ? unitGrammarArgs(plan).errs : undefined;
  const words = safeWords(nowMs, plan);
  roundNo++;
  const seed = `${day}|${mode}|${o.topic ?? ''}|${roundNo}`;
  const base = {
    grammarDocs: docs,
    dailyOpen: [...(mode === 'topic' ? extraTasks : []), ...inputs.dailyOpen],
    pool: inputs.pool,
    seed,
    gt,
    profile,
    wordsToday: words,
  } as const;
  const common = { ...base, nowMs, topic: o.topic ?? null, ...(errorsMax !== undefined ? { errorsMax } : {}) };

  let tasks: GrammarTask[];
  let intro: IntroState | null = null;
  const size = o.size ?? ROUND_SIZE[mode];
  const introTopicId = gt ? gt.intro : null;

  if (o.pat && o.topic) {
    // Ein Muster üben (Themenblatt): 4 Aufgaben nur dieses Musters.
    tasks = selectRound({ ...common, mode: 'topic', size: 4, errorsMax: 0, introBlock: { topic: o.topic, pats: [o.pat] }, gt: null });
  } else if (gt && introTopicId && topicById(introTopicId)) {
    const pats = gt.pats.filter((p) => patternsOf(introTopicId)?.patterns.some((x) => x.id === p));
    const fresh = isNewTopic(docs.get(introTopicId));
    if (pats.length) {
      const vt = fresh ? selectVortest({ ...base, mode: 'duty', topic: introTopicId, pats, introduce: introTopicId }) : [];
      const vtN = vt.length === 2 ? 2 : 0;
      const exclude = new Set(vtN ? vt.map((x) => x.key) : []);
      const main = selectRound({ ...common, mode, size: Math.max(1, size - vtN), introBlock: { topic: introTopicId, pats }, exclude });
      // Lage des Einführungsblocks in `main` (Fehlersätze stehen davor).
      const at = main.findIndex((x) => x.errorT === null && x.topic === introTopicId && !!x.pat && pats.includes(x.pat));
      let len = 0;
      while (at >= 0 && len < INTRO_TASKS && main[at + len] && main[at + len]!.topic === introTopicId && pats.includes(main[at + len]!.pat ?? '') && main[at + len]!.errorT === null) len++;
      const alt = vtN && len ? selectRound({ ...common, mode, size: len, introBlock: null, errorsMax: 0, exclude: new Set([...exclude, ...main.map((x) => x.key)]) }) : [];
      tasks = [...(vtN ? vt : []), ...main];
      intro = { topic: introTopicId, pats, fresh, vtN, cards: 'pending', passed: null, alt, blockAt: Math.max(0, at) + vtN, blockLen: len };
    } else {
      // Thema ohne Musterdatei: wie bisher eine Regelkarte vor der ersten Aufgabe.
      tasks = selectRound({ ...common, mode, size });
      if (fresh) intro = { topic: introTopicId, pats: [], fresh: true, vtN: 0, cards: 'pending', passed: null, alt: [], blockAt: 0, blockLen: 0 };
    }
  } else {
    tasks = selectRound({
      ...common,
      mode,
      size,
      // Einführungsbremse (höchstens 1 neues Thema je 3 Lerntage, nie bei ≥ 10 offenen Fehlersätzen): nur die Pflichtrunde führt ein Thema ein.
      introduce: mode === 'duty' && !gt ? introTopic(docs, day, nowMs) : null,
      focusTopic: mode === 'duty' && !gt ? planFocusTopic(plan) : null,
    });
    // Regelkarte vor der ersten Runde eines neuen Themas (Lernweg ①): das erste Thema der Runde, das noch nie geübt wurde.
    const t0 = tasks.find((t) => t.errorT === null && isNewTopic(docs.get(t.topic)))?.topic ?? null;
    if (t0) {
      const pats = (patternsOf(t0)?.introPlan[0] ?? []).slice(0, 2);
      intro = { topic: t0, pats, fresh: true, vtN: 0, cards: 'pending', passed: null, alt: [], blockAt: 0, blockLen: 0 };
    }
  }
  extraTasks = [];
  ctxInput = { grammarDocs: docs, dailyOpen: base.dailyOpen, pool: base.pool, seed, gt, profile, wordsToday: words };

  // Stand der Muster beim Start: Grundlage für „was hat sich bewegt“.
  const before: Record<string, PatEntry | undefined> = {};
  for (const t of tasks) if (t.pat && !(t.pat in before)) before[t.pat] = patsOf(docs.get(t.topic))[t.pat];
  const next: Partial<State> = {
    intro,
    active: true,
    status: tasks.length ? 'running' : 'summary',
    mode,
    topic: o.topic ?? null,
    ctx,
    day,
    lang,
    profile,
    rv,
    tasks,
    pos: 0,
    step: useGrammarSession.getState().step + 1,
    results: [],
    repeatAt: null,
    startedAt: performance.now(),
    activeMs: 0,
    lastInteract: performance.now(),
    block: o.block ?? null,
    before,
    patLog: [],
  };
  useGrammarSession.setState(next);
  return tasks.length ? firstKind({ tasks, intro }) : null;
}

/** Block der Tageseinheit abschließen (Knopf „Weiter“ in der Zusammenfassung). */
export function reportGrammarDone(): void {
  const s = useGrammarSession.getState();
  if (s.block) unitDone(s.block);
}

export function touchGrammar(): void {
  const s = useGrammarSession.getState();
  if (!s.active) return;
  const now = performance.now();
  const add = s.lastInteract > 0 ? Math.min(IDLE_CAP_MS, Math.max(0, now - s.lastInteract)) : 0;
  useGrammarSession.setState({ activeMs: s.activeMs + add, lastInteract: now });
}

/** Höchstens so viele falsche Aufgaben kommen am Rundenende noch einmal (N47). */
export const REPEAT_MAX = 3;

/** Steht die Runde gerade in der Wiederholung der falschen Aufgaben? */
export const inRepeat = (s: Pick<State, 'repeatAt' | 'pos'>): boolean => s.repeatAt !== null && s.pos >= s.repeatAt;

/** Sind jetzt die Musterkarten (bzw. die Regelkarte) dran? Vor der ersten Aufgabe, bzw. nach dem nicht bestandenen Vortest. */
export const cardsDue = (s: Pick<State, 'status' | 'pos' | 'intro'>): boolean => s.status === 'running' && !!s.intro && s.intro.cards === 'pending' && s.pos === s.intro.vtN && s.intro.passed !== true;

/** Läuft gerade der Vortest (Position 0 oder 1 bei zwei Vortest-Aufgaben)? */
export const inVortest = (s: Pick<State, 'pos' | 'intro' | 'status'>): boolean => s.status === 'running' && !!s.intro && s.pos < s.intro.vtN;

function finish(s: State, aborted0: boolean): void {
  const n = s.results.length;
  if (n < 1) return;
  // Die Wiederholung am Ende ist freiwillige Übung: Abbruch dort ist kein Abbruch der Runde.
  const aborted = aborted0 && !inRepeat(s);
  void learnRecorder.roundEnd({
    day: s.day,
    act: 'gram',
    ctx: s.ctx,
    partial: gramRoundPartial({ aborted, pos: Math.min(s.pos, s.repeatAt ?? s.tasks.length), tasks: s.repeatAt ?? s.tasks.length, ctx: s.ctx, mode: s.mode, answers: n, dutyMin: DUTY_ROUND.gram }),
    n,
    right: s.results.filter((r) => r.ok).length,
    activeMs: s.activeMs,
  });
}

const isOk = (a: GrammarAnswer): boolean => answerRight(a) && a.firstWrong === undefined;

/** Vortest bestanden (§5.3): beide Aufgaben richtig, ohne Hilfe, jede in höchstens 20 s. */
const VT_MS = 20_000;
const cleanAnswer = (a: GrammarAnswer): boolean => isOk(a) && a.help.level === 0 && a.ms <= VT_MS;

/** Antwort übernehmen und weiter. Rückgabe: Eingabeart der nächsten Aufgabe. */
export function commitGrammar(a0: GrammarAnswer): 'typed' | 'choice' | null {
  touchGrammar();
  const s = useGrammarSession.getState();
  let a = a0;
  // N47: Die Wiederholung am Rundenende wird nicht noch einmal gespeichert oder gezählt.
  const repeating = inRepeat(s);
  let intro = s.intro;
  let tasks = s.tasks;
  // Vortest: Mit der zweiten Antwort steht das Ergebnis fest und geht als `vt` mit dieser Antwort ins Thema.
  if (intro && !repeating && intro.vtN === 2 && s.pos === 1 && intro.passed === null) {
    const ok = s.results[0]?.clean === true && cleanAnswer(a);
    const pats = [...new Set([tasks[0]?.pat, tasks[1]?.pat].filter((x): x is string => !!x))];
    a = { ...a, vt: { ok, pats } };
    intro = { ...intro, passed: ok };
    if (ok && intro.alt.length && intro.blockLen) {
      tasks = [...tasks.slice(0, intro.blockAt), ...intro.alt.slice(0, intro.blockLen), ...tasks.slice(intro.blockAt + intro.blockLen)];
      intro = { ...intro, cards: 'done' };
    }
  }
  if (!repeating) void learnRecorder.grammar(a);
  const row: GrammarRow = {
    key: a.task.key,
    topic: a.task.topic,
    ok: isOk(a),
    verdict: a.verdict,
    pat: a.task.pat ?? null,
    help: a.help.level > 0 || a.firstWrong !== undefined,
    given: a.firstWrong ?? a.given,
    right: a.task.x?.kind === 'find' && a.task.x.fixed ? a.task.x.fixed : a.task.prompt.includes('___') ? a.task.prompt.replace(/_{3,}/, a.task.answer) : a.task.answer,
    dontKnow: a.dontKnow,
    clean: cleanAnswer(a),
  };
  const results = repeating ? s.results : [...s.results, row];
  const patLog = repeating || !a.task.pat ? s.patLog : [...s.patLog, { pat: a.task.pat, ok: row.ok, help: row.help ?? false, t: a.t }];
  const pos = s.pos + 1;
  let repeatAt = s.repeatAt;
  if (pos >= tasks.length && repeatAt === null) {
    const wrong = new Set(results.filter((r) => !r.ok).map((r) => r.key));
    const used = new Set(tasks.map((t) => t.key));
    const again: GrammarTask[] = [];
    for (const t of tasks.filter((x) => wrong.has(x.key))) {
      if (again.length >= REPEAT_MAX) break;
      // Eine ungesehene Variante desselben Musters statt derselben Aufgabe (§4.7). Ohne Muster gilt nur in Plänen der alten Regel dieselbe Aufgabe.
      if (t.pat && ctxInput) {
        const v = variantOf(t, { mode: 'xtra', ...ctxInput, exclude: used });
        if (v) {
          used.add(v.key);
          again.push({ ...v, errorT: null });
        }
      } else if (s.rv === 1) again.push(t);
    }
    if (again.length) {
      repeatAt = tasks.length;
      tasks = [...tasks, ...again];
    }
  }
  const done = pos >= tasks.length;
  const next: State = { ...s, tasks, intro, repeatAt, results, patLog, pos, step: s.step + 1, status: done ? 'summary' : 'running' };
  if (!done && !inRepeat(next) && !cardsDue(next)) {
    // Rückstufung: zwei Fehlschläge in Folge im Thema der nächsten Aufgabe → eine Form leichter (nur in dieser Runde), gleiches Muster.
    const live = useLive.getState();
    const nextTask = tasks[pos];
    const nextTopic = nextTask?.topic;
    const seen = new Set<string>(nextTopic && Array.isArray(live.collections.grammar?.get(nextTopic)?.seen) ? (live.collections.grammar?.get(nextTopic)?.seen as unknown[]).map(String) : []);
    const inputs = useLearnInputs.getState();
    const samePat = (c: GrammarTask) => !nextTask?.pat || c.pat === nextTask.pat;
    const cands = [...inputs.dailyOpen, ...inputs.pool, ...allSeedTasks()].filter((c) => samePat(c) && (s.profile === 'keys' || !wholeSentence(c)));
    next.tasks = stepDownTasks(tasks, pos, results, cands, seen);
  }
  if (done) finish(next, false);
  useGrammarSession.setState(next);
  const t = next.tasks[pos];
  if (!t || done) return null;
  if (cardsDue(next)) return null;
  return kindOf(t);
}

/** „Los“ in der Einführung: die erste (bzw. nächste) Aufgabe erscheint. Rückgabe: Eingabeart dieser Aufgabe (für den Fokus im selben Handler). */
export function startAfterIntro(): 'typed' | 'choice' | null {
  const s = useGrammarSession.getState();
  if (!s.intro || s.intro.cards !== 'pending') return null;
  useGrammarSession.setState({ intro: { ...s.intro, cards: 'done' }, step: s.step + 1, startedAt: performance.now(), lastInteract: performance.now() });
  return kindOf(s.tasks[s.pos]);
}

export function leaveGrammar(): void {
  const s = useGrammarSession.getState();
  if (!s.active) return;
  if (s.status === 'running') finish(s, true);
  useGrammarSession.setState({ active: false });
}

/** Stand der Muster am Rundenende: die Einträge vom Start plus alle Antworten der Runde (`patPush`, dieselbe Regel wie beim Schreiben). */
export function patternGrowth(s: Pick<State, 'before' | 'patLog' | 'day'>): Array<{ pat: string; from: PatEntry | undefined; to: PatEntry; n: number; clean: number }> {
  const out = new Map<string, { from: PatEntry | undefined; to: PatEntry; n: number; clean: number }>();
  for (const e of s.patLog) {
    const cur = out.get(e.pat);
    const from = cur ? cur.from : s.before[e.pat];
    const prev = cur ? cur.to : s.before[e.pat];
    const to = patPush(prev, { ok: e.ok, help: e.help, day: s.day, t: e.t });
    out.set(e.pat, { from, to, n: (cur?.n ?? 0) + 1, clean: (cur?.clean ?? 0) + (e.ok && !e.help ? 1 : 0) });
  }
  return [...out.entries()].map(([pat, v]) => ({ pat, ...v }));
}

// ------------------------------------------------------------------ Fortsetzen (architektur.md §3.2, G3)

/** Zähler der Grammatik-Runde (R4): Nenner = geplante Runde, Wiederholungen falscher Aufgaben getrennt als `extra`. */
export function grammarProgress(s: Pick<State, 'status' | 'tasks' | 'pos' | 'repeatAt'>): { n: number; total: number; extra: number } | null {
  if (s.status !== 'running') return null;
  const total = s.repeatAt ?? s.tasks.length;
  return { n: Math.min(total, s.pos + 1), total, extra: Math.max(0, s.tasks.length - total) };
}

export type GrammarSnap = Pick<State, 'status' | 'mode' | 'topic' | 'ctx' | 'day' | 'lang' | 'tasks' | 'pos' | 'results' | 'repeatAt'> & {
  /** Älterer Stand: nur das Thema der Regelkarte. */
  intro?: IntroState | string | null;
  profile?: InputProfile;
  rv?: 1 | 2;
  before?: State['before'];
  patLog?: State['patLog'];
};

/** Momentaufnahme der laufenden Runde (Aufgaben, Position, Ergebnisse); Antworten liegen schon in der db. */
export function grammarSnapshot(): GrammarSnap | null {
  const s = useGrammarSession.getState();
  if (!s.active || !s.tasks.length) return null;
  const { status, mode, topic, ctx, day, lang, tasks, pos, results, repeatAt, intro, profile, rv, before, patLog } = s;
  return { status, mode, topic, ctx, day, lang, tasks, pos, results, repeatAt, intro, profile, rv, before, patLog };
}

const legacyIntro = (topic: string): IntroState => ({ topic, pats: [], fresh: true, vtN: 0, cards: 'pending', passed: null, alt: [], blockAt: 0, blockLen: 0 });

/** Synchron herstellen (gleiche Aufgabe); schreibt nie in die db, aktive Minuten zählen neu. */
export function restoreGrammar(snap: GrammarSnap): boolean {
  if (!snap || !Array.isArray(snap.tasks) || !snap.tasks.length || typeof snap.pos !== 'number' || snap.pos < 0 || snap.pos > snap.tasks.length) return false;
  const raw = snap.intro;
  const intro: IntroState | null = typeof raw === 'string' ? (snap.pos === 0 ? legacyIntro(raw) : null) : raw && typeof raw === 'object' ? raw : null;
  useGrammarSession.setState({
    ...snap,
    results: Array.isArray(snap.results) ? snap.results : [],
    repeatAt: typeof snap.repeatAt === 'number' ? snap.repeatAt : null,
    intro,
    profile: snap.profile === 'touch' || snap.profile === 'keys' ? snap.profile : inputProfile(),
    rv: snap.rv === 2 ? 2 : 1,
    before: snap.before && typeof snap.before === 'object' ? snap.before : {},
    patLog: Array.isArray(snap.patLog) ? snap.patLog : [],
    active: true,
    step: useGrammarSession.getState().step + 1,
    startedAt: performance.now(),
    activeMs: 0,
    lastInteract: performance.now(),
  });
  return true;
}

/** Fehlergrenze (G4): kaputte Aufgabe ohne Bewertung überspringen. */
export function skipGrammar(): void {
  const s = useGrammarSession.getState();
  if (!s.active || s.status !== 'running') return;
  const pos = s.pos + 1;
  const done = pos >= s.tasks.length;
  const next: State = { ...s, pos, step: s.step + 1, status: done ? 'summary' : 'running' };
  if (done) finish(next, false);
  useGrammarSession.setState(next);
}

