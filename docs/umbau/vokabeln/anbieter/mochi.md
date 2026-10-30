# Mochi – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: normal

Kurzurteil: Mochi ist eine schlanke Karteikarten-App mit Markdown-Notizen und bewusst nur **zwei** Antworten: „Remembered“ und „Forgot“. FSRS ist wählbar und funktioniert laut Anbieter auch mit diesen zwei Noten. Gut gelöst sind die zweistufige Aufnahme neuer Karten (erst „Learn“, dann Planung), die getrennte Planung je Richtung und KI-Felder, die Beispielsätze, Übersetzung, Bilder und Ton automatisch erzeugen. Eine Tipp-Abfrage, eine automatische Bewertung und aktive Nutzung fehlen. Für Emrah übertragbar sind die binäre Note als Eingang für FSRS, die zweistufige Aufnahme und die zufällige Reihenfolge gegen Kontext-Raten.

Vorarbeit: mara-lernmethodik 2.15 nannte FSRS bei Mochi „nicht bestätigt“. Das ist jetzt geklärt: Mochi bietet FSRS als Option an [G, [m-fsrs]].

## 1. Planung
- **Standard-Algorithmus:** passt das Intervall bei jedem „Remembered“ oder „Forgot“ um feste Faktoren an, „einfach und vorhersagbar“ [G, [m-fsrs]]. Laut FAQ ein abgewandeltes SM-2: Der Nutzer stellt den Leichtigkeitsfaktor von Hand ein, und Fehler setzen das Intervall standardmäßig nicht zurück [S, [m-faq]]. Die genauen Faktoren fand ich nicht [nicht belegt gefunden].
- **FSRS (optional):** Umschalten unter Settings → Review Settings → Scheduling algorithm. Alle gelernten Karten wechseln sofort, ohne Verlust: Stabilität und Schwierigkeit werden aus dem bisherigen Verlauf berechnet [G, [m-fsrs]].
  - Zwei Noten: „Remembered“ wird zu „Good“, „Forgot“ zu „Again“. Man verliert etwas Information aus Hard/Easy, aber der eigene Verlauf bleibt die beste Datenbasis [G, [m-fsrs]].
  - Ziel-Behaltensquote („Target retention“) einstellbar, Standard 90 % [G, [m-due]].
  - **Kein eingebauter Optimierer;** eigene Parameter muss man extern berechnen und einfügen. Parameter aus Anki zu übernehmen, rät Mochi ab [G, [m-fsrs]].
- **Zweistufige Aufnahme** [G, [m-review]], [G, [m-new]]:
  - **Learn-Phase:** Neue Karten zeigt Mochi, bis man „Remembered“ wählt. „Forgot“ schickt sie ans Ende der Neu-Runde.
  - **Review-Phase:** Erst dann wird geplant. Die erste Wiederholung kommt „typischerweise am selben Tag“.
- **Vergessen:** Die Karte wird nicht sofort zurückgesetzt, sondern kommt in eine „Re-review“-Warteschlange und bekommt eine zweite Chance. Erst bei erneutem Fehler wird der Plan verkürzt [G, [m-review]], [G, [m-old]].
- **Geschwister:** „Review reverse“ legt automatisch eine Rückwärtskarte an. **Jede Richtung hat eigenen Verlauf und eigenen Plan** [G, [m-rev]]. Eine Sperre für den selben Tag ist nicht belegt.
- **Fuzz, Lastausgleich:** nicht belegt gefunden.
- **Tageslimit:** nur „Limit new cards per day“. Der Entwickler empfiehlt im Durchschnitt höchstens 10 neue Karten pro Tag [G, [m-review]], [G, [m-new]]. Ein Limit für Wiederholungen fehlt [S, [m-forum]].
- **Rückstand:** Überfällige Karten bleiben in „Due today“ und kommen nach Grad der Verspätung zuerst [G, [m-due]]. Rat: aussortieren („archive“), in kleinen Sitzungen lernen, nach Deck oder Tag priorisieren [G, [m-old]].
- **Leeches:** keine eigene Regel belegt. Rat: Karten, die den Aufwand nicht wert sind, archivieren [G, [m-review]].

## 2. Abfrage-Leiter
- **Vorder- → Rückseite**, dazu optional rückwärts. Laut Hilfe trainiert vorwärts „Erkennen (leichter)“, rückwärts „Abruf (schwerer, haltbarer)“ [G, [m-rev]].
- **Lücken („cloze“)** im Markdown-Text [G, Doku-Navigation [m-docs]].
- **Tippen statt Aufdecken:** nicht belegt gefunden.
- Eine Leiter vom Erkennen zum Benutzen gibt es nicht; die Stufen sind getrennte Karten [Vermutung].

## 3. Bewertung
- **Selbst, binär:** Remembered / Forgot. Begründung des Anbieters: Die zusätzliche Denkarbeit bei Easy/Medium/Hard lohne die kleine Planungsverbesserung nicht und schade im schlimmsten Fall [G, [m-old]].
- **Tippfehler, Zeit, Hinweise:** keine Rolle belegt.
- **„Cramming“:** Abfragen außerhalb des Plans; die Antworten wirken nicht auf die Planung [G, [m-cram]].

## 4. Rückmeldung
- **Rückseite**, wie der Nutzer sie anlegt [G, [m-start]].
- **KI-Felder („Dynamic fields“):** erzeugen Beispielsatz, Umformulierung, Übersetzung, Ton (Text-to-Speech), Bild, Wörterbuch-Eintrag. Falsche Ausgaben lassen sich mit einem Ersatzfeld überschreiben [G, [m-dyn]], [G, [m-home]].
- **Wörterbuch** mit Beispielen; das Suchwort wird im Beispiel markiert, auch gebeugte Formen (koreanische Verben) [G, [as-mochi] Versionshinweis].
- **Nachtippen, Diff:** nicht belegt gefunden.

## 5. Kontext
- **Fester Inhalt je Karte;** KI-Beispielsätze entstehen beim Anlegen, nicht bei jeder Abfrage [G, [m-dyn]].
- **Zustand je Karte und Richtung** [G, [m-rev]].
- **Zufällige Reihenfolge** in „Due today“, „um Verzerrung durch verwandte Karten zu vermeiden“ [G, [m-due]].

## 6. Aktive Nutzung
- Nicht eingebaut. Notizen und Karten leben im selben Programm, mit Rückverweisen zwischen Notizen [G, [m-home]]. Eigene Sätze werden nicht geprüft [nicht belegt gefunden].

## 7. Fortschritt und Transparenz
- **Kartenstatus:** New, Learned, Archived [G, [m-review]].
- **Fälligkeit:** Jede Karte hat ein Fälligkeitsdatum, an dem ihre Abrufwahrscheinlichkeit die Ziel-Quote erreicht [G, [m-due]].
- **Lastvorschau, Behaltensrate:** nicht belegt gefunden.

## 8. Bildschirmablauf
Nach Hilfe [G, [m-start]]:
1. **Deck öffnen**, oben rechts **„New cards“**. Bild: <https://mochi.cards/docs/getting-started/img/review-cards-1_light.png>.
2. **Neue Karte** ansehen; „Remembered“ (in die Planung) oder „Forgot“ (später nochmal); Pfeile vor und zurück.
3. Nach den neuen Karten **„Review“**. Bild: <https://mochi.cards/docs/getting-started/img/review-cards-2_light.png>.
4. **Vorderseite** lesen, Antwort erinnern.
5. **Rückseite aufdecken** (seit einer neuen Version auch per Tippen auf die Karte [G, [as-mochi]]).
6. **Remembered / Forgot** wählen; bei Forgot kommt die Karte in die Re-review-Schlange.
7. Fertig, wenn nichts mehr fällig ist.

## 9. Nutzerstimmen
**Lob**
- Ein UI-Designer lernte vier Jahre Japanisch mit Anki und „hasste es immer“; Mochi habe ihn begeistert [S, [as-mochi]].
- „Endlich“ eine App mit angenehmer Oberfläche und funktionierender Wiederholung, die einfach sagt, wie viele Karten fällig sind [S, [as-mochi]].
- Ein Forum-Nutzer nennt Mochi „minimalistisch, mächtig und unglaublich stabil“, in vielem besser als Anki oder RemNote [S, [m-forum-sum]].
- Ein Hacker-News-Kommentar: Oberfläche viel besser als Anki, Algorithmus einfacher [S, [m-hn]].

**Klage**
- „Some counterintuitive behaviors“ bei Karten mit Anhängen, z. B. Doppeltippen [S, [as-mochi]].
- iOS-App träge im Stromsparmodus; Scrollen auf iOS fehlerhaft; Diagramm-Karten beim Lernen kaputt [S, [m-forum-sum]].
- Nur ein Limit für neue Karten, keins für Wiederholungen; das erschwert die Balance [S, [m-forum]].
- Ein Vergleichsartikel nennt den Standard-Algorithmus „basic“ im Vergleich zu SM-2 oder FSRS [S, [m-hn]] (schwache Quelle).

## 10. Belege für die Wirkung
- Keine Studie zu Mochi gefunden [nicht belegt gefunden].
- Die Startseite zeigt nur Nutzerzitate, laut Anbieter [G, [m-home]].
- Die Aussage „FSRS funktioniert mit zwei Noten“ ist eine Herstellerangabe [G, [m-fsrs]]. Der FSRS-Benchmark zeigt, dass Modelle mit Noten besser vorhersagen als ohne; eine eigene Messung für zwei Noten fand ich nicht [Vermutung, siehe anki.md [bench]].
- App-Store-Wertung 4,6 bei 175 Bewertungen (US) [G, [as-mochi]].

## 11. Übertragbar auf Lingo-Engine X
- **Binäre Note als FSRS-Eingang übernehmen** (richtig → Good, falsch → Again). Hard/Easy setzt bei uns die App aus Zeit und Hilfe. Grund: Mochi zeigt, dass FSRS mit zwei Noten läuft; wir reichern sie automatisch an.
- **Zweite Chance vor dem Zurücksetzen übernehmen:** Bei einem Fehler kommt das Wort erst in derselben Sitzung nochmal; der Plan sinkt erst, wenn es auch dann falsch ist. Grund: Ein Ausrutscher (Tippfehler, Ablenkung) bestraft nicht den ganzen Verlauf.
- **Zweistufige Aufnahme anpassen:** Ein neues Wort kommt erst nach einem erfolgreichen Abruf am Tag 0 in die Langzeit-Planung. Grund: passt zu „Tag-0-Abruf“ im wort-fest-plan.
- **Zufällige Reihenfolge übernehmen**, mit festem Startwert. Grund: verhindert Raten aus der Reihenfolge (Mochi, Anki).
- **KI-Felder verwerfen** als Laufzeit-Erzeugung ohne Prüfung. Grund: Bei uns müssen Sätze vorher gegengelesen sein (Fehlersatz-Wächter, `english-teacher`).

## Quellen
- [m-docs] → https://mochi.cards/docs/ · abgerufen 30.10.2026
- [m-review] → https://mochi.cards/docs/reviewing/ · abgerufen 30.10.2026
- [m-fsrs] → https://mochi.cards/docs/reviewing/fsrs/ · abgerufen 30.10.2026
- [m-new] → https://mochi.cards/docs/reviewing/new-cards/ · abgerufen 30.10.2026
- [m-due] → https://mochi.cards/docs/reviewing/due-today/ · abgerufen 30.10.2026
- [m-rev] → https://mochi.cards/docs/reviewing/review-reverse/ · abgerufen 30.10.2026
- [m-cram] → https://mochi.cards/docs/reviewing/cramming/ · abgerufen 30.10.2026
- [m-start] → https://mochi.cards/docs/getting-started/reviewing-cards/ · abgerufen 30.10.2026
- [m-dyn] → https://mochi.cards/docs/templates/dynamic-fields/ · abgerufen 30.10.2026
- [m-old] → https://mochi.cards/docs/reviewing/index_old · abgerufen 30.10.2026 (ältere Fassung der Übersicht)
- [m-home] → https://mochi.cards/ · abgerufen 30.10.2026
- [m-faq] → https://mochi.cards/faq.html · nur Suche (beim Abruf 404)
- [m-forum] → https://forum.mochi.cards/posts/212 · nur Suche
- [m-forum-sum] → https://forum.mochi.cards/categories/3 · nur Suche
- [m-hn] → https://alternativeto.net/software/mochi/about/ und https://www.saashub.com/mochi · nur Suche
- [as-mochi] → https://apps.apple.com/us/app/id1507775056 · abgerufen 30.10.2026 (Rezensionen, Versionshinweise)
