// Rebuild – area Sprechen und Schreiben (P5), English (US). Only keys with the prefix `nbSprechen`.

import type { nbSprechenDe } from './nbSprechen.de';

export const nbSprechenEn: Record<keyof typeof nbSprechenDe, string> = {
  nbSprechenGoals: 'Goals',
  nbSprechenGoalMet: 'met',
  nbSprechenGoalPartly: 'partly',
  nbSprechenGoalOpen: 'open',
  nbSprechenCritMissed: 'missed',
  nbSprechenGoalsTitle: 'Your goals',
  nbSprechenGoalsCount: '{n} of {m} goals met',
  nbSprechenCriteria: 'Criteria',
  nbSprechenCriteriaWait: 'Claude is checking the criteria …',
  nbSprechenCriteriaFailed: 'The criteria could not be checked.',
  nbSprechenTgtGoal: 'Goal',
  nbSprechenTgtPhrase: '{have}/{need} of your phrases',
  nbSprechenTgtHedge: '{have}/{need} hedges',
  nbSprechenTgtTransition: '{have}/{need} transitions',
  nbSprechenTgtTool: 'Tool: {tool}',
  nbSprechenTgtPhrases: 'Phrases',
  nbSprechenResumeRoleplay: 'Role play',
  nbSprechenUnitDone: 'Continue the daily session',
  nbSprechenTraps: 'Watch out for:',
  nbSprechenTurnLeft: '{s} s left for your turn',
  nbSprechenTurnUp: 'Time\'s up – say it anyway',
  nbSprechenTurnTimerOff: 'Turn timer off',
  nbSprechenTurnTimerOn: '45 s per turn',
  nbSprechenCallMode: 'Call mode',
  nbSprechenCallOn: 'Call: you hear the reply, the text stays hidden.',
  nbSprechenCallReveal: 'Show text',
  nbSprechenCallSpeaking: '{name} is speaking …',
  nbSprechenCallHint: 'Answer out loud – dictate with 🎤 on your keyboard.',
};
