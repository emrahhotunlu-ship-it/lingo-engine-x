// Oberflächentexte der Lücken aus dem Abgleich (M7, M10, M13, M18, M20, M21, M22, W5), Deutsch.
// Einfache Sprache, keine Fachwörter (CLAUDE.md A2).

export const standDe = {
  // Wochen-Check (M10)
  ckTitle: 'Wochen-Check',
  ckOfferSub: '12 Aufgaben ohne Tipps · einmal pro Woche',
  ckStart: 'Check starten',
  ckClose: 'Check beenden',
  ckBadge: 'Wochen-Check',
  ckDone: 'Wochen-Check: {pct} % richtig',
  ckFirst: 'Dein erster Check – ab nächster Woche siehst du hier den Vergleich.',
  ckVsUp: 'Besser als beim letzten Check ({prev} % am {date}).',
  ckVsDown: 'Etwas weniger als beim letzten Check ({prev} % am {date}).',
  ckVsSame: 'Genauso wie beim letzten Check ({prev} % am {date}).',
  ckAreaVocab: 'Wörter',
  ckAreaColloc: 'Wendungen',
  ckAreaGram: 'Grammatik',
  ckFocus: 'Themen für die nächste Woche',
  ckWords: 'Diese Wörter kommen wieder',
  ckTooFew: 'Für ein Ergebnis braucht es mindestens 6 Antworten. Deine Antworten sind trotzdem gespeichert.',
  ckSaveFailed: 'Das Ergebnis konnte nicht gespeichert werden. Deine Antworten sind gespeichert.',
  ckNote: 'Der nächste Check ist ab Montag möglich.',
  ckBack: 'Zu „Fortschritt“',
  ckEmpty: 'Für einen Check fehlen noch geübte Wörter oder Themen.',
  ckLastOnly: 'Letzter Check: {pct} % am {date}',
  ckLast: 'Letzter Check: {pct} % am {date} · davor {prev} %',
  ckWeekDone: 'Diese Woche erledigt – der nächste Check ist ab Montag möglich.',
  ckMore_one: '{n} ältere Zeile zeigen',
  ckMore_other: '{n} ältere Zeilen zeigen',
  ckTableCaption: 'Bisherige Wochen-Checks',
  ckColResult: 'Ergebnis',

  // Letzte Fortschritte der alten App (profile.feed)

  // Wochenstreifen und Niveau-Leiste (M7)
  wkTitle: 'Diese Woche',
  wkSummary_one: '{n} Tag erledigt',
  wkSummary_other: '{n} Tage erledigt',
  wkRestN: '1 Ruhetag',
  wkDone: 'Pflicht erledigt',
  wkRest: 'Ruhetag',
  wkOpen: 'noch offen',
  wkMissed: 'nicht erledigt',
  wkFuture: 'kommt noch',
  lvTitle: 'Niveau',
  lvCaption: 'Claudes Stufe {level} · {conf}',
  // Einstellungen: Farbthema (M21) und beruflicher Kontext (M22)
  setPalette: 'Farbthema',
  palette_sage: 'Salbei',
  palette_ocean: 'Ozean',
  palette_plum: 'Pflaume',
  palette_graphite: 'Graphit',
  ctxTitle: 'Beruflicher Kontext',
  ctxHint: 'Worum geht es in deiner Arbeit? Claude nutzt das für Fachwörter, Beispielsätze und Rollenspiele.',
  ctxPlaceholder: 'z. B. Projektleiter für Cloud-Software im Mittelstand, viele Kundentermine',
  ctxCount: '{n} von {max} Zeichen',
  ctxSave: 'Speichern',
  ctxSaved: 'Beruflicher Kontext gespeichert',

  // Wochenbericht als Preply-Stunde (M18)

  // W5: Nachtragen-Hinweis auf Heute
  lateTodayHint_one: 'In diesem Browser liegt noch {n} Änderung aus der alten App.',
  lateTodayHint_other: 'In diesem Browser liegen noch {n} Änderungen aus der alten App.',
  lateTodayOpen: 'Ansehen',

  // M13: Ladepunkt am Reiter
  // M20: Was ist neu
  // UX-Beratung Nr. 6, 10, 11: Stand, Wortschatz, Einstellungen
  ckTableToggle: 'Bisherige Checks ({n})',
  vtestTitle: 'Wortschatztest',
  vtestNever: 'Noch nicht gemessen.',
  histTraceTitle: 'Einschätzungen und Meilensteine',
  setGroupLearn: 'Lernen',
  diagVersion: 'Version {v}',
  vcSortToggle: 'Sortierung wechseln, jetzt: {sort}',
} as const;
