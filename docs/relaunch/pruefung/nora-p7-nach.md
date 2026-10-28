# Nora – Nachprüfung P7 S1-DIKTAT (Gate G2, Runde 2)

Stand: `claude/umbau-s1-diktat` @ 458cb3f, Basis e0ba6c0. Geprüft wurden nur die Punkte aus `nora-p7.md`, also Muss 1–2 und Soll 3–8.

Grundlage:
- der Diff `e0ba6c0..458cb3f -- src`;
- die Bilder p7-r2-01 bis -08;
- eigene Aufnahmen nach einem frischen Build von 458cb3f. Sie liegen unter `scratchpad/p7-shots/nora-r2/`:
  - 390 dunkel DE, 390 hell EN, 390 gedämpft DE,
  - 1440 gedämpft EN, 1440 hell DE,
  - 2560 dunkel DE.

`tests/e2e/diktat.spec.ts` läuft mit 8 von 8 Tests grün. `layoutProblems` meldet in allen sechs eigenen Aufnahmen nichts, und es gibt keine Konsolenfehler. Der `dist/` im Worktree ist danach wieder auf den eingecheckten Stand zurückgesetzt.

**Veto: nein.** Die Freigabe für Optik und Bedienung gilt.

## Muss

1. **Eine Diktat-Aussage am Laptop: erledigt.**
   - Am Laptop lautet die Aufgabe nur „Sag den Satz auf Englisch.“ bzw. „Say the sentence in English.“, ohne Mikrofon.
   - `say-it-tip` fehlt am Laptop. `DictationHint` ist keine eigene Zeile mehr, sondern nur noch der Hook `useDictationDesk`.
   - Geprüft bei 1024, 1440 und 2560 in dunkel, hell und gedämpft, in DE und EN.
   - Unter 1024 px bleibt alles wie am Handy. Das sichert ein Test ab.

2. **Hinweis in der Tastenzeile, Textknopf statt Pille: erledigt.**
   - Die Tastenzeile zeigt „Enter prüft · Laut sprechen: am Handy“, nach erfolgreicher Probe „Enter prüft · Diktat: 2× Globus-Taste“. Am Windows-Rechner steht dort nur „Win + H“.
   - Es gibt kein Türkis und keine Zeile über dem Feld mehr.
   - Die Knopfzeile lautet: Ghost „Später am Handy sprechen“ · „Weiß ich nicht“ · „Prüfen“. Der Ghost-Knopf ist nie stärker als „Prüfen“.
   - Es gibt genau 2 Nebenknöpfe (`slice(0, 2)` in der Hülle). Der Tipp-Knopf entfällt, die Taste T wirkt weiter über `secRef`, der die volle Liste kennt.
   - Die Reihenfolge stimmt auch nach der Umsortierung: Der Test prüft `phone` vor `dontKnow`, und meine eigenen Aufnahmen zeigen dasselbe.
   - Alle Touch-Ziele sind mindestens 44 px hoch.
   - In der freiwilligen Runde (`extra`) gibt es keinen Handy-Knopf, das ist richtig so.

## Soll

3. **Nur das eigene Betriebssystem: erledigt.** Die Probe nennt beim Mac nur die Mac-Tasten (r2-06). Beide Systeme stehen nur da, wenn kein Betriebssystem erkannt wurde (`dkKeysAny`).
4. **Diagnose-Zeile: erledigt.**
   - Zugeklappt: „Diktat am Laptop · nicht geprüft · Prüfen ›“ im Stil der Diagnose-Zeilen (r2-05).
   - Am Ende des Kastens steht der Ghost-Knopf „Schließen“, nach Erfolg „Fertig“ (r2-06/07).
   - Danach geht der Fokus zurück auf „Prüfen“.
   - Der Stand nennt nur das eigene Betriebssystem.
5. **„So geht's“ in einer Zeile: erledigt.** Nach dem Ergebnis bleiben nur der Satz und das Ergebnis stehen (r2-07/08).
6. **Prozentwert nur bei `mismatch`: erledigt.** Bei r2-08 (Grund „Tastendrücke“) steht kein Prozentwert.
7. **`dkNoMore`: erledigt.** Der Text lautet wie vorgeschlagen.
8. **Knopftext: erledigt.** „Später am Handy sprechen“ bzw. „Speak later on your phone“.

## Handy (390)

Hier hat sich nichts verschlechtert:
- Aufgabe mit Mikrofon-Satz und `say-it-tip` sind sichtbar.
- Es gibt keinen Handy-Knopf, nur „Weiß ich nicht“.
- Die Tastenzeile ist unverändert.
- Geprüft in dunkel, hell und gedämpft, in DE und EN.

## Restpunkte

Keiner ist zwingend.

Freiwillig für später, kein Gate:
- Der Ghost-Knopf hat Innenabstand. Dadurch beginnt sein Text rund 40 px rechts der Inhaltskante. Ein linksbündiger Textknopf, also `ghost` ohne linkes Polster, würde die Spalte ruhiger machen.
