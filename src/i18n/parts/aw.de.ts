// Auswertung 15.10.2026 (Punkte 1–6): kleine Hinweise, Deutsch. Einfache Sprache, keine Fachwörter (CLAUDE.md A2).

export const awDe = {
  awFixUnsure: 'Keine sichere Korrektur: Claude war sich hier nicht sicher. Die Erklärung gilt trotzdem.',
  awFixUnsureTyped: 'Keine sichere Korrektur. Der Fehler liegt bei: {type}. Die Erklärung gilt trotzdem.',
  awStageHold_one: 'Für Stufe {stage} brauchst du noch {n} freie Antwort an einem anderen Tag. Auswahl und Hilfen zählen hier nicht, weil Erkennen leichter ist als Abrufen.',
  awStageHold_other: 'Für Stufe {stage} brauchst du noch {n} freie Antworten an anderen Tagen. Auswahl und Hilfen zählen hier nicht, weil Erkennen leichter ist als Abrufen.',
  awAuxName: 'Verbform nach Hilfsverb',
  awAuxLead: 'Nach will, would, have, had, been und having steht immer eine bestimmte Verbform. Mit diesen fünf Mustern vermeidest du die meisten dieser Fehler.',
  awLoadHigh: 'Viele deiner Karten sind in den letzten 7 Tagen wieder durchgefallen. Vorschlag: Heute weniger neue Wörter, dafür die schwierigen sicher machen.',
  awLoadAction: 'Weniger neue Wörter einstellen',
  awReadNoJob: 'Passt vermutlich nicht zu deinem Beruf',
  awRadarStill: 'Radar zeigt noch Fehler',
  awAuxFreeOk: 'Gut: Die Verbformen in deinem Satz stimmen.',
  awAuxFreeErr: 'Sieh dir diese Stelle an: „{text}“. Nach dem Hilfsverb steht eine bestimmte Verbform (siehe die Regeln oben).',
  awAuxFreePurpose: 'Im eigenen Satz übst du die Verbform so, wie du sie später wirklich brauchst.',
  awWeeklyOpen: 'Im Radar noch offen: {topics}',
} as const;
