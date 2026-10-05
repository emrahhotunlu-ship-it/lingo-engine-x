import { create } from 'zustand';
import { unitDone } from '../../app/unit/done';
import type { UnitBlockNo } from '../../app/unit/types';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { useLive } from '../../data/live';
import { lessonMeta } from '../../domain/course/catalog';
import { pickLesson } from '../../domain/course/next';
import { gramRoundPartial, planFocusTopic, ROUND_SIZE, selectRound, wholeSentence, type RoundMode } from '../../domain/grammar/tasks';
import { DUTY_ROUND } from '../../domain/plan/channels';
import type { Ctx, GrammarAnswer, GrammarTask } from '../../domain/learn/types';
import type { Lang } from '../../domain/srs/types';
import { learnRecorder } from '../progress/persist';
import { doneLessonTasks, useLearnInputs } from '../learn/inputs';
import { roundCtx } from '../today/state';
import { useTodayPlan } from '../today/store';

// Eine Grammatikrunde (phase2-plan §5.2): die Aufgaben werden synchron im Klick zusammengestellt
// (Tastatur am iPhone) und für die Runde eingefroren. Jede bewertete Antwort geht sofort über
// den `LearnRecorder` (grammar/<topic> sofort, Log/Zähler/Radar über die Sammel-Warteschlange).

export type GrammarRow = { key: string; topic: string; ok: boolean; verdict: GrammarAnswer['verdict'] };

type State = {
  active: boolean;
  status: 'running' | 'summary';
  mode: RoundMode;
  topic: string | null;
  ctx: Ctx;
  day: string;
  lang: Lang;
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
};

export const useGrammarSession = create<State>(() => ({
  active: false,
  status: 'running',
  mode: 'xtra',
  topic: null,
  ctx: 'xtra',
  day: '',
  lang: 'de',
  tasks: [],
  pos: 0,
  step: 0,
  results: [],
  repeatAt: null,
  startedAt: 0,
  activeMs: 0,
  lastInteract: 0,
  block: null,
}));

const IDLE_CAP_MS = 60_000;
let roundNo = 0;

/** Zusätzliche Aufgaben (z. B. frisch von Claude erzeugt), die in der nächsten Themenrunde vorn stehen. */
let extraTasks: GrammarTask[] = [];
export function setExtraTasks(tasks: readonly GrammarTask[]): void {
  extraTasks = [...tasks];
}

/** `block`/`size`: als Block der Tageseinheit (immer Pflicht, Rundengröße aus dem Plan). */
export type StartOpts = { mode: RoundMode; topic?: string | null; day?: string; block?: UnitBlockNo | null; size?: number };

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
  const todayLesson = plan?.lesson ? lessonMeta(plan.lesson) : null;
  const next = pickLesson({ course: live.docs['app/course'], assess: live.docs['app/assess'], lang });
  const nextTopic = next ? (lessonMeta(next.lid)?.grammar ?? null) : null;
  roundNo++;
  const tasks = selectRound({
    mode,
    topic: o.topic ?? null,
    nextLessonTopic: nextTopic,
    lessonTopicToday: plan?.duty.includes('lesson') ? (todayLesson?.grammar ?? null) : null,
    focusTopic: mode === 'duty' ? planFocusTopic(plan) : null,
    grammarDocs: live.collections.grammar ?? new Map(),
    dailyOpen: [...(mode === 'topic' ? extraTasks : []), ...inputs.dailyOpen],
    pool: inputs.pool,
    lessonTasks: doneLessonTasks(lang),
    nowMs,
    size: o.size ?? ROUND_SIZE[mode],
    seed: `${day}|${mode}|${o.topic ?? ''}|${roundNo}`,
  });
  extraTasks = [];
  useGrammarSession.setState({
    active: true,
    status: tasks.length ? 'running' : 'summary',
    mode,
    topic: o.topic ?? null,
    ctx,
    day,
    lang,
    tasks,
    pos: 0,
    step: useGrammarSession.getState().step + 1,
    results: [],
    repeatAt: null,
    startedAt: performance.now(),
    activeMs: 0,
    lastInteract: performance.now(),
    block: o.block ?? null,
  });
  const first = tasks[0];
  if (!first) return null;
  return first.type === 'mc' ? 'choice' : wholeSentence(first) ? null : 'typed';
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

/** Antwort übernehmen und weiter. Rückgabe: Eingabeart der nächsten Aufgabe. */
export function commitGrammar(a: GrammarAnswer): 'typed' | 'choice' | null {
  touchGrammar();
  const s = useGrammarSession.getState();
  // N47: Die Wiederholung am Rundenende wird nicht noch einmal gespeichert oder gezählt.
  const repeating = inRepeat(s);
  if (!repeating) void learnRecorder.grammar(a);
  const results = repeating ? s.results : [...s.results, { key: a.task.key, topic: a.task.topic, ok: !a.dontKnow && a.verdict !== 'wrong', verdict: a.verdict }];
  const pos = s.pos + 1;
  let tasks = s.tasks;
  let repeatAt = s.repeatAt;
  if (pos >= tasks.length && repeatAt === null) {
    const wrong = new Set(results.filter((r) => !r.ok).map((r) => r.key));
    const again = tasks.filter((t) => wrong.has(t.key)).slice(0, REPEAT_MAX);
    if (again.length) {
      repeatAt = tasks.length;
      tasks = [...tasks, ...again];
    }
  }
  const done = pos >= tasks.length;
  const next: State = { ...s, tasks, repeatAt, results, pos, step: s.step + 1, status: done ? 'summary' : 'running' };
  if (done) finish(next, false);
  useGrammarSession.setState(next);
  const t = next.tasks[pos];
  if (!t || done) return null;
  return t.type === 'mc' ? 'choice' : wholeSentence(t) ? null : 'typed';
}

export function leaveGrammar(): void {
  const s = useGrammarSession.getState();
  if (!s.active) return;
  if (s.status === 'running') finish(s, true);
  useGrammarSession.setState({ active: false });
}

// ------------------------------------------------------------------ Fortsetzen (architektur.md §3.2, G3)

/** Zähler der Grammatik-Runde (R4): Nenner = geplante Runde, Wiederholungen falscher Aufgaben getrennt als `extra`. */
export function grammarProgress(s: Pick<State, 'status' | 'tasks' | 'pos' | 'repeatAt'>): { n: number; total: number; extra: number } | null {
  if (s.status !== 'running') return null;
  const total = s.repeatAt ?? s.tasks.length;
  return { n: Math.min(total, s.pos + 1), total, extra: Math.max(0, s.tasks.length - total) };
}

export type GrammarSnap = Pick<State, 'status' | 'mode' | 'topic' | 'ctx' | 'day' | 'lang' | 'tasks' | 'pos' | 'results' | 'repeatAt'>;

/** Momentaufnahme der laufenden Runde (Aufgaben, Position, Ergebnisse); Antworten liegen schon in der db. */
export function grammarSnapshot(): GrammarSnap | null {
  const s = useGrammarSession.getState();
  if (!s.active || !s.tasks.length) return null;
  const { status, mode, topic, ctx, day, lang, tasks, pos, results, repeatAt } = s;
  return { status, mode, topic, ctx, day, lang, tasks, pos, results, repeatAt };
}

/** Synchron herstellen (gleiche Aufgabe); schreibt nie in die db, aktive Minuten zählen neu. */
export function restoreGrammar(snap: GrammarSnap): boolean {
  if (!snap || !Array.isArray(snap.tasks) || !snap.tasks.length || typeof snap.pos !== 'number' || snap.pos < 0 || snap.pos > snap.tasks.length) return false;
  useGrammarSession.setState({
    ...snap,
    results: Array.isArray(snap.results) ? snap.results : [],
    repeatAt: typeof snap.repeatAt === 'number' ? snap.repeatAt : null,
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
