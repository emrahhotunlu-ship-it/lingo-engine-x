// Tutor-Engine v3 (Scheiben S2/S3: „Warum diese Aufgabe?“, Zug der Runde, Mini-Lektion, Fortschrittsbeleg): Texte mit Präfix `tt`, Deutsch.
// Zahlen kommen nur aus Daten (`whyOf`, `progressProof`); fehlt ein Wert, gibt es den Satz ohne Zahl.

export const ttPolicyDe = {
  ttWhyToggle: 'Warum diese Aufgabe?',
  ttWhyHide: 'Grund ausblenden',
  ttWhy_due0: 'Dein Fehlersatz von heute kommt noch einmal, damit er sitzt.',
  ttWhy_due1: 'Dein Fehlersatz von gestern kommt wieder: Jetzt zeigt sich, ob er sitzt.',
  ttWhy_due: 'Dein Fehlersatz von vor {days} Tagen kommt wieder: Jetzt zeigt sich, ob er sitzt.',
  ttWhy_dueBare: 'Ein Fehlersatz von dir kommt wieder: Jetzt zeigt sich, ob er sitzt.',
  ttWhy_hyp: 'Bei {name} hast du zuletzt {n}-mal {vs} genommen. Diese Aufgabe prüft genau diese Stelle.',
  ttWhy_weakQ: 'Bei {name} waren in den letzten 4 Wochen {ok} von {n} getippten Antworten richtig. Darum übst du es gezielt.',
  ttWhy_weakD0: 'Bei {name} war heute eine Antwort falsch. Darum kommt es noch einmal.',
  ttWhy_weakD1: 'Bei {name} war gestern eine Antwort falsch. Darum kommt es noch einmal.',
  ttWhy_weakD: 'Bei {name} war vor {days} Tagen eine Antwort falsch. Darum kommt es noch einmal.',
  ttWhy_chapter: '{name} gehört zu deinem aktuellen Kapitel.',
  ttWhy_mix: 'Mischung: {name} kommt wieder dran, damit es nicht einrostet.',
  ttWhy_known: 'Kurz etwas Bekanntes, dann weiter.',
  ttWhy_freer: 'Deine letzten Antworten saßen. Darum ist diese Form eine Stufe freier.',
  ttWhy_supported: 'Eine Stufe leichter, damit die Regel erst einmal sicher sitzt.',
  ttWin: 'Kurz etwas Bekanntes, dann weiter.',
  ttLessonWhy: 'Abfragen hilft hier gerade nicht. Die Regel in Kürze:',
  ttProof: '{name}: vor {weeks} Wochen {thenOk} von {thenN}, jetzt {nowOk} von {nowN}.',
};
