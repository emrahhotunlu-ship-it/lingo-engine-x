import { assign, setup } from 'xstate';
import type { AiMessageKey } from '../../ai/types';
import type { PitchFeedbackOut } from '../../prompts/pitchFeedback';
import type { PitchScriptOut } from '../../prompts/pitchScript';

// Präsentations-Coach (Plan §5.5): input → scripting → rehearse → feedbacking → result. Rein.

export type PitchContext = { script: PitchScriptOut | null; feedback: PitchFeedbackOut | null; attempt: string; error: AiMessageKey | null; slow: boolean };

export type PitchEvent =
  | { type: 'SCRIPT' }
  | { type: 'SLOW' }
  | { type: 'SCRIPT_DONE'; script: PitchScriptOut }
  | { type: 'FEEDBACK'; attempt: string }
  | { type: 'FEEDBACK_DONE'; feedback: PitchFeedbackOut }
  | { type: 'FAIL'; error: AiMessageKey }
  | { type: 'CANCEL' }
  | { type: 'AGAIN' }
  | { type: 'RESET' };

export const pitchMachine = setup({ types: { context: {} as PitchContext, events: {} as PitchEvent } }).createMachine({
  id: 'pitch',
  context: { script: null, feedback: null, attempt: '', error: null, slow: false },
  initial: 'input',
  states: {
    input: { on: { SCRIPT: { target: 'scripting', actions: assign({ error: null, slow: false }) } } },
    scripting: {
      on: {
        SLOW: { actions: assign({ slow: true }) },
        SCRIPT_DONE: { target: 'rehearse', actions: assign({ script: ({ event }) => event.script, slow: false }) },
        FAIL: { target: 'input', actions: assign({ error: ({ event }) => event.error, slow: false }) },
        CANCEL: { target: 'input', actions: assign({ slow: false }) },
      },
    },
    rehearse: {
      on: {
        FEEDBACK: { target: 'feedbacking', actions: assign({ attempt: ({ event }) => event.attempt, error: null, slow: false }) },
        RESET: { target: 'input', actions: assign({ script: null, feedback: null, attempt: '' }) },
      },
    },
    feedbacking: {
      on: {
        SLOW: { actions: assign({ slow: true }) },
        FEEDBACK_DONE: { target: 'result', actions: assign({ feedback: ({ event }) => event.feedback, slow: false }) },
        FAIL: { target: 'rehearse', actions: assign({ error: ({ event }) => event.error, slow: false }) },
        CANCEL: { target: 'rehearse', actions: assign({ slow: false }) },
      },
    },
    result: {
      on: {
        AGAIN: { target: 'rehearse', actions: assign({ feedback: null }) },
        RESET: { target: 'input', actions: assign({ script: null, feedback: null, attempt: '' }) },
      },
    },
  },
});
