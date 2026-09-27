// Rebuild – app frame (WP0, docs/neubau/architektur.md §2): tabs, header, sheets. English (US).
// Only keys with the prefix `nbSh`.

import type { nbShDe } from './nbSh.de';

export const nbShEn: Record<keyof typeof nbShDe, string> = {
  nbShTabToday: 'Today',
  nbShTabVocab: 'Vocabulary',
  nbShTabRead: 'Read',
  nbShTabSpeak: 'Speak',
  nbShTabLearn: 'Practice',
  nbShProfile: 'Profile and progress',
  nbShAllPractice: 'All exercises',
  nbShAllPracticeSub: 'Quick drills, free round, Say it',
  nbShReviewSub: 'Your due cards',
};
