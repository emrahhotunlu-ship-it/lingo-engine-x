import type { testToolsDe } from './testtools.de';

// Test tools texts (test build only, see src/app/testBuild.ts). Deliberately not registered in
// src/i18n/en.ts, so they never end up in the build for the production address.

export const testToolsEn: Record<keyof typeof testToolsDe, string> = {
  ttTitle: 'Test tools',
  ttNote: 'Only in this test version. For quick tries without the long placement test. All data is made up.',
  ttProfile: 'Set test profile (level B2, no placement test)',
  ttProfileDesc: 'Sets level B2, a vocabulary of 4,200 words and several weak grammar topics. The roadmap starts 25 days ago.',
  ttProfileDone: 'Test profile set: level B2',
  ttProgress: 'Sample progress (4 weeks)',
  ttProgressDesc: 'Fills streak, curve, forecast and roadmap: 28 days of training, about 150 cards (30 of them due now), grammar, rated input, one weekly brief and one monthly check. Sets the test profile first if needed.',
  ttProgressDone: 'Sample progress set: {cards} cards, {days} training days',
  ttInput: 'Sample input for today',
  ttInputDesc: 'Adds two sample items for today: one video and one article, with key words and a tip.',
  ttInputDone: 'Two sample items added for today',
  ttReset: 'Reset today',
  ttResetDesc: 'Resets the parts of today (words, grammar, input) and the counters so you can play the session again.',
  ttResetDone: 'Today was reset: the session can be started again',
  ttDue: 'Make 25 cards due now',
  ttDueDesc: 'Makes the next 25 cards due right away so there are reviews.',
  ttDueDone: '{n} cards are due now',
  ttDueNone: 'There are no cards to make due yet. Set the sample progress first.',
  ttSkip: 'Test: skip placement test (B2)',
  ttSkipDone: 'Test profile set, continuing to Today',
  ttFailed: 'That did not work. The details are in the error log.',
};
