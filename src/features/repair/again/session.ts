import { create } from 'zustand';
import { useClock } from '../../../app/clock';
import { useSettings } from '../../../app/settings';
import { unitDone } from '../../../app/unit/done';
import type { UnitBlockNo, UnitCtx } from '../../../app/unit/types';
import { useLive } from '../../../data/live';
import { againChecks, againSource, repairSrcOf, unitRepairs, type AgainCheck, type AgainSource, type TaskLike } from '../../../domain/repair/unit';
import type { Lang } from '../../../domain/srs/types';
import { recordGrammarError, recordRepair, saveRepairs } from '../store';

// Block 5 der Tageseinheit „Nochmal, aber besser“ (plan.md §1.5, N42; Prüfung M4c, S4): aus dem
// Kopf neu formulieren, dann Neufassung ↔ bessere Fassung nebeneinander und je Korrektur „jetzt
// richtig?“ (lokal, ohne KI). Reparatur-Karten entstehen automatisch – nur aus belegten
// Korrekturen, nie aus dem ungeprüften Text oder der Neufassung. Das Ende meldet `unitDone(5)`.

type State = {
  active: boolean;
  phase: 'write' | 'compare';
  day: string;
  lang: Lang;
  block: UnitBlockNo | null;
  taskKind: string | null;
  task: TaskLike | null;
  src: AgainSource;
  draft: string;
  checks: AgainCheck[];
  /** Anzahl der neu angelegten Reparatur-Karten (Anzeige). */
  saved: number;
  startedAt: number;
};

const EMPTY_SRC: AgainSource = { before: '', better: null, betterFrom: null, fixes: [] };

const initial = (): State => ({ active: false, phase: 'write', day: '', lang: 'de', block: null, taskKind: null, task: null, src: EMPTY_SRC, draft: '', checks: [], saved: 0, startedAt: 0 });

export const useAgain = create<State>(initial);

/** Block 5 starten (synchron im Klick). Ohne `ctx` aus den Daten von heute (zweites Gerät). */
export function startAgain(ctx: Pick<UnitCtx, 'day' | 'block' | 'task'> | null): void {
  const day = ctx?.day ?? useClock.getState().today;
  const task: TaskLike | null = ctx?.task ? { text: ctx.task.text, ...(ctx.task.better ? { better: ctx.task.better } : {}), fixes: ctx.task.fixes } : null;
  const src = againSource({ day, task, repairDoc: useLive.getState().docs['app/repair'] ?? null, grammarDocs: useLive.getState().collections.grammar ?? new Map(), now: useClock.getState().now, lang: useSettings.getState().lang });
  useAgain.setState({ ...initial(), draft: againStart(src), active: true, day, lang: useSettings.getState().lang, block: ctx ? ctx.block : null, taskKind: ctx?.task?.kind ?? null, task, src, startedAt: Date.now() });
}

/** Startwert des Feldes: dein Text von vorhin bzw. die alten Sätze – es wird nur die falsche Stelle geändert. */
export const againStart = (src: AgainSource): string => (src.olds?.length ? src.olds.map((o) => o.wrong).join('\n') : src.before);

export function setAgainDraft(draft: string): void {
  useAgain.setState({ draft });
}

/** Vergleichen: Prüfung je Korrektur und die Reparatur-Karten aus belegten Korrekturen. */
export function compareAgain(): void {
  const s = useAgain.getState();
  if (s.phase !== 'write') return;
  const checks = againChecks(s.draft, s.src.fixes);
  // Belegt sind nur Korrekturen der KI aus Block 3 (bzw. die Reparatur-Sätze von heute, die es
  // schon gibt – `addRepairs` legt nichts doppelt an). Ohne KI gibt es keine `fixes`.
  // Sätze von früher (Handy-Tag): Das ist die Wiederholung der Reparatur-Box – Box +1 bei „jetzt richtig“,
  // sonst morgen wieder (`recordRepair`); es entstehen keine neuen Karten.
  if (s.src.olds?.length) {
    useAgain.setState({ phase: 'compare', checks, saved: 0 });
    checks.forEach((c, k) => {
      const o = s.src.olds?.[k];
      if (!o) return;
      if (o.store === 'grammar' && o.topic && o.errorT !== undefined) void recordGrammarError(o.topic, o.errorT, c.ok, c.ok ? '' : s.draft.slice(0, 160));
      else void recordRepair(o.id, c.ok);
    });
    return;
  }
  const add = unitRepairs({ fixes: s.src.fixes, src: repairSrcOf(s.taskKind), lang: s.lang });
  useAgain.setState({ phase: 'compare', checks, saved: add.length });
  if (add.length) void saveRepairs(add);
}

export function reportAgainDone(): void {
  const s = useAgain.getState();
  if (s.block) unitDone(s.block);
}

export function leaveAgain(): void {
  if (!useAgain.getState().active) return;
  useAgain.setState({ active: false });
}

// ------------------------------------------------------------------ Fortsetzen (§3.2)

export type AgainSnap = Pick<State, 'phase' | 'day' | 'lang' | 'block' | 'taskKind' | 'task' | 'src' | 'draft' | 'checks' | 'saved'>;

export function againSnapshot(): AgainSnap | null {
  const s = useAgain.getState();
  if (!s.active) return null;
  const { phase, day, lang, block, taskKind, task, src, draft, checks, saved } = s;
  return { phase, day, lang, block, taskKind, task, src, draft, checks, saved };
}

export function restoreAgain(snap: AgainSnap): boolean {
  if (!snap || (snap.phase !== 'write' && snap.phase !== 'compare') || !snap.src || typeof snap.draft !== 'string') return false;
  useAgain.setState({ ...initial(), ...snap, active: true, startedAt: Date.now() });
  return true;
}
