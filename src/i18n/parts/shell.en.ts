// Relaunch stage 1, P2 S1-SHELL: frame for phone, rail and laptop (5 tabs, sidebar, context column, "Ask"), English (US). Prefix `sh`.

import type { shellDe } from './shell.de';

export const shellEn: Record<keyof typeof shellDe, string> = {
  shTabPractice: 'Practice',
  shNavLabel: 'Main sections',
  shWordmark: 'Lingo',
  shAsk: 'Ask',
  shClaude: 'Claude',
  shTranslator: 'Translator',
  shSettings: 'Settings',
  shSpeak: 'Speaking',
  shListen: 'Listening',
  shRead: 'Read',
  shPracticeOpen: 'Expand Practice',
  shPracticeClose: 'Collapse Practice',
  shContext: 'Context',
  shContextEmpty: 'Claude, word details and explanations appear here when you open them.',
  shContextEmptyNoAi: 'Word details and explanations appear here when you open them.',
  shPracticeMore: 'Read and speak',
  shReadSub: 'Today’s article and courses',
  shSpeakSub: 'Role-play and objection practice',
};
