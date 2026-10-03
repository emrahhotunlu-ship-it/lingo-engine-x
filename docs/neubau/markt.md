# Marktanalyse: was die besten Lern-Apps beliebt macht – und was Emrahs App davon bekommt

Stand 27.09.2026. Erweitert `docs/konzept/benchmark.md` (7 Apps, ohne Websuche) um 11 weitere Produkte und den Stand 2025/2026.

**Grundlage:**
- Websuche vom 27.09.2026: Herstellerseiten, Release-Notes, Hilfe-Center, Rezensionen 2025/26. Die Quellen stehen am Ende.
- Dazu öffentlich bekanntes Produktwissen.
- Zahlen stehen nur, wo sie feste Produktvorgaben sind (z. B. Anki-Standardwerte, Cambridge-Prüfungsformat). Nutzer- und Wirksamkeitszahlen werden bewusst nicht genannt.

**Bezug:**
- `docs/konzept/briefing.md`: Emrah, B2 → C1, 2/3 Beruf, 25–30 Min. täglich, iPhone-Safari.
- `docs/produktkonzept.md` und `docs/konzept/ux-architektur.md`: Reiter **Heute · Wortschatz · Lesen · Sprechen**, dazu Profil → Stand/Einstellungen und das **Claude-Blatt** oben rechts.

## 0. Rahmen

### 0.1 Was diese Plattform kann und was nicht
Das bestimmt die Spalte „Umsetzung“ in Teil 2.

| Baustein | Geht | Folge für das Übernehmen |
|---|---|---|
| Datenbank (`db`) | JSON-Dokumente, Echtzeit. Höchstens 5.000 Dokumente, 256 KiB je Dokument. | Wachsende Ströme werden je Monat gebündelt. Statistiken werden aus vorhandenen Feldern berechnet: `vocab/*.hist`, `fsrs`, `log/<tag>`, `app/profile.minutes/act`. |
| KI (`sample`) | Claude, 1–10 s, Streaming. Kein Gedächtnis, **kein Surfen**, 64 KiB je Eingabe. Bilder nur, wo `limits().images` sie meldet. | KI läuft nie im Kernablauf. Sie lädt nach oder wird vorab erzeugt. Import per URL geht nicht, nur Text einfügen (und Foto, wo erlaubt). |
| Sprachausgabe (TTS) | `speechSynthesis`, en-US, Tempo einstellbar | Vorlesen, Satz für Satz, Karaoke-Markierung, Tempo 0,75/1,0 |
| Spracheingabe | Im eingebetteten Safari unsicher | Ausweg: **Diktier-Taste der iPhone-Tastatur** in einem Textfeld. Aussprache-Bewertung auf Lautebene (ELSA, Speak) ist **nicht** möglich. |
| Video, Push, Hintergrund-Audio | nein | Keine Videos. Die Erinnerung kommt über den Claude-Tagesauftrag. Hören nur bei offenem Bildschirm. |
| Dateien (`downloads`) | Datei zum Speichern | Export als CSV/TSV, z. B. für einen Anki-Import |

### 0.2 Legende für Teil 2
- **ja:** wie im Vorbild.
- **angepasst:** Idee übernommen, Form an Emrah (C1, Beruf, iPhone) und an die Plattform angepasst.
- **nein:** passt nicht, Grund steht dabei.

### 0.3 Was gegenüber `benchmark.md` neu ist (Kurzfassung)
- **Anki im Detail:**
  - Benutzerdefiniertes Lernen,
  - hartnäckige Karten (Leeches),
  - Kartentypen (umgekehrt, Tippen, Cloze),
  - Lastausgleich und „leichte Tage“,
  - Prognose, Kalender-Heatmap, wahre Erinnerungsquote.
- **Duolingo 2025:**
  - Video Call merkt sich Fakten über den Lerner,
  - Energie statt Herzen,
  - „Explain my answer“ mit Rückfragen.
- **LingQ 5:** Satzmodus, Anteil neuer Wörter je Lektion, KI-Vereinfachen, mehrere Playlists.
- **Speak:** Rollenspiel mit drei Aufgaben als Checkliste, Wiederholung aus eigenen Fehlern, Phrasebook.
- **Neue Vorbilder:**
  - Lingvist (Wort in Satzlücke tippen),
  - Clozemaster (Hör-Lücke, Meisterschaft in Stufen),
  - ELSA (Lautfarben),
  - Quizlet (Learn/Test/Match),
  - Glossika (Satz-Wiederholungen),
  - DeepL Write und Grammarly (Alternativen, Ton),
  - Business-Coaches (Loora, Yoodli: Bewertungsraster),
  - Cambridge C1 Advanced / C1 Business Higher (Aufgabenformate, Write & Improve).

---

## 1. Die Apps: was sie wirklich beliebt macht (konkret)

Jede Funktion hat eine Kennung, z. B. AN1. Teil 2 verweist darauf.

### Anki (Desktop 25.x, AnkiMobile, AnkiDroid)
**Warum beliebt:** Anki ist das ehrlichste Gedächtniswerkzeug. Es lässt sich völlig kontrollieren, und man sieht, was der Algorithmus tut.

- **AN1 · Stapelliste mit drei Zählern und Unterstapeln.**
  - Startbildschirm ist eine Liste der Stapel, je Zeile drei Zahlen in Farbe: **Neu** (blau), **Lernen** (rot), **Fällig** (grün).
  - Unterstapel entstehen per `Beruf::Verhandeln`.
  - Ein Tipp auf den Stapel öffnet die Übersicht mit denselben drei Zahlen und dem Knopf „Lernen starten“.
- **AN2 · Abfrage: Vorderseite → „Antwort zeigen“ → vier Knöpfe.**
  - Die Knöpfe heißen **Nochmal · Schwer · Gut · Einfach**. Über jedem steht das nächste Intervall („<10 m“, „2 T“, „9 T“, „1,3 Mo“).
  - Am Desktop: Leertaste und 1–4.
  - In AnkiMobile sind Gesten frei belegbar (Wischen, Tippen in Bildschirmzonen).
  - Rückgängig macht die letzte Bewertung ungeschehen. Während der Abfrage kann man die Karte bearbeiten, markieren (Flagge), zurückstellen oder aussetzen und Audio wiederholen.
- **AN3 · FSRS mit Zielerinnerung, Optimierer und Simulator.**
  - Einstellbar ist die gewünschte Erinnerungsquote (Standard 90 %). „Optimieren“ passt die Parameter an die eigene Historie an.
  - Seit 25.07 gilt **FSRS-6**. Der Simulator zeigt, wie viel Arbeit eine andere Quote kostet.
  - **Lastausgleich** verteilt Fälligkeiten gleichmäßig. **Leichte Tage** („Easy Days“): an gewählten Wochentagen weniger Wiederholungen. Beides gilt auch beim Neuplanen und im Simulator.
  - Neu ist „Grade now“: eine Karte bewerten, ohne sie abzufragen.
- **AN4 · Kartentypen.**
  - Basis; Basis mit umgekehrter Karte (erzeugt zwei Geschwister); umgekehrt optional; **Antwort eintippen** (Vergleich Buchstabe für Buchstabe); **Cloze**; Bild-Verdeckung.
  - Cloze funktioniert so: `{{c1::leverage}}`, mehrere Lücken je Satz (c1, c2 …), optionaler Hinweis `{{c1::leverage::Verb, nutzen}}`.
  - Geschwister werden am selben Tag zurückgestellt, damit sich die Richtungen nicht gegenseitig verraten.
- **AN5 · Browser.**
  - Suche mit Syntax (`tag:beruf is:due`, `added:7`, `rated:1:1`, `prop:ivl>30`).
  - Links eine Seitenleiste mit Stapeln, Tags, Notiztypen, Flaggen und **gespeicherten Suchen**. Rechts eine Tabelle mit wählbaren Spalten, darunter der Editor.
  - Aktionen: Aussetzen, Flagge (7 Farben), Fälligkeit setzen, Zurücksetzen („Vergessen“), Tags ändern, Stapel wechseln.
  - „Karten-Info“ zeigt die ganze Wiederholungshistorie, Stabilität, Schwierigkeit und Abrufbarkeit.
- **AN6 · Statistik.**
  - Diagramme: Heute (Anzahl, Zeit, richtig %), **Prognose** (Fälligkeiten der nächsten Tage/Monate), **Kalender** (Heatmap der Lerntage), Wiederholungen, Kartenanzahl nach Zustand, Intervalle, Stabilität, Schwierigkeit, Abrufbarkeit, Stundenverteilung, Knöpfe.
  - Dazu die Tabelle **wahre Erinnerungsquote** (Anteil „nicht Nochmal“ bei fälligen Karten, je Zeitraum).
  - Die beliebte Erweiterung „Review Heatmap“ legt den Kalender direkt auf die Startseite.
- **AN7 · Hartnäckige Karten (Leeches).**
  - Nach 8 Fehlschlägen (Standard, einstellbar) bekommt eine Karte den Tag `leech` und wird auf Wunsch ausgesetzt.
  - Anki sagt dazu offen: „Diese Karte kostet dich Zeit, formuliere sie um.“
- **AN8 · Benutzerdefiniertes Lernen und „Fertig“-Bildschirm.**
  - Ist der Stapel leer, steht dort: „Glückwunsch! Du bist für heute fertig“. Darunter der Knopf **Benutzerdefiniertes Lernen**.
  - Optionen: neue Karten +n, Wiederholungen +n, **vergessene Karten der letzten n Tage**, **vorauslernen** (n Tage), neue Karten ansehen, **nach Zustand oder Tag** lernen.
  - Das Ergebnis ist ein zeitweiliger, gefilterter Stapel.
- **Nicht beliebt, sondern gefürchtet:** Optionsdschungel (Lernschritte in Minuten, Voreinstellungsgruppen), rohe Kartenvorlagen, kein Satz-Kontext von selbst.

### Duolingo (inkl. Max, Stand 2025/26)
**Warum beliebt:** Man muss nie überlegen, was als Nächstes kommt. Dazu kommen kurze Einheiten und sofortiges Feedback.

- **DU1 · Pfad mit einem Startknopf.**
  - Startseite ist ein senkrechter Pfad aus Kreisen. Der aktuelle Kreis hüpft und trägt „Start“.
  - Über jeder Einheit gibt es einen „Leitfaden“ mit Schlüsselsätzen und Grammatik.
- **DU2 · Aufgabe → „Prüfen“ → Leiste unten.**
  - Oben ein Fortschrittsbalken, in der Mitte die Aufgabe (Wortbank-Kacheln oder Tastatur), unten ein breiter Knopf „Prüfen“.
  - Danach fährt unten eine grüne oder rote Leiste hoch: „Richtige Lösung: …“ und „Weiter“. Falsche Aufgaben kommen am Ende der Einheit noch einmal.
- **DU3 · Explain my answer (Max).**
  - In der roten Leiste steht der Knopf „Erkläre meine Antwort“.
  - Er öffnet einen Chat mit der Erklärung, darunter Rückfrage-Chips („Mehr Beispiele“, „Warum ist meins falsch?“).
- **DU4 · Roleplay (Max).**
  - Ein Gespräch mit einer Figur in einer Szene (Café, Reise), getippt oder gesprochen.
  - Danach kommt eine Auswertung: Rückmeldung zu Genauigkeit und Ausdruck mit besseren Formulierungen.
- **DU5 · Video Call mit Lily (Max).**
  - Ein Anruf-Bildschirm mit animierter Figur. Lily spricht auf dem CEFR-Niveau des Lerners, formuliert um, wenn er stockt, und folgt ihm, wenn er das Thema wechselt.
  - Nach jedem Anruf zieht das System eine **Liste von Fakten** über den Lerner aus dem Transkript. Lily erwähnt sie beim nächsten Mal.
  - Seit 2025 gibt es das Transkript zum Nachlesen, und Lily ruft gelegentlich von selbst an.
- **DU6 · Tagesziel, Serie, Lektions-Ende.**
  - Ring bzw. Zähler zum Tagesziel, Serie mit Wochenkalender und Serienschutz.
  - Am Lektions-Ende drei Kacheln: Punkte, **Genauigkeit %**, **Zeit**. Danach die Serien-Animation.
- **DU7 · Übungszentrum.** „Fehler wiederholen“ (gesammelte Fehler), Wörterliste, Hören, Sprechen, Geschichten.
- **DU8 · Belohnungssystem.**
  - Ligen, Edelsteine, Freundes-Quests, „Streak Society“.
  - **Energie statt Herzen:** 25 Einheiten, jede Aufgabe kostet eine. Wird seit Frühjahr 2025 schrittweise eingeführt.
  - Wirksam für Anfänger, für Erwachsene im Beruf oft Anlass zur Kündigung.

### Babbel
**Warum beliebt:** Babbel wirkt wie ein seriöser Kurs. Es gibt echte Dialoge, kurze Grammatik-Tipps und eine saubere Wiederholung.

- **BA1 · Lektion mit Anfang und Ende (10–15 Min.).**
  - Ablauf: neue Wörter mit Audio → kurzer Alltags-Dialog → Übungen (Lücke, Satzbau, Zuordnen, Hören) → Zusammenfassung „Das hast du gelernt“ → nächste Lektion.
- **BA2 · Grammatik-Tipp im Fluss.** Eine kleine Karte mit Regel und Beispiel erscheint genau vor der Übung, die das Muster braucht.
- **BA3 · Wiederholung (Review-Manager).**
  - Eine Zahl „x Elemente zu wiederholen“, dazu die Wahl des Modus: Karteikarten, Hören, Sprechen, Schreiben.
  - Die Elemente steigen in Stufen auf.
- **BA4 · Sprechen.**
  - Spracherkennung in Lektionen und „Everyday Conversations“ (vorgegebene Dialoge, KI bewertet die Aussprache).
  - Seit 09/2025 **Babbel Speak** als eigener Reiter: ein stimmgeführter Trainer vom ersten Satz an.
  - Ein KI-Gesprächspartner mit Feedback zu Wortwahl und Grammatik.
- **BA5 · Podcasts und Babbel Live.** Kurze Podcast-Folgen zum Lernstand und Live-Gruppenstunden mit Lehrern.
- **BA6 · Einstufung und Lernziel.** Einstufungstest am Anfang, Wochenziel und Erinnerung.

### LingQ (5.x, Stand 2025/26)
**Warum beliebt:** Man lernt aus Inhalten, die einen interessieren, und sieht den eigenen Wortschatz auf jeder Seite wachsen.

- **LQ1 · Bibliothek nach Niveau mit Anteil neuer Wörter.**
  - Kacheln nach Stufe (Anfänger 1 bis Fortgeschritten 2), Kurse und Sammlungen.
  - Jede Lektion zeigt **„x % neue Wörter“**. So wählt man Texte in der richtigen Schwierigkeit.
- **LQ2 · Leser mit Wortstatus.**
  - Blau = neu, **gelb in Stufen 1–4** = am Lernen, ohne Markierung = bekannt.
  - Ein Tipp öffnet ein Pop-up mit Bedeutungen. Darin Status 1–4, ✓ bekannt oder ✗ ignorieren.
  - Seiten- oder **Satzmodus** (seit 5.0: ein Satz auf dem Bildschirm, konzentriert).
- **LQ3 · Phrasen per Wischen.** Über mehrere Wörter wischen ergibt die Bedeutung der Wendung im Satz, als eine LingQ gespeichert.
- **LQ4 · Seitenwechsel = „Rest ist bekannt“.** Alle nicht markierten blauen Wörter werden beim Umblättern bekannt (abschaltbar).
- **LQ5 · Eigene Inhalte.**
  - Text einfügen, Webseiten per Erweiterung, YouTube, E-Books.
  - KI-Transkription von Audio und KI-Stimmen.
  - **KI-Vereinfachen:** ein Tipp erzeugt eine leichtere Fassung.
  - Dazu der Chatbot „Lynx“.
- **LQ6 · Statistik als Wortschatz-Zähler.**
  - Leitzahl **bekannte Wörter**, dazu gelesene Wörter, Hörstunden, LingQs pro Tag, Tagesziel und Serie.
- **LQ7 · Mehrere Playlists.** Audio der Lektionen nach Thema in eigene Playlists legen und hintereinander hören.
- **LQ8 · Wiederholen im Leser.** Knopf „Review“ unten rechts: Karteikarten, Auswahl, Diktat oder Lücke zu den LingQs genau dieser Lektion.

### Speak (Stand 2025/26)
**Warum beliebt:** Man spricht vom ersten Tag an viel. Die Methode „Lernen → Üben → Anwenden“ ist klar erkennbar.

- **SP1 · Drei Schritte je Lektion.** Wendungen kennenlernen (Kurzvideo mit Tutor) → üben, bis sie sitzen → im Gespräch anwenden.
- **SP2 · Sprechdrill mit Karaoke.** Der Satz wird vorgesprochen, jedes Wort leuchtet mit. Ein großer Mikrofon-Knopf, dann Nachsprechen mit sofortiger Rückmeldung.
- **SP3 · Rollenspiel mit drei Aufgaben.**
  - Eine Szene (z. B. „Im Café“) mit einer Checkliste aus drei Zielen.
  - Die Ziele werden abgehakt, sobald man sie im Gespräch erfüllt.
- **SP4 · Free Talk.** Rolle, Thema und Ort selbst festlegen, dann frei sprechen.
- **SP5 · Fehler → Wiederholungs-Lektion.**
  - Nach dem Gespräch kommt eine kurze Fehlerliste mit dem Knopf „Wiederholung erzeugen“. Daraus entsteht ein Drill mit ähnlichen Satzmustern.
  - Premium Plus bietet dazu „Made for You“-Lektionen und eine persönliche Aussprache-Wiederholung.
- **SP6 · Phrasebook.** Wendungen mit einem Tipp speichern.
- **SP7 · KI-Tutor.** Grammatikfragen jederzeit stellen und Lektionen auf Zuruf bekommen. „Tutor Lessons“ (1:1-artig) laufen als Beta.

### Busuu
**Warum beliebt:** Busuu hat einen klaren Kursplan nach CEFR, echte Schreibaufgaben und sichtbare Wortstärke.

- **BU1 · Einstufung und Lernplan.** Einstufungstest; Ziel, Wochentage und Minuten wählen; Busuu berechnet ein **voraussichtliches Zieldatum**.
- **BU2 · Smart Review mit Wortstärke.**
  - Die Wortliste zeigt je Eintrag einen Balken (schwach · mittel · stark).
  - Ein Filter „schwache Wörter“ startet eine Wiederholung nur damit.
- **BU3 · Produktion mit Korrektur.** Am Ende jeder Lektion schreibt oder spricht man selbst. Muttersprachler korrigieren mit Streichungen und Einfügungen im Satz.
- **BU4 · Conversations (KI).** Ein zielgerichtetes Rollenspiel zum Inhalt der Lektion, am Ende mit persönlichem Feedback.
- **BU5 · Grammatik-Review** mit derselben Stärke-Anzeige je Thema.

### Memrise (neue App)
**Warum beliebt:** Echte Menschen und klar getrennte Übungsmodi.

- **ME1 · Muttersprachler-Videos.** Kurze Clips von echten Menschen, die die Wendung sagen.
- **ME2 · Modi als Einstiege.** Lernen · Wiederholen · **Schnell-Wiederholen** (auf Zeit) · **Schwierige Wörter** · Hören.
- **ME3 · „Kenne ich schon“ / „schwierig“.** Mit einem Tipp überspringen oder in den Schwierig-Modus schicken.
- **ME4 · MemBot.** Ein KI-Gespräch mit den Wörtern der Lektion, als kurze Mission mit Ziel.
- **ME5 · Szenarien.** Situationen (z. B. „Gehalt verhandeln“), in der neuen App auch selbst angelegt.

### Clozemaster
**Warum beliebt:** Viele echte Sätze in kurzer Zeit. Jede Runde ist schnell, und der Wortschatz wächst im Satz.

- **CM1 · Fluency Fast Track.** Häufigkeitsliste; jedes Zielwort erscheint in einem Satz, vom häufigsten zum seltenen.
- **CM2 · Lücke mit Auswahl oder Eintippen.** Ein Satz mit einer Lücke, darunter vier Knöpfe oder ein Textfeld. „Tipp“ zeigt den ersten Buchstaben.
- **CM3 · Meisterschaft in Stufen.** Jeder Satz steigt von 0 über 25/50/75 auf 100 % gemeistert, mit wachsenden Abständen.
- **CM4 · Cloze-Listening und Cloze-Reading.**
  - Erst **hören**, dann die Lücke füllen: mit Hintergrundgeräusch und verschiedenen Akzenten, für Fortgeschrittene.
  - Cloze-Reading (Pro) nutzt längere Texte.
- **CM5 · Grammar Challenges.** Dasselbe Format für ein Grammatikthema (Zeiten, Präpositionen).
- **CM6 · Punkte und Ränge** nach jeder Runde.

### Readlang (und Language Reactor)
**Warum beliebt:** Übersetzung genau dort, wo man liest. Die Karte bleibt der Originalsatz.

- **RL1 · Tippen → Übersetzung über dem Wort.** Ziehen über mehrere Wörter übersetzt die Phrase im Satz.
- **RL2 · Karte = Originalsatz mit Lücke.** Nachgeschlagene Wörter werden automatisch zu Karten mit Wiederholungsplanung.
- **RL3 · KI-Erklärung im Kontext.** „Warum heißt das hier so?“ direkt am Wort.
- **RL4 · Eigene Texte und Bibliothek.** Text hochladen, Web-Reader, Sammlung nach Genre.
- **RL5 · Export** der Wortliste (CSV/Anki).
- **RL6 · Language Reactor.** Doppelte Untertitel, automatische Pause nach jedem Satz, Satz wiederholen mit einer Taste, Wortstatus-Farben.

### Lingvist
**Warum beliebt:** Wortschatz lernt man mit Lingvist in hohem Tempo, und jede Karte ist ein Satz.

- **LV1 · Wort in die Satzlücke tippen.**
  - Die Karte zeigt einen Satz mit Lücke, darunter die Übersetzung des Satzes und des Zielworts. Man tippt das Wort.
  - Die Buchstaben werden farbig bewertet. Falsche Karten kommen in derselben Sitzung wieder.
- **LV2 · Adaptiv nach Häufigkeit und Wissensstand.** Häufige Wörter kommen zuerst, Gewusstes verschwindet schneller.
- **LV3 · Eigene Stapel aus Text oder Foto.** Text einfügen oder abfotografieren, daraus werden Karten zu den unbekannten Wörtern.
- **LV4 · Tagesziel in Karten** mit Verlaufskurve „gelernte Wörter“.

### ELSA Speak
**Warum beliebt:** Sehr genaues Aussprache-Feedback mit messbarer Verbesserung.

- **EL1 · Lautfarben.** Nach dem Sprechen wird jeder Laut des Satzes grün, gelb oder rot.
- **EL2 · Laut antippen → Anleitung.** Mund- und Zungenstellung, dazu gezielte Übungen zu Betonung, Satzmelodie und Bindung.
- **EL3 · Sprech-Wert.** Ein Gesamtwert, abgebildet auf IELTS/TOEFL/CEFR, aufgeteilt in Aussprache, Flüssigkeit, Grammatik und Wortschatz.
- **EL4 · Speech Analyzer.** Freie Rede aufnehmen, danach Auswertung in denselben vier Bereichen.
- **EL5 · KI-Rollenspiel und Business-Module.**
  - Szenen wie „Gehalt verhandeln“ mit Transkript und Rückmeldung zu Natürlichkeit und Grammatik.
  - Module für Vorstellungsgespräch, Verhandlung, Verkauf und Präsentation.

### Quizlet
**Warum beliebt:** Aus einer Liste werden sofort viele Übungsformen.

- **QZ1 · Karteikarten mit Wischen.** Rechts „weiß ich“, links „lerne noch“. Einstellbar „Antworten mit: Begriff/Definition“ (Richtung umkehren).
- **QZ2 · Learn.** Adaptive Runden: erst Auswahl, dann selbst schreiben. Schwierigkeit und Bewertung sind seit 08/2025 KI-gestützt.
- **QZ3 · Test.** Ein erzeugter Test mit gemischten Formaten (Auswahl, Wahr/Falsch, Schreiben), am Ende Ergebnis und Liste der Fehler.
- **QZ4 · Match.** Begriffe und Bedeutungen auf Zeit zuordnen, Bestzeit.
- **QZ5 · Sterne.** Einzelne Karten markieren, dann „nur markierte üben“.
- **Außerdem:** Magic Notes (Notizen → Karten/Lernhilfe). Der KI-Tutor Q-Chat wurde 06/2025 eingestellt. Learn und Test brauchen inzwischen Plus.

### Glossika
**Warum beliebt:** Viel Hören und Sprechen ganzer Sätze. Die Grammatik kommt aus der Menge.

- **GL1 · Satz-Wiederholungen („Reps“).** Ein Satzpaar hören, nachsprechen, optional tippen. Neu: 5 Sätze × 5 Wiederholungen = 25 Reps (8–10 Min.).
- **GL2 · Getrennte Tagesziele** für „Lernen“ und „Wiederholen“ (z. B. 25 und 50 Reps).
- **GL3 · Freihändig-Modus.** Nur hören, z. B. unterwegs.
- **GL4 · Themen** (auch Business) und Zähler für Reps und Stunden.

### DeepL Write
**Warum beliebt:** Ein Text wird mit einem Tipp natürlicher, und man sieht jede Änderung.

- **DW1 · Einfügen → verbesserte Fassung.** Zwei Spalten, die Änderungen sind markiert.
- **DW2 · Antippen → Alternativen.** Ein Tipp auf ein Wort oder einen Satzteil zeigt eine Liste anderer Formulierungen.
- **DW3 · Stil und Ton.** Stile Einfach, Business, Akademisch, Locker; Töne begeistert, freundlich, selbstbewusst, diplomatisch.
- **DW4 · US-/UK-Englisch** wählbar.

### Grammarly
**Warum beliebt:** Die Korrektur passiert im Text selbst, mit einem Tipp zum Übernehmen und einem Satz Begründung.

- **GR1 · Unterstreichungen nach Kategorie.**
  - Kategorien: Korrektheit, Klarheit, Wirkung, Ton.
  - Ein Tipp öffnet eine Karte mit Vorschlag, Knopf „Übernehmen“ und einer Zeile „warum“.
- **GR2 · Ton-Erkennung und Ton-Umschreiben.**
  - „Klingt: selbstbewusst, freundlich“ mit Symbol.
  - Sätze, die falsch ankommen könnten, bekommen einen Vorschlag zum Umschreiben.
- **GR3 · Ziele.** Publikum, Formalität und Absicht vor dem Schreiben festlegen.
- **GR4 · Gesamtwert und Wochenbericht** zu Schreibmenge, Genauigkeit und Wortschatz.

### Business-English-Apps (Loora, Praktika, Yoodli, Talaera u. a.)
**Warum beliebt:** Man übt genau die Gespräche, die im eigenen Job anstehen.

- **BE1 · Loora.** Berufsprofil anlegen. Danach KI-Gespräche zum eigenen Job: Meetings, Präsentationen, Vorstellungsgespräche. Nach jedem Gespräch Rückmeldung zu Grammatik, Wortschatz und Aussprache.
- **BE2 · Praktika.** KI-Avatare als Tutoren in realistischen Szenen.
- **BE3 · Yoodli.**
  - Präsentations- und Gesprächscoach: Füllwörter, Tempo, Wiederholungen.
  - **KI-Rollenspiele für den Vertrieb** (Bedarfsgespräch, Einwände) mit einem **Bewertungsraster**, z. B. „Einwand anerkannt? Nutzen beziffert? Nächster Schritt vereinbart?“.
- **BE4 · Talaera.** Menschliche Business-Coaches, dazu Lektionen zu Meetings, Verhandlung und E-Mail.
- **BE5 · Szenario-Bibliotheken** (TalkMe, Talkpal u. a.): Projekt-Kickoff, Quartalsbericht präsentieren, Vertragsbedingungen verhandeln, Follow-up-Mail.

### Cambridge C1 Advanced und C1 Business Higher
**Warum wichtig:** Diese Formate prüfen genau das, was C1 von B2 unterscheidet.

- **CA1 · Use of English (Teile 1–4).** Auswahl-Lücke, **offene Lücke**, **Wortbildung** (Stamm vorgegeben), **Schlüsselwort-Umformung** (Satz mit vorgegebenem Wort in 3–6 Wörtern umformen).
- **CA2 · Reading (Teile 5–8).** Auswahlfragen, Zuordnung über mehrere Texte (Meinungen vergleichen), Lückentext mit herausgenommenen Absätzen, Zuordnung. Zusammen mit Use of English: 8 Teile, 56 Fragen, 90 Min.
- **CA3 · Writing.** Pflicht-Essay und eine Wahlaufgabe (Brief/E-Mail, Proposal, Report, Review), je 220–260 Wörter.
- **CA4 · Speaking (4 Teile).** Interview, **Long Turn** (1 Min. Bilder vergleichen und bewerten), gemeinsame Aufgabe, Diskussion.
- **CA5 · C1 Business Higher.** Dieselben Fertigkeiten in Geschäftskontexten, z. B. E-Mail plus Report/Proposal im Writing.
- **CA6 · Cambridge Write & Improve.** Einen Text schreiben, dann gibt es eine **CEFR-Einschätzung** und markierte Sätze/Wörter. Überarbeiten, erneut einreichen, die Verbesserung sehen.

---

## 2. Funktion → für Emrah übernehmen? → Umsetzung → wo in der App

**Orte (aus `ux-architektur.md`):**
- **Heute** mit **Übungs-Player** und **Session-Ende**,
- **Wortschatz** mit **Stapel-Sitzung**, **Wortliste** und **Wortblatt**,
- **Lesen** mit **Leser**,
- **Sprechen** mit **Gespräch**, **Schreibwerkstatt**, **Training** und **Preply**,
- **Stand** und **Einstellungen** (über Profil),
- **Claude-Blatt** (überall).

| ID | Funktion | Emrah | Umsetzung auf dieser Plattform | Wo in der App |
|---|---|---|---|---|
| AN1 | Stapel mit Zählern Neu · Lernen · Fällig | **ja** | Zähler lokal aus `fsrs.due`/Zustand. Stapel sind gespeicherte Filter (Quelle, Thema, Tag), keine Kopien. Unterstapel als `Beruf › Verhandeln`. | Wortschatz |
| AN2 | Aufdecken + 4 Knöpfe mit Intervall, Undo, Karte bearbeiten | **ja** | Intervall-Vorschau aus ts-fsrs (lokal, < 50 ms). Der App-Vorschlag aus der Antwortzeit ist hervorgehoben. Wischen links = Nochmal, rechts = Gut. „↶“ 5 s. Stift öffnet das Wortblatt im Bearbeiten-Modus. | Stapel-Sitzung |
| AN3a | Zielerinnerung einstellbar + Aufwand-Vorschau | **angepasst** | Drei Stufen statt Schieber: Entspannt 85 % · Normal 90 % · Intensiv 95 %. Daneben „≈ x Wiederholungen/Tag“ (lokale Simulation über die eigenen Karten). | Einstellungen › Wortschatz |
| AN3b | Parameter optimieren (FSRS) | **angepasst** | Automatisch einmal im Monat aus `hist`, ab genug Wiederholungen. Kein Knopf. Ergebnis als ein Satz im Stand. | unsichtbar; Stand |
| AN3c | Lastausgleich + leichte Tage | **ja** | Fälligkeiten ±1 Tag glätten. „Leichte Tage“ = Emrahs Ruhetag und Preply-Tage (weniger Neue, Wiederholungen gedeckelt). | Einstellungen › Wortschatz; wirkt auf Heute |
| AN3d | Grade now / Fälligkeit setzen / Zurücksetzen | **ja** | Im Wortblatt unter „…“: „Kann ich sicher“, „Morgen wieder“, „Von vorn lernen“. | Wortblatt, Wortliste |
| AN4a | Umgekehrte Karten (zwei Richtungen) | **angepasst** | Eine Karte, zwei Abfragerichtungen mit **einem** FSRS-Stand: EN→DE (erkennen) für neue Karten, DE→EN (abrufen) ab Stufe 3. Geschwister nie am selben Tag. | Stapel-Sitzung, Übungs-Player |
| AN4b | Antwort eintippen mit Buchstabenvergleich | **ja** | Existiert (Lücke im Satz). Vergleich Buchstabe für Buchstabe, UK-Schreibweise gilt als richtig. | Stapel-Sitzung (Modus „Tippen“) |
| AN4c | Cloze mit mehreren Lücken und Hinweis | **angepasst** | Für Wendungen: Lücke über 2–3 Wörter (`make a case for`), Hinweis = Wortart/Deutsch. Mehrere Lücken im Satz nur als Stufe „frei“. | Stapel-Sitzung, Übungs-Player |
| AN4d | Bild-Verdeckung | nein | Kein Nutzen für Business-Wortschatz. | – |
| AN5 | Browser: Suche, Filter, gespeicherte Suchen, Flaggen, Aussetzen, Karten-Info | **angepasst** | Keine Suchsyntax. Suchfeld plus **eine** Reihe Filter-Chips: Fällig · Neu · Unsicher · Hartnäckig · Markiert · Wendungen · Beruf. Mehrfachauswahl → Aussetzen/Tag/Stapel. Karten-Info = Verlauf im Wortblatt (Punkte-Reihe der letzten Antworten). | Wortliste, Wortblatt |
| AN5b | Flagge | **angepasst** | Eine Markierung „Mit Lehrerin besprechen“ statt 7 Farben. Die Karte landet automatisch in der Preply-Vorbereitung. | Wortblatt, Stapel-Sitzung (lange drücken) |
| AN6a | Prognose der Fälligkeiten | **ja** | Balken für die nächsten 7 Tage aus `fsrs.due`, lokal. „Morgen 38 · Mi 22 …“. | Wortschatz (klein), Stand |
| AN6b | Kalender-Heatmap | **ja** | 12–16 Wochen Raster, Farbe = Minuten aus `app/profile.minutes`. Ruhetag und Pflicht-Tage erkennbar. | Stand; Profil-Knopf zeigt die Serie |
| AN6c | Wahre Erinnerungsquote, Zustände, Stabilität | **angepasst** | Drei ehrliche Zahlen statt zehn Diagramme: Erinnerungsquote 30 Tage, Karten je Zustand (Neu/Lernen/Sicher), Median-Stabilität „du behältst ein Wort im Schnitt x Tage“. | Stand › Wortschatz |
| AN6d | Stundenverteilung, Knopf-Statistik, Schwierigkeit | nein | Statistik ohne Handlungsfolge. | – |
| AN7 | Hartnäckige Karten | **angepasst** | Ab 6 Fehlschlägen (aus `hist`) wird die Karte „hartnäckig“. Statt sie auszusetzen, bietet Claude an: neues Beispiel, Merkhilfe, Kontrastpaar (Deutsch-Falle) oder Aufteilen. Ein Tipp übernimmt. | Wortblatt; Filter „Hartnäckig“; Extra-Runde |
| AN8 | Fertig-Bildschirm + benutzerdefiniertes Lernen | **ja** | „Fertig für heute – nächste Karte morgen, 38 fällig.“ Darunter ein Blatt **Extra-Runde**: Heute vergessen (n) · Morgen fällig vorziehen · Nur Stapel … · Hartnäckige · +10 neue. Zeitweilige Sitzung, kein neues Dokument. | Wortschatz, Session-Ende |
| AN-x | Deck-Optionen, Lernschritte, Vorlagen-Editor, Add-ons | nein | Optionsdschungel; die App setzt die Werte. | – |
| DU1 | Pfad + ein Startknopf + Leitfaden | **angepasst** | Kein Kreis-Pfad, sondern „Heute“ mit **einem** Knopf zur Tageseinheit. Der Leitfaden = Wochenthema-Karte mit Schlüssel-Wendungen, vorlesbar. | Heute; Heute › Dein Weg |
| DU2 | Prüfen → Feedback-Leiste unten + Fehler am Ende wiederholen | **ja** | Die Leiste fährt unten hoch: Status, eigene Antwort mit Streichung/Einfügung, Lösung, „Weiter“. Falsche Aufgaben kommen am Ende der Runde einmal wieder. | Übungs-Player, Stapel-Sitzung |
| DU3 | Explain my answer + Rückfrage-Chips | **ja** | „Warum?“ in der Leiste lädt per `sample` (quick) nach, streamt und blockiert „Weiter“ nie. Chips: „Noch ein Beispiel“ · „Wann nimmt man das andere?“ · „Auf Deutsch“. Antwort am Fehler gespeichert (Zwischenspeicher). | Feedback-Leiste → Claude-Blatt |
| DU4 | Roleplay mit Auswertung | **ja** | Existiert (Gespräch mit Analyse). Auswertung als Transkript mit markierten Stellen + „besser wäre“ + Wendungen mitnehmen. | Sprechen › Gespräch |
| DU5 | Video Call mit Gedächtnis | **angepasst** | Kein Video, kein Mikrofon. „Anruf“ als Gesprächsmodus mit TTS-Stimme. Emrah antwortet per Diktier-Taste. **Gedächtnis:** nach jedem Gespräch zieht `sample` bis zu 5 Fakten („Messe in London am 14.10.“, „CFO bei Kunde X skeptisch“). Sie liegen in einem Dokument, sind in den Einstellungen sichtbar und löschbar und fließen in die nächsten Prompts. | Sprechen › Gespräch; Einstellungen › Claude merkt sich |
| DU6 | Tagesziel-Ring, Serie mit Schutz, Lektions-Ende mit Genauigkeit und Zeit | **angepasst** | Ring = Pflicht x/y. Serie nach Emrahs Regel (ein Ruhetag je Woche statt Serienschutz-Kauf). Session-Ende mit Genauigkeit, Zeit und Mitgenommenem, ohne Punkte. | Heute, Session-Ende, Profil-Knopf |
| DU7 | Übungszentrum: Fehler wiederholen | **ja** | „Aus deinen Fehlern“: Reparatur-Sätze (`app/repair`), falsche Karten der Woche, Grammatik-Fehler. Einmal pro Woche als Block in der Einheit, jederzeit als Extra. | Heute › Extra; Übungs-Player |
| DU8 | Ligen, Edelsteine, Energie/Herzen, Freundes-Quests | nein | Kinderspiel, extrinsisch; Energie bestraft Üben. Widerspricht Kap. 2.7. | – |
| BA1 | Lektion mit Dialog, Übungen, Zusammenfassung | **angepasst** | Wochenthema-Einheit: Business-Dialog (TTS, Schlüssel-Wendungen markiert) → 3–5 Übungen genau dazu → „Das nimmst du mit“ (Karten automatisch im Wortschatz). | Heute › Tageseinheit |
| BA2 | Grammatik-Tipp im Fluss | **ja** | Kleine Karte „Kurz erklärt“ direkt vor der Aufgabe mit dem Muster, zuklappbar. Inhalt aus den Grammatikthemen (lokal, keine KI-Wartezeit). | Übungs-Player |
| BA3 | Review-Manager mit Modus-Wahl | **angepasst** | Ein Stapel, Modus über „Aa“: Aufdecken · Tippen · Hören (TTS spricht, Emrah tippt). Kein Sprech-Modus mit Bewertung. | Stapel-Sitzung |
| BA4 | Spracherkennung, Babbel Speak | **angepasst** | Keine Aussprache-Bewertung. Ersatz: Emrah diktiert. Die App vergleicht das Diktat mit dem Zielsatz („Das iPhone hat verstanden: …“) als Verständlichkeits-Check. | Sprechen › Training; Übungs-Player |
| BA5 | Podcasts, Live-Kurse | **angepasst** | Hörtexte als „Podcast-Folge“ zum Wochenthema (KI-Skript, TTS, Satz für Satz). Live-Stunden = Preply. | Lesen (Filter Hören); Sprechen › Preply |
| BA6 | Einstufung, Lernziel, Erinnerung | **angepasst** | Einstufung = KI-Einschätzung aus Belegen. Ziel = Minuten/Tag. Erinnerung = Claude-Tagesauftrag. | Stand; Einstellungen |
| LQ1 | Bibliothek nach Niveau + „x % neue Wörter“ | **ja** | Anteil lokal berechnet: Wörter des Texts gegen Wortschatz + Grundwortschatz. Kachel zeigt „B2+ · 6 % neu · 4 Min.“. Filter Beruf/Alltag/Hören. | Lesen |
| LQ2 | Wortstatus-Farben, Status 1–4, Satzmodus | **angepasst** | Unterstreichung dezent: gelb = am Lernen (Stufe in 5 Punkten), keine Farbe = sicher/unbekannt. Kein Blau-Rauschen auf B2. Satzmodus als Umschalter (ein Satz, groß, mit ▶). | Leser |
| LQ3 | Phrase per Wischen | **ja** | Über 2–6 Wörter ziehen → Wortblatt für die Wendung mit Bedeutung im Satz (`sample` quick, Zwischenspeicher) und „+ Wortschatz“. | Leser, überall mit englischem Text |
| LQ4 | Seitenwechsel = Rest bekannt | nein | Auf B2 zu ungenau, verfälscht das Wortschatz-Urteil. | – |
| LQ5 | Eigene Texte, KI-Vereinfachen, KI-Stimmen | **angepasst** | Text **einfügen** (keine URL, kein Surfen). Knopf „Aufbereiten“ (Titel, Niveau, Schlüsselwörter). „Leichter“/„Näher an C1“ schreibt per `sample` um. Vorlesen per TTS. Foto eines Textes nur, wo `limits().images` es meldet. | Lesen › „+ Eigener Text“ |
| LQ6 | Statistik bekannte Wörter, Hörstunden | **angepasst** | Eine Zahl „sichere Wörter und Wendungen“ und Lese-/Hörminuten der Woche. Keine Münzen. | Stand |
| LQ7 | Mehrere Playlists | **angepasst** | „Anhören-Liste“: Hörtexte vormerken und nacheinander vorlesen lassen, solange der Bildschirm an ist. | Lesen |
| LQ8 | Wiederholen der Wörter dieser Lektion im Leser | **ja** | Am Textende „Wörter aus diesem Text üben (7)“ → kurze Stapel-Sitzung nur damit. | Leser-Ende |
| SP1 | Lernen → Üben → Anwenden | **ja** | Treppe in jeder Einheit: Muster → eigener Satz („Sag es“) → Gespräch/Mail. | Heute › Tageseinheit |
| SP2 | Sprechdrill mit Karaoke | **angepasst** | TTS mit Wort-Markierung (Ereignis `boundary`). Nachsprechen freiwillig, ohne Bewertung. Optional diktieren zum Verständlichkeits-Check. | Übungs-Player, Leser |
| SP3 | Rollenspiel mit drei Zielen als Checkliste | **ja** | Oben im Gespräch drei Ziele („Einwand anerkennen“, „ROI beziffern“, „Folgetermin“). `sample` hakt sie nach jeder Antwort ab (nachgeladen). | Sprechen › Gespräch |
| SP4 | Free Talk mit eigener Rolle | **ja** | „Eigene Szene“: Gegenüber, Ziel, Ton in drei Feldern, oder aus „Mein nächster Termin“ übernehmen. | Sprechen |
| SP5 | Fehler → persönliche Wiederholung | **ja** | Nach Gespräch/Mail: „Daraus üben“ erzeugt 5 Reparatur-Sätze (`app/repair`) und Karten. Kommen in der nächsten Einheit wieder. | Gespräch-Auswertung, Schreibwerkstatt |
| SP6 | Phrasebook | **ja** | = Wortschatz mit Filter „Wendungen“. Jede Wendung aus Gespräch/Feedback mit einem Tipp speichern. | Wortschatz |
| SP7 | KI-Tutor jederzeit, Lektion auf Zuruf | **ja** | Claude-Blatt „Fragen“ mit Kontext (aktueller Satz). „Mach mir eine Übung dazu“ erzeugt 5 Aufgaben in den Player. | Claude-Blatt |
| BU1 | Lernplan mit Zieldatum | **angepasst** | „Ziel C1“: Die KI-Einschätzung nennt je Fertigkeit den Stand. Zieldatum nur als Spanne und nur mit genug Belegen, ehrlich statt motivierend. | Stand |
| BU2 | Wortstärke-Balken, Filter schwach | **ja** | 5 Punkte je Karte (existiert). Filter „Unsicher“ → „Diese üben“. | Wortliste, Wortblatt |
| BU3 | Eigener Text mit Streich-/Einfügekorrektur | **ja (KI statt Community)** | Sofort per `sample`, Anzeige als Diff im Satz. | Schreibwerkstatt |
| BU4 | KI-Gespräch zum Lektionsinhalt | **ja** | Gespräch der Tageseinheit nutzt die Wendungen des Wochenthemas als Ziel. | Tageseinheit › Aufgabe |
| BU5 | Grammatik-Stärke je Thema | **ja** | Existiert (Beherrschungsmodell), als Balken in der Grammatik-Liste. | Heute › Grammatik |
| ME1 | Muttersprachler-Videos | nein | Plattform (kein Video); TTS reicht. | – |
| ME2 | Modi Lernen/Schnell/Schwierig/Hören | **angepasst** | Als Einträge der Extra-Runde (siehe AN8), nicht als eigene Bildschirme. | Wortschatz › Extra-Runde |
| ME3 | „Kenne ich schon“ | **ja** | Bei neuer Karte: „Kenne ich“ → gleich Stufe sicher, eine Kontrolle nach 7 Tagen als Lücke. | Stapel-Sitzung |
| ME4 | MemBot-Mission mit Lektionswörtern | **ja** | = SP3, Wörter der Woche als Ziel „nutze 3 davon“. | Gespräch |
| ME5 | Eigene Szenarien | **ja** | = SP4. | Sprechen |
| CM1 | Häufigkeitsliste | **angepasst** | Business-Häufigkeit statt allgemeiner: Neue Wörter kommen bevorzugt aus Emrahs Texten, Gesprächen und Preply, nicht aus einer fremden Liste. | Tagesplan (unsichtbar) |
| CM2 | Lücke Auswahl oder Tippen + erster Buchstabe | **ja** | Existiert (Platzhalter, „Tipp“ zählt als Hilfe). | Stapel-Sitzung, Player |
| CM3 | Meisterschaft 0–100 % | **angepasst** | Als 5 Punkte aus FSRS, keine Prozentzahl. | überall bei Karten |
| CM4 | Cloze-Listening | **ja** | Modus „Hören“: TTS spricht den Satz (Tempo 1,0/0,85), Text verborgen, Lücke tippen. Keine Geräusche/Akzente (TTS-Grenze). | Stapel-Sitzung (Aa), Übungs-Player |
| CM5 | Grammar Challenges im Lückenformat | **ja** | Grammatik-Runde (Lückenjagd) existiert, im Fokus-Block. | Übungs-Player |
| CM6 | Punkte, Ränge | nein | Kinderspiel-Anmutung. | – |
| RL1 | Übersetzung am Wort, Phrase ziehen | **ja** | = Wortblatt / LQ3. | überall |
| RL2 | Karte = Originalsatz mit Lücke | **ja** | Existiert (Ursprungssatz Pflicht). | Wortschatz |
| RL3 | KI-Erklärung im Kontext | **ja** | Wortblatt „Claude fragen“ mit Satz als Kontext. | Wortblatt → Claude-Blatt |
| RL4 | Eigene Texte hochladen | **ja** | = LQ5 (Einfügen). | Lesen |
| RL5 | Export der Wortliste | **ja** | `downloads`: CSV/TSV (Vorderseite, Rückseite, Satz, Tags), direkt in Anki importierbar. Dazu die Sicherung. | Einstellungen › Daten |
| RL6 | Auto-Pause je Satz, Satz wiederholen | **ja** | Hör-Leiste: ▶ Satz · ↺ Satz · Tempo · „Pause nach jedem Satz“. | Leser (Hören) |
| LV1 | Wort in Satzlücke tippen mit Übersetzung | **ja** | Existiert als aktive Stufe; Satz-Übersetzung als Hilfe erst auf Tipp. | Stapel-Sitzung (Tippen) |
| LV2 | Adaptive Reihenfolge | **ja** | FSRS + Vorrang fälliger, neue auch an vollen Tagen (Kap. 15). | Tagesplan |
| LV3 | Stapel aus Text/Foto | **angepasst** | Text einfügen → `sample` schlägt 5–15 unbekannte Wörter/Wendungen mit Satz vor → Häkchen → „Übernehmen“. Foto nur mit `images`. | Wortschatz › + › „Aus Text“ |
| LV4 | Tagesziel in Karten, Kurve gelernter Wörter | **angepasst** | Kurve „sichere Einträge“ (monatlich) im Stand. Das Tagesziel bleibt die Pflicht, keine Kartenzahl. | Stand |
| EL1 | Lautfarben je Phonem | nein | Kein verlässlicher Mikrofonzugang, keine Audio-Analyse in `sample`. | – |
| EL2 | Laut antippen → Anleitung, Betonung | **angepasst** | Wortblatt: US-Lautschrift mit **Betonungsmarke**, Silben, ▶ normal/langsam. Liste „Wörter, die Deutsche oft falsch betonen“ (Beruf: *development, analysis, percent*). Minimalpaare als Hör-Auswahl. | Wortblatt; Sprechen › Training |
| EL3 | Sprech-Wert auf CEFR abgebildet | **angepasst** | Kein Zahlwert. KI-Urteil je Fertigkeit in Worten mit Belegen (Sätze aus Gesprächen). | Stand |
| EL4 | Freie Rede analysieren | **angepasst** | Flüssigkeit 90/60/45 (existiert): Emrah diktiert. Auswertung von Wortschatz, Satzbau, Verbindungswörtern. Wörter pro Minute nur als grobe Angabe. | Sprechen › Training |
| EL5 | Business-Rollenspiele (Verhandlung, Verkauf, Präsentation) | **ja** | Szenen-Bibliothek Business (siehe BE5) mit Transkript. | Sprechen |
| QZ1 | Wischen „weiß ich/lerne noch“, Richtung umkehren | **ja** | = AN2/AN4a. | Stapel-Sitzung |
| QZ2 | Learn: erst Auswahl, dann Schreiben | **angepasst** | Neue Karten steigen durch Abfragearten auf: erkennen → Lücke mit Platzhaltern → frei tippen → DE→EN (8 Abfragearten existieren). | Stapel-Sitzung, Player |
| QZ3 | Test mit gemischten Formaten + Fehlerliste | **ja** | = Wochen-Check (existiert): 10–15 gemischte Aufgaben aus der Woche, am Ende die Fehlerliste mit „Diese üben“. | Heute (wenn fällig); Stand › Tests |
| QZ4 | Match auf Zeit | **angepasst** | „Kollokations-Paare“: 6 Verben zu 6 Nomen (`raise` + `concerns`) als 60-s-Aufwärmen, ohne Bestenliste. Nur Extra. | Extra-Runde |
| QZ5 | Sterne → nur markierte | **ja** | = AN5b-Markierung + Filter. | Wortliste |
| GL1 | Satz-Wiederholungen hören/nachsprechen | **angepasst** | „Hörschleife“: 10 Sätze aus fälligen Karten, TTS spricht EN, Pause, spricht wieder. Keine Bewertung, zählt nicht als Wiederholung. | Wortschatz › Extra-Runde |
| GL2 | Getrennte Ziele Lernen/Wiederholen | nein | Ein Tagesziel (Pflicht), sonst Widersprüche (Kap. 2.2). | – |
| GL3 | Freihändig-Modus | **angepasst** | = GL1. Grenze: stoppt bei gesperrtem Bildschirm (Safari). | Extra-Runde |
| DW1 | Verbesserte Fassung mit markierten Änderungen | **ja** | Schreibwerkstatt: „Korrigieren“ zeigt den Text mit Streichung/Einfügung, Umschalter „Änderungen zeigen / Endfassung“. | Schreibwerkstatt |
| DW2 | Antippen → Alternativen | **ja** | Tipp auf einen Satzteil → 3 Alternativen mit Etikett (neutral · diplomatischer · direkter), je „Übernehmen“ und „+ Wortschatz“. `sample` quick, erst auf Tipp. | Schreibwerkstatt, Gespräch-Auswertung |
| DW3 | Stil/Ton wählen | **ja** | = drei Tonlagen (existiert) als Umschalter über dem Text: Kollegial · Kundenseite · Vorstand. | Schreibwerkstatt |
| DW4 | US/UK | **angepasst** | US Standard, UK gilt als richtig, Hinweis statt Fehler (A7). | überall |
| GR1 | Kategorie-Unterstreichungen + Karte „Übernehmen“ + Warum | **ja** | Drei Kategorien statt vier: **Fehler** (rot) · **Natürlicher** (blau) · **Ton** (lila). Karte mit Vorschlag, „Übernehmen“, einer Zeile Warum, „Als Reparatur-Satz merken“. | Schreibwerkstatt |
| GR2 | Ton-Erkennung | **ja** | Eine Zeile über dem Text: „Wirkt: bestimmt · höflich · etwas indirekt“, mit „Direkter machen“. | Schreibwerkstatt |
| GR3 | Ziele (Publikum, Formalität) | **ja** | Vor dem Schreiben: Empfänger (CFO, IT-Leiter, Partner, Kollege) und Zweck (Angebot, Nachfassen, Absage). Geht in den Prompt. | Schreibwerkstatt |
| GR4 | Gesamtwert, Wochenbericht | **angepasst** | Kein Wert. Wochenbericht (existiert) nennt 1 Stärke, 1 wiederkehrenden Fehler, 1 Wendung, die neu sitzt. | Stand › Wochenbericht |
| BE1 | Berufsprofil → Gespräche zum eigenen Job | **ja** | „Mein Kontext“: Firma/Produkt (DMS/ECM-Cloud), Kunden, typische Einwände, anstehende Termine. Fließt in jeden Prompt, gekürzt auf 1–2 KB. | Einstellungen › Mein Kontext; wirkt überall |
| BE2 | Avatar | nein | Kein Video; kein Mehrwert gegenüber Text + TTS. | – |
| BE3 | Vertriebs-Rollenspiel mit Bewertungsraster; Füllwörter/Tempo | **ja (Raster) / nein (Tempo)** | Jede Business-Szene hat 3–5 Kriterien. Auswertung je Kriterium ✓/teilweise/✗ mit Zitat aus Emrahs Antwort. Füllwörter/Tempo nicht messbar (Diktat glättet). | Gespräch-Auswertung |
| BE4 | Menschliche Coaches | **angepasst** | = Preply-Brücke: Vorbereitung vor der Stunde, Import der Korrekturen danach. | Sprechen › Preply |
| BE5 | Szenario-Bibliothek Business | **ja** | 12–20 feste Szenen zu Emrahs Alltag: Discovery-Call, CFO „zu teuer“, IT „Sicherheit/DSGVO“, Preisverhandlung, Kickoff, Quartalszahlen, Absage, Follow-up. Dazu eigene Szenen. | Sprechen |
| CA1 | Offene Lücke, Wortbildung, Schlüsselwort-Umformung | **ja** | Als C1-Fokus-Aufgaben aus Emrahs **eigenen** Wendungen, per `sample` im Voraus erzeugt (Vorrat). Lokal geprüft mit erlaubten Varianten. Umformung = C1-Kernübung. | Übungs-Player (Fokus-Block) |
| CA2 | Mehrtext-Zuordnung, Absatz-Lückentext | **angepasst** | Beim Lesen gelegentlich: „Welcher Absatz fehlt?“ bzw. „Wer vertritt Meinung X?“ bei zwei kurzen Texten. Nur Extra. | Leser (Fragen am Ende) |
| CA3 | Essay/Proposal/Report 220–260 Wörter | **angepasst** | Business-Gattungen: E-Mail, Proposal, kurzer Report, LinkedIn-Post. Wortzahl-Anzeige live, Ziel 150–250. Einmal pro Woche. | Schreibwerkstatt |
| CA4 | Long Turn 1 Min., Diskussion | **ja** | = Flüssigkeit 90/60/45 und „Sag es“. Aufgabe „Vergleiche zwei Angebote und empfiehl eins“ als Long Turn. | Sprechen › Training |
| CA5 | C1 Business Higher Kontexte | **ja** | Alle Fokus- und Schreibaufgaben mit Business-Stoff (2/3) und Alltag (1/3). | überall |
| CA6 | Write & Improve: CEFR-Schätzung je Text, überarbeiten, erneut | **ja** | Nach der Korrektur ein Niveau-Satz („Solides B2+, zwei Stellen klingen C1“) + „Nochmal, aber besser“. Die zweite Fassung zeigt den Unterschied. Belege gehen ins KI-Urteil. | Schreibwerkstatt → Stand |

---

## 3. Rangliste: 25 Funktionen, ohne die sich die App nicht wie ein hochwertiges, featurestarkes Produkt anfühlt

Reihenfolge nach Wirkung auf Emrahs Alltag und Eindruck („richtige App“), nicht nach Aufwand. Die meisten Bausteine existieren in Daten und Domäne schon. Neu ist vor allem die Oberfläche.

| Rang | Funktion | Vorbild | Warum unverzichtbar | Ort |
|---|---|---|---|---|
| 1 | **Heute mit einem Knopf, Tagesring (Pflicht x/y) und echtem „Fertig für heute“** | Duolingo, Anki | Beim Öffnen in < 2 s klar, was dran ist. Erledigt ist Zustand, kein Knopf. | Heute |
| 2 | **Anki-Stapel-Sitzung: Aufdecken, 4 Knöpfe mit Intervall, App-Vorschlag, Wischen, Rückgängig** | Anki, Quizlet | Emrahs ausdrücklicher Wunsch. Die sichtbaren Intervalle machen die Methode erkennbar. | Wortschatz › Stapel-Sitzung |
| 3 | **Jedes englische Wort antippbar → Wortblatt (Bedeutung im Satz, US-Lautschrift, ▶, „+ Wortschatz“ mit Ursprungssatz), Phrase per Ziehen** | LingQ, Readlang | Verbindet alle Module mit dem Wortschatz. Löst „Wort aus dem Übersetzer nicht speicherbar“. | überall |
| 4 | **Feedback-Leiste unten: Status, Diff der eigenen Antwort, Lösung, „Warum?“ nachladend mit Rückfrage-Chips** | Duolingo Max, Busuu | Fester Ort für die vier Pflichtfragen. Die KI blockiert nie. | Übungs-Player, Stapel-Sitzung |
| 5 | **Unterbrechungsfest: jede Antwort sofort gespeichert, „Weiter, wo du warst (4 von 8)“** | Duolingo, Anki | Die größte Klage (Absturz → von vorn). Ohne Vertrauen gibt es kein Premium-Gefühl. | Heute, alle Übungen |
| 6 | **Session-Ende-Bildschirm mit Ergebnis, „Das nimmst du mit“ und nächstem Schritt** | Babbel, Duolingo, Anki | Jede Sitzung hat einen Abschluss mit Sinn statt Konfetti. | nach jeder Übung |
| 7 | **Claude-Blatt überall: Übersetzen/Fragen mit Kontext, jedes Ergebnis mit „+ Wortschatz“ und „Mach mir eine Übung dazu“** | Speak-Tutor, DeepL | Der eigentliche „intelligenter als Babbel“-Hebel, in 1 Tipp erreichbar. | oben rechts, überall |
| 8 | **Leser im LingQ-Stil: Wortstatus dezent, Satzmodus, „x % neu“ je Text, eigene Texte einfügen, „Leichter/Näher an C1“** | LingQ, Readlang | Input ist der größte Hebel B2 → C1. Eigene Inhalte machen es persönlich. | Lesen, Leser |
| 9 | **Business-Rollenspiel mit Ziel-Checkliste und Auswertung (Transkript, Kriterien-Raster, „besser wäre“, Wendungen mitnehmen)** | Speak, Yoodli, Loora | Genau Emrahs Berufsalltag (CFO/IT-Einwände, Verhandlung). | Sprechen › Gespräch |
| 10 | **Schreibwerkstatt: Inline-Korrektur in 3 Kategorien, Alternativen je Satzteil, Tonlage, Empfänger** | Grammarly, DeepL Write | E-Mails sind Emrahs häufigste Produktion. Die sichtbare Verbesserung ist sofort nützlich. | Sprechen › Schreiben |
| 11 | **Statistik in Anki-Qualität, aber knapp: Kalender-Heatmap, 7-Tage-Prognose, Erinnerungsquote, Karten je Zustand** | Anki | Macht die wissenschaftliche Methode sichtbar (Emrahs Kritik „keine Methoden erkennbar“). | Stand, Wortschatz |
| 12 | **Wortliste/Browser: Suche, Filter-Chips, Mehrfachauswahl, Bearbeiten, Aussetzen, Zurücksetzen, Verlauf je Karte** | Anki, Busuu | 250+ Karten brauchen Pflege. Ohne Browser fühlt sich ein SRS-Werkzeug unfertig an. | Wortschatz › Alle Einträge |
| 13 | **Lücke im Originalsatz mit Buchstaben-Feedback und Platzhaltern** | Lingvist, Clozemaster, Anki-Cloze | Aktiver Abruf im Kontext ist die wirksamste Form. Tippen muss sich nativ anfühlen. | Stapel-Sitzung, Player |
| 14 | **„Aus deinen Fehlern“: Reparatur-Sätze und falsche Karten als persönliche Runde** | Speak, Duolingo, Busuu | Individuelle Fehler zu üben, unterscheidet einen Tutor von einem Kurs. | Heute (wöchentlich), Extra |
| 15 | **Extra-Runde nach „Fertig“: vergessene, vorziehen, nach Stapel, hartnäckige, +10 neue, Hörschleife** | Anki Custom Study, Memrise | Wer mehr will, bekommt sinnvolle Angebote, klar getrennt von der Pflicht. | Wortschatz, Session-Ende |
| 16 | **Hartnäckige Karten mit KI-Umbau (neues Beispiel, Merkhilfe, Kontrastpaar)** | Anki Leeches + KI | Hier ist die App klüger als Anki: sie repariert die Karte statt sie nur zu markieren. | Wortblatt, Filter |
| 17 | **Serie mit Wochenstreifen und Ruhetag, Heatmap statt Flammen-Show** | Duolingo, Anki | Konstanz sichtbar machen, ohne Druck. Emrahs Regel existiert. | Profil-Knopf, Stand |
| 18 | **„Mein Kontext“ + „Claude merkt sich“ (sichtbar, löschbar)** | Duolingo Video Call, Loora | Jede KI-Antwort passt zu Emrahs Firma, Kunden und Terminen. So entsteht das Gefühl „nur für mich“. | Einstellungen; wirkt überall |
| 19 | **Zwei Richtungen je Karte (erkennen/abrufen) + Hör-Lücke** | Anki (umgekehrt), Clozemaster | Abwechslung der Abfrageart (Kap. 15). DE→EN und Hören sind C1-relevant. | Stapel-Sitzung |
| 20 | **Vorlesen mit Karaoke-Markierung, Tempo 0,75/1,0, Satz für Satz, Pause je Satz** | Speak, Language Reactor, LingQ | Hören auf C1 braucht Kontrolle. TTS ist die einzige verlässliche Audio-Quelle. | Leser, Player, Wortblatt |
| 21 | **Wochenthema-Einheit: Dialog → Übungen → Anwenden → Mitnehmen** | Babbel, Speak | Kombinierte Aufgaben am selben Thema (Kap. 2.5), Kursgefühl ohne starren Kurs. | Heute › Tageseinheit |
| 22 | **Niveau-Urteil in Worten je Fertigkeit mit Belegen + Text-Einschätzung („solides B2+, zwei Stellen C1“)** | Write & Improve, ELSA, Busuu | Urteil statt Punktestand (Kap. 2.3). Fortschritt wird spürbar. | Stand, Schreibwerkstatt |
| 23 | **C1-Formate als Fokus-Übungen: Schlüsselwort-Umformung, Wortbildung, offene Lücke** | Cambridge C1 | Trainiert genau den Unterschied B2 → C1 (Umformulieren, Wortfamilien). | Übungs-Player |
| 24 | **Business-Szenen-Bibliothek + eigene Szenen aus „Mein nächster Termin“** | Loora, Memrise, ELSA | Featurestärke, die Emrah täglich braucht: Situation wählen, sofort üben. | Sprechen |
| 25 | **Import und Export: Text → Karten-Vorschläge, Foto (wo erlaubt), CSV-Export für Anki, Sicherung** | Lingvist, Readlang, Anki | Die Daten gehören Emrah. Materialien aus Mails und Preply wandern ohne Abtippen hinein. | Wortschatz › +, Einstellungen › Daten |

---

## 4. UI-Muster, die Premium-Apps gemeinsam haben (ohne Kinderspiel)

Referenz nach Kap. 2.7: Linear, Things, Arc, Speak. Jedes Muster ist beschrieben mit „so machen es die Besten“, „so bei Emrah“ und „nicht“.

| # | Muster | So machen es die Besten | So bei Emrah | Nicht |
|---|---|---|---|---|
| 1 | **Session-Ende-Bildschirm** | Duolingo: 3 Kacheln (Punkte, Genauigkeit, Zeit). Anki: „Glückwunsch“ + Custom Study. Babbel: „Das hast du gelernt“. | Drei ruhige Kacheln: **Richtig x/y · Zeit 6:40 · 5 neue Einträge**. Darunter die Liste „Das nimmst du mit“ (antippbar) und „Aus Fehlern: 2 Sätze kommen morgen wieder“. Ein Knopf „Weiter: Lesen“ oder „Fertig für heute“ (Zustand). | Konfetti, Maskottchen, XP-Regen, Truhen |
| 2 | **Fortschrittsbalken in der Übung** | Duolingo/Speak: dünner Balken oben, füllt sich je Aufgabe | Eine Übungsleiste: `×` · Balken · „12 / 40“ · Claude. Balken wächst in 150 ms, keine Sprünge zurück. Falsche Aufgaben verlängern den Balken sichtbar („+2“). | Herzen/Energie neben dem Balken |
| 3 | **Tages-Ring** | Apple Fitness, Duolingo-Tagesziel | Ein Ring auf Heute = Pflichtschritte x/y. Zahl in der Mitte, Unterzeile „noch ca. 12 Min.“. Voll = Häkchen und „Fertig“, der Knopf verschwindet. | Mehrere konkurrierende Ringe, XP-Ring |
| 4 | **Wochenstreifen / Serie** | Duolingo-Wochenkalender, Things „Logbuch“ | 7 Punkte Mo–So unter dem Ring: ● Pflicht, ◐ nur Extra, ○ Ruhetag (einer erlaubt). Serienzahl im Profil-Knopf. | Flammen-Animationen, „Deine Serie ist in Gefahr!“ |
| 5 | **Kalender-Heatmap** | Anki-Kalender, GitHub-Beiträge | 16 Wochen × 7 Tage, 4 Tonstufen aus Minuten. Tipp auf einen Tag → „Mi 17.9.: 28 Min., Einheit + 12 Karten“. | Punkte/Level-Anzeigen |
| 6 | **Prognose** | Anki „Future Due“ | 7 Balken „Fällig die nächsten Tage“ mit heutigem Balken hervorgehoben. Ein Satz dazu: „Mo wird voll (52), leichte Tage glätten das.“ | Diagramme ohne Handlungsfolge |
| 7 | **Karten-Statistik je Eintrag** | Anki Karten-Info, Busuu-Balken, LingQ-Status | Im Wortblatt: 5 Punkte + Wort („unsicher“), „fällig morgen“, **Verlauf als Reihe** ✓✓✗✓, Herkunft („aus: Gespräch CFO, 12.9.“). | Rohdaten (Stabilität 13,42) |
| 8 | **Feedback-Leiste unten** | Duolingo, Busuu | Farbe nur als Streifen links + Symbol (auch für Farbenblinde). Diff inline. „Warum?“ als Textlink, streamt nach. Haptik nur bei „Prüfen“, auf dem iPhone rein visuell. | Vollbild-Rot, Buzz-Töne |
| 9 | **„Fertig“ als Zustand** | Anki-Leerer-Stapel, Things „Heute erledigt“ | Erledigtes wird grau mit Häkchen, nicht mehr antippbar. „Fertig für heute“ ist eine ruhige Fläche, darunter „Extra“ klar abgesetzt. | Erledigte Aufgaben als Knöpfe (Kap. 15) |
| 10 | **Leere Zustände mit genau einer Aktion** | Linear, Things | „Noch keine eigenen Texte. [Text einfügen]“ statt leerer Liste. | Illustrationen mit Witz-Texten |
| 11 | **Skelette statt Spinner, Streaming statt Warten** | Linear, ChatGPT/Claude | Graue Platzhalter in Endgröße (kein Springen). KI-Text erscheint wortweise. Nach Wartezeit je Stufe „dauert länger“ + Stopp. | Drehende Kreise, blockierende Dialoge |
| 12 | **Blätter von unten** | iOS-Karten, Speak | Wortblatt, Claude, Extra-Runde, Hinzufügen: halbe Höhe, hochziehbar, Wischen schließt. | Modale Vollbild-Dialoge für Kleinigkeiten |
| 13 | **Wischkarten mit Rückgängig** | Tinder-Muster in Quizlet/Anki | Wischen mit Neigung und Farbhauch an der Kante. „↶“ 5 s als Toast. | Wischen ohne Rückweg |
| 14 | **Undo-Toast statt „Wirklich?“** | Gmail, Things | Löschen/Aussetzen/Markieren sofort, unten „Rückgängig“. `×` in Übungen fragt nie nach, denn alles ist gespeichert. | Bestätigungsdialoge |
| 15 | **Suche mit Filter-Chips** | Linear, Apple Notes | Eine wischbare Chip-Reihe, Zähler im Chip („Hartnäckig 4“). Sortierung als Symbol. | Formular-Filter, Suchsyntax |
| 16 | **Audio-Knopf überall gleich** | Babbel, LingQ | ▶ neben jedem englischen Satz, gleiche Größe, gleicher Ort (rechts). Lange drücken = langsam. | Autoplay ohne Kontrolle |
| 17 | **Zusammenfassung nach Gespräch als Transkript** | Duolingo Video Call, ELSA, Speak | Chat-Verlauf mit markierten Stellen. Tipp → „besser wäre“ + „+ Wortschatz“. Oben die Ziel-Checkliste mit ✓. | Nur eine Punktzahl |
| 18 | **Inline-Diff bei Korrekturen** | Busuu, DeepL Write, Grammarly | ~~durchgestrichen~~ rot, **eingefügt** grün, Umschalter „Endfassung“. | Nur die korrigierte Fassung ohne Unterschied |
| 19 | **Plan mit ehrlicher Vorschau** | Busuu-Lernplan, Anki-Simulator | „Bei 27 Min./Tag: ≈ 35 Wiederholungen, 8 neue.“ Das Zieldatum C1 erscheint nur als Spanne mit Belegen. | Versprechen („In 3 Monaten fließend!“) |
| 20 | **Wochenrückblick** | Grammarly-Wochenbericht, Duolingo-Jahresrückblick | Montags eine Karte auf Heute: 1 Stärke, 1 Muster zum Üben, 1 neue sichere Wendung. Ein Tipp öffnet den Bericht. | Vergleich mit anderen, Ranglisten |
| 21 | **Meilensteine statt Abzeichen** | Things (ruhig), LingQ (Wortzahl) | Selten und inhaltlich: „100 Wendungen sicher“, „erste Mail ohne Fehler-Markierung“, „Can-Do erreicht“ mit Beleg. Einmal gezeigt, dann im Stand. | Abzeichen-Sammlung, Truhen, Levels |
| 22 | **Bewegung dezent und schnell** | Linear, Arc | ≤ 200 ms, nur Deckkraft/Verschieben, Übergang zwischen Aufgaben seitlich. „Bewegung reduzieren“ wird befolgt. | Hüpfende Figuren, lange Animationen |
| 23 | **Typografie als Hierarchie** | Things, Speak | Eine große Zeile je Bildschirm (Aufgabe/Wort), Zahlen tabellarisch, Englisch leicht hervorgehoben (Gewicht, nicht Farbe). | Bunte Kärtchen-Collage |
| 24 | **Ein Ort für Einstellungen, wenige Schalter** | Speak, Things | Gruppen: Wortschatz (Zielerinnerung, neue/Tag, leichte Tage) · Stimme (Tempo) · Mein Kontext · Claude merkt sich · Darstellung · Daten (Sicherung, Export, Diagnose). | Anki-Optionsdschungel |
| 25 | **Tastatur-sichere Eingabe (iPhone)** | Lingvist, Duolingo | Eingabe **in** der Lücke. `visualViewport` hält sie über der Tastatur. Die Diktier-Taste wird im Hinweis gezeigt, „Prüfen“ liegt über der Tastatur. | Eingabefeld unter dem Satz, verdeckte Knöpfe |

---

## Quellen (Websuche 27.09.2026)
- Anki: [Release 25.07](https://github.com/ankitects/anki/releases/tag/25.07), [Release 25.02](https://github.com/ankitects/anki/releases/tag/25.02), [Release 25.09.2](https://github.com/ankitects/anki/releases/tag/25.09.2), [FSRS Helper](https://ankiweb.net/shared/info/759844606), [Statistik/Simulator (DeepWiki)](https://deepwiki.com/ankitects/anki/4.3-statistics-and-analytics)
- Duolingo: [Was ist Max](https://www.duolingo.com/help/what-is-duolingo-max), [KI hinter Video Call](https://blog.duolingo.com/ai-and-video-call/), [Video Call für Android](https://investors.duolingo.com/news-releases/news-release-details/duolingo-launches-ai-powered-video-call-android), [Energie-System](https://duoplanet.com/duolingo-energy-system/), [Energie (Blog)](https://blog.duolingo.com/duolingo-energy/)
- Babbel: [Babbel Speak](https://www.babbel.com/press/en-us/releases/babbel-speak), [Sprach-Funktionen](https://www.babbel.com/press/en-us/releases/learn-with-your-own-voice-babbel-launches-two-new-speech-based-features-us), [Is Babbel worth it 2026](https://testprepinsight.com/resources/is-babbel-worth-it/)
- LingQ: [LingQ 5.0](https://www.lingq.com/blog/introducing-lingq-5-0/), [KI-Lektionen](https://www.lingq.com/blog/ai-powered-language-lessons/), [App Store](https://apps.apple.com/us/app/lingq-learn-languages/id379385811), [Review 2026](https://lingtuitive.com/blog/lingq-review)
- Speak: [speak.com](https://www.speak.com/), [Tutor Lessons](https://help.speak.com/en/articles/11966855-what-are-tutor-lessons), [Review 2026 (Languatalk)](https://languatalk.com/blog/speak-app-review/)
- Busuu: [Conversations](https://blog.busuu.com/new-conversations-release/), [KI-Gespräche](https://www.busuu.com/en/languages/language-learning-with-busuu-conversations)
- Memrise: [Neue App](https://www.memrise.com/blog/major-update-a-new-version-of-the-app-is-coming), [Änderungen](https://www.memrise.com/blog/changes-to-the-memrise-app)
- Clozemaster: [Pro](https://www.clozemaster.com/pro), [Review (All Language Resources)](https://www.alllanguageresources.com/clozemaster-review/)
- Readlang: [Features](https://readlang.com/features)
- Lingvist: [Wikipedia](https://en.wikipedia.org/wiki/Lingvist), [Review (FluentU)](https://www.fluentu.com/blog/reviews/lingvist/)
- ELSA: [App Store](https://apps.apple.com/us/app/elsa-speak-english-learning/id1083804886), [Speech Analyzer](https://elsaspeak.com/en/speech-analyzer-coming-soon/)
- Quizlet: [Studieren auf Quizlet](https://help.quizlet.com/hc/en-us/articles/360030841732-Studying-on-Quizlet), [Q-Chat eingestellt](https://quizgecko.com/blog/best-q-chat-alternative), [Was ist neu (Tech & Learning)](https://www.techlearning.com/how-to/what-is-quizlet-and-how-can-i-teach-with-it)
- Glossika: [Hilfe: effektiv trainieren](https://help.glossika.com/en/articles/6611459-step-4-the-most-effective-way-to-train-on-glossika), [Review (FluentU)](https://www.fluentu.com/blog/reviews/glossika/)
- DeepL Write: [Produktseite](https://www.deepl.com/en/products/write), [Stil und Ton](https://support.deepl.com/hc/en-us/articles/9710730337820-Customize-your-text-with-DeepL-Write)
- Grammarly: [Tone Detector](https://www.grammarly.com/blog/product/tone-detector/), [Ton-Umschreiben](https://www.grammarly.com/blog/product/tone-rewrite-suggestions/)
- Business English: [Loora Business English](https://www.loora.com/use-cases/business-English), [Business-English-Apps 2025 (BoldVoice)](https://boldvoice.com/blog/business-english-apps), [Szenario-Abdeckung (TalkMe)](https://blog.talkme.ai/archives/best-business-english-speaking-apps-ranked-by-workplace-scenario-coverage)
- Cambridge: [C1 Advanced Format](https://www.cambridgeenglish.org/exams-and-tests/qualifications/advanced/format/), [C1 Advanced (Wikipedia)](https://en.wikipedia.org/wiki/C1_Advanced)
- Yoodli und Cambridge Write & Improve: Produktwissen, nicht per Websuche geprüft.
