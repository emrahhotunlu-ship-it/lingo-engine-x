# Duolingo – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: normal

Kurzurteil: Duolingo plant Wörter mit dem am besten offen gelegten Modell eines großen Anbieters: Half-Life Regression (HLR) schätzt je Lerner und Wort eine „Halbwertszeit“ aus einfachen Zählern (gesehen, richtig, falsch), Code und Daten sind veröffentlicht. Darüber wählt „Birdbrain“ Übungen mit passender Erfolgschance. Die Abfrage selbst ist aber stark auf Erkennen gebaut (Wortbank-Kacheln, Bildauswahl, Zuordnen), Tippen ist nur teilweise wählbar, und Tippfehler-Toleranz verwischt teils echte Formfehler. Für Emrah übertragbar sind das Wort-Gedächtnismodell aus Zählern (als Ergänzung zu FSRS), der Grundsatz „üben, wenn man kurz vor dem Vergessen ist“ und die gezielte Fehler-Wiederholung; nicht übertragbar sind Wortbank als Hauptform und Spiel-Druck.

## 1. Planung

- **HLR-Modell (Settles & Meeder 2016):** Erinnerungswahrscheinlichkeit p = 2^(−Δ/h); Δ = Zeit seit der letzten Übung, h = Halbwertszeit. Bei Δ = h ist p = 0,5 [G, hlr]. Die Halbwertszeit wird geschätzt als ĥ = 2^(Θ·x) [G, hlr].
- **Merkmale x:** Zähler je Lerner und Wort: wie oft gesehen, wie oft richtig, wie oft falsch (als Wurzel der Zählwerte besser), dazu je Wortform („lexeme tag“, ca. 20.000) ein Schwierigkeitsmerkmal [G, hlr].
- **Daten und Güte:** 12,9 Mio. Lerner-Wort-Sitzungen. HLR: mittlerer absoluter Fehler (MAE) 0,128 gegen Leitner 0,235 und Pimsleur 0,445 [G, hlr]. Das Blog nennt „more than 12 million practice sessions“ und MAE 0,13 [G, hlr-blog].
- **Code (offen):** github.com/duolingo/halflife-regression, Datei `experiment.py`: Klasse `SpacedRepetitionModel`, Funktion `predict()` rechnet `p = 2. ** (-inst.t/h)`; `hclip()` begrenzt h auf 15 Minuten bis 274 Tage (ca. 9 Monate), `pclip()` p auf 0,0001–0,9999 [G, hlr-code].
- **Leitner und Pimsleur als Sonderfälle:** Leitner (bei Start 2012 benutzt) verdoppelt/halbiert die Halbwertszeit je Antwort; Pimsleur ist ein fester Plan (5 s, 25 s, 2 min, 10 min …) [G, hlr-blog].
- **Wortschwierigkeit:** leichte Wörter (Verwandte Wörter, kurz, häufig, regelmäßig) bekommen positive Gewichte, schwere (unregelmäßig, selten, Partizipien) negative [G, hlr].
- **Wann üben:** „The best time to practice is when you are on the verge of forgetting“; Übungen zielen auf die Wörter mit der niedrigsten vorhergesagten Erinnerung [G, hlr-blog].
- **Birdbrain (seit März 2020):** sagt voraus, ob ein Lerner eine bestimmte Übung richtig löst; der „Session Generator“ wählt daraus Übungen in passender Schwierigkeit. Anteil personalisierter Lektionen: ca. 5 % (Juli 2020), über 20 % (Oktober 2020) [G, bb]. Spätere Versionen (Elo-artig, dann neuronales Netz) laut Vorrecherche [S, ieee].
- **Geschwister-Karten:** Einheit ist das Wort (lexeme tag), nicht die Übung; dasselbe Wort steckt in vielen Sätzen [G, hlr].
- **Fuzz, Tageslimit, Leeches:** nicht belegt gefunden.
- **Rückstand:** Die Stärke-Anzeigen sinken laufend, bis man übt [G, hlr]. Ein eigener Pausen-Mechanismus ist nicht belegt.

## 2. Abfrage-Leiter

- **Übungsformen** (Bilder und Blog): Bild auswählen zu Wort/Audio, Satz mit Wortbank-Kacheln übersetzen, Zuordnen (Wort links ↔ Übersetzung rechts), Hören und antworten, Nachsprechen [G, Bild duo-as-1, duo-as-2; G, ph].
- **Practice Hub:** „Words“ (empfohlene Wörter, Zuordnen; z. B. „58 French vocabulary words“), „Mistakes“ (z. B. „You'll review 10 mistakes“), „Listen“, „Speak“ [G, ph (Stand 18.02.2026)]. „Perfect Pronunciation“: 10 Sprechübungen am Stück [S, Suchtreffer pp]. Inhalte stammen aus den eigenen letzten Lektionen [S, pp].
- **Tippen statt Wortbank:** Laut Nutzern kann man in manchen Übungen auf Tastatur umschalten; je niedriger das Können in einer Einheit, desto öfter zwingt die App zur Wortbank, auf hohem Stand fast überall Tippen [S, wb-red (Nutzerstimmen 2022, widersprüchlich)]. Eine Erweiterung „TypeLingo“ wirbt damit, Tippen in Übersetzungsübungen „wiederherzustellen“ [S, typelingo]. Offizielle Regel: nicht belegt gefunden.
- **Vom Erkennen zum Benutzen:** Birdbrain zielt auf Aufgaben mit passender Erfolgschance (ca. 70 % laut Vorrecherche [S, vb]); eine feste Leiter je Wort ist nicht belegt. Max: Video-Call und Rollenspiel mit KI [S, Vorrecherche mara].

## 3. Bewertung

- Automatisch [G, hlr]. Keine Selbstbewertung.
- **Tippfehler:** Kleine Abweichungen und fehlende Akzente werden oft als richtig angenommen, mit sanftem Hinweis auf den Tippfehler unten im Bild [S, typo-tv]. Nachbartasten-Fehler am Handy werden „manchmal“ als Tippfehler durchgewunken [S, typo-lemmy]. Problem: falsche Wortformen werden teils fälschlich als Tippfehler gewertet [S, typo-tv]; ein Reddit-Nutzer beschreibt zwei dänische Wörter, die nur einen Buchstaben auseinander liegen und deshalb als Tippfehler galten [S, typo-red]. Duolingo testet viel per A/B, verschiedene Nutzer sehen Verschiedenes [S, typo-lemmy].
- **Zeit:** keine Belege zur Note.
- **Fast richtig:** gilt meist als richtig mit Hinweis [S, typo-tv].

## 4. Rückmeldung

- Fehler am Ende einer Lektion lassen sich nachbessern [S, duo-as (Nutzerstimme)].
- „Explain My Answer“ (Max) erklärt nach bestimmten Aufgaben im Chat [S, Vorrecherche mara].
- Nach einem Max-Video-Call gibt es eine Erklärung am Ende; die Figur greift das Gespräch beim nächsten Mal wieder auf [S, duo-as].
- Wörter im Satz sind antippbar (gestrichelte Unterlinie) [G, Bild duo-as-1].
- Diff, Kollokationen: nicht belegt gefunden.

## 5. Kontext

- Gedächtniszustand gehört zum **Wort** (lexeme tag), Übungen wechseln [G, hlr].
- Sätze kommen aus einer großen Übungsdatenbank, die automatisch nach Wortformen indiziert ist [G, hlr].
- Kritik am Inhalt: „AI-first“ 2025 mit vielen KI-erzeugten Kursen, Klagen über „AI slop“ [S, duo-ai].

## 6. Aktive Nutzung

- Sprechen: „Repeat after Lily“ (Nachsprechen) im Practice Hub [G, ph]; Max Video Call (freies Gespräch mit KI) [S, duo-as].
- Eigene Sätze mit Zielwörtern schreiben und prüfen lassen: nicht belegt gefunden.
- Nutzer wünscht sich im Video-Call Formulierungshilfen, weil die KI Verben benutzt, die man noch nicht gelernt hat [S, duo-as].

## 7. Fortschritt und Transparenz

- **Stärke-Anzeigen:** Früher je Fertigkeit vier Balken; der Wert ist der Mittelwert der vorhergesagten Erinnerung ihrer Wörter, halb leer = Zeit zum Üben [G, hlr-blog; G, hlr]. Ob es diese Balken in der heutigen Pfad-Oberfläche noch gibt: nicht belegt gefunden; ein Fan-Wiki vermutet, der Verfall sei abgeschafft [S, wiki].
- **Words-Liste im Practice Hub:** zeigt Zahl der übbaren Wörter [G, ph]; eine Stärke je Wort ist offiziell nicht belegt.
- **Duolingo Score 0–160** mit CEFR-Zuordnung [S, Vorrecherche mara].
- Serie, XP, Ligen [G, Bild duo-as-4].

## 8. Bildschirmablauf

1. **Pfad:** nächste Lektion antippen (Session Generator stellt ca. 14 Aufgaben zusammen [S, vb]).
2. **Erkennen:** „Select the correct image“, Audio + Wort, 4 Bildkarten. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/cb/ee/31/cbee31c9-a814-b59b-db16-3136ce60d20d/V2_iOS6.5_02.jpg/600x1300bb-60.jpg [G].
3. **Übersetzen mit Wortbank:** Satz der Figur, Antwortzeile, darunter Kacheln mit Ablenkern. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/c2/f5/5c/c2f55ce1-38da-64cc-a7ec-af549fd053e6/V2_iOS6.5_04.jpg/600x1300bb-60.jpg [G].
4. **Prüfen:** grüne/rote Leiste unten mit Lösung, ggf. Tippfehler-Hinweis [S, typo-tv].
5. **Ende:** XP, Serie. Bild: https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/37/b0/99/37b099cd-086d-b920-2ed3-0be6507353c4/V2_iOS6.5_06.jpg/600x1300bb-60.jpg [G].
6. **Practice Hub → Words / Mistakes:** Blog-Seite mit Bildern: https://blog.duolingo.com/guide-to-duolingo-practice-hub/ [G].

## 9. Nutzerstimmen

**Lob**
- [S, duo-as] App-Store-Nutzer: über zehn Jahre Spanisch, entwickle langsam ein Ohr für verschiedene Tempi und Stimmen.
- [S, duo-as] App-Store-Nutzer (Max, Deutsch): Video-Call merkt sich das letzte Gespräch und baut darauf auf; Erklärung am Ende „very helpful“.
- [S, duo-as] App-Store-Nutzer: Fehler am Lektionsende korrigieren zu können, sei gut.
- [S, wb-red] Reddit-Nutzer: Wortbank abschalten und tippen mache es „a lot harder but forces you to actually understand the sentences“.

**Klage**
- [S, 9to5] Testbericht: Auswahlfragen „way too easy“, oft am großgeschriebenen ersten Wort erkennbar.
- [S, duo-as] App-Store-Nutzer (Koreanisch): Auswahl nach Gehör, alle Optionen klingen gleich, Roboterstimme undeutlich.
- [S, drops-as] App-Store-Nutzer (in Drops-Bewertungen): nach über 2.000 Tagen Duolingo seit drei Jahren kein Fortschritt; Angst um die Serie lasse einen leichte Lektionen wiederholen.
- [S, typo-tv] Fan-Wiki: falsche Wortformen werden als Tippfehler durchgewunken.
- [S, duo-ai] Bezahlnutzer klagen 2025 über KI-erzeugte Inhalte.

## 10. Belege für die Wirkung

- **HLR (ACL 2016, begutachtet):** Vorhersagefehler um 45 %+ niedriger als Baselines [G, hlr]. **Wichtige Einordnung:** Im ersten A/B-Test (HLR gegen Leitner, ca. 1 Mio. Lerner, 6 Wochen) stieg die tägliche Rückkehr nur um +0,3 % (beliebige Aktivität) und +0,3 % (Lektionen), Übungssitzungen **sanken** um 7,3 %. Die oft zitierten +12 % stammen aus dem zweiten Test (HLR ohne Wortmerkmale gegen HLR, 3,3 Mio. Lerner, 2 Wochen), ebenso +1,7 % Lektionen und +9,5 % Übung [G, hlr]. Gemessen wurde Rückkehr am Folgetag, nicht Lernerfolg. Autoren sind Duolingo-Mitarbeiter.
- **Birdbrain:** A/B-Tests mit „Lern- und Engagement-Gewinnen“, ohne Zahlen [G, bb].
- **Jiang u. a. 2021 (Foreign Language Annals):** 225 US-Lernende, nur Duolingo, Lesen „Intermediate Low“, Hören „Novice High“, vergleichbar mit Studierenden nach vier Semestern [S, jiang]. Erstautorin ist Duolingo-Forscherin; eine Fachkritik bemängelt Auswahlverzerrung (sehr motivierte Nutzer) [S, callej].
- **Pichugin u. a. 2023:** 203 Studierende, 6 Wochen; Duolingo-Gruppe besser als Memrise und herkömmlicher Unterricht bei Wortschatz und Behalten [G, kfu]. Kleine, einzelne Hochschule.

## 11. Übertragbar auf Lingo-Engine X

- **Übernehmen: Gedächtnismodell je Wort aus Zählern und Zeit** (gesehen/richtig/falsch, Δ), als Grundidee mit Halbwertszeit. Wir haben FSRS; HLR zeigt, dass einfache Zähler reichen und robust gegen Überanpassung sind (Wortmerkmale verursachten „zu schnellen Verfall“).
- **Übernehmen: „Mistakes“-Wiederholung** (Fehler der letzten Tage gezielt erneut, in Paketen à 10). Passt zu Emrahs Wunsch, Wörter wirklich zu können.
- **Übernehmen: Stärke-Anzeige als Mittelwert der Erinnerungswahrscheinlichkeit** (z. B. je Thema/Kapitel), weil sie verständlich sinkt und zum Üben einlädt, ohne Punkte.
- **Verwerfen: Wortbank als Hauptform für Wörter.** Sie prüft Erkennen; Kritik „way too easy“ ist gut belegt. Bei uns nur als Einstiegsstufe.
- **Verwerfen: großzügige Tippfehler-Toleranz ohne Formprüfung.** Für C1 muss „falsche Form“ ≠ „Tippfehler“ sein (Lingvist-Ansatz: Lage und Art des Fehlers prüfen).
- **Vorsicht bei Wirkungszahlen:** „+12 %“ misst Rückkehr am Folgetag, nicht Lernerfolg; wir messen Behalten.

## Quellen

| Kürzel | URL | Status |
|---|---|---|
| hlr | https://aclanthology.org/P16-1174.pdf | abgerufen 30.10.2026 (PDF, Text extrahiert) |
| hlr-code | https://raw.githubusercontent.com/duolingo/halflife-regression/master/experiment.py | abgerufen 30.10.2026 (github.com-Seite selbst 403) |
| hlr-blog | https://blog.duolingo.com/how-we-learn-how-you-learn | abgerufen 30.10.2026 |
| bb | https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/ | abgerufen 30.10.2026 |
| ph | https://blog.duolingo.com/guide-to-duolingo-practice-hub/ | abgerufen 30.10.2026 |
| duo-as | https://apps.apple.com/us/app/duolingo-language-lessons/id570060128 | abgerufen 30.10.2026 (Bewertungen, Bilder) |
| drops-as | https://apps.apple.com/us/app/drops-language-learning-games/id939540371 | abgerufen 30.10.2026 (Duolingo-Vergleich in Drops-Bewertung) |
| kfu | https://www.frontiersin.org/journals/education/articles/10.3389/feduc.2023.1278541/pdf | abgerufen 30.10.2026 (PDF) |
| pp | https://blog.duolingo.com/covering-all-the-bases-duolingos-approach-to-speaking-skills | nur Suche |
| wb-red | https://reddit.birdcat.cafe/r/languagelearning/comments/vjyy3o/duolingo_isnt_bad_if_you_do_this | nur Suche (Reddit-Spiegel) |
| typelingo | https://addons.mozilla.org/firefox/addon/typelingo/ | nur Suche |
| typo-tv | https://www.tvtropes.org/pmwiki/pmwiki.php/VideoGame/Duolingo | nur Suche |
| typo-lemmy | https://lemmy.brendan.ie/comment/839411 | nur Suche |
| typo-red | https://redlib.belloworld.it/r/danishlanguage/comments/1966inm/am_i_missing_something_or_is_duo_off | nur Suche |
| wiki | https://duolingo.fandom.com/wiki/File:Strengthen-skills.png | nur Suche |
| jiang | https://experts.nau.edu/en/publications/evaluating-the-reading-and-listening-outcomes-of-beginning-level-/ | nur Suche |
| callej | https://callej.org/index.php/journal/article/download/419/347/1013 | nur Suche |
| ieee | https://spectrum.ieee.org/duolingo | Vorrecherche mara, nicht erneut abgerufen |
| vb | https://venturebeat.com/ai/how-duolingo-uses-ai-in-every-part-of-its-app | Vorrecherche mara, nicht erneut abgerufen |
| 9to5 | https://9to5mac.com/2022/02/02/duolingo-iphone-app-review/ | Vorrecherche mara, nicht erneut abgerufen |
| duo-ai | https://techcrunch.com/?p=3001162 | Vorrecherche mara, nicht erneut abgerufen |
| Bild duo-as-1, duo-as-2, duo-as-4 | siehe Bildliste Teil B (Duolingo Nr. 1, 2, 4) | geprüft 200 image/jpeg |
