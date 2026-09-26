import { create } from 'zustand';
import { useClock } from '../../app/clock';
import { useSettings } from '../../app/settings';
import { useLive } from '../../data/live';
import { lessonMeta } from '../../domain/course/catalog';
import { pickLesson } from '../../domain/course/next';
import { ROUND_SIZE, selectRound, type RoundMode } from '../../domain/grammar/tasks';
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
  startedAt: number;
  activeMs: number;
  lastInteract: number;
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
  startedAt: 0,
  activeMs: 0,
  lastInteract: 0,
}));

const IDLE_CAP_MS = 60_000;
let roundNo = 0;

/** Zusätzliche Aufgaben (z. B. frisch von Claude erzeugt), die in der nächsten Themenrunde vorn stehen. */
let extraTasks: GrammarTask[] = [];
export function setExtraTasks(tasks: readonly GrammarTask[]): void {
  extraTasks = [...tasks];
}

export type StartOpts = { mode: RoundMode; topic?: string | null; day?: string };

/** Runde bauen. Rückgabe: Eingabeart der ersten Aufgabe (für den Fokus im selben Handler). */
export function startGrammar(o: StartOpts): 'typed' | 'choice' | null {
  const live = useLive.getState();
  const nowMs = useClock.getState().now;
  const day = o.day ?? useClock.getState().today;
  const lang = useSettings.getState().lang;
  const inputs = useLearnInputs.getState();
  // D9: Eine Grammatikrunde, solange „Grammatik" heute Pflicht und offen ist, zählt als Pflicht.
  const ctx: Ctx = roundCtx('gram', day);
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
    grammarDocs: live.collections.grammar ?? new Map(),
    dailyOpen: [...(mode === 'topic' ? extraTasks : []), ...inputs.dailyOpen],
    pool: inputs.pool,
    lessonTasks: doneLessonTasks(lang),
    nowMs,
    size: ROUND_SIZE[mode],
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
    startedAt: performance.now(),
    activeMs: 0,
    lastInteract: performance.now(),
  });
  const first = tasks[0];
  if (!first) return null;
  return first.type === 'mc' ? 'choice' : first.type === 'gap' || first.type === 'transform' ? 'typed' : null;
}

export function touchGrammar(): void {
  const s = useGrammarSession.getState();
  if (!s.active) return;
  const now = performance.now();
  const add = s.lastInteract > 0 ? Math.min(IDLE_CAP_MS, Math.max(0, now - s.lastInteract)) : 0;
  useGrammarSession.setState({ activeMs: s.activeMs + add, lastInteract: now });
}

function finish(s: State, aborted: boolean): void {
  const n = s.results.length;
  if (n < 1) return;
  void learnRecorder.roundEnd({
    day: s.day,
    act: 'gram',
    ctx: s.ctx,
    partial: aborted && s.pos < s.tasks.length,
    n,
    right: s.results.filter((r) => r.ok).length,
    activeMs: s.activeMs,
  });
}

/** Antwort übernehmen und weiter. Rückgabe: Eingabeart der nächsten Aufgabe. */
export function commitGrammar(a: GrammarAnswer): 'typed' | 'choice' | null {
  touchGrammar();
  const s = useGrammarSession.getState();
  void learnRecorder.grammar(a);
  const results = [...s.results, { key: a.task.key, topic: a.task.topic, ok: !a.dontKnow && a.verdict !== 'wrong', verdict: a.verdict }];
  const pos = s.pos + 1;
  const done = pos >= s.tasks.length;
  const next: State = { ...s, results, pos, step: s.step + 1, status: done ? 'summary' : 'running' };
  if (done) finish(next, false);
  useGrammarSession.setState(next);
  const t = next.tasks[pos];
  if (!t || done) return null;
  return t.type === 'mc' ? 'choice' : t.type === 'correct' ? null : 'typed';
}

export function leaveGrammar(): void {
  const s = useGrammarSession.getState();
  if (!s.active) return;
  if (s.status === 'running') finish(s, true);
  useGrammarSession.setState({ active: false });
}
