// Wort-Lernen 2, Paket „Kern“ (docs/umbau/wort-fest-plan.md, 21.10.2026): Abruf-Beschriftungen und die Kennzahlen unter „Messwerte dahinter“. Präfix `px`, Deutsch.

export const wortKernDe = {
  // Beschriftung der Abfrage (Kopf der Übung)
  pxWkRecallDay0a: 'Abruf 1 · mit Anfangsbuchstaben',
  pxWkRecallDay0b: 'Abruf 2 · frei aus dem Kopf',
  pxWkRecallYesterday: 'Gestern-Check',
  pxWkRecallFirst: 'Erster Abruf seit dem Lernen',
  // Messwerte dahinter: Wie gut bleiben Wörter hängen?
  pxWkTitle: 'Wie gut Wörter hängen bleiben',
  pxWkLead: 'Hier zählt nur, was du frei aus dem Kopf getippt hast. Auswahl und Aufdecken zählen nicht, weil Erkennen leichter ist als Abrufen.',
  pxWkNextDayLabel: 'Am Tag nach dem Lernen frei gewusst',
  pxWkChunkFirstLabel: 'Wendungen beim ersten freien Versuch gewusst',
  pxWkLongGapLabel: 'Nach 3 Wochen Pause frei gewusst',
  pxWkMedianSafeLabel: 'Tage, bis ein Wort „sicher“ ist (meistens)',
  pxWkProblemLabel: 'Wörter, die du zweimal oder öfter vergessen hast',
  pxWkRatioLabel: 'Frei getippt zu nur erkannt (letzte 4 Wochen)',
  pxWkPct: '{pct} % von {n}',
  pxWkDays_one: '{n} Tag (bei {k} Wörtern)',
  pxWkDays_other: '{n} Tage (bei {k} Wörtern)',
  pxWkProblemValue: '{pct} % ({n} von {of})',
  pxWkRatioValue: '{free} zu {recog}',
  pxWkNoData: 'noch zu wenige Messwerte',
  pxWkTargetNextDay: 'Ziel: mindestens 70 %',
  pxWkTargetChunkFirst: 'Ziel: mindestens 55 %',
  pxWkTargetLongGap: 'Ziel: mindestens 85 %',
  pxWkTargetMedianSafe: 'Ziel: höchstens 14 Tage',
  pxWkTargetProblem: 'Ziel: unter 5 %',
  pxWkTargetRatio: 'Ziel: mindestens 2 zu 1',
  pxWkOnTarget: 'Ziel erreicht',
  pxWkOffTarget: 'Ziel noch nicht erreicht',
} as const;
