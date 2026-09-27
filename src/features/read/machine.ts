import { assign, fromPromise, setup } from 'xstate';
import type { ChoiceResult } from '../../domain/input/types';

// Ablauf einer Lese-Einheit (Plan §2.6, §4.1): lesen → Fragen (je Frage: antworten → Beleg →
// weiter) → Abschluss (reading/r<t>, Zähler, Log – ohne KI, F6) → Zusammenfassung (freiwillig)
// → fertig. Der Abschluss läuft über `run` aus der Eingabe (Tests setzen eine Attrappe ein);
// wird die Einheit vorher verlassen (Akteur gestoppt), wird nichts geschrieben.

/** `run` schreibt den Abschluss und liefert die Kennung von reading/r<t>. */
export type ReadInput = { total: number; start: 'reading' | 'summary' | 'done'; readingId?: string | null; run: (results: readonly ChoiceResult[]) => Promise<string> };

export type ReadEvent =
  | { type: 'DONE_READING' }
  | { type: 'ANSWER'; result: ChoiceResult }
  | { type: 'NEXT' }
  | { type: 'RETRY' }
  | { type: 'SUMMARY_DONE' }
  | { type: 'SKIP' };

export const readMachine = setup({
  types: {
    context: {} as { total: number; i: number; results: ChoiceResult[]; readingId: string | null; start: ReadInput['start']; run: ReadInput['run'] },
    input: {} as ReadInput,
    events: {} as ReadEvent,
  },
  actors: {
    complete: fromPromise<string, { results: readonly ChoiceResult[]; run: ReadInput['run'] }>(({ input }) => input.run(input.results)),
  },
  guards: {
    hasQuestions: ({ context }) => context.total > 0,
    more: ({ context }) => context.i + 1 < context.total,
    startSummary: ({ context }) => context.start === 'summary',
    startDone: ({ context }) => context.start === 'done',
  },
}).createMachine({
  id: 'read',
  context: ({ input }) => ({ total: input.total, i: 0, results: [], readingId: input.readingId ?? null, start: input.start, run: input.run }),
  initial: 'init',
  states: {
    init: {
      always: [{ guard: 'startDone', target: 'done' }, { guard: 'startSummary', target: 'summary' }, { target: 'reading' }],
    },
    reading: {
      on: { DONE_READING: [{ guard: 'hasQuestions', target: 'questions' }, { target: 'completing' }] },
    },
    questions: {
      initial: 'asking',
      states: {
        asking: {
          on: { ANSWER: { target: 'answered', actions: assign({ results: ({ context, event }) => [...context.results, event.result] }) } },
        },
        answered: {
          on: {
            NEXT: [{ guard: 'more', target: 'asking', actions: assign({ i: ({ context }) => context.i + 1 }) }, { target: '#read.completing' }],
          },
        },
      },
    },
    completing: {
      invoke: {
        src: 'complete',
        input: ({ context }) => ({ results: context.results, run: context.run }),
        onDone: { target: 'summary', actions: assign({ readingId: ({ event }) => event.output }) },
        onError: 'failed',
      },
    },
    failed: { on: { RETRY: 'completing' } },
    summary: { on: { SUMMARY_DONE: 'done', SKIP: 'done' } },
    done: {},
  },
});
