// Texts of “Today” in the new design (relaunch part 1c, D2 V-HEUTE; preview H1/L1, wording from screens.js/desk.js), English.

import type { vhDe } from './vh.de';

export const vhEn: Record<keyof typeof vhDe, string> = {
  vhToday: 'Today',
  vhAsk: 'Ask',
  vhMinToday: 'min today',
  vhMinLeft: 'min left',
  vhMinDone: '{n} min',
  vhNext: 'Next: {what}',
  vhGo: 'Let’s go',
  vhContinue: 'Continue',
  vhDayTitle: 'Your plan for today',
  vhNewTopic: 'New topic: {topic}',
  vhMore: 'If you want more',
  vhMoreAll: 'Show all',
  vhWordsPractice: 'Practice words',
  vhWordsPracticeSub: '{n} due, counts as extra',
  vhWeekDone: 'done',
  vhWeekRest: 'Rest day',
  vhWeekOpen: 'open',
  vhWeekToday: 'today',
  vhWeekTodayDone: 'today · done',
  vhWeekNoStudy: 'no study day',
  vhWeekRecap: 'Weekly review',
  vhRestartWeek: 'Restart week',
};
