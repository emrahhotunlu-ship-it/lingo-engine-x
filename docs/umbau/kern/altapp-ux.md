# Alt-App „Sprachwerkstatt“ – UX-Bestandsaufnahme (03.11.2026)

Diese Bestandsaufnahme ist die Grundlage für die Neugestaltung der Übungskarte und der Seite „Heute“. Für sie wurde nur der Quelltext gelesen und die alte App lokal ausgeführt. Code wurde nicht übernommen.

**Bedingungen bei den Bildern**
- Bildschirmfotos mit Playwright in zwei Größen: Handy 390×844 und Laptop 1440×900.
- Ablage: `scratchpad/altapp-shots/`. Jede Datei gibt es als `…-handy.png` und `…-laptop.png`. Die Endung `-ganz` steht für die ganze Seite.
- Bei den ganzen Seiten erscheint die feste untere Leiste mitten im Bild. Das liegt an der Aufnahme, nicht an der App.
- Die Google-Schriften Fraunces und Libre Franklin wurden nicht geladen, daher sieht man eine Ersatzschrift.
- Ohne `claude.use` sind die KI-Knöpfe ausgeblendet (`AI_OK = false`).
- Die Testdaten sind erfunden: 12 fällige Karten der Stufen 1–4, eine Serie von 11 Tagen.

---

## (a) Was zu einem Wort gezeigt wird

**Datenfelder einer Karte**
- `word`, `pos`, `de`, `def` (englische Definition), `ex` (Beispielsatz, das Zielwort in `[eckigen Klammern]`), `col[]` (Wortpartner), `level`.
- Dazu die Lernwerte `stage` 0–5, `S`, `D`, `due` und `modes`.

**Wortpartner** (`col[]`) haben je Eintrag:
- `p`: die Wendung,
- `de`: die deutsche Bedeutung,
- `gap`: das Lückenwort für die Abfrage,
- `opts`: Ablenker,
- `ex`: ein eigener Beispielsatz.

**Beispiele aus `js/data/`**
- Startvokabel: `{w:"to assume", p:"verb", de:"annehmen, vermuten", def:"to think something is true without proof", ex:"I [assumed] you already knew about it.", l:"B2"}`
- Wortpartner (`COLLOC.assume`):
  - `{p:"it is safe to assume", de:"man kann davon ausgehen", gap:"safe", ex:"[It is safe to assume] that prices will rise next year."}`
  - `{p:"assume responsibility for", de:"Verantwortung übernehmen für", …}`
- Offline-Wörterbuch (`DICT`), je Bedeutung `[Wortart, Deutsch, englische Kurzdefinition]`:
  - `"about": [["adv","ungefähr, etwa","approximately"], ["prep","über, von","on the subject of"]]`
  - `"figure out": [["phrasal","herausfinden, verstehen","understand or solve"]]`

**Wo und wann ein Wort gezeigt wird**

1. **Einführungskarte** bei einem neuen Wort, im Trainer vor der ersten Abfrage. Bild: `03-vokabel-a-einfuehrung`. Reihenfolge von oben nach unten:
   1. Wort, sehr groß (≈ 2,3 rem) und mit Lautsprecher,
   2. Wortart,
   3. **Deutsch groß in Akzentgrün**,
   4. englische Definition,
   5. Beispielsatz kursiv mit dem Zielwort fett und grün,
   6. 1–2 Wortpartner als graue Kästchen („**avoid making mistakes** Fehler vermeiden“),
   7. der Hinweis „Lies Wort, Bedeutung und Beispiel einmal laut. Gleich danach fragt der Trainer das Wort ab.“,
   8. der Knopf „Verstanden – abfragen“.

   Jedes Wort im Beispiel lässt sich antippen.

2. **Wortkarte nach jeder Antwort**, egal ob richtig oder falsch. Sie steht unter der Rückmeldung (`.fb-word` bzw. `.tr-word`). Bilder: `07-…-ganz`, `09-…-ganz`. Inhalt:
   - Wort fett mit dem Deutsch daneben,
   - Definition,
   - Beispiel kursiv mit dem Zielwort grün,
   - die Wortpartner als Kästchen.

   **Man sieht das ganze Wort also bei jeder Abfrage noch einmal.**

3. **Wortblatt** (`openWord`). Es öffnet sich aus der Wortliste als Blatt von unten (Handy) bzw. als Fenster (Laptop). Bilder: `17-vokabelliste`, `18-wortdetail`, `18-wortdetail-unten`. Reihenfolge:
   1. die Zeile „NOUN · B2“ (Wortart · Niveau),
   2. das Wort riesig,
   3. Deutsch (1,1 rem),
   4. englische Definition in grau,
   5. Beispiel in einer grauen Box, kursiv, mit dem Wort grün und fett,
   6. **„Typische Verbindungen“**: je Zeile ein Lautsprecher, die Wendung fett mit Deutsch, darunter ein eigener Beispielsatz,
   7. „Wie gut du das Wort kannst“: die ganze Stufenleiter (Neu, Erkennen, Zuordnen, Mit Hilfe, Frei abrufen, Anwenden), jede Stufe mit einem Satz Erklärung, die eigene Stufe markiert,
   8. nächste Wiederholung,
   9. eine Tabelle nach Abfrageart,
   10. die Knöpfe „Jetzt üben“, „Kenne ich sicher“, „Zurücksetzen“, „Entfernen“.

4. **Wort antippen** (`openWordPop`). Das geht in jedem Satz der App (`.tw`-Spans). Die App erkennt die Grundform und Wendungen aus mehreren Wörtern. Bild: `19-wort-antippen`. Reihenfolge:
   1. Kopf: Grundform in Serifenschrift, ein Wortart-Etikett, Lautsprecher, Schließen-Knopf,
   2. ist das Wort schon eine Karte: „IN DEINEN VOKABELN“ mit der Bedeutung aus der Karte und der Definition,
   3. Deutsch groß und fett (1,1 rem),
   4. „auch:“ mit weiteren Bedeutungen,
   5. englische Kurzdefinition,
   6. Quelle „⚡ WÖRTERBUCH“,
   7. die Knöpfe „Karte anlegen“ (nur wenn neu), „Im Kontext erklären“, „Frag Claude dazu“.

   Am Handy erscheint das als Blatt von unten über die ganze Breite. Am Laptop ist es ein Fenster von 340 px, das am Wort hängt. Es antwortet sofort und offline. Die KI ist nur ein Zusatz.

## (b) Ablauf

### Vokabelrunde (`cards.js`)

1. **Startseite** (`02-vokabel-start`): fällige und neue Wörter, Größe der Runde, ein Startknopf.

2. **Kopfzeile** während der Runde:
   - „Beenden“, ein Fortschrittsbalken, „3/14“, „4 NEU“ und ein farbiges Etikett mit der Abfrageart, z. B. „Mit Hilfe“.
   - Darunter eine **Stufenleiter** aus 5 Strichen mit dem Namen der Stufe.

3. **Ein neues Wort** läuft so:
   1. Einführungskarte (`03`),
   2. **sofort danach** eine Auswahl Englisch → Deutsch (`04-vokabel-auswahl`),
   3. rund 6 Positionen später eine zweite Abfrage.

4. **Abfragearten je Stufe** (Leiter 0–5):

   | Stufe | Abfragearten |
   |---|---|
   | 1 | `mc_en` (EN→DE wählen), `listen_mc` (hören und wählen) |
   | 2 | `mc_de` (DE→EN wählen) |
   | 3 | `type_hint` (tippen mit Anfangsbuchstaben), `cloze_hint` (Lücke mit deutscher Bedeutung als Stütze) |
   | 4 | `type`, `cloze`, `colloc` (Wortpartner ergänzen), `dictation` |
   | 5 | `produce` (eigenen Satz bilden) |

   Bilder dazu:
   - `06-vokabel-b-luecke-eingabe`: Lücke direkt im Satz, darunter „Bedeutung: …“,
   - `08-vokabel-b-eingabe-frei`: Deutsch groß, darunter das Eingabefeld,
   - `10-vokabel-wortpartner`: „postpone ___“ → „verschieben auf“.

5. **Beim Antworten**:
   - Bei der Auswahl wählt man mit den Tasten 1–4 oder per Tippen.
   - Bei der Eingabe gibt es die Knöpfe „Tipp“, „Weiß ich nicht“ und „Prüfen“. Enter prüft.

6. **Bewertung**: Die App vergibt die Note 1–4 selbst, aus Richtigkeit, Zeit und Hilfe. Daraus folgt, ob die Stufe steigt oder sinkt. Eine falsche Antwort kommt 4 Positionen später wieder.

7. **Weiter**:
   - Nach einer richtigen Auswahl geht es nach 1,1 s von selbst weiter.
   - Sonst mit „Weiter →“ oder Enter.
   - Das Gerät vibriert dabei.

8. **Rundenende** (`11-vokabel-rundenende`): Bilanz, Stufenwechsel je Wort und der nächste Schritt.

### Grammatikaufgabe (`session.js`)

1. Ist ein Thema neu, kommt **zuerst die Regelkarte** (`12-grammatik-regelkarte`). Sie zeigt nacheinander:
   1. Kernregel,
   2. Warum,
   3. Entscheidungsschritte,
   4. Formen,
   5. Signalwörter,
   6. Unterschied zum Deutschen,
   7. typische Fehler,
   8. den Knopf „Los geht's“.

2. **Aufgabe** (`13`, `15`):
   - Kopf in Großbuchstaben: „GRAMMATIK · PRESENT SIMPLE VS. CONTINUOUS“.
   - Arbeitsanweisung fett: „Wähle die richtige Antwort.“ oder „Setze die richtige Form ein.“
   - Der Satz in einer grauen Box mit der Lücke „?“ als unterstrichene Stelle im Satz.
   - Bei der Auswahl: 4 Antworten mit Tastennummer, am Laptop 2×2.
   - Bei der Eingabe: „Hinweis: (work)“ und darunter ein Eingabefeld (bei Grammatik unter dem Satz).

3. **Rückmeldung** (`14`, `16`):
   - Nach einer richtigen Antwort geht es nach 2,2 s von selbst weiter. Die Wartezeit läuft sichtbar im Weiter-Knopf ab.
   - Eine falsche Aufgabe kommt 4 Positionen später wieder.

4. **Seitenleiste** am Laptop (`.sess-side`, 19 rem):
   - „Diese Session“: richtig, noch offen Vokabeln, noch offen Grammatik.
   - „Themen in dieser Session“ mit einem Beherrschungsbalken.
   - „Level live“ („B2 · Anfang 60“, „XP heute 34 / 50“).
   - Ein Lerntipp.

## (c) Rückmeldung: Texte, Hervorhebung, „Warum“

**Überschriften der Rückmeldung** (je eine eigene Farbe, mit einem dicken Farbstreifen links):

| Wo | Fall | Überschrift | Farbe |
|---|---|---|---|
| Vokabeln | richtig | „Richtig“ | grün |
| Vokabeln | knapp | „Fast richtig“ | gold |
| Vokabeln | falsch | „Noch nicht“ | rot |
| Grammatik | richtig | „Richtig“ | grün |
| Grammatik | andere gültige Lösung | „Auch richtig“ | Akzent |
| Grammatik | knapp | „Fast richtig“ | gold |
| Grammatik | falsch | „Nicht ganz“ | rot |
| Grammatik | „Weiß ich nicht“ | „Kein Problem – so geht's“ | – |

**Vokabel falsch** (`09-vokabel-d-eingabe-falsch-…-ganz`), von oben nach unten:
1. „Deine Antwort: ~~to delay~~ · Richtig: **to struggle**“ (die richtige Lösung in Monospace).
2. Trennlinie, dann „Stufe: ▼ Mit Hilfe · Nächste Wiederholung: **in 2 Tagen**“.
3. Der **Grund für den Abstand** (`trWhy1–4`):
   - Note 1: „Falsch → die Pause beginnt neu. Das Wort kommt in dieser Runde nochmal.“
   - Note 2: „Mit Hilfe, langsam oder kleiner Fehler → zählt als ‚schwer‘ …“
   - Note 3: „Richtig → die Pause bis zur nächsten Wiederholung wird länger.“
   - Note 4: „Schnell und ohne Hilfe richtig → die Pause wird deutlich länger.“
4. **„Einmal richtig schreiben“**: die Lösung abtippen. Das Feld wird grün, sobald es stimmt.
5. Die Wortkarte (siehe a).
6. „Ich lag richtig“ als Korrektur durch den Nutzer.

**Vokabel richtig** (`07-vokabel-c-luecke-richtig`):
- Die Lücke zeigt das Wort grün und in Monospace direkt im Satz.
- „Richtig“, dann „Stufe: ▲ Frei abrufen · Nächste Wiederholung: **in 10 Tagen**“ mit dem Grund.
- Danach die Wortkarte.

**„Warum das so ist“** (`vocabWhyHtml`, nur mit KI-freiem Wissen):
- Ein Tipp je Wortart, z. B. Verb: „… entscheidend ist, welche Präposition mitkommt und ob danach die -ing-Form oder der Infinitiv steht.“
- Bei falscher Wahl: „Du hattest ‚X‘ – das gehört zu ‚Y‘. Die beiden liegen bedeutungsmäßig nah beieinander …“
- Wortpartner: „So wird es üblicherweise verwendet: …“
- Feste Verbindungen: „Solche Paare sind Konvention, nicht Logik – als Block lernen.“

**Grammatik falsch** (`16-grammatik-falsch-…-ganz`, `whyHtml`), immer in derselben Reihenfolge:
1. Vergleich in Tabellenform:
   - „DEINE ANTWORT ~~is working~~“, rot und durchgestrichen,
   - „RICHTIG **work**“, grün hinterlegt,
   - bei längeren Antworten Abweichung pro Wort (`lcsMark`).
2. Diagnose-Titel fett: „Die Grundidee stimmt, die Form nicht.“
3. „Gesucht war ‚work‘.“
4. Die Erklärung zur Aufgabe: „‚usually‘ ist ein Signalwort für Gewohnheiten → Present Simple.“
5. Ein Etikett „REGEL“ mit der Mini-Regel.
6. Wenn sie passt: die typische Falle (✕ durchgestrichen / ✓ fett).
7. „Ganze Regel ansehen →“.
8. Die Leiste „Beherrschung“ (5 Punkte, „Erste Versuche“, „2 Aufgaben, 1 richtig“, „?“).
9. Wenn KI vorhanden: „Warum? Claude erklärt's“ und „Noch genauer erklären“.
10. Auch hier: „Einmal richtig schreiben“.

**Grammatik richtig** (`14`): Auch hier gibt es eine **Begründung**, z. B. „‚Look!‘ zeigt: Es passiert genau jetzt → Present Continuous (am/is/are + -ing).“ Dazu „Ganze Regel ansehen →“ und das Plus bei der Beherrschung („▲ eine Stufe sicherer“).

## (d) Maße (gemessen, berechnete Werte)

**Grundwerte**
- Grundschrift: 15,3 px am Handy, 16,1 px am Laptop (die Schrift wächst etwas mit).
- Seitenrand am Handy: 28 px. Die Karte ist 334 px breit.

**Abfragekarte Vokabeln** (`.fc-run`, `max-width: 40rem`)

| Maß | Handy | Laptop |
|---|---|---|
| Kartenbreite | 334 px | 644 px |
| Innenabstand | 20/18 px | 28/30 px |
| Ecken | 20 px | 20 px |
| Nutzbare Breite innen | 296 px | 582 px |

**Abfragetext und Eingabe**
- Deutscher Abfragetext (`.tr-de`): **41,6 px**. Am Handy bricht „sich abmühen, kämpfen“ auf 3 Zeilen und ist 137 px hoch.
- Freies Eingabefeld (`#trIn` bei `type`): **16 px Schrift, 43 px hoch**, volle Breite (296 bzw. 582 px), Innenabstand 11/12 px, Ecken 9 px, grau gefüllt.
- Lücke im Satz (`cloze`): ein Feld **im Satz**, 19,2 px Schrift in Akzentgrün, 42 px hoch.
  - Es startet bei 9ch (≈ 120 px) und wächst beim Tippen bis 26ch.
  - Nur ein Strich unten, keine Box.
- Satzbox (`.sentence`): 19,2 px Schrift, Zeilenhöhe ≈ 1,65, Innenabstand 18/20 px, grau (`#EDF1EE`), Ecken 14 px.

**Knöpfe**
- Hauptknopf: 47 px hoch, Ecken 14 px, dunkelgrün. Er steht in einer Reihe mit „Tipp“ und „Weiß ich nicht“.
- Am Handy hat jeder Knopf die volle Breite, am Laptop ist „Prüfen“ 352 px breit.

**Weiter-Knopf**
- Die Leiste mit „Weiter →“ klebt am unteren Rand der Karte (`position: sticky`). Darüber liegt eine Trennlinie.
- Am Handy erscheint sie direkt über der unteren Navigationsleiste (top 781 px bei 844 px Höhe). Am Laptop ist sie 431–940 px breit.
- Die Rückmeldung und die Wortkarte scrollen darunter weiter.
- Ganz unten in grau der Tastaturhinweis: „Enter prüft · Enter nach dem Feedback = weiter“.

**Grammatikkarte (`.qcard`)**
- Am Laptop 741 px breit, im Raster `minmax(0, 46rem) 19rem` neben einer Seitenleiste von 306 px.
- Die Antworten sind 56 px hoch, 16,3 px Schrift, Ecken 14 px. Am Laptop stehen sie in 2 Spalten (je 334 px).

**Nutzung breiter Bildschirme**
- Vokabeltrainer: **keine Seitenleiste**. Die Karte steht mit 644 px in der Mitte, rechts und links bleibt Leere.
- Grammatik: Karte plus Seitenleiste.
- Heute: Raster `1fr 22rem` (Inhalt 725 px, rechte Leiste 354 px, klebt beim Scrollen).
- Dazu die linke Navigation mit ≈ 350 px.

**Rückmeldebox (`.fb`)**: Innenabstand 18/20 px, Ecken 14 px, ein Farbstreifen von ≈ 6 px links, weiß bzw. leicht getönt.

## (e) Seite „Heute“ (`renderCourse` in `lesson.js`)

Bilder: `01-heute`, `01-heute-…-ganz`.

**Rahmen**
- Laptop: linke Leiste mit
  - Logo „Sprachwerkstatt · B2 → C1 · LERN-APP“,
  - den Reitern Heute „Pflicht“, Sprechen, Entdecken und Üben (je „frei wählbar“, Üben mit Zahl), Nachschlagen „nur Info“,
  - unten den Kästen „HEUTE 1/3 Pflicht“ mit Balken, „Dein Level B2 · Anfang“ mit Balken und Serie/XP.
- Kopf: Datum als kleine Zeile, H1 „Heute“ (32 px), dazu die Knöpfe Übersetzer, „Dein Level B2“ mit Balken, „Frag Claude“, Profil, Einstellungen.
- Handy: H1 nur 18 px. Unten eine Leiste mit 5 Reitern (der aktive grün gefüllt, „Üben“ mit Zahl).

**Eine einzige große Karte `.today-card`** (Ecken 24 px, 725 px bzw. 334 px breit)
1. Kopf:
   - „Noch nicht fertig für heute“,
   - „0 von 3 Pflichtaufgaben erledigt. Es fehlt noch: …“,
   - ein Ring 0/3,
   - „0 von 30 Min heute“.
2. Eine nummerierte Liste mit den Aufgaben. Jede Zeile ist komplett klickbar, mit „›“.
   - **Lektion des Tages**, aktiv und aufgeklappt:
     - leicht grün getönt, mit einem dicken Ring als Markierung, Titel in Serifenschrift 1,2 rem,
     - die Einheit und ein Kann-Satz,
     - Schritt-Chips Wörter / Dialog / Grammatik / Selbst schreiben,
     - der Hauptknopf „▷ Lektion starten · ≈ 15 Min“.
   - **Wiederholen**: „12 Wörter fällig“.
   - **Ein Kanal**, z. B. Hören, mit Grund („noch nie gemacht · dünne Datenlage“).
3. Trenner „OPTIONAL – NUR WENN DU ZEIT HAST“. Danach freiwillige Zeilen mit gestricheltem, goldenem Kreis (Lesen, Schreiben „frei wählbar · ≈ 10 Min“).
4. Erledigte Aufgaben: grüner Haken, Titel durchgestrichen und blass, **kein Knopf**. Dazu die Chips „Heute erledigt“.

**Unter der Karte**
- „Dein Training“ mit 2 vernachlässigten Bereichen.
- Aufklappbar: „Dein Weg zu C1“ (24 Lektionen in 6 Einheiten).

**Rechte Leiste** (Laptop; am Handy unter allem, ab y ≈ 2800)
- „Dein Stand“: B2 · Anfang 60/100 mit der GER-Skala (A1–C2).
- XP heute / Serie / Wörter abrufbar.
- „Wortschatz bis C1 3.650 / 8.000“.
- Wochenringe.

**Tagesplan**: Er wird einmal am Tag festgelegt (`dayPlan`) und würfelt beim Neuzeichnen nicht neu.

## (f) Farben, Schrift, Gesamteindruck

**Farben**
- Hintergrund: warmes Off-White `#F5F7F5`.
- Karten: weiß, eine dünne Linie (`--line`), weicher Schatten.
- Graue Flächen: `#EDF1EE`.
- Akzent: Waldgrün `#2F6B58`.
- Gut / schlecht: `#1F6B45` / `#B23A32`. Dazu Gold für „fast“ und „optional“.
- Text: `#1C1E22`.
- Es gibt die Paletten „sage“ u. a. (`themes.css`), dazu Kontrast- und Dunkelmodus über `data-scheme`.

**Schrift**
- Libre Franklin für den Text.
- **Fraunces (Serifenschrift)** für das Wort und die Titel.
- IBM Plex Mono für Zahlen, kleine Kopfzeilen in Großbuchstaben, Tasten und Lösungen.
- In den Bildern greift eine Ersatzschrift, die echte Optik ist also eleganter und ruhiger.

**Eindruck**
- Hell, ruhig, papierartig, hochwertig und „redaktionell“.
- Wenige, klare Flächen. Grün ist die einzige starke Farbe.
- Viel Weißraum, große Schrift für den Lernstoff, kleine Mono-Kopfzeilen für Metadaten.
- Die Rückmeldung ist gut zu erkennen (Farbstreifen + farbige Überschrift), ohne dass sie schreit.

## (g) Das nehmen wir mit

- Jede Abfrage zeigt nach der Antwort die **ganze Wortkarte**: Deutsch, Definition, Beispiel mit grün markiertem Zielwort, Wortpartner.
- Wortpartner sind **Daten mit eigenem Beispielsatz und eigenem Lückenwort**. Sie werden gezeigt und auch eigens abgefragt (`colloc`).
- Die Einführungskarte zeigt **das Deutsche groß in Akzentfarbe** und fordert zum lauten Lesen auf. Gleich danach folgt die erste leichte Abfrage.
- Die Lücke ist ein Eingabefeld **im Satz**, mit Unterstrich statt Box. Es wächst mit dem Wort und zeigt danach die Lösung grün an derselben Stelle.
- Das Rückmeldeschema hat **Farbstreifen links, ein farbiges Ein-Wort-Urteil und „Deine Antwort ~~…~~ · Richtig **…**“**. Dazu kommt die nächste Wiederholung **mit Grund** („die Pause wird länger“).
- Die Grammatik-Begründung steht immer an derselben Stelle und in fester Reihenfolge (Vergleich → Diagnose → Erklärung → REGEL → Falle → ganze Regel) und kommt auch bei „Richtig“.
- Nach einem Fehler heißt es **„Einmal richtig schreiben“**: die Lösung abtippen, bis das Feld grün wird.
- Die Leiste mit „Weiter →“ klebt am unteren Rand. Dazu kommen Tasten (1–4, Enter) und ein sichtbar ablaufendes Auto-Weiter.
- Ein Wort-Popup **sofort und offline** aus dem Wörterbuch (Grundform, Wendungen, „IN DEINEN VOKABELN“), KI nur als Zusatzknopf.
- Das Wortblatt mit „Typische Verbindungen“ (Lautsprecher je Zeile) und der erklärten Stufenleiter.
- Heute besteht aus **einer** Karte mit einer nummerierten Liste und dem Trenner „OPTIONAL – NUR WENN DU ZEIT HAST“. Die aktive Aufgabe ist aufgeklappt mit einem Knopf, erledigte Aufgaben sind durchgestrichen und ohne Knopf.
- Am Laptop eine **Seitenleiste in der Übung** (Session-Stand, Thema mit Balken, Level live). Den Platz neben der Karte nutzen statt Leere.
- Die Optik: warmes Off-White, ein Waldgrün, Serifenschrift für das Wort, Mono für Metadaten, große Lernschrift (19 px im Satz).

## Das war schwach

- **Drei verschiedene Stufen-Etiketten auf einer Karte** (`09`): oben „Frei abrufen“, Leiter „Mit Stütze abrufen“, Rückmeldung „▼ Mit Hilfe“. Das widerspricht Kap. 2 Nr. 2.
- Am Handy wird der Fortschrittsbalken in der Kopfzeile von „4 NEU“ und dem Etikett auf wenige Pixel gequetscht (`07`, `19`).
- Der deutsche Abfragetext mit 41,6 px bricht am Handy auf 3 Zeilen und schiebt die Eingabe nach unten (`08`, `09`).
- Das freie Eingabefeld ist mit 16 px Schrift und 43 px Höhe klein und grau. Es wirkt wie ein Formular, nicht wie der Mittelpunkt.
- Bei Grammatik mit Eingabe steht das Feld **unter** dem Satz, die Lücke ist nur ein „?“ (`15`, `16`). Das widerspricht Kap. 15.
- Der Vokabeltrainer lässt am Laptop rund 55 % der Breite leer (Karte 644 px, keine Seitenleiste).
- Nach der Antwort wird es lang: Rückmeldung, Kopierfeld und Wortkarte stehen untereinander. Die Wortkarte liegt am Handy unter dem klebenden Weiter-Knopf und wird oft nicht gesehen (`07`).
- Die Heute-Karte ist am Handy etwa 1.000 px hoch. „Dein Stand“ und der Wortschatz erscheinen erst ab etwa 2.800 px.
- Die Überschrift „Heute“ ist am Handy nur 18 px groß, der Titel der Ansicht ist abgeschnitten („Vokabeltra…“).
- Die Begründung zur Vokabel bleibt allgemein (ein Tipp je Wortart) und erklärt nicht die konkrete Verwechslung im Satz, solange keine KI dabei ist.
- Die Schriften kommen von Google Fonts. Ohne Netz fällt die App auf eine Ersatzschrift zurück, die Optik leidet dann sichtbar.
