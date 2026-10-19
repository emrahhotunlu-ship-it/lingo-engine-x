import { legacyNorm } from '../grammar/key';
import { normalizeTask } from '../grammar/tasks';
import type { GrammarTask, TaskSrc } from '../learn/types';
import { judge, type JudgeCtx } from './judge';
import { lintTask, type LintIssue } from './lintTask';
import type { Verdict } from './tutorTypes';

// Annahme von Claude-Aufgaben (Tutor-Engine v3 §6.3, E5; E8 Leitplanke 5 „In der App: `acceptGrammarItem` und `lintTask` ohne `sample`-Aufruf“). Rein,
// deterministisch, ohne KI. Eine erzeugte Aufgabe wird nur angenommen, wenn die App sie selbst nachprüfen kann:
//
//   1. Hülle gültig (`normalizeTask`), `lintTask` ohne Befund (keine Warnung, auch nicht `no_goal`).
//   2. Lösung und jede Variante in `accepted` bestehen das lokale Urteil (`judge`) als `correct`.
//   3. Auswahl: jede andere Option ist nach `judge` falsch (sonst zwei richtige Antworten).
//   4. Satz verbessern: der gezeigte Satz selbst ist weder richtig noch „fast richtig“ (sonst gilt „nichts geändert“ als Lösung).
//   5. Selbstprüfung (`self`, von Claude in derselben Antwort, blind gelöst): `self.solved` wird angenommen, und jede weitere gültige Antwort aus
//      `self.also` ist durch Lösung/`accepted`/britische Form/`alt` gedeckt. Sonst ist die Lösung nicht eindeutig.
//   6. Optional `solve-check@1` (zweiter, unabhängiger Löser): Lösung unter `answers`, kein `ambiguous`, jede Antwort gedeckt.
//
// Was eine Regel verletzt, wird verworfen – mit Grund, damit Tests und Diagnose es zeigen. Kein Neuversuch: die Aufgabe fällt einfach weg.

export type GrammarItemSelf = { solved: string; also: readonly string[] };
export type SolveCheckResult = { answers: readonly string[]; ambiguous: boolean };

export type GrammarItemReject =
  | 'shape'
  | `lint:${LintIssue}`
  | 'answer_not_correct'
  | 'accepted_not_correct'
  | 'distractor_ok'
  | 'error_kept'
  | 'self_missing'
  | 'self_wrong'
  | 'also_uncovered'
  | 'solve_missing'
  | 'solve_ambiguous'
  | 'solve_uncovered';

export type AcceptedGrammarItem = { task: GrammarTask | null; reasons: GrammarItemReject[] };

export type AcceptGrammarOpts = {
  src?: TaskSrc;
  /** Selbstprüfung Pflicht? (`grammar-items@5` und die Routine: ja). */
  requireSelf?: boolean;
  /** Ergebnis von `solve-check@1` für genau diese Aufgabe (ohne: Regel 6 entfällt). */
  solve?: SolveCheckResult | null;
};

/** Lokales Urteil ohne KI, ohne gelernte Alternativen (eine neue Aufgabe hat keine). */
const NO_AI: JudgeCtx = { fitAlt: {}, aiState: { confirmed: false, available: false, budgetLeft: 0 } };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

/** Urteil über eine Antwort auf die neue Aufgabe. */
export const verdictOf = (task: GrammarTask, given: string): Verdict => judge(task, given, NO_AI).v;

/** Gedeckt = die App nimmt die Antwort als richtig oder „auch richtig“ an (Lösung, `accepted`, britische Form, Familie, `alt`). */
export const covered = (task: GrammarTask, given: string): boolean => {
  const v = verdictOf(task, given);
  return v === 'correct' || v === 'alt_ok';
};

/** Ziel-Satz (`goal`) einer Aufgabe tolerant lesen; nur zweisprachig gültig. */
function goalOf(raw: Record<string, unknown>): { de: string; en: string } | null {
  const g = raw.goal;
  if (!isObj(g)) return null;
  const de = str(g.de);
  const en = str(g.en);
  return de && en ? { de, en } : null;
}

/** Selbstprüfung tolerant lesen (`{solved, also[]}`); `also` höchstens 4. */
export function selfOf(raw: unknown): GrammarItemSelf | null {
  if (!isObj(raw) || !isObj(raw.self)) return null;
  const solved = str(raw.self.solved);
  if (!solved) return null;
  const also = (Array.isArray(raw.self.also) ? raw.self.also : []).map(str).filter(Boolean).slice(0, 4);
  return { solved, also };
}

/**
 * Prüft EINE erzeugte Aufgabe (Pool-Format der alten App, dazu optional `goal{de,en}` und `self{solved, also[]}`).
 * `task` ist nur gesetzt, wenn keine Regel verletzt ist.
 */
export function acceptGrammarItem(raw: unknown, opts: AcceptGrammarOpts = {}): AcceptedGrammarItem {
  const reasons: GrammarItemReject[] = [];
  const reject = (): AcceptedGrammarItem => ({ task: null, reasons });
  if (!isObj(raw)) return (reasons.push('shape'), reject());
  const base = normalizeTask(raw, opts.src ?? 'ai');
  if (!base) return (reasons.push('shape'), reject());
  const goal = goalOf(raw);
  const task: GrammarTask = goal ? { ...base, goal } : base;

  for (const issue of lintTask(task)) reasons.push(`lint:${issue}`);
  if (verdictOf(task, task.answer) !== 'correct') reasons.push('answer_not_correct');
  if (task.accepted.some((a) => verdictOf(task, a) !== 'correct')) reasons.push('accepted_not_correct');
  if (task.type === 'mc') {
    // Die Auswahl selbst kennt nur die eine Option; als getippte Lücke geprüft greifen britische Form, Familien und `alt` (z. B. „is organised“).
    const ans = legacyNorm(task.answer);
    const asGap: GrammarTask = { ...task, type: 'gap', options: null };
    if ((task.options ?? []).some((o) => legacyNorm(o) !== ans && (covered(task, o) || covered(asGap, o)))) reasons.push('distractor_ok');
  }
  if (task.type === 'correct' && ['correct', 'alt_ok', 'near'].includes(verdictOf(task, task.prompt))) reasons.push('error_kept');

  const self = selfOf(raw);
  if (!self) {
    if (opts.requireSelf) reasons.push('self_missing');
  } else {
    if (!covered(task, self.solved)) reasons.push('self_wrong');
    if (self.also.some((a) => !covered(task, a))) reasons.push('also_uncovered');
  }

  const sc = opts.solve;
  if (sc) {
    if (sc.ambiguous) reasons.push('solve_ambiguous');
    const answers = sc.answers.map(str).filter(Boolean);
    if (!answers.some((a) => verdictOf(task, a) === 'correct')) reasons.push('solve_missing');
    if (answers.some((a) => !covered(task, a))) reasons.push('solve_uncovered');
  }
  return reasons.length ? reject() : { task, reasons };
}

export type GrammarBatchResult = { tasks: GrammarTask[]; dropped: Array<{ i: number; reasons: GrammarItemReject[] }> };

/** Mehrere Aufgaben: jede für sich (eine schlechte reißt die anderen nicht mit). `solve[i]` gehört zu `raws[i]`. */
export function acceptGrammarItems(raws: readonly unknown[], opts: Omit<AcceptGrammarOpts, 'solve'> & { solve?: ReadonlyArray<SolveCheckResult | null> } = {}): GrammarBatchResult {
  const out: GrammarBatchResult = { tasks: [], dropped: [] };
  const keys = new Set<string>();
  raws.forEach((raw, i) => {
    const r = acceptGrammarItem(raw, { ...(opts.src ? { src: opts.src } : {}), ...(opts.requireSelf ? { requireSelf: true } : {}), solve: opts.solve?.[i] ?? null });
    if (!r.task) out.dropped.push({ i, reasons: r.reasons });
    else if (keys.has(r.task.key)) out.dropped.push({ i, reasons: ['shape'] });
    else {
      keys.add(r.task.key);
      out.tasks.push(r.task);
    }
  });
  return out;
}
