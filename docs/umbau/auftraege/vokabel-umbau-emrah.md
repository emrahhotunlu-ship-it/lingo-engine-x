# Auftrag: Umbau des Vokabel-Bereichs in lingo-engine-x

Du arbeitest an meiner Englisch-Lern-App **lingo-engine-x**. Der Vokabel-Bereich funktioniert noch nicht gut. Ziel: Ich will **schnell und nachhaltig einen C1-Wortschatz aufbauen** – und die Wörter nicht nur wiedererkennen, sondern **aktiv benutzen** können. Baue den Bereich auf Basis des aktuellen Forschungsstands und der besten Muster der Marktführer (Anki, Quizlet, Clozemaster, Lingvist) um.

Arbeite in **Plan Mode**, bis Phase 0 abgeschlossen und der Plan von mir bestätigt ist. Lies vorher `CLAUDE.md` sowie – falls vorhanden – `docs/produkt.md`, `docs/design.md` und `docs/verlauf.md`. Halte Entscheidungen und Fortschritt in `docs/verlauf.md` fest.

---

## 1. Was heute nicht funktioniert (meine Beobachtung)

1. **Wiederholungen sind willkürlich.** Dieselben Wörter kommen teils mehrfach am selben Tag dran und verschwinden dann für Tage oder Wochen. Es gibt keine gleichmäßige, nachvollziehbare Verteilung.
2. **Ich lerne fast nur passiv.** Vokabeln kommen fast immer in Sätzen zum Einfügen, meist mit Auswahl. Aktives Abrufen (selbst tippen, aus der deutschen Bedeutung heraus produzieren, eigene Sätze bilden) wird kaum verlangt.
3. **Es gibt keinen Weg zur aktiven Nutzung.** Ein Wort hat keine erkennbare Entwicklung von „kenne ich vom Sehen" zu „benutze ich selbst sicher".

---

## 2. Phase 0 – Diagnose (noch keine Code-Änderungen)

Analysiere den bestehenden Code und liefere mir einen kurzen Diagnose-Bericht:

- Welcher Scheduling-Algorithmus ist implementiert (SM-2? eigener?) und wo genau?
- **Ursache für das Klumpen-Verhalten finden.** Prüfe insbesondere:
  - Werden mehrere Sätze zum selben Wort als **unabhängige Karten** geplant? (Dann kommt dasselbe Wort über verschiedene Sätze mehrfach am Tag – „Geschwister-Karten"-Problem.)
  - Gibt es Lernschritte (Minuten-Intervalle) für neue/vergessene Karten, oder springt alles sofort auf Tage?
  - Gibt es Zufallsstreuung (Fuzz) und Lastausgleich – oder bekommen alle am selben Tag gelernten Wörter identische Intervalle und kommen gemeinsam wieder?
  - Wie wird der Tageswechsel berechnet (UTC vs. Europe/Berlin, Uhrzeit des Tageswechsels)?
  - Wie wird bewertet (Selbsteinschätzung, automatisch, Multiple Choice = „richtig"?) und wie stark wirkt sich das auf die Intervalle aus?
  - Gibt es ein Tageslimit für neue Wörter, und hängt es von der Wiederholungslast ab?
- Welches Datenmodell gibt es (Wort, Satz, Karte, Review-Log)? Liegen Review-Historien vor, die migriert werden können?
- Welche Übungstypen existieren heute und welcher Anteil ist Wiedererkennen vs. aktives Abrufen?

Schreibe ein kleines **Simulations-Skript**, das den heutigen Scheduler über 60 Tage mit einem simulierten Lerner laufen lässt und zeigt: Wiederholungen pro Tag, wie oft ein Wort am selben Tag mehrfach vorkommt, längste Lücken. Das ist die Ausgangsmessung, gegen die der Umbau später getestet wird.

---

## 3. Wissenschaftliche Grundlagen, auf denen der Umbau beruht

Diese Prinzipien sind gesetzt – der Umbau muss sie umsetzen:

1. **FSRS statt SM-2.** FSRS modelliert pro Karte Schwierigkeit, Stabilität und Abrufwahrscheinlichkeit und sagt Vergessen in Benchmarks auf hunderten Millionen Anki-Reviews deutlich genauer voraus als SM-2. SM-2 hat das Problem der „Ease Hell": Ein einmal schweres Wort bleibt dauerhaft in kurzen Intervallen.
2. **Abrufen schlägt Wiedererkennen.** Aktives Abrufen (Testing Effect) ist einer der robustesten Befunde der Lernforschung. Multiple Choice ist leichter, erlaubt Raten/Ausschlussverfahren und überschätzt Wissen. Je anstrengender ein Abruf ist – solange er gelingt –, desto besser die Behaltensleistung (Retrieval Effort Hypothesis).
3. **Rezeptiv ≠ produktiv.** Wer ein Wort erkennt, kann es noch lange nicht selbst benutzen. Produktives Abrufen (Deutsch → Englisch, Wort selbst erzeugen) muss gezielt trainiert werden.
4. **Involvement Load.** Aufgaben mit eigener Satzbildung führen in Studien zu deutlich besserem Behalten als Lückentexte, Lückentexte zu besserem als reines Lesen.
5. **Verteiltes Lernen, auch innerhalb einer Session.** Wiederholungen eines Wortes innerhalb einer Sitzung sollen durch andere Karten getrennt sein (nicht dreimal hintereinander).
6. **Kontextvariation.** Ein Wort in wechselnden Sätzen zu sehen stärkt Bedeutung und Gebrauch – aber der **Gedächtniszustand gehört zum Wort, nicht zum Satz**.
7. **C1 heißt Tiefe, nicht nur Breite.** Für C1 braucht man grob 6.000–8.000 Wortfamilien. Ab C1 werden vor allem **Kollokationen und feste Wendungen** entscheidend – genau hier haben auch fortgeschrittene (gerade deutsche) Lerner die meisten Fehler.
8. **Vier Stränge (Paul Nation).** Bewusstes Lernen allein reicht nicht – es braucht auch bedeutungsorientierte Produktion (Schreiben/Sprechen) und Flüssigkeit. Die App soll mindestens den Strang „Output" mit den gelernten Wörtern abdecken.

---

## 4. Ziel-Architektur: neue Lern-Logik

### 4.1 Lerneinheit „Lexem" statt Einzelkarte
- Die Lerneinheit ist ein **Lexem**: ein Wort, Phrasal Verb, eine Kollokation oder ein Chunk (z. B. „to raise concerns", „on short notice", „leverage" + typische Partner).
- Ein Lexem hat **mehrere Beispielsätze** (Kontexte). Bei jeder Wiederholung wird ein anderer Satz gewählt (rotierend, bevorzugt einer, der länger nicht gezeigt wurde).
- Pro Lexem gibt es **zwei Gedächtnisspuren mit eigenem FSRS-Zustand**:
  - **Verstehen** (rezeptiv): Englisch → Bedeutung erkennen/abrufen.
  - **Benutzen** (produktiv): Bedeutung/Kontext → englisches Wort selbst erzeugen.
- Die Spur „Benutzen" wird freigeschaltet, sobald „Verstehen" eine Stabilität von ca. 3 Tagen erreicht hat (Wert konfigurierbar).

### 4.2 Scheduler (FSRS)
- FSRS über die Bibliothek **`ts-fsrs`** (open-spaced-repetition) einbinden, aktuelle Version. Gewünschte Behaltensrate standardmäßig **90 %**, in den Einstellungen änderbar (85–95 %).
- **Lernschritte** für neue und vergessene Lexeme innerhalb des Tages (z. B. 1 min → 10 min), danach übernimmt FSRS mit Tagesintervallen.
- **Geschwister-Regel:** Ein Lexem erscheint außerhalb der Lernschritte **höchstens einmal pro Tag**, egal wie viele Sätze oder Spuren es hat. Sind beide Spuren fällig, wird nur eine abgefragt (die produktive, wenn freigeschaltet) und die andere um einen Tag verschoben.
- **Fuzz + Lastausgleich:** Intervalle ab ca. 3 Tagen werden innerhalb eines kleinen Korridors gestreut und auf den Tag mit der geringsten erwarteten Last gelegt. So kommen Wörter vom selben Lerntag nicht im Block zurück.
- **Dynamisches Neu-Wort-Limit:** Neue Lexeme werden nur eingeführt, solange die erwartete Gesamtlast des Tages unter einem Zielwert liegt (z. B. Zielzeit 15–20 min/Tag). Kein starres „20 neue pro Tag".
- **Tageswechsel** in Europe/Berlin um 04:00 Uhr.
- **Rückstand:** Nach Pausen werden überfällige Lexeme nach Abrufwahrscheinlichkeit priorisiert (am stärksten gefährdete zuerst) und auf mehrere Tage verteilt, statt eine Wand von Karten zu zeigen.
- **Leech-Erkennung:** Lexeme mit z. B. 6 Fehlversuchen werden markiert und mit einer Merkhilfe/neuem Kontext neu eingeführt.

### 4.3 Bewertung automatisch statt Bauchgefühl
- Die FSRS-Bewertung (Again/Hard/Good/Easy) wird **aus dem Ergebnis abgeleitet**: richtig/falsch, Tippfehler-Toleranz (Levenshtein), benutzte Hinweise, Antwortzeit.
  - Falsch oder Lösung angezeigt → Again
  - Richtig mit Hinweis oder sehr langsam → Hard
  - Richtig → Good
  - Richtig und schnell bei hoher Stufe → Easy
- Nutzer kann die Bewertung mit einem Tipp überschreiben („Das wusste ich eigentlich").
- **Multiple-Choice-Antworten zählen nie als volle Wiederholung**, nur als Einführung (sie verändern die Stabilität nicht oder nur minimal).

### 4.4 Stufenleiter: vom Erkennen zum aktiven Benutzen
Jedes Lexem durchläuft sichtbar diese Stufen. Der Übungstyp wird aus Stufe + Spur gewählt – immer die **schwierigste Aufgabe, die voraussichtlich noch gelingt**.

| Stufe | Name | Übungstyp | Spur |
|---|---|---|---|
| 1 | Kennenlernen | Satz mit hervorgehobenem Wort, Bedeutung, Audio, 2–3 Kollokationen; danach sofort 1 leichter Abruf | – |
| 2 | Erkennen | Lückensatz mit Auswahl (nur in den Lernschritten) | Verstehen |
| 3 | Abrufen im Kontext | Lückensatz, Wort **tippen** (optional erster Buchstabe als Hinweis) | Verstehen |
| 4 | Aus der Bedeutung produzieren | Deutscher Satz/Bedeutung → englisches Lexem im englischen Satz tippen | Benutzen |
| 5 | Variieren | Neuer Satz, andere Wortform/Ableitung oder Kollokationspartner ergänzen („___ a decision" → make/take?) | Benutzen |
| 6 | Frei anwenden | **Eigenen Satz** mit dem Lexem schreiben, idealerweise zu meinem Kontext (Business Development, Software, Familie). KI prüft Korrektheit, Natürlichkeit, Kollokation und zeigt eine bessere Variante | Benutzen |
| 7 | Gefestigt | Lexem taucht nur noch selten auf, primär in Transfer-Aufgaben | Benutzen |

- Aufstieg: Erfolg in der aktuellen Stufe + Stabilitätsschwelle der zugehörigen Spur (Schwellen konfigurierbar, sinnvolle Defaults vorschlagen).
- Abstieg: Bei Fehler eine Stufe zurück (nicht auf 1), Lernschritt auslösen.
- **Kollokations-Fehler** (Wort richtig, Partner falsch) werden separat erkannt und erklärt.

### 4.5 Transfer-Block „Anwenden"
- Am Ende jeder Tagessession eine kurze **Schreibaufgabe (2–4 min)**, die 3–5 Lexeme der Stufen 4–6 kombiniert, z. B. „Schreib eine kurze E-Mail an einen Partner, in der du ein Meeting verschiebst – nutze: postpone, on short notice, align on."
- Feedback per Claude API: Fehler, natürlichere Formulierung, welche Zielwörter korrekt verwendet wurden. Korrekt verwendete Lexeme bekommen eine Good-Bewertung auf der Spur „Benutzen".
- Wenn die Claude-API nicht verfügbar ist: Aufgabe trotzdem anbieten, Selbstbewertung mit Musterlösung als Fallback.
- API-Schlüssel nie im Client, Aufruf über den Cloudflare Worker.

### 4.6 Wortauswahl für C1
- Neue Lexeme kommen gewichtet aus: **(a)** Frequenzbändern bis C1 (z. B. Oxford 5000 / NGSL + Academic/Business Word List), **(b)** meinen eigenen gesammelten Wörtern, **(c)** Kollokationen zu bereits gelernten Wörtern.
- Bereits sicher bekannte Wörter überspringen: kurzer **Einstufungstest** (Wortschatz-Schätzung pro Frequenzband) und Button „Kenne ich schon" auf jeder neuen Karte.
- Prüfe, welche Wortlisten lizenzrechtlich frei nutzbar sind, und nutze nur solche.

---

## 5. Session-Ablauf (UX)

Eine Tagessession hat ein klares Ende – keine Endlos-Schleife:

1. **Fällige Wiederholungen** (gemischt, nach Gefährdung sortiert, Geschwister getrennt)
2. **Neue Lexeme** (nur so viele, wie das Lastbudget erlaubt; zwischen Wiederholungen eingestreut, nicht als Block)
3. **Anwenden** (eine Transfer-Aufgabe)
4. **Abschluss-Screen:** heute gelernt, aufgestiegen, gestolpert; Vorschau „morgen ca. X min"

Zielzeit pro Tag einstellbar (10 / 15 / 20 / 30 min). Option „Noch 5 Extra" nur mit fälligen oder neuen Lexemen, nie mit bereits heute gesehenen.

---

## 6. UI-Synthese aus den Marktführern

Übernimm die stärksten Muster, nicht die Optik:

- **Lingvist:** Eine Karte im Fokus, großer Satz, das Eingabefeld sitzt **direkt in der Lücke**, sofortiges Feedback, klarer Tagesfortschritt.
- **Clozemaster:** Sätze als Hauptformat, Wechsel Auswahl → Tippen je nach Stufe, Audio (normal/langsam) für jeden Satz, nach der Antwort Aufklappbereich mit Übersetzung und Erklärung.
- **Quizlet Learn:** Sichtbare Progression von Erkennen zu Abrufen; ein Wort gilt erst als gelernt, wenn es aktiv abgerufen wurde.
- **Anki:** Ehrliche Transparenz – Vorschau der Last der nächsten Tage, nächstes Fälligkeitsdatum pro Wort, Behaltensrate.

**Referenz-Screenshots:** Im Ordner `docs/referenzen/` liegen Screenshots der Apps. Sieh dir **jedes Bild an**, bevor du die UI planst, und beschreib mir in Phase 0 kurz, welche Muster du daraus übernimmst. Ahme dabei nicht die Optik nach, sondern übernimm die Bedienlogik:
- `anki-*.png` → Lastvorschau, Statistik, Fälligkeitsanzeige
- `quizlet-*.png` → Progression Erkennen → Abrufen, Fortschrittsanzeige in der Runde
- `clozemaster-*.png` → Lückensatz-Karte, Wechsel Auswahl/Tippen, Feedback nach der Antwort
- `lingvist-*.png` → Eingabe direkt in der Lücke, Kartenfokus, Tagesziel

Konkrete Elemente:
- **Lernkarte:** Satz groß, Lücke als Eingabefeld, Tastatur sofort offen (mobil), Enter = prüfen, Tippfehler werden markiert (Diff korrekt vs. Eingabe), Audio-Button, Hinweis-Button (erster Buchstabe), nach der Antwort: Bedeutung, 2 Kollokationen, ein weiterer Beispielsatz.
- **Wort-Detailseite:** Stufenleiter als Fortschrittsbalken, beide Spuren mit „nächste Wiederholung am …", Historie, alle Sätze, eigene Sätze aus Stufe 6.
- **Dashboard:** aktiver vs. passiver Wortschatz (Zahl), geschätzte Gesamtgröße vs. C1-Ziel, Last-Vorschau 14 Tage als Balkendiagramm (soll gleichmäßig aussehen), Streak dezent.
- Mobil zuerst (PWA), Dark Mode, Bewegungen kurz und dezent; leere Zustände und Fehlerzustände mitdenken. Wenn `docs/design.md` existiert, gelten dessen Tokens.

---

## 7. Datenmigration

- Bestehende Wörter und Sätze in das Lexem-Modell überführen; mehrere Sätze desselben Wortes zu **einem** Lexem zusammenführen.
- Vorhandene Review-Logs nutzen, um den FSRS-Zustand initial zu berechnen (`ts-fsrs` kann aus Historie neu planen). Ohne Historie: als „neu, Stufe 3" einstufen.
- Review-Logs ab jetzt vollständig speichern (Zeitpunkt, Übungstyp, Spur, Ergebnis, Antwortzeit, Hinweis ja/nein, abgeleitete Bewertung), damit FSRS-Parameter später auf meine Daten optimiert werden können.
- Migration idempotent, mit Backup vorher.

---

## 8. Abnahmekriterien

Der Umbau ist fertig, wenn:

1. Die **Simulation über 60 Tage** zeigt: kein Lexem erscheint außerhalb der Lernschritte mehr als einmal pro Tag; die tägliche Last schwankt deutlich weniger als vorher (Variationskoeffizient vorher/nachher ausweisen); keine fälligen Lexeme bleiben unbegrenzt liegen.
2. Mindestens **50 % der Abfragen** bei Wörtern ab Stufe 3 sind aktives Abrufen (Tippen/Produzieren), Multiple Choice kommt nur in Lernschritten vor.
3. Jedes Lexem zeigt Stufe und nächste Wiederholung für beide Spuren.
4. Die Transfer-Aufgabe funktioniert mit und ohne Claude-API.
5. Unit-Tests für Scheduler, Geschwister-Regel, Lastausgleich, Bewertungsableitung und Stufenwechsel sind grün.
6. Ich habe die neue Lernkarte und das Dashboard auf dem Handy per Screenshot gesehen und abgenickt.

---

## 9. Vorgehen

1. **Phase 0:** Diagnose-Bericht + Ausgangssimulation → mir zeigen.
2. **Plan:** konkrete Umsetzungsschritte, Datenmodell-Änderungen, offene Fragen → von mir bestätigen lassen.
3. **Phase 1:** Datenmodell + Migration + FSRS-Scheduler (inkl. Geschwister-Regel, Fuzz, Lastausgleich, Lastbudget) + Simulation nachher.
4. **Phase 2:** Stufenleiter, neue Übungstypen, automatische Bewertung.
5. **Phase 3:** Neue Lernkarten-UI, Session-Ablauf, Abschluss-Screen.
6. **Phase 4:** Transfer-Block mit Claude-API, Wort-Detailseite, Dashboard.
7. **Phase 5:** Wortauswahl C1 + Einstufungstest.

Nach jeder Phase: Tests laufen lassen, kurz in `docs/verlauf.md` festhalten, mir Screenshots bzw. Simulationsergebnis zeigen. Wenn etwas aus diesem Auftrag im bestehenden Code keinen Sinn ergibt, sag es mir, statt es blind umzusetzen.
