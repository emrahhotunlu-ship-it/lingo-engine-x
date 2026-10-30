# Lingvist – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: groß

Kurzurteil: Lingvist ist der reinste „Wort tippen im Satz“-Trainer am Markt: eine Karte mit Zielsprachen-Satz, Lückenfeld in Wortlänge, Grammatikangabe (z. B. „noun, plural“) und der Bedeutung des gesuchten Wortes in der Muttersprache; der Lerner muss das Wort selbst schreiben. Geplant wird mit einem Gedächtnismodell je Wort (eigene Umsetzung von ACT-R, Ziel: Wiederholen bei ca. 80 % Erinnerung), das Lerner- und Wortkurven kombiniert und laut Anbieter bekannte Wörter nach ca. 50 Antworten herausrechnet. Stark sind die gesteuerte Produktion mit Muttersprachen-Hinweis, die Tippfehler-Logik (Lage des Fehlers zählt, Akzente nachsichtig) und die ehrlichen Tagesstatistiken; schwach sind fehlende Erklärungen bei Fehlern, starre Antwort (Synonyme oft abgelehnt), Robotersprache und kein Sprechen mit Prüfung. Für Emrah sehr gut übertragbar: Kartenaufbau, „falsch → richtige Form zeigen und nachtippen“, Fehlerlage-Bewertung und die Kennzahlen „Karten, neue Wörter, Trefferquote, Zeit“ je Tag.

## 1. Planung

**Algorithmus (laut Anbieter).**
- Spaced Repetition mit „memory curve model“: Es verbindet „the forgetting curve of an individual learner“ mit „the forgetting curve for an individual word“ [G, lv-sr].
- Grundlage ist „a custom implementation of“ ACT-R (Anderson & Lebiere 1998). Das Modell sagt den „Prozentsatz“ voraus, zu dem ein Lerner ein Wort zu einem Zeitpunkt noch weiß, zwischen 0 % (vergessen) und 100 % (sofort verfügbar) [G, lv-sr].
- Zielpunkt: „the ideal time to schedule a repetition is when the learner remembers a word at the 80% level“ [G, lv-sr]. Das entspricht etwa einer Ziel-Behaltensquote von 80 % [Vermutung].
- Start: „the average forgetting curve of all of Lingvist's users as a baseline“, danach passt jede Antwort das persönliche Modell an: „every single answer you submit becomes an input for your personal model“ [G, lv-sr].
- Im Hilfe-Center vereinfacht: Wörter mit mehr Fehlern kommen öfter, leichte gehen schneller durch; jeder Treffer verlängert das Wiederholungsintervall des Wortes [G, lv-how; G, lv-rev].
- Der Gründer (Physiker, früher CERN) betont, dass jede Interaktion mit genauem Zeitstempel gespeichert wird und die Modelle laufend gegen echte Antworten geprüft werden: „We can predict whether they will answer any exercise correctly or incorrectly.“ [G, lv-dii].
- Parameter, Formel oder Quellcode sind **nicht offen** [nicht belegt gefunden]. Ein Patent wurde nicht gefunden [S, Suchergebnis].

**Einstufung („Knowledge Mapping Engine“, KME).**
- Beim Start beantwortet der Lerner bis zu 50 Wörter unterschiedlicher Schwierigkeit; das Modell sagt daraus die Kenntnis von „over 2,000 more words“ voraus, „up to 90% accurate“ [G, lv-sr (laut Anbieter)]. Der Gründer: nach ca. 50 Wörtern in rund 10 Minuten „we will already know which of the next thousands of words they know or don’t know“ [G, lv-dii].
- Ohne Test beginnt der Kurs ganz vorn [G, lv-test]. Konten lassen sich nicht einfach zurücksetzen, bei Bezahlkonten gar nicht [G, lv-test].
- Ein Tester fand die Einstufung zu niedrig: Flüchtigkeitsfehler und andere richtige Übersetzungen wurden als „unbekannt“ gewertet [G, lv-alr].

**Bekannte Wörter herausnehmen.** Das Modell schätzt aus den Antworten, welche Wörter man schon kann, und nimmt sie aus der Übung [G, lv-how]. Wer zu Beginn viele Karten sofort richtig hatte, bekommt sie später als „Welle alter Wörter“ wieder; nach über 6 Monaten Lernen heißt das „you are reviewing the basics“ [G, lv-easy; G, lv-same].

**Reihenfolge der neuen Wörter.** Nach Häufigkeit in Nachrichten, Untertiteln und Büchern [G, lv-how]. Kurse konzentrieren sich auf die drei häufigsten Formen eines Wortes; jede Wortform zählt als eigenes „Wort“ (Einzahl und Mehrzahl getrennt) [G, lv-learned].

**Kursgröße und Decks.**
- Das allgemeine Modul jedes Kurses deckt „at least 4,000 (and in some courses 5,000) of the most frequent words“ ab [G, lv-size].
- Gelistete Größen: Italienisch 6.143, Deutsch 6.009, Niederländisch 5.848, Spanisch (Spanien) 5.945, Französisch 5.091, Portugiesisch 5.013, Spanisch (Lateinamerika) 5.000, Russisch 4.461, Estnisch 3.744, Japanisch 3.107 [G, lv-size]. Ein englischer Kurs (für Lernende anderer Muttersprachen) erscheint in der Sprachwahl [G, Bild lv-as-6]; seine Größe ist auf der Seite nicht gelistet.
- Zusätzlich Themen-Decks (z. B. Business, Travel, Medical Spanish, „German Bureaucracy“, „Prepositional Phrases“); der Lerner wählt im Hub, ob er ein Deck allein oder mehrere zusammen lernt [G, lv-deckdef; G, lv-toomany].
- Ein Tester zählte 17 Decks für Französisch, 2 für Deutsch, 0 für Russisch [G, lv-alr]. Das Angebot ist also je Sprache sehr ungleich.

**Rechenbeispiel (eigene Rechnung, [Vermutung]).** Bei der Hilfe-Empfehlung „50 Wörter, 4-mal pro Woche“ und dem Blog-Ideal „20 neue am Tag“ wären die ca. 5.000 Wörter eines Kurses nach 250 Lerntagen eingeführt. Lingvists eigene Angabe „17 Stunden für 2.000 Wörter“ [G, lv-sr] entspricht rund 30 Sekunden je Wort und Karte inklusive Wiederholungen; das passt zu einer reinen Tipp-Karte ohne Erklärung.

**Geschwister-Karten.**
- Je Wortform eine Karte, das Modell plant **je Wort** (nicht je Satz) [G, lv-sr; G, lv-rev („each word gets its own repeat interval“)].
- Laut Hilfe-Center kann ein Wort in mehreren Beispielsätzen erscheinen [S, Suchtreffer lv-rev]. Ob der Satz bei jeder Wiederholung wechselt: **nicht belegt gefunden**.
- In eigenen Decks kann man je Wort einen anderen Beispielsatz wählen oder selbst schreiben [G, lv-deck].

**Fuzz und Lastausgleich.** Nicht dokumentiert [nicht belegt gefunden].

**Tageslimits und Takt.**
- Neue Wörter erscheinen erst, wenn alle fälligen Wörter erledigt sind: „You will only see new words after the number of ‚Words at risk‘ has been reduced to zero.“ [G, lv-nonew; G, lv-toomany].
- Wiederholungen lassen sich nicht abschalten [G, lv-toomany].
- Empfehlung: mindestens 50 Karten täglich, mindestens jeden zweiten Tag; „50 words a day, 4 times a week delivers better results“ [G, lv-how]. Blog: „100-20-1 rule: 100 cards, 20 new words, 1 challenge“ als idealer Tag [G, lv-sr].
- Die Sitzung zählt Karten bis zum Tagesziel (im Bild „8/50“) [G, Bild lv-as-1].
- Tagesstatistik springt um Mitternacht Ortszeit um [G, lv-reset].

**Rückstand nach Pause.** Nach einer Pause oder bei schwacher Trefferquote wächst die Wiederholungsschlange; neue Wörter warten [G, lv-same; G, lv-nonew]. Ein App-Store-Nutzer wünscht sich, nach zwei Monaten Pause gezielt alles Gelernte „at-will“ wiederholen zu können; die Antwort des Anbieters verweist auf das Gedächtnismodell [S, lv-as].

**Problemwörter.** Wörter mit vielen Fehlern kommen häufiger [G, lv-how]. Über das Drei-Punkte-Menü oben rechts auf der Karte kann man ein Wort „muten“ (stummschalten); es wird nicht gelöscht, sondern landet im Reiter „muted words“ der Wortliste und lässt sich dort wiederfinden [G, lv-skip; G, lv-same; G, lv-toomany]. Eine automatische Leech-Sperre wie in Anki ist nicht belegt.

**Freies Wiederholen.** „You cannot repeat words on demand.“ Wer bestimmte Gruppen üben will, nutzt Favoriten und „Playlists“ in der Wortliste [G, lv-new]. Wer keine neuen Wörter will, hört auf, sobald sie kommen, und macht am nächsten Tag die fälligen [G, lv-new]. Begründung des Anbieters: zu frühes Wiederholen eines scheinbar vergessenen Wortes sei „usually counterproductive“ [G, lv-new].

## 2. Abfrage-Leiter

**Hauptform: immer gesteuerte Produktion.** Der Lerner tippt das gesuchte Wort in die Lücke; die Bedeutung in der Muttersprache steht auf der Karte [G, Bild lv-as-1; G, lv-fu („you manually input the requested word (provided with its translation)“)]. Eine Auswahl-Stufe davor ist in den Quellen **nicht** belegt.

**Neues Wort:** Die Karte trägt die Marke „New word“. Wer es nicht weiß, drückt Enter oder „Learn word“ und sieht die Lösung, ohne Strafe für die Lernkurve des Anfangs [G, Bild lv-as-1; G, lv-alr („press enter to admit you don’t know the answer“); S, stuff (Aufdecken ohne Strafe, Vorrecherche)].

**Weitere Übungsformen (außerhalb der Hauptkarte).**
- „Challenges“: Lesen, Hören, Sprechen, Grammatik, als kleine Quiz; kostenlos eine am Tag [G, lv-fu; S, Suchtreffer]. Nicht für alle Sprachen [G, lv-alr]. Kritik: zu wenig ausgebaut [S, Suchtreffer].
- „Texts“ (Lesen mit Übungen) und Konjugationstraining (Französisch), 2022 [S, lv-2022].
- Spracheingabe: Mikrofonknopf über der Tastatur, Antwort per Sprache statt Tippen; nur mobil und online [G, lv-pron; G, Bild lv-as-1].
- „Variations“-Übungen: **nicht belegt gefunden**.

**Übersicht der Übungsformen:**

| Form | Was der Lerner tut | Wo | Beleg |
|---|---|---|---|
| Lückenkarte (Kern) | Wort in den Satz tippen, Bedeutung + Grammatik sichtbar | Learn | [G, Bild lv-as-1] |
| Lückenkarte per Stimme | Wort sprechen statt tippen | Learn, nur mobil | [G, lv-pron] |
| Einstufung | dieselbe Lücken-/Übersetzungskarte, bis ca. 50 Wörter | Start | [G, lv-alr; G, lv-sr] |
| Challenges | Lesen, Hören, Sprechen, Grammatik-Quiz | eigener Bereich | [G, lv-fu; G, lv-alr] |
| Texts | kurze Texte mit Übungen (Android, 2022) | eigener Bereich | [S, lv-2022] |
| Konjugation | Verbformen (Französisch, 2022) | eigener Bereich | [S, lv-2022] |
| Wort-Playlist | Wörter mit Audio anhören | Wortliste | [G, Bild lv-as-5; G, lv-new] |

**Wie wird aus Erkennen aktives Benutzen?** Gar nicht stufenweise: Lingvist startet direkt beim Abruf mit Hinweis (Bedeutung + Grammatik). Der Hinweis bleibt dauerhaft; es gibt keine Stufe „ohne Bedeutung, nur Satz“ [Vermutung, aus Bild und fehlenden Belegen]. Freie Produktion (eigener Satz) gibt es nicht [nicht belegt gefunden].

## 3. Bewertung

- **Automatisch**, keine Selbstbewertung [G, lv-mist; G, Bild lv-as-1].
- **Tippfehler-Logik:** Lingvist wertet nicht jeden falschen Buchstaben gleich. Es prüft, **wo** im Wort der Fehler liegt, um Tippfehler von echten Fehlern zu trennen, und bei echten Fehlern, ob sie schwer oder leicht sind; erst dann gilt das Wort als richtig oder falsch [G, lv-mist]. Beispiel des Anbieters: ein falscher Buchstabe in „subscription“ zählt anders als ein ganz falsches Wort; man muss das Wort vielleicht nachtippen, die Strafe ist aber nicht dieselbe [G, lv-mist].
- **Akzente:** Fehlende oder falsche diakritische Zeichen gelten standardmäßig **nicht** als Fehler; „Strict Diacritics“ in den Einstellungen macht es streng [G, lv-mist].
- **Synonyme:** werden teilweise angenommen, aber nicht alle. Begründung: Kurse lehren „specific expressions in specific contexts“, gewählt von Linguisten [G, lv-syn]. Meldeweg: Drei-Punkte-Menü → „Report a problem“ → „synonym not accepted“; das Team prüft und ergänzt [G, lv-syn].
- **„Richtig, aber nicht gesucht“:** Manchmal erscheint der Hinweis, die Antwort sei nicht falsch, aber nicht das gesuchte Wort; laut Nutzer erscheint er nicht immer, wenn er sollte [S, lv-as; G, lv-fu].
- **Falsche Wortform:** Weil jede Form ein eigenes Wort ist, ist eine andere Form falsch (bzw. mit Hinweis) [Vermutung, aus lv-learned und lv-mist]. Ein Tester bekam „das“ statt „die“ als Fehler mit Lösung, aber ohne Erklärung des Falls [G, lv-alr].
- **Zeit:** keine Belege, dass Antwortzeit die Note beeinflusst. Die Statistik misst aber Minuten je Tag [G, Bild lv-as-2].
- **Spracheingabe:** Großschreibung des ersten gesprochenen Wortes führte laut Nutzer zur Ablehnung [S, lv-as].

**Übersicht der Ausgänge einer Antwort** (zusammengesetzt aus den Belegen oben):

| Eingabe | Wertung | Folge | Beleg |
|---|---|---|---|
| genau richtig | richtig | Karte springt weiter, Intervall wird länger | [G, lv-auto; G, lv-rev] |
| richtig, nur Akzent fehlt | richtig (Standard) | wie richtig; mit „Strict Diacritics“ falsch | [G, lv-mist] |
| ein Buchstabe falsch, Lage spricht für Tippfehler | eher richtig / milde | Nachtippen möglich, Strafe geringer | [G, lv-mist] |
| echter, leichter Fehler | falsch (leicht) | Lösung zeigen, nachtippen, öfter wiederholen | [G, lv-mist; G, lv-how] |
| ganz falsches Wort | falsch | Lösung zeigen, nachtippen, öfter wiederholen | [G, lv-mist] |
| Synonym aus der Liste | richtig | wie richtig | [G, lv-syn] |
| Synonym nicht in der Liste | falsch oder Hinweis „nicht gesucht“ | Meldung an das Team möglich | [G, lv-syn; S, lv-as] |
| leer + Enter / „Learn word“ | unbekannt | Lösung zeigen (neues Wort ohne Strafe) | [G, lv-alr] |

Genaue Schwellen (z. B. ab wie vielen Buchstaben Abweichung ein Fehler „schwer“ ist) veröffentlicht Lingvist nicht [nicht belegt gefunden].

## 4. Rückmeldung

- **Nach richtig:** Karte springt automatisch weiter („Auto-advance cards“, abschaltbar) [G, lv-auto]. Bei abgeschaltetem Auto-Weiter kann man die Karte noch ansehen [G, lv-auto].
- **Nach falsch:** Die richtige Antwort wird gezeigt; man muss das Wort korrekt eintippen, um weiterzukommen [G, lv-mist („the app will ask you to retype the word“); S, fluentu/alllang (Vorrecherche)]. Ein Tester lernte aus der Rückmeldung den Unterschied „das/die“, vermisste aber eine Erklärung [G, lv-alr].
- **Erklärung:** keine Erklärung zur eigenen Antwort. Es gibt einen separaten Bereich „Grammar Tips“, laut Tester dünn [G, lv-alr; G, lv-fu]. Nutzer vermissen, „why a particular synonym is correct in a particular context“ [S, lv-as].
- **Übersetzung:** Wortbedeutung immer sichtbar; ganze Satzübersetzung ein- und ausklappbar (Pfeil) [G, lv-trans; G, Bild lv-as-1].
- **Grammatikangaben:** Geschlecht, Fall, Wortart stehen auf der Karte [G, lv-alr; G, Bild lv-as-1 („noun, plural“)]. Wenn der Satz das Geschlecht nicht verrät, hilft die Grammatikzeile unten auf der Karte; ein Antippen des Grammatik-Etiketts zeigt mehr Details, in Android zusätzlich ein Geschlechts-Symbol [G, lv-gender]. Das ist ein **Vor-Hinweis**, der Formfehler vermeiden soll, keine Nach-Erklärung [Vermutung].
- **Audio:** Sprachsynthese; Nutzer nennen sie roboterhaft und teils falsch [S, lv-as]. Wortliste mit Audio und „Wort-Playlist“ [G, Bild lv-as-5].
- **Diff (Unterschied markieren):** nicht belegt gefunden.
- **Kollokationen:** nicht belegt gefunden.

## 5. Kontext

- **Karte = Satz + Lücke + Bedeutung des Wortes + Grammatikangabe + ausklappbare Satzübersetzung** [G, Bild lv-as-1; G, lv-trans].
- Der **Gedächtniszustand gehört zum Wort** (bzw. zur Wortform): „each word gets its own repeat interval“ [G, lv-rev]; „the forgetting curve for an individual word“ [G, lv-sr].
- Ob der Satz bei Wiederholungen wechselt: nicht belegt gefunden; laut Hilfe-Snippet kann ein Wort in mehreren Sätzen erscheinen [S, Suchtreffer lv-rev].
- Kritik: „Teaches in a vacuum“, Wörter weitgehend isoliert, Sätze ohne Zusammenhang untereinander [G, lv-fu].
- Redewendungen: Ein Nutzer wünscht die wörtliche Übersetzung bildhafter Wendungen statt nur der englischen Umschreibung [S, lv-as].
- **Eigene Decks (Course Wizard / Custom decks):** Text einfügen, Foto eines Textes oder einer Szene, oder Thema eingeben; das System wählt die wichtigsten Wörter, liefert Übersetzungen und Beispielsätze. Am Desktop kann man je Wort einen anderen Beispielsatz wählen oder eigenen schreiben; „Automatic deck expansion“ [G, lv-deck; G, lv-alr]. Nur für einige Kurse [G, lv-deck]. Ein Tester bekam aus dem Thema „jungle“ 50 passende Wörter [G, lv-alr].

**Lingvist und Clozemaster im direkten Vergleich** (beide „Lücke im Satz“; Zusammenstellung aus beiden Steckbriefen):

| Merkmal | Lingvist | Clozemaster |
|---|---|---|
| Gedächtniseinheit | Wort(form), Modell je Wort | Satz je Sammlung |
| Planung | ACT-R-Modell, Ziel ~80 % Erinnerung, Lerner- + Wortkurve | feste Leiter 0/1/10/30/180 Tage |
| Fehlerfolge | Wort kommt öfter, abgestuft nach Fehlerart | Satz zurück auf 0 % |
| Hinweis auf der Karte | Bedeutung in L1 + Grammatik immer sichtbar | Satzübersetzung (abschaltbar), optional Hinweis |
| Eingabe | immer tippen (oder sprechen) | Auswahl oder Tippen nach Wahl |
| Tippfehler | nach Lage/Schwere, Akzente nachsichtig | eher zeichengenau (Forenklagen) |
| Nach Fehler | Lösung, Nachtippen | Lösung; Nachtippen nur über „Teach Me“ |
| Erklärung | keine zur Antwort, separate Grammar Tips | KI-„Explain“ je Satz |
| Neue Wörter | erst wenn „Words at risk“ = 0 | „Play“ mischt neu + bis 5 fällige |
| Fortschritt | Words learned / mastered (sinkt) / at risk | Stufenbalken 0–100 % je Sammlung |

Belege: siehe Abschnitte 1–4 hier und im Steckbrief clozemaster.md.

## 6. Aktive Nutzung

- Kern ist Abruf mit Schreiben des Wortes; das ist gesteuerte, nicht freie Produktion [Vermutung].
- Sprechen: Spracheingabe als Alternative zum Tippen; Bewertung über die Spracherkennung, die das Wort als Text liefert [G, lv-pron]. Eine Aussprache-Rückmeldung gibt es laut Hilfe nicht [G, lv-pron]. Nutzer klagen über winzige, nebeneinanderliegende Knöpfe Mikrofon/Abbrechen/„Reveal“ [S, lv-as].
- Eigene Sätze mit Zielwörtern schreiben und prüfen lassen: nicht belegt gefunden.
- Challenges mit Sprechen und Schreiben: vorhanden, Prüfweise nicht dokumentiert [G, lv-fu].

## 7. Fortschritt und Transparenz

- **„Words learned“ / „Total words“:** Wörter, die in der Übung erschienen und mindestens einmal beantwortet wurden [G, lv-learned].
- **„Words mastered“:** Wörter, die nach mehreren aufeinanderfolgenden richtigen Antworten laut Algorithmus im Langzeitgedächtnis sind; werden seltener wiederholt; **die Zahl sinkt wieder**, wenn nicht nach Plan wiederholt wird [G, lv-learned]. Das ist eine ehrliche, fallende Zahl [Vermutung].
- **„Words at risk“:** Zahl der fälligen Wörter, erreichbar über „Active word progress“ im Hub [G, lv-nonew]. Drei Gruppen: gemeistert, gefährdet, in Arbeit [G, lv-fu].
- **Tagesbilanz („My progress“):** Words to study, Learned words, Cards answered, Unique words, Time spent (min), New words, Correct rate (z. B. 67 %) [G, Bild lv-as-2].
- **Wochenverlauf:** je Tag Karten, Minuten, neue Wörter und Trefferquote; Zeitraum 1/2/4 Wochen, Gesamtzeit [G, Bild lv-as-4; G, lv-alr].
- **Abdeckungskurve („Vocabulary“):** Zahl der Wörter gegen Anteil verstandener Wörter in einem typischen Text (z. B. 1.578 Wörter ≈ 70 %), mit Beispieltext, in dem unbekannte Wörter als Lücken erscheinen [G, Bild lv-as-3]. Das ist die „Learning curve“ als Coverage-Anzeige [Vermutung zur Benennung].
- **Wortliste:** je Wort Beispielsatz, „Last seen“, „Practiced: N times“ [G, Bild lv-as-5].
- **Stufen-Striche auf der Karte:** fünf Striche über dem Satz, einer farbig bei „New word“ [G, Bild lv-as-1]. Bedeutung nicht dokumentiert; vermutlich Gedächtnisstand des Wortes [Vermutung].
- Behaltensrate laut Blog: regelmäßige Nutzer erinnern „about 80% of all of the words they've seen so far“ [G, lv-sr (laut Anbieter)].

## 8. Bildschirmablauf

Nach App-Store-Bild (Teil B, Lingvist) und Hilfe-Center:

1. **Start:** Hub mit Wochenverlauf und Deck-Fortschritt; unten „Learn“ [G, lv-how].
2. **Karte:** Oben Haus-Symbol, Zähler „8/50“ mit Balken, Drei-Punkte-Menü (Melden, Stummschalten). Mitte: Marke „New word“ (bei neuen) und Stufen-Striche; Satz groß in Serifenschrift, Lücke als Feld in Wortlänge; darunter Grammatikzeile „noun, plural“. Unten Kasten mit der Bedeutung („ingredients“) und ausklappbarer Satzübersetzung. Ganz unten Mikrofon und „Learn word“. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/b1/b9/45/b1b945c9-727f-4ec1-85f6-fb00241bf08f/bb2e0dfe-baf8-4ce0-a055-3bdda9ddc433_2._AI-powered_language_learning.jpg/600x1300bb-60.jpg [G].
3. **Antwort:** tippen (Enter) oder sprechen. Unbekannt → Enter leer bzw. „Learn word“ zeigt die Lösung [G, lv-alr].
4. **Richtig:** automatischer Wechsel zur nächsten Karte (abschaltbar) [G, lv-auto].
5. **Falsch / fast richtig:** richtige Form erscheint, Wort muss korrekt nachgetippt werden; Tippfehler zählen milder [G, lv-mist].
5a. **Nebenwege auf der Karte:** Drei-Punkte-Menü → Wort stummschalten (wandert in „muted words“) oder „Report a problem“ (z. B. Synonym nicht angenommen) [G, lv-skip; G, lv-syn]. Pfeil an der Satzübersetzung → ein-/ausklappen [G, lv-trans]. Grammatik-Etikett antippen → Details zu Geschlecht/Fall [G, lv-gender].
6. **Tagesziel erreicht:** Bildschirm „You're awesome! You have done 150 cards“ mit Tageskennzahlen. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/53/a5/df/53a5df9d-3cd0-162b-35d7-b8927d2b259c/de2a9f52-5080-4167-9ab6-8fe9203b5e1b_3._Track_progress_and_see_results.jpg/600x1300bb-60.jpg [G].
7. **Statistik:** Wochenkurve und Abdeckungskurve. Bilder: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/8f/d2/66/8fd26678-3d1f-ebd4-d820-23db83c1b50e/e5859e3e-5fe1-41ae-8b19-7bb114d10396_4._Build_vocabulary_at_your_own_pace.jpg/600x1300bb-60.jpg und https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/81/3e/e2/813ee2ff-be1c-b1c2-f605-a2407950e5a9/828f6994-a1ad-47d3-93ef-20b05a3dddde_5._Rapid_language_improvement.jpg/600x1300bb-60.jpg [G].

## 9. Nutzerstimmen

**Lob**
- [S, lv-as] App-Store-Nutzer (Französisch): Nach Lingvist konnte er Romane für Erwachsene lesen und Filme schauen; eigene Decks seien besonders nützlich („like a MAGIC WAND“).
- [S, lv-as] App-Store-Nutzer: „The spaced repetition is the best and most data driven of any other out there“.
- [S, lv-as] App-Store-Nutzer: „Duolingo for grownups“, ohne nervige Animationen, zielt besser auf die eigenen Lücken.
- [S, lv-as] App-Store-Nutzer: „The BEST APP for vocabulary“, lehre eine enorme Menge an Wörtern.
- [S, lv-survey] Umfrage (38 Nutzer, Master-Studentin, Blog des Anbieters): über 80 % stimmten zu, die App habe positive Wirkung; Praktikabilität 75 % positiv.

**Klage**
- [S, lv-as] App-Store-Nutzer: Alternative richtige Wörter würden nicht angenommen; der Hinweis „nicht falsch, aber nicht gesucht“ komme nicht zuverlässig, und es fehle die Erklärung, warum ein bestimmtes Synonym passt.
- [S, lv-as] App-Store-Nutzer (Italienisch): Roboterstimme spreche teils falsch; die ersten 10–20 von 50 Karten seien geballt unbekannte Wörter.
- [S, lv-as] App-Store-Nutzer: kein freies Wiederholen bereits gelernter Wörter nach langer Pause.
- [S, lv-as] App-Store-Nutzer: Mikrofon-, Abbrechen- und Aufdecken-Knopf winzig und am selben Ort, Fehlklicks werden als falsch gewertet.
- [S, lv-fu] Testbericht: „same-y exercises“, Wörter „in relative isolation“.
- [S, lv-alr] Testbericht: Bei Fehlern fehle die Erklärung, z. B. warum „du“ statt „dich“.

## 10. Belege für die Wirkung

- **Keine unabhängige, begutachtete Studie** zu Lingvist gefunden [S, Suchergebnis].
- **Anbieterangaben:** KME „up to 90% accurate“; durchschnittlich „17 hours“ für 2.000 Wörter; Nutzer erinnern ca. 80 % der gesehenen Wörter [G, lv-sr (laut Anbieter)]. Einordnung: Messweise, Stichprobe und Begriff „gelernt“ bleiben offen; 80 % passt auffällig genau zum eigenen Zielwert der Planung, ist also eher Modellziel als Lernerfolg [Vermutung].
- **Selbstversuch 2014:** eine Testnutzerin, Französisch, 14 Tage, 13 h 55 min, 300 Karten am Tag, „1,001“ Wörter gelernt; kein Behaltenstest, sie berichtet nur, nach ausgelassenen Tagen mehr vergessen zu haben [G, lv-exp (Blog des Anbieters)]. Einordnung: Einzelfall, „gelernt“ = gesehen, kein Nachtest.
- **Nutzerumfrage 2019:** 38 Teilnehmende über soziale Medien, Likert-Skala, misst nur Zufriedenheit (Kirkpatrick Stufe 1). Die Autorin selbst: „I cannot make any general statement about its effectiveness.“ Niedrigster Wert „language learning potential“ 3,69 von 5 [G, lv-survey]. Einordnung: Selbstauswahl, kleine Stichprobe, auf dem Anbieter-Blog.
- **Gründer-Interview 2022:** Lehrerin berichtet von großen Fortschritten bei ca. 10 Minuten am Tag [G, lv-dii]. Anekdote.
- **Geplantes RCT:** Ein Investor nennt als Wirkungsziel einen Vergleich per randomisierter Studie mit anderen Apps; Ergebnisse nicht gefunden [S, lv-rubio].
- Werbeversprechen 2015 „200 Stunden“ [S, lv-edsurge].
- Gesamturteil: Methodisch plausibel (ACT-R, Abruf mit Hinweis, Spacing), aber Wirkung nur durch Anbieterzahlen und Anekdoten belegt [Vermutung].

## 11. Übertragbar auf Lingo-Engine X

- **Übernehmen: Kartenaufbau „Satz + Lücke in Wortlänge + Bedeutung auf Deutsch + Wortart/Form“.** Das ist gesteuerte Produktion mit klarem Abrufziel und passt zu Kap. 15 („Eingabefeld in der Lücke“). Für C1 die deutsche Bedeutung in späteren Stufen ausblenden (Lingvist tut das nicht).
- **Übernehmen: Tippfehler nach Lage und Schwere werten** (ein Buchstabe in einem langen Wort ≠ falsches Wort) und Akzente/Groß-klein nachsichtig. Das verhindert „ungerecht falsch“ und passt zu unserer Auto-Note aus Richtigkeit, Zeit und Hilfe.
- **Übernehmen: Nach Fehler die richtige Form zeigen und einmal nachtippen lassen**, ohne dass das Nachtippen als Treffer zählt. Kurze, aktive Korrektur statt nur Anzeigen.
- **Übernehmen: „richtig, aber nicht gesucht“ als eigener Ausgang** (Synonym erkannt → Hinweis, kein Fehler). Lingvist zeigt, wie sehr Nutzer leiden, wenn das fehlt oder unzuverlässig ist; bei uns kann Claude das Synonym prüfen (Tutor-Engine „Auch richtig“).
- **Übernehmen: ehrliche Tageskennzahlen** (Karten, neue Wörter, Trefferquote, Minuten) und eine fallende „gemeistert“-Zahl; dazu Abdeckungskurve „du verstehst ca. X % eines Textes“ als motivierendes, aber ehrliches Bild.
- **Anpassen: Gedächtnismodell je Wort mit Zielwert ~80–90 % und Einstufung über ca. 50 Wörter.** Wir haben FSRS; die Idee „bekannte Wörter per Probe herausnehmen“ (KME) ist für B2→C1 wertvoll, damit Emrah keine Grundwörter drillt.
- **Verwerfen: „Neue Wörter erst, wenn Rückstand null“ als harte Regel.** Bei Pausen blockiert das neue Wörter vollständig; Kap. 15 verbietet „neue Wörter, die an Tagen mit Wiederholungen nie auftauchen“.
- **Ergänzen, was fehlt:** Erklärung zur eigenen Antwort und Sprechen mit Prüfung. Genau hier liegen Lingvists Hauptkritiken; wir haben dafür den KI-Tutor.

## Quellen

| Kürzel | URL | Status |
|---|---|---|
| lv-how | https://lingvist.com/help/how-should-i-learn-with-lingvist-and-why-does-it-work/ | abgerufen 30.10.2026 |
| lv-learned | https://lingvist.com/help/what-are-learned-words/ | abgerufen 30.10.2026 |
| lv-same | https://lingvist.com/help/why-do-i-see-the-same-words/ | abgerufen 30.10.2026 |
| lv-nonew | https://lingvist.com/help/why-do-i-not-see-new-words/ | abgerufen 30.10.2026 |
| lv-faq | https://lingvist.com/help/learning-questions/ | abgerufen 30.10.2026 (Fragenliste) |
| lv-mist | https://lingvist.com/help/how-do-you-count-mistakes/ | abgerufen 30.10.2026 |
| lv-syn | https://lingvist.com/help/why-wont-you-accept-synonyms/ | abgerufen 30.10.2026 |
| lv-rev | https://lingvist.com/help/can-i-review-a-word-although-i-answered-it-correctly-the-first-time/ | abgerufen 30.10.2026 |
| lv-toomany | https://lingvist.com/help/i-have-too-many-words-to-review-can-i-switch-them-off/ | abgerufen 30.10.2026 |
| lv-deck | https://lingvist.com/help/how-to-create-custom-decks/ | abgerufen 30.10.2026 |
| lv-auto | https://lingvist.com/help/the-card-changes-too-quickly/ | abgerufen 30.10.2026 |
| lv-trans | https://lingvist.com/help/turn-off-the-whole-sentence-translation/ | abgerufen 30.10.2026 |
| lv-test | https://lingvist.com/help/what-if-i-didnt-take-the-short-test-at-the-beginning/ | abgerufen 30.10.2026 |
| lv-pron | https://lingvist.com/help/how-can-i-train-my-pronunciation/ | abgerufen 30.10.2026 |
| lv-easy | https://lingvist.com/help/why-do-i-see-easy-words-all-of-a-sudden/ | abgerufen 30.10.2026 |
| lv-reset | https://lingvist.com/help/when-does-the-app-reset-my-daily-stats/ | abgerufen 30.10.2026 |
| lv-skip | https://lingvist.com/help/can-i-skip-certain-words/ | abgerufen 30.10.2026 |
| lv-gender | https://lingvist.com/help/how-do-i-tell-which-gender-to-decline-for-the-word/ | abgerufen 30.10.2026 |
| lv-new | https://lingvist.com/help/why-do-i-see-new-words/ | abgerufen 30.10.2026 |
| lv-size | https://lingvist.com/help/how-large-is-the-course/ | abgerufen 30.10.2026 |
| lv-deckdef | https://lingvist.com/help/what-is-a-deck/ | abgerufen 30.10.2026 |
| lv-sr | https://lingvist.com/blog/spaced-repetition-in-learning/ | abgerufen 30.10.2026 |
| lv-dii | https://datainnovation.org/2022/07/5-qs-for-mait-muntel-ceo-of-lingvist/ | abgerufen 30.10.2026 |
| lv-survey | https://lingvist.com/blog/lingvist-users-rate-their-learning-experience/ | abgerufen 30.10.2026 |
| lv-exp | https://lingvist.com/blog/day-14-french-experiment-done/ | abgerufen 30.10.2026 |
| lv-fu | https://www.fluentu.com/blog/lingvist-review/ | abgerufen 30.10.2026 |
| lv-alr | https://www.alllanguageresources.com/lingvist-review/ | abgerufen 30.10.2026 (per curl, WebFetch leer) |
| lv-as | https://apps.apple.com/us/app/lingvist-learn-languages-fast/id969093402 | abgerufen 30.10.2026 (Bewertungen, Bilder) |
| lv-2022 | https://lingvist.com/blog/what-did-we-do-in-2022/ | nur Suche |
| lv-edsurge | https://www.edsurge.com/news/2015-11-17-lingvist-scores-8-million-to-help-people-learn-new-languages-in-200-hours | nur Suche |
| lv-rubio | https://rubio.vc/?p=804 | nur Suche |
| stuff | https://www.stuff.tv/review/app-of-the-week-lingvist-review | gesperrt 403 (Aussage aus Vorrecherche mara) |
| Bild lv-as-1 … lv-as-5 | siehe Bildliste Teil B (Lingvist Nr. 1–5) | geprüft 200 image/jpeg |
