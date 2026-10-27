# Nachprüfung Design und Bedienung (Nora)

**Stand:** 27.10.2026 · **Geprüft:** `konzept.md` Entwurf 2 (2.1, 4.1, 4.3, 6.1, 9.2, 11, 12, 12.1, 12.2, 13) gegen `pruefung/nora.md`. Einzige gezielte Nachprüfung, nur geänderte Stellen. `lena-nach.md` und `tarek-nach.md` gelesen: **Keiner der Nachträge bricht das Design.** Tareks Grenze von 200 Zeichen für den Termin passt zu 3.3 unten.

## 1. Vetos

| Veto | Status | Fundstelle | Was fehlt (Ersatztext) |
|---|---|---|---|
| V1 Band, Seitenfolge | **teilweise** | 12.1 | Erfüllt sind: drei Zeilen, 120 Zeichen, 45 %, „Mehr“-Blatt, Hinweis-Runde, Kontrastkarte und der E2E-Test mit der längsten Rückmeldung. In 12.1 fehlen drei Sätze: „Die Aufgabe rückt nach oben und bleibt mit der eigenen Antwort sichtbar.“ · Bei der Hinweis-Runde: „Die Lücke bleibt bearbeitbar, der Knopf heißt wieder ‚Prüfen‘. Das volle Band kommt erst nach dem zweiten Versuch.“ · Bei der Seitenfolge: „Geblättert wird mit Wischen oder ‚Weiter‘. Kleine Seitenpunkte stehen über ‚Weiter‘, nie oben, denn oben steht nur der Balken.“ |
| V2 Reiter, feste Orte | **erfüllt** | 13.1, 13.3 | – (Folgeproblem W2) |
| V3 Laptop-Gestalt | **erfüllt** | 12.1, 13.2, 13.3 | – (Folgeproblem W4) |
| V4 Diktiertaste | **erfüllt** | 6.1, 6.4, 14.1, 18, 19 | – (zur Laptop-Zeile siehe 3.4) |
| V5 Heute, eine Sitzung | **teilweise** | 2.1, 4.3, 11, 12.1 | Erfüllt sind: Ring, eine Karte, Zustandsliste, Zwischenmarke, Abschlusskarte, Pause. In 12.1 fehlen zwei Sätze: „**Der laufende Abschnitt des Balkens füllt sich je Aufgabe.**“ (sonst kommt Kais „3 von 52“ zurück). Und: „**Eigene Bühne je Block:** Wörter = Karte mit Lücke · Grammatik = Satz mit Muster-Leiste · Hören = große Abspielfläche mit Tempo-Stufe · Sag/Schreib es = Szenario-Karte mit großem Antwortfeld · Flüssigkeit = reduzierte Bühne mit Zeitlinie · Mission = Gesprächsbühne mit Persona.“ Dazu W1. |

## 2. Verbesserungen 1–8

| Nr. | Status | Fundstelle |
|---|---|---|
| 1 Fortschritt-Seite | erfüllt | 9.2, 9.5 (Ausnahme für die Wörter-Kachel siehe 3.2) |
| 2 Vier Pflichtfragen | erfüllt | 12.1 |
| 3 iPhone-Tastatur | erfüllt | 12.1 |
| 4 Zeitbalken nicht oben | erfüllt | 6.2, 6.3 |
| 5 Farbe | erfüllt | 12 |
| 6 Bewegung mit Zweck | erfüllt | 12 |
| 7 Lesen | erfüllt | 12 |
| 8 Abschlusskarte knapp | erfüllt | 11, 2.1 |

## 3. Neu seit meiner Prüfung

### 3.1 Mission als Pflicht am Missionstag
**Einschätzung:** Das passt zur Regel „eine Karte, ein Knopf“, wenn die Mission **ein Abschnitt des Rings** ist und keine eigene Karte. Hinweis: Am Missionstag hat der Tag 5 Blöcke, nicht 6 (siehe W1).
- **Satz für 2.1:** „**Missionstag:** Die Mission ist der letzte und längste Abschnitt des Rings, mit Missions-Symbol. Unter dem Tagesthema steht als Unterzeile: ‚Heute mit Mission: *Preis-Einwand beim Einkauf*‘. Sie ist kein eigener Eintrag und hat keinen zweiten Knopf. Unter ‚Wenn du mehr willst‘ steht an diesem Tag keine Mission.“
- **Satz für 12.1:** „**Mission im Rahmen:** Sie läuft als letzter Block mit dem Blockwechsel ‚Weiter: Mission‘. Vorbereiten ist ihre erste Seite, das Gespräch ihre Bühne, der Bericht ihre Seitenfolge. Alles füllt denselben Abschnitt des Balkens, es gibt keinen zweiten Balken. Die Abhakliste steht am Handy als einklappbare Zeile unter dem Balken (✓ ○ ○), am Laptop offen in der Kontextspalte. Danach kommt die Abschlusskarte des Tages, kein eigener Missions-Abschluss. ‚Pause, später weiter‘ steht am Missionstag vor der Mission, nie mitten im Gespräch.“

### 3.2 Fortschritt: Hauptzahl S5, darunter „auf dem Weg: x“
**Das lässt sich in der 2×2-Kachel gestalten.** Der Doppelbalken wird dafür ein Balken mit drei Füllständen. Aufbau der Wörter-Kachel am Handy (etwa 171 px breit, 16 px Innenabstand), von oben nach unten:
1. **Kopf:** Kanalpunkt Wörter, „Bildest du selbst“ (13 px, Gewicht 500, Zweitfarbe), rechts der Trendpfeil.
2. **Hauptzahl:** 32 px Inter Display, Gewicht 600, Textfarbe, Ziffern in gleicher Breite.
3. **4 px darunter „auf dem Weg: 41“:** 17 px, Gewicht 500, Zweitfarbe. Das ist etwa die halbe Größe der Hauptzahl und deutlich größer als die 13-px-Zeile. Sie hat nie ein „+“ und wird nie zur Hauptzahl addiert (Lenas Bedingung).
4. **12 px Abstand, Balken 8 px hoch:** Die Umriss-Spur zeigt „Erkennst du“. Von links gefüllt: voll = S5, halbtonig (40 %) daneben = S3 + S4. Keine Handlungsfarbe und keine Zustandsfarbe.
5. **Eine Zeile** (13 px): „erkennst du: 412“.

Am Laptop gelten 40 / 20 / 15 px, ab 1920 px wächst alles mit (rem). Die anderen Kacheln haben dieselbe Höhe, sind oben ausgerichtet und bekommen keine Füllgrafik. **Ergänzung in 9.2 Nr. 5:** „Nur die Wörter-Kachel hat eine zweite Zahl (‚auf dem Weg‘) und den Balken. Darunter bleibt es bei einer Zeile.“

### 3.3 „Mein nächster Termin“ und die Wochenfrage
**Beide verletzen die rote Linie, wenn sie auf Heute stehen.** Ein Eintrag mit eigener Handlung über „Wenn du mehr willst“ konkurriert mit „Weiter“. Ohne Termin wird er außerdem zur täglichen Aufforderung.
- **Ersatz für den letzten Punkt in 2.1:** „**Mein nächster Termin** [Kai F6] steht nicht auf Heute. Die App fragt einmal pro Woche danach, als überspringbare erste Seite der ersten Sprechaufgabe der Woche: ‚Steht ein echter Kundentermin an? In 1–2 Sätzen diktieren · Überspringen‘. Ändern lässt er sich unter Praxis → Sprechen. Auf Heute zeigt sich nur die Wirkung, in der Unterzeile des Missionstags: ‚Heute mit Mission: dein Call mit dem Einkauf‘. Am Laptop darf er in der Kontextspalte von Heute stehen, denn dort gibt es keinen Hauptknopf.“
- **Wochenfrage, Ergänzung in 6.5:** „Sie steht nie auf Heute. Sie ist eine Seite am Ende der Pflicht des Wochenabschlusses, vor der Abschlusskarte: die Frage in einer Zeile und fünf Flächenknöpfe 1–5 (1 ‚unsicher‘, 5 ‚sicher‘). Ein Tipp speichert und geht weiter. Darunter steht klein ‚Diesmal nicht‘. Fällt der Samstag aus, kommt sie am Ende des nächsten Lerntags. Es gibt keine Erinnerung.“

### 3.4 Laptop: „Am Laptop tippst du Block 5. Gesprochen wird am Handy.“
Ehrlich und richtig im Ton. Es fehlen drei Dinge: Block 6 und die Mission werden auch diktiert, der Mac/Windows-Hinweis darf nicht gleichzeitig dastehen, und der Knopf „Sprechen“ wäre am Laptop tot. **Ersatz in 6.1:** „**Laptop:** Solange das Diktieren am Laptop in claude.ai nicht geprobt ist, gibt es dort keinen Knopf ‚Sprechen‘. Das Feld ist direkt offen. Einmal je Sitzung steht über dem ersten Antwortfeld eine neutrale Zeile: ‚Am Laptop tippst du deine Antworten. Gesprochen wird am Handy.‘ Das gilt für Block 5, Block 6 und die Mission. Der Hinweis zu Mac und Windows ersetzt diese Zeile erst nach einer erfolgreichen Probe. Beide stehen nie gleichzeitig da.“ Ob getippte Antworten am Laptop für F1 zählen, entscheiden Lena und Kai. Die Zeile verspricht dazu nichts.

## 4. Widersprüche durch die Überarbeitung

| # | Widerspruch | Ersatztext |
|---|---|---|
| W1 | 2.1 und 12.1 legen „6 Abschnitte“ fest. Testtag, Missionstag und Wochenabschluss (2.3) haben aber nur 5 Blöcke. | In 2.1 und 12.1: „Ring und Balken haben so viele Abschnitte, wie der Tag Blöcke hat (5 oder 6), die Länge richtet sich nach den Minuten. Die Zustandsliste nennt die Blöcke dieses Tages (z. B. ‚Themen-Test‘, ‚Mission‘).“ |
| W2 | 13.1 setzt „oben die Mission der Woche“ auf Praxis. Seit sie Pflicht ist, wäre ein Start-Knopf dort ein zweiter Weg in die Pflicht. Pflicht und Freiwillig verschwimmen. | 13.1: „Praxis: oben die Mission der Woche als **Zustand** (‚Freitag in deiner Pflicht‘ / ‚erledigt ✓‘), mit Ziel und Abhakliste zum Ansehen, ohne Start-Knopf. Freiwillige Missionen stehen unter Sprechen.“ |
| W3 | „Du bist hier“ (4.1: „Schritt 3 von 7 · noch 4 richtige bis frei“) im Block-Kopf jeder Aufgabe ist eine zweite Fortschrittsangabe in der Übung. Mit Blockzeile, Anweisung und „Wozu?“ wäre es außerdem die vierte Kopfzeile. | 4.1: „‚Du bist hier‘ steht vollständig auf der Grammatik-Karte und auf der Abschlusskarte (vorher → nachher). In der Übung steht es nur in der Blockzeile der ersten Grammatik-Aufgabe: ‚Grammatik · *indirekte Fragen* · Schritt 3 von 7‘.“ |
| W4 | Laptop: Nach 12.1 stehen die Arbeitspunkte in der Kontextspalte, nach 6.3 hat jeder Arbeitspunkt eine eigene Übungsseite. Nach 13.3 steht die Rückmeldung zur Wochen-Mail rechts, nach 12.1 läuft sie als Seitenfolge in der Bühne. | 12.1, Laptop: „Seitenfolgen werden in der Bühne geblättert, auch die Übungsseiten je Arbeitspunkt. Die Kontextspalte zeigt die Übersicht: Abhakliste, Arbeitspunkte mit Häkchen, bei der Wochen-Mail die vier Kategorien. Am Schreibtag ist Seite 1 der eigene Text mit markierten Stellen.“ |

**Vorschau (12.2) ergänzen:** H1 mit Missionstag, H11 Mission als Abschnitt im Rahmen, H14 Wörter-Kachel nach 3.2, dazu die Termin-Seite und die Wochenfrage-Seite. So entscheidet Emrah 19 Nr. 4, 6, 7 und 8 am Bild.

## 5. Endurteil

**Veto bleibt bei:** „Mein nächster Termin“ als Eintrag auf Heute. Er wäre ein zweites Ding zum Antippen neben dem großen Knopf und bricht damit die Regel „eine Karte, ein Knopf“. Übernimmt die Leitung den Ersatztext aus 3.3, ist das Veto aufgehoben. Alle übrigen Punkte sind fertige Ersatztexte und brauchen keine weitere Runde.
