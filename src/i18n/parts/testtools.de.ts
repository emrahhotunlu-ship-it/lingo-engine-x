// Texte der Testwerkzeuge (nur im Test-Build für den Test-Link, siehe src/app/testBuild.ts).
// Absichtlich NICHT in src/i18n/de.ts eingetragen: Sonst stünden diese Texte auch in der Fassung
// für die Produktivadresse. Gelesen werden sie nur in src/screens/TestTools.tsx.

export const testToolsDe = {
  ttTitle: 'Testwerkzeuge',
  ttNote: 'Nur in dieser Test-Fassung. Zum schnellen Ausprobieren, ohne die lange Einstufung. Alle Daten sind erfunden.',
  ttProfile: 'Test-Profil setzen (Niveau B2, ohne Einstufung)',
  ttProfileDesc: 'Setzt Niveau B2, einen Wortschatz von 4.200 Wörtern und mehrere schwache Grammatik-Themen. Der Fahrplan beginnt vor 25 Tagen.',
  ttProfileDone: 'Test-Profil gesetzt: Niveau B2',
  ttProgress: 'Beispiel-Fortschritt (4 Wochen)',
  ttProgressDesc: 'Füllt Serie, Kurve, Prognose und Fahrplan: 28 Tage Training, rund 150 Karten (30 davon jetzt fällig), Grammatik, bewerteter Input, ein Wochen-Brief und ein Monats-Check. Setzt bei Bedarf zuerst das Test-Profil.',
  ttProgressDone: 'Beispiel-Fortschritt gesetzt: {cards} Karten, {days} Trainingstage',
  ttInput: 'Beispiel-Input für heute',
  ttInputDesc: 'Legt zwei Beispiel-Beiträge für heute an: ein Video und einen Artikel, mit Schlüsselwörtern und Tipp.',
  ttInputDone: 'Zwei Beispiel-Beiträge für heute angelegt',
  ttReset: 'Heute zurücksetzen',
  ttResetDesc: 'Setzt die Teile von heute (Wörter, Grammatik, Input) und die Zähler zurück, damit du die Einheit noch einmal durchspielen kannst.',
  ttResetDone: 'Heute zurückgesetzt: Die Einheit ist wieder startbar',
  ttDue: '25 Karten jetzt fällig machen',
  ttDueDesc: 'Macht die nächsten 25 Karten sofort fällig, damit es Wiederholungen gibt.',
  ttDueDone: '{n} Karten sind jetzt fällig',
  ttDueNone: 'Es gibt noch keine Karten zum Fälligmachen. Setze zuerst den Beispiel-Fortschritt.',
  ttSkip: 'Test: Einstufung überspringen (B2)',
  ttSkipDone: 'Test-Profil gesetzt, weiter mit Heute',
  ttFailed: 'Das hat nicht geklappt. Die Einzelheiten stehen im Fehlerprotokoll.',
} as const;
