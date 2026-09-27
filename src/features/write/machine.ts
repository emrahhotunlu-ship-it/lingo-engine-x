import { assign, fromPromise, setup } from 'xstate';

// Ablauf beim Schreiben (Plan §2.6, §4.3): schreiben → abgeben (writing/w<t> + Einheitsabschluss,
// F6: erledigt beim ersten Abgeben, unabhängig von der KI) → Rückmeldung (App-Aufgabe, M14) →
// freiwillig überarbeiten (rev + 1, kein weiterer Abschluss) → erneut abgeben.

export type WriteInput = {
  start: 'drafting' | 'submitted';
  writingId: string | null;
  rev: number;
  submit: (text: string) => Promise<string>;
  revise: (id: string, text: string) => Promise<number>;
};

export type WriteEvent = { type: 'SUBMIT'; text: string } | { type: 'REVISE' } | { type: 'RESUBMIT'; text: string } | { type: 'CANCEL' };

type Ctx = { writingId: string | null; rev: number; failed: boolean; start: WriteInput['start']; submit: WriteInput['submit']; revise: WriteInput['revise']; text: string };

export const writeMachine = setup({
  types: { context: {} as Ctx, input: {} as WriteInput, events: {} as WriteEvent },
  actors: {
    submit: fromPromise<string, { text: string; submit: WriteInput['submit'] }>(({ input }) => input.submit(input.text)),
    revise: fromPromise<number, { id: string; text: string; revise: WriteInput['revise'] }>(({ input }) => input.revise(input.id, input.text)),
  },
  guards: { startSubmitted: ({ context }) => context.start === 'submitted' && !!context.writingId },
}).createMachine({
  id: 'write',
  context: ({ input }) => ({ writingId: input.writingId, rev: input.rev, failed: false, start: input.start, submit: input.submit, revise: input.revise, text: '' }),
  initial: 'init',
  states: {
    init: { always: [{ guard: 'startSubmitted', target: 'submitted' }, { target: 'drafting' }] },
    drafting: { on: { SUBMIT: { target: 'submitting', actions: assign({ text: ({ event }) => event.text, failed: false }) } } },
    submitting: {
      invoke: {
        src: 'submit',
        input: ({ context }) => ({ text: context.text, submit: context.submit }),
        onDone: { target: 'submitted', actions: assign({ writingId: ({ event }) => event.output, rev: 0 }) },
        onError: { target: 'drafting', actions: assign({ failed: true }) },
      },
    },
    submitted: { on: { REVISE: 'revising' } },
    revising: {
      on: {
        CANCEL: 'submitted',
        RESUBMIT: { target: 'resubmitting', actions: assign({ text: ({ event }) => event.text, failed: false }) },
      },
    },
    resubmitting: {
      invoke: {
        src: 'revise',
        input: ({ context }) => ({ id: context.writingId ?? '', text: context.text, revise: context.revise }),
        onDone: { target: 'submitted', actions: assign({ rev: ({ event }) => event.output }) },
        onError: { target: 'revising', actions: assign({ failed: true }) },
      },
    },
  },
});
