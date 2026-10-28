// Relaunch stage 1, P6 S1-START: start screen from `app/today`, boot without waiting, waiting start, timings. English (US). Prefix `st`.

import type { startDe } from './start.de';

export const startEn: Record<keyof typeof startDe, string> = {
  stSlow: 'Connecting to your data is taking longer than usual',
  stSlowRetry: 'Try again',
  stWaiting: 'Getting your first task ready',
  stWaitingCancel: 'Cancel',
  stDiag: 'Button after {b} · first task after {f}',
  stDiagSec: '{n} s',
  stDiagNone: '–',
  stDiagLabel: 'Start',
  stChapter: 'Grammar chapter',
  stWords: 'Words locked in',
  stEnter: 'Enter starts',
};
