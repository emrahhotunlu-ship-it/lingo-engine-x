# RemNote – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: normal

Kurzurteil: RemNote verbindet Notizen und Karteikarten. Für Wörter interessant sind zwei Ideen. Erstens trennt es „Concept“-Karten (der Begriff selbst, standardmäßig in beide Richtungen) von „Descriptor“-Karten (eine Eigenschaft des Begriffs). Zweitens zeigt es beim Abfragen die übergeordneten Notizen als Kontext. Bei der Planung gibt es drei Algorithmen (Exponential, Anki SM-2 als Standard, FSRS v6 als Beta), wählbar je Dokument. Dazu kommt eine Tipp-Prüfung und ein „Skip“-Knopf, der nichts bewertet. Schwach: Selbstbewertung, keine Geschwister-Sperre, wenig für Sprachlerner. Für Emrah übertragbar sind das Modell „Wort = Begriff mit mehreren abfragbaren Eigenschaften“ und der „Skip“-Gedanke für verunglückte Abfragen.

Vorarbeit: mara-lernmethodik 2.15 (Concept/Descriptor, FSRS Beta, Optimieren ab ca. 1.000 Wiederholungen). Hier mit Belegen aus dem Hilfe-Center vertieft.

## 1. Planung
- **Drei Algorithmen** [G, [rn-sched]]:
  - **Exponential:** einfacher eigener Algorithmus aus frühen Versionen, feste, exponentiell wachsende Schritte. Nicht einstellbar, „nicht mehr empfohlen“.
  - **Anki SM-2:** Intervall und Leichtigkeit, viele Parameter. **Standard** für den „Global Default Scheduler“ [G, [rn-fsrs]].
  - **FSRS v6:** „Beta“, muss man selbst einschalten; „nicht für kritische Karten“, bis es besser geprüft ist [G, [rn-fsrs]].
- **Planer je Dokument:** Man kann eigene Planer anlegen und Dokumenten oder Ordnern zuweisen. RemNote sucht vom Notizpunkt der Karte nach oben, bis es einen Planer findet; sonst gilt der globale [G, [rn-sched]]. Das Hilfe-Bild zeigt einen Planer „Language learning“ mit FSRS v6 [G, [rn-sched]].
- **FSRS-Einstellungen** [G, [rn-fsrs]]:
  - Ziel-Behaltensquote ist die wichtigste Stellgröße.
  - Lernschritte, z. B. „1m,10m“. Leer lässt FSRS sofort planen, „meist ab mehreren Tagen“.
  - Neulern-Schritte für vergessene Karten.
  - „New Card Forgot Interval“: Minuten bis zur Wiederholung einer neuen, vergessenen Karte.
  - Optimierer per Knopf „Auto train weights“. **Mindestens 1.000 Wiederholungen** vorher, sonst warnt RemNote.
  - Die Hilfe spricht von „17 Parametern“ im Feld „Weights“, obwohl FSRS v6 21 hat [G, [rn-fsrs]]. Vermutlich ist der Text veraltet [Vermutung].
  - Laut RemNote „20–30 % weniger Wiederholungen“ für dieselbe Behaltensquote [G, [rn-fsrs]], laut Anbieter, übernommen von FSRS (dort ein Simulationswert).
- **Fälligkeit:** Eine Karte ist fällig, wenn RemNote eine Vergessens-Chance von 10 % schätzt [G, [rn-start]].
- **Geschwister:** Eine Sperre wie bei Anki gibt es nicht. Ein Nutzer wünschte sie im Forum; vorwärts, rückwärts und mehrere Lücken einer Notiz kämen am selben Tag. „Clustering“ verteile Richtungen nur zeitlich [S, [rn-bury]].
- **Fuzz, Lastausgleich:** nicht belegt gefunden.
- **Tageslimit, Rückstand:** Ein tägliches Lernziel und Prioritäten je Dokument (z. B. Prüfung bald, wichtig, „wenn Zeit ist“) steuern die globale Warteschlange [G, [rn-start]]. Genaue Regeln nicht belegt.
- **Leeches:** nicht belegt gefunden.

## 2. Abfrage-Leiter
- **Kartenarten** [G, [rn-cards]]:
  - Basic `>>` (vorwärts), `<<` (rückwärts), `<>` (beide).
  - **Concept** `::`, fett, **standardmäßig in beide Richtungen**.
  - **Descriptor** `;;`, kursiv, Eigenschaft des übergeordneten Concepts, standardmäßig nur vorwärts.
  - Cloze (Lücke) mit `{{ }}`; mehrere Lücken einzeln oder zusammen.
  - Multiple Choice (`A)` nach einer Basic-Karte), Bild-Verdeckung, Tabellen-Karten.
  - KI-Erzeugung aus eingefügtem Text.
- **Beispiel für Wörter** [Vermutung, nach dem Muster der Hilfe]: Concept „leverage :: Hebelwirkung nutzen“ (beide Richtungen), darunter Descriptors „collocation ;; leverage a position“, „register ;; formal/business“.
- **Leiter:** keine automatische. Multiple Choice, Basic und Tippen sind wählbare Kartenarten nebeneinander [G, [rn-cards]].
- **„Type In Answer“** lässt sich je Karte einschalten [G, [rn-cards]], [G, [rn-start]].

## 3. Bewertung
- **Selbst, vier Stufen plus Skip** [G, [rn-start]]:
  - **Forgot:** nicht gewusst oder unzufrieden; zurück in wenigen Minuten.
  - **Partially recalled:** erinnert, aber sehr schwer, ein Detail fehlte oder unsicher; vorsichtigere Planung.
  - **Recalled with effort:** erinnert, kurz nachgedacht; „Schwierigkeit genau richtig“.
  - **Easily recalled:** sofort; großzügigere Planung.
  - **Skip:** Frage falsch gelesen oder zu früh umgedreht. **Keine Note wird gespeichert**, die Karte kommt nach einer Stunde wieder.
- **Tippen:** Man kann die Antwort auf der Vorderseite tippen und „Check Answer“ drücken; RemNote vergleicht [G, [rn-start]]. Wie es vergleicht (Diff, Toleranz), ist nicht belegt [nicht belegt gefunden].
- **Zeit, Hinweise:** keine Rolle belegt.

## 4. Rückmeldung
- **Rückseite** plus die übergeordneten Notizpunkte (s. Kontext) [G, [rn-cards]].
- **Knöpfe zeigen den nächsten Termin**, z. B. Forgot „1 minute“ bis Easily recalled „2.4 months“ [G, [rn-start] Bildbeschreibung].
- Audio, Kollokationen, Erklärung: nicht eingebaut belegt. Im Forum rät ein Nutzer Sprachlernern zu Anki wegen Audio- und Wörterbuch-Add-ons; RemNote antwortet, man wolle die Lücke schließen [S, [rn-lang]].

## 5. Kontext
- **Vorfahren als Kontext:** Beim Abfragen zeigt RemNote alle übergeordneten Notizpunkte, damit man den Zusammenhang nicht in jede Frage schreiben muss. Bei Basic-Karten erscheint dabei auch die Rückseite des Elternpunkts; Concepts zeigen ihre Rückseite dort nicht, damit sie die Antwort nicht verraten [G, [rn-cards]].
- **Zustand je Karte und Richtung** (Concept vorwärts/rückwärts, jeder Descriptor eigens) [Vermutung, aus Kartenmodell; ausdrücklich nicht belegt].
- **Feste Sätze;** wechselnde Sätze nicht belegt.

## 6. Aktive Nutzung
- Nicht eingebaut. Notizen schreiben ist der „aktive“ Teil; geprüft wird nichts [nicht belegt gefunden].

## 7. Fortschritt und Transparenz
- **Flashcard Home:** Zahl fälliger Karten, Knopf „Practice N Cards“, Serie („day streak“) [G, [rn-start] Bilder].
- **Fortschrittsleiste in der Warteschlange** mit Markierungen für Serienziel und „Stretch goals“ [G, [rn-start] Bildbeschreibung].
- **Vorschau** der Intervalle für Beispiel-Antwortfolgen in den Planer-Einstellungen [G, [rn-fsrs] Bildbeschreibung].
- **Diagramm „upcoming cards“** im Änderungsprotokoll [G, [rn-feat]].
- Behaltensrate, aktiv/passiv: nicht belegt.

## 8. Bildschirmablauf
Nach Hilfe-Bildern [G, [rn-start]]:
1. **Flashcard Home** oder Dokument öffnen, Knopf „Practice“ bzw. Zähler „6 Due“.
2. **Vorderseite** mit Knopf „Show Answer“. Bild: <https://downloads.intercomcdn.com/i/o/akxf7g7x/2561068303/267206b2ca6cd8a0d9a6b9cadb0d/CleanShot+2026-07-23+at+14_43_28%402x.png>.
3. Optional **Antwort tippen**, „Check Answer“. Bild: <https://downloads.intercomcdn.com/i/o/akxf7g7x/2561068538/f15383cf5512ea626454156efe44/CleanShot+2026-07-23+at+14_42_43%402x.png>.
4. **Rückseite** mit vier Knöpfen samt Terminen. Bild: <https://downloads.intercomcdn.com/i/o/akxf7g7x/2561069181/99c62601737aed2248c8301194b7/CleanShot+2026-07-23+at+14_44_10%402x.png>.
5. Bei Bedarf **Skip**.
6. Nächste Karte; die Leiste oben zeigt den Tagesfortschritt.

## 9. Nutzerstimmen
**Lob**
- Rezensenten loben vor allem Notizen und Karten in einem Ablauf; die Notizen würden „sofort zu Karteikarten“ [S, [rn-reviews]].
- Ein Rezensent: Die Wiederholung zeige Notizen „im idealen Moment“ [S, [rn-reviews]].
- Ein Testbericht nennt RemNote nach Startproblemen „eines der besten KI-Lernwerkzeuge“ [S, [rn-tldv]].

**Klage**
- Für Sprachen eher Anki, wegen Audio- und Wörterbuch-Add-ons [S, [rn-lang]].
- Ein Testbericht: Eine russische Vokabel-PDF wurde als Koreanisch erkannt, es entstanden nur wenige Karten [S, [rn-tldv]].
- Die App wurde bei einem großen importierten Deck sehr langsam, Löschen eines Eintrags dauerte etwa 20 Sekunden [S, [rn-reviews]].
- Product-Hunt-Rezensenten finden die Oberfläche überladen und schwer zu lernen [S, [rn-ph]].

## 10. Belege für die Wirkung
- „Karteikarten mit Wiederholung schlagen fast jede andere Lerntechnik“: allgemeine Aussage im Hilfe-Center, ohne Studie [G, [rn-start]], laut Anbieter.
- „20–30 % weniger Wiederholungen“ mit FSRS: übernommene Simulationszahl [G, [rn-fsrs]], siehe anki.md.
- Eine Studie zu RemNote fand ich nicht [nicht belegt gefunden].

## 11. Übertragbar auf Lingo-Engine X
- **Wort als Concept mit Descriptors anpassen:** Bedeutung, Schreibweise, Kollokation, Register und Aussprache als einzelne Eigenschaften mit eigenem Zustand. Grund: So sieht Emrah ehrlich, *was* er an einem Wort kann (mara: „ein Wort ist ein Begriff mit mehreren Eigenschaften“).
- **„Skip“ übernehmen** als „Abfrage war unfair“ (z. B. Satz mehrdeutig) ohne Wirkung auf den Plan, mit Meldung an die Inhaltsprüfung. Grund: Ein kaputter Satz soll das Wort nicht bestrafen.
- **Kontext anzeigen, ohne die Antwort zu verraten:** RemNotes Regel, beim Concept die Rückseite des Elternteils nicht zu zeigen. Grund: Kontext hilft, darf aber nicht zur Antwort-Krücke werden.
- **Geschwister-Sperre trotzdem bauen.** Grund: RemNote-Nutzer vermissen sie; Anki zeigt, wie es geht.
- **Mindestmenge vor dem Optimieren übernehmen** (ca. 1.000 Abfragen). Grund: Davor sind die Standardwerte besser (RemNote, Anki).

## Quellen
- [rn-sched] → https://help.remnote.com/en/articles/6958056-custom-schedulers · abgerufen 30.10.2026
- [rn-fsrs] → https://help.remnote.com/en/articles/9124137-the-fsrs-spaced-repetition-algorithm · abgerufen 30.10.2026
- [rn-cards] → https://help.remnote.com/en/articles/6025481-creating-flashcards · abgerufen 30.10.2026
- [rn-basics] → https://help.remnote.com/en/articles/8663109-flashcard-basics · abgerufen 30.10.2026
- [rn-start] → https://help.remnote.com/en/articles/6022755-getting-started-with-spaced-repetition · abgerufen 30.10.2026
- [rn-feat] → https://www.remnote.com/feature/fsrs · abgerufen 30.10.2026
- [rn-bury] → https://forum.remnote.io/t/bury-automatically-other-cloze-cards-on-the-same-rem/519 · nur Suche
- [rn-lang] → https://forum.remnote.io/t/how-to-use-remnote-to-new-language/2642 · nur Suche
- [rn-tldv] → https://tldv.io/de/blog/remnote/ · nur Suche
- [rn-reviews] → https://www.techjockey.com/ae/reviews/remnote · nur Suche
- [rn-ph] → https://www.producthunt.com/products/remnote/reviews · nur Suche
