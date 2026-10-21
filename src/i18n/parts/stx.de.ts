// Paket ST (docs/umbau/wort-lernen-plan.md): ein ehrlicher Status für Wörter und Wendungen. Texte mit Präfix `stx`, Deutsch.

export const stxDe = {
  // Eine Zeile: Zustand · Beleg · zuletzt falsch
  stxDetailNew: 'noch nicht geübt',
  stxDetailRecognize: 'du erkennst es, aber noch nicht aus dem Kopf',
  stxDetailHelp: 'mit Hilfe geschafft, noch nicht frei',
  stxDetailFree: 'frei abgerufen an {n} von 3 Tagen',
  stxDetailWobblyWrong: 'falsch am {date}, seitdem nicht geübt',
  stxDetailWobblyRecover: 'seit dem Fehler noch nicht an 2 Tagen wieder frei richtig',
  stxDetailWobblyGap: 'nach langer Pause nicht mehr sicher',
  stxDetailFirm: 'im neuen Satz gekonnt',
  stxDetailLongGap: 'fehlt nur noch: nach 3 Wochen Pause frei abrufen',
  stxDetailOld: 'Stand aus der alten App, noch nicht neu belegt',
  stxDetailFlip: 'im Kopf abgerufen (selbst bewertet), noch nicht getippt',
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
  stxStepLongGap: 'Nach 3 Wochen Pause frei gewusst',
  stxYes: 'ja',
  stxNot: 'noch nicht',
  stxExplain: 'Sicher: an 2 Tagen frei abgerufen. Fest: an 3 Tagen frei abgerufen, im neuen Satz gekonnt oder selbst benutzt und nach mindestens 3 Wochen Pause noch frei gewusst. Wackelt: nach einem Fehler oder langer Pause noch nicht wieder bestätigt.',
  // Jetzt im Kopf
  stxMindLabel: 'Jetzt im Kopf',
  stxMindGood: 'gut',
  stxMindShaky: 'wackelig',
  stxMindForgotten: 'vermutlich vergessen',
  stxMindNoGap: 'noch kein Abstand',
  stxMindNoGapHint: 'Erst nach einem Tag Pause kann die App sagen, wie gut es sitzt.',
  stxMindNew: 'noch nicht gelernt',
  // Messwerte dahinter
  stxRawStage: 'Höchste Stufe',
  // Erklärzeile zur strengeren Fest-Zählung (gilt ab 20.10.2026, einige Wochen sichtbar)
  stxFestRuleNote: 'Fest zählt jetzt strenger: Ein Wort zählt erst, wenn du es nach mindestens 3 Wochen Pause noch frei wusstest. Darum ist die Zahl gerade kleiner.',
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
