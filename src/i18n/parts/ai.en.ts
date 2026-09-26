import type { AiMessageKey } from './ai.de';

// UI texts of the AI gate (src/ai), English (American spelling). Spread into en.ts.

export const aiEn: Record<AiMessageKey, string> = {
  aiThinking: 'Thinking…',
  aiQueued: 'Waiting…',
  aiSlow: 'This is taking longer than usual. You can wait or stop.',
  aiStop: 'Stop',
  aiRetry: 'Try again',
  aiRetryIn: 'Try again in {n} s',
  aiUnavailable: 'Claude is not available in this view.',
  aiBusy: 'Claude is busy right now. Try again in a minute.',
  aiSignin: 'Your claude.ai session has expired. Sign in again, then try once more.',
  aiRefused: 'Claude declined this request. Try phrasing it differently.',
  aiEmpty: 'Claude did not return an answer. Try with less text.',
  aiInvalid: 'The answer from Claude was incomplete. Try again.',
  aiTooLarge: 'The text is too long for one request. Shorten it and try again.',
  aiFailed: 'That did not work just now. Try again.',
};
