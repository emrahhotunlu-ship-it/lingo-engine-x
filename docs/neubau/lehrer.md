# Lehrer-Sicht zum Neubau: Übungen, Rhythmus, Themen, Lücken

Stand 27.09.2026. Rolle: Business-English-Lehrer (CELTA/DELTA, C1-Prüfer).
Grundlage:
- `docs/konzept/lernarchitektur.md`, `docs/lernberatung-lehrer.md`, `docs/produktkonzept.md`, `docs/altapp-funktionsabgleich.md`
- Stichproben im Code: `src/features/*`, `src/prompts/*`, `src/domain/plan/*`, `src/domain/srs/modes.ts`, `src/content/*`

**Vorweg:** Die Bausteine mit echtem C1-Nutzen gibt es schon: FSRS-Karten mit Ursprungssatz, „Sag es“, Reparatur-Sätze, Deutsch-Fallen, 90/60/45, „Mein nächster Termin“, Tonlagen, Preply-Brücke und Wort-Antippen. Dass die App „zu dünn“ wirkt, hat zwei Gründe:
- Diese Bausteine hängen in keinem Tagesablauf zusammen.
- Wichtige Übungsformen fehlen: Aussprache, anspruchsvolles Hören, Tiefe im Wortschatz, spontanes Sprechen unter Zeitdruck und Schreiben aus dem echten Posteingang.

**So ist die Liste zu lesen**
- **Priorität:**
  - A = gehört in den Neubau und wird täglich oder wöchentlich gebraucht.
  - B = gehört dazu, bringt Abwechslung und schließt eine bestimmte Lücke.
  - C = kann warten.
- **Spalte „Heute“:** Ordner unter `src/features/`.
  - ja = didaktisch brauchbar vorhanden
  - teilweise = die Grundform ist da, der Kern fehlt
  - nein = fehlt
- **Spalte „Trainiert“:** die C1-Beschreibung aus dem GER-Begleitband 2020, sinngemäß und gekürzt.
- **Ein Rückmeldestil für alle Übungen:**
  1. Zuerst die Wirkung in einem Satz.
  2. Höchstens 3 Korrekturen, sortiert: stört das Verständnis > Deutsch-Falle > Wochenziel.
  3. Erst ein Hinweis, dann ein zweiter Versuch, dann die Lösung mit einem Satz Grund.
  4. 1–2 C1-Aufwertungen mit Knopf „Merken“.
  5. Danach immer „Nochmal, aber besser“.

  Korrigierte Sätze werden automatisch Reparatur-Karten. Jedes englische Wort ist antippbar.

---

## 1. Übungs- und Werkzeugtypen

### 1.1 Wortschatz-Tiefe

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus (Bildschirm · Eingabe · Rückmeldung) | Prio | Heute |
|---|---|---|---|---|---|
| W1 | Karten schnell wiederholen (Anki-Modus) | Wortschatz: „kaum sichtbares Suchen nach Ausdrücken“ | Vorne stehen die deutsche Bedeutung und der Ursprungssatz mit Lücke, Emrah formuliert im Kopf auf Englisch. Dann aufdecken und einen von 4 Knöpfen tippen. Die App hebt ihren Vorschlag aus der Antwortzeit hervor. Wischen geht auch. Zuerst kommen Reparatur-Sätze und Karten zum Wochenthema. | A | teilweise (`vocab`: nur Abfragearten, kein Aufdecken) |
| W2 | Aktiver Abruf im Satz | Wortschatz: „benutzt auch seltenere Wörter idiomatisch und passend“ | Tippen direkt in der Lücke des Ursprungssatzes. Ab einer gefestigten Karte heißt die Aufgabe „Sag es mit dieser Wendung“: ein eigener Satz zu einer Situation, die KI prüft. Die App bewertet automatisch und zeigt danach 2–3 Beispiele und die Aussprache. | A | ja (`vocab`) |
| W3 | Kollokationen (Wortverbindungen) | Wortschatz: „wählt aus mehreren Möglichkeiten, auch mit selteneren Synonymen“ | In der Mitte steht ein Nomen (deal, deadline, concern, budget). Emrah tippt 2–3 passende Verben (close/strike a deal; meet/miss/extend a deadline). Danach zeigt die App die typische deutsche Lehnübersetzung als Kontrast: „keep a deadline“ (falsch) → „meet a deadline“. Es wird nur getippt, nie ausgewählt. | A | teilweise (`vocab`: Art `colloc` nur als Auswahl; `drills`: Lückenjagd) |
| W4 | Phrasal Verbs im Beruf | Register: „passt die Förmlichkeit an und hält sie durch“ | Paare formell ↔ gesprochen: postpone ↔ push back, investigate ↔ look into, reject ↔ turn down, finalize ↔ wrap up. Aufgabe: einen Satz aus einer Mail so umschreiben, wie man ihn im Call sagt, und umgekehrt. Rückmeldung: Stimmt die Partikel? Passt der Ton? | B | nein |
| W5 | Wortfamilien und Wortbildung | Genauigkeit, Nominalstil; Prüfungsformat „word formation“ | Ein Wortstern: comply → compliance, compliant, non-compliant. Dazu ein Business-Satz mit Lücke, das Grundwort steht daneben. Die Rückmeldung nennt Wortart und Endung. Verknüpft mit dem Betonungswechsel (ANalyze · aNALysis · anaLYTics). | B | nein |
| W6 | Genaue Wortwahl je Register | Flexibilität: „variiert den Ausdruck wirkungsvoll“ | Drei Stufen locker · neutral · formell: get → receive → obtain, big → significant → substantial. Aufgabe: einen Satz auf die Zielstufe heben oder senken. Rückmeldung: passt, zu steif oder zu locker. | B | nein (nur ganze Nachrichten in `tones`) |
| W7 | Hedging (Aussagen abschwächen, Gewissheit abstufen) | Genauigkeit: „stuft Aussagen genau nach Gewissheit, Wahrscheinlichkeit und Zweifel ab“ | Ein zu harter Satz wird auf drei Stufen umformuliert: „This will save you 30 percent.“ → „should save you around …“ → „could save you up to …“. In den Output-Aufgaben der Woche steht es als sichtbares Ziel („2 Abschwächungen“), die Rückmeldung zählt mit. | A | teilweise (`grammar` c1-hedging: nur als Thema, nicht als Ziel in Aufgaben) |
| W8 | Diskursmarker und Signposting (Überleitungen, Wegweiser in der Rede) | Kohärenz: „klar, flüssig, gut gegliedert, Verknüpfungsmittel kontrolliert“ | Eine kurze Rede mit 4 Lücken an den Übergängen (That said · To build on that · Coming back to … · Bottom line). Danach eine eigene 60-Sekunden-Antwort mit mindestens 3 Markern, die KI hebt sie im Text hervor. | A | teilweise (`grammar` c1-discourse) |
| W9 | Deutsch-Fallen und falsche Freunde | Kontrolle über Wortschatz und Grammatik: „keine bedeutenden Fehler“ | Ein Startsatz von etwa 25 klassischen Fallen für den Beruf (Beispiele unter der Tabelle), dazu Emrahs eigene Muster aus allen Korrekturen. Der Drill mischt drei Fallen mit seinen eigenen Sätzen. Verlauf: „3× → 0×“. | A | teilweise (`patterns`: nur aus eigenen Fehlern, ohne Startsatz) |
| W10 | Umschreiben statt stocken | Selbstreparatur: „formuliert um, ohne den Redefluss ganz zu unterbrechen“ | Ein Fachwort, das ihm fehlt (Aufbewahrungsfrist, Ausschreibung, Mahnwesen), soll er in zwei Sätzen erklären, ohne das Wort zu benutzen. Die KI prüft: Würde ein Kunde das verstehen? Danach wird das richtige Wort eine Karte. | B | nein |
| W11 | Idiome und US-Business-Wendungen | Wortschatz: „beherrscht gängige idiomatische Ausdrücke gut“ | ballpark figure, touch base, a no-brainer, move the needle, circle back. Zuerst nur verstehen (im Hörtext), dann mit dem Hinweis, wann man sie besser nicht benutzt (eher nicht in einer Mail an den CFO). | C | nein |
| W12 | Wörter aus Input sammeln | Fachwortschatz: „versteht und benutzt Fachwörter und Wendungen des eigenen Fachgebiets“ | Wort antippen → „Merken“ schlägt die ganze Wortverbindung vor (address concerns statt address), der Ursprungssatz kommt mit. Im Übersetzer steht der Knopf „In den Wortschatz“. Neue Karten landen in einem Eingangskorb mit Tageslimit. | A | ja (`lookup`, `companion/translate`, `vocab/list`) |

**Startsatz für W9 (Beispiele):**
- **Falsche Freunde:**
  - actual ≠ aktuell (current)
  - eventually ≠ eventuell (possibly)
  - become ≠ bekommen (get)
  - provision ≠ Provision (commission)
  - prospect = Interessent (Prospekt = brochure)
  - chance ≠ Chance (opportunity)
  - serious ≠ seriös (reputable)
  - sympathetic ≠ sympathisch (likable)
- **Zahlen und Zeit:**
  - Milliarde = billion
  - Termin = meeting / appointment / deadline
  - bis = by (Frist) oder until (Dauer)
  - seit = since/for mit Present Perfect
- **Ein deutsches Wort, mehrere englische:** Sicherheit = security / safety / certainty
- **Unzählbare Nomen ohne -s:** information, feedback, advice, software
- **Grammatik und feste Verbindungen:**
  - discuss ohne „about“
  - explain to me
  - look forward to + -ing
  - interested in, depend on
  - give a discount, take a photo, do business
  - Fragen ohne „do“

### 1.2 Grammatik mit Wirkung

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| G1 | Deutsch-Fallen-Drill mit eigenen Sätzen | Grammatik: „durchgehend hohe Korrektheit, Fehler selten und schwer zu finden“ | 3–6 eigene falsche Sätze, gemischt aus drei Fallen. Umschreiben, Hinweis, zweiter Versuch, dann die Lösung mit einem Satz Grund. | A | ja (`patterns`) |
| G2 | C1-Werkzeugkasten (Betonung durch Satzbau, Inversion, Partizipialsätze, Nominalstil, diplomatische Distanz) | Flexibilität: „ändert Satzlänge und Wortstellung, um zu wirken“ | Das Themenblatt ist einen Tipp entfernt: 3 Sätze Regel, 3 Beispiele aus dem Vertrieb. Geübt wird, indem Emrah eigene Sätze umformt. In der Output-Aufgabe steht es als „Werkzeug der Woche“. | A | teilweise (`grammar` c1-*; als Wochenziel fehlt es) |
| G3 | Satz-Umformung mit Schlüsselwort | Genauigkeit; C1-Prüfungsformat | Satz A plus ein Schlüsselwort; Satz B wird mit 3–6 Wörtern ergänzt. Beispiel: „It's possible the client hasn't received the invoice. MAY → The client ___ the invoice.“ Die App prüft lokal gegen mehrere Musterlösungen, die KI nur bei Abweichung. | B | nein |
| G4 | Fehler im Text finden | Selbstkorrektur | Eine Kundenmail mit 4 typischen deutschen Fehlern. Antippen markiert einen Fehler, dann verbessert Emrah ihn. Später dasselbe mit einem eigenen alten Text. | B | nein |
| G5 | B2-Grammatik als Nachschlagewerk | Grundlagen absichern | 16 Themenblätter mit Suche und dem Teil „Deutsch → Englisch: wo es klemmt“. Kein Pflichtkanal. | B | ja (`grammar`, Bereich Wissen) |

### 1.3 Aussprache mit Sprachausgabe

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| P1 | Wortbetonung | Prosodie: „setzt die Betonung richtig, um genau zu sagen, was gemeint ist“ | Das Wort erscheint in Silben, Emrah tippt die betonte Silbe an, die Sprachausgabe bestätigt. Wortliste: deutsche Lehnwörter mit anderer Betonung (DOCument, ARchive, STRATegy, techNOLogy, INdustry, CATegory) und Wechsel innerhalb einer Wortfamilie. Die Daten kommen aus der eingebauten US-Lautschrift mit Betonungszeichen, ohne KI. | B | nein (Lautschrift steht nur im Nachschlagen, `lookup`) |
| P2 | Shadowing Satz für Satz (hören und sofort nachsprechen) | Flüssigkeit, Rhythmus, Wendungen automatisch abrufbar | Ein Satz wird abgespielt, dann erscheint „Jetzt du“ für die Länge des Satzes. Drei Durchgänge mit steigendem Tempo (0,9 · 1,0 · 1,1). Quellen: die bessere Fassung aus „Sag es“, Pitch-Sätze, Karten-Sätze der Woche. Keine Wertung. | A | teilweise (`listen/TranscriptView`, `business/PitchCoach`, nur versteckt) |
| P3 | Kernwörter und Pausen im Pitch | Vortrag: „klar gegliedert, Wichtiges hervorgehoben“ | Der Pitch-Text hat markierte Kernwörter und Pausenstriche. Die Sprachausgabe liest ihn in Stücken mit Pausen vor, Emrah spricht nach. | B | teilweise (`business/PitchCoach`) |
| P4 | Zahlen, Daten, Beträge | Daten genau wiedergeben | Eine Zahl erscheint (€1.5bn, 15 %, 03/15, Q3, 2,4 Mio.). Emrah sagt sie laut und hört dann die Lösung. Fallen: Milliarde, Komma statt Punkt, US-Datumsformat. | B | nein |
| P5 | Deutsche Laute | Laute: „fast alle Laute gut kontrolliert, korrigiert sich meist selbst“ | Minimalpaare hören und wählen: vest/west, bet/bed, think/sink, Endungen auf -ed. 2 Minuten, nur hören. | C | nein |
| P6 | Sich selbst aufnehmen und vergleichen | Selbstkontrolle | Nur, wenn das Mikrofon im eingebetteten Safari wirklich funktioniert. Sonst wird die Funktion ausgeblendet. | C | nein |

Ehrlich gesagt: Eine automatische Bewertung der Aussprache ist im Artefakt auf dem iPhone nicht verlässlich möglich. Aussprache trainiert die App über Hören und Nachsprechen, korrigiert wird sie in den Preply-Stunden.

### 1.4 Hören

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| H1 | Kurzer Hörtext zum Wochenthema | Hören: „folgt längeren Beiträgen, auch wenn Zusammenhänge nur angedeutet sind“ | Voicemail, Briefing oder Ausschnitt aus einem Call, 1–2 Minuten. Eine Frage zum Kern, eine „zwischen den Zeilen“ (Ist der CFO überzeugt?). Danach 2 Wendungen merken. | A | ja (`listen`) |
| H2 | Tempo-Leiter bis zum natürlichen Tempo | Hören bei natürlichem Tempo | Erstes Hören mit 0,9–1,0, zweites mit 1,1–1,2. Die App merkt sich das Tempo und erhöht es, wenn die Antworten stimmen. | A | teilweise (`listen`: nur 0,8–1,0) |
| H3 | Mehrere Stimmen, fremde Akzente | „folgt komplexen Gesprächen zwischen Dritten, auch bei unvertrautem Akzent“ | Ein Meeting oder Telefonat mit 2–3 Stimmen, jede mit einer anderen Sprachausgabe (en-US, en-GB, en-IN oder en-AU, je nachdem, welche Stimmen das iPhone hat). Fragen: Wer will was? Wer ist dagegen? Was wurde entschieden? | B | nein (nur ein Sprecher, `src/prompts/listeningText.ts`: „ONE speaker“) |
| H4 | Hören, Notizen, Follow-up-Mail | Notizen: „so genau, dass andere sie nutzen könnten“ | Einen 90-Sekunden-Call hören, Stichworte tippen, dann eine Follow-up-Mail mit 80 Wörtern schreiben. Die KI prüft, ob alle Vereinbarungen drin sind. | B | nein |
| H5 | Diktat | Genauigkeit bei schnell verbundener Sprache | Vorhanden. Für C1: kürzere, schnellere Sätze, die Lücken liegen bei den kleinen Funktionswörtern. | C | ja (`drills`) |
| H6 | Echte Quellen (Feed, Podcasts) | Viel Input nebenbei | Der Feed des Tagesauftrags. Dazu kann Emrah „20 Min. Podcast gehört“ als Extra eintragen. | C | teilweise (`discover`) |

### 1.5 Lesen

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| L1 | Kurzer Business-Text mit Markieren | Lesen: „versteht lange, komplexe Texte im Detail, auch Haltungen und unausgesprochene Meinungen“ | 150–300 Wörter zum Wochenthema und eine Verstehensfrage mit Beleg. Dann 2–3 Wendungen markieren, sie gehen mit Ursprungssatz in den Eingangskorb. | A | ja (`read`) |
| L2 | Posteingang: Kundenmail lesen und beantworten | Korrespondenz: „erkennt offene und unterschwellige Haltungen in Mails“, dazu Schreiben | Eine realistische Kundenmail mit verstecktem Einwand. Frage 1: Was will der Kunde eigentlich? (ein Satz auf Deutsch reicht). Dann schreibt Emrah die Antwort. Rückmeldung: Anliegen getroffen? Ton? Höchstens 3 Korrekturen. | A | nein |
| L3 | Zusammenfassen | Vermitteln: „fasst Informationen und Argumente komplexer Texte klar zusammen“ | Eine Zusammenfassung in 3 Sätzen. Die KI prüft Kernpunkte und Missverständnisse. | B | ja (`read`) |
| L4 | Eigener Text als Leseeinheit | Nähe zum Beruf | Einen Artikel aus der Branche einfügen. Glossar und Fragen auf Knopfdruck. | B | teilweise (`read`, `discover`) |

### 1.6 Schreiben

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| S1 | Mail (Nachfassen, Absage, Verzögerung, Angebot) | Korrespondenz: „schreibt formelle Korrespondenz gut formuliert und genau“ | Aufgabe mit Empfänger und Zweck, 80–150 Wörter. Wendungen lassen sich per Tipp einfügen. Rückmeldung im Einheitsstil, dann „Nochmal, aber besser“. | A | ja (`write`, `business/MailRefiner`) |
| S2 | Executive Summary (Kurzfassung für die Geschäftsführung) | Berichte: „klar gegliedert, hebt die entscheidenden Punkte hervor“ | Ein langer interner Stand, auch auf Deutsch, wird zu 5 Sätzen: Ergebnis zuerst, eine Zahl, eine Empfehlung, welche Entscheidung nötig ist. Rückmeldung zu Reihenfolge und Länge, dazu eine Aufwertung. | B | teilweise (`write`: Gattung „summary“ ohne eigene Maske) |
| S3 | Abschnitt eines Angebots (Proposal) | Argumentieren: „baut Argumente systematisch mit Gründen und Beispielen auf“ | Abschnitt „Why us“ oder „Next steps“ in 150 Wörtern: Nutzen statt Produktmerkmale. | B | teilweise (`write`: Gattung „proposal“) |
| S4 | Slack/Teams | Online-Austausch: „versteht Absichten und kulturelle Untertöne“ | 1–3 Zeilen Antwort auf die Nachricht eines Kollegen. Rückmeldung nur zu Ton und Länge. | B | teilweise (`tones`) |
| S5 | LinkedIn | Register, Wirkung | Kontaktanfrage mit 300 Zeichen, Nachricht nach der Messe oder ein kurzer Beitrag. Rückmeldung: persönlich genug? zu verkäuferisch? | B | nein |
| S6 | Eine Botschaft, drei Tonlagen | „passt die Förmlichkeit an und hält das Register durch“ | vorhanden | A | ja (`tones`) |
| S7 | Halb so lang | Genauigkeit, knapper US-Stil | Eine hölzerne oder eigene Mail auf die Hälfte kürzen. Der Wortzähler zeigt das Ziel, die KI prüft, ob alle Kernaussagen erhalten sind. | B | teilweise (`business/MailRefiner`, nur über Bausteine) |
| S8 | Deutsch → Englisch vermitteln | Vermitteln: „fasst lange Texte aus Sprache A in Sprache B zusammen“ | Eine deutsche interne Notiz oder Kundenmail wird zur englischen Kurzinfo an den UK-Partner. Nicht Wort für Wort übersetzen, sondern für den Empfänger aufbereiten. | B | nein |
| S9 | Rückübersetzung | Unterschied bemerken: eigener Satz ↔ Muster | Emrah liest eine gute Muster-Mail, dann wird sie ausgeblendet und nur deutsche Stichworte bleiben stehen. Er schreibt die Mail auf Englisch neu. Beide Fassungen stehen nebeneinander, Unterschiede sind markiert. | B | nein |

### 1.7 Sprechen und Interaktion

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| I1 | „Sag es“ | Zusammenhängend sprechen | Vorhanden. Neu: „Laut zuerst“. Ein Zeitbalken läuft, Emrah spricht laut (mit Mikrofon, wo es geht) und tippt danach. Die bessere Fassung kommt per Sprachausgabe zum Nachsprechen (P2). | A | ja (`say`) |
| I2 | Flüssigkeit 90/60/45 | Flüssigkeit: „spontan, fast mühelos“ | Vorhanden. Neu: Messwert „Wörter pro Minute“ im 45-Sekunden-Durchgang. | A | ja (`fluency`) |
| I3 | Einwand-Training | Diskussion: „reagiert flüssig, spontan und passend auf Gegenargumente“ | 5 Einwände nacheinander (Preis, „schicken Sie mir Unterlagen“, Wettbewerber, Timing, Sicherheit). Je 10 s Bedenkzeit und 30 s Antwort. Das Muster steht sichtbar da: anerkennen · nachfragen · antworten · absichern. Rückmeldung: Muster eingehalten? Die beste Antwort geht in die Phrasenbank. | A | teilweise (`business/Playbook`: Entscheidungsbäume; `say`: einzelne Situationen) |
| I4 | Rollenspiel mit Analyse | Interaktion, Verhandeln | Vorhanden. Neu: Zeitlimit je Zug (45 s, abschaltbar), die Top-3-Fallen im Blick, Abschlussbericht mit „Nochmal, aber besser“. | A | ja (`speak`) |
| I5 | Verhandlungs-Baukasten | Vermitteln im Konflikt: „fragt diplomatisch, was jede Seite braucht und aufgeben könnte“ | Vorhanden (Entscheidungsbäume). Neu: ein kurzer Anwenden-Schritt, in dem Emrah selbst formuliert. | A | ja (`business/Playbook`) |
| I6 | Mein nächster Termin | alle Beschreibungen | vorhanden | A | ja (`meeting`) |
| I7 | Pitch in 30, 60 und 120 Sekunden | Vortrag: „klar gegliedert, mit Hauptpunkten und Beispielen“ | Ein Elevator Pitch in drei Längen mit derselben Kernbotschaft. Erst das Muster nachsprechen, dann die eigene Fassung. | B | teilweise (`business/PitchCoach`) |
| I8 | Zahlen und Grafiken präsentieren | „erklärt Daten aus Diagrammen zuverlässig und genau“ | Ein einfaches Balken- oder Liniendiagramm erscheint. Emrah beschreibt es in 60 s: Trend, Vergleich, Folgerung (more than doubled, leveled off, a fraction of). | B | nein |
| I9 | Heißer Stuhl (Fragen nach der Präsentation) | Vortrag: „geht spontan und fast mühelos auf Zwischenfragen ein“ | 3 kritische Fragen, je 10 s Bedenkzeit. Zeit zu gewinnen ist erlaubt und wird gelobt. | B | nein |
| I10 | Small Talk | Konversation: „flexibel für soziale Zwecke, auch mit Humor und Anspielungen“ | 4–6 Gesprächszüge mit einer Figur (Messe, Dinner, die 2 Minuten vor dem Call). Ziel: 2 Anschlussfragen stellen, eine persönliche Geschichte erzählen, elegant aussteigen. Die Rückmeldung betrifft den Gesprächsfluss, nicht die Grammatik. | B | teilweise (`say`: Alltag; `speak`: Szenen) |
| I11 | Telefon- und Videocall | Telekommunikation: „nutzt Telefon und Video für fast alle beruflichen Zwecke wirksam“ | Eine Szene mit Störungen: Der Ton bricht ab, ein Name muss buchstabiert werden, ein Missverständnis wird geklärt, am Ende werden die nächsten Schritte zusammengefasst. | B | nein |
| I12 | Meeting leiten | Gespräch steuern: „lenkt diplomatisch um und verhindert, dass einer dominiert“ | Rollenspiel mit zwei Figuren: Die eine schweift ab, die andere unterbricht. Aufgabe: eröffnen, das Wort geben, zum Thema zurückholen, zusammenfassen. | B | teilweise (`business/Playbook` „Meeting steuern“, nur Wendungen) |
| I13 | Zeit gewinnen und das Wort halten | Sprecherwechsel: „leitet Beiträge passend ein, gewinnt Zeit, hält das Wort“ | Zu einer harten Frage sagt Emrah nur den Einstieg („That's a fair question …“, „Let me put it this way …“). 5 Fragen in 2 Minuten. | B | nein |
| I14 | Nochmal, aber besser / Reparatur-Sätze | Selbstkorrektur, Korrektheit | Vorhanden. Neu: überall gleich, also in „Sag es“, Schreiben, Rollenspiel, Tonlagen und 90/60/45. | A | ja (`repair`) |

### 1.8 Prüfungsnah und Fortschrittsnachweis

| # | Typ | Trainiert (GER C1) | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| X1 | Monatliche Vergleichsaufgabe | Gesamtbild | Dieselbe Sprech- und Schreibaufgabe wie vor 4 Wochen, mit gleicher Zeit. Beide Fassungen stehen nebeneinander, Claude beschreibt in Worten, was besser wurde. Drei Messwerte: Wörter pro Minute (im 45-s-Durchgang), Fallen pro 100 Wörter, frei benutzte Wendungen. | A | nein |
| X2 | Can-Do-Sätze mit Belegen | GER-Kannbeschreibungen | 10–12 Sätze aus seinem Beruf. Ein Satz gilt erst als erreicht, wenn 2 echte Leistungen ihn mit Zitat belegen. | A | teilweise (`progress`: Belege und zusätzlich Selbstmarkierung) |
| X3 | Wochen-Check | Abruf ohne Hilfe | vorhanden, sonntags 5 Minuten | B | ja (`check`) |
| X4 | KI-Einschätzung | Urteil über das Niveau | vorhanden, einmal im Monat gründlich | B | ja (`progress`) |
| X5 | C1-Probe | Nähe zur Prüfung | Alle 8 Wochen freiwillig 20 Minuten in Formaten wie C1 Advanced: Wortbildung, Satz-Umformung, Bericht oder Angebot, 1 Minute am Stück sprechen. | C | nein |
| X6 | Wortschatztest | Umfang des Wortschatzes | einmal im Quartal | C | ja (`vtest`) |

### 1.9 Werkzeuge

| # | Typ | Wofür | So sieht es in der App aus | Prio | Heute |
|---|---|---|---|---|---|
| T1 | Wochenthema wählen | Relevanz, eigene Wahl | Montags kommt ein Vorschlag aus Termin, Preply oder der Themenliste (Abschnitt 3). Emrah bestätigt ihn oder wählt selbst. Alles in der Woche hängt daran. | A | nein (im Code kein Wochenthema) |
| T2 | Claude fragen und Übersetzer mit Register | Hilfe im Moment | Auf jedem Bildschirm oben rechts. „In den Wortschatz“ steht direkt am Ergebnis. | A | ja (`companion`) |
| T3 | Wort-Antippen | Wörter bemerken und sammeln | überall | A | ja (`lookup`) |
| T4 | Preply-Brücke und Wochenziele | Lehrer und App arbeiten am Gleichen | Stunde vorbereiten, Import, Wochenfokus mit höchstens 5 Zielen | A | ja (`preply`, `patterns`) |
| T5 | Meine Phrasenbank | „benutzt die Wendungen des eigenen Fachgebiets“ | Emrahs eigene, geprüfte Formulierungen, sortiert nach Situation: Einstieg, Bedarf erfragen, Preiseinwand, Abschluss, Anfang und Ende einer Mail. Vor dem Call in 2 Minuten durchsehen und anhören. Sie füllt sich aus Aufwertungen, Einwand-Training und Termin. | B | nein |
| T6 | Kurs-Lektionen | Material | Werden Input-Material für die Wochenthemen, keine Pflicht mehr. | C | ja (`course`) |
| T7 | Satzbau, Sprint | Abwechslung | nur noch als Extra | C | ja (`drills`) |

---

## 2. Rhythmus: Tag, Woche, Monat

### 2.1 Täglich: eine geführte Einheit, ein Knopf „Los“ (25–30 Min.)

| Block | Min. | Inhalt | Status |
|---|---|---|---|
| 1 Wiederholen | 6–8 (gedeckelt) | Zuerst Reparatur-Sätze, dann Karten zum Wochenthema, dann fällige Karten. Frische Karten per Aufdecken (Anki), gefestigte per Tippen. Höchstens 8 neue Karten. Was übrig bleibt, kommt morgen. | Pflicht |
| 2 Input | 4–5 | Text oder Hörstück zum Wochenthema, eine Frage, 2–3 Wendungen merken, 3 Sätze nachsprechen (Shadowing). | Pflicht, kurz |
| 3 Aufgabe | 8–10 | Das Format laut Wochenplan. Ziel: die gemerkten Wendungen und das Werkzeug der Woche benutzen. | Pflicht |
| 4 Fokus | 3–4 | Höchstens 3 Korrekturen: Hinweis → Versuch → Lösung. Ist ein Fehler eine Deutsch-Falle, folgt ein Mini-Drill mit 3 gemischten Sätzen. | Pflicht |
| 5 Nochmal, aber besser | 2–3 | Aus dem Kopf neu formulieren, beide Fassungen nebeneinander. Reparatur-Karten entstehen automatisch. | Pflicht |

- **Ohne KI** zählt die Aufgabe trotzdem. Block 4 zeigt dann eine Musterlösung zum Selbstvergleich.
- **Umsetzungshinweis:** Den Input-Text erzeugt Claude nach dem Tipp auf „Los“ im Hintergrund, während Block 1 läuft. Das ist eine ausdrückliche Handlung, und es entsteht keine Wartezeit. platform-guard soll das gegen `sample.d.ts` bestätigen.
- **Angebot, sichtbar als Extra:**
  - noch eine Kartenrunde (10/20)
  - freies Rollenspiel
  - Aussprache-Minute (Wortbetonung, Zahlen)
  - Phrasenbank anhören
  - mehr Lesen oder Hören
  - Claude fragen

### 2.2 Wöchentlich

| Tag | Aufgabe (Block 3) | Input (Block 2) | Dazu |
|---|---|---|---|
| Mo | Wochenthema bestätigen, dann „Sag es“ zum Thema (Ausgangslage der Woche) | Lesen | Wochenfokus mit höchstens 5 Zielen: 3 Fallen, 1 Werkzeug, 1 Preply-Ziel |
| Di | 90/60/45 mit Frage A | Hören (Tempo-Leiter) | – |
| Mi | Posteingang: Kundenmail lesen und beantworten. Im Wechsel: Executive Summary, Slack/LinkedIn, Tonlagen, Deutsch → Englisch | Die Mail ist der Input | – |
| Do | Einwand-Training zum Thema oder Generalprobe für einen Termin | Hören (Dialog oder Meeting mit mehreren Stimmen) | – |
| Fr | 90/60/45 wieder mit Frage A | Lesen | Wörter pro Minute gegen Dienstag |
| Sa | Rollenspiel zum Thema, 10–15 Min. (ersetzt Block 2) | – | Nachbesprechung → Karten und Phrasenbank |
| So | Ruhetag oder Wochen-Check (5 Min.) | – | Wochenbericht in 5 Sätzen, fertige Nachricht an den Preply-Lehrer |

**Mischung Beruf und Alltag:** An 2 Tagen pro Woche ist der Input Alltag (Feed, Freizeit). Zusammen mit den 4 Alltagsthemen ergibt das etwa zwei Drittel Beruf und ein Drittel Alltag.

**Preply (2–4 Stunden pro Woche) verschiebt den Plan:**
- **Tag vor der Stunde:** Die Aufgabe ist die Vorbereitung: 3 Dinge, die ich sagen will, die 3 Wochenziele, eine App-Aufgabe für die Stunde (z. B. die Einwand-Serie mit dem Lehrer als CFO).
- **Tag der Stunde:** nur Block 1 plus 3 Minuten Aufwärmen (Phrasenbank nachsprechen). Die Stunde zählt als Extra.
- **Tag nach der Stunde:** Block 2 ist der Import der Stunde (daraus werden Karten und Reparatur-Sätze). Block 3 ist „Sag es“ mit dem Stoff der Stunde.
- **Bei 3–4 Stunden:** Die Stunden übernehmen das Rollenspiel am Samstag und einen 90/60/45-Tag. Output in der App gibt es trotzdem an mindestens 3 Tagen.
- **Vorschlag für die Stunden selbst:**
  - Stunde 1: Generalprobe zum Wochenthema, der Lehrer spielt das Gegenüber.
  - Stunde 2: freies Gespräch oder Alltag, dazu Aussprache.
  - Stunde 3–4: eine Präsentation oder Mail live überarbeiten.

### 2.3 Monatlich und im Quartal
- **Ein Thema pro Woche:** 16 Themen dauern 4 Monate. Danach folgt ein zweiter Durchgang mit höheren Anforderungen: schwierigeres Gegenüber, schnelleres Tempo, längere Texte.
- **Letzte Woche im Monat:** Die Vergleichsaufgabe (X1) ersetzt den Freitag (dieselbe Frage wie vor 4 Wochen) und den Mittwoch (dieselbe Mail-Aufgabe).
- **Fallen-Bilanz:** Eine Falle, die 4 Wochen lang in freien Texten nicht mehr vorkommt, ist erledigt. Die nächsthäufige rückt nach.
- **Can-Do und Einschätzung:** Can-Do-Belege sichten, gründliche KI-Einschätzung.
- **Karten aufräumen:**
  - Karten, die dreimal hintereinander „Leicht“ bekommen haben, bevor sie fällig waren: Die App fragt, ob sie archiviert werden sollen.
  - Den Eingangskorb sichten.
- **Mit Preply abstimmen:** Themen der nächsten 4 Wochen mit dem Lehrer abstimmen. Die App erzeugt die Nachricht.
- **Im Quartal:** Wortschatztest, dazu freiwillig die C1-Probe.

---

## 3. Sechzehn Wochenthemen

Aufteilung: 11 Themen aus dem Beruf, 1 Brückenthema (Networking), 4 aus dem Alltag.

Vorgeschlagene Reihenfolge, damit nicht zwölf Berufswochen am Stück kommen: 1, 2, 13, 3, 4, 14, 5, 6, 12, 7, 8, 15, 9, 10, 16, 11. Ein echter Termin oder ein Preply-Thema hat Vorrang.

| # | Thema | Kernaufgabe der Woche | Sprachfokus: Werkzeug · Falle | Wendungen (US) |
|---|---|---|---|---|
| 1 | Erstgespräch: Bedarf klären | Call mit einem Interessenten: 5 offene Fragen stellen, dann den Bedarf zusammenfassen | Fragen und indirekte Fragen · Wortstellung („Can you tell me how many users you have?“), fehlendes „do“ | walk me through your current process · What's prompting you to look at this now? · What would success look like for you? · So if I'm hearing you correctly, … · Who else is involved in the decision? |
| 2 | Den Wert einfach erklären (Cloud-DMS/ECM) | Elevator Pitch in 30/60/120 s für Nicht-Techniker | Überleitungen, Nutzen statt Merkmale · actual ≠ aktuell, possibility ≠ Möglichkeit (option) | In a nutshell, … · What that means for you is … · a single source of truth · instead of digging through folders · from day one |
| 3 | CFO: Preis, ROI, Business Case | Einen Preiseinwand entkräften und den ROI mit einer Zahl erklären | Hedging, Zahlen · „make a discount“ → give/offer; Milliarde = billion | I understand it may seem high at first glance · total cost of ownership · pays for itself within 18 months · roughly a third of · over a three-year period |
| 4 | IT-Leitung: Sicherheit, DSGVO, GoBD, Datenstandort | Einem skeptischen IT-Leiter antworten, ohne zu viel zu versprechen | Genaue Zusagen (will/can/may), Passiv für Abläufe · Sicherheit = security/safety/certainty | hosted in EU data centers · encrypted at rest and in transit · role-based access · audit-proof archiving · Let me double-check that and get back to you |
| 5 | E-Rechnung und ViDA als Verkaufsanlass | Einem Geschäftsführer in 2 Minuten erklären, warum er jetzt handeln sollte | Fristen und Zukunft · bis = by/until, seit = since/for | as of January 1 · the mandate is being phased in · get ahead of the deadline · It's not a question of if, but when · stay compliant |
| 6 | Demo und Präsentation vor Entscheidern | 3 Folien sprechen, eine Grafik erklären, 3 harte Fragen beantworten | Wegweiser in der Rede, Betonung durch Satzbau („What really matters is …“) · Dezimalpunkt statt Komma | Let me walk you through … · This brings me to … · more than doubled · I'll come back to that in a minute · That's a great question |
| 7 | Verhandeln: Rabatt gegen Laufzeit | Rollenspiel mit dem Einkauf: Zugeständnis nur gegen Gegenleistung | Bedingungssätze, diplomatische Distanz · zu direkt („This is not possible.“) | If you could commit to three years, we could … · Where do you have some flexibility? · That's not something I can agree to today · meet you halfway · Let's park that for now |
| 8 | Partner und Vertriebspartner (UK/US) | Ein Systemhaus als Reseller gewinnen: Pitch und Nachfass-Mail | Überzeugen, 2. Konditional; britisches Understatement verstehen · provision ≠ commission, prospect ≠ Prospekt | What's in it for you is … · recurring revenue · a mutually beneficial partnership · enablement and co-marketing · Would you be open to a quick call? |
| 9 | Wenn es brennt: Verzögerung, Eskalation, Beschwerde | Mail an den Projektleiter und Call mit einem verärgerten Kunden | Present Perfect für den aktuellen Stand, Verantwortung übernehmen · „since two weeks“, zu steif („We will inform you“) | I owe you an apology · We've identified the root cause · Here's what we're doing about it · I'll keep you posted · to make up for it |
| 10 | Intern führen: Pipeline, Forecast, Kickoff | Ein Meeting eröffnen, steuern und abschließen (mit zwei Figuren) | Gespräch steuern, Überleitungen · „make a meeting“ → hold/run a meeting | Let's get started · Can I just jump in here? · Let's take that offline · Who's going to own this? · To wrap up, … |
| 11 | Bestandskunden: Verlängerung, Upsell, Referenz | Verlängerungsgespräch führen und um eine Referenz bitten | Indirekte Bitten („I was wondering if …“) · chance ≠ opportunity | Now that you've been using it for a year, … · How has it been working for your team? · I'd love to explore whether … · Would you be open to being a reference? · No pressure at all |
| 12 | Messe, Networking, LinkedIn (Brücke) | Gespräch am Messestand und LinkedIn-Nachricht danach | Small-Talk-Rituale, Anschlussfragen, lockerer Ton · „Nice to meet you“ (erstes Treffen) vs. „Nice to see you“ | What brings you to the show? · How's business on your end? · Great connecting with you at … · Let's stay in touch · I'll let you get back to it |
| 13 | Unterwegs: Hotel, Flug, Mietwagen | Höflich, aber bestimmt reklamieren | Höflich und bestimmt, Modalverben · bekommen ≠ become | I was wondering if there's anything you could do · That's not what I booked · Could you rebook me on the next flight? · I'd appreciate it if … · I'd like to get this straightened out |
| 14 | Geschichten erzählen: Erlebnisse und Kundenerfolge | Eine 2-Minuten-Geschichte: Wochenende, Reise oder Erfolgsgeschichte eines Kunden | Erzählzeiten (Past Simple, Past Continuous, Past Perfect) · „I have been in London last week“ | So there I was … · It turned out that … · Long story short, … · The funny thing is … · In the end, … |
| 15 | Nachrichten, Tech und Meinung (KI, Wirtschaft, Sport) | Eine Meinung vertreten und auf ein Gegenargument eingehen (90/60/45) | Meinung abstufen, zustimmen und widersprechen · eventually ≠ eventuell | I see where you're coming from, but … · I'd argue that … · It's a bit more nuanced than that · That's a fair point · Time will tell |
| 16 | Alltag regeln: Arzt, Wohnung, Handwerker, Behörde | Ein Telefonat und eine Beschwerde-Mail | Beschreiben und umschreiben (W10) · Rezept = prescription, Kaution = deposit | I've been having trouble with … · It's been going on for about a week · Could you take a look at …? · What are my options? · Would it be possible to …? |

---

## 4. Die 10 wichtigsten Lücken und didaktischen Fehler der heutigen App

**1. Kein Wochenthema, keine geführte Einheit** · Aufwand groß (das ist der Kern des Neubaus)
- **Heute:** Die Pflicht besteht aus Wiederholen, Lektion und einem Kanal, jedes einzeln angesteuert. Im Code gibt es kein Wochenthema. Wendungen aus dem Input kommen in der Aufgabe nicht vor.
- **Warum wichtig:** Behalten und Übertragen entstehen, wenn Emrah derselben Wendung wiederbegegnet, vom Lesen über das Sprechen bis zur Karte (Kap. 2.5 „kombinierte Aufgaben“).
- **Vorschlag:** Die Einheit aus 2.1 mit Wochenthema (T1). Das Thema steuert Input, Aufgabe, Reihenfolge der Karten und das Werkzeug der Woche.

**2. Output nicht jeden Tag und fast immer im gleichen Format** · Aufwand mittel
- **Heute:**
  - `isSayDay` (`src/domain/plan/channels.ts`) würfelt 4–5 Sag-es-Tage pro Woche.
  - An den übrigen Tagen ist die Pflicht die Lektion (12 Min. gelenkte Übung) plus ein Kanal, z. B. Grammatik.
  - 90/60/45, Tonlagen, Termin und Rollenspiel sind nur Angebote unter Sprechen → Training.
- **Warum wichtig:** Von B2 zu C1 kommt man durch Produzieren. Immer dasselbe Format (3–6 Sätze) wird schnell Routine ohne Steigerung.
- **Vorschlag:** Jeden Tag eine Output-Aufgabe im festen Wochenplan (2.2). Die Lektion ist keine Pflicht mehr.

**3. Sprechen wird getippt** · Aufwand klein bis mittel
- **Heute:** „Sag es“ und Tonlagen sind reine Tippmasken. Ein Mikrofon gibt es nur im Rollenspiel, bei 90/60/45 und im Pitch-Coach.
- **Warum wichtig:** Beim Tippen bleibt Zeit zum Feilen. Das trainiert Schreiben, aber weder Flüssigkeit noch Aussprache.
- **Vorschlag:** „Laut zuerst“ in jeder Sprechaufgabe: Zeitbalken, laut sprechen (Mikrofon, wo es wirklich geht), dann tippen, was man gesagt hat. Am Ende die bessere Fassung anhören und nachsprechen.
- **Ehrlich:** Ohne verlässliche Spracherkennung prüft die App nur den Inhalt, nicht die Aussprache.

**4. Schreiben: Rückmeldung zu breit, keine echten Posteingangs-Aufgaben** · Aufwand klein (Vorlage) plus mittel (neue Aufgaben)
- **Heute:**
  - `src/prompts/writingReview.ts` erlaubt bis zu 12 Fehler, 5 Punktwerte und eine CEFR-Stufe je Text.
  - Die persönlichen Deutsch-Fallen fehlen dort. Die Merkliste geht nur an say-check, turn-analysis und preply-prep.
  - Die Gattungen sind allgemein. Es gibt keine Antwort auf eine eingehende Kundenmail, kein LinkedIn und kein Vermitteln von Deutsch nach Englisch.
- **Warum wichtig:** Zwölf Korrekturen liest niemand ein zweites Mal. Ein guter Lehrer wählt die 3 aus, die immer wiederkommen.
- **Vorschlag:** Einheitlicher Rückmeldestil mit Fallen zuerst. Die CEFR-Stufe je Text fällt weg und steht nur noch im Monatsvergleich. Neu dazu: L2, S2, S5, S8.

**5. Kein Anki-Modus, Kollokationen nur als Auswahl** · Aufwand mittel
- **Heute:** Emrahs ausdrücklicher Wunsch nach Anki fehlt. Der Katalog in `src/domain/srs/modes.ts` enthält 5 Auswahl-Arten (mc_en, mc_de, match, listen_mc, colloc).
- **Warum wichtig:** Für Wendungen ist bloßes Wiedererkennen verschenkte Zeit. Aufdecken ist die schnellste echte Form, etwas aus dem Gedächtnis zu holen.
- **Vorschlag:**
  - Anki-Modus als Standard in Block 1, Tippen ab einer gefestigten Karte.
  - Kollokationen werden nur getippt (W3).
  - Auswahl gibt es nur noch beim allerersten Kontakt mit Einzelwörtern, die Emrah nur verstehen muss.

**6. Tiefe im Wortschatz fehlt als Übungsform** · Aufwand mittel (vor allem Inhalte, lokal ohne KI prüfbar)
- **Heute:** Keine Phrasal Verbs, keine Wortfamilien, keine Register-Stufen, kein Umschreiben. Deutsch-Fallen entstehen nur aus eigenen Fehlern, der klassische Startsatz fehlt (actual, eventually, provision, prospect, Milliarde, information ohne -s).
- **Warum wichtig:** C1 unterscheidet sich von B2 vor allem durch treffsichere, genaue Wortwahl.
- **Vorschlag:** W3–W6, der Startsatz für W9 und W10.

**7. Hören ist zu leicht und zu einseitig** · Aufwand mittel (Dialog-Vorlage, eine Stimme je Sprecher)
- **Heute:** Ein Sprecher, eine US-Stimme, Tempo 0,8–1,0 (`src/prompts/listeningText.ts`).
- **Warum wichtig:** C1 heißt natürliches Tempo, fremde Akzente und Gespräche zwischen anderen verstehen. Emrahs Partner sitzen in UK und US.
- **Vorschlag:** H2, H3 und H4.

**8. Aussprache wird fast nicht trainiert** · Aufwand klein bis mittel
- **Heute:** Die Lautschrift mit Betonungszeichen ist eingebaut (`src/content/pron/us-ipa.json`), erscheint aber nur im Nachschlagen. Shadowing steckt versteckt im Hörtext.
- **Warum wichtig:** Falsch betonte Lehnwörter (DokuMENT, StrateGIE, TechnoloGIE) und falsche Zahlen (Billion) stören im Kundengespräch mehr als kleine Grammatikfehler.
- **Vorschlag:** P2 als fester Minuten-Baustein in der Einheit, dazu P1 und P4.

**9. Kein spontanes Sprechen unter Druck** · Aufwand mittel
- **Heute:** Das Rollenspiel hat kein Zeitlimit je Zug. Es gibt keine Einwand-Serie und keine Fragerunde nach einer Präsentation.
- **Warum wichtig:** Im echten Call hat man 2 Sekunden, nicht 2 Minuten. Genau da bricht B2-Sprache ein.
- **Vorschlag:** I3, I9, I13 und ein Zeitlimit im Rollenspiel.

**10. Fortschritt ist am eigenen Output nicht sichtbar** · Aufwand mittel
- **Heute:** Keine monatliche Vergleichsaufgabe. Keine Messwerte wie Wörter pro Minute oder Fallen pro 100 Wörter. Can-Do-Sätze lassen sich auch selbst abhaken.
- **Warum wichtig:** Auf dem langen Plateau zwischen B2 und C1 motiviert der Vergleich „mein Satz heute gegen meinen Satz vor 4 Wochen“, nicht ein Zähler.
- **Vorschlag:** X1. Can-Do nur mit Belegen. Der Wochenbericht nennt, wie sich die Fallen entwickeln.

**Reihenfolge, wenn die 12 Stunden knapp werden:**
1. Einheit mit Wochenthema und festem Wochenplan (1, 2)
2. Anki-Modus (5)
3. Einheitlicher Rückmeldestil in allen Vorlagen (4)
4. Einwand-Training und Posteingang (9, 4)
5. „Laut zuerst“ mit Nachsprechen der besseren Fassung und die Tempo-Leiter (3, 7, 8)
6. Startsatz der Fallen und Kollokationen tippen (6)
7. Vergleichsaufgabe (10)

Danach folgen die B-Punkte aus Abschnitt 1.

---

**Gelesene Dateien:**
- /home/user/lingo-engine-x/docs/konzept/lernarchitektur.md
- /home/user/lingo-engine-x/docs/lernberatung-lehrer.md
- /home/user/lingo-engine-x/docs/produktkonzept.md
- /home/user/lingo-engine-x/docs/altapp-funktionsabgleich.md
- /home/user/lingo-engine-x/docs/konzept/briefing.md
- /home/user/lingo-engine-x/docs/auftrag.md (Kap. 1, 5, 6, 7)
- /home/user/lingo-engine-x/src/domain/plan/buildPlan.ts
- /home/user/lingo-engine-x/src/domain/plan/channels.ts
- /home/user/lingo-engine-x/src/domain/srs/modes.ts
- /home/user/lingo-engine-x/src/prompts/writingReview.ts
- /home/user/lingo-engine-x/src/prompts/writingPrompt.ts
- /home/user/lingo-engine-x/src/prompts/sayCheck.ts
- /home/user/lingo-engine-x/src/prompts/listeningText.ts
- /home/user/lingo-engine-x/src/content/say/situations.ts
- /home/user/lingo-engine-x/src/content/fluency/questions.ts
- /home/user/lingo-engine-x/src/content/c1/toolkit.json
- /home/user/lingo-engine-x/src/content/pron/us-ipa.json
- /home/user/lingo-engine-x/src/features/listen/TranscriptView.tsx
