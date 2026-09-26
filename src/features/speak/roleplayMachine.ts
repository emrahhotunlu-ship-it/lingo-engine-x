import { assign, setup } from 'xstate';
import type { AiMessageKey } from '../../ai/types';
import type { AnalysisSlot, StoredReport, Turn } from '../../domain/speak/types';

// Ablauf eines Rollenspiels (Plan §5.2) als XState-Maschine – rein, ohne Nebenwirkungen.
// Die Steuerung (useRoleplay.ts) sendet Ereignisse und führt die KI-Aufrufe aus.
//
//   composing ⇄ sending{thinking|streaming|slow} → composing
//                 └─ Fehler/Stopp → composing (Satz zurück ins Feld, „Erneut senden“)
//                 └─ unavailable → blocked (Hinweis, Gespräch beendbar)
//   composing → ending (wartet auf Analysen; „Bericht jetzt“) → finishing (speichert) → report
//
// Analysen laufen außerhalb der Hauptzustände (Ereignis ANALYSIS); ein Analysefehler ändert
// nie den Hauptzustand.

export type ReportState = { state: 'idle' | 'thinking' | 'slow' | 'done' | 'failed'; data: StoredReport | null; error: AiMessageKey | null };

export type RoleplayContext = {
  turns: Turn[];
  analyses: Record<number, AnalysisSlot>;
  draft: string;
  draftChip: boolean;
  /** Zählt jedes Zurücklegen bzw. Leeren des Eingabefelds (Fehler, Stopp, Senden). */
  restoreN: number;
  /** Text der Figur, der gerade einläuft. */
  partial: string;
  error: AiMessageKey | null;
  /** Teiltext einer abgebrochenen Antwort (nur Anzeige, nie im Verlauf). */
  interrupted: string;
  startedAt: number;
  endedAt: number | null;
  report: ReportState;
  saveFailed: boolean;
  /** Mitgenommene Wendungen (en) dieses Gesprächs. */
  taken: string[];
};

export type RoleplayEvent =
  | { type: 'SEND'; text: string; usedChip: boolean; t: number }
  | { type: 'TEXT'; text: string }
  | { type: 'SLOW' }
  | { type: 'REPLY'; text: string; truncated: boolean; t: number }
  | { type: 'FAIL'; error: AiMessageKey; partial: string; unavailable: boolean }
  | { type: 'CANCELLED' }
  | { type: 'ANALYSIS'; idx: number; slot: AnalysisSlot }
  | { type: 'END'; t: number }
  | { type: 'REPORT_NOW' }
  | { type: 'SAVED' }
  | { type: 'SAVE_FAILED' }
  | { type: 'REPORT_PHASE'; state: 'thinking' | 'slow' }
  | { type: 'REPORT_DONE'; data: StoredReport }
  | { type: 'REPORT_FAIL'; error: AiMessageKey }
  | { type: 'TAKEN'; en: string }
  | { type: 'DRAFT'; text: string };

export type RoleplayInput = { opening: string; startedAt: number; resume?: { turns: Turn[]; analyses: Record<number, AnalysisSlot>; taken?: string[] } | null };

export const hasPending = (c: Pick<RoleplayContext, 'analyses'>): boolean => Object.values(c.analyses).some((a) => a.state === 'pending');

const dropLastMine = (turns: readonly Turn[]): { turns: Turn[]; text: string; chip: boolean } => {
  const last = turns[turns.length - 1];
  if (!last || last.role !== 'me') return { turns: [...turns], text: '', chip: false };
  return { turns: turns.slice(0, -1), text: last.text, chip: !!last.usedChip };
};

export const roleplayMachine = setup({
  types: {
    context: {} as RoleplayContext,
    events: {} as RoleplayEvent,
    input: {} as RoleplayInput,
  },
  guards: {
    hasText: ({ event }) => event.type === 'SEND' && event.text.trim().length > 0,
    pending: ({ context }) => hasPending(context),
    isUnavailable: ({ event }) => event.type === 'FAIL' && event.unavailable,
  },
  actions: {
    setAnalysis: assign({
      analyses: ({ context, event }) => (event.type === 'ANALYSIS' ? { ...context.analyses, [event.idx]: event.slot } : context.analyses),
    }),
    skipPending: assign({
      analyses: ({ context }) => Object.fromEntries(Object.entries(context.analyses).map(([k, a]) => [k, a.state === 'pending' ? { state: 'skipped' as const } : a])),
    }),
    addTaken: assign({
      taken: ({ context, event }) => (event.type === 'TAKEN' && !context.taken.includes(event.en) ? [...context.taken, event.en] : context.taken),
    }),
  },
}).createMachine({
  id: 'roleplay',
  context: ({ input }) => ({
    turns: input.resume?.turns.length ? input.resume.turns : [{ role: 'persona', text: input.opening, t: input.startedAt }],
    analyses: input.resume?.analyses ?? {},
    draft: '',
    draftChip: false,
    restoreN: 0,
    partial: '',
    error: null,
    interrupted: '',
    startedAt: input.startedAt,
    endedAt: null,
    report: { state: 'idle', data: null, error: null },
    saveFailed: false,
    taken: input.resume?.taken ?? [],
  }),
  on: {
    ANALYSIS: { actions: 'setAnalysis' },
    TAKEN: { actions: 'addTaken' },
  },
  initial: 'composing',
  states: {
    composing: {
      on: {
        DRAFT: { actions: assign({ draft: ({ event }) => (event.type === 'DRAFT' ? event.text : '') }) },
        SEND: {
          guard: 'hasText',
          target: 'sending',
          actions: assign({
            turns: ({ context, event }) =>
              event.type === 'SEND' ? [...context.turns, { role: 'me' as const, text: event.text.trim(), t: event.t, ...(event.usedChip ? { usedChip: true } : {}) }] : context.turns,
            draft: '',
            draftChip: false,
            restoreN: ({ context }) => context.restoreN + 1,
            error: null,
            interrupted: '',
            partial: '',
          }),
        },
        END: [
          { guard: 'pending', target: 'ending', actions: assign({ endedAt: ({ event }) => (event.type === 'END' ? event.t : null) }) },
          { target: 'finishing', actions: assign({ endedAt: ({ event }) => (event.type === 'END' ? event.t : null) }) },
        ],
      },
    },
    sending: {
      initial: 'thinking',
      states: {
        thinking: { on: { TEXT: 'streaming', SLOW: 'slow' } },
        slow: { on: { TEXT: 'streaming' } },
        streaming: {},
      },
      on: {
        TEXT: { actions: assign({ partial: ({ event }) => (event.type === 'TEXT' ? event.text : '') }) },
        REPLY: {
          target: 'composing',
          actions: assign({
            turns: ({ context, event }) =>
              event.type === 'REPLY' ? [...context.turns, { role: 'persona' as const, text: event.text, t: event.t, ...(event.truncated ? { truncated: true } : {}) }] : context.turns,
            partial: '',
          }),
        },
        FAIL: [
          {
            guard: 'isUnavailable',
            target: 'blocked',
            actions: assign(({ context, event }) => {
              const d = dropLastMine(context.turns);
              return { turns: d.turns, draft: d.text, draftChip: d.chip, restoreN: context.restoreN + 1, partial: '', error: event.type === 'FAIL' ? event.error : null, interrupted: '' };
            }),
          },
          {
            target: 'composing',
            actions: assign(({ context, event }) => {
              const d = dropLastMine(context.turns);
              return { turns: d.turns, draft: d.text, draftChip: d.chip, restoreN: context.restoreN + 1, partial: '', error: event.type === 'FAIL' ? event.error : null, interrupted: event.type === 'FAIL' ? event.partial : '' };
            }),
          },
        ],
        CANCELLED: {
          target: 'composing',
          actions: assign(({ context }) => {
            const d = dropLastMine(context.turns);
            return { turns: d.turns, draft: d.text, draftChip: d.chip, restoreN: context.restoreN + 1, partial: '', error: null, interrupted: '' };
          }),
        },
      },
    },
    blocked: {
      on: {
        END: [
          { guard: 'pending', target: 'ending', actions: assign({ endedAt: ({ event }) => (event.type === 'END' ? event.t : null) }) },
          { target: 'finishing', actions: assign({ endedAt: ({ event }) => (event.type === 'END' ? event.t : null) }) },
        ],
      },
    },
    ending: {
      always: { guard: ({ context }) => !hasPending(context), target: 'finishing' },
      on: { REPORT_NOW: { target: 'finishing', actions: 'skipPending' } },
    },
    finishing: {
      on: {
        SAVED: 'report',
        SAVE_FAILED: { target: 'report', actions: assign({ saveFailed: true }) },
      },
    },
    report: {
      on: {
        REPORT_PHASE: { actions: assign({ report: ({ context, event }) => ({ ...context.report, state: event.type === 'REPORT_PHASE' ? event.state : context.report.state, error: null }) }) },
        REPORT_DONE: { actions: assign({ report: ({ event }) => ({ state: 'done' as const, data: event.type === 'REPORT_DONE' ? event.data : null, error: null }) }) },
        REPORT_FAIL: { actions: assign({ report: ({ context, event }) => ({ ...context.report, state: 'failed' as const, error: event.type === 'REPORT_FAIL' ? event.error : null }) }) },
      },
    },
  },
});

/** Zustand als flacher Name für die Oberfläche und `data-state`. */
export function stateName(value: unknown): 'composing' | 'thinking' | 'streaming' | 'slow' | 'blocked' | 'ending' | 'finishing' | 'report' {
  if (typeof value === 'string') return value as 'composing';
  if (value && typeof value === 'object' && 'sending' in value) return (value as { sending: 'thinking' | 'streaming' | 'slow' }).sending;
  return 'composing';
}
