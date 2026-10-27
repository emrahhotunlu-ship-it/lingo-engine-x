# Recherche Design und Bedienung (Nora, Design-Leitung)

Stand: 27.10.2026 · Runde 1 des Relaunch-Teams · nur Recherche, keine Entscheidung.

**Lesehilfe:** Hinter jeder Aussage steht eine Quellennummer wie [Q12]. Die Nummern führen zu den Links in Abschnitt 9. Wo ich keinen Beleg gefunden habe, steht **[Vermutung]**. Dort spreche ich aus eigener Kenntnis oder schließe aus dem, was ich gesehen habe. „Ist-App“ meint die heutige Lingo-Engine X. Ihre Bildschirmfotos stammen aus dem UX-Audit vom 26.10.2026 [Q56].

---

## 1. Kurzfassung in 10 Punkten

1. **Die Besten zeigen genau einen nächsten Schritt.** Duolingo, Speak, Babbel und Busuu haben ihre Startseiten umgebaut, weil die Lernenden „mehr Führung, weniger Auswahl“ wollten. Heraus kam jeweils ein Pfad mit einer hervorgehobenen nächsten Lektion [Q1][Q19][Q23]. Die Ist-App hat dafür die richtige Idee (eine Heute-Karte). Sie verwässert sie aber durch Band, Datum, Serie und widersprüchliche Zahlen [Q56].
2. **Die Übung ist bei allen ein fester Rahmen.** Oben ein schmaler Balken, in der Mitte genau eine Aufgabe, unten ein breiter Knopf in der Daumenzone. Die Rückmeldung fährt als Band von unten hoch, und derselbe Knopf wird zu „Weiter“ [Q6][Q9]. Die Ist-App hat die Aktionsleiste, zeigt aber die Rückmeldung als lange Karte zum Scrollen [Q56].
3. **Brilliant ist das Vorbild für Erwachsene:** keine Videos, ein Gedanke pro Bildschirm, Rückmeldung, solange das Denken frisch ist, Erklärung zum Aufklappen, „überarbeiten statt nur rot“ [Q13][Q15]. Für Emrahs C1-Ziel passt dieser ruhige Ton besser als Duolingos Comic-Stil [Vermutung].
4. **Premium heißt weglassen.** Duolingos Grundsatz für den Umbau der Reiter: „Good design means knowing what to remove“ [Q2]. Linear hat 98 Farbvariablen auf 3 Eingaben reduziert [Q39]. Things wirkt durch Weißraum, fette Schrift und sparsame Farbe [Q40]. Die Ist-App hat rund 3.800 Zeilen CSS in 15 Flickschichten, viele Akzentfarben ohne klare Rolle und Textwände [Q56].
5. **Eine Akzentfarbe nur für die Handlung, getrennt von „richtig“.** Bei Duolingo trägt Feather Green die Haupthandlung [Q7], bei Blinkist ist Grün nur für Schlüsselhandlungen da [Q28]. Die Ist-App hat einen weißen bzw. schwarzen Hauptknopf ohne Marke, und „weiß ich nicht“ wird grün gezeigt [Q56].
6. **Laptop ist kein breites Handy.** Apple und Google schreiben vor, ab mittlerer Breite die Reiterleiste zur Seitenleiste oder Rail zu machen und Listen und Details nebeneinander zu zeigen [Q46][Q48][Q49]. Linear und Arc bauen ganz auf eine Seitenleiste [Q39][Q41]. Die Ist-App zeigt am Laptop eine Pillenleiste oben, eine zweite Symbolzeile und schmale Mittelspalten. Bei 2560 px sind zwei Drittel leer [Q56].
7. **Laptop heißt Tastatur.** Mochi schreibt das Tastenkürzel direkt auf den Knopf [Q34]. Things hat am Mac Kürzel und „Type Travel“ [Q40]. Die Ist-App hat Enter, T und ? schon eingebaut, zeigt sie aber kaum [Q56].
8. **Bewegung mit Federn, kurz und gedämpft.** Apple empfiehlt Federn mit Dauer und „Bounce“: 0 als Standard, 0,15 kaum spürbar, über 0,4 übertrieben [Q51][Q52]. Sinnvoll sind 150–300 ms für Bedienung; unter 100 ms wirkt es sprunghaft, über 1 s träge [Q53]. Die Ist-App wirkt statisch [Q56].
9. **Belohnung ohne Kitsch.** Apples Ringe sind eine einzige klare Aussage („geschlossen oder nicht“), dazu eine Wochenansicht und seit watchOS 11 Ruhetage, die die Serie nicht brechen [Q42][Q43]. Brilliant lässt die Serienzahl synchron zur Animation hochzählen [Q14]. Duolingo setzt große Momente nur bei Meilensteinen [Q3]. Die Fertig-Karte der Ist-App ist schon in dieser Art (Note gut). Die Endkarte nach einer Übung ist dagegen eine Textwand [Q56].
10. **Ist-Bewertung:** Optik 6 · Handy 5,5 · Laptop 4 · Motivation 5 · Tempo 5. Die größten Hebel: ein Übungsrahmen mit Rückmeldeband, eine eigene Laptop-Gestalt mit Seitenleiste und Tastatur, eine Farbrolle je Bedeutung, kurze Ergebnisse, Skelett statt leerem Start (Abschnitte 6 und 7).

---

## 2. Steckbriefe

Je App die sieben Fragen: **1** Übungssitzung · **2** Start und Navigation · **3** Handy gegen Desktop · **4** Design-System · **5** Bewegung · **6** Fortschritt und Belohnung · **7** Was „premium“ ausmacht.

### 2.1 Duolingo (Sprachen und Math)
1. **Sitzung:** Oben ein Fortschrittsbalken mit Schließen-X. Darunter die Aufgabe als Satz mit Wortbausteinen oder Eingabe. „Check“ ist gedimmt, bis etwas gewählt ist. Nach dem Prüfen fährt unten ein grünes oder rotes Band hoch („Great“, „Amazing“ oder die Lösung), der Knopf heißt dann „Continue“ bzw. „Got it“. Bei mehreren Treffern in Folge kommt ein Einblender („10 in a row“). Am Ende stehen XP, Genauigkeit und Zeit, Fehler kommen in einer Runde am Schluss noch einmal [Q6]. Am Web liegen Check und Continue rechts unten, Ton und Animation melden das Ergebnis [Q9].
2. **Start:** Seit 2022 ein einziger geführter Pfad mit Einheiten. Übung, Stories und Guidebook liegen im Pfad statt in eigenen Reitern. Grund: Nutzer wollten „more guidance … less complexity“ [Q1]. Die Reiter wurden später einheitlicher gemacht: Titel an fester Stelle, wenige Schriftstile, Überschriftengröße nach Zweck [Q2].
3. **Handy und Desktop:** Am Handy eine Reiterleiste unten. Im Web eine linke Seitenleiste mit den Bereichen und rechts eine Spalte mit Serie, Liga und Zielen; in der Übung Tastatur mit Enter und Ziffern [Vermutung, eigene Kenntnis; keine offizielle Quelle gefunden].
4. **Design-System:** Schriften Feather Bold (Marke) und DIN Round (Oberfläche), Feather Green `#58CC02` für die Haupthandlung [Q7][Q8]. Beim Umbau der Reiter wurden vier Richtungen getestet (Punchy, Soft, Modular, Flat). Gewählt wurde mehr Weißraum statt schwerer Behälter [Q2].
5. **Bewegung:** Figuren laufen als Rive-Zustandsmaschinen und sprechen lippensynchron [Q4]. Kleine Gesten wie Flügelschlag, Drehung und Lilys langsames Klatschen [Q5]. „Timing is everything in animation“ [Q3]. Haptik gilt intern als eigenes „Instrument“: sie liefert die Bässe, der Ton die Höhen [Vermutung; LinkedIn-Beitrag des Sounddesigners, URL nicht gesichert].
6. **Fortschritt:** Serie mit Meilensteinen nach einer Woche, einem Monat, 100 Tagen und einem Jahr, gestaltet wie „Power-ups“ im Spiel, dazu eine Teilen-Karte [Q3]. Meilensteine sprechen bewusst mehrere Sinne an [Q10]. Duolingo Math führt jede Idee mit einer Musteraufgabe ein. Grundsatz dort: „affordance-based design so learners know where to look“ [Q11]. Dazu kommen Ziehen und Zuordnen [Q12].
7. **Premium:** Nicht die Optik (bewusst verspielt), sondern die Konsequenz: ein Rahmen, ein Knopf, ein Pfad, sauberes Timing [Q1][Q3]. **Für Emrah nur die Mechanik übernehmen, nicht den Comic-Ton** [Vermutung].

### 2.2 Brilliant (sehr wichtig)
1. **Sitzung:** Kurze, interaktive Rätsel statt Videos. Ein Beispiel ist die Lektion zu Variablen mit Waagen-Rätseln [Q17]. Lehrweise: erst die Frage, dann das Verfahren; einfachster Fall zuerst; Rückmeldung, „solange das Denken frisch ist“; Fehler überarbeiten statt nur rot markieren. Ein Tutor (Koji) hilft [Q13]. Nach einer falschen Antwort hat die Erklärung selbst bedienbare Teile [Q17]. Der Knopf „Show Explanation“ ist belegt [Q18]. Inhalte, Hinweise und Rückmeldung zeigt eine eigene Layout-Engine Schritt für Schritt [Q15][Q16].
2. **Start:** Kurse als verzweigter Pfad, der zeigt, wo man steht und was als Nächstes kommt [Q17]. Farbcodierte Pfade [Q14].
3. **Handy und Desktop:** Dieselben Rätsel auf beiden Geräten. Am Desktop wirken die Lektionen als zentrierte Bühne mit viel Rand [Vermutung, eigene Kenntnis].
4. **Design-System:** Ein eigenes visuelles System für Rückmeldung, das in den Stellenanzeigen ausdrücklich genannt wird [Q15]. Statt allgemeiner Lade-Spinner gibt es Tangram-Animationen [Q17].
5. **Bewegung:** Rive für Serie und Pfade, kleine Dateien. Die Serienzahl zählt synchron zur Animation hoch [Q14].
6. **Fortschritt:** Abschluss mit Animation und XP-Zähler [Q17]. Die Spielmechanik wurde 2023 überarbeitet [Q14]. Ligen schalten sich erst später frei [Q17].
7. **Premium:** Ruhe. Ein Gedanke pro Bildschirm, keine Videos, Erklärung im Rätsel selbst [Q13][Q15]. Das ist das nächste Vorbild für eine Grammatik-Lektion, die sich nach Denken anfühlt und nicht nach Abfragen [Vermutung].

### 2.3 Speak
1. **Sitzung:** Kurze Lehrervideos und häufige Sprechübungen mit sofortiger Rückmeldung. Die richtige Aussprache wird gezeigt, die eigene Aufnahme lässt sich mit dem Vorbild vergleichen [Q20][Q22]. Rückmeldung ist oft zu knapp [Q21].
2. **Start:** Ein Kursweg aus Sprechblasen. Die nächste Lektion pulsiert blau, erledigte Blasen füllen sich und tragen ein Häkchen. Der Reiter „Practice“ liegt daneben und ist per Wischen erreichbar [Q19]. Auf der Startseite ist die nächste Kurs-Lektion von freiwilligen „Jump-in lessons“ getrennt [Q22]. Grundsatz aus Nutzersicht: „open the app, it tells you what to do next“ [Q20].
3. **Handy und Desktop:** Reine Handy-App, um die Stimme herum gebaut [Vermutung].
4. **Design-System:** Kräftiges Blau als Handlungsfarbe, sonst ruhig [Q19; Farbe nur für den Puls belegt, Rest Vermutung].
5. **Bewegung:** Der Puls der nächsten Blase ist der wichtigste Hinweis auf die nächste Handlung [Q19].
6. **Fortschritt:** XP, Serie und Ranglisten gibt es, sie stehen aber nicht im Vordergrund [Q22].
7. **Premium:** Erwachsener Ton, echte Lehrer im Video, ein Weg [Q20]. Der Auftrag (Kap. 2.7) nennt Speak ausdrücklich als Referenz.

### 2.4 Babbel
1. **Sitzung:** Eine Seite = ein Konzept, viel Weißraum. Am Ende ein Ergebnis mit Richtig und Falsch, die falschen Punkte werden nachgearbeitet. Was ablenkt, gilt als Risiko [Q24].
2. **Start:** Lernpfad mit Fortschrittskreis, weil die Lernenden mehr Richtung wollten, „was als Nächstes kommt“ [Q23].
3. **Handy und Desktop:** Web und App mit demselben Lektionsaufbau [Vermutung].
4. **Design-System:** Zurückhaltend, kaum Spielelemente [Q24].
5. **Bewegung:** Kaum belegt [Vermutung: sparsam].
6. **Fortschritt:** Kreis je Kurs [Q23].
7. **Premium und Warnung:** 36 % waren mit den Grammatik-Erklärungen unzufrieden, deshalb wurde ein eigener Grammatik-Guide gebaut [Q25]. **Lehre: Gute Grammatik-Erklärung ist ein eigenes Gestaltungsproblem, kein Textblock.**

### 2.5 Busuu
1. **Sitzung:** Übliche Lektionsfolge mit Rückmeldung [Vermutung].
2. **Start:** Ein Knopf „Next up“ und eine klarere Fortschrittsanzeige; mit iOS 5.0 rund ein Drittel weniger Schritte bis zum Inhalt [Vermutung; aus dem Busuu-Blog 2023, URL nicht gesichert].
3. **Handy und Desktop:** [Vermutung: Web mit Seitenleiste.]
4. **Design-System:** [keine Belege gefunden]
5. **Bewegung:** [keine Belege gefunden]
6. **Fortschritt und Ton:** Die Erinnerung stellt eine Wortfrage statt Schuldgefühl zu machen. Die Öffnungsrate stieg um 300 % [Q26].
7. **Premium:** Klarheit des „Was jetzt“ und ein freundlicher, erwachsener Ton [Q26].

### 2.6 Elevate
1. **Sitzung:** Über 40 kurze Spiele, jedes mit eigener Optik [Q27].
2. **Start:** Täglich ein Training aus wenigen Spielen [Q27; Details Vermutung].
3. **Handy und Desktop:** Reine Handy-App [Vermutung].
4. **Design-System:** Apple nannte sie 2014 App des Jahres wegen „polished design and plenty of attention to detail“ [Q27].
5. **Bewegung:** Jedes Spiel mit eigener, flüssiger Animation [Q27; Details Vermutung].
6. **Fortschritt:** „Session Highlights“ am Ende [Q27].
7. **Premium:** Liebe zum Detail in jedem Kleinteil [Q27]. Vorbild für Abwechslung **innerhalb** eines ruhigen Rahmens [Vermutung].

### 2.7 Headway und Blinkist (Lern-Inhalte in Häppchen)
1. **Sitzung:** Blinkist: Text in kurzen Abschnitten, mit eigener Serifenschrift für den Inhalt [Q28]. Headway: tägliche Aufgaben, der Weg führt vom Lesen zum Tun [Q30].
2. **Start:** Headway zeigt Einblicke zu der Uhrzeit, die der Nutzer gewählt hat [Q31].
3. **Handy und Desktop:** Hauptsächlich Handy [Vermutung].
4. **Design-System:** Blinkist setzt Farbe sparsam ein, Grün nur für Schlüsselhandlungen. Inhalt und Oberfläche haben getrennte Schriften [Q28].
5. **Bewegung:** [keine Belege gefunden]
6. **Fortschritt:** Headway mit Serie und Tagesaufgaben [Q30].
7. **Premium:** Typografie trägt die Marke. Für Lesetexte im Dunkelmodus nie reines Weiß auf reinem Schwarz verwenden [Q29].

### 2.8 LingQ (Lesen)
1. **Sitzung:** Lesen mit farbigen Wörtern: Blau = neu, Gelb = in Arbeit (verblasst mit dem Lernen), Weiß = bekannt. Eine Seite ist „fertig“, wenn nichts Blaues mehr da ist [Q32][Q33].
2. **Start:** Bibliothek und Lektionen [Q32].
3. **Handy und Desktop:** Am Desktop eine breite Leseansicht, am Handy seitenweise [Q33; Details Vermutung].
4. **Design-System:** Farbe als **Information über den eigenen Wissensstand**, nicht als Schmuck [Q32].
5. **Bewegung:** Seitenweises Blättern [Q33].
6. **Fortschritt:** Zähler der bekannten Wörter [Q32].
7. **Premium:** Optisch eher funktional. Stark ist die Idee, dass Fortschritt **im Text sichtbar** wird [Q32].

### 2.9 Mochi und Quizlet (Karteikarten)
1. **Sitzung:** Mochi ist ruhig und elegant, die Knöpfe tragen ihr Tastenkürzel im Text [Q34][Q35]. Quizlet dreht die Karte per Klick oder Pfeiltaste um, der Learn-Modus wiederholt Fehler [Vermutung, nur dünne Drittquellen].
2. **Start:** Mochi zeigt Stapel und fällige Karten [Q35].
3. **Handy und Desktop:** Mochi ist am Desktop stark und ganz mit der Tastatur bedienbar [Q34].
4. **Design-System:** Mochi ist zurückhaltend und textzentriert [Q34].
5. **Bewegung:** Das Umdrehen der Karte ist die einzige große Bewegung [Vermutung].
6. **Fortschritt:** Mochis Fortschrittsbalken ist zu schwach sichtbar, so eine Kritik [Q34].
7. **Premium:** Mochi wirkt durch Ruhe und Tastatur-Ehrlichkeit [Q34].

### 2.10 Khan Academy Kids (nur Interaktion)
Nur zur Interaktion angesehen. Große Ziehflächen, eine Figur zeigt, was zu tun ist, jede Berührung antwortet sofort mit Ton und Bewegung [Vermutung, eigene Kenntnis; keine belastbare Quelle gefunden]. **Lehre für Emrah:** Jede Berührung braucht eine sofortige, kleine Antwort, aber ohne Figur und ohne Kinder-Ton [Vermutung].

### 2.11 Linear
1. **Sitzung:** Entfällt (Werkzeug). Entsprechung ist der „Arbeitsfluss“: Liste links, Detail rechts, alles per Tastatur [Q39].
2. **Navigation:** Seitenleiste als Rückgrat. Beim Umbau wurden ihre Ausrichtung verbessert und das visuelle Rauschen verringert [Q39].
3. **Handy und Desktop:** Am Desktop dicht und mit Tastatur bedient [Q39]. Die Handy-App ist eigenständig und reduziert [Vermutung].
4. **Design-System:** Farben im LCH-Raum statt HSL, damit gleiche Helligkeit auch gleich hell aussieht. Das ganze Thema entsteht aus drei Eingaben (Grundfarbe, Akzent, Kontrast) statt 98 Variablen. Im Rahmen der Oberfläche wird kaum Farbe verwendet. Überschriften in Inter Display [Q39].
5. **Bewegung:** Kurz und funktional [Vermutung].
6. **Fortschritt:** Entfällt.
7. **Premium:** Wenig Farbe, saubere Ausrichtung, ein Thema aus drei Reglern [Q39]. Die Ist-App nutzt schon Inter. **Inter Display für große Zahlen und Titel wäre ein kleiner Schritt mit großer Wirkung** [Vermutung].

### 2.12 Arc
1.–2. Die Seitenleiste ist das Fundament, Inhalte stehen als Karte daneben [Q41]. Leitsatz: „the room matters, too“, also Rahmen und Umgebung gehören zum Erlebnis [Q41].
3. Desktop zuerst, mobil eine eigene, viel einfachere App [Q41; mobil: Vermutung].
4.–5. Weiche Farbverläufe, eigene Themen, verspielte, aber kurze Übergänge [Vermutung].
7. **Premium:** Der Rahmen hat eine eigene Persönlichkeit, der Inhalt bleibt ruhig [Q41].

### 2.13 Things 3
1. Eine Aufgabe springt beim Öffnen als Karte auf, der Rest blendet ab [Q40].
2. Wenige Listen (Heute, Demnächst, Irgendwann), Projekte darunter [Q40].
3. Am iPhone gibt es „Magic Plus“ zum Ziehen und Haptik. Am Mac Tastaturkürzel und „Type Travel“ (tippen, um überall hinzuspringen). Damals hatte das iPad keine Kürzel [Q40]. **Gleiche App, je Gerät eine andere Bedienung.**
4. Weißraum, fette Schrift, sparsame Farbe [Q40].
5. Das Aufspringen der Karte gilt als Musterbeispiel für Übergänge [Q40].
7. **Premium:** Jede Bewegung hat einen Zweck, jedes Gerät seine eigene Bedienung [Q40].

### 2.14 Apple Fitness und Health (Ringe)
1. Training als Vollbild mit einer großen Zahl [Vermutung].
2. Zusammenfassung mit Ringen und Wochenübersicht [Q44].
4. Ringe in drei Farben. Wenn ein Ring sich überlappt, ist das Ziel übertroffen [Q44][Q45].
5. Ein Ring schließt sich mit Funken und Haptik [Vermutung, eigene Kenntnis].
6. Grundsatz: Ein Ring ist geschlossen oder nicht (Jay Blahnik) [Q42]. Die Ziele passen sich an [Q44]. Seit watchOS 11 lassen sich Ringe pausieren, ohne die Serie zu verlieren [Q43].
7. **Premium:** Die Gestaltung wird als „simple, elegant“ beschrieben [Q45]. Belohnung ist eine Form, die sich schließt, kein Punktestand. Das passt genau zu Kap. 2.3 („Urteil statt Punktestand“) [Vermutung].

### 2.15 Headspace, Calm, Notion Mobile
- **Headspace:** Das Onboarding ist auf Woche 2 als Schlüsselkennzahl ausgerichtet. Die Tonlage ist warm, eine Übung pro Tag steht im Vordergrund [Q38].
- **Calm:** Vollflächige ruhige Hintergründe, langsame Überblendungen, sehr wenig Bedienelemente [Vermutung, keine belastbare Quelle gefunden]. **Lehre:** Eine ruhige Bühne macht auch kurze Inhalte wertig [Vermutung].
- **Notion Mobile:** 2020 kam eine Leiste unten mit Suche, „Neu“ und Benachrichtigungen [Q36], später Reiter für die Navigation am Handy [Q37]. **Lehre:** Das Handy bekommt eine eigene, vereinfachte Navigation statt der Desktop-Seitenleiste [Q36][Q37].

---

## 3. Handy-gegen-Laptop-Muster

| Thema | Handy (bis etwa 600 px) | Tablet und kleiner Laptop (600–1023 px) | Laptop (ab 1024 px) | Beleg |
|---|---|---|---|---|
| Navigation | Reiterleiste unten, **3–5 Reiter**. Ein „Mehr“-Reiter versteckt Inhalte | Rail (schmale Leiste links mit Symbolen) | Seitenleiste mit Text, auch zum Einklappen | [Q46][Q47][Q48][Q49] |
| Anordnung | eine Spalte | eine Spalte, breiter | Liste und Detail nebeneinander, bis zu drei Bereiche | [Q48][Q49] |
| Hauptknopf | volle Breite unten in der Daumenzone | wie Handy | rechts unten im Übungsbereich oder unter der Aufgabe, mit Tastenkürzel daneben | [Q50][Q9][Q34] |
| Eingabe | Tippen, Ziehen, Haptik | wie Handy | Tastatur zuerst: Enter, Ziffern, Leertaste, Esc, Kürzel auf dem Knopf | [Q40][Q34] |
| Ergebnis | Band fährt von unten hoch, kurz; mehr nur auf Antippen | wie Handy | Ergebnis-Spalte rechts neben der Übung, darf länger sein | [Q6][Vermutung] |
| Kontext | in einem Blatt (Sheet) | Blatt oder Seitenbereich | dauerhaft sichtbarer Kontext rechts (Regel, Wort, Chat) | [Q48][Vermutung] |
| Dichte | groß, wenig auf einmal | mittel | dichter, mehr auf einen Blick (Linear) | [Q39] |

**Daumenzone:** 49 % halten das Handy einhändig, 36 % halten es in einer Hand und tippen mit der anderen, 15 % nutzen beide Hände [Q50]. Diese Zahlen wurden später relativiert, gelten aber weiter als Richtwert. Folge: Hauptknopf unten, Schließen und Nebensachen oben [Q50].

**Muster der Besten für den Laptop:**
1. **Seitenleiste statt Pillen oben** (Apple ab iPad, Material ab 600/840 dp, Linear, Arc) [Q46][Q48][Q39][Q41].
2. **Übung und Kontext nebeneinander:** links die Aufgabe, rechts Ergebnis, Regel oder Wort. Bei Duolingo Web steht in der rechten Spalte der Fortschritt [Vermutung]. Die Ist-App macht das in der Übung schon im Ansatz richtig [Q56].
3. **Tastatur sichtbar machen:** Das Kürzel steht am Knopf (Mochi) [Q34]. Ein Hilfe-Fenster mit `?` [Vermutung].
4. **Breite nutzen statt strecken:** Inhalt bis etwa 640–720 px Lesebreite, der Rest gehört Seitenleiste und Kontext, nicht leerem Rand [Vermutung, Kap. 8 des Auftrags nennt 360–2560 px].
5. **Hover-Zustände und Tooltips** gibt es nur am Laptop [Vermutung].

**Muster der Besten für das Handy:**
1. **Ein Rahmen pro Übung ohne fremde Bedienelemente** (Duolingo: nur X und Balken) [Q6].
2. **Wischen zwischen gleichrangigen Bereichen** (Speak: Practice per Wischen) [Q19].
3. **Haptik als Bestätigung** (Things, Duolingo) [Q40][Vermutung zu Duolingo]. Hinweis: Safari am iPhone kennt `navigator.vibrate` nicht. Haptik geht dort nur eingeschränkt [Vermutung].
4. **Blätter (Sheets) für Kontext:** Sie federn von unten herein und lassen sich nach unten wegziehen [Vermutung, iOS-Standard].

---

## 4. Design-System-Bausteine der Besten

| Baustein | Was die Besten tun | Beleg | Ist-App |
|---|---|---|---|
| **Farbrollen** | Eine Handlungsfarbe (Duolingo Feather Green, Blinkist Grün, Speak Blau). „Richtig“ und „falsch“ sind Zustandsfarben, getrennt davon | [Q7][Q28][Q19] | Hauptknopf weiß/schwarz, Akzent Smaragd = „richtig“ = Marke; Violett, Blau, Cyan und Gold ohne feste Rolle [Q56] |
| **Farbraum** | LCH bzw. OKLCH, Thema aus 3 Eingaben | [Q39] | Hex-Werte von Hand, 4 Paletten × 3 Modi [Q56] |
| **Chrome** | Wenig Farbe im Rahmen, Farbe gehört dem Inhalt | [Q39] | Kanalfarben im Rahmen, Glasflächen [Q56] |
| **Schrift** | Wenige Stile, Größe nach Zweck. Eine Display-Schnitt für Titel und Zahlen. Bei Blinkist eine eigene Schrift für den Inhalt | [Q2][Q39][Q28] | Inter, Skala 12–64, Rollen vorhanden (gut) [Q56] |
| **Titel-Platz** | Titel immer an derselben Stelle | [Q2] | wechselt je Bildschirm [Q56] |
| **Behälter** | Weißraum statt schwerer Karten | [Q2][Q40] | Karte in Karte, Abschnitts-Überschriften in Großbuchstaben [Q56] |
| **Rückmeldung** | Eigenes visuelles System (Brilliant). Band von unten (Duolingo) | [Q15][Q6] | lange Ergebnis-Karte [Q56] |
| **Lesen dunkel** | Kein reines Weiß auf Schwarz | [Q29] | `#0d1016` und helles Grau (in Ordnung) [Q56] |
| **Laden** | Skelett für ganze Seiten, Spinner nur für kurze Vorgänge. Brilliant hat eine eigene Lade-Animation | [Q54][Q55][Q17] | leeres Heute ohne Skelett [Q56] |
| **Größe der Ziele** | Mindestens 44 pt (Apple) | Auftrag Kap. 4 | Textknöpfe „Tipp“ und „Weiß ich nicht“ ohne Fläche [Q56] |

**Fazit für das System von Lingo-Engine X** [Vermutung, Ableitung aus den Belegen oben]:
- Drei Farbebenen. **Grund** (neutral, aus einer Farbe abgeleitet). **Handlung** (eine Markenfarbe, nur für Hauptknopf, Auswahl und Fokus). **Zustand** (richtig, fast, falsch, mit Form und Wort, nie nur Farbe).
- Kanalfarben nur noch als kleiner Punkt oder Symbol, nicht als Flächen.
- Ein Schriftschnitt mehr: Inter Display für Zahlen und Titel.
- Ein Radius, ein Abstandsraster (8 px gibt es schon), eine Schattenstufe.
- Die 15 CSS-Schichten in **einer** Token-Datei zusammenführen [Q56].

---

## 5. Bewegung

**Grundregeln mit Beleg:**
- **Federn statt Zeitkurven:** Man gibt nur Dauer und Bounce an. Bounce 0 ist der vielseitige Standard, 0,15 kaum spürbar, 0,3 deutlich, über 0,4 übertrieben. Federn behalten bei einer Unterbrechung ihre Geschwindigkeit, so springt nichts. Lineare Kurven vermeiden [Q51][Q52].
- **Dauern:** meist 100–500 ms. Unter 100 ms bemerkt man die Bewegung nicht, über 1 s wirkt sie träge. Mobil sind etwa 200–300 ms üblich [Q53].
- **Timing ist alles:** Ein Moment wirkt durch den richtigen Takt, nicht durch Menge [Q3].
- **Zahl und Animation synchron:** Die Zahl zählt im Takt der Animation hoch (Brilliant) [Q14].
- **Aufspringen und Abblenden:** Das Ziel wächst aus seinem Ursprung, der Rest tritt zurück (Things) [Q40].
- **Figuren und Kleinteile als Zustandsmaschine** (Rive bei Duolingo und Brilliant) [Q4][Q14]. Für Lingo-Engine X gibt es keine Figur, aber dasselbe Prinzip gilt für Häkchen, Ring und Lücke [Vermutung].

**Vorschlag für Lingo-Engine X** [Vermutung, abgeleitet; passt zu Kap. 4 und Dokument 05 [Q56]]:

| Ebene | Bewegung | Dauer / Feder |
|---|---|---|
| Reiter wechseln | Überblenden | 150 ms |
| Seite öffnen | Schieben + Überblenden | 220 ms, Bounce 0 |
| Blatt (Sheet) | von unten | Feder, etwa 500 ms, Bounce 0,1 |
| Rückmeldeband | von unten hoch | 220 ms, Bounce 0,15 |
| Buchstabe in die Lücke | Feder | 180–260 ms, Bounce 0,15 |
| Richtig | Lichtimpuls am Wort + Haptik | 300 ms |
| Falsch | kurzes seitliches Wackeln (2 Ausschläge) | 250 ms |
| Ring schließt sich | Linie läuft, dann Häkchen | 600–800 ms, einmal pro Tag |
| Zahl zählt hoch | im Takt mit dem Ring | 350 ms |
| Reduzierte Bewegung | nur Überblenden | 0–120 ms |

**Wo die Ist-App steht:** Die Dauern 120/180/260 ms sind schon festgelegt (gut) [Q56]. Es fehlen sichtbare Übergänge zwischen Aufgaben, das Band und das Aufspringen. Beim Wechsel bleibt die Scroll-Position stehen [Q56].

---

## 6. Ist-Bewertung (1–10)

Grundlage: 24 Bildschirmfotos aus dem Audit (Handy 390 px, Laptop 1440 px, großer Bildschirm 2560 px, Dunkel und Hell), dazu `docs/umbau/05-ux-ist-und-ziel.md`, `docs/umbau/masterplan-9-5.md` und `src/styles/index.css` [Q56]. Die Testdaten stammen aus dem Entwicklungs-Adapter. Die Chat-Antwort, die nicht zur Frage passt, ist ein Platzhalter und fließt nicht in die Bewertung ein.

### Facette 9 – Optik und Design: **6 / 10**
**Gut:**
- Dunkel und Hell sind beide vollwertig.
- Inter ist ruhig und gut lesbar.
- Die Fertig-Karte des Tages (großer Ring mit Häkchen, Wochenstreifen) hat Apple-Niveau.
- Der Grammatik-Pfad „Dein Weg zu C1“ mit Topografie hat eine eigene Handschrift.
- Der Leser ist ordentlich.

**Schwach:**
- Es gibt keine Markenfarbe. Der Hauptknopf ist weiß bzw. schwarz.
- Die Farbrollen zerfasern: Violett, Blau, Cyan, Grün und Gold ohne feste Bedeutung. Die Ziffern 27/50/12 stehen bunt und ohne Legende da.
- „Weiß ich nicht“ zeigt die Lösung grün mit Häkchen, das sieht aus wie „richtig“.
- Textwände: „Was sich bewegt hat“, dreimal „Noch wackelig“.
- Ein Wort steht 5–6 Mal auf einer Ergebnis-Karte. Der Chip „Verb“ ist doppelt.
- Große Leerflächen in Übung und Zwischenkarte.
- Abschnitts-Überschriften in Großbuchstaben (MERKE, BEISPIEL) wirken wie ein Formular.
- Textfehler („formeller discontinue.“).
- Im Code: 15 CSS-Flickschichten und doppelte Radien [Q56].

### Facette 10 – Bedienung am Handy: **5,5 / 10**
**Gut:**
- Die Aktionsleiste unten mit breitem „Prüfen“ liegt in der Daumenzone.
- Satzbau mit gestrichelten Plätzen ist sauber.
- Das Rollenspiel hat einen ordentlichen Aufbau mit Zeitbalken und Chips.

**Schwach:**
- Sechs Reiter unten (Apple empfiehlt 3–5 [Q46]).
- Avatar und drei Symbole (Übersetzer, Claude, Zahnrad) stehen auf **jedem** Bildschirm, auch mitten in der Übung.
- „Tipp“ und „Weiß ich nicht“ sind nackte Textknöpfe unter 44 pt Fläche.
- Ergebnisse muss man scrollen.
- Die Kopfzeile widerspricht sich: „1 von 4“, „Pflicht · 2 von 4“ und „1 von 4 · noch ca. 15 Min.“ auf demselben Bildschirm. Auch „1 von 52“ und „Schritt 1 von 4“ stehen gleichzeitig da.
- Die Serie am Kartenfuß wird von der Reiterleiste angeschnitten.
- Das Chat-Blatt hat viele Bedienelemente, das „Neue Antwort“-Feld überdeckt Text, und es gibt zwei Eingaberahmen [Q56].

### Facette 11 – Bedienung am Laptop: **4 / 10**
**Gut:**
- Die Übung ist zweispaltig (Aufgabe links, Ergebnis rechts). Das ist der richtige Ansatz.
- Tastatur: „Enter prüft und geht weiter“, „T Tipp · ? Regel“.
- Der Leser hat eine zentrierte Lesespalte.

**Schwach:**
- Es gibt keine eigene Laptop-Gestalt. Oben liegt eine schwebende Pillenleiste, darunter eine zweite Zeile mit Avatar und Symbolen: zweimal Rahmen, keine Seitenleiste.
- Heute zeigt nur zwei Handy-Karten nebeneinander mit viel Leerraum.
- Bei 2560 px ist alles winzig und zentriert, rund zwei Drittel sind leer. Die Wörter-Seite ist dort eine schmale Spalte mit kleiner Schrift.
- Der Weiter-Knopf sitzt mal unter dem Satz, mal unten.
- Die Kürzel sind nur als Fußzeile zu sehen, nicht am Knopf.
- Es gibt keinen dauerhaften Kontext (Regel, Wort, Chat) als Spalte [Q56].
- **Das ist die größte Lücke zu Emrahs Wunsch** „am Laptop anders als am Handy vom Aufbau und von der Bedienung“.

### Facette 12 – Motivation und Gefühl: **5 / 10**
**Gut:**
- Der Tagesring „27 Min. offen“ ist da.
- Die Fertig-Karte hat Ring, Häkchen und Glühen, dazu „4 von 4 Schritten“, einen Wochenstreifen und die Serie.
- „Nächstes Ziel: der nächste C1-Check“.

**Schwach:**
- „0 Wörter fest“ auf Fortschritt, aber 6.415 von 8.000 auf der Wörter-Seite. Das zerstört Vertrauen in jede Zahl.
- Die App ist statisch: kein Band, keine zählende Zahl, kaum Momente zwischen den Aufgaben.
- Die Endkarte der Grammatik ist eine Textwand mit dreimal „Noch wackelig“, das fühlt sich wie Tadel an.
- 52 Karten in 12 Minuten wirkt unglaubwürdig.
- Die Zwischenkarten kosten Tipps ohne Gefühl von Fortschritt [Q56].

### Facette 14 – Tempo: **5 / 10**
**Gut:**
- In der Übung selbst sind Eingabe und Prüfen schnell.
- Enter am Laptop geht direkt weiter.

**Schwach:**
- Das Ladebild zeigt ein fast leeres Heute: nur das Band „Wochenrückblick“, keine Karte, kein Skelett.
- Gemessen 2,4 s, gebremst 5,8 s bis zur Bedienbarkeit. Ziel nach Kap. 14 sind unter 2 s.
- Zwischenkarten zwischen den Schritten bedeuten zusätzliche Tipps.
- Lange Ergebnisse verlangen Scrollen, bevor „Weiter“ kommt.
- Die Datei hat 5,96 von 6 MiB [Q56].

**Mittel der fünf Facetten: 5,1.** Das deckt sich mit Emrahs eigenem Urteil (5–6).

---

## 7. Top-Muster für Lingo-Engine X

Aufwand grob: **S** = Tage, **M** = 1–2 Wochen, **L** = mehrere Wochen. Facetten: 9 Optik, 10 Handy, 11 Laptop, 12 Motivation, 14 Tempo (vereinzelt auch 6 Anpassung, 8 Roter Faden zu C1).

| # | Muster | Kern in einem Satz | Quelle | Facette | Aufwand |
|---|---|---|---|---|---|
| 1 | **Fester Übungsrahmen mit Rückmeldeband** | Oben nur X und ein Balken. In der Mitte die Aufgabe. Unten ein Knopf, der nach dem Prüfen zum Band mit Urteil und Lösung in einer Zeile wird und dann „Weiter“ heißt. Mehr gibt es nur auf Antippen | Duolingo [Q6][Q9] | 10, 9, 14 | M |
| 2 | **Kein Chrome in der Übung** | Avatar, Übersetzer, Claude und Zahnrad verschwinden in der Übung. Hilfe steckt in einem Knopf im Rahmen | Duolingo [Q6], Babbel „Ablenkung = Risiko“ [Q24] | 10, 9 | S |
| 3 | **Eigene Laptop-Gestalt ab 1024 px** | Links eine Seitenleiste (Heute, Wörter, Grammatik, Anwenden, Fortschritt), in der Mitte die Bühne, rechts Kontext (Ergebnis, Regel, Wort, Chat). Bei 600–1023 px eine Rail | Apple HIG [Q46], Material [Q48][Q49], Linear [Q39], Arc [Q41] | 11 | L |
| 4 | **Tastatur sichtbar am Knopf** | „Prüfen ⏎“, „Tipp T“, Antworten 1–4, Esc schließt, `?` zeigt alle Kürzel | Mochi [Q34], Things [Q40] | 11, 14 | S |
| 5 | **Eine Handlungsfarbe, getrennt von „richtig“** | Eine Markenfarbe nur für Hauptknopf, Auswahl und Fokus. Richtig, fast und falsch als Zustand mit Symbol und Wort. „Lösung gezeigt“ in Neutral, nie grün | Duolingo [Q7], Blinkist [Q28], Linear [Q39] | 9 | M |
| 6 | **Thema aus drei Eingaben (OKLCH)** | Grund, Akzent und Kontrast erzeugen alle Modi und Paletten. Die 15 CSS-Schichten werden zu einer Token-Datei | Linear [Q39] | 9 | M |
| 7 | **Ein Gedanke pro Bildschirm, Warum zum Aufklappen** | Das Urteil steht sofort da, der Vergleich in einer Zeile. Das „Warum“ ist ein Satz, „Mehr“ klappt auf. Das Wort steht höchstens zweimal da | Brilliant [Q13][Q18], Babbel [Q24] | 9, 10, 14 | M |
| 8 | **Ein Weg, ein nächster Schritt** | Die Heute-Karte ist das Einzige über der Falte, mit einer Zahl und einem Knopf. Band und Datum rutschen darunter oder fallen weg | Duolingo [Q1], Speak [Q19], Babbel [Q23] | 10, 12 | S |
| 9 | **Pulsierender nächster Punkt im Pfad** | Im Grammatik-Weg pulsiert der nächste Schritt sanft, erledigte füllen sich | Speak [Q19], Brilliant [Q14] | 12, 8 | S |
| 10 | **Ring statt Punktestand** | Ein Tagesring, der sich schließt, dazu eine Wochenansicht. Ruhetage brechen die Serie nicht. Mehr als das Ziel zeigt sich durch Überlappung | Apple [Q42][Q43][Q44] | 12 | S (besteht in Teilen) |
| 11 | **Zählende Zahl im Takt** | Bei Abschluss zählen Serie und Wörter synchron mit dem Ring hoch, einmal und kurz | Brilliant [Q14], Duolingo [Q3] | 12 | S |
| 12 | **Meilenstein-Momente sparsam** | Große Momente nur an Woche, Monat, 100 Tagen und C1-Check, mit Haptik. Sonst nur kleine Bestätigungen | Duolingo [Q3][Q10] | 12 | M |
| 13 | **Federn mit Bounce 0–0,15** | Ein Satz Federn für die ganze App (siehe Abschnitt 5), reduzierte Bewegung eingeschlossen | Apple WWDC23 [Q51][Q52] | 9, 12 | M |
| 14 | **Aufspringen statt Seitenwechsel** | Ein Wort aus der Liste oder ein Schritt aus Heute wächst aus seiner Karte heraus, der Rest blendet ab | Things [Q40] | 9, 10 | M |
| 15 | **Skelett beim Start** | Heute zeigt sofort die Form der Karte, Zahlen kommen nach. Nie ein leerer Bildschirm | NN/g [Q54], LogRocket [Q55] | 14 | S |
| 16 | **Inter Display für Zahlen und Titel** | Große Zahlen und Titel bekommen einen Display-Schnitt, Fließtext bleibt Inter Text | Linear [Q39] | 9 | S |
| 17 | **Fortschritt im Text sichtbar (Lesen)** | Neue Wörter im Leser markiert, die Markierung verblasst mit dem Lernen. „Text fertig“, wenn keine Markierung mehr da ist | LingQ [Q32][Q33] | 12, 9 | M |
| 18 | **Erinnerung als Frage statt Vorwurf** | Der Tagesauftrag fragt ein Wort ab, statt an die Serie zu mahnen | Busuu [Q26] | 12 | S |
| 19 | **Grammatik-Erklärung als gestaltetes Element** | Muster als kleine Tabelle bzw. Formel mit Beispiel, bedienbar, kein Absatz | Babbel [Q25], Brilliant [Q17] | 9, 3 | M |
| 20 | **Höchstens 5 Reiter am Handy** | Sechs Reiter auf vier oder fünf zusammenlegen (Dokument 05 schlägt vier vor) | Apple HIG [Q46][Q47] | 10 | S |

**Reihenfolge nach Wirkung pro Aufwand** [Vermutung]: 2, 8, 15, 20, 4 (je S, sofort spürbar), dann 1, 5, 7 (Kern der Übung), dann 3 (Laptop, größter Brocken, größter Sprung bei Facette 11), dann 6, 13, 14 (Feinschliff).

---

## 8. Anti-Muster (nicht übernehmen)

1. **Mehr als 5 Reiter oder ein „Mehr“-Reiter.** Beides verbirgt Inhalte und überfordert [Q46].
2. **Das Handy-Layout am Laptop gestreckt oder zentriert.** Der Raum bleibt leer, und die Tastatur wird nicht genutzt [Q48][Q56].
3. **Chrome in der Übung:** Symbole, Avatar, Navigation während der Aufgabe [Q6][Q24].
4. **Textwände** bei Ergebnis und Abschluss. Ein Gedanke pro Bildschirm [Q13][Q24].
5. **Zahlen, die sich widersprechen.** Eine Zahl je Begriff, überall gleich (Kap. 2.2) [Q56].
6. **Konfetti, Maskottchen und Comic-Ton** für einen Erwachsenen mit Business-Ziel. Der Auftrag verbietet Konfetti (Kap. 4), und Kap. 2.7 schließt „Kinderspiel“ aus. Duolingos Mechanik ja, sein Ton nein [Vermutung].
7. **Glasflächen, durch die Text scheint** (Reiterleiste) [Q56]. Leisten bekommen eine feste Fläche.
8. **Viele Akzentfarben ohne Rolle.** Farbe nur mit Bedeutung [Q39][Q28].
9. **„Falsch“ oder „Lösung gezeigt“ in Grün** [Q56].
10. **Spinner oder leerer Start** [Q54].
11. **Serien-Druck mit Schuldgefühl.** Besser Ruhetage und freundliche Fragen [Q43][Q26].
12. **Ligen und Ranglisten.** Emrah ist der einzige Nutzer. Selbst Brilliant schaltet sie erst spät frei [Q17].
13. **Bounce über 0,4 und Animationen über 1 s** für Bedienung [Q52][Q53].
14. **Abschnitts-Überschriften in Großbuchstaben als Formular-Raster** (MERKE, BEISPIEL, WARUM) statt Typografie mit Gewicht und Abstand [Vermutung][Q2].
15. **Nackte Textknöpfe** unter 44 pt [Q56; Auftrag Kap. 4].

---

## 9. Quellen

**Duolingo**
- [Q1] https://blog.duolingo.com/new-duolingo-home-screen-design
- [Q2] https://blog.duolingo.com/core-tabs-redesign
- [Q3] https://blog.duolingo.com/streak-milestone-design-animation/
- [Q4] https://blog.duolingo.com/world-character-visemes
- [Q5] https://60fpsdesign.substack.com/p/fun-in-every-frame
- [Q6] https://screensdesign.com/apps/duolingo-language-lessons/
- [Q7] https://www.canny-creative.com/brand-breakdown/brand/duolingo/
- [Q8] https://madegooddesigns.com/duolingo-brand-guidelines/
- [Q9] https://ixd.prattsi.org/2021/09/design-critique-duolingo-web-app/
- [Q10] https://podcasts-distilled-hugo-content.pages.dev/lennys-podcast-product-career-growth/behind-the-product-duolingo-streaks-jackson-shuttleworth-group-pm-retention-team/
- [Q11] https://www.scribd.com/document/684747885/duolingo-method-whitepaper
- [Q12] https://fueled.com/blog/duolingo-math/

**Brilliant**
- [Q13] https://brilliant.org/resources/choosing-brilliant/how-brilliant-teaches-math/
- [Q14] https://rive.app/blog/how-brilliant-org-motivates-learners-with-rive-animations
- [Q15] https://builtinvancouver.org/job/product-designer-learning-interactives/6717133
- [Q16] https://read.cv/teams/brilliant
- [Q17] https://screensdesign.com/showcase/brilliant-learn-by-doing
- [Q18] https://www.apkmirror.com/apk/brilliant-org/brilliant/brilliant-7-2-0-release/

**Speak**
- [Q19] https://help.speak.com/en/articles/11430473-explore-your-new-home-screen
- [Q20] https://languatalk.com/blog/speak-app-review/
- [Q21] https://lingtuitive.com/blog/speak-review
- [Q22] https://screensdesign.com/showcase/speak-learn-spanish-french

**Babbel und Busuu**
- [Q23] https://www.babbel.com/en/magazine/course-overview-update
- [Q24] https://xd.adobe.com/ideas/principles/app-design/simple-intuitive-gamified-babbel-language-learning-great-ux-design
- [Q25] https://medium.com/babbeldesign/grammar-guide-case-study-526b45d9680e
- [Q26] https://www.eleken.co/blog-posts/to-redesign-or-not-to-redesign-your-product

**Weitere Lern-Apps**
- [Q27] https://www.designrush.com/best-designs/apps/elevate
- [Q28] https://madegooddesigns.com/?p=109756
- [Q29] https://stuffandnonsense.co.uk/blog/redesigning-your-product-and-website-for-dark-mode/
- [Q30] https://contra.com/p/Eo6Mrr3X-i-helped-headway-move-beyond
- [Q31] https://builtformars.com/company/headway
- [Q32] https://www.fluentu.com/blog/reviews/lingq/
- [Q33] https://medium.com/the-linguist-on-language/announcing-the-new-lingq-reader-b42468a48726
- [Q34] https://borretti.me/article/first-impressions-mochi
- [Q35] https://mochi.cards/
- [Q36] https://www.notion.com/releases/2020-02-19
- [Q37] https://matthiasfrank.de/en/notion-updates/new-tabbed-mobile-navigation/
- [Q38] https://raw.studio/blog/how-headspace-designs-for-mindfulness/

**Premium-Apps außerhalb des Lernens**
- [Q39] https://linear.app/now/how-we-redesigned-the-linear-ui
- [Q40] https://www.macstories.net/?p=48965
- [Q41] https://productsalon.substack.com/p/piece-no-1-arc-browser und https://en.wikipedia.org/wiki/Arc_(web_browser)
- [Q42] https://mobihealthnews.com/node/143137
- [Q43] https://www.bgr.com/tech/watchos-11-activity-rings-have-big-changes-heres-whats-new/
- [Q44] https://support.apple.com/108359
- [Q45] https://www.engadget.com/2015/03/10/apple-watch-activity-design/

**Plattform-Regeln und Grundlagen**
- [Q46] https://developer.apple.com/design/human-interface-guidelines/tab-bars
- [Q47] https://unpkg.com/apple-hig-mcp@1.1.3/content/tab-bars.md (Textspiegel von Q46)
- [Q48] https://developer.android.com/design/ui/large-screens
- [Q49] https://developer.android.com/develop/ui/compose/layouts/adaptive/build-adaptive-navigation
- [Q50] https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
- [Q51] https://developer.apple.com/videos/play/wwdc2023/10158/
- [Q52] https://wwdcnotes.com/documentation/wwdc23-10158-animate-with-springs/
- [Q53] https://app.uxcel.com/courses/design-foundations/motion-995/duration-9224
- [Q54] https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/
- [Q55] https://blog.logrocket.com/ux-design/skeleton-loading-screen-design

**Projekt-intern (Ist-App)**
- [Q56] Bildschirmfotos des UX-Audits vom 26.10.2026 (Sitzungs-Arbeitsordner `audit-ux/`, 24 Bilder ausgewertet: Heute, Wort-Übung, Grammatik, Satzbau, Zwischenkarte, Fertig-Karte, Wörter, Fortschritt, Grammatik-Weg, Anwenden, Chat, Rollenspiel, Leser; Breiten 390, 1440 und 2560 px; Dunkel und Hell), dazu `docs/umbau/05-ux-ist-und-ziel.md`, `docs/umbau/masterplan-9-5.md` und `src/styles/index.css` mit 15 Teil-Dateien.

**Nicht erreichbar oder ohne Inhalt** (zur Nachvollziehbarkeit):
- design.duolingo.com (leitet auf den Blog um)
- m3.material.io (404, ersetzt durch Q48/Q49)
- Brilliant-Stellenseite bei Lever (404, ersetzt durch Q15)
- Für Duolingo Web/Desktop, Khan Academy Kids, Calm und Quizlet fand ich keine belastbaren offiziellen Quellen. Diese Aussagen sind oben als [Vermutung] markiert.
