// Rebuild – app frame (WP0, docs/neubau/architektur.md §2): tabs, header, sheets. English (US).
// Only keys with the prefix `nbSh`.

import type { nbShDe } from './nbSh.de';

export const nbShEn: Record<keyof typeof nbShDe, string> = {
  nbShTabToday: 'Today',
  nbShTabVocab: 'Vocab',
  nbShTabRead: 'Read',
  nbShTabSpeak: 'Speak',
  nbShTabLearn: 'Practice',
  nbShProfile: 'Profile and progress',
  nbShReviewSub: 'Your due cards',
  nbShFbOk: 'Correct',
  nbShFbClose: 'Almost right',
  nbShFbWrong: 'Not quite yet',
  nbShFbUnchecked: 'Saved – not checked',
  nbShFbMine: 'Your answer',
  nbShFbSolution: 'Solution',
  nbShFbUpgrades: 'Sounds even better',
  nbShFbAgain: 'Again, but better',
  nbShFbWhy: 'Why?',
  nbShNext: 'Next',
  nbShEndTitle: 'Done',
  nbShEndScore: '{right} of {total} correct',
  nbShEndMinutes: 'about {min} min',
  nbShEndNew: 'New for you',
  nbShEndTakeaways: 'Takeaways',
};
