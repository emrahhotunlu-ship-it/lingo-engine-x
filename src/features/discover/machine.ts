import { assign, fromPromise, setup } from 'xstate';
import type { DiscStep } from '../../domain/discover/steps';
import type { ChoiceResult } from '../../domain/input/types';

// Ablauf eines Beitrags (Kap. 6.9, Plan §2.6, §4.4, F12): Vorbereiten → Aufnehmen → Prüfen (nur
// Artikel mit Fragen) → Anwenden (eigener Text ≥ 20 Wörter) → fertig. Jeder Schritt wird beim
// „Weiter" in `profile.disc` vermerkt (`mark`); der Abschluss (`finish`) erst beim Abgeben.
// Wiedereinstieg im ersten offenen Schritt; erledigte Schritte sind Zustand.

export type DiscoverInput = {
  steps: readonly DiscStep[];
  /** Erster offener Schritt oder `done`. */
  startAt: DiscStep | 'done';
  total: number;
  mark: (step: DiscStep, results: readonly ChoiceResult[]) => void;
  finish: (text: string, results: readonly ChoiceResult[]) => Promise<void>;
};

export type DiscoverEvent = { type: 'NEXT' } | { type: 'ANSWER'; result: ChoiceResult } | { type: 'SUBMIT'; text: string } | { type: 'RETRY' };

type Ctx = { steps: readonly DiscStep[]; startAt: DiscoverInput['startAt']; total: number; i: number; results: ChoiceResult[]; text: string; mark: DiscoverInput['mark']; finish: DiscoverInput['finish'] };

export const discoverMachine = setup({
  types: { context: {} as Ctx, input: {} as DiscoverInput, events: {} as DiscoverEvent },
  actors: {
    finish: fromPromise<void, { text: string; results: readonly ChoiceResult[]; finish: DiscoverInput['finish'] }>(({ input }) => input.finish(input.text, input.results)),
  },
  actions: {
    markPrep: ({ context }) => context.mark('prep', context.results),
    markTake: ({ context }) => context.mark('take', context.results),
    markCheck: ({ context }) => context.mark('check', context.results),
  },
  guards: {
    at: ({ context }, s: DiscStep | 'done') => context.startAt === s,
    hasCheck: ({ context }) => context.steps.includes('check') && context.total > 0,
    more: ({ context }) => context.i + 1 < context.total,
  },
}).createMachine({
  id: 'discover',
  context: ({ input }) => ({ steps: input.steps, startAt: input.startAt, total: input.total, i: 0, results: [], text: '', mark: input.mark, finish: input.finish }),
  initial: 'init',
  states: {
    init: {
      always: [
        { guard: { type: 'at', params: 'done' }, target: 'done' },
        { guard: { type: 'at', params: 'take' }, target: 'take' },
        { guard: { type: 'at', params: 'check' }, target: 'check' },
        { guard: { type: 'at', params: 'use' }, target: 'use' },
        { target: 'prep' },
      ],
    },
    prep: { on: { NEXT: { target: 'take', actions: 'markPrep' } } },
    take: {
      on: {
        NEXT: [
          { guard: 'hasCheck', target: 'check', actions: 'markTake' },
          { target: 'use', actions: 'markTake' },
        ],
      },
    },
    check: {
      initial: 'asking',
      states: {
        asking: { on: { ANSWER: { target: 'answered', actions: assign({ results: ({ context, event }) => [...context.results, event.result] }) } } },
        answered: {
          on: {
            NEXT: [
              { guard: 'more', target: 'asking', actions: assign({ i: ({ context }) => context.i + 1 }) },
              { target: '#discover.use', actions: 'markCheck' },
            ],
          },
        },
      },
    },
    use: { on: { SUBMIT: { target: 'finishing', actions: assign({ text: ({ event }) => event.text }) } } },
    finishing: {
      invoke: {
        src: 'finish',
        input: ({ context }) => ({ text: context.text, results: context.results, finish: context.finish }),
        onDone: 'done',
        onError: 'failed',
      },
    },
    failed: { on: { RETRY: 'finishing' } },
    done: {},
  },
});
