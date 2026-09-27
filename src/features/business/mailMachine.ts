import { assign, setup } from 'xstate';
import type { AiMessageKey } from '../../ai/types';
import type { MailSegment } from '../../domain/business/mailCompose';
import type { MailRefineOut } from '../../prompts/mailRefine';

// E-Mail-Refiner (Plan §5.5) als XState-Maschine: input → refining → choosing → done.
// Rein; die Steuerung (MailRefiner.tsx) ruft die KI und speichert.

export type MailContext = {
  segments: MailSegment[];
  result: MailRefineOut | null;
  /** Gewählte Fassung je Baustein (-1 = Original). */
  picks: Record<number, number>;
  error: AiMessageKey | null;
  slow: boolean;
};

export type MailEvent =
  | { type: 'REFINE'; segments: MailSegment[] }
  | { type: 'SLOW' }
  | { type: 'RESULT'; result: MailRefineOut }
  | { type: 'FAIL'; error: AiMessageKey }
  | { type: 'CANCEL' }
  | { type: 'PICK'; seg: number; opt: number }
  | { type: 'FINISH' }
  | { type: 'EDIT' }
  | { type: 'RESET' };

export const mailMachine = setup({
  types: { context: {} as MailContext, events: {} as MailEvent },
}).createMachine({
  id: 'mail',
  context: { segments: [], result: null, picks: {}, error: null, slow: false },
  initial: 'input',
  states: {
    input: {
      on: {
        REFINE: {
          target: 'refining',
          guard: ({ event }) => event.segments.length > 0,
          actions: assign({ segments: ({ event }) => event.segments, error: null, slow: false, picks: {}, result: null }),
        },
      },
    },
    refining: {
      on: {
        SLOW: { actions: assign({ slow: true }) },
        RESULT: { target: 'choosing', actions: assign({ result: ({ event }) => event.result, slow: false }) },
        FAIL: { target: 'input', actions: assign({ error: ({ event }) => event.error, slow: false }) },
        CANCEL: { target: 'input', actions: assign({ slow: false }) },
      },
    },
    choosing: {
      on: {
        PICK: { actions: assign({ picks: ({ context, event }) => ({ ...context.picks, [event.seg]: event.opt }) }) },
        FINISH: 'done',
        EDIT: 'input',
      },
    },
    done: {
      on: {
        EDIT: 'choosing',
        RESET: { target: 'input', actions: assign({ segments: [], result: null, picks: {}, error: null }) },
      },
    },
  },
});
