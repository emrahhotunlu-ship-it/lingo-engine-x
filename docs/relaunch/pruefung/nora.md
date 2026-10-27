# Prüfung des Relaunch-Konzepts: Design und Bedienung (Nora)

**Stand:** 27.10.2026 · **Geprüft:** `docs/relaunch/konzept.md` (Entwurf 1) gegen meinen Bericht `recherche/nora-design.md` (Layouts je Breite §3, Design-System §4, Bewegung §5, Muster M1–M20 §7, Anti-Muster §8). Hintergrund: Kais Fotos und Kriterien (`recherche/kai-ist-bewertung.md`, `kai-fotos/`), Mikrofon-Probe (`recherche/mikrofon-probe.md`). Einmalige Prüfung nach `team.md`, Schritt 4.

**Gesamturteil:** Das Design-System (Farbebenen, Tokens, Schrift, Bewegung, Skelett) ist sauber übernommen. Schwach ist das, was zwischen den Bausteinen liegt: Wie sich das Rückmeldeband bei langen Rückmeldungen verhält, wie eine 28-Minuten-Sitzung mit sechs Blöcken abläuft, wo Dinge am Handy liegen, und wie die Übung am Laptop wirklich aussieht. Dazu kommt, dass das Konzept die Mikrofon-Probe noch nicht eingearbeitet hat. Daraus folgen **5 Vetos**. Alle sind genaue Regeln oder Ersatztexte, keine Grundsatzfrage.

---

## 1. Muster-Tabelle

### 1.1 Top-Muster M1–M20

| # | Muster | Urteil | Konzept-Abschnitt | Begründung |
|---|---|---|---|---|
| M1 | Fester Übungsrahmen mit Rückmeldeband | **teilweise → Veto 1** | 12.1 | Rahmen und Band stimmen. Ungeregelt ist, wohin „Mehr“ aufklappt, wie die Hinweis-Runde („erst Prompt“) im Band aussieht und was mit Rückmeldungen passiert, die nicht in ein Band passen (Missionsbericht, Sag-es-Rückmeldung, Kapiteltest). Ohne diese Regeln ist Kai 10b nicht erreichbar. |
| M2 | Kein Chrome in der Übung | erfüllt | 12.1 | Nur Schließen und Balken, alles andere hinter „…“. |
| M3 | Eigene Laptop-Gestalt ab 1024 px | **verletzt → Veto 3** | 12.1, 13.2, 13.3 | 12.1 heißt „gleich auf allen Geräten“ und legt das Band unten fest. 13.3 legt die Rückmeldung in die Kontextspalte. Beides widerspricht sich. 1024–1279 px ist nicht beschrieben, große Bildschirme (2560 px, Kais Befund) gar nicht. |
| M4 | Tastatur sichtbar am Knopf | erfüllt | 13.3, 13.1 | Kürzel am Knopf, `?`, am Handy keine Tastatur-Hilfe. |
| M5 | Eine Handlungsfarbe, getrennt von „richtig“ | erfüllt | 12 | „Lösung gezeigt“ neutral, nie grün. Welche Farbe es wird, ist offen (siehe Verbesserung 5). |
| M6 | Thema aus drei Eingaben (OKLCH) | erfüllt | 12 | |
| M7 | Ein Gedanke pro Bildschirm, Warum zum Aufklappen | teilweise → Veto 1 | 12, 6.3 | Die Regel steht in 12. Der Missionsbericht in 6.3 zählt aber sieben Bestandteile auf, ohne Gestalt. Das wird eine Textwand, wenn es nicht geregelt ist. |
| M8 | Ein Weg, ein nächster Schritt | teilweise → Veto 5 | 2.1 | Eine Karte und ein Knopf, gut. Offen ist, was auf der Karte steht: Wie werden sechs Blöcke gezeigt, ohne dass die Liste mit Unterzeilen von heute (Kai Foto 1) wiederkommt? |
| M9 | Pulsierender nächster Punkt im Pfad | teilweise | 4.1 | Nicht erwähnt. Verbesserung 6. |
| M10 | Ring statt Punktestand | erfüllt | 11 | |
| M11 | Zählende Zahl im Takt | erfüllt | 11 | |
| M12 | Meilenstein-Momente sparsam | erfüllt | 11 | Kein Konfetti, kein Maskottchen. |
| M13 | Federn mit Bounce 0–0,15 | erfüllt | 12 | Kleiner Widerspruch: 12 nennt „Dauern 150–300 ms“, meine Tabelle hat für Blätter etwa 500 ms. Es gilt die Tabelle (Blatt 500 ms, Feder Bounce 0,1). |
| M14 | Aufspringen statt Seitenwechsel | teilweise | – | Nicht erwähnt. Verbesserung 6. |
| M15 | Skelett beim Start | erfüllt | 12, 14.2 | |
| M16 | Inter Display für Zahlen und Titel | erfüllt | 12 | |
| M17 | Fortschritt im Text sichtbar (Lesen) | teilweise | 15 (nur „Lesen bleibt“) | Lesen ist im Konzept nicht gestaltet. Verbesserung 7. |
| M18 | Erinnerung als Frage statt Vorwurf | erfüllt | 11 | |
| M19 | Grammatik-Erklärung als gestaltetes Element | erfüllt | 4.2 Schritt 2 | |
| M20 | Höchstens 5 Reiter am Handy | **teilweise → Veto 2** | 13.1 | Fünf Reiter, gut. Aber die Namen widersprechen sich („Sprechen“ und „Sprechen & Hören“), Lesen liegt unter „Sprechen“, und für Einstellungen gibt es am Handy keinen Ort. |

### 1.2 Design-System aus meinem Bericht (§3–§5)

| Baustein | Urteil | Konzept-Abschnitt | Begründung |
|---|---|---|---|
| Layouts je Breite (Handy / Rail / Laptop) | teilweise → Veto 3 | 13.1–13.3 | Die Stufen sind genannt, die Übung am Laptop und große Bildschirme fehlen. |
| Drei Farbebenen | erfüllt | 12 | Kanalfarben (Wörter, Grammatik …) sind nicht geregelt. Verbesserung 5. |
| Token-Datei, ein Radius, 8-px-Raster, eine Schattenstufe | erfüllt | 12 | |
| Schrift | erfüllt | 12 | |
| Bewegung | erfüllt | 12 | siehe M13 |
| Laden | erfüllt | 12, 14.2 | |
| Ziele ≥ 44 pt, Hilfen als Knöpfe | erfüllt | 12, 12.1 | |

### 1.3 Anti-Muster

| # | Anti-Muster | Urteil | Konzept-Abschnitt | Begründung |
|---|---|---|---|---|
| 1 | Mehr als 5 Reiter oder „Mehr“-Reiter | erfüllt | 13.1 | |
| 2 | Handy-Layout am Laptop gestreckt | teilweise → Veto 3 | 13.3 | 1440 px ist gelöst, 2560 px nicht. |
| 3 | Chrome in der Übung | erfüllt | 12.1 | |
| 4 | Textwände bei Ergebnis und Abschluss | teilweise → Veto 1 | 6.3, 9.2 | Missionsbericht ohne Gestalt; die Fortschritt-Seite sammelt viele Teile (Verbesserung 1). |
| 5 | Zahlen, die sich widersprechen | erfüllt | 9.1, 12.1 | |
| 6 | Konfetti, Maskottchen, Comic-Ton | erfüllt | 11 | |
| 7 | Glasflächen, durch die Text scheint | teilweise | – | Nicht erwähnt. Steht im Ersatztext von Veto 2. |
| 8 | Viele Akzentfarben ohne Rolle | erfüllt | 12 | |
| 9 | „Falsch“ oder „Lösung gezeigt“ in Grün | erfüllt | 12 | |
| 10 | Spinner oder leerer Start | erfüllt | 12, 14.2 | |
| 11 | Serien-Druck mit Schuldgefühl | erfüllt | 11 | |
| 12 | Ligen und Ranglisten | erfüllt | – | Kommen nicht vor. |
| 13 | Bounce über 0,4, Animationen über 1 s | erfüllt | 12 | Ring 600–800 ms liegt unter 1 s. |
| 14 | Großbuchstaben-Überschriften als Formular | erfüllt | 12 | |
| 15 | Nackte Textknöpfe unter 44 pt | erfüllt | 12.1 | |

**Zählung:** 30 von 42 Punkten erfüllt · 12 teilweise oder verletzt, daraus 5 Vetos.

---

## 2. Vetos

### Veto 1 (M1, M7, Anti 4): Das Rückmeldeband braucht feste Zeilen, eine Längengrenze und eine Regel für lange Ergebnisse

**Problem:** 12.1 verspricht „auf 390 × 844 ohne Scrollen vollständig lesbar“. Gleichzeitig sollen in oder an das Band: Urteil, Vergleich, Warum, Merke (15.2), „Mehr“, „Erklär mir meine Antwort“, „War das auch richtig?“ (15.2), „Warum diese Aufgabe?“ (7.3), die Hinweis-Runde „erst Prompt, dann Lösung“ (4.2, 7.2) und die Kontrastkarte (3.4). Für den Missionsbericht (6.3) und die Sag-es-Rückmeldung (2.2 Block 5) gibt es keine Gestalt. Außerdem ist 844 px nicht die Höhe, die Emrah sieht: Die Claude-App nimmt oben eigenen Platz weg [Vermutung, in der Vorschau zu messen].

**Ersatz für den Punkt „Unten“ in 12.1:**

> **Unten (Handy und Rail):** ein Knopf „Prüfen“. Nach dem Prüfen schließt die Tastatur, und das **Rückmeldeband** fährt hoch (220 ms). Es hat immer dieselben drei Zeilen an fester Stelle:
> 1. **Urteil** mit Symbol und Wort: Richtig ✓ · Fast ~ · Noch nicht ✕ · Lösung gezeigt ○ (neutral). Eine Zeile.
> 2. **Vergleich:** „Du: … → Richtig: …“, höchstens 2 Zeilen. Bei richtiger Antwort nur die Lösung.
> 3. **Warum** (zugleich das „Merke“): genau ein Satz, höchstens 120 Zeichen.
>
> Darunter höchstens **zwei** Nebenknöpfe mit Fläche (≥ 44 pt): „Mehr“ und, wo es passt, „War das auch richtig?“. „Erklär mir meine Antwort“, „Warum diese Aufgabe?“ und Claude liegen hinter „…“. Dann „Weiter“.
> Das geschlossene Band ist höchstens 45 % der sichtbaren Höhe hoch. Die Aufgabe rückt nach oben und bleibt mit der eigenen Antwort sichtbar. **Das Band scrollt nie.**
> **„Mehr“** öffnet ein Blatt (bis 85 % Höhe) mit eigenem Scrollbereich: Muster-Tabelle, Kontrast Deutsch → Englisch, Beispiele, Claude-Erklärung. „Weiter“ steht fest am Fuß des Blattes und führt direkt zur nächsten Aufgabe.
> **Hinweis-Runde** (erst Prompt, dann Lösung): Zuerst erscheint ein niedriges Band mit einer Zeile, neutral und ohne Rot, z. B. „Fast. Welche Zeitform passt?“. Die Lücke bleibt bearbeitbar, der Knopf heißt wieder „Prüfen“. Das volle Band kommt erst nach dem zweiten Versuch.
> **Kontrastkarte** (3.4 Nr. 4) ist eine eigene Aufgabe im Rahmen, nicht Teil des Bandes.

**Ergänzung „Längengrenze“ (neu, in 12.1):**

> Jeder Warum-Satz in den Inhalten und jede KI-Rückmeldung für das Band hat höchstens 120 Zeichen. Das prüfen das Schema der Prompt-Vorlage und das Qualitätstor. Der Test zu Kai 10b nimmt die **längste** vorhandene Rückmeldung (Grammatik) und prüft sie auf 390 × 844 **und** auf der in der Vorschau gemessenen sichtbaren Höhe der Claude-App.

**Ergänzung „Lange Ergebnisse sind kein Band“ (neu, in 12.1; gilt für 2.2 Block 5, 4.2 Schritt 6, 6.3):**

> Sag-es-Rückmeldung, Kapiteltest-Ergebnis und Missionsbericht sind **Seitenfolgen** im selben Rahmen. Man blättert mit Wischen oder „Weiter“, Punkte oben zeigen die Seite.
> - **Seite 1** passt ohne Scrollen: Urteil in Worten, Häkchen der Aufgaben (bei Missionen), **Stärke mit Zitat** in höchstens 2 Zeilen, Knopf „2 Punkte üben“.
> - **Je Arbeitspunkt eine Seite:** Hinweis-Runde, dann die „besser so“-Fassung mit Vorlesen und „Nachsprechen“.
> - **Letzte Seite:** beste Wendungen (je ein Tipp „zu meinen Wörtern“) und „Nochmal, aber besser“.
>
> Kein Ergebnis zeigt alles auf einer langen Seite.

### Veto 2 (M20, Anti 7): Reiter-Namen und ein fester Ort für alles

**Problem:** 13.1 nennt den vierten Reiter „Sprechen“ und im selben Satz „Sprechen & Hören“. Lesen und Kurse liegen unter „Sprechen“, obwohl sie damit nichts zu tun haben. So findet man sie nicht. Am Laptop steht Lesen dagegen eigenständig in der Seitenleiste (13.3): zwei verschiedene Ordnungen für dieselbe App. Einstellungen haben am Handy keinen Ort. Claude und Übersetzer gibt es nur auf Heute und in der Übung, nicht auf Wörter oder Grammatik. Das verletzt Kais Liste Punkt 11 („jederzeit erreichbar“).

**Mein Namensvorschlag: Heute · Wörter · Grammatik · Praxis · Fortschritt.** „Praxis“ deckt Sprechen, Hören und Lesen ab, ist kurz genug für 78 px Reiterbreite und klingt erwachsen. „Sprechen“ schließt Lesen aus. „Anwenden“ kennt Emrah von der Kachelwand mit 15 Einträgen (Kai). Die Vorschau zeigt „Praxis“, und Emrah kann zum Vergleich auf „Sprechen“ umschalten (19.5).

**Ersatz für 13.1, ersten und zweiten Punkt:**

> - **Unten 5 Reiter:** Heute · Wörter · Grammatik · Praxis · Fortschritt. Jeder Reiter mit Symbol und Wort, auf fester, deckender Fläche (kein Glas). Der aktive Reiter trägt die Handlungsfarbe. In Übungen ist die Leiste ausgeblendet.
> - **Praxis:** Oben die Mission der Woche, darunter drei Abschnitte in fester Reihenfolge: **Sprechen** (Missionen, Einwand-Training), **Hören** (Hörtext der Woche, Diktat, Hörstufe), **Lesen** (Tagesartikel, Kurse). Je Abschnitt höchstens 3 Einträge sichtbar, der Rest unter „Alle …“. Keine Kachelwand.
> - **Seitenkopf jeder Reiterseite:** Titel links, immer an derselben Stelle. Rechts höchstens **ein** Symbol: auf Heute, Wörter, Grammatik und Praxis der Knopf **„Fragen“** (Sprechblase). Er öffnet ein Blatt mit zwei Teilen: „Claude | Übersetzen“. Kein Avatar, kein Datum als Überschrift.
> - **Einstellungen** (mit Diagnose) liegen auf **Fortschritt**, als einziges Symbol (Zahnrad) oben rechts, und nirgends sonst.
> - In der Übung liegen Claude, Übersetzer und „So sprichst du“ hinter „…“. Im Wort-Fenster (Wort antippen) steht „Claude fragen“.

**Ersatz in 13.3, erster Punkt:**

> - **Links Seitenleiste** mit denselben Namen: Heute, Wörter, Grammatik, Praxis (aufklappbar: Sprechen, Hören, Lesen), Fortschritt. Unten abgesetzt: Claude, Übersetzer, Einstellungen. Einklappbar zur Rail.

### Veto 3 (M3, Anti 2): Laptop ist eine eigene Gestalt, auch in der Übung und auf großen Bildschirmen

**Problem:** 12.1 trägt die Überschrift „gleich auf allen Geräten“ und legt das Band unten fest. 13.3 legt Rückmeldung und Warum in die Kontextspalte, und Kais Liste Punkt 12 verlangt das auch. Am Laptop ist nicht festgelegt, wo der Prüfen-Knopf sitzt. Heute wechselt er „mal unter dem Satz, mal unten“ (meine Ist-Bewertung). Zwischen 1024 und 1279 px ist nichts beschrieben. Große Bildschirme sind nicht behandelt, obwohl Kai bei 2560 px zwei Drittel leere Fläche misst und dort testen will (11a).

**Ersatz für die Überschrift von 12.1:** „Der Übungsrahmen (gleicher Ablauf, je Gerät eigene Gestalt)“. Die Punkte „Oben“, „Mitte“ und „Unten“ gelten für Handy und Rail.

**Neu in 13.3, nach „Rechts die Kontextspalte“:**

> - **Übung am Laptop:** Die Aufgabe steht in der Bühne. Die Knopfzeile ist am unteren Rand der Bühne angeheftet und liegt **immer an derselben Stelle**: links „Tipp T“ und „Weiß ich nicht W“, rechts „Prüfen ⏎“ bzw. „Weiter ⏎“. Nach dem Prüfen erscheinen Urteil und Vergleich **in der Bühne direkt unter der Aufgabe**, also dort, wo der Blick ist. Warum, Merke und das, was am Handy hinter „Mehr“ liegt, stehen **sofort offen in der Kontextspalte**, ohne Aufklappen. Seitenfolgen (Veto 1) werden in der Bühne geblättert, die Kontextspalte zeigt dazu die Übersicht (z. B. die Abhakliste der Mission).
> - **Kontextspalte nach Bildschirm:** in der Übung Rückmeldung, dann Regel des Kapitels, dann Wort-Details. Auf Heute Wochenplan, Kapitelstand und „Wenn du mehr willst“ (dort hat die Spalte keinen Hauptknopf). Auf Wörter und Grammatik ist sie die Detail-Ansicht neben der Liste (Liste links, Detail rechts). Claude öffnet sich als Teil der Kontextspalte und verdrängt deren Inhalt, nie die Bühne.

**Ersatz für 13.2 und Ergänzung der Breitenstufen in 13.3:**

> | Breite | Navigation | Bühne | Kontext | Rückmeldung |
> |---|---|---|---|---|
> | bis 599 px | 5 Reiter unten | volle Breite | Blatt von unten | Band |
> | 600–1023 px | Rail links (Symbol + kurzes Wort) | eine Spalte, bis 720 px | Blatt von unten | Band, höchstens 720 px breit |
> | 1024–1279 px | Rail links | 600–680 px | Spalte rechts, 320 px | Bühne + Kontextspalte |
> | ab 1280 px | Seitenleiste mit Text, 232 px | 640–720 px | Spalte rechts, 360–420 px | Bühne + Kontextspalte |
> | ab 1920 px | wie oben | bis 800 px | bis 440 px | wie oben |
>
> **Große Bildschirme:** Ab 1920 px steigt die Grundgröße eine Stufe (Grundschrift 16 → 18 px, ab 2400 px 20 px). Alle Maße sind in rem angegeben und wachsen mit. Prüfbar: Auf 2560 × 1440 ist höchstens ein Viertel der Breite leerer Rand.

### Veto 4 (Bedienung Sprechen): Die Mikrofon-Probe einarbeiten, die Diktiertaste richtig anleiten

**Problem:** Die Probe vom 27.10. hat ergeben: Die eigene Erkennung startet nie, das Mikrofon ist gesperrt, nur die Diktiertaste geht. Das Konzept enthält trotzdem noch „Weg 2“ mit „Drücken zum Sprechen“ (6.1), die Aussage „Pausen nur mit eigener Erkennung“ (6.4), „eigene Erkennung nur nach positiver Probe“ (18, Stufe 5) und den offenen Punkt 19.1. Ein Knopf, der aufnehmen will und es nicht kann, ist ein toter Knopf. Außerdem kann die App die Diktiertaste nicht selbst auslösen. „Standardmäßig gesprochen“ (6.1) ist deshalb eine Frage der Bedienung: Emrah muss in jeder Sprechaufgabe ohne Nachdenken zur Mikrofon-Taste finden. Die „Bild-Anleitung“ beschreibt das Konzept nur mit einem Satz. Dazu kommt eine Falle: Die Diktiersprache folgt der Tastatursprache. Mit der deutschen Tastatur kommt Deutsch an.

**Ersatz für 6.1:**

> **Sprechen heißt in der App: Diktiertaste der Handy-Tastatur.** Eine eigene Spracherkennung gibt es nicht (Probe 27.10.2026). Die App hat **keinen** Mikrofon-Knopf, der selbst aufnimmt.
> - **Ablauf jeder Sprechaufgabe** (Block 5, Block 6, Mission): Aufgabe in höchstens 2 Zeilen, darunter der große Knopf **„Sprechen“** in der Daumenzone. Er öffnet das Antwortfeld mit der Tastatur, und ein Pfeil zeigt auf die Mikrofon-Taste der Tastatur. Emrah tippt auf das Mikrofon, spricht und tippt auf „Senden“. „Senden“ steht direkt über der Tastatur. Daneben steht klein „Lieber tippen“.
> - **Das Antwortfeld** ist mehrzeilig und steht mit „Senden“ über der Tastatur. Die Aufgabe schrumpft dabei auf eine angeheftete Zeile.
> - **Anleitung beim ersten Mal:** im Rahmen der ersten Sprechaufgabe, ohne eigenen Bildschirm davor. Eine Zeichnung der iPhone-Tastatur hebt zwei Tasten hervor, dazu drei Zeilen:
>   1. „Globus 🌐 gedrückt halten → English wählen.“
>   2. „Mikrofon unten rechts antippen und sprechen.“
>   3. „Senden.“
>
>   Danach steht dreimal nur noch der kleine Hinweis „🎤 unten rechts“ am Feld, dann nichts mehr. Über „…“ → „So sprichst du“ lässt sich die Anleitung jederzeit wieder aufrufen.
> - **Sicherheitsnetz:** Sieht der diktierte Text deutsch aus (Umlaute, häufige deutsche Wörter), zeigt das Feld ruhig: „Das kam auf Deutsch an. Globus-Taste → English, dann noch einmal.“ Es wird nichts bewertet und nichts gezählt.
> - **Laut ohne Wertung:** Nebenknopf „Laut gesagt (ohne Wertung)“, ehrlich als unbewertet markiert.
> - **Laptop:** Dasselbe Feld, Tippen ist dort normal. Einmal erscheint der Hinweis: „Diktieren: am Mac die Diktier-Taste bzw. Globus-Taste zweimal, unter Windows Win + H.“
> - **Messung für die Sprechkurve:** vom Tipp auf „Sprechen“ bis „Senden“.

**Weitere Änderungen:**
- **6.4:** Den Satz zu „Pausen“ ersetzen durch: „Pausen misst die App nicht (keine eigene Aufnahme). Die Kurve sagt das offen.“ Aus „So hat dich die Spracherkennung verstanden“ wird „So hat dich die Diktierfunktion verstanden“.
- **18, Stufe 5:** „eigene Erkennung nur nach positiver Probe“ streichen.
- **19.1:** als entschieden markieren („Diktiertaste, siehe 6.1“).
- **14.1:** „Sprachausgabe oder -eingabe fällt aus“ ersetzen durch „Sprachausgabe fällt aus oder Diktat kommt leer/deutsch an“.

### Veto 5 (M8, Kap. 2.1/2.2): Heute und die Sitzung mit sechs Blöcken genau festlegen

**Problem:** 2.1 verspricht „nahtlos, mit einer kleinen Zwischenmarke statt einer Zwischenkarte“, sagt aber nicht, was diese Marke ist. 4.3 verlangt dagegen eine „Ergebniskarte“ nach jeder Sitzung. Ist damit der Grammatikblock gemeint, kommt die Zwischenkarte durch die Hintertür zurück. Der eine Balken oben (12.1) läuft über 28 Minuten. Er bewegt sich je Aufgabe kaum, das ist Kais „3 von 52, fünf Aufgaben lang“. Und offen ist, wie die Heute-Karte sechs Blöcke zeigt, ohne die Liste mit vier Unterzeilen von heute zu wiederholen (Kai Foto 1).

**Ersatz für 2.1, vierten Punkt, und neue Punkte:**

> - **Heute am Handy, eine Karte:**
>   - Tagesring mit **6 Abschnitten** (Länge nach Minuten, erledigte gefüllt), in der Mitte die Restzeit.
>   - Daneben das Tagesthema als Titel (1 Zeile) und „Als Nächstes: Grammatik · Zeitformen im Bericht“ (1 Zeile).
>   - Ein Knopf „Weiter“.
>
>   Keine Liste der sechs Blöcke mit Unterzeilen. Wer auf den Ring tippt, sieht die sechs Blöcke aufgeklappt als Zustandsliste, ohne Knöpfe. Darunter der Wochenstreifen (mit der Serie als kleiner Zahl), dann die Trennlinie „Wenn du mehr willst“ mit höchstens 3 Einträgen, die Mission der Woche zuerst. Kein Datum als Überschrift.
> - **Eine Sitzung, ein Rahmen:** Die sechs Blöcke laufen in **einem** Übungsrahmen. Der Balken oben ist in **6 Abschnitte** geteilt, gleich dem Ring. Der laufende Abschnitt füllt sich je Aufgabe. Das bleibt die einzige Fortschrittsangabe.
> - **Zwischenmarke** (kein eigener Bildschirm, kein zusätzlicher Tipp): Am Blockende heißt der Knopf im Band „Weiter: Grammatik“. Beim Tippen füllt sich der Abschnitt mit einem kurzen Lichtimpuls (300 ms, Haptik, wo möglich). Die erste Aufgabe des neuen Blocks trägt über der Anweisung eine Zeile: „Grammatik · Zeitformen im Bericht“.
> - **Kein Block-Ergebnis als Karte.** Was die Blöcke erreicht haben (neu frei gesagte Wörter, Kapitel-%), sammelt die **eine Abschlusskarte** am Ende der Pflicht. In 4.3 heißt es statt „Ergebniskarte“: „Abschlusskarte des Tages“. Eigene Ergebniskarten gibt es nur für freiwillige Einzelrunden.
> - **Gegen Monotonie** hat jeder Block bei gleichem Rahmen und gleicher Farbe eine eigene Bühne:
>   - Wörter: Karte mit Lücke
>   - Grammatik: Satz mit Muster-Leiste
>   - Hören: große Abspielfläche mit Tempo-Stufe
>   - Sag/Schreib es: Szenario-Karte mit Gesprächspartner und großem Antwortfeld
>   - Flüssigkeit: schnelle, reduzierte Bühne mit ruhigem Zeitbalken
>
>   Der Wechsel der Bühne ist der Rhythmus der Sitzung.
> - **Pause:** Nach Block 3 trägt das Band zusätzlich den Nebenknopf „Pause, später weiter“. X schließt jederzeit ohne Rückfrage. Der Stand ist gespeichert, und Heute zeigt „Weiter mit Hören“.

---

## 3. Inhalt der Vorschau (Stufe 0)

**Rahmen:** eigenes Test-Artefakt ohne Fähigkeiten (kein `db`, kein `sample`), erfundene Daten, nichts von außen geladen, keine fremden Marken. Klickbar, aber kein Lernkern: Antworten sind vorgegeben, jede Aufgabe hat einen Knopf „richtig / Tippfehler / falsch / weiß nicht“ in einer Vorführleiste, damit Emrah alle Zustände sieht. Dunkel ist der Standard.

**Wichtig, weil Emrah fast nur am Handy ist:** Die Vorschau zeigt die **Laptop-Ansicht auch am Handy**, als verkleinerte 1440 × 900-Fläche mit dem Hinweis „Handy quer halten“. Am echten Laptop öffnet sie sich in voller Breite.

**Schalter in der Vorschau** (ein „Vorschau“-Knopf, außerhalb des Designs):
- Modus Dunkel / Gedämpft / Hell
- Bewegung normal / reduziert
- **Handlungsfarbe A / B** (zwei Kandidaten, siehe Verbesserung 5)
- **Reiter 4: „Praxis“ / „Sprechen“**
- Sprache DE / EN, nur für Heute und den Übungsrahmen (Längenprobe)
- „Start nachspielen“ (Skelett → gefüllt)
- **„Höhe messen“:** zeigt die sichtbare Höhe in der Claude-App. Der Wert geht an Kai für Test 10b.

### 3.1 Handy (390 px breit, echte Höhe der Claude-App)

| # | Bildschirm | Zustände, die Emrah sehen muss |
|---|---|---|
| H1 | **Heute** | Skelett (< 1 s) → gefüllt · Tagesanfang („Los geht's“) · mittendrin („Weiter: Grammatik“, Ring mit 2 von 6 Abschnitten) · nach einer Pause („noch 3 Tage Aufholen“, 20 Min.) · Pflicht erledigt (Ring geschlossen, kein Knopf mehr, nur „Wenn du mehr willst“) · Ring angetippt (sechs Blöcke als Zustandsliste) |
| H2 | **Wörter-Block** | Einführungskarte (S0) · freier Abruf ohne Satz mit Tastatur offen (Lücke, Buchstaben-Animation, Prüfen über der Tastatur) · Lücke im neuen Satz mit „Gesucht: …“ · Band: Richtig, Fast (Tippfehler), Noch nicht, Lösung gezeigt (neutral) · Blatt „Mehr“ · Menü „…“ · Wort antippen (Wort-Fenster) |
| H3 | **Blockwechsel** | letzte Wort-Aufgabe → „Weiter: Grammatik“ → Lichtimpuls im Balken → erste Grammatik-Aufgabe mit Blockzeile |
| H4 | **Grammatik-Block** | Hinweis-Runde („Fast. Welche Zeitform?“, zweiter Versuch) → volles Band mit der **längsten** Warum-Zeile des Bestands · „Mehr“ mit Muster-Tabelle |
| H5 | **Grammatik-Erklärung** (Schritt 2) | Muster-Tabelle, Kontrast Deutsch → Englisch, drei Business-Beispiele, „Mehr“, Lesezeit ≤ 90 s |
| H6 | **Reiter Grammatik** | C1-Weg mit 8 Kapiteln, nächstes Thema pulsiert · Kapitel aufgesprungen: Themen mit Zustand offen / in Arbeit / abgeschlossen / gefestigt, „Abgeschlossen heißt …“ |
| H7 | **Hören-Block** | Mini-Diktat mit Wort-für-Wort-Vergleich · Hörtext: Vorhersage → Abspielen (Tempo-Stufe sichtbar) → Frage → Mitlesen mit antippbaren Wörtern |
| H8 | **Sag/Schreib es** | Szenario-Karte · 30 s Vorbereitung · **Diktier-Anleitung beim ersten Mal** · Tastatur offen mit Feld und „Senden“ · Hinweis „kam auf Deutsch an“ · Seitenfolge: Seite 1 (Stärke mit Zitat), Arbeitspunkt mit „besser so“-Fassung |
| H9 | **Flüssigkeit** | Antizipation mit ruhigem Zeitbalken am Feld · Schnellabruf · Ende mit Erfolgsmoment |
| H10 | **Abschlusskarte des Tages** | Ring schließt sich, Zahl zählt im Takt hoch, eine gemessene Sache, Kapitel-% · ein Meilenstein-Moment als Beispiel („erstes Kapitel abgeschlossen“) |
| H11 | **Mission** | Vorbereiten (Ziel, Abhakliste, Wendungen) · Gespräch (die ersten 2 Züge ohne Zeit, Antwort per Diktat) · Bericht als Seitenfolge (Seite 1 ohne Scrollen) |
| H12 | **Reiter Wörter** | Liste mit Stufen S0–S5 und den zwei Zahlen oben · Wort aufgesprungen (Detail) |
| H13 | **Reiter Praxis** | Mission der Woche, Sprechen / Hören / Lesen · Leser mit markierten neuen Wörtern |
| H14 | **Reiter Fortschritt** | Übersicht nach Verbesserung 1 · Detail „Sprechkurve“ · Zustand „noch zu wenig Belege“ · Zahnrad → Einstellungen (nur Einstieg) |
| H15 | **Blatt „Fragen“** | Claude / Übersetzen, wegziehbar |
| H16 | **Ausfälle** | ohne KI: Block 5 mit Hinweis „regelbasiert bewertet, Claude-Rückmeldung folgt“ · Vorlesen fällt aus: Hinweis + Ausweg „Text zeigen“ |

### 3.2 Laptop (1440 × 900, dazu je eine Probe bei 1024 und 2560 px)

| # | Bildschirm | Zustände |
|---|---|---|
| L1 | **Heute** | Seitenleiste · Bühne mit Tageskarte (Ring, Thema, „Weiter ⏎“) · Kontextspalte mit Wochenplan, Kapitelstand, „Wenn du mehr willst“ · erledigt |
| L2 | **Wörter-Übung** | Knopfzeile unten in der Bühne mit Kürzeln · Urteil unter der Aufgabe · Warum und Merke offen in der Kontextspalte · Fenster `?` mit allen Kürzeln · Bedienung nur mit Tastatur (Enter, 1–4, T, W, Esc) |
| L3 | **Grammatik-Übung** | Hinweis-Runde · Regel des Kapitels dauerhaft in der Kontextspalte |
| L4 | **Reiter Grammatik** | C1-Weg breit, Kapitel-Detail rechts (Liste und Detail nebeneinander) |
| L5 | **Reiter Wörter** | Liste links, Wort-Detail rechts |
| L6 | **Mission** | Gespräch in der Bühne, Abhakliste und Wendungen in der Kontextspalte · Bericht |
| L7 | **Claude während der Übung** | Chat in der Kontextspalte, Aufgabe bleibt frei sichtbar |
| L8 | **Fortschritt** | Übersicht in 2–3 Spalten |
| L9 | **Abschlusskarte** | Ring, Zahl zählt hoch |
| L10 | **Breitenproben** | 1024 px (Rail + Kontextspalte) · 2560 px (größere Grundschrift, höchstens ein Viertel Rand) · 768 px (Rail, Band unten) |

**Blindtest (Kai 9b):** Diese fünf Bildschirme legt Emrah neben Speak (Handy) und Linear (Laptop): H1, H2 mit Band, H5, H14, L2. Vergleichsbilder kommen nicht in die Vorschau, weil wir keine fremden Marken nachbauen. Emrah vergleicht mit den echten Apps auf seinem Gerät.

**Was Emrah am Ende sagen soll:** Ja/Nein zur Gesamtwirkung, dazu die drei Schalter-Entscheidungen (Handlungsfarbe A/B, Reiter-Name, ob ihm der Ablauf mit sechs Blöcken ohne Zwischenkarten gefällt). Mehr Fragen nicht.

---

## 4. Verbesserungen ohne Veto

1. **Fortschritt-Seite ohne Überladung (9.2–9.5).** Die Seite ist fest aufgebaut:
   - **Oben** die C1-Schätzung als ein Satz mit Band-Grafik, oder „noch zu wenig Belege“.
   - **Darunter vier Kacheln (2 × 2):** Wörter, Grammatik, Hören, Sprechen. Jede zeigt eine Zahl, eine Zeile und einen Trendpfeil gegen vor 4 Wochen.
   - **Wörter** als **ein Doppelbalken**: „Erkennst du“ lang, „Bildest du selbst“ darin kürzer, die Lücke ist sichtbar. Damit sind es genau zwei Zahlen in einer Grafik.
   - Meilenstein-Kurve, Kann-Beschreibungen, Vorher-Nachher und Hörstufe stehen auf den Detailseiten der Kacheln.
   - Im Wochenbericht sind höchstens 3 Ampelzeilen sichtbar (die auffälligen), alle sieben unter „Alle Messwerte“.
   - Unter einer Zahl steht höchstens eine Zeile Text (Kai 9a).
2. **Die vier Pflichtfragen (Kap. 2.4) an fester Stelle:**
   - *Was soll ich tun?* steht als Anweisung oben in der Bühne (1 Zeile).
   - *Wozu dient das?* steht als kleiner Knopf „Wozu?“ rechts neben der Anweisung. Er öffnet „Warum diese Aufgabe“ (7.3).
   - *Was hatte ich, was ist richtig?* steht in den Bandzeilen 1–2.
   - *Warum ist das so?* steht in Bandzeile 3.
3. **iPhone-Tastatur:**
   - Felder für freien Abruf ohne Autokorrektur, Vorschläge und automatische Großschreibung (`autocorrect="off"`, `autocapitalize="off"`, `spellcheck="false"`, `autocomplete="off"`). Sonst bessert das iPhone die Antwort aus, und die Note stimmt nicht.
   - Sprech- und Schreibfelder lassen die Autokorrektur an.
   - Die Eingabetaste der Tastatur heißt „Prüfen“ (`enterkeyhint`).
   - Der Prüfen-Knopf steht über der Tastatur, ausgerichtet an der sichtbaren Höhe.
4. **Zeitbalken (6.2, 6.3) nicht oben:** Oben läuft schon der Fortschrittsbalken. Ein zweiter Balken dort widerspricht „eine Fortschrittsangabe“. Der ruhige Zeitbalken läuft als dünne Linie an der Unterkante des Antwortfelds.
5. **Farbe konkret machen:**
   - Die Handlungsfarbe darf nicht grün sein, sonst verschwimmt sie mit „richtig“. Ich zeige in der Vorschau zwei Kandidaten: A „Iris“ (Blau-Violett, etwa `oklch(0.62 0.16 275)`) und B „Bernstein“ (etwa `oklch(0.75 0.15 70)`).
   - Kanalfarben für Wörter, Grammatik, Hören und Sprechen erscheinen nur als kleiner Punkt oder Symbol, nie als Fläche.
6. **Bewegung mit Zweck ausdrücklich nennen (M9, M14):**
   - Im Grammatik-Weg pulsiert das nächste Thema sanft.
   - Ein Wort aus der Liste und ein Kapitel aus dem Weg springen aus ihrer Zeile auf, der Rest blendet ab. Am Laptop öffnen sie stattdessen das Detail rechts.
   - Blätter federn in etwa 500 ms mit Bounce 0,1 (siehe M13).
7. **Lesen gestalten (M17):**
   - Im Leser sind Wörter markiert, die Emrah gerade lernt. Die Markierung verblasst mit der Stufe.
   - Ein Text gilt als „fertig“, wenn keine Markierung mehr offen ist.
   - Lesebreite höchstens 680 px, im Dunkelmodus kein reines Weiß.
8. **Abschlusskarte und Meilensteine knapp halten (11):**
   - Die Abschlusskarte hat genau drei Zeilen unter dem Ring: eine gemessene Sache, Kapitel-%, Serie.
   - Höchstens ein Meilenstein-Moment je Tag. Als Vollbild nur bei erster Woche, erstem Monat, 100 Tagen, erstem abgeschlossenem Kapitel und Einstufung, sonst als kleine Bestätigung im Band.
   - „Aufholen“ steht nur als Unterzeile auf Heute, nie als eigene Karte.
