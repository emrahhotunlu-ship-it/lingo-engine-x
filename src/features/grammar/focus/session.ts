import { create } from 'zustand';
import { useClock } from '../../../app/clock';
import { useSettings } from '../../../app/settings';
import type { UnitBlockNo, UnitCtx } from '../../../app/unit/types';
import { unitDone } from '../../../app/unit/done';
import { useLive } from '../../../data/live';
import { dueErrors } from '../../../domain/grammar/errors';
import { wholeSentence } from '../../../domain/grammar/tasks';
import type { GrammarAnswer } from '../../../domain/learn/types';
import { buildFocus, unitRepairs, type FocusTask, type FocusVerdict, type TaskLike } from '../../../domain/repair/unit';
import type { Lang } from '../../../domain/srs/types';
import { learnRecorder } from '../../progress/persist';
import { useLearnInputs } from '../../learn/inputs';
import { saveRepairs } from '../../repair/store';

// Block 4 der Tageseinheit „Fokus“ (plan.md §1.5, N41): die Runde wird synchron im Klick gebaut
// (Anbieter `focus`, `start(ctx)`) und eingefroren. Grammatik-Aufgaben schreiben wie in der
// Grammatikrunde über den `LearnRecorder`; verpasste Startsatz-Sätze werden am Ende
// Reparatur-Karten (belegt durch die Startsatz-Lösung, M4c). Das Ende meldet `unitDone(4)`.

export type FocusRow = { id: string; kind: FocusTask['kind']; ok: boolean; verdict: FocusVerdict; right: string };

type State = {
  active: boolean;
  status: 'running' | 'summary';
  day: string;
  lang: Lang;
  /** Block der Einheit, wenn aus der Tageseinheit gestartet (sonst `null`). */
  block: UnitBlockNo | null;
  task: TaskLike | null;
  tasks: FocusTask[];
  pos: number;
  step: number;
  results: FocusRow[];
  missed: Array<{ trapId: string; wrong: string; right: readonly string[] }>;
  activeMs: number;
  lastInteract: number;
  reported: boolean;
};

const initial = (): State => ({
  active: false,
  status: 'running',
  day: '',
  lang: 'de',
  block: null,
  task: null,
  tasks: [],
  pos: 0,
  step: 0,
  results: [],
  missed: [],
  activeMs: 0,
  lastInteract: 0,
  reported: false,
});

export const useFocus = create<State>(initial);

const IDLE_CAP_MS = 60_000;

export type FocusFirst = 'typed' | 'choice' | null;

const inputOf = (t: FocusTask | undefined): FocusFirst => (!t ? null : t.kind !== 'grammar' ? null : t.task.type === 'mc' ? 'choice' : wholeSentence(t.task) ? null : 'typed');

/** Aufgaben aus den Live-Daten von heute (auch für das Herstellen auf einem zweiten Gerät). */
export function focusTasks(day: string, task: TaskLike | null, weekTraps: readonly string[] = []): FocusTask[] {
  const live = useLive.getState();
  return buildFocus({
    day,
    task,
    repairDoc: live.docs['app/repair'] ?? null,
    due: dueErrors(live.collections.grammar ?? new Map(), useClock.getState().now),
    daily: useLearnInputs.getState().dailyOpen,
    weekTraps,
  });
}

/** Block 4 starten (synchron im Klick). `ctx` = aus der Tageseinheit; ohne `ctx` aus den Daten von heute. */
export function startFocus(ctx: Pick<UnitCtx, 'day' | 'block' | 'task' | 'targets'> | null): FocusFirst {
  const day = ctx?.day ?? useClock.getState().today;
  const task: TaskLike | null = ctx?.task ? { text: ctx.task.text, ...(ctx.task.better ? { better: ctx.task.better } : {}), fixes: ctx.task.fixes } : null;
  const tasks = focusTasks(day, task, ctx?.targets.traps ?? []);
  useFocus.setState({
    ...initial(),
    active: true,
    status: tasks.length ? 'running' : 'summary',
    day,
    lang: useSettings.getState().lang,
    block: ctx ? ctx.block : null,
    task,
    tasks,
    step: useFocus.getState().step + 1,
    lastInteract: performance.now(),
  });
  if (!tasks.length) finishFocus();
  return inputOf(tasks[0]);
}

export function touchFocus(): void {
  const s = useFocus.getState();
  if (!s.active) return;
  const now = performance.now();
  const add = s.lastInteract > 0 ? Math.min(IDLE_CAP_MS, Math.max(0, now - s.lastInteract)) : 0;
  useFocus.setState({ activeMs: s.activeMs + add, lastInteract: now });
}

function finishFocus(): void {
  const s = useFocus.getState();
  if (s.reported) return;
  useFocus.setState({ reported: true });
  const add = unitRepairs({ fixes: [], src: 'pattern', missedTraps: s.missed, lang: s.lang });
  if (add.length) void saveRepairs(add);
  const n = s.results.length;
  if (n > 0) {
    void learnRecorder.roundEnd({ day: s.day, act: 'gram', ctx: 'duty', partial: false, n, right: s.results.filter((r) => r.ok).length, activeMs: s.activeMs });
  }
}

/** Den Block abschließen: an die Tageseinheit melden (P1 zählt `act['u-focus']` und führt weiter). */
export function reportFocusDone(): void {
  const s = useFocus.getState();
  if (s.block) unitDone(s.block);
}

/** Ergebnis einer Aufgabe übernehmen und weiter. Rückgabe: Eingabeart der nächsten Aufgabe. */
export function commitFocus(row: FocusRow, extra?: { missed?: { trapId: string; wrong: string; right: readonly string[] }; answer?: GrammarAnswer }): FocusFirst {
  touchFocus();
  const s = useFocus.getState();
  if (s.status !== 'running' || s.tasks[s.pos]?.id !== row.id) return inputOf(s.tasks[s.pos]);
  if (extra?.answer) void learnRecorder.grammar(extra.answer);
  const pos = s.pos + 1;
  const done = pos >= s.tasks.length;
  useFocus.setState({
    results: [...s.results, row],
    missed: extra?.missed ? [...s.missed, extra.missed] : s.missed,
    pos,
    step: s.step + 1,
    status: done ? 'summary' : 'running',
  });
  if (done) finishFocus();
  return inputOf(useFocus.getState().tasks[pos]);
}

/** ✕: Die Runde bleibt für das Fortsetzen stehen; Beantwortetes ist schon gespeichert. */
export function leaveFocus(): void {
  if (!useFocus.getState().active) return;
  useFocus.setState({ active: false });
}

// ------------------------------------------------------------------ Fortsetzen (§3.2)

export type FocusSnap = Pick<State, 'status' | 'day' | 'lang' | 'block' | 'task' | 'tasks' | 'pos' | 'results' | 'missed' | 'reported'>;

export function focusSnapshot(): FocusSnap | null {
  const s = useFocus.getState();
  if (!s.active || !s.tasks.length) return null;
  const { status, day, lang, block, task, tasks, pos, results, missed, reported } = s;
  return { status, day, lang, block, task, tasks, pos, results, missed, reported };
}

/** Synchron herstellen; schreibt nie in die db. */
export function restoreFocus(snap: FocusSnap): boolean {
  if (!snap || !Array.isArray(snap.tasks) || !snap.tasks.length || typeof snap.pos !== 'number' || snap.pos < 0 || snap.pos > snap.tasks.length) return false;
  useFocus.setState({ ...initial(), ...snap, active: true, step: useFocus.getState().step + 1, lastInteract: performance.now() });
  return true;
}
