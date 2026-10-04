# Plan „Anwenden“ Stufe 2 (04.10.2026)

Quellen: Berichte von Englischlehrer und Lernwissenschaft (je ein Durchgang, beide haben die Übungs-Interna nicht geöffnet). Stufe 1 (Reiter, Diktat, Hörschleife, Lücke, Satzbau, Rollenspiel) ist gebaut. Nichts von Stufe 2 ist gebaut; Bau erst nach Emrahs „Go“.

## Gemeinsame Regeln (Lernwissenschaft)
1. Freiwillig: Kontext `xtra`, keine Pflichtpunkte, kein Pflichtzähler, keine Serie, keine Zahl am Reiter, kein Fälligkeits-Pfad. Der Reiter sagt in einer Zeile: freiwillig, fließt nicht in die Note ein.
2. Keine Hör-Note, keine Hör-Stufe, keine Hör-Zahl in Fortschritt oder Einschätzung (es gibt keine echte Hörmessung).
3. FSRS nur, wo eine Karte selbst frei getippt abgefragt wird (Gewicht aus `weight.ts`); sonst höchstens Schwach-Markierung. Grammatik-BKT nur gedämpft und gedeckelt, nur bei freier Produktion, nur bei eindeutiger Zuordnung. Ein Fehler bucht nie beide Konten.
4. Kein Schaden bei Fehlern: kein „Nochmal“-Termin, kein Rückstand. Bei hohem Rückstand (ab 40) ruhiger Hinweis „Erst Wiederholen“ statt Sperre.
5. Claude-Inhalte: formal prüfen vor Anzeige, Kennzeichnung „von Claude, kann Fehler enthalten“ mit Einspruch; ohne KI verschwindet der Knopf. Richtige Antwort immer mischen. Eingabe ≤ 64 KiB (höchstens ~8 Wörter je Anfrage). US-Englisch.

## Reihenfolge und Inhalt
1. **Fehler korrigieren** (klein bis mittel, zuerst): Satz mit Fehler, Fehlerstelle antippen, nur diese Stelle neu schreiben (ab 9 Wörtern vorbefüllt). Quelle: `app/repair` (Boxen 1/3/9, `recordRepair`), eigene Fehlersätze, dann fester Pool. Keine eigene Zählung; Sätze von heute erst morgen; zeigt „heute schon erledigt“, wenn die Pflicht fertig ist. „Fast richtig“ zählt nicht als richtig. Kein Claude.
2. **Wort + Regel im selben Satz** (mittel): Teil A Lücke in der Regelform ohne Claude (Ursprungssatz der Karte); Teil B eigener Satz, Claude prüft (Wort benutzt? Regel erfüllt?, getrennte Rückmeldung je Ziel, Begründung zu Regel und Wortverbindung). Nur vorhandene Grammatikthemen, keine Mischung zweier Regeln. Teil B zuerst weglassen, wenn die Zeit knapp ist.
3. **Hörübung mit Frage** (mittel): Sprachausgabe liest 3–5 Sätze bzw. Mini-Dialog mit Zielwort, Text verdeckt, zwei Wiederholungen, Frage (lieber Kurzantwort/Lücke als Auswahl), Text und Textstelle erst danach. Kein Misserfolgs-Signal bei Hörfehlern (robotisches iPhone-Audio).

## Vor dem Bauen zu prüfen (nicht gelesen)
- Was schreiben `startDrill`/Kontext `xtra` heute in `weight`, `recordRepair` und BKT? Bestätigen: keine Pflicht-Zähler, keine BKT-Buchung ohne Deckel.
- Liegen Fehler/Korrektur-Paare im festen Pool wirklich vor (`transforms.json`, `app/patterns`)?
- Wiederverwendbar: `orderGen.ts` (Vorrat im Hintergrund), `ListenLoop.tsx`, Reparatur-Eingabe.
