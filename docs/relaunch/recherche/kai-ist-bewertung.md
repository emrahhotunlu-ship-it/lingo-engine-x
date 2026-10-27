# Kai – Ist-Bewertung der heutigen App (Stand live v86, 27.10.2026)

**Rolle:** Emrahs Anwalt und Kritiker. Dieses Dokument ist die **Messlatte**: Kein Relaunch-Konzept geht an Emrah, solange ich nicht in jeder der 14 Facetten mindestens 9 von 10 erwarte.

**Wie ich geprüft habe:**
- **Die echte App benutzt:** Produktions-Build und Test-Laufzeit mit erfundenen Daten. Das ist der Stand, den Emrah live hat (v86).
- **Zwei Bildschirmgrößen:** Handy 390×844 mit Touch und Laptop 1440×900.
- **Ausgangslage:** frischer Montag, 21.09. um 9 Uhr, dunkles Design, Deutsch.
- **Durchgespielt habe ich:**
  - Heute;
  - eine Wörter-Runde mit 22 Aufgaben: richtig, falsch und „Weiß ich nicht“ gemischt;
  - ein Grammatik-Kapitel bis zum Themen-Test;
  - ein Rollenspiel mit Abschlussbericht;
  - die Seiten Anwenden, Lesen, Wörter und Fortschritt/„Dein Stand“;
  - Claude-Chat und Einstellungen.
- **Logik dort gelesen, wo Emrahs Kritik zielt.**

Belege stehen als `Datei:Zeile` oder als Foto. Sechs Fotos liegen in `kai-fotos/`, alle übrigen im Scratchpad.

**Vorbehalt:** Die Testdaten beginnen nach einer Pause („du holst auf“, 52 Karten). Viele Karten stehen deshalb auf frühen Stufen. Das erklärt einen Teil der Auswahl-Aufgaben, aber nicht alles. Der Code bestätigt dasselbe Muster unabhängig von den Daten (siehe Facette 2).

---

## 1. Gesamturteil in 5 Sätzen

1. Die App ist technisch solide, sauber gestaltet und ehrlicher geworden. Ihr Kern ist aber ein **Wiedererkennungs-Trainer**: Von 22 Wort-Aufgaben einer echten Runde waren 13 Auswahlaufgaben, 8 Lücken in einem bekannten Satz und genau **eine** freie Abfrage ohne Satz.
2. Emrahs Hauptklage stimmt im Code: Deutsch→Englisch frei ohne Satz kommt nur, wenn eine Karte **keinen** tauglichen Lückensatz hat (`src/domain/srs/modes.ts:113-116`). Raten wird nur leiser gewertet, nicht erkannt.
3. **Hören und Sprechen** sind nicht Teil des Tages. Das Rollenspiel liegt drei Tipps tief unter „Grammatik › Extra“, ist als „Laptop“ markiert und wird getippt, nicht gesprochen. Damit kann die App Emrah nicht „fluent und confident“ machen.
4. Grammatik hat jetzt eine schöne C1-Karte mit 7 Kapiteln. Der Weg durch ein Kapitel fühlt sich aber nicht wie ein Kurs an:
   - Der erste Knopf eines neuen Themas ist ein Test.
   - Die Runde heißt „Extra“.
   - Die tägliche Grammatik ist „gemischt“.
5. Der Laptop zeigt eine vergrößerte Handy-Spalte, und der Fortschritt zeigt vier verschiedene Wahrheiten nebeneinander. Mein Gesamturteil ist deshalb **4,9 von 10**. Das bestätigt Emrahs eigene 5–6.

---

## 2. Notentabelle

| # | Facette | Note | Kernbegründung |
|---|---|---|---|
| 1 | Lernmethodik | **6** | Starkes Fundament: FSRS, automatische Benotung, „Warum“ auch bei richtiger Antwort, Fehlerschleife. Die Abfolge bleibt aber vom Erkennen geprägt, und es gibt kein „Vorbereiten → Üben → Anwenden“. |
| 2 | Wörter frei abrufen statt raten oder am Satz erkennen | **4** | 59 % Auswahl und 36 % Lücke im Satz, nur 5 % frei ohne Satz. Freies Tippen ohne Satz ist die Ausnahme im Code. Raten wird nicht erkannt. |
| 3 | Grammatik als Kurs | **5** | Gute C1-Karte und „Abgeschlossen heißt“. Aber: Test vor jeder Erklärung, die Runde läuft als „Extra“, Heute mischt die Grammatik, und es gibt keinen sichtbaren Lernschritt zwischen zwei Tests. |
| 4 | Hören | **3** | Hören ist nicht im Tag. Die Hörschleife läuft „ohne Bewertung“, das Diktat ist als „Laptop“ markiert. Gesprochen wird mit den Gerätestimmen. |
| 5 | Sprechen, Flüssigkeit, Selbstsicherheit | **3** | Rollenspiel versteckt, getippt, mit 45-Sekunden-Uhr. Spracheingabe nur, wenn der Browser sie zulässt. Der Abschlussbericht ist dagegen stark. |
| 6 | Anpassung | **5** | FSRS je Wort und ein Wissensmodell je Grammatik-Thema. Aber keine Rate-Erkennung bei Wörtern, und „118 von 124 erwartet gekonnt“ beruht auf Erkennen. |
| 7 | Vielfalt und Kombination | **5** | Viele Formen und 15 Anwenden-Kacheln, aber jede für sich. Die Pflicht besteht nur aus Wörtern, Grammatik, Satzbau und Fehlern. Kein gemeinsames Thema. |
| 8 | Roter Faden zu C1 und ehrlicher Fortschritt | **5** | Ehrliche Fest-Regel und C1-Karte. Aber vier widersprüchliche Zahlen, kein wiederholbarer Einstufungstest im Verlauf. Emrah „merkt keinen Fortschritt“. |
| 9 | Optik | **7** | Ruhig, dunkel, gute Schrift, einheitlich. Dafür textlastig, viel graue Kleinschrift, Karten in Karten, Tastatur-Hinweise am Handy. |
| 10 | Handy | **6** | Großer Daumen-Knopf, Lücke im Satz, klare Rückmeldung. Aber 6 Reiter, 3 Symbole im Übungskopf, sehr lange Seiten, „Enter prüft“ am Handy. |
| 11 | Laptop | **4** | Schmale Mittelspalte auf 1440 px, Reiter oben als Pille, Chat als schwebendes Fenster über dem Inhalt. Keine Seitenleiste, keine Kontextspalte. |
| 12 | Motivation | **5** | Serie, Wochenrückblick, Ergebnis-Karte, guter Rollenspiel-Bericht. Aber 52 Karten Aufholen, „Noch nicht“ als Grundton, Fortschritt nicht fühlbar, alles Spannende ist „Extra“. |
| 13 | Zuverlässigkeit | **6** | Viele Tests, Datenschutz durch Schemas, nie Datenverlust. Aber laufend Inhaltsfehler: ~4.400 falsche Wortart-Stellen, 57 Bedeutungs-Zwillinge, Fix-Versionen. Dazu wackelnde Tempo-Tests. |
| 14 | Tempo | **5** | Start-Knopf nach 2,8 s ungebremst und 4–5,5 s auf schwachem Handy, Ziel ist unter 2 s. Paket 5,96 von 6 MiB. Eine „12-Minuten“-Runde mit 52 Karten. |
| | **Durchschnitt** | **4,9** | |

---

## 3. Je Facette ausführlich

### Facette 1 – Lernmethodik (6/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - Jede Antwort bekommt sofort ein Urteil, ein „Warum“ und ein „Merke“, auch wenn sie richtig ist. Beispiel in der Grammatik: „‚twice a year‘ ist regelmäßig, also Present Simple, 3. Person: flies.“ (Log `h-gram2`, Aufgabe 0)
  - Die App benotet selbst aus Richtigkeit, Zeit und Hilfe. Es gibt keine Selbstbewertung (`src/domain/srs/grade.ts`).
  - Neue Wörter kommen mit Einführungskarte, Ursprungssatz, Aussprache und „Sag es einmal laut“ (Scratchpad-Foto `h-02-runde-04-einfuehrung.png`).
- **Schwach:**
  - Die Abfolge ist „Einführung → Auswahl → Auswahl → Lücke mit Anfangsbuchstaben“. Der Aufbau ist am Erkennen geeicht.
  - Die Entwickler haben es selbst gemessen: „Erkennen lief auf 98,7 % (Deckeneffekt), Produzieren auf 50–68 % … Die App wich der schwachen Art aus (20 Erkennungen gegen 3 Produktionen)“ (`src/domain/srs/modes.ts:191-192`).
  - Lesen, Hören, Sprechen und Schreiben sind ausdrücklich nicht Teil der Tageseinheit (`src/domain/unit/planFor.ts:29`). Das Muster „Vorbereiten → Üben → Anwenden“ (Ilias, Muster 1) fehlt im Tag.

**Was eine 9,5 bräuchte**
- Jede Tageseinheit endet in einer **Anwendung**: sprechen oder schreiben mit genau den Wörtern und der Grammatik des Tages.
- Abrufschwierigkeit am Rand des Könnens, also rund 70 % Erfolg (Mara, Punkt 6: Birdbrain).
- Korrektur am Ende statt Unterbrechung beim Sprechen (Ilias, Muster 3).

**Abstand:** mittel. Das Fundament (Planung, Benotung, Erklärung) ist da. Es fehlt die **Didaktik der Abfolge**.

---

### Facette 2 – Wörter frei abrufen statt raten oder am Satz erkennen (4/10)

**Was Emrah erlebt (Belege)**
- **Echte Runde mit 22 Aufgaben** (Handy und Laptop gleich):

  | Form | Anzahl |
  |---|---|
  | Bedeutung auf Englisch wählen (`mc_en`) | 5 |
  | Bedeutung im Satz wählen (`ctx_mc`) | 4 |
  | Deutsch wählen (`mc_de`) | 4 |
  | Lücke frei im Satz (`cloze`) | 2 |
  | Lücke mit Anfangsbuchstaben (`cloze_hint`) | 6 |
  | Frei schreiben ohne Satz (`type`) | 1 |

  Dazu kamen 2 Vorabfragen, ebenfalls Auswahl. Die Auswahl lag also bei 59 %, die Lücke im Satz bei 36 %, frei ohne Satz bei 5 %.
- **Foto `kai-fotos/2-handy-woerter-auswahl.jpg`:**
  - Gefragt war „revenue streams“, die Auswahl lautete Einnahmequelle, Altsystem, Bestellung, Prüfpfad.
  - Drei der vier Antworten scheiden für einen B2-Lerner sofort aus. Das ist Ausschlussraten, kein Wissen.
- **Der Code bestätigt es:**
  - Freies Deutsch→Englisch ohne Satz (`type`) ist nur erlaubt, wenn die Karte **keinen** tauglichen Lückensatz hat: `return !!meaning && !gapOk(card);` (`src/domain/srs/modes.ts:113-116`). Fast jede Karte hat einen Satz, also übt Emrah fast immer **am Satz**. Genau das ist seine Klage: „erkenne Wörter an der Satzstruktur“.
  - „Frei“ zählt auch für die Lücke im **immer gleichen Ursprungssatz** (`src/domain/srs/variety.ts:130`, `FREE_ANSWER` enthält `cloze`).
  - Raten wird nur gedämpft, nicht erkannt: Eine Auswahl zählt 0,55, eine freie Antwort 1,0 (`src/domain/srs/weight.ts:8`). Eine Frage „sicher oder geraten?“ gibt es nicht (keine Fundstelle in `src/i18n`). Einen Rate-Faktor gibt es nur bei der Grammatik (`src/domain/grammar/bkt.ts:7-8`).
- **Gut:**
  - Die strenge Fest-Regel: frei richtig nach mindestens 21 Tagen Pause, mit neuem oder eigenem Satz (`src/domain/metrics/cardStatus.ts:17, 27-32`).
  - „Sag es“ ab 2 freien Abruftagen (`src/domain/srs/modes.ts:160`).

**Was eine 9,5 bräuchte**
- Ab dem ersten Tag ein **freier Abruf ohne Satz**: Deutsch→Englisch tippen oder sprechen.
- **Jedes Mal ein anderer Satz** (Vocabulary.com hat bis zu 122 Fragen je Wort, Mara, Facette 2).
- Auswahl höchstens als Einstieg.
- Schwere Formen zählen sichtbar mehr (Clozemaster doppelt).
- Ein Wort gilt erst als „kann ich“, wenn es frei produziert wurde.

**Abstand:** groß. Das ist der wichtigste Einzelpunkt des Relaunchs.

---

### Facette 3 – Grammatik als Kurs (5/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - Eine C1-Karte mit 7 Kapiteln und 47 Themen, „Du bist hier“, und je Kapitel ein klares „Abgeschlossen heißt …“ (Foto `kai-fotos/6-laptop-grammatik.jpg`).
  - Das Kapitelblatt sagt: „Deine Grammatik von heute kommt aus diesem Kapitel.“
  - Fehler werden gesammelt und kommen „morgen wieder“.
- **Schwach:**
  - Das erste Thema von Kapitel 1 ist „Neu“, trotzdem heißt der Hauptknopf **„Test starten“**: „Kurzer Test ohne Hilfe … Höchstens ein Fehler ist erlaubt.“ (Log `h-grammatik`).
  - Nach 6 Aufgaben steht da „Noch nicht bestanden · 4 von 6 richtig … Ab morgen ist der Test wieder bereit“ (Foto `kai-fotos/3-handy-grammatik-test-ende.jpg`).
  - Eine Erklärung, also ein Lernschritt zwischen zwei Tests, war auf diesem Weg nicht zu sehen.
  - Die Kapitelrunde trägt oben das Etikett **„Extra“**, obwohl sie der Kurs ist.
  - Heute heißt der Grammatik-Schritt „Deine Fehlerthemen, fällige und neue Grammatik, **gemischt**“ (Foto `kai-fotos/1-handy-heute.jpg`). Für Emrah sind das zwei Grammatiken: Kapitel hier, Mix dort.
  - Je Tag 6 Grammatik-Aufgaben (`src/domain/unit/planFor.ts:33`). Bei 47 Themen ist ein Kapitel so kaum spürbar zu „schaffen“.

**Was eine 9,5 bräuchte**
- **Ein** Kursweg, der täglich ein Stück weitergeht: Vorab-Test → kurze Erklärung → gelenktes Üben → freies Anwenden in einem eigenen Satz → Nachtest. Das ist das Muster von British Council und Murphy (Mara, Facette 3).
- Die Wiederholung ist erkennbar Teil desselben Kurses.
- Ein sichtbares „Kapitel 1 zu 40 % geschafft“ nach jeder Sitzung.

**Abstand:** mittel bis groß. Die Karte ist da, der **Gang durch das Kapitel** nicht.

---

### Facette 4 – Hören (3/10)

**Was Emrah erlebt (Belege)**
- Hören ist **nicht Teil der Pflicht**: „Lesen, Hören, Sprech- und Schreibaufgaben sind nicht mehr Teil der Einheit.“ (`src/domain/unit/planFor.ts:29`). In der Wörter-Runde gab es 0 Höraufgaben (`listen_mc` ist nur auf Stufe 1 möglich).
- Auf „Anwenden“ stehen Diktat („**Laptop**“), Hörübung mit Frage und eine Hörschleife „ohne Bewertung“ (Scratchpad-Foto `h-30-anwenden-full.png`). Alles ist freiwillig, und die App lernt daraus nichts über Emrahs Hörverstehen.
- Die Sprachausgabe nutzt die Stimmen des Geräts (`src/platform/speech.ts`). Die Qualität hängt also vom Handy ab.
- **Gut:** Lautsprecher-Knopf an jedem Wort und jedem Rollenspiel-Satz, dazu die Lautschrift.

**Was eine 9,5 bräuchte**
- Hören in Stufen (Ilias, Muster 9): langsam → normal → mit Störgeräusch, dazu Business-Akzente.
- Täglich mindestens ein Hörteil in der Pflicht, mit den Wörtern des Tages.
- Hörverstehen wird gemessen und im Fortschritt gezeigt.

**Abstand:** sehr groß.

---

### Facette 5 – Sprechen, Flüssigkeit, Selbstsicherheit (3/10)

**Was Emrah erlebt (Belege)**
- **Weg zum Rollenspiel:** Reiter Grammatik › Extra › Sprechen. Die Zurück-Verknüpfung heißt sogar „‹ Grammatik“ (Scratchpad-Foto `h-20-sprechen.png`). Auf Anwenden steht es mit dem Etikett „**Laptop**“.
- Im Rollenspiel steht unten „Deine Antwort auf Englisch“ als **Tippfeld**, dazu die Uhr „noch 45 s für deinen Zug“ (Foto `kai-fotos/4-handy-rollenspiel-tippen.jpg`). Getipptes Englisch unter Zeitdruck trainiert weder Flüssigkeit noch Selbstsicherheit.
- **Spracheingabe:**
  - Sie gibt es nur, wenn der Browser sie anbietet und die Richtlinie sie erlaubt. Scheitert sie, verschwindet der Knopf „sofort und dauerhaft“ (`src/platform/stt.ts:10, 45-64`).
  - Der Laufzeit-Vertrag `contract/` (0.2.49) kennt keine Mikrofon-Fähigkeit.
  - **Hinweis für Tarek:** Die heutige Artefakt-Plattform nennt inzwischen eine Mikrofon-Fähigkeit als Laufzeit-Fähigkeit. Das sollte geprüft werden.
- **Gut, unbedingt erhalten:** der Abschlussbericht (Scratchpad-Foto `h-24-bericht-full.png`). Er enthält:
  - die Ziele erreicht oder nicht;
  - „Szene insgesamt: teilweise erreicht“;
  - Stärken mit Zitat;
  - einen Fokus „Vorschläge abschwächen“ mit C1-Fassung;
  - den C1-Werkzeugkasten;
  - die besten Wendungen zum Mitnehmen;
  - „**Nochmal, aber besser**“.

  Das ist inhaltlich auf Niveau von Speak und Praktika.

**Was eine 9,5 bräuchte**
- **Sprechen ist der Standard:** Drücken zum Sprechen, dazu sofort eine Verständlichkeits-Prüfung (Ilias, Muster 10 und 12).
- Täglich 2–5 Minuten Sprechen in der Pflicht.
- Mission-Rollenspiele aus Emrahs Sales-Alltag mit angstfreiem Einstieg, also ohne Uhr am Anfang.
- 4/3/2-Wiederholung für Flüssigkeit.
- Sichtbare Entwicklung, z. B. „Sprechtempo +12 %, Pausen −30 %“.

**Abstand:** sehr groß. Das ist Emrahs „ich werde nicht fluent und confident“.

---

### Facette 6 – Anpassung (5/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - FSRS je Wort, also eine Vergessenskurve.
  - Ein Wissensmodell je Grammatik-Thema mit Rate-Faktor (`src/domain/grammar/bkt.ts:27`).
  - Die Abfrageform richtet sich nach der Schwäche der Karte (`src/domain/srs/modes.ts:191-197`, `CHOICE_PENALTY`, `PRODUCTION_BOOST`).
  - Fehlersätze kommen „morgen wieder“.
- **Schwach:**
  - „Die App merkt nicht, ob ich mir etwas merke“: Beim Wort fließt eine richtig **geratene** Auswahl als Erfolg in den Plan ein, nur leiser gewichtet (`src/domain/srs/weight.ts:8`).
  - Der Fortschritt sagt „**Erwartet gekonnt 118 von 124**“, direkt darunter „Frei abgerufen nach Pause: — (zu wenig Daten, 1 bisher)“ (Foto `kai-fotos/5-handy-fortschritt.jpg`). Das Modell traut Emrah 95 % zu, gemessen ist fast nichts frei.
  - Der Inhalt passt sich nicht an Emrahs Beruf an. Die Rollenspiel-Szenen sind fest (Cloud-DMS, Migration …). Das ist okay, aber nicht „seins“.

**Was eine 9,5 bräuchte**
- Zwei getrennte Modelle (Mara, Punkt 4):
  - eines für das Vergessen;
  - eines für das Können, getrennt nach Erkennen, frei Schreiben und Sprechen.
- Überraschend richtige Antworten bewegen viel, erwartete wenig.
- Antwortzeit und „sicher/geraten“ als Signal.
- Inhalte aus Emrahs echten Kundenterminen.

**Abstand:** mittel.

---

### Facette 7 – Vielfalt und Kombination (5/10)

**Was Emrah erlebt (Belege)**
- Es gibt **viele** Formen: 17 aktive Abfragearten (`src/domain/srs/modes.ts`) und 15 Kacheln auf Anwenden, etwa Wortpartner, Register-Leiter, Phrasal Verbs, Überleitungen, Umformen, Satz-Klinik und Schreibwerkstatt (Scratchpad-Foto `h-30-anwenden-full.png`).
- Sie stehen aber **nebeneinander, nicht miteinander**:
  - Die Pflicht besteht aus Wiederholen, Grammatik, Satzbau und Fehler korrigieren.
  - Alles andere ist „Freiwillig, zählt nie als Pflicht“.
  - Ein gemeinsames Thema des Tages gibt es nicht.
- In der Runde wiederholt sich das Muster. Sechsmal kam „Lücke mit Anfangsbuchstaben“, fünfmal „Bedeutung wählen“. Das fühlt sich gleich an, obwohl die Namen verschieden sind.

**Was eine 9,5 bräuchte**
- Ein Thema je Tag oder Woche (z. B. „Preisverhandlung“), das Wörter, Grammatik, Hören und Sprechen verbindet. Vorbilder: Busuu und Babbel (Mara, Facette 7).
- Weniger Kacheln, die dafür im Tagesweg automatisch kombiniert werden.

**Abstand:** mittel bis groß.

---

### Facette 8 – Roter Faden zu C1 und ehrlicher Fortschritt (5/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - Die ehrliche Fest-Regel und der Satz „Noch kein Wort ist fest. Das braucht Wochen …“.
  - Die C1-Karte in der Grammatik.
  - „Was laut Claude noch zu C1 fehlt“ mit konkreten Punkten.
- **Schwach:** Auf **einer** Seite stehen vier verschiedene Wahrheiten (Foto `kai-fotos/5-handy-fortschritt.jpg` und Scratchpad-Foto `h-51-fortschritt-full.png`):
  1. „Wörter B2 · Grammatik B2“ mit Balken kurz vor der C1-Marke;
  2. „passiv geschätzt 6.415 Wörter“, über der C1-Marke von 4.500;
  3. „Erwartet gekonnt 118 von 124“;
  4. „Noch kein Wort ist fest“ und „Frei abgerufen: —“.

  Für einen Nicht-Entwickler heißt das: „Ich bin fast C1, kann alles, und nichts sitzt.“ Kein Wunder, dass Emrah „keinen Fortschritt merkt“.
- Auch „Dein Stand“ über das Profil führt zu genau dieser Seite. Ein wiederholbarer Einstufungstest mit Verlaufskurve fehlt. Die Einstufung in der Grammatik gibt es nur einmal („Wo stehst du?“).

**Was eine 9,5 bräuchte**
- **Zwei** ehrliche Hauptzahlen: „erkenne ich“ und „kann ich selbst sagen oder schreiben“, je Woche als Kurve.
- Alle 4–6 Wochen eine wiederholbare Einstufung mit CEFR-Bericht (Voxy, Write & Improve, Mara Punkt 8).
- Ein Zieldatum C1.

**Abstand:** mittel.

---

### Facette 9 – Optik (7/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - Ruhiges, dunkles Design mit sauberer Schrift (Inter) und einer klaren Handlungsfarbe (weißer Hauptknopf).
  - Gute Rückmeldekarte „Noch nicht“ / „Richtig“ (Fotos 1–3).
- **Schwach:**
  - Viel graue Kleinschrift und viele Erklärsätze je Bildschirm. Auf Heute stehen allein 4 Unterzeilen. Auf Fortschritt steht ein Absatz unter jeder Zahl.
  - Karten liegen in Karten: Kapitelkarte, darin Karte, darin Chips (Foto 6).
  - Am Handy steht unter jeder Aufgabe „Enter prüft und geht weiter · A–D oder 1–4 wählen“. Das ist Laptop-Text am Handy.
  - Die Karte „Dein Weg zu C1“ ist schön, die übrigen Seiten wirken wie Listen.

**Was eine 9,5 bräuchte**
- Weniger Text, mehr Zustand: eine Zahl, ein Satz.
- Linear-, Things- oder Speak-Niveau bei Weißraum und Hierarchie (Nora).
- In der Übung kein „Chrome“, also kein Rahmenwerk um die Aufgabe.

**Abstand:** klein bis mittel.

---

### Facette 10 – Handy (6/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - Großer Hauptknopf unten im Daumenbereich.
  - Die Eingabe sitzt in der Lücke.
  - Klare Rückmeldung (Fotos 1–3).
- **Schwach:**
  - **6 Reiter**, Nora empfiehlt höchstens 5.
  - In jeder Übung stehen oben 3 Symbole: Übersetzen, Claude, Einstellungen (Foto 2).
  - Die Rückmeldekarte rutscht unter den „Weiter“-Knopf: „revenue stream“ ist halb verdeckt (Foto 2).
  - Anwenden ist ~2.600 px lang (Scratchpad-Foto `h-30-anwenden-full.png`).
  - Der Zähler zeigt „3 von 52“ fünf Aufgaben lang. Es ist unklar, wie weit es noch ist.

**Was eine 9,5 bräuchte**
- Übung im Vollbild ohne Kopf-Symbole und Rückmeldeband unten (Nora).
- Höchstens 5 Ziele.
- Fortschritt in Aufgaben statt in Karten.
- Gesten, und Sprechen mit dem Daumen.

**Abstand:** mittel.

---

### Facette 11 – Laptop (4/10)

**Was Emrah erlebt (Belege)**
- Auf 1440 px nutzt die Grammatik-Seite eine Mittelspalte von ~760 px, links und rechts ist alles leer (Foto `kai-fotos/6-laptop-grammatik.jpg`). Heute nutzt zwei Spalten (Plan und Fortschritt), der Rest bleibt leer (Scratchpad-Foto `l-01-heute.png`).
- Die Reiter liegen oben als Pille, nicht als Seitenleiste.
- Der Claude-Chat öffnet sich als **schwebendes Fenster über dem Inhalt** und verdeckt die Fortschrittskarte (Scratchpad-Foto `l-60-chat.png`).
- **Gut:**
  - In der Übung steht die Rückmeldung rechts neben der Aufgabe (Scratchpad-Foto `l-02-runde-08-…-ergebnis.png`).
  - Es gibt Tastenkürzel: A–D, 1–4, Enter.
- Emrahs Satz „Laptop sollte anders aufgebaut sein als Handy“ trifft zu: Es ist das Handy-Layout, nur breiter.

**Was eine 9,5 bräuchte**
- Seitenleiste mit Navigation, Arbeitsfläche in der Mitte und eine **Kontextspalte** rechts: Wörterbuch, Claude, Notizen, Regel (Nora).
- Tastenkürzel direkt am Knopf sichtbar.
- Laptop-Stärken nutzen: Schreibwerkstatt, längeres Rollenspiel, Diktat.

**Abstand:** groß.

---

### Facette 12 – Motivation (5/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - „Serie 12“ und der Wochenrückblick („Dein Wochenrückblick ist da“).
  - Der Rollenspiel-Bericht mit „1 von 1 Zielen erreicht“.
  - Pflicht und Freiwillig sind sauber getrennt.
- **Schwach:**
  - Nach einer Pause stehen da „Wiederholen · 52 Karten · du holst auf“ (Foto 1). Nach 22 Aufgaben steht der Zähler bei „11 von 52“ (Log `h-heute`). Das ist eine Wand, keine Einladung.
  - Der Grundton ist „Noch nicht“ und „Noch nicht bestanden“.
  - Das, was Spaß macht (Rollenspiel, Hören, Lesen), ist „Extra“.
  - „Fest“ dauert per Regel mindestens 3 Wochen. Ohne Zwischenstufen gibt es lange kein Erfolgserlebnis.

**Was eine 9,5 bräuchte**
- Ein **fühlbares** Gefühl „ich werde besser“ jede Woche: „Diese Woche 14 Wörter neu frei gesagt“ oder „Dein Pitch war 20 % flüssiger als vor 3 Wochen“.
- Aufholen in tragbaren Portionen.
- Anstrengung würdigen (Memrise), Schwierigkeit an der richtigen Stelle (Birdbrain).

**Abstand:** mittel bis groß.

---

### Facette 13 – Zuverlässigkeit (6/10)

**Was Emrah erlebt (Belege)**
- **Gut:**
  - Hunderte automatische Tests, jedes gelesene Dokument wird geprüft, es gibt einen Rückweg je Version.
  - Daten gingen nie verloren.
  - Meine Durchläufe hatten keine Abstürze.
- **Schwach (laut eigener Liste `CLAUDE.md` A4 und `docs/umbau/stand.md`):**
  - ~4.400 Wortart-Stellen unmarkiert falsch und 57 Bedeutungs-Zwillinge.
  - Eine eigene Version nur, um einen „kaputten Beispielsatz“ zu reparieren (v74).
  - Wackelnde Tempo-Tests (perf.spec).
- 86 Live-Versionen in gut einem Monat. Für Emrah heißt das: Es ändert sich ständig etwas.
- Die Spracheingabe verschwindet nach einem Fehler dauerhaft (`src/platform/stt.ts:10`).

**Was eine 9,5 bräuchte**
- Ein Inhaltsfehler ist die Ausnahme: jeder Satz lehrergeprüft, Stichprobe unter 0,5 % Fehler.
- Wenige, gebündelte Releases.
- Abgesicherter Rückweg für Spracheingabe und Ausgabe, mit verständlichem Hinweis statt Verschwinden.

**Abstand:** mittel.

---

### Facette 14 – Tempo (5/10)

**Was Emrah erlebt (Belege)**
- Der Start-Knopf war nach **2,8 s** sichtbar, in der Cloud ohne Bremse (Log `h-heute`). Auf einem gebremsten Handy sind es 4–5,5 s (`docs/umbau/stand.md`, Masterplan 9,5 Schritt 1). Das Ziel aus Kap. 14 ist unter 2 s.
- Das Paket liegt bei 5,96 von 6 MiB eigenem Limit. Es gibt kaum Luft für Neues.
- Lerntempo:
  - „Wiederholen 12 Min.“ bei 52 Karten.
  - Nach 22 Aufgaben ist ein Fünftel geschafft.
  - Die Zeitangabe ist für Emrah nicht glaubwürdig.
- **Gut:** Übergänge zwischen den Aufgaben sind flott, die Eingabe in der Lücke reagiert sofort.

**Was eine 9,5 bräuchte**
- Unter 1 s bis zum ersten sinnvollen Bild (Skelett) und unter 2 s bis zum Start-Knopf auf einem Mittelklasse-Handy.
- Tagesumfang und Zeitangabe stimmen auf ±20 %.

**Abstand:** mittel.

---

## 4. Was unbedingt erhalten bleiben muss

1. **Automatische Benotung ohne Selbstbewertung** aus Richtigkeit, Zeit und Hilfe (`src/domain/srs/grade.ts`).
2. **„Warum“ und „Merke“ bei jeder Antwort, auch bei richtiger.** Dazu „Erklär mir meine Antwort“ und „War das auch richtig?“.
3. **Eingabe direkt in der Lücke** mit Buchstaben-Animation und sofortiger Reaktion.
4. **Einführungskarte** für neue Wörter: Wort groß, Bedeutung, Wortart, Ursprungssatz, Aussprache, Lautschrift, „Kenne ich“.
5. **Strenge, ehrliche Fest-Regel** (frei richtig nach mindestens 21 Tagen Pause, neuer Satz) und die Sprache „Noch kein Wort ist fest … das kommt“.
6. **FSRS-Planung und die Datensicherheit**: Schemas, ein Schreibweg, nie Neueres überschreiben, Rückweg je Version.
7. **Rollenspiel-Abschlussbericht**: Ziele, Stärken mit Zitat, Fokus mit C1-Fassung, C1-Werkzeugkasten, beste Wendungen, „Nochmal, aber besser“.
8. **Fehlersatz-Schleife**: eigene Fehler kommen in neuen Sätzen wieder.
9. **Grammatik-C1-Karte** mit „Abgeschlossen heißt …“ je Kapitel und Einstufung „Wo stehst du?“.
10. **Klare Trennung von Pflicht und Freiwillig** und **ein Hauptknopf** auf Heute.
11. **Wort-Antippen überall, Übersetzer und Claude** jederzeit erreichbar. Auf dem Laptop gehören sie in eine Kontextspalte.
12. **Ruhiges, dunkles Grunddesign** und die Rückmeldekarte rechts neben der Aufgabe auf dem Laptop.

---

## 5. Kais Abnahmekriterien

Ein Relaunch-Konzept besteht meine Sperre erst, wenn jedes Kriterium **prüfbar** erfüllt ist: im Test mit erfundenen Daten, als Foto oder als Messwert.

**1 Lernmethodik**
- 1a. Jede Pflicht-Einheit hat drei sichtbare Phasen: Vorbereiten (neu oder fällig) → Üben → **Anwenden** (sprechen oder schreiben mit mindestens 3 Wörtern und 1 Grammatikpunkt des Tages).
- 1b. Die Erfolgsquote je Sitzung liegt über 7 Tage gemittelt zwischen 65 % und 85 %. Beides wird gemessen und angezeigt.

**2 Wörter frei abrufen**
- 2a. Ein Wort gilt erst als **gelernt**, wenn es an zwei verschiedenen Tagen **ohne Satzkontext** Deutsch→Englisch richtig getippt oder gesprochen wurde.
- 2b. In einer Wiederholungsrunde mit mindestens 20 Aufgaben ist der Anteil Auswahl bei Karten ab Stufe 2 höchstens 20 %. Mindestens 40 % sind freier Abruf ohne Satz oder in einem **anderen** Satz als dem Ursprungssatz.
- 2c. Eine richtige Auswahl-Antwort bringt ein Wort nie über „erkannt“ hinaus. Eine richtige Antwort nach über 15 s oder nach Hilfe zählt nicht als sicher.

**3 Grammatik als Kurs**
- 3a. Ein neues Thema läuft immer in der Abfolge Vorab-Check → Erklärung (höchstens 90 s) → gelenkt → frei (eigener Satz) → Nachtest. Kein Thema startet mit einem Test, ohne dass danach eine Erklärung folgt.
- 3b. Die tägliche Grammatik der Pflicht stammt zu mindestens 70 % aus dem aktuellen Kapitel und heißt dort nie „Extra“. Nach jeder Sitzung ist der Kapitelfortschritt in % sichtbar gestiegen.

**4 Hören**
- 4a. Jede Pflicht-Einheit enthält mindestens 2 Minuten Hören mit Bewertung, mit Wörtern oder Grammatik des Tages.
- 4b. Hörverstehen hat eine eigene Zahl im Fortschritt. Es gibt mindestens 3 Hörstufen (langsam, normal, natürlich mit Akzent).

**5 Sprechen**
- 5a. Sprechen ist am **Handy** in maximal 2 Tipps von Heute erreichbar und Teil der Pflicht (mindestens 2 Minuten pro Tag). Antworten werden standardmäßig gesprochen, Tippen ist die Ausnahme.
- 5b. Kein Zeitdruck in den ersten 2 Zügen eines Rollenspiels. Die Korrektur kommt am Ende, nicht mitten im Satz.
- 5c. Der Fortschritt zeigt eine Sprechkurve über mindestens 4 Wochen, z. B. Wörter pro Minute, Pausen und Anteil korrekter Sätze.

**6 Anpassung**
- 6a. Erkennen, frei Schreiben und Sprechen werden je Wort **getrennt** geführt. Die Auswahl der nächsten Aufgabe nutzt die schwächste der drei.
- 6b. Eine Antwort, die vom Modell als geraten erkannt wird (schnell, Auswahl, sonst schwach), wird beim nächsten Mal frei abgefragt. Das ist im Test nachweisbar.

**7 Vielfalt und Kombination**
- 7a. Jede Pflicht-Einheit hat ein benanntes Thema. Wörter, Grammatik, Hören und Sprechen der Einheit hängen daran.
- 7b. In 20 Aufgaben kommt keine Form öfter als 4-mal vor, und mindestens 5 verschiedene Formen kommen vor.

**8 Roter Faden und ehrlicher Fortschritt**
- 8a. Auf der Fortschritt-Seite gibt es genau **zwei** Hauptzahlen für Wörter („erkenne ich“, „kann ich frei“) und eine C1-Schätzung mit Datum. Keine Zahl widerspricht einer anderen.
- 8b. Alle 4–6 Wochen wird eine wiederholbare Einstufung angeboten. Ihr Ergebnis erscheint als Verlaufskurve.

**9 Optik**
- 9a. Kein Bildschirm hat mehr als 1 Hauptknopf und 3 Textzeilen Erklärung über dem ersten Inhalt. In Übungen steht keine Tastatur-Hilfe am Handy.
- 9b. Blindtest: Fünf Bildschirme werden neben Speak/Linear gestellt. Emrah ordnet sie als „gleich hochwertig“ ein.

**10 Handy**
- 10a. Höchstens 5 Ziele in der unteren Leiste. In der Übung gibt es keine Kopf-Symbole außer Schließen, der Rest liegt hinter „…“.
- 10b. Die Rückmeldung ist ohne Scrollen vollständig über dem Weiter-Knopf lesbar (Test auf 390×844).

**11 Laptop**
- 11a. Ab 1280 px gibt es eine Seitenleiste und eine Kontextspalte (Wörterbuch, Claude, Regel). Der Chat verdeckt nie die Aufgabe.
- 11b. Jede Übung ist komplett mit der Tastatur bedienbar. Die Kürzel stehen sichtbar am Knopf.

**12 Motivation**
- 12a. Jede Woche zeigt die App mindestens einen **gemessenen** Fortschritt in Alltagssprache, z. B. „12 Wörter neu frei gesagt“ oder „Pitch 15 % flüssiger“.
- 12b. Nach einer Pause ist die Pflicht nie länger als 20 Minuten. Rückstand wird über Tage verteilt und sichtbar abgebaut.

**13 Zuverlässigkeit**
- 13a. Eine Stichprobe von 200 Lernsätzen hat unter 1 % sprachliche Fehler (Gegenlesung durch `english-teacher`).
- 13b. Höchstens ein Live-Gang pro Woche. Fällt Spracheingabe oder -ausgabe aus, sieht Emrah einen verständlichen Hinweis und einen Ausweg, statt dass der Knopf einfach verschwindet.

**14 Tempo**
- 14a. Start-Knopf in unter 2 s auf einem Mittelklasse-Handy (4×-Bremse im Test), Skelett in unter 1 s.
- 14b. Die angezeigte Dauer einer Einheit weicht im Mittel höchstens 20 % von der gemessenen ab.

---

**Fotos** (verkleinert in `docs/relaunch/recherche/kai-fotos/`):
1. `1-handy-heute.jpg`: Heute mit 52 Karten Aufholen, Grammatik „gemischt“
2. `2-handy-woerter-auswahl.jpg`: Auswahlaufgabe, Lösung per Ausschluss ratbar
3. `3-handy-grammatik-test-ende.jpg`: erstes Thema startet als Test, Etikett „Extra“
4. `4-handy-rollenspiel-tippen.jpg`: Rollenspiel als Tippfeld mit 45-Sekunden-Uhr
5. `5-handy-fortschritt.jpg`: vier widersprüchliche Wahrheiten zum Wortschatz
6. `6-laptop-grammatik.jpg`: Laptop als breite Handy-Spalte
