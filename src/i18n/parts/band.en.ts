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
  bandMenuPause: 'Pause and finish later',
  bandMenuClose: 'Close menu',
  bandKeys: 'Keyboard shortcuts',
  bandKeysClose: 'Close keyboard shortcuts',
  bandKeyEnter: 'Check or continue',
  bandKeyHint: 'Hint',
  bandKeyDontKnow: 'I don’t know',
  bandKeyChoice: 'Choose an answer',
  bandKeyEsc: 'Close a panel or menu (not the exercise)',
  bandKeyHelp: 'Show all shortcuts',
  bandYou: 'You',
  bandRightHelped: 'Got it with a hint – counts as “Hard”',
  bandRightStart: 'Got it with the first letters – you’ll see it again soon',
  bandKeysAll: '? all shortcuts',
  bandWhyMore: 'Don’t mix up',
  bandBar: 'Progress: section {n} of {total}',
};
