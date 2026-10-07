// Learning platform 3.0 · P22 (motivation selectors): texts with prefix `mo`, English (US). Plain, no exclamation marks, no loss wording
// (checked by `tests/unit/motivationText.test.ts`).

export const moP22En = {
  moWeekProgress: 'Week {n} of 6',
  moWeekReached: 'Week complete',
  moWeekReached7: 'Week complete · 7 days',
  moWeekOver: 'This week: {n} study days · Monday starts fresh',
  moStreakWeek: 'Streak {streak} · {week}',
  moRestFree: 'Rest day free this week',
  moRestUsed: 'Rest day used ({day})',
  moFestUnits: '{n} words and phrases solid',
  moGoalFest: 'Next goal: {need} words and phrases solid · {left} to go',
  moGoalFestWeeks: 'Next goal: {need} words and phrases solid · {left} to go · about {lo}–{hi} weeks',
  moGoalChapter: 'Next goal: chapter {n} · {have} of {need} patterns secure',
  moGoalCheck: 'Next goal: the next C1 check',
  moGroupLine: '{name} · Solid {firm} · Secure {safe} · Learning {learning} · New {new} (of {size})',
  moSigHead: 'Numbers behind it',
  moSigNoData: 'no data yet',
  moSigWeekQuota: 'Weeks with 6 study days: {hit} of {n}',
  moSigVoluntary: 'Days with extra after the duty: {hit} of {n}',
  moSigReturn: 'Typical break: {median} days ({n} breaks)',
  moSigAbort: 'Rounds stopped early: {hit} of {n}',
} as const;
