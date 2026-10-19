// Paket ST (docs/umbau/wort-lernen-plan.md): ein ehrlicher Status für Wörter und Wendungen. Texte mit Präfix `stx`, Deutsch.

export const stxDe = {
  // Eine Zeile: Zustand · Beleg · zuletzt falsch
  stxDetailNew: 'noch nicht geübt',
  stxDetailRecognize: 'du erkennst es, aber noch nicht aus dem Kopf',
  stxDetailHelp: 'mit Hilfe geschafft, noch nicht frei',
  stxDetailFree: 'frei abgerufen an {n} von 3 Tagen',
  stxDetailWobblyWrong: 'zuletzt falsch, noch nicht wieder geübt',
  stxDetailWobblyRecover: 'seit dem Fehler noch nicht an 2 Tagen wieder frei richtig',
  stxDetailWobblyGap: 'nach langer Pause nicht mehr sicher',
  stxDetailFirm: 'im neuen Satz gekonnt',
  stxDetailStart: 'wird gerade gelernt',
  stxLastWrong: 'zuletzt falsch am {date}',
  // Wortblatt: die Leiter der Belege
  stxLadderTitle: 'Was du schon kannst',
  stxStepRecognize: 'Erkennst du',
  stxStepHelp: 'Mit Hilfe',
  stxStepFree: 'Frei abgerufen',
  stxStepFreeOf: '{n} von 3 Tagen',
  stxStepNewSentence: 'Im neuen Satz',
  stxStepOwn: 'Selbst benutzt (von Claude geprüft)',
  stxYes: 'ja',
  stxNot: 'noch nicht',
  stxExplain:
    'Sicher heißt: an 2 verschiedenen Tagen ohne Auswahl und ohne Hilfe getippt. Fest heißt: dazu mindestens 21 Tage Haltbarkeit, im neuen Satz gekonnt und kein offener Fehler. Wackelt heißt: war schon weiter, aber nach dem letzten Fehler hast du es noch nicht an 2 Tagen wieder frei richtig gewusst, oder die Erinnerung ist nach langer Pause schwach.',
  // Jetzt im Kopf
  stxMindLabel: 'Jetzt im Kopf',
  stxMindGood: 'gut',
  stxMindShaky: 'wackelig',
  stxMindForgotten: 'vermutlich vergessen',
  stxMindNoGap: 'noch kein Abstand',
  stxMindNoGapHint: 'Erst nach einem Tag Pause kann die App sagen, wie gut es sitzt.',
  stxMindNew: 'noch nicht gelernt',
  // Messwerte dahinter
  stxRawStage: 'Stufe (höchste bestandene Abfrageart)',
  // Erklärzeile zur strengeren Fest-Zählung (gilt ab 20.10.2026, einige Wochen sichtbar)
  stxFestRuleNote: 'Fest zählt jetzt strenger: Du musst das Wort in mindestens zwei verschiedenen Sätzen selbst gewusst haben, ohne Auswahl und ohne Hilfe. Deshalb ist die Zahl gerade klein. Sie wächst, sobald die Sätze wechseln und du die Wörter öfter frei schreibst.',
  stxGoalSafe: 'sicher',
  stxGoalFirm: 'fest',
  // Filter der Wortliste
  stxFilterLearning: 'Lernt',
  stxFilterWobbly: 'Wackelt',
  stxFilterSafe: 'Sicher',
  stxFilterFirm: 'Fest',
  // Hub: Behaltensquote
  stxRetentionRecognition: 'Zum Vergleich beim Erkennen (Auswahl): {pct} % bei {n} Antworten',
  stxRetentionNote: 'Gezeigt wird das freie Abrufen. Beim Erkennen liegt die Quote fast immer höher.',
} as const;
