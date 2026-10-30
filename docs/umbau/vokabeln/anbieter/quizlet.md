# Quizlet Learn – Vokabel-Steckbrief
Stand 30.10.2026 · V0a · Tiefe: groß

Kurzurteil: Quizlets Stärke ist der Modus „Learn“. Er wählt je Begriff die Frageform, macht die Fragen nach und nach schwerer (Auswahl → Tippen) und ordnet die Begriffe nach einem Vergessensmodell; bei Auswahlfragen rechnet er sogar das Raten heraus. Dazu kommen abgestufte Bewertungsregeln für getippte Antworten („Strict/Moderate/Relaxed“, „Smart grading“) und ein Knopf „I was correct“. Schwach ist alles, was über eine Lernsitzung hinausgeht: Die Langzeit-Planung ist kaum dokumentiert und steckt hinter der Bezahlschranke, Kontext und aktive Nutzung fehlen fast ganz. Für Emrah übertragbar sind die Rate-Korrektur bei Auswahlfragen, die steigende Frageform je Wort und die Bewertungsstufen für Tippfehler. Zu beachten: Quizlet selbst schaltet die Tippfehler-Hilfe bei Sprachinhalten bewusst ab.

**Hinweis zur Quellenlage:** help.quizlet.com, quizlet.com (Blog, Features) und der Technik-Blog auf Medium antworteten mit **403**, mit WebFetch und mit curl. Abrufen konnte ich das Quizlet-Forschungspapier auf arXiv und die App-Store-Seite. Fast alle Aussagen zur Bedienung sind deshalb [S].

Vorarbeit: mara-lernmethodik 2.14 (Lernweg, adaptive Frageform, „trickier questions“, Q-Chat) und 06-Marktvergleich (Bezahlschranke seit 01.08.2022, Memory Score in Plus). Hier folgt die Vertiefung.

## 1. Planung

### 1.1 Zwei Ebenen
- **Innerhalb einer Sitzung („Learn“):** Ein Modell sagt je Begriff die Abrufwahrscheinlichkeit voraus. Learn plant dann „greedy“ (der Reihe nach das jeweils Beste) die Begriffe, die am wahrscheinlichsten vergessen werden, unter weiteren, nicht genannten Bedingungen [G, [qz-paper]].
- **Über Tage („Spaced repetition“ in Karteikarten, Plus):** Man bewertet jede Karte selbst. „Okay“ bringt die Karte nach etwa einem Tag zurück, „Easy“ nach vier oder mehr Tagen. Man lernt, bis nichts mehr fällig ist. Das gibt es nur im Browser, mit Tagesbenachrichtigung um 10 Uhr Ortszeit und den Tasten 1–4 [S, [qz-sr]].
- Der genaue Algorithmus über Tage ist nicht veröffentlicht [S, [notelyn]] (Wettbewerber-Blog, schwache Quelle).

### 1.2 Das Vergessensmodell (Forschungspapier 2018)
- **Quelle:** Mooney, Sun, Bomgardner (Quizlet), „Predicting Recall Probability to Adaptively Prioritize Study“, vorgestellt beim NIPS-2017-Workshop „Teaching Machines“, Preprint auf arXiv [G, [qz-paper]].
- **Modell 1, MLR** (mehrfache logistische Regression) [G, [qz-paper]]. Merkmale:
  - Richtigkeit der letzten 6 Versuche,
  - log. Zeit seit den letzten 5 Versuchen,
  - Abstand der zwei jüngsten Versuche,
  - Anteil der Versuche in derselben Richtung,
  - Gesamtzahl der Versuche,
  - log. Zeit seit dem ersten Versuch.
- **Modell 2, RPL** („Recurrent Power Law“) [G, [qz-paper]]:
  - eine Potenz-Vergessenskurve je Begriff **und je Richtung**;
  - nach jedem Versuch springt die Abrufwahrscheinlichkeit auf 1, die Kurvenform passt sich dem Ergebnis an;
  - Schwierigkeits-Faktoren je Frageform und ein **Rate-Parameter**.
- **Rate-Korrektur:** Getippter Abruf gilt als „ohne Raten“. Bei Auswahl ist die Ratewahrscheinlichkeit 1/Zahl der Optionen, also 0,25 bei vier Antworten und 0,5 bei Richtig/Falsch. Eine richtige Auswahl-Antwort verändert den Zustand deshalb weniger [G, [qz-paper]].
- **Ergebnis:** RPL schlägt MLR deutlich im Modus Learn. Beide sagen erst ab zwei früheren Versuchen gut voraus; die erste Antwort auf einen Begriff ist kaum besser als Zufall [G, [qz-paper]].
- **Datenmenge:** MLR wurde mit ca. 1,5 Mio. Fragen aus dem Modus „Write“ trainiert. Ende 2017 hatte Quizlet über 30 Mrd. Antworten und 8 Mrd. Karteikarten [G, [qz-paper]].
- **Technik-Blog 2017:** RPL hat das MLR-Modell in Learn abgelöst, mit Offline-Unterstützung [S, [qz-mem]]. Ob es 2026 noch läuft, ist nicht belegt [nicht belegt gefunden].

### 1.3 Geschwister, Fuzz, Lastausgleich
- **Richtungen:** RPL führt je Begriff und Richtung eine eigene Kurve [G, [qz-paper]]. Begriff → Definition und Definition → Begriff sind also getrennte Zustände.
- **Fuzz und Lastausgleich:** nicht belegt gefunden.
- **Sperre für Geschwister** (beide Richtungen am selben Tag): nicht belegt gefunden.

### 1.4 Tageslimit, Rückstand, Problemwörter
- **Tageslimit:** keins belegt. Learn arbeitet ein Set ab, nicht eine Tageswarteschlange [S, [qz-help-learn]].
- **Kostenlos** nur eine begrenzte Zahl von Learn-Runden je Set [S, [qz-help-learn]]. Eine Quelle nennt 5 Runden [S, [mebuddy]] (nur eine Quelle).
- **Rückstand nach Pause:** In Learn werden früher schwierige Karten zuerst gezeigt, Zeit seit dem letzten Versuch und Schwierigkeit zählen [S, [notelyn]]. Im Plus-Modus erscheinen alle fälligen Karten bis „nichts mehr fällig“ [S, [qz-sr]].
- **Problemwörter:** In „Write“ kommen falsch getippte Begriffe wieder, bis alle richtig sind [G, [qz-paper]]. Eine Leech-Regel wie bei Anki ist nicht belegt.
- **Nur markierte Begriffe:** Learn kann auf „starred terms“ beschränkt werden [S, [qz-help-learn]].

## 2. Abfrage-Leiter
- **Frageformen in Learn:** getippter Abruf („written“), Auswahl („multiple choice“), Richtig/Falsch, selbstbewertete Karteikarte („know / don't know“) [G, [qz-paper]], [S, [qz-help-learn]]. Der Nutzer kann Frageformen abwählen [S, [qz-help-learn]].
- **Leiter:** Die Fragen werden mit dem Fortschritt schwerer, von Auswahl hin zu getippten Antworten [S, [qz-help-learn]], [S, Schul-Handout über Suche]. Laut Technik-Blog wählt Learn die Form je Begriff adaptiv, nach dem Prinzip „schwer, aber lösbar“ [S, [qz-format]] (mara 2.14).
- **Stufen sichtbar:** In der Web-Fassung von Learn zeigt eine Seitenleiste, wie viele Begriffe „New“, „Seen“, „Familiar“ und „Mastered“ sind [S, [qz-newlearn]].
- **Schwellen:** „Familiar“ nach einer richtigen Antwort, „Mastered“ nach zwei [S, Schul-Handout und [notelyn]]. Keine offizielle Quelle; die Angaben sind widersprüchlich formuliert.
- **Ende:** Learn ist fertig, wenn jeder Begriff zweimal hintereinander richtig war [S, Quizlet-Leitfaden laut Suche], [S, [unc]].
- **„Trickier questions“:** umformulierte Definitionen prüfen, ob man das Konzept versteht und nicht nur den Wortlaut [S, [qz-trick]] (mara 2.14).
- **Weitere Modi** (keine Leiter, frei wählbar): Flashcards mit Wischen „weiß ich / weiß ich nicht“, Test, Match, „Write“, „Spell“ (Hören und Schreiben) [S, App-Store-Rezension in [as-qz]], [S, [bendigo]].
- **Vom Erkennen zum Benutzen:** endet beim getippten Abruf des Begriffs. Ein Satz mit dem Zielwort ist nicht vorgesehen [nicht belegt gefunden].

## 3. Bewertung
- **Automatisch** in Learn, Write und Test; **selbst** in Flashcards und im Plus-Planer [G, [qz-paper]], [S, [qz-sr]].
- **Bewertungsstufen für getippte Antworten** („Grading options“, in Learn unter Optionen) [S, [qz-grade]]:
  - **Strict:** exakte Übereinstimmung, nur Kleinigkeiten wie Groß/Klein oder Satzzeichen erlaubt. Immer verfügbar. **Standard, wenn das Set auf beiden Seiten verschiedene Sprachen hat**, also bei Sprachsets.
  - **Moderate:** exakt, aber kleine Rechtschreibfehler erlaubt, etwa fehlende Akzente oder fehlende Buchstaben.
  - **Relaxed:** genaue Toleranz nicht belegt gefunden.
  - Verfügbar für Sets ab 3 Karten, deren Begriffe und Definitionen Englisch, Französisch, Deutsch oder Spanisch sind.
- **„Smart grading“** (Plus): Mit Sprachverarbeitung (NLP) erkennt Quizlet die Bedeutung der Antwort und gibt Punkte für das verstandene Konzept, nicht für den Wortlaut. Synonyme, Umformulierungen und Tippfehler gelten als richtig [S, [qz-grade]], [S, [qz-smart]].
- **„Typo Help“** (kostenlos): Quizlet hat sie **für Sprachlern-Inhalte abgeschaltet**, weil Lerner dort buchstabengenau üben sollen [S, [qz-smart]].
- **„Override: I was correct“:** Der Lerner kann eine als falsch gewertete Antwort selbst als richtig markieren. Typo Help und Smart Grading senkten die Zahl solcher Overrides laut Quizlet um 50 % oder mehr [S, [qz-smart]], laut Anbieter. Eine Design-Fallstudie nennt 53 % [S, [qz-case]] (Portfolio, schwach).
- **Rolle der Zeit:** Das Papier nutzt Zeit seit Versuchen, aber keine Antwortdauer [G, [qz-paper]]. Antwortzeit als Bewertungsmerkmal ist nicht belegt.
- **Hinweise:** nicht belegt gefunden.
- **„Fast richtig“:** hängt an der gewählten Stufe. Bei „Strict“ ist es falsch, bei „Moderate“ zählen kleine Tippfehler als richtig, mit Smart Grading auch Synonyme. Bleibt ein Rest, entscheidet der Lerner per Override [S, [qz-grade]], [S, [qz-smart]].

## 4. Rückmeldung
- **Nach falsch:** die richtige Antwort; man kann sie neu tippen [S, [qz-help]] (mara 2.14). Im Papier heißt es: „Incorrect answers are followed by feedback“ [G, [qz-paper]].
- **Audio:** Learn hat Audio-Einstellungen [S, [qz-help-learn]]. Bei „Spell“ hört man das Wort und tippt es [S, [bendigo]].
- **Erklärung:** Mit dem KI-Tutor Q-Chat (2023) gab es Erklärungen im Gespräch; er wurde laut Drittquellen zum 30.06.2025 eingestellt [S, [qchat]]. Nachfolger sollen KI-Funktionen in Learn sein [S, [aitools]] (schwache Quelle).
- **Kollokationen, Beispielsätze:** nur, wenn der Ersteller sie in die Karte schreibt [Vermutung].

## 5. Kontext
- **Feste Karten:** Begriff und Definition, wie der Ersteller sie anlegt. Wechselnde Sätze gibt es nicht [Vermutung, kein Gegenbeleg gefunden].
- **Gedächtniszustand je Begriff und Richtung**, nicht je Satz [G, [qz-paper]].
- **„Trickier questions“** ändern die Formulierung der Definition. Das ist die einzige belegte Form von wechselndem Kontext [S, [qz-trick]].

## 6. Aktive Nutzung
- **Eigene Sätze, Schreiben, Sprechen** mit Zielwörtern: nicht belegt gefunden. Mit Q-Chat war ein Gespräch über das Set möglich, aber er ist eingestellt [S, [qchat]].
- **Getippter Abruf** ist die aktivste Stufe [G, [qz-paper]].

## 7. Fortschritt und Transparenz
- **Learn-Seitenleiste:** New / Seen / Familiar / Mastered [S, [qz-newlearn]].
- **„Memory Score“** (2023): Aus den Antworten beim Sortieren in „weiß ich / weiß ich nicht“ wird ein persönlicher Wert. Fällige Wiederholungen heben ihn. Eine Formel ist nicht veröffentlicht [S, [qz-memscore]].
- **Lernweg zurücksetzen:** im Hilfe-Center beschrieben [S, [qz-reset]].
- **Lastvorschau, Behaltensrate, aktiv vs. passiv:** nicht belegt gefunden.
- **Größe laut Anbieter:** über 60 Mio. Nutzer, „2 von 3 Highschool-Schülern“ [G, [as-qz]], laut Anbieter. App-Store-Wertung 4,8 bei 1.138.114 Bewertungen (US) [G, [as-qz]].

## 8. Bildschirmablauf
Nach Hilfe-Ausschnitten und Rezensionen; eigene Sicht auf die Web-App war nicht möglich (403):
1. **Set öffnen** und Modus „Learn“ wählen. Optional unter „Options“: Frageformen, nur markierte Begriffe, Audio, Bewertungsstufe [S, [qz-help-learn]], [S, [qz-grade]].
2. **Ziel und Vertrautheit:** Learn baut daraus einen persönlichen Lernweg [S, [qz-help-learn]].
3. **Erste Fragen meist als Auswahl** (4 Antworten oder Richtig/Falsch) [S, [qz-help-learn]].
4. **Antwort tippen oder antippen.** Bei Fehler erscheint die Lösung; man kann sie neu tippen. Bei getippter Antwort gibt es den Knopf „I was correct“ [S, [qz-smart]], [S, [qz-help]].
5. **Später getippte Fragen** für Begriffe, die schon „Familiar“ sind [S].
6. **Fortschrittsleiste** und Seitenleiste mit New/Seen/Familiar/Mastered [S, [qz-newlearn]].
7. **Rundenende / Set fertig**, wenn alles zweimal richtig war [S, [unc]].
- App-Store-Bilder (Werbebilder, Inhalt nicht einzeln geprüft) und ein Vergleichsbild: siehe `scratchpad/bild/teil-a.md`.

## 9. Nutzerstimmen
**Lob**
- Ein US-App-Store-Rezensent: „This helps me a lot to remember words.“ Er rät, zuerst die Karteikarten nach „Know/Don't know“ zu sortieren [S, [as-qz]].
- Eine Schülerin im ersten Jahr wäre vor den Prüfungen „gestresst ohne Ende“ ohne Quizlet und will Plus kaufen [S, [as-qz]].
- Ein Trustpilot-Rezensent nennt Quizlet die beste Karteikarten-Plattform, „ein bisschen teuer“ [S, [tp-qz]].
- In Rezensions-Sammlungen gilt Quizlet weiter als nützlich zum Auswendiglernen [S, [kimola-qz]].

**Klage**
- Learn sei nett, aber man müsse zahlen, „slightly aggravating“ [S, [as-qz]]. Ein Trustpilot-Nutzer klagt, sogar Learn sei hinter der Bezahlschranke [S, [tp-qz]].
- Kostenlos nur wenige Learn-Runden; eine Quelle sagt, 5 Runden reichen für ein Set mit 50 Karten nicht [S, [mebuddy]].
- Ein blinder Nutzer schreibt, Quizlet sei mit Bildschirmleser auf keiner Plattform zugänglich [S, [as-qz]].
- Auf Trustpilot liegt Quizlet bei etwa 1,4 von 5 (über 500 Bewertungen). Der Blog erklärt das mit dem Wegfall früher kostenloser Funktionen [S, [mebuddy]].

## 10. Belege für die Wirkung
- **Quizlet-Papier 2018** [G, [qz-paper]]: Es misst nur, **wie gut das Modell Abruf vorhersagt** (AUC, nur als Grafik). Lernergebnisse oder A/B-Tests zur Lernwirkung gibt es nicht. Workshop-Beitrag, kein volles Peer-Review, Autoren sind Quizlet-Angestellte.
- **Overrides −50 %** durch Smart Grading und Typo Help: laut Anbieter, ohne Methodik [S, [qz-smart]]. Gemessen wird Zufriedenheit mit der Bewertung, nicht Lernen.
- **Dizon 2016** (Teaching English with Technology 16(2)): 9 japanische Studierende lernen 10 Wochen die Academic Word List mit Quizlet. Signifikanter Zuwachs von Vor- zu Nachtest, positive Einstellung [S, [dizon]]. Sehr kleine Stichprobe, keine Kontrollgruppe.
- **Ho & Kawaguchi:** Quizlet und Papierkarten verbessern beide den Wortschatz, Quizlet etwas mehr [S, [dizon]]. **Lees 2014:** gleich wirksam, aber nur eine 90-Minuten-Stunde [S, [dizon]].
- **„90 % der Schüler mit besseren Noten“:** Diese Werbeaussage fand ich nicht belegt [nicht belegt gefunden].
- *Gesamtbild:* Es gibt keine unabhängige Studie zu Learn als adaptivem System. Die Studien messen „Quizlet benutzen“ gegen Papier oder nichts.

## 11. Übertragbar auf Lingo-Engine X
- **Rate-Korrektur übernehmen:** Eine richtige Auswahl-Antwort zählt weniger als ein getippter Abruf, z. B. über eine Ratewahrscheinlichkeit von 1/Zahl der Optionen. Grund: Emrahs Klage „ich rate“; so steigt ein Wort nicht durch Glückstreffer auf.
- **Frageform je Wort nach Zustand wählen:** neu → Auswahl, ab „vertraut“ → getippt, Lücke im Satz. Grund: Quizlet und Anki zusammen zeigen: Auswahl ist Einstieg, Tippen ist Beweis.
- **Zustand je Richtung führen** (Englisch → Deutsch getrennt von Deutsch → Englisch). Grund: Das RPL-Modell tut es, und Erkennen ist nicht gleich Abrufen.
- **Bewertungsstufen anpassen:** Standard „streng“ für die Schreibweise des Zielworts; kleine Tippfehler werden erkannt und gezeigt, kosten aber Note. Bedeutung (Synonym) per KI nur bei offenen Satzaufgaben. Grund: Quizlet schaltet Tippfehler-Hilfe bei Sprachinhalten ab; bei C1 zählt die Form.
- **„Ich hatte recht“-Knopf anpassen:** nur mit Begründung und mit Gegenprüfung durch Claude, nicht als freie Selbstbewertung. Grund: Der Knopf ist ein Ventil gegen falsche Automatik, darf aber A7 (keine Selbstbewertung) nicht aushebeln.
- **„Zweimal richtig in Folge“ als Sitzungsende verwerfen:** Gedächtnis entsteht über Tage. Grund: Quizlets eigener Befund, die ersten Antworten sagen wenig voraus.
- **Sichtbare Stufen New/Seen/Familiar/Mastered anpassen:** Bei uns mit Abstand gekoppelt („fest“ erst nach ≥ 21 Tagen, wort-fest-plan). Grund: Quizlets „Mastered“ nach zwei Treffern in einer Sitzung bläht die Zahl auf.

## Quellen
- [qz-paper] → https://arxiv.org/abs/1803.00111 und https://ar5iv.labs.arxiv.org/html/1803.00111 · abgerufen 30.10.2026
- [qz-help-learn] → https://help.quizlet.com/hc/en-us/articles/360030986971-Studying-with-Learn · gesperrt 403 (nur Suche)
- [qz-help] → https://help.quizlet.com/hc/en-us/articles/360030841732-Studying-on-Quizlet · gesperrt 403 (nur Suche)
- [qz-grade] → https://help.quizlet.com/hc/en-ca/articles/360048313652-Using-grading-options und https://help.quizlet.com/hc/en-au/articles/360031170512-Changing-grading-settings · gesperrt 403 (nur Suche)
- [qz-sr] → https://help.quizlet.com/hc/en-au/articles/48324742264077-Studying-with-Spaced-Repetition · nur Suche
- [qz-reset] → https://help.quizlet.com/hc/en-us/articles/360048806511-Resetting-study-path-progress · nur Suche
- [qz-smart] → https://medium.com/tech-quizlet/how-quizlet-does-smarter-grading-using-ml-and-nlp-to-grade-millions-of-answers-86514323e332 · nur Suche (Medium 403)
- [qz-format] → https://medium.com/tech-quizlet/selecting-question-formats-to-maximize-the-testing-effect-7917226a2667 · gesperrt 403
- [qz-trick] → https://medium.com/tech-quizlet/how-quizlet-creates-trickier-questions-313317a6f47f · nur Suche
- [qz-mem] → https://medium.com/tech-quizlet/improving-learn-ing-quizlets-new-memory-model-3c2271e5eaf4 · nur Suche
- [qz-newlearn] → https://quizlet.com/blog/introducing-the-new-learn-on-web · gesperrt 403 (nur Suche)
- [qz-memscore] → https://www.educatorstechnology.com/2023/10/quizlets-latest-back-to-school-features.html · nur Suche
- [qz-case] → https://violin-flower-fm26.squarespace.com/our-work/iduma-website-xyrhn-8ffnc-rbext-5tr9b-p6klk · nur Suche
- [qchat] → https://quizgecko.com/de/blog/best-q-chat-alternative · nur Suche (Wettbewerber-Blog)
- [aitools] → https://aitoolsatlas.ai/tools/quizlet-ai · nur Suche
- [notelyn] → https://www.notelyn.com/blog/quizlet-spaced-repetition · abgerufen 30.10.2026 (Wettbewerber-Blog, nennt keine Quizlet-Primärquelle)
- [unc] → https://writingcenter.unc.edu/2020/10/studying-with-quizlet · nur Suche
- [bendigo] → https://bendigomandarin.weebly.com/uploads/1/2/4/6/12460518/quizlet___weebly_instruction.pdf · nur Suche
- [as-qz] → https://apps.apple.com/us/app/id546473125 · abgerufen 30.10.2026 (Store-Seite mit Rezensionen)
- [tp-qz] → https://ca.trustpilot.com/review/www.quizlet.com · nur Suche
- [kimola-qz] → https://kimola.com/reports/quizlet-new-paid-features-subscription-model-147390 · nur Suche
- [mebuddy] → https://www.myengineeringbuddy.com/blog/quizlet-reviews-alternatives-pricing-offerings/ · nur Suche
- [dizon] → https://ceeol.com/search/article-detail?id=408428 · nur Suche
