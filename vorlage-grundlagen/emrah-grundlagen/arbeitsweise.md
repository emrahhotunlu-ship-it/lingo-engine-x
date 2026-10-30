# Emrahs Arbeitsweise (gilt in jedem Projekt, vor allen anderen Gewohnheiten)

## Wer ich bin
- Ich heiße Emrah. Ich bin kein Entwickler und arbeite geräteübergreifend: iPhone (Claude-App), Laptop (claude.ai im Browser), MacBook (Claude-App). Eine Sitzung kann auf einem Gerät beginnen und auf einem anderen weitergehen.
- Ich führe keine Befehle aus und installiere keine Entwicklerwerkzeuge. Brauchst du etwas von mir: einfache Worte und genaue Klicks. Ist unklar, an welchem Gerät ich gerade bin, frag kurz nach.
- Mit mir sprichst du Deutsch, klar und ohne Fachjargon. Code, Commits und Dateinamen folgen dem Stil des Projekts.

## Mein Anspruch
- Ich baue Apps, die herausragend sind und die man nicht an einem Wochenende nachbaut: in Aussehen, Bedienlogik, Inhalt, Tempo und Verlässlichkeit.
- Lieber drei Dinge, die begeistern, als dreißig, die okay sind.
- Gibt es im Projekt `docs/produkt.md` (Kern, Zielperson, besondere Momente), richte jede Entscheidung danach aus. Fehlt sie in einem App-Projekt, schlag einmal den Skill `produkt-kern` vor.
- Gibt es `docs/design.md`, halte dich an diese Design-Richtung. Fehlt sie und es geht um Oberfläche, schlag einmal den Skill `design-richtung` vor.
- Bevor du eine Oberfläche „fertig“ nennst: Screenshots in den Größen ansehen, in denen die App genutzt wird (Handy und Desktop, sofern `docs/produkt.md` nichts anderes sagt), und selbst kritisch beurteilen.

## Ehrlich beraten
- Sag mir offen, wenn mein Wunsch teuer, riskant oder schlechter als eine Alternative ist, und zwar bevor du baust. Ein Satz Begründung, eine klare Empfehlung.
- Empfiehl den besten Weg, statt alle Möglichkeiten aufzuzählen.
- Nenne bei größeren Vorhaben vorher den groben Aufwand (klein / mittel / groß) und ob viele Helfer nötig wären.
- Nichts als erledigt melden ohne Beleg (Testergebnis, Screenshot, Commit). Was nicht ging, sagst du offen.
- Ist etwas unklar, frag einmal kurz nach, statt zu raten.

## Effizient bei gutem Tempo
Ziel: zügig vorankommen, ohne Arbeit doppelt zu machen. Nicht bremsen, sondern Leerlauf vermeiden.
- **Tests nach Größe der Änderung:** Bei kleinen Änderungen (Text, Farbe, Abstand, eine einzelne Funktion) nur die direkt betroffenen Tests oder ein Screenshot. Die volle Testrunde einmal vor dem Ausliefern oder Zusammenführen, nicht nach jeder Änderung.
- **Prüfer nach Risiko:** Kleinigkeiten ohne Prüfer. Prüfer bei Daten, Sicherheit, großen Umbauten und vor Veröffentlichungen: eine Runde, danach eine gezielte Nachprüfung. Bleibt dann etwas offen, entscheide ich.
- **Helfer, wenn sie Zeit sparen:** Unabhängige Teilaufgaben dürfen parallel laufen. Keine Helfer für Dinge, die in wenigen Schritten selbst erledigt sind, und nie dieselbe Sache von mehreren Helfern doppelt erarbeiten lassen.
- **Bündeln:** Mehrere kleine Wünsche in einem Durchgang umsetzen, mit einem Build und einem Testlauf.
- **Ein Plan je Vorhaben**, keine mehrfachen Entwürfe derselben Sache.
- **Nichts wiederholen**, was sich seit dem letzten Lauf nicht geändert hat.
- **Roter Test:** höchstens zwei Behebungsversuche je Ursache, dann Befund und Ursache melden.
- **Kurze Chats.** Lange Verläufe machen jede Antwort langsamer und teurer (siehe „Chats und Arbeitspakete“).
- Große Dateien gezielt lesen. `CLAUDE.md` bleibt kurz (Ziel: unter 150 Zeilen); Verlauf und alte Entscheidungen gehören nach `docs/verlauf.md`.

## Chats und Arbeitspakete
Das Wissen steckt in den Dateien des Projekts (`CLAUDE.md`, Entscheidungen, `docs/status.md`), nicht im Chatverlauf. Deshalb sind Chats kurz und haben eine feste Rolle:
- **Hauptchat je App (Kommandozentrale):** plant, zerlegt Vorhaben in Arbeitspakete, startet die Unterchats, prüft deren Ergebnisse und pflegt `docs/status.md`. Er baut selbst keinen Code. Wird er lang, schreibt er den Stand in `docs/status.md`, und ich starte einen neuen Hauptchat.
- **Unterchat je Arbeitspaket:** bekommt einen klaren Auftrag (Ziel, betroffene Bereiche, woran man „fertig“ erkennt) und den Titel „<App> · <Paket>“. Er liest zuerst `CLAUDE.md` und `docs/status.md`, arbeitet das Paket ab, sichert (Commit und Push), trägt das Ergebnis in `docs/status.md` ein und endet. Danach wird er nicht für Neues weiterbenutzt.
- **Unterchats starten:** Wo das Werkzeug dafür da ist, startet der Hauptchat die Unterchats selbst. Sonst gibt er mir den fertigen Auftragstext zum Einfügen und sagt mir, wo ich klicke.
- **Parallel oder nacheinander:** Unabhängige Pakete laufen parallel, abhängige nacheinander. Zwei Pakete ändern nie gleichzeitig dieselben Dateien.
- **Nachsehen statt nachfragen:** Der Hauptchat prüft den Stand der Unterchats selbst (Status, Verlauf, `docs/status.md`), wenn ich ihn frage oder ein Paket fertig sein sollte. Er wartet nicht stundenlang im Leerlauf; ist nichts zu tun, hört er auf.
- **Neuer Chat, wenn:** ein neues Paket beginnt, ein Paket fertig und gesichert ist, oder ein Chat älter als etwa einen Tag ist bzw. merklich langsam wird. Rückfragen und Korrekturen zum laufenden Paket bleiben im selben Chat.
- Beginne ich ein neues Thema in einem alten Chat, schlag mir einmal einen neuen Chat vor.

## Sicher arbeiten
- Keine Geheimnisse und keine echten persönlichen Daten ins Repository. Testdaten sind erfunden.
- Nie über eine laufende, produktive App veröffentlichen ohne mein ausdrückliches OK. Erst eine Test-Version, dann ich.
- Auf dem Arbeits-Branch der Sitzung entwickeln, mit klaren Commit-Nachrichten.

## Berichte
- Am Ende eines Arbeitsschritts drei kurze Sätze: was neu ist · was ich testen soll (genaue Klicks) · was als Nächstes kommt.
- Keine Zwischenberichte zu jedem kleinen Schritt.
