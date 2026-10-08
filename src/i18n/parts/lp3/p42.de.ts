// Lernplattform 3.0 · P42 (Kapitelprüfung und Meilenstein-Katalog): Texte mit Präfix `px` (Prüfung) und `mo` (Meilenstein-Sätze), Deutsch.

export const pxP42De = {
  // Karte auf Heute und Abschnitt im Kapitelblatt
  pxGtCardEyebrow: 'Extra · keine Pflicht',
  pxGtCardTitle: 'Kapitel {n} · Abschlussprüfung',
  pxGtCardText: 'Du hast alle Themen des Kapitels kennengelernt und eine Weile geübt. Zeig, dass sie sitzen: {g} Aufgaben und {w} Wörter, ohne Hilfen. Etwa 12 Minuten.',
  pxGtCardStart: 'Prüfung starten',
  pxGtSecTitle: 'Abschlussprüfung',
  pxGtStReady: 'Bereit. Etwa 12 Minuten, ohne Hilfen. Sie ist ein Extra und ändert weder deine Serie noch deine Pflicht.',
  pxGtStPassed: 'Bestanden am {d}.',
  pxGtStPause: 'Neuer Versuch ab {d}. Bis dahin kannst du die Themen weiter üben.',
  pxGtStSpent: 'Alle Versuche sind verbraucht. Sprich mit deinem Lehrer über das Kapitel, dann schauen wir gemeinsam weiter.',
  pxGtStSoon: 'Für dieses Kapitel gibt es noch keine Prüfung.',
  pxGtStTopics: 'Sie wird bereit, sobald du alle Themen des Kapitels kennengelernt hast.',
  pxGtStSettle: 'Sie wird bereit, wenn die letzte Einführung zwei Wochen zurückliegt: frühestens ab {d}.',
  pxGtStStrength: 'Erst noch ein wenig üben: {names}. Dann ist die Prüfung bereit.',

  // Blatt
  pxGtTitle: 'Abschlussprüfung · Kapitel {n}',
  pxGtClose: 'Prüfung schließen',
  pxGtIntroLead: 'Kapitel {n}, „{name}“: Teil 1 sind Aufgaben zu allen Themen des Kapitels, Teil 2 sind Wörter aus deinen eigenen Karten. Etwa 12 Minuten.',
  pxGtIntroRules: 'Es gibt keine Tipps, kein Wörterbuch und keine Rückmeldung während der Prüfung. Am Ende siehst du, was richtig war.',
  pxGtIntroNothing: 'Abbrechen geht jederzeit. Dann wird nichts gespeichert und es zählt nicht als Versuch.',
  pxGtStart: 'Los geht’s',
  pxGtCancel: 'Abbrechen',
  pxGtEmpty: 'Für dieses Kapitel liegen noch keine Prüfungsaufgaben bereit.',
  pxGtPart: 'Teil {n} von {m}: {name}',
  pxGtPartGrammar: 'Grammatik',
  pxGtPartWords: 'Wörter',
  pxGtWordAsk: 'Welches englische Wort oder welche Wendung fehlt im Satz? Tippe sie ein.',
  pxGtWordMeaning: 'Gesucht',
  pxGtWordLabel: 'Fehlendes Wort',

  // Ergebnis
  pxGtResDone: 'Kapitel {n} abgeschlossen',
  pxGtResNotYet: 'Noch nicht.',
  pxGtResGrammar: 'Grammatik: {a} von {b} richtig (bestanden ab {p} %)',
  pxGtResWords: 'Wörter: {a} von {b} richtig (bestanden ab {p} %)',
  pxGtResNoWords: 'Wörter: Dafür hast du noch zu wenige geübte Karten mit Beispielsatz. Heute zählt nur die Grammatik.',
  pxGtResGoal: 'Abgeschlossen heißt',
  pxGtResUse: 'Dafür brauchst du es im Job',
  pxGtResProof: 'Drei Sätze, die du richtig hattest',
  pxGtResNext: 'Als Nächstes: Kapitel {n}, „{name}“.',
  pxGtResLast: 'Das war das letzte Kapitel des Programms.',
  pxGtResWeak: 'Hier lohnt sich noch Übung: {names}. Üb diese Themen einfach weiter wie bisher.',
  pxGtResRetry: 'Neuer Versuch ab {d}.',
  pxGtResHonest: 'Das Ergebnis sagt etwas über dieses Kapitel, nicht über dein Niveau. Es ändert weder Serie noch Pflicht.',
  pxGtResClose: 'Fertig',
  pxGtResSaveFailed: 'Das Ergebnis konnte nicht gespeichert werden.',
  pxGtResSaveRetry: 'Erneut speichern',
  pxGtResCloseUnsaved: 'Schließen ohne Speichern',

  // Meilenstein-Sätze auf Heute (Abschlusskarte)
  moMsPlace: 'Dein Startpunkt steht: Die Einstufung ist gespeichert.',
  moMsChapter: 'Kapitel {n} abgeschlossen: {name}.',
  moMsCheck: 'Dein erster C1-Check ist gespeichert.',
  moMsC1: 'Alle Kriterien der C1-Etappe sind erfüllt. Sprechen und Schreiben misst die App nicht.',
} as const;
