# 06 – Marktvergleich und Wissensbasis (Stand 04.10.2026)

Baustein für das Gesamtkonzept (Fokus: Wortschatz + Grammatik, Ziel ca. 8.000 C1-Wörter). Nur Recherche, kein Code geändert. Das Rechenskript für die Last-Modelle lag im Scratchpad, nicht im Repository.

**Prüfstatus jeder Aussage (Kürzel in eckigen Klammern):**
- **[G]** Quelle selbst abgerufen und gelesen.
- **[S]** Sekundärquelle oder Zusammenfassung eines Suchtreffers, Seite selbst nicht abrufbar. Wettbewerber-Blogs sind zusätzlich als „tendenziös“ markiert.
- **[U]** aus Wissen, ungeprüft.
- **[E]** eigene Einschätzung oder eigene Rechnung.

Das Netz war erreichbar. Gesperrt (403/404/503) waren u. a. englishprofile.org (EGP/EVP-Seiten), Oxford Learner's Dictionaries, Quizlet-Blog, Memrise-Hilfe, G2, ResearchGate. Betroffene Aussagen stehen deshalb als [S] oder [U] da.

---

## 0. Kurzfassung

1. **Die Besten trennen drei Dinge:** unsichtbarer Planer (FSRS-artig), viele Aufgabenformen je Wort, ein verständliches Fortschrittsbild. Große Einstellungsflächen gibt es praktisch nur bei Anki, und das ist dort ein Hauptkritikpunkt.
2. **„8.000 Wörter für C1“ ist keine CEFR-Vorgabe.** Es ist Nations Schwelle für 98 % Textabdeckung beim Lesen: 8.000–9.000 Wortfamilien, rezeptiv [G]. Cambridge führte im Vokabelprofil (Stand des Aufsatzes 2012) für alle sechs Stufen zusammen nur 6.970 Headwords [G]. C1-Prüflinge kennen 3.750–4.500 der 5.000 häufigsten Lemmata [G].
3. **Aktiv trainierbar sind etwa 4–5 neue Einträge pro Tag.** Das kostet im 1. Jahr 8–19 Min./Tag, im 3. Jahr 11–31 Min./Tag [E, Modell, Abschnitt 3.3]. 8.000 in 3 Jahren (8 neu/Tag) wären im 3. Jahr 22 bis 50 Min./Tag.
4. **Freie Listen tragen rund 5.500 Lemmata** (NGSL + NAWL + BSL, alle CC BY-SA 4.0) **plus rund 2.100 Zeilen C1/C2** (Octanove, CC BY-SA 4.0). Bedeutung, Sätze, Wortpartner, Phrasal Verbs und Idiome müssen selbst erzeugt werden. EVP, Oxford 3000/5000 und das English Grammar Profile sind nicht frei nutzbar (EGP nur nicht-kommerziell).
5. **Neu gegenüber `docs/wortschatz-plan.md`:** „aktiv ~1.500–2.000 Einheiten“ ist durch keine geprüfte Quelle belegt (mit den Zahlen aber vereinbar). Der Aktiv-Anteil sollte ein messbarer Parameter werden, nicht eine Annahme (Abschnitt 3.4).

---

## 1. Die 8 Produkte

**Auswahl:** Anki (FSRS), Clozemaster, Lingvist, Vocabulary.com, Duolingo, Babbel, Memrise, Quizlet. Gewählt nach Nähe zu Wortschatz + Grammatik und nach Lerntiefe. Busuu fehlt bewusst: Wiederholung und Grammatik-Review ähneln Babbel, der Inhalt endet laut Anbieterprofil bei B2 [U].

### Tabelle A: Einstieg, Tag, Abfrage

| Produkt | Einstufung / Onboarding | Tagesablauf | Abfrage-UX (Bewertung, Feedback) |
|---|---|---|---|
| **Anki** (FSRS) | Keine. Decks, Limits und Kartenarten richtet der Nutzer selbst ein [E]. | Deckliste mit Neu/Lernen/Fällig, Tageslimits (Standard 20 neu / 200 Wiederholungen [U]), am Ende eine Abschlussmeldung [G, [Handbuch Lernen][anki-study]]. | Aufdecken, dann Nochmal/Schwer/Gut/Leicht, jeder Knopf zeigt den nächsten Termin. Handbuch: „Gut“ in 80–95 % der Fälle, „Nochmal“ in 5–20 %; wer mit vier Knöpfen hadert, nutzt nur Nochmal/Gut [G]. Feedback ist das eigene Urteil. Planer FSRS mit Ziel-Behaltensquote 90 % [G, [Deck-Optionen][anki-deck]], FSRS-6 seit Anki 25.07 [S, [Release-Hinweis][anki-rel]]. |
| **Clozemaster** | Sprache und Sammlung wählen (z. B. „Fluency Fast Track“ nach Häufigkeit); kein Einstufungstest bekannt [S, [Rezension][cloze-rev]]. | Runden aus Lückensätzen (Tatoeba-Sätze, das seltenste Wort ist die Lücke [S]); Punkte und Level. | Lücke antippen oder tippen. Beherrschung je Satz 0/25/50/75/100 % mit offenen Abständen (gleicher Tag, 1, 10, 30, 180 Tage); 4 richtige Antworten in Folge nötig [G, [Clozemaster-Hilfe][cloze]]. |
| **Lingvist** | Einstufung gleich zu Beginn: Die KI ordnet laut Anbieter dem passenden Niveau zu [G, [Startseite][lingvist]]. | Häufigste Wörter zuerst (laut Anbieter 80 % alltäglicher Situationen), Karten mit Beispielsatz und Grammatikinfo, Lücken zum Ausfüllen, Spaced Repetition [G]. | Antwort tippen, automatische Bewertung, kein Selbsturteil [E]. Abo mit Probezeit [G]. |
| **Vocabulary.com** | Adaptive Engine mit Rechenmodell je Lerner, misst ab der ersten Antwort [G, [Science of Vocabulary][vocab]]; Item-Response-Theorie laut Anbieter-PDF [S]. | Runden mit zehn Fragetypen; Ziel-Wörter sind „Reach Words“ (sollte man kennen, kennt man nicht) [G]. | Fragen werden bei Erfolg schwerer; Abstände aus Wissenswert, Konfidenz und Aktualität [G]. Automatische Bewertung. |
| **Duolingo** | Ziele plus optionaler Einstufungstest [U]. | Pfad aus kurzen Lektionen, XP, Streak, Ligen. | Automatische Bewertung. „Birdbrain“ schätzt Aufgabenschwierigkeit und Können und wählt „genau richtig schwere“ Aufgaben (2020 schon >20 % der Lektionen) [G, [Blog][birdbrain]]. Wiederholungsmodell HLR: −45 % Fehler gegenüber Leitner/Pimsleur, +12 % tägliche Nutzung im Test [G, [Paper][hlr]]. |
| **Babbel** | Ziel und Niveau wählen [U]. | Lektionen von etwa 6 Minuten; Wiederholen heißt Vokabeltrainer mit Spaced Repetition [G, [Methode][babbel]]. | Fehler werden gemerkt und später wieder vorgelegt, am Lektionsende ein Fehler-Durchgang [G]. |
| **Memrise** | Kurswahl; offizielle Kurse für 35 Sprachen [G, [Wikipedia][memrise]]. | Lernen und Wiederholen (Spaced Repetition), Videoclips von Muttersprachlern, KI-Gesprächspartner (GPT-3-basiert, seit 2023) [G/S]. | Spaced Repetition. Die Merkhilfen („Mems“) sind seit 09/2022 entfernt, Nutzerkurse seit 02/2024 nur noch auf separater Website [G]. |
| **Quizlet** | Keine; Lernsets. | Lernmodus mit Runden; „Memory Score“ und geplante Wiederholung nur in Plus [S, [Test][quizlet-ml]]. | Ein ML-Modell sortiert Begriffe innerhalb einer Sitzung nach vorhergesagter Erinnerung [S]. Lern- und Testmodus seit 01.08.2022 hinter Bezahlschranke (35,99 $/Jahr) [G, [Kommentar][quizlet-pay]]. |

### Tabelle B: Grammatik, Fortschritt, Motivation, „kommerzieller“ Eindruck

| Produkt | Grammatik (Erklärung + Übung) | Fortschrittsanzeige | Motivation: erwachsen oder kindlich? | Was „kommerziell“ wirkt [E] |
|---|---|---|---|---|
| **Anki** | Keine eigene; Nutzer baut Lückenkarten [E]. | Statistik mit Prognose, Behaltensquote, Heatmap [U]. | Keine Mechanik, neutral. | Tempo und volle Kontrolle; Oberfläche gilt als veraltet [S, [G2][g2-anki]]. |
| **Clozemaster** | „Grammar Challenges“: Satzgruppen zu einem Konzept, ohne Regeltext [S]. | Beherrschung in % je Satz, Punkte, Level [G/S]. | Punkte, Rangliste; schlicht, „retro“ [S]. | Klare Idee („Lücke im echten Satz“), aber schlichte Optik. |
| **Lingvist** | Grammatikinfo auf der Karte [G], keine eigene Lektion [U]. | Zahl gelernter Wörter, Abdeckung häufiger Wörter [U]. | Ruhig, erwachsen [E]. | Ein Ziel, eine Fähigkeit, sehr direkt, Einstufung am Anfang. |
| **Vocabulary.com** | Keine (reiner Wortschatz) [E]. | Reife je Wort 0–100 %, „sinkt nie“ [G]. | Punkte und Abzeichen, nüchtern [U]. | Inhaltsqualität (verständliche Definitionen, echte Beispiele), nachvollziehbare Skala. |
| **Duolingo** | Kurze Hinweise vor Lektionen; Tiefe wird vermisst [G, [Oulu 2025][oulu], [IJOEP 2025][ijoep]]; in der App fehlten Erklärungen zeitweise ganz [S, [Loewen 2019][loewen]]. | Pfad, Serie, XP. | Streak wirkt, Ligen und Soziales stressen manche; Wunsch nach abschaltbaren Spielelementen [G, Oulu]. Maskottchen wirkt kindlich [E]. | Politur: Animation, Ton, sofortige Reaktion, lernende Auswahl. |
| **Babbel** | Regel im Kontext, dann Übung, Mini-Dialoge [G]. | Lektionsfortschritt [U]. | Kaum Spielmechanik, erwachsener Ton [E]. | Redaktionelle Qualität, feste Struktur (neues Wort, Übung, Dialog, Wiederholen). |
| **Memrise** | „Grammar Buddy“ (KI, 2025) [S]. | Gelernte Wörter [U]. | Verspielt (Videos, Humor) [S]. | Echte Sprecher wirken lebendig; Funktionsabbau verärgert [G, Wikipedia]. |
| **Quizlet** | Nur selbst erstellte Sets [E]. | Lernpfad, Memory Score (Plus) [S]. | Neutral, schülernah [E]. | Verbreitung und viele Modi; die Bezahlschranke kostet Vertrauen [G, Kommentar]. |

---

## 2. Zehn übertragbare Muster und fünf Fallen

Jedes Muster nennt den Beleg und den Bezug zur bestehenden App (laut CLAUDE.md A7, Code nicht neu gelesen).

**M1 – Ein Tag = eine Warteschlange, ein Knopf, ein sichtbares Ende.** Heute zeigt „n Karten, ca. m Minuten“ und einen Start-Knopf. Am Ende steht ein Abschluss-Bild: „Fertig für heute, morgen ca. x Wiederholungen, +y Wörter fest“. *Beleg:* Anki zeigt bei leerem Stapel eine Abschlussmeldung [G, [anki-study][anki-study]]; Babbel-Einheiten dauern ca. 6 Minuten [G, [babbel][babbel]]. *App:* Heute-Knopf vorhanden; Abschluss mit Morgen-Vorschau prüfen.

**M2 – Die App bewertet, nicht der Nutzer.** Note aus richtig/falsch, Antwortzeit und Hilfe; Vier-Knöpfe-Modus nur als Wahl. *Beleg:* Das Anki-Handbuch erlaubt, nur Nochmal/Gut zu nutzen [G]; das Duolingo-Wiederholungsmodell HLR arbeitet nur mit Zählern (gesehen, richtig, falsch), Abstand und Wort-Kennung und steigerte die tägliche Nutzung um 12 % [G, [hlr][hlr]]; Lernende sagten in allen Gruppen ca. 50 % Behalten voraus, tatsächlich wurden es 80 % bzw. 33–36 % [G, [Karpicke & Roediger 2008][karpicke]]. Das Selbsturteil über das spätere Behalten war in diesem Versuch also kein verlässliches Signal. *App:* Auto-Note seit 26.09.; der Anki-Modus ist die bewusste Ausnahme.

**M3 – FSRS mit genau einem Regler: Ziel-Behaltensquote plus Last in Minuten.** „Entspannt 85 / Standard 90 / Intensiv 95 %“, daneben die erwartete Tageszeit. *Beleg:* Standard 90 %, unter 97 % bleiben; Handbuch: „As desired retention approaches 100%, the workload increases drastically“ [G, [anki-deck][anki-deck]]. Eigene Rechnung (10 neu/Tag, nach 1 Jahr): 95 % kostet +43 % Durchgänge gegenüber 90 %, 85 % spart 10 %, 80 % spart 17 % [E]. FSRS-Benchmark: ca. 727 Mio. Wiederholungen von 10.000 Nutzern [G, [srs-benchmark][srs-bench]]. *App:* Regler statt Parameter-Menü.

**M4 – Zufluss nach Kapazität, weicher Wiedereinstieg.** Neue Wörter nur, wenn Zeit im Budget ist. Nach einer Pause kommen die ältesten zuerst, der Rest verteilt sich, ohne rote Zahl. *Beleg:* Anki-Handbuch: bei Rückstand zuerst die am längsten wartenden Karten, nach Pausen muss man nicht von vorn beginnen [G]; als häufigster Abbruchgrund gilt der Rückstand [S, tendenziös: [Blog 1][burnout1], [Blog 2][burnout2]]; im Modell verlangt das Wiederholen nach 1 Jahr das 10- bis 14-Fache der täglich neuen Karten (Abschnitt 3.3) [E]. *App:* `capacityNew` und Aufholmodus vorhanden.

**M5 – Immer im Satz; jede Karte in mehreren Abfrageformen entlang einer Reifeleiter.** Erkennen, dann Lückensatz mit Auswahl, dann Lücke tippen, dann eigener Satz; Beispielsätze wechseln. *Beleg:* Lingvist: jede Karte mit Beispielsatz und Grammatikinfo [G, [lingvist][lingvist]]; Vocabulary.com: zehn Fragetypen, schwerere Fragen nach Erfolg [G, [vocab][vocab]]; produktives Wissen liegt unter dem rezeptiven (Quotient 88/73/65 % in den 1.000er/2.000er/3.000er-Bändern [S, [Webb 2008][webb08]]), Tippen gehört also in die Leiter. *App:* Stufen und Abfragearten vorhanden.

**M6 – Fortschritt = Reife je Wort plus ehrliche Gesamtzahl.** Je Wort 0–100 % „Reife“, die nie sinkt (wie Vocabulary.com [G]), mit offenen Abständen (Clozemaster: 0/1/10/30/180 Tage [G]). Gesamt: „erwartet gekonnt“ (Summe der Abrufwahrscheinlichkeiten) und „fest“ (Stabilität ≥ 21 Tage), Zielkatalog als Nenner. *App:* Aktiv fest / Übt / Erwartet gekonnt vorhanden; Reifeanzeige je Wort prüfen.

**M7 – Fehler sind Material.** Feedback in drei Zeilen (richtig/falsch, warum, Merkbeispiel), nach einer anderen Karte ein zweiter Versuch, Problemwörter (ab 3 Fehlern) bekommen eine Rettungsrunde (Eselsbrücke, Kontrast, neuer Satz) statt Dauerschleife. *Beleg:* Babbel merkt Fehler und legt sie wieder vor [G, [babbel][babbel]]; Wiederabruf schlägt Nachlesen deutlich (80 % gegen 33–36 % nach einer Woche, 40 Wortpaare) [G, [karpicke][karpicke]]. *App:* Reparatur-Sätze und Dauerfehler-Automatik vorhanden.

**M8 – Kalibrieren statt langweilen.** Eine Ja/Nein-Wortprobe über Frequenzbänder (3–5 Minuten) markiert Bekanntes und schätzt das Startniveau; danach wählt ein Lernermodell „genau richtig schwere“ Aufgaben. *Beleg:* Lingvist stuft am Anfang ein [G]; Duolingo Birdbrain wählt adaptiv [G], Vocabulary.com ebenfalls (laut Anbieter IRT-basiert [S]); XLex-Checklisten schätzen die Größe aus den 5.000 häufigsten Lemmata [G, [Milton 2010][milton10]]. *App:* Vokabeltest (`vtest`) existiert; prüfen, ob er „bekannt“ je Eintrag schreibt.

**M9 – Grammatik als Mikro-Einheit.** Regel in höchstens 40 Wörtern, Kontrastpaar, sofort selbst bilden; danach verteilt mit neuen Sätzen wiederholen; Lehrplan als Kann-Aussagen (EGP-Stil, Abschnitt 5). *Beleg:* Babbel erklärt Regeln im Kontext und übt Wendungen mit Spaced Repetition [G]; Lernende vermissen bei Duolingo Tiefe [G, [IJOEP][ijoep], [Oulu][oulu]]; Clozemaster bündelt Sätze je Konzept ohne Regel [S]. *App:* Grammatik und Satzbau vorhanden.

**M10 – Ruhige Motivation, präzises Handwerk.** Serie mit Ruhetag und Wiedereinstieg, Wochenbericht in Worten („+31 Wörter fest, 88 % Trefferquote“), Meilensteine; keine Ligen, Herzen oder Maskottchen. Sofortige Reaktion, ruhige Mikro-Animation, gestaltete Leer- und Fehlerzustände, immer dieselbe Aufgabenzeile oben [E]. *Beleg:* Streak war der wirksamste Motivator, doch Befragte bezweifelten, dass eine hohe Serie besseres Verständnis anzeigt; soziale Funktionen stressen manche; Wunsch nach abschaltbaren Spielelementen, schwereren Aufgaben, Überspringen von Leichtem [G, [Oulu 2025][oulu], kleine Umfrage]. *App:* Serie mit Ruhetag vorhanden.

### Fünf Fallen (abgeleitet aus der Kritik, Abschnitt 6)

1. **Spiel statt Lernen.** Druck-Mechaniken (Ligen, Herzen, Serien ohne Gnade) ersetzen Lernwirkung [G, Oulu].
2. **Unbegrenzte Last.** Ohne Deckel und weichen Wiedereinstieg wird der Rückstand zum Abbruchgrund [G/S, Abschnitt 6, Nr. 1].
3. **Isolierte Übersetzungspaare, nur Erkennen.** Gibt die Illusion des Könnens; Abruf und Produktion fehlen [G, Karpicke; S, Webb/Laufer].
4. **Unverlässliche Inhalte und starre Antwortprüfung.** Crowd-Sätze mit Fehlern, nur eine zugelassene Lösung [S]. Gegenmittel: geprüfte oder gekennzeichnete Inhalte, US- und UK-Schreibweise akzeptieren, Meldeknopf.
5. **Einstellungs-Wildwuchs und Fachjargon.** Anki zeigt sehr viele Optionen, die Einrichtung läuft über Community-Anleitungen [S, [G2][g2-anki]]. Gegenmittel: sinnvolle Voreinstellung, ein Regler (M3), einfache Wörter.

---

## 3. Belastbare Zahlen

**Einheiten sind nicht vergleichbar.** Lemma (Grundform + regelmäßige Beugung) ≠ Wortfamilie (Grundwort + Ableitungen) ≠ Eintrag (Lemma + Wortart) ≠ Bedeutung. Verhältnis aus Brysbaert 2016: 42.000 Lemmata entsprechen 11.100 Wortfamilien, also ca. 3,8 Lemmata je Familie [G, [Brysbaert 2016][bry16]; Division eigene Rechnung].

### 3.1 Wortschatzgröße je CEFR-Stufe

**(a) Zahlen je Stufe**

| Quelle | Einheit | A2 | B1 | B2 | C1 | C2 |
|---|---|---|---|---|---|---|
| Meara/Milton, XLex (max. 5.000), Cambridge-Prüflinge [G, [Milton 2010][milton10]] | Lemmata unter den 5.000 häufigsten | 1.500–2.500 | 2.750–3.250 | 3.250–3.750 | 3.750–4.500 | 4.500–5.000 |
| English Vocabulary Profile, Capel 2012 [G, [EVP][evp]] | Headwords, kumulativ | – | – | ca. 4.700 (A1–B2) | – | 6.970 (A1–C2) |
| CEFR-J Wordlist, Tono Lab, Endfassung [G, [Folien][cefrj-counts]] | Einträge (Lemma + Wortart), je Stufe neu | 1.358 | 2.359 | 2.785 | – | – |

CEFR-J: A1 1.068, Summe A1–B2 7.570. Zielgröße der Autoren war 1.000/1.000/2.000/2.000 = 6.000; erst die Einarbeitung der EVP-Einträge hob die Summe auf 7.570 [G]. Ein Eintrag ist hier Lemma + Wortart, deshalb liegt die Zahl über den EVP-Headwords.

**(b) Schwellen und Vergleichswerte (keine Stufen)**

| Quelle | Einheit | Aussage |
|---|---|---|
| Nation 2006 [G, [Paper][nation06]] | Wortfamilien | 98 % Textabdeckung beim Lesen: 8.000–9.000; beim Hören: 6.000–7.000. Gebildete Muttersprachler: ca. 20.000 (ohne Eigennamen und durchsichtige Ableitungen). |
| Brysbaert u. a. 2016 [G, [Paper][bry16]] | Lemmata / Familien | 20-jähriger Muttersprachler: 42.000 Lemmata = 11.100 Familien, dazu 4.200 feste Mehrwortausdrücke. 60-Jähriger: 48.200 Lemmata. |

Weitere Angaben aus dem EVP-Aufsatz [G]: rund 15.000 Bedeutungen und Wendungen in A1–C2; die C-Stufen fügen mehr als 5.000 Bedeutungen und Wendungen hinzu; ein neues C-Wort braucht mindestens 14 Treffer im Lernerkorpus über mehrere Prüfungstermine. Milton: Die Wortschatzgröße erklärt 60–70 % der Streuung der CEFR-Stufen; innerhalb einer Stufe ist die Streuung groß (Standardabweichungen meist 400–700 Wörter) [G].

### 3.2 Was „8.000 Wörter für C1“ in der Literatur wirklich bedeutet

- **Keine CEFR-Vorgabe.** Der Referenzrahmen beschreibt qualitativ; Größenangaben stammen aus Tests mit Prüflingen [G, Milton 2010].
- **Herkunft der Zahl: Textabdeckung.** 98 % bekannte Wörter heißen 1 unbekanntes Wort auf 50, bei 95 % 1 auf 20 [G, Nation 2006]. Beispiel „Lady Chatterley's Lover“ (inkl. Eigennamen): 2.000 Familien ≈ 90,1 %, 4.000 ≈ 95,1 %, 6.000 ≈ 96,9 %, 8.000 ≈ 97,9 %, 9.000 ≈ 98,2 % [G, Nation 2006, Tabelle 5]. Die zweiten 4.000 Familien bringen also nur etwa +2,8 Prozentpunkte, aber genau die machen das Lesen mühelos.
- **Rezeptiv und in Wortfamilien.** Hochgebildete Nichtmuttersprachler im Aufbaustudium kommen auf 8.000–9.000 Familien rezeptiv (unveröffentlichte Untersuchung von Nation) [G].
- **Prüfungsnah deutlich kleiner.** Cambridge-C1-Prüflinge: 3.750–4.500 Lemmata der Top 5.000 [G]; das EVP führte 2012 für alle Stufen 6.970 Headwords [G]. 8.000 ist also (grob verglichen, die Einheiten unterscheiden sich) mehr als der komplette Cambridge-Katalog von 2012, kein „C1-Katalog“, sondern eine Lese-Schwelle.
- **Wie man sie erreicht.** Nation setzt rund 1.000 Wortfamilien pro Jahr als Lernrate an. Für ≥ 12 Begegnungen je Wort bräuchte es 2 bis 25 Romane (je 120.000 Wörter) Input [G, [Nation 2014][nation14]]. Fällt Lesen und Hören weg (Entscheidung 04.10.), muss gezieltes Lernen mit Kontext den Input ersetzen.
- **Empfehlung für die Zielzahl [E]:** „ca. 8.000 Einträge“ als Zielkatalog (Nenner) definieren, Einheit = Eintrag (Lemma + Wortart oder feste Wendung). Per Kalibrierung zählt ein Teil als „bekannt“. Aktiv trainiert wird nur der Rest.

### 3.3 Lernraten, Last und Behalten

**Literatur**
- Behalten durch Abruf: nach einer Woche 80 % bei weiter abgefragten Wortpaaren, 36 % und 33 %, wenn sie nach dem ersten Treffer nicht mehr abgefragt wurden (40 Swahili-Englisch-Paare) [G, [Karpicke & Roediger 2008][karpicke]].
- Beste Abstände: etwa 20 % der Behaltensdauer bei einigen Wochen, etwa 5 % bei einem Jahr [S, [Cepeda u. a. 2008][cepeda]]. FSRS rechnet das selbst.
- Ziel-Behaltensquote 90 % ist Standard; „Nochmal“ macht in der Praxis 5–20 % der Antworten aus [G, Anki-Handbuch].

**Eigene Modellrechnung [E, keine Messung]**
- Annahmen: FSRS-6-Standardparameter (ts-fsrs 5.4.2), Ziel 90 %, jede Karte wird am Fälligkeitstag wiederholt, nur Gut/Nochmal, keine Ausfalltage.
- A (ideal): Erfolg = Abrufwahrscheinlichkeit; 30 s je neue Karte plus 2 Zusatzdurchgänge, 8 s je Durchgang, 20 s je Fehler.
- C (vorsichtig): Erfolg = 0,96 × Abrufwahrscheinlichkeit (4 % Zusatzvergessen); 45 s je neue Karte, 12 s je Durchgang, 30 s je Fehler.
- „Durchgänge“ (Dg.) pro Tag zählen die 3 Durchgänge jeder neuen Karte am Starttag mit. Werte = Mittel der letzten 30 Tage des jeweiligen Jahres; Minuten = Durchgänge × Zeitannahme.

| Neu/Tag | Tage bis 8.000 | A: Jahr 1 → Jahr 3 | C: Jahr 1 → Jahr 3 |
|---|---|---|---|
| 4 | 2.000 (5,5 J.) | 45 Dg., 8 Min. → 62 Dg., 11 Min. | 54 Dg., 15 Min. → 94 Dg., 24 Min. |
| 5 | 1.600 (4,4 J.) | 53 Dg., 10 Min. → 77 Dg., 13 Min. | 71 Dg., 19 Min. → 120 Dg., 31 Min. |
| 8 | 1.000 (2,7 J.) | 83 Dg., 15 Min. → 126 Dg., 22 Min. | 108 Dg., 29 Min. → 194 Dg., 50 Min. |
| 10 | 800 (2,2 J.) | 103 Dg., 19 Min. → 161 Dg., 28 Min. | 141 Dg., 38 Min. → 237 Dg., 61 Min. |
| 15 | 534 (1,5 J.) | 163 Dg., 30 Min. → 239 Dg., 41 Min. | 209 Dg., 56 Min. → 352 Dg., 91 Min. |

- **Faustregeln:** Durchgänge/Tag ≈ 10–14 × neue/Tag nach 1 Jahr, ≈ 16–24 × nach 3 Jahren. Eine Karte braucht im 1. Jahr ca. 7,4 Wiederholungen, danach ca. 2 pro Jahr (ohne Starttag-Durchgänge).
- **Stresstest:** 8 % Zusatzvergessen (0,92 × R) mit 12 s/45 s ergibt bei 5 neu/Tag nach 3 Jahren 197 Durchgänge und 51 Minuten pro Tag. Schon wenige Prozentpunkte mehr Vergessen verdoppeln die Last; das ist der Grund für Problemwort-Rettung (M7) und Last-Deckel (M4).
- **Plausibilität:** Berichte von 200–400 Wiederholungen/Tag bei 2.000–3.000 Wörtern (Wettbewerber-Blog [S, tendenziös]) sind mit beiden Modellen vereinbar (A bei 20 neu/Tag: 222–309 nach 1–3 Jahren; C bei 15 neu/Tag: 209–352).
- **Ableitung [E]:** 15 Min./Tag tragen im 1. Jahr etwa 4 (C) bis 8 (A) neue Einträge/Tag, ab Jahr 3 etwa 2–3 (C) bis 5–6 (A). Bei 20–25 Min./Tag sind in 3 Jahren etwa 4.400 (C, 4/Tag) bis 8.800 (A, 8/Tag) Einträge machbar. „8.000 in 3 Jahren“ bedeutet 22 (ideal) bis 50 (vorsichtig) Min./Tag im 3. Jahr.
- **Abgleich Bestandsplan:** „4–5 neue/Tag bei 12–15 Min.“ (`wortschatz-plan.md`) passt zu A und ist bei C im 1. Jahr schon knapp (19 Min.). Deshalb ist die Kapazitätsregel statt einer festen Zahl richtig. Echte Werte liefern Emrahs Protokolle: nach 4 Wochen Modell und Messung vergleichen.

### 3.4 Aktiv gegen passiv

- Passiv > kontrolliert aktiv > frei aktiv: In einem Jahr Unterricht wuchs der freie aktive Wortschatz nicht [S, [Laufer 1998][laufer98]].
- Verhältnis produktiv/rezeptiv in der Literatur 50–80 %: Webb 2008 gesamt 77 %, nach Frequenzband 88 % (1.000er), 73 % (2.000er), 65 % (3.000er) [S, [Webb 2008][webb08]]; Laufer fand für einzelne Wörter 89 % (10. Klasse) und 73 % (11. Klasse) [S].
- Für seltene Bänder (4.000–8.000) ist ein Quotient unter 65 % zu erwarten [E, Extrapolation, ungeprüft].
- **Folgerung:** Der Aktiv-Anteil gehört als Messgröße in die App (Anteil der Einträge, die frei getippt richtig sind). „Aktiv ~1.500–2.000 Einheiten“ aus `wortschatz-plan.md` bleibt eine Lehrerannahme, in Zeitplänen mit 4.400 Einträgen in 3 Jahren aber stimmig.

---

## 4. Freie Wortlisten als Grundlage für ca. 8.000 Einträge

### 4.1 Übersicht

| Liste | Umfang | Lizenz und Pflichten | Business-Eignung [E] |
|---|---|---|---|
| **NGSL 1.2** (New General Service List) [G, [NGSL][ngsl]] | 2.809 Wörter, ca. 92 % Abdeckung allgemeiner Texte | CC BY-SA 4.0, kommerziell erlaubt | Basis, größtenteils bis B2; Kern der Liste |
| **NAWL** (New Academic Word List) [G, [NAWL][nawl]] | 957 Wörter (flemmas), nicht in der NGSL [S, [EAP Foundation][nawl-eap]]; NGSL + NAWL = 92 % akademische Texte | CC BY-SA 4.0 | Mittel (Berichte, Analyse, Argumentation) |
| **BSL 1.2** (Business Service List) [G, [BSL][bsl]] | 1.700 Lemmata, Korpus 64 Mio. Wörter Business; ohne Überlappung mit der NGSL [S, [Projektseite][bsl-org]]; mit NGSL ca. 97 % Businesstexte | CC BY-SA 4.0 | Hoch |
| **TSL** (TOEIC Service List) [G, [TSL][tsl]] | 1.250 Wörter, 98,5 % TOEIC-Material | CC BY-SA 4.0 | Mittel (Büro- und Reisealltag, eher B1) |
| **Octanove Vocabulary Profile C1/C2 1.0** [G, [Datei][octanove], [Repository][olp]] | ca. 2.100 Zeilen (Datei 2.137 Zeilen inkl. Kopf; Spalten Wort, Wortart, Stufe, Notiz) | CC BY-SA 4.0 | Gemischt (allgemein/akademisch); laut Projekten die einzige offene Liste mit CEFR-Stufe C1/C2 [S]. Methode der Stufenzuordnung nicht geprüft, Stichprobe nötig |
| **CEFR-J Wordlist 1.6** (Tono Lab, TUFS), A1–B2 [G, [Repository][olp], [CEFR-J][cefrj]] | 7.570 Einträge (Endfassung laut [Tono-Folien][cefrj-counts] [G]; andere Quellen nennen bis ca. 7.800 [S]) | Nutzung „for research and commercial purposes with no charge“, Zitierpflicht [G] | Geeignet als Ja/Nein-Wortprobe für A1–B2 (Kalibrierung), nicht als Lerninhalt |
| **Nicht frei:** English Vocabulary Profile | 6.970 Headwords [G, [Capel 2012][evp]] | Rechte bei Cambridge University Press [U]; online nur nach Registrierung, zeitweise frei [G, [Wikipedia][wiki-ep]]; Seite nicht abrufbar | nur zur Gegenkontrolle |
| **Nicht frei:** Oxford 3000/5000 | 5.000 Wörter bis C1 (die 2.000 zusätzlichen auf B2–C1) [S] | © Oxford University Press [S]; Seite nicht abrufbar | nur zur Gegenkontrolle |
| **Nicht frei:** English Grammar Profile (EGP) | 1.222 Kann-Aussagen in 86 Kategorien [G, [arXiv 2502.07544][egp-arxiv1]; Originalaufsatz O'Keeffe & Mark 2017 nicht abrufbar, [S][egp-ijcl]]; Fassung 2026: 1.211, als Excel herunterladbar [G, [arXiv 2603.17171][egp-arxiv2]] | „kostenlos für nicht-kommerzielle Nutzung“ [G, [Wikipedia][wiki-ep]] | nur als Gliederungshilfe, nicht einbetten |

**Ergänzende freie Daten**
- **Tatoeba-Sätze:** CC BY 2.0 FR, Namensnennung; Audio kann andere Lizenzen haben [G, [Tatoeba][tatoeba]]. Satzqualität schwankt [S].
- **CMUdict** für Lautschrift: BSD-ähnliche Lizenz, Hinweis muss erhalten bleiben [G, bereits im Projekt].
- **Open English WordNet:** CC BY 4.0, Namensnennung auch an Princeton [S, [Lizenz][owordnet]].
- **wordfreq:** Code Apache, Daten CC BY-SA 4.0, Stand etwa 2021, nicht mehr gepflegt [S, [GitHub][wordfreq]].
- **Wortverbreitung (Brysbaert u. a., 62.000 Lemmata, „wie viele Menschen kennen das Wort“):** Daten auf OSF, Lizenz nicht geprüft [S, [Paper][prevalence]]. Brauchbar als Schwierigkeitsmaß.

### 4.2 Empfehlung

1. **Kern (rund 5.466 Lemmata):** NGSL (2.809) + NAWL (957) + BSL (1.700), alle CC BY-SA 4.0, nach Definition überschneidungsfrei zur NGSL. Die Überlappung NAWL–BSL ist nicht geprüft [U]. Business-Gewicht: BSL zuerst, NGSL nach Rang, NAWL danach.
2. **C1/C2-Aufsatz:** Octanove (rund 2.100 Zeilen). Nach Entfernen von Dubletten (gleiches Wort in mehreren Wortarten, Überschneidung mit dem Kern) bleiben vermutlich 1.500–2.000 Lemmata [U]. Stufenzuordnung stichprobenartig prüfen.
3. **Kalibrierung:** CEFR-J (A1–B2) als Ja/Nein-Wortprobe für „bekannt“ (M8). Das Ergebnis steuert, was als bekannt gilt.
4. **Selbst erzeugen** (mit Claude, formal prüfen, Stichprobe durch Englischlehrer, Meldeknopf; Muster schon im C1-Paket erprobt):
   - deutsche Bedeutung und Wortart, Register-Hinweis,
   - 2–3 Beispielsätze in US-Business-Englisch, Wortpartner und Kollokationen,
   - **Phrasal Verbs, Idiome, feste Wendungen** (es gibt keine freie, CEFR-gestufte Liste; die Listen oben sind Einzelwörter),
   - Wortfamilien (Ableitungen), Deutsch-Fallen (falsche Freunde), Merkhilfen,
   - Lautschrift aus CMUdict,
   - Rangfolge = Häufigkeit × Business-Nutzen × „kennt man schon?“.
5. **Ergebnis [E]:** Kern 5.466 + C-Aufsatz 1.500–2.100 + selbst erzeugte Wendungen und Wortpartner rund 1.000 ergeben ungefähr 8.000 Einträge. Wortfamilien-Ableitungen wären ein eigenes Feld, nicht eigene Einträge.
6. **Lizenz-Umgang (keine Rechtsberatung):**
   - CC BY-SA 4.0 verlangt Namensnennung (Urheber, Quelle, Lizenz-Link, Änderungshinweis) und Weitergabe von Bearbeitungen unter derselben Lizenz; kommerzielle Nutzung ist erlaubt [G, [CC-Deed][cc-by-sa]].
   - Für Emrahs private Nutzung unkritisch; Quellen und Lizenzen in „Über/Quellen“ der App nennen.
   - Vor einem Verkauf: Wortlisten-Anteil als eigenes, getrenntes CC-BY-SA-Datenpaket führen (nicht mit dem Programmcode vermischen) und juristisch prüfen lassen. Alternative: Listen nur als Rang- und Niveauhinweis nutzen und die Auswahl selbst erzeugen (Rechtslage bei Bearbeitung unklar [U]).

---

## 5. Typische C1-Grammatikthemen (30)

**Herkunft:** Die EGP-Online-Seiten waren nicht abrufbar. Belegt als EGP-C1 sind nur diese vier Beispiele aus einem Fachaufsatz [G, [arXiv][egp-arxiv1]]: Superlativ mit Nomen und Nachstellung, Verneinung mit „none“/Ersatzformen, „not only … (but) also“ mit Inversion, „would“ mit Adverbien. Der Rest ist die Schnittmenge aus einem C1-Lehrplan [[Perfect English Grammar][c1-curr], „Lehrplan“], einer C1-Advanced-Seite [[ready4cambridge][r4c], „R4C“] und dem British Council [[BC][bc-emph]]. Vor Verwendung gegen EGP-Online abgleichen (nicht-kommerziell erlaubt) [U]. **(B)** = besonders nützlich im Business.

**Zeiten und Aspekt**
1. Present Perfect Simple gegen Continuous (Ergebnis gegen Dauer; „noch im Gang“ gegen „gerade beendet“). Lehrplan
2. Future Perfect und Future Perfect Continuous, „be to“, „be about to“. Lehrplan
3. Verlaufsform für Gefühl und Vorläufigkeit („is always complaining“), Zustands- gegen Tätigkeitsverben. Lehrplan, R4C
4. would / used to / be used to, auch mit Adverbien („would often“). EGP-C1 [G]

**Hypothese und Wunsch**
5. Gemischte Konditionalsätze (2./3. gemischt). Lehrplan
6. Invertierte Konditionalsätze (Should you …, Had I known …, Were it not for …) und „if“-Ellipse (B). R4C, BC
7. Konditional-Varianten (provided that, as long as, unless, otherwise, but for) und kurze Bedingungsphrasen (B). Lehrplan
8. Unreal Past: wish, if only, would rather, it's time + Vergangenheit. Lehrplan
9. Subjunktiv und formelle that-Sätze („It is vital that he be …“, „I suggest that she review …“) (B). Lehrplan

**Modalität**
10. Modale Perfektformen (must/can't/might/could have + Partizip; needn't have gegen didn't need to). Lehrplan
11. Abschwächen und Vorsicht (may well, might well, not necessarily, tend to, be bound to) (B). R4C
12. Modalverben im Passiv und Passiv-Berichtsstrukturen („It is said that …“, „He is believed to have …“) (B). Lehrplan, R4C

**Verbstrukturen**
13. Fortgeschrittenes Passiv (to have been informed, being asked), Kausativ have/get something done. Lehrplan
14. Gerund gegen Infinitiv mit Bedeutungswechsel (remember, stop, regret, try), perfekter Infinitiv/Gerund, Verb + Objekt + Infinitiv/Gerund. Lehrplan
15. Wahrnehmungsverben + Objekt + Infinitiv ohne „to“ oder -ing. R4C
16. Berichtsverben mit festen Mustern (admit/deny + -ing, insist/recommend + that/should) (B). [U]

**Betonung und Satzbau**
17. Spaltsätze (It-Cleft, What-Cleft, „All I want is …“, „What matters is …“) (B). Lehrplan, BC
18. Inversion nach verneinenden Adverbialen (Never, Rarely, Hardly … when, No sooner … than, Not only … but also, Under no circumstances). EGP-C1 [G], Lehrplan, BC
19. Hervorhebung mit „do“ und Voranstellung („I did warn them“, „So great was …“, such … that). BC
20. Ellipse und Ersatzformen („do so“, „if so/if not“, to-Ellipse, „none“). Lehrplan, R4C, EGP-C1 [G]

**Verdichtung**
21. Partizipialsätze (präsens, perfekt, passiv: „Having reviewed the contract, …“) (B). Lehrplan
22. Nicht-notwendige und verkürzte Relativsätze („…, some of which“, „in which“, „the report submitted yesterday“) (B). Lehrplan
23. Nominalisierung und lange Nominalgruppen („the implementation of the new policy“) (B). Lehrplan
24. Superlativ + Nomen + Nachstellung („the most reliable system we have tested“). EGP-C1 [G], R4C

**Adverbien, Steigerung, Pronomen**
25. Einstellungs- und Verknüpfungsadverbien (admittedly, arguably, nevertheless, albeit), Stellung und Zeichensetzung (B). Lehrplan, R4C
26. Steigerung modifizieren (far/considerably more, by far the …, the more …, the more …). Lehrplan
27. Formelle Pronomen und Rückbezug (each other/one another, those who, the former/the latter). Lehrplan, R4C

**Wortverbindungen, Negation, Konnektoren**
28. Phrasal-präpositionale Verben und Objektstellung (put up with, come up with, look forward to + -ing). R4C
29. Verneinung und Mengenangaben (scarcely, barely, no longer, hardly any, neither/either/none + Verb). EGP-C1 [G], Lehrplan
30. Verkürzte Zeit- und Grundangaben (upon receiving …, on completion of …, in the event of …) (B). [U]

---

## 6. Was Nutzer an Anki-artigen Apps und an Grammatik-Apps am häufigsten bemängeln (Top 8)

Belegstärke: **stark** = Primärquelle oder Studie gelesen, **mittel** = Sekundärquelle, **schwach** = Wettbewerber-Blog oder sehr kleine Stichprobe.

| Nr. | Kritik | Betrifft | Beleg | Stärke |
|---|---|---|---|---|
| 1 | **Rückstandsberg:** nach einer Pause hunderte fällige Karten, dann Abbruch | Anki, jedes SRS ohne Deckel | Anki regelt Rückstand per „älteste zuerst“ [G, [Handbuch][anki-study]]; Blogs nennen es Hauptgrund fürs Aufhören, 200–400 Wiederholungen/Tag bei 2.000–3.000 Wörtern [S, tendenziös: [1][burnout1], [2][burnout2]]; ein FSRS-Nutzer berichtet, das Gefühl der Verzweiflung beim Verpassen einer Karte sei mit FSRS deutlich kleiner als mit dem alten SM-2 [G, [Bericht][domenic]]; Modell: Last = 10–24 × neue Karten/Tag [E] | mittel |
| 2 | **Einstiegshürde:** veraltete Oberfläche, viele Einstellungen, Einrichtung über Community-Anleitungen | Anki | Zusammenfassung von Bewertungen und Testberichten [S, [G2][g2-anki]] | mittel |
| 3 | **Karten selbst bauen müssen**, fertige Decks schwanken in der Qualität | Anki, Quizlet-Sets | Handbuch rät zu eigenen Karten; fertige Decks mit Fehlern und Formatproblemen [S] | mittel |
| 4 | **Wörter ohne Kontext:** Erkennen statt Anwenden, Selbstüberschätzung | Karteikarten-Apps | Produktives Wissen liegt bei 50–80 % des rezeptiven [S, [Webb 2008][webb08], [Laufer 1998][laufer98]]; Abruf schlägt Nachlesen (80 % gegen 33–36 %), Lernende sagten überall ≈ 50 % voraus [G, [Karpicke][karpicke]] | stark (Mechanismus), mittel (Nutzerklage) |
| 5 | **Spiel-Druck statt Lernen:** Streak, Ligen, Herzen | Duolingo | Masterarbeit Oulu 2025, kleine Umfrage: Streak wirksamster Motivator, doch hohe Serie ≠ Verständnis; Soziales stresst manche; Wunsch nach abschaltbaren Funktionen [G, [Oulu][oulu]] | schwach–mittel |
| 6 | **Grammatik zu flach** oder nur nebenbei | Duolingo, auch Memrise/Clozemaster | 15 Studierende: es fehle an tiefen Erklärungen zu komplexen Regeln [G, [IJOEP 2025][ijoep]]; viele fanden den Inhalt dürftig, besonders den Grammatikunterricht [G, Oulu]; Erklärungen fehlten in der App [S, [Loewen u. a. 2019][loewen]] | mittel |
| 7 | **Funktionen verschwinden, Bezahlschranke mitten im Lernen** | Quizlet, Memrise | Quizlet: Lern- und Testmodus seit 01.08.2022 hinter Plus, 35,99 $/Jahr oder 7,99 $/Monat [G, [Kommentar][quizlet-pay]]; Memrise: Mems seit 09/2022 entfernt, Nutzerkurse seit 02/2024 nur auf separater Website [G, [Wikipedia][memrise]] | stark (Tatsache), mittel (Echo) |
| 8 | **Inhalte:** Fehler in Crowd-Sätzen, Niveau endet bei B1/B2 | Clozemaster (Tatoeba), Mainstream-Apps | Tatoeba-Sätze von Freiwilligen, Fehler möglich, man muss sie erkennen können [S, [Rezension][cloze-rev]]; größte Duolingo-Kurse zielen auf B2 [S]; Babbel zeigt C1 nur als Lesetexte [G, [Babbel][babbel-c1]], Kritik, es fordere selten Berufsenglisch [S, Wettbewerber, tendenziös] | schwach–mittel |

---

## 7. Offene Punkte und Grenzen

- **EGP-Online** (C1-Kann-Aussagen) war nicht abrufbar. Die Liste in Abschnitt 5 braucht einen Abgleich, bevor sie als „EGP-Syllabus“ bezeichnet wird.
- **Octanove:** Methode der C1/C2-Zuordnung, Qualität und Dublettenzahl nicht geprüft; es wurde nur die Dateizeilenzahl gelesen. **NAWL–BSL-Überlappung** ungeprüft.
- **Lizenzen:** keine Rechtsberatung. Share-Alike für Datenbestand und Anwendung vor einem Verkauf klären.
- **Modell:** keine Messung. Kosten je Durchgang und Zusatzvergessen sind Annahmen. Im Stresstest (8 % Zusatzvergessen) liegt die Last 2,5-mal so hoch wie in A.
- **Onboarding von Duolingo, Babbel, Memrise und Quizlet** sowie Anki-Standardwerte (20/200) sind [U].
- **Wettbewerber-Blogs** (Rückstandsberg, B2-Grenze) sind tendenziös; die Aussagen stützen sich zusätzlich auf Handbuch und Studien.

---

## 8. Quellen

Die Links stehen im Text als Kürzel und unten als Definitionen. Status: [G] selbst gelesen, [S] Sekundärquelle oder Seite nicht abrufbar.

| Kürzel | Quelle | Status |
|---|---|---|
| anki-study, anki-deck | Anki-Handbuch: Lernen und Deck-Optionen (Antwortknöpfe, Rückstand, Ziel-Behaltensquote) | G |
| srs-bench | Open-Spaced-Repetition: SRS-Benchmark (10.000 Nutzer, ca. 727 Mio. Wiederholungen) | G |
| hlr | Settles & Meeder 2016, Half-Life Regression (Duolingo), ACL | G |
| birdbrain | Duolingo-Blog zu Birdbrain, 07.10.2020 | G |
| babbel, babbel-c1 | Babbel-Methode; deutsche C1-Seite (Lesetexte) | G |
| vocab | Vocabulary.com, Science of Vocabulary | G |
| cloze | Clozemaster-Hilfe: Beherrschung und Abstände | G |
| lingvist | Lingvist-Startseite | G |
| memrise | Wikipedia: Memrise (Mems, Nutzerkurse, KI-Partner) | G |
| quizlet-pay | NT Daily, 04.08.2024: Quizlet-Bezahlschranke seit 01.08.2022 | G |
| evp | Capel 2012, Completing the English Vocabulary Profile (DOI) | G |
| nation06, nation14 | Nation 2006 (Textabdeckung); Nation 2014 (Input für 9.000 Wörter) | G |
| milton10 | Milton 2010, Wortschatzgröße über die CEFR-Stufen (XLex-Tabelle) | G |
| bry16 | Brysbaert u. a. 2016, How many words do we know? | G |
| karpicke | Karpicke & Roediger 2008, Science (Lesetext Purdue-Kopie) | G |
| ngsl, nawl, bsl, tsl | Projektseiten der Wortlisten (Umfang, Lizenz) | G |
| olp, octanove, cefrj, cefrj-counts | Open Language Profiles (CEFR-J, Octanove); CEFR-J-Download; Tono-Folien mit Stufenzahlen | G |
| tatoeba, cc-by-sa | Tatoeba-Nutzungsbedingungen; CC BY-SA 4.0 Deed | G |
| wiki-ep | Wikipedia: English Profile (EGP nicht-kommerziell, EVP Registrierung) | G |
| egp-arxiv1, egp-arxiv2 | arXiv 2502.07544 und 2603.17171 (EGP-Zahlen, C1-Beispiele) | G |
| c1-curr, r4c, bc-emph | C1-Lehrplan Perfect English Grammar; ready4cambridge; British Council | G |
| ijoep, oulu | Studie 15 Studierende (2025); Masterarbeit Oulu 2025 | G |
| domenic | Erfahrungsbericht zu FSRS | G |
| anki-rel | Anki-Release 26.09 (FSRS-Version) | S |
| egp-ijcl | O'Keeffe & Mark 2017 (Cardiff ORCA, nicht abrufbar) | S |
| nawl-eap, bsl-org | EAP Foundation; Projektseite .org (Überlappungsfreiheit zur NGSL) | S |
| cepeda, laufer98, webb08, loewen | Cepeda 2008; Laufer 1998; Webb 2008; Loewen u. a. 2019 | S |
| quizlet-ml, cloze-rev, g2-anki | Testbericht Quizlet; Clozemaster-Rezension; G2-Bewertungen zu Anki | S |
| wordfreq, owordnet, prevalence | wordfreq; Open English WordNet; Wortverbreitung (Brysbaert u. a. 2019) | S |
| burnout1, burnout2 | Wettbewerber-Blogs zu Anki-Rückstand (tendenziös) | S |

[anki-study]: https://docs.ankiweb.net/studying.html
[anki-deck]: https://docs.ankiweb.net/deck-options.html
[srs-bench]: https://github.com/open-spaced-repetition/srs-benchmark
[hlr]: https://aclanthology.org/P16-1174.pdf
[birdbrain]: https://blog.duolingo.com/learning-how-to-help-you-learn-introducing-birdbrain/
[babbel]: https://www.babbel.com/the-babbel-method
[babbel-c1]: https://de.babbel.com/englisch-lernen/fortgeschritten
[vocab]: https://www.vocabulary.com/membership/science-of-vocabulary/
[cloze]: https://docs.clozemaster.com/article/37-how-do-i-master-something
[lingvist]: https://lingvist.com/
[memrise]: https://en.wikipedia.org/wiki/Memrise
[quizlet-pay]: https://www.ntdaily.com/opinion/quizlet-s-paywalls-place-priority-on-profits-over-pupils/article_848d54c6-4eca-11ef-b6bd-bba8eff900d3.html
[evp]: https://doi.org/10.1017/S2041536212000013
[nation06]: https://www.lextutor.ca/cover/papers/nation_2006.pdf
[nation14]: https://files.eric.ed.gov/fulltext/EJ1044345.pdf
[milton10]: https://www.eurosla.org/monographs/EM01/211-232Milton.pdf
[bry16]: https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2016.01116/full
[karpicke]: https://www.science.org/doi/abs/10.1126/science.1152408
[ngsl]: https://www.newgeneralservicelist.com/new-general-service-list
[nawl]: https://www.newgeneralservicelist.com/new-academic-word-list
[bsl]: https://www.newgeneralservicelist.com/business-service-list
[tsl]: https://www.newgeneralservicelist.com/toeic-service-list
[olp]: https://github.com/openlanguageprofiles/olp-en-cefrj
[octanove]: https://github.com/openlanguageprofiles/olp-en-cefrj/blob/master/octanove-vocabulary-profile-c1c2-1.0.csv
[cefrj]: https://www.cefr-j.org/download_eng.html
[cefrj-counts]: http://www.tufs.ac.jp/ts/personal/corpuskun/pdf/2019/CEFR/CEFRJ_Wordlist_Making.pdf
[tatoeba]: https://tatoeba.org/en/terms_of_use
[cc-by-sa]: https://creativecommons.org/licenses/by-sa/4.0/
[wiki-ep]: https://en.wikipedia.org/wiki/English_Profile
[egp-arxiv1]: https://arxiv.org/html/2502.07544
[egp-arxiv2]: https://arxiv.org/pdf/2603.17171
[c1-curr]: https://www.perfect-english-grammar.com/support-files/the-ultimate-c1-grammar-course-curriculum.pdf
[r4c]: https://ready4cambridge.com/c1-level-grammar-structures-2/
[bc-emph]: https://learnenglish.britishcouncil.org/free-resources/grammar/c1/emphasis-cleft-sentences-inversion-auxiliaries
[ijoep]: https://journal.yudhifat.com/index.php/ijoep/article/view/98
[oulu]: https://oulurepo.oulu.fi/bitstream/handle/10024/54117/nbnfioulu-202502121605.pdf?sequence=1&isAllowed=y
[domenic]: https://domenic.me/fsrs/
[anki-rel]: https://github.com/ankitects/anki/releases/tag/26.09
[egp-ijcl]: https://orca.cardiff.ac.uk/id/eprint/166496/
[nawl-eap]: https://www.eapfoundation.com/vocab/academic/nawl/
[bsl-org]: https://www.newgeneralservicelist.org/bsl-business-service-list
[cepeda]: https://files.eric.ed.gov/fulltext/ED505660.pdf
[laufer98]: https://eric.ed.gov/?id=EJ566400
[webb08]: https://www.researchgate.net/publication/231866684_Receptive_and_productive_vocabulary_sizes_of_L2_learners
[loewen]: https://www.researchgate.net/publication/333431833_Mobile-assisted_language_learning_A_Duolingo_case_study
[quizlet-ml]: https://learnclash.com/blog/does-quizlet-have-spaced-repetition
[cloze-rev]: https://www.fluentin3months.com/reviews/clozemaster-review/
[g2-anki]: https://www.g2.com/products/anki/reviews?qs=pros-and-cons
[wordfreq]: https://github.com/rspeer/wordfreq
[owordnet]: https://github.com/globalwordnet/english-wordnet/blob/main/LICENSE.md
[prevalence]: https://link.springer.com/article/10.3758/s13428-018-1077-9
[burnout1]: https://my-senpai.com/insights/why-people-quit-anki.html
[burnout2]: https://wordrop.studio/blog/anki-review-debt-why-users-always-quit
