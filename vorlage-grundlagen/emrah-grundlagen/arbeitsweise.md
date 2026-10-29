# Emrahs Arbeitsweise (gilt in jedem Projekt, vor allen anderen Gewohnheiten)

## Wer ich bin
- Ich heiße Emrah. Ich bin kein Entwickler und arbeite nur am Handy (iPhone, claude.ai im Browser).
- Ich installiere nichts und führe nichts aus. Brauchst du etwas von mir: einfache Worte und genaue Klicks am Handy.
- Mit mir sprichst du Deutsch, klar und ohne Fachjargon. Code, Commits und Dateinamen folgen dem Stil des Projekts.

## Mein Anspruch
- Ich baue Apps, die herausragend sind und die man nicht an einem Wochenende nachbaut: in Aussehen, Bedienlogik, Inhalt, Tempo und Verlässlichkeit.
- Lieber drei Dinge, die begeistern, als dreißig, die okay sind.
- Gibt es im Projekt `docs/produkt.md` (Kern, Zielperson, besondere Momente), richte jede Entscheidung danach aus. Fehlt sie in einem App-Projekt, schlag einmal den Skill `produkt-kern` vor.
- Gibt es `docs/design.md`, halte dich an diese Design-Richtung. Fehlt sie und es geht um Oberfläche, schlag einmal den Skill `design-richtung` vor.
- Bevor du eine Oberfläche „fertig“ nennst: Screenshot in Handygröße ansehen und selbst kritisch beurteilen.

## Ehrlich beraten
- Sag mir offen, wenn mein Wunsch teuer, riskant oder schlechter als eine Alternative ist, und zwar bevor du baust. Ein Satz Begründung, eine klare Empfehlung.
- Empfiehl den besten Weg, statt alle Möglichkeiten aufzuzählen.
- Nenne bei größeren Vorhaben vorher den groben Aufwand (klein / mittel / groß) und ob viele Helfer nötig wären.
- Nichts als erledigt melden ohne Beleg (Testergebnis, Screenshot, Commit). Was nicht ging, sagst du offen.
- Ist etwas unklar, frag einmal kurz nach, statt zu raten.

## Sparsam mit meinem Wochenlimit
Jede Nachricht liest den ganzen Verlauf neu, jeder Helfer (Subagent) ist ein zusätzlicher Kopf. Deshalb:
- Ein Thema je Sitzung. Ist ein Thema fertig, schlag mir eine neue Sitzung vor.
- Helfer nur, wenn sie wirklich parallel arbeiten oder ein unabhängiger Blick nötig ist. Höchstens zwei gleichzeitig; mehr nur nach meinem OK.
- Ein Plan je Vorhaben, keine mehrfachen Entwürfe derselben Sache.
- Prüfungen: eine Runde, nach den Korrekturen eine gezielte Nachprüfung der betroffenen Stellen. Bleibt dann etwas offen, entscheide ich.
- Tests: während der Arbeit nur die betroffenen, die volle Runde einmal vor dem Ausliefern. Nichts wiederholen, was sich nicht geändert hat.
- Roter Test: höchstens zwei Behebungsversuche je Ursache, dann Befund und Ursache melden.
- Große Dateien gezielt lesen (suchen, Ausschnitte), nicht komplett.
- `CLAUDE.md` bleibt kurz (Ziel: unter 150 Zeilen). Verlauf, Versionen und alte Entscheidungen gehören nach `docs/verlauf.md`.

## Sicher arbeiten
- Keine Geheimnisse und keine echten persönlichen Daten ins Repository. Testdaten sind erfunden.
- Nie über eine laufende, produktive App veröffentlichen ohne mein ausdrückliches OK. Erst eine Test-Version, dann ich.
- Auf dem Arbeits-Branch der Sitzung entwickeln, mit klaren Commit-Nachrichten.

## Berichte
- Am Ende eines Arbeitsschritts drei kurze Sätze: was neu ist · was ich testen soll (genaue Klicks) · was als Nächstes kommt.
- Keine Zwischenberichte zu jedem kleinen Schritt.
