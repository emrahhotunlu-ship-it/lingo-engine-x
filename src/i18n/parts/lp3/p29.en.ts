// Learning platform 3.0 · P29 (capacity display): texts with prefix `px`, English (US).

export const pxP29En = {
  pxCapTitle: 'Space in the database',
  pxCapDocs: 'Documents {n} of {limit}',
  pxCapCol: '{name}: {n} of {limit}',
  pxCapColVocab: 'Words',
  pxCapColChunk: 'Phrases',
  pxCapColLog: 'Logs',
  pxCapMarkWarn: 'warning level',
  pxCapMarkPre: 'early warning',
  pxCapSufMonths: '· {mark} ({at}) in about {lo}–{hi} months',
  pxCapSufMonthsSame_one: '· {mark} ({at}) in about {lo} month',
  pxCapSufMonthsSame_other: '· {mark} ({at}) in about {lo} months',
  pxCapSufNone: '· {mark} ({at}): no forecast yet',
  pxCapSufReached: '· {mark} ({at}) has been reached',
  pxCapSufFull: '· window of {limit} is full, the backup names the cut-off collection',
  pxCapHint: 'If space gets tight there are two ways: switch off the daily intake job (feed) or bundle cards. You decide both; the app changes nothing on its own.',
  pxCapUnknown: 'Counting is not possible right now.',
} as const;
