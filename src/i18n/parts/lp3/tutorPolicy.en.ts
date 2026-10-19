// Tutor engine v3 (slices S2/S3: "Why this task?", move in the round, mini-lesson, progress proof): texts with prefix `tt`, English (US).
// Numbers come only from data (`whyOf`, `progressProof`); if a value is missing, the sentence comes without a number.

export const ttPolicyEn = {
  ttWhyToggle: 'Why this task?',
  ttWhyHide: 'Hide reason',
  ttWhy_due0: 'Your mistake from today comes back once more so it sticks.',
  ttWhy_due1: 'Your mistake from yesterday is back: now we see whether it stuck.',
  ttWhy_due: 'Your mistake from {days} days ago is back: now we see whether it stuck.',
  ttWhy_dueBare: 'One of your mistakes is back: now we see whether it stuck.',
  ttWhy_hyp: 'With {name}, you recently used {vs} {n} times. This task checks exactly that spot.',
  ttWhy_weakQ: 'With {name}, {ok} of {n} typed answers in the last 4 weeks were right. That is why you practice it here.',
  ttWhy_weakD0: 'With {name}, one answer today was wrong. That is why it comes back.',
  ttWhy_weakD1: 'With {name}, one answer yesterday was wrong. That is why it comes back.',
  ttWhy_weakD: 'With {name}, one answer {days} days ago was wrong. That is why it comes back.',
  ttWhy_chapter: '{name} is part of your current chapter.',
  ttWhy_mix: 'Mixed review: {name} comes back so it does not get rusty.',
  ttWhy_known: 'Something familiar for a moment, then on we go.',
  ttWhy_freer: 'Your last answers were solid, so this form is one step freer.',
  ttWhy_supported: 'One step easier, so the rule sticks first.',
  ttWin: 'Something familiar for a moment, then on we go.',
  ttLessonWhy: 'More questions will not help right now. The rule in short:',
  ttProof: '{name}: {weeks} weeks ago {thenOk} of {thenN}, now {nowOk} of {nowN}.',
};
