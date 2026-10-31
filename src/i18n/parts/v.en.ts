// Default texts of the design building blocks (relaunch part 1c, D1 V-BAU, src/ui/v), English.

import type { vDe } from './v.de';

export const vEn: Record<keyof typeof vDe, string> = {
  vClose: 'Close',
  vRingShowBlocks: 'Show today’s blocks',
  vRingBlocks: 'Today’s blocks',
  vStepDone: 'done',
  vStepRun: 'in progress',
  vStepOpen: 'still open',
  vStepRunMeta: 'now',
  vStepMinutes: '{n} min',
  vWeek: 'This week',
  vDayDone: 'done',
  vDayToday: 'today',
  vDayTodayDone: 'today, done',
  vDayRest: 'rest day',
  vDayOpen: 'still open',
  vStreak_one: 'day streak',
  vStreak_other: 'day streak',
  vThin: 'not enough evidence yet',
  vLoading: 'Loading',
  vLoadFailed: 'This couldn’t load right now. Your data is safe.',
  vReload: 'Reload',
  vRetry: 'Try again',
  vReloadBusy: 'Loading …',
};
