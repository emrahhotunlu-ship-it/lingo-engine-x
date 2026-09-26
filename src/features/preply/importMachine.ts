import { assign, fromPromise, setup } from 'xstate';
import { isAiFailure, type AiMessageKey, type AiPhase } from '../../ai/types';
import type { ApplyPlan, ApplySel } from '../../domain/preply/apply';
import type { ImportView } from '../../domain/preply/docs';
import type { ApplyOutcome, ApplyRes, ApplyTarget } from './actions';

// Ablauf „Lehrer-Text übernehmen" (Phase 5 §3.3, Kap. 3.2: XState für mehrstufige Abläufe):
//   editing → analyzing → review → applying → applied | partial (→ RETRY → applying)
// STOP während der Analyse → editing (Text bleibt, nichts geschrieben). LATER in der Vorschau →
// editing (der Import bleibt als „offen" im Verlauf). Die Dienste (KI, Schreiben) werden
// eingespeist (`provide`), damit der Ablauf ohne Laufzeit testbar ist.

export type AnalyzeInput = { raw: string; onPhase: (p: AiPhase) => void };
export type ApplyInput = { pi: ImportView; sel: ApplySel; plan: ApplyPlan | null };

export type ImportContext = {
  raw: string;
  pi: ImportView | null;
  sel: ApplySel;
  plan: ApplyPlan | null;
  phase: AiPhase | null;
  error: AiMessageKey | null;
  errorKind: string | null;
  failed: ApplyTarget[];
  res: ApplyRes | null;
};

export type ImportEvent =
  | { type: 'EDIT'; raw: string }
  | { type: 'ANALYZE' }
  | { type: 'STOP' }
  | { type: 'PHASE'; phase: AiPhase }
  | { type: 'TOGGLE'; group: 'c' | 't' | 'w'; i: number }
  | { type: 'APPLY' }
  | { type: 'LATER' }
  | { type: 'RETRY' }
  | { type: 'OPEN'; pi: ImportView; sel: ApplySel }
  | { type: 'RESET' };

const EMPTY_SEL: ApplySel = { c: [], t: [], w: [] };

function toggle(sel: ApplySel, group: 'c' | 't' | 'w', i: number): ApplySel {
  const list = sel[group];
  return { ...sel, [group]: list.includes(i) ? list.filter((x) => x !== i) : [...list, i].sort((a, b) => a - b) };
}

export const importMachine = setup({
  types: {
    context: {} as ImportContext,
    events: {} as ImportEvent,
    // XState-Typmuster: Der leere Wert trägt nur den Typ der Eingabe.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    input: {} as { raw?: string },
  },
  actors: {
    analyze: fromPromise<{ pi: ImportView; sel: ApplySel }, AnalyzeInput>(() => Promise.reject(new Error('analyze not provided'))),
    apply: fromPromise<ApplyOutcome, ApplyInput>(() => Promise.reject(new Error('apply not provided'))),
  },
}).createMachine({
  id: 'preplyImport',
  context: ({ input }) => ({ raw: input.raw ?? '', pi: null, sel: EMPTY_SEL, plan: null, phase: null, error: null, errorKind: null, failed: [], res: null }),
  initial: 'editing',
  on: {
    OPEN: { target: '.review', actions: assign({ pi: ({ event }) => event.pi, sel: ({ event }) => event.sel, plan: null, failed: [], res: null, error: null }) },
  },
  states: {
    editing: {
      on: {
        EDIT: { actions: assign({ raw: ({ event }) => event.raw }) },
        ANALYZE: { target: 'analyzing', guard: ({ context }) => context.raw.trim().length > 0 },
        RESET: { actions: assign({ pi: null, sel: EMPTY_SEL, plan: null, error: null, errorKind: null, failed: [], res: null }) },
      },
    },
    analyzing: {
      entry: assign({ error: null, errorKind: null, phase: 'queued' }),
      invoke: {
        src: 'analyze',
        input: ({ context, self }) => ({ raw: context.raw, onPhase: (phase: AiPhase) => self.send({ type: 'PHASE', phase }) }),
        onDone: { target: 'review', actions: assign({ pi: ({ event }) => event.output.pi, sel: ({ event }) => event.output.sel, phase: null }) },
        onError: {
          target: 'editing',
          actions: assign(({ event }) => {
            const err = event.error;
            if (isAiFailure(err) && err.kind === 'cancelled') return { phase: null };
            return { phase: null, error: isAiFailure(err) ? (err.messageKey ?? 'aiFailed') : 'aiFailed', errorKind: isAiFailure(err) ? err.kind : 'failed' };
          }),
        },
      },
      on: {
        PHASE: { actions: assign({ phase: ({ event }) => event.phase }) },
        // Verlassen des Zustands bricht den Dienst ab (XState stoppt `invoke`); der Text bleibt.
        STOP: { target: 'editing', actions: assign({ phase: null }) },
      },
    },
    review: {
      on: {
        TOGGLE: { actions: assign({ sel: ({ context, event }) => toggle(context.sel, event.group, event.i) }) },
        APPLY: { target: 'applying', guard: ({ context }) => context.sel.c.length + context.sel.t.length + context.sel.w.length > 0 },
        LATER: { target: 'editing', actions: assign({ pi: null, sel: EMPTY_SEL, raw: '' }) },
      },
    },
    applying: {
      invoke: {
        src: 'apply',
        input: ({ context }) => {
          if (!context.pi) throw new Error('no import');
          return { pi: context.pi, sel: context.sel, plan: context.plan };
        },
        onDone: [
          { guard: ({ event }) => event.output.ok, target: 'applied', actions: assign({ res: ({ event }) => event.output.res, plan: ({ event }) => event.output.plan, failed: [] }) },
          { target: 'partial', actions: assign({ res: ({ event }) => event.output.res, plan: ({ event }) => event.output.plan, failed: ({ event }) => event.output.failed }) },
        ],
        onError: { target: 'partial', actions: assign({ failed: ['import'] }) },
      },
    },
    applied: {
      on: { RESET: { target: 'editing', actions: assign({ pi: null, sel: EMPTY_SEL, plan: null, raw: '', failed: [], res: null }) } },
    },
    partial: {
      on: { RETRY: 'applying' },
    },
  },
});
