import { assign, fromPromise, setup } from 'xstate';
import type { ChoiceResult } from '../../domain/input/types';

// Ablauf einer Hör-Einheit (Plan §2.6, §4.2, F14): vorbereiten → hören (der Text ist NICHT im
// DOM) → Fragen, sobald einmal ganz gehört oder übersprungen → Abschluss (ohne KI, F6) →
// Transkript zum Mitsprechen. „Text zeigen", „Ohne Hören weiter" und fehlender Ton zählen als
// Hilfe (`help: true`); die Einheit bleibt so auch ohne Stimme abschließbar.

export type ListenRun = (r: { results: readonly ChoiceResult[]; plays: number; help: boolean }) => Promise<boolean>;
export type ListenInput = { total: number; start: 'prep' | 'done'; run: ListenRun };

export type ListenEvent =
  | { type: 'START' }
  | { type: 'PLAYED' }
  | { type: 'HEARD' }
  | { type: 'SHOW_TEXT' }
  | { type: 'NO_AUDIO' }
  | { type: 'SKIP' }
  | { type: 'TO_QUESTIONS' }
  | { type: 'ANSWER'; result: ChoiceResult }
  | { type: 'NEXT' }
  | { type: 'RETRY' };

type Ctx = { total: number; i: number; results: ChoiceResult[]; plays: number; heard: boolean; help: boolean; textShown: boolean; start: ListenInput['start']; run: ListenRun };

export const listenMachine = setup({
  types: { context: {} as Ctx, input: {} as ListenInput, events: {} as ListenEvent },
  actors: {
    // `false` heißt „noch nicht gespeichert" – der Sammel-Schreibweg behält den Abschluss und
    // speichert ihn später (Hinweis auf Heute). Kein zweiter Aufruf, sonst zählte er doppelt.
    complete: fromPromise<boolean, { results: readonly ChoiceResult[]; plays: number; help: boolean; run: ListenRun }>(({ input }) =>
      input.run({ results: input.results, plays: input.plays, help: input.help }),
    ),
  },
  guards: {
    startDone: ({ context }) => context.start === 'done',
    mayAnswer: ({ context }) => context.heard || context.help,
    hasQuestions: ({ context }) => context.total > 0,
    more: ({ context }) => context.i + 1 < context.total,
  },
}).createMachine({
  id: 'listen',
  context: ({ input }) => ({ total: input.total, i: 0, results: [], plays: 0, heard: false, help: false, textShown: false, start: input.start, run: input.run }),
  initial: 'init',
  states: {
    init: { always: [{ guard: 'startDone', target: 'transcript' }, { target: 'prep' }] },
    prep: { on: { START: 'listening', NO_AUDIO: { target: 'listening', actions: assign({ help: true, textShown: true }) } } },
    listening: {
      on: {
        PLAYED: { actions: assign({ plays: ({ context }) => context.plays + 1 }) },
        HEARD: { actions: assign({ heard: true }) },
        SHOW_TEXT: { actions: assign({ help: true, textShown: true }) },
        NO_AUDIO: { actions: assign({ help: true, textShown: true }) },
        SKIP: [
          { guard: 'hasQuestions', target: 'questions', actions: assign({ help: true }) },
          { target: 'completing', actions: assign({ help: true }) },
        ],
        TO_QUESTIONS: [{ guard: 'mayAnswer', target: 'decide' }],
      },
    },
    decide: { always: [{ guard: 'hasQuestions', target: 'questions' }, { target: 'completing' }] },
    questions: {
      initial: 'asking',
      states: {
        asking: { on: { ANSWER: { target: 'answered', actions: assign({ results: ({ context, event }) => [...context.results, event.result] }) } } },
        answered: {
          on: { NEXT: [{ guard: 'more', target: 'asking', actions: assign({ i: ({ context }) => context.i + 1 }) }, { target: '#listen.completing' }] },
        },
      },
    },
    completing: {
      invoke: {
        src: 'complete',
        input: ({ context }) => ({ results: context.results, plays: context.plays, help: context.help, run: context.run }),
        onDone: 'transcript',
        onError: 'failed',
      },
    },
    failed: { on: { RETRY: 'completing' } },
    transcript: {},
  },
});
