// Evaluation of 10/15/2026 (items 1-6): small hints, English (US).

export const awEn = {
  awFixUnsure: "No reliable correction here: Claude wasn't sure. The explanation still applies.",
  awFixUnsureTyped: 'No reliable correction here. The mistake is in: {type}. The explanation still applies.',
  awStageHold_one: 'Still {n} answer from memory on another day, then the word counts as {goal}. Choices and help do not count here, because recognizing is easier than recalling.',
  awStageHold_other: 'Another {n} answers from memory on different days, then the word counts as {goal}. Choices and help do not count here, because recognizing is easier than recalling.',
  awAuxName: 'Verb form after an auxiliary',
  awAuxLead: 'A specific verb form always follows will, would, have, had, been, and having. These five patterns prevent most of these mistakes.',
  awLoadHigh: 'Many of your cards were forgotten again in the last 7 days. Suggestion: fewer new words today, and lock in the hard ones first.',
  awLoadAction: 'Fewer new words per day',
  awReadNoJob: 'Probably not relevant to your job',
  awRadarStill: 'Radar still shows mistakes',
  awAuxFreeOk: 'Good: the verb forms in your sentence are right.',
  awAuxFreeErr: 'Take another look at this spot: "{text}". A specific verb form follows the auxiliary (see the rules above).',
  awAuxFreePurpose: 'Your own sentence practices the verb form the way you will really need it later.',
  awWeeklyOpen: 'Still open on your radar: {topics}',
} as const;
