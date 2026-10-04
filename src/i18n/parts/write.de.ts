// Texte für Schreiben, Reparatur und Stolpersteine (Paket A). Einfache Sprache, kurz.

export const writeDe = {
  // Einstieg
  schHomeWrite: 'Schreibauftrag',
  schBriefRepair_one: 'Dazu {n} Satz zum Reparieren.',
  schBriefRepair_other: 'Dazu {n} Sätze zum Reparieren.',
  schInputWrite: 'Schreib 3–4 Sätze dazu',

  // Schreiben
  schTitle: 'Schreiben',
  schExtra: 'Extra',
  schFmtWrite: 'Schreiben',
  schWhyWrite: 'Eigene Sätze selbst zu bilden festigt Wörter und Grammatik stärker als Lesen. Die Korrektur zeigt dir genau, was noch hakt.',
  schTaskInput: 'Schreib 3–4 Sätze zu „{title}“: Worum geht es, und was denkst du darüber? Versuch zwei der Schlüsselwörter zu benutzen.',
  schOtherTask: 'Andere Aufgabe',
  schKeyWords: 'Schlüsselwörter zum Antippen',
  schInputLabel: 'Dein Text auf Englisch',
  schPlaceholder: 'Schreib hier …',
  schCount: '{n} Wörter · Ziel {min}–{max}',
  schCorrect: 'Korrigieren',
  schNeedMore: 'Schreib mindestens {n} Wörter, dann kann Claude korrigieren.',
  schNoAi: 'Zum Korrigieren braucht die App Claude. In dieser Ansicht ist Claude nicht verfügbar.',
  schReading: 'Claude liest deinen Text …',
  schUsed: 'benutzt',

  // Ergebnis
  schLevel: 'Dein Text liegt bei etwa {level}.',
  schErrors_one: '{n} Stelle zum Verbessern',
  schErrors_other: '{n} Stellen zum Verbessern',
  schNoErrors: 'Keine Fehler gefunden. Stark!',
  schWhy: 'Warum',
  schCorrectedTitle: 'Dein Text, korrigiert',
  schUpgradesTitle: 'Aus gut wird stärker (C1)',
  schUpgradeWeak: 'Dein Satz',
  schUpgradeStrong: 'C1-Fassung',
  schRepairNote_one: 'Dieser Fehler kommt als Reparatur-Aufgabe zurück, zum ersten Mal morgen.',
  schRepairNote_other: 'Diese {n} Fehler kommen als Reparatur-Aufgaben zurück, zum ersten Mal morgen.',
  schDone: 'Fertig',
  schAnother: 'Noch ein Text',

  // Fehlerarten
  schCatArticles: 'Artikel',
  schCatPrepositions: 'Präpositionen',
  schCatTenses: 'Zeitformen',
  schCatWordOrder: 'Wortstellung',
  schCatCollocation: 'Feste Verbindungen',
  schCatFalseFriend: 'Falsche Freunde',
  schCatSpelling: 'Schreibweise',
  schCatRegister: 'Ton und Stil',
  schCatVocabulary: 'Wortwahl',
  schCatOther: 'Sonstiges',

  // Reparatur
  schFmtRepair: 'Reparatur',
  schWhyRepair: 'Wer einen Fehler selbst verbessert, lernt mehr als vom Lesen der Lösung. Darum kommt jeder Fehler wieder, bis er sitzt.',
  schRepairTask: 'Repariere den Satz.',
  schRepairLabel: 'Richtige Fassung',
  schDontKnow: 'Weiß ich nicht',
  schRepairTomorrow: 'Kommt morgen wieder.',
  schRepairInDays: 'Kommt in {n} Tagen wieder.',
  schRepairDone: 'Erledigt. Das sitzt.',

  // Fahrplan
  schStumbleTitle: 'Deine häufigsten Stolpersteine',
  schStumbleIntro: 'Aus deinen Texten und Grammatik-Aufgaben der letzten 30 Tage.',
  schStumbleNone: 'Noch nichts zu zählen. Schreib einen Text oder löse Grammatik-Aufgaben, dann zeigt sich, wo du stolperst.',
  schStumbleCount: '{n}×',
  schTrendUp: 'häufiger als in den 30 Tagen davor',
  schTrendDown: 'seltener als in den 30 Tagen davor',
  schTrendSame: 'so oft wie in den 30 Tagen davor',
  schWriteCardTitle: 'Schreiben',
  schWriteCount_one: '{n} Text geschrieben',
  schWriteCount_other: '{n} Texte geschrieben',
  schWriteNone: 'Noch kein Text. Schreib 3–4 Sätze: Claude korrigiert sie einmal, deine Fehler kommen als Reparatur zurück.',
  schWriteLevels: 'Niveau der letzten Texte: {list}',
  schWriteStart: 'Schreibauftrag starten',
} as const;
