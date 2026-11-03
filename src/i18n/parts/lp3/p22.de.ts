// Lernplattform 3.0 · P22 (Motivation-Selektoren): Texte mit Präfix `mo`, Deutsch. Schlicht, ohne Ausrufezeichen und ohne Verlust-Wörter
// (geprüft von `tests/unit/motivationText.test.ts`).

export const moP22De = {
  moWeekProgress: '{n} von 6 Tagen diese Woche',
  moWeekReached: '6 von 6 Tagen diese Woche ✓',
  moWeekReached7: 'Alle 7 Tage diese Woche ✓',
  moWeekOver: 'Diese Woche: {n} von 6 Tagen · Montag beginnt neu',
  moStreakWeek: '{streak} · {week}',
  moRestFree: 'Ruhetag diese Woche frei',
  moRestUsed: 'Ruhetag genutzt ({day})',
  moFestUnits: '{n} Wörter und Wendungen fest',
  moGoalFest: 'Nächstes Ziel: {need} Wörter und Wendungen fest · noch {left}',
  moGoalFestWeeks: 'Nächstes Ziel: {need} Wörter und Wendungen fest · noch {left} · etwa {lo}–{hi} Wochen',
  moGoalChapter: 'Nächstes Ziel: Kapitel {n} · {have} von {need} Mustern sicher',
  moGoalCheck: 'Nächstes Ziel: der nächste C1-Check',
  moGroupLine: '{name} · Fest {firm} · Sicher {safe} · Lernt {learning} · Neu {new} (von {size})',
  moSigHead: 'Messwerte dahinter',
  moSigNoData: 'noch keine Daten',
  moSigWeekQuota: 'Wochen mit 6 Lerntagen: {hit} von {n}',
  moSigVoluntary: 'Tage mit Extra nach der Pflicht: {hit} von {n}',
  moSigReturn: 'Typische Pause: {median} Tage ({n} Pausen)',
  moSigAbort: 'Abgebrochene Runden: {hit} von {n}',
} as const;
