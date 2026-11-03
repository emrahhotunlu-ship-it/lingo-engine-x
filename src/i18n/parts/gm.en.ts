// Großpaket G (docs/umbau/grammatik/grosspaket-g.md): texts of the new grammar with prefix `gm`, English.

export const gmEn = {
  gmRepTopic: 'Your own sentence',
  gmComesBack: 'Comes back tomorrow',
  gmSwitch: 'New grammar',
  gmSwitchOnHint: 'On: your sentences to fix come first, and Claude’s explanation is shorter. Turning it off returns to the previous flow; your progress stays.',
  gmSwitchOffHint: 'Off: grammar works as before. Your progress stays the same.',
  gmSwitchFailed: 'Could not be saved. Please try again in a moment.',
  gmPathNext: 'Up next',
  gmPathSafe: 'Already solid ({n})',
  gmPathAll: 'See all {n} chapters',
  gmErrorsHead: 'Sentences to fix',
  gmBtnTest: 'Finish topic',
  gmUnfairLink: 'Was this task unfair?',
  gmPathSteps: '{n} of 5 steps',
  gmReportNote: "This answer won't count then.",
  gmTestEarly: "You don't need all 5 steps for it: if it doesn't stick yet, you practice exactly that next.",
  gmStandHead: 'Your progress',
  gmStandOnWay_one: 'None solid yet · 1 word on its way',
  gmStandOnWay_other: 'None solid yet · {n} words on their way',
} as const;
