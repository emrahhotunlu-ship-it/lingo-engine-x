import type { bandDe } from './band.de';

// Oberflächentexte des Übungsrahmens mit Band (Relaunch Stufe 1, P3 S1-BAND, docs/relaunch/stufe1-plan.md §6.4), Englisch.

export const bandEn: Record<keyof typeof bandDe, string> = {
  bandLabel: 'Feedback',
  bandWhy: 'Why',
  bandAi: 'from Claude',
  bandMore: 'More',
  bandMoreTitle: 'More about this task',
  bandMoreClose: 'Close',
  bandVerdictShown: 'Answer shown',
  bandMenu: 'Menu',
  bandMenuWhy: 'Why this task?',
  bandMenuPause: 'Pause, continue later',
  bandMenuClose: 'Close menu',
  bandKeys: 'Keyboard shortcuts',
  bandKeysClose: 'Close keyboard shortcuts',
  bandKeyEnter: 'Check or continue',
  bandKeyHint: 'Hint',
  bandKeyWord: 'I don’t know',
  bandKeyChoice: 'Choose an answer',
  bandKeyEsc: 'Close sheet, menu or column (never the exercise)',
  bandKeyHelp: 'This overview',
  bandBar: 'Progress: section {n} of {total}',
};
