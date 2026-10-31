# Vokabeln: Ausgangsmessung (V0)

Stand 31.10.2026 · Paket V0 (nach Prüfrunde 1) · Skript `scripts/vocab/simulate.mjs` · Rohwerte `ausgangsmessung.json`, Tagestabellen und Streuung über 5 Startwerte in `ausgangsmessung.tabelle.md`.

## Wie gemessen wird
- **Planer:** der heutige, mit seiner echten Logik, importiert über Vite. Dazu gehören:
  - der Umfang der Pflichtrunde wie im Tagesplan (`unitDraft` → `unitReviewGoal`, Ziel 25 Min.),
  - die Warteschlange (`buildQueue` mit Gestern-Check, Kontingent 5 und Leech-Deckel),
  - die Wahl der Abfrageart (`pickMode`, `recallStep`, `chooseExercise`),
  - die Note (`autoGrade`),
  - das Schreiben je Antwort (`cardPatch`: FSRS mit Fuzz und Lernschritten, Dämpfung, Tag-0-Regel, Abstands-Deckel, Stufen).

  Nachgebildet ist nur die Verdrahtung der Runde aus `session.ts` (Zeilenangaben in `scripts/vocab/adapter-current.ts:1-12`).
- **Lerner:** erfunden und deterministisch, nach Prüfung learning-scientist (Befund 11) überarbeitet.
  - Jedes Lexem hat **zwei** wahre Gedächtnisspuren: rezeptiv und produktiv. Die produktive startet niedriger.
  - Die Form abzurufen stärkt beide Spuren, Auswahl und Bedeutungsabruf stärken nur die rezeptive.
  - Der Zuwachs steigt mit sinkender Erinnerung bis 0,7 (erwünschte Erschwernis) und ist über 0,9 gedämpft.
  - Zeiten je Form: Auswahl 3–7 s, Tippen 6–12 s, Satz 45–90 s, Transfer 2–4 Min.
  - Satzbindung (Ankersatz leichter, neue Sätze schwerer) wirkt, sobald der Adapter den Satz meldet. Der heutige Adapter meldet ihn nicht, der neue muss es.
  - Das Gedächtnis ist **unabhängig** vom Planer, damit die Messung nicht zirkulär ist.
- **Szenarien:** A jeden Tag nur die Pflicht · B Pflicht und an etwa jedem zweiten Tag „Alle fälligen“ (20 Karten) · C wie B mit 7 Tagen Pause (Tag 31–37).
- **Lernschritt** heißt wie in Emrahs Auftrag: Abfrage am Einführungstag oder nach einem Fehler am selben Tag. **Das entscheidet nur der Messkern**, nicht der Planer (Prüfung architect, Befund 8b).
- **Abnahme über 5 Startwerte** (20261031–20261035). Es zählt der schlechteste Wert. Die Haupttabelle zeigt den ersten Startwert.
- **Nicht simuliert:** Wort-Werkstatt, Fahrplan, Kontrast, Aufdecken (Anki), Abend-Check, Wochen-Check, „Dieses Wort üben“, Wendungen, Start mit Rückstand. V1 erweitert die Schnittstelle (`plan.md` §10 V1) und misst den heutigen Planer **mit** diesen Wegen noch einmal als fairen Ausgangswert.
- **Wiederholbar:** `node scripts/vocab/simulate.mjs` (etwa 25 s mit 5 Startwerten). Mit `--adapter v1` läuft dieselbe Messung gegen den neuen Planer. Derselbe Startwert ergibt dieselbe Ausgabe (geprüft).

## Ergebnis (Startwert 20261031)

| Kennzahl | A: nur Pflicht | B: Pflicht + Extra | C: wie B, 7 Tage Pause | **Emrah echt** (`kennzahlen-echt.md`) |
|---|---|---|---|---|
| Abfragen je Tag (Mittel) | 26,1 | 38,9 | 36,5 | 41 |
| **Variationskoeffizient Tageslast** (alle Tage) | **0,21** | **0,41** | **0,58** | **0,52** |
| Variationskoeffizient **Pflicht**minuten (Lerntage) | 0,17 | 0,19 | 0,28 | – |
| Variationskoeffizient Tagesminuten (Lerntage) | 0,16 | 0,37 | 0,38 | – |
| Wort-Tage mit mehreren Abfragen | 34,7 % | 31,4 % | 33,4 % | 33 % |
| davon **außerhalb der Lernschritte** | **0** (5 Startwerte: 0) | **0** (0–2) | **0** (0–1) | 63 (ohne vorherigen Fehler) |
| Anteil Auswahl an allen Abfragen | 9,2 % | 9,0 % | 9,0 % | Auswahl 16 % (252), Aufdecken 20 % (331) |
| Anteil aktiv ab Stufe 3 | 100 % | 100 % | 100 % | – |
| Lerntage mit < 2 neuen Wörtern | 0 | 0 | 0 | – |
| Lücke zwischen Abfragetagen: Median / 90 % / längste | 3 / 8 / 22 Tage | 3 / 8 / 24 Tage | 3 / 9 / 28 Tage | 3 / 13 / 28 Tage |
| Lücken über 14 Tage (davon bei Wörtern bis Stufe 2) | 72 (0) | 106 (0) | 84 (0) | 61 (Stufe unbekannt) |
| überfällig am Ende | 24 | 8 | 12 | 112 von 253 |
| fällig an den nächsten 14 Tagen | 11·6·10·9·4·5·1·7·3·7·4·7·5·2 | 27·11·13·10·8·11·10·2·5·7·8·3·2·2 | 26·6·9·11·13·9·5·3·7·6·2·3·8·3 | 44·16·6·6·6·2·7·2·0·1·4·1·1·0 |
| 14-Tage-Vorschau: größter Tag ÷ Mittel | 1,90 | 3,18 | 3,28 | 6,4 (aus der Vorschau-Zeile gerechnet) |
| simulierte Trefferquote (erste Abfrage des Tages) | 77,5 % | 80,6 % | 77,9 % | – |
| **Ertrag:** Lexeme mit wahrer produktiver Erinnerung ≥ 0,9 an Tag 60 | 78 | 142 | 118 | – |
| **Haltbarkeit:** Lexeme mit ≥ 0,7 nach weiteren 30 Tagen ohne Üben | 62 | 97 | 91 | – |
| Ertrag je Lernstunde | 13,6 | 16,8 | 14,8 | – |

## Was die Messung zeigt
1. **Der Planer selbst klumpt fast nicht über den Tag.** Außerhalb der Lernschritte kommt ein Wort höchstens in Einzelfällen zweimal am selben Tag. Über 5 Startwerte sind es 0–2 Fälle. Diese Fälle sind Lernschritte, die über die Tagesgrenze laufen: Das Wort war gestern falsch, steht heute noch im Neulernen und kommt nach einem Treffer noch einmal.
   - Die 31–35 % Mehrfach-Tage sind Tag 0 (Einführung → Abruf 1 → Abruf 2) und Wiedervorlagen nach Fehlern. Das entspricht Emrahs echten 33 %.
   - Emrahs zusätzliche 63 Fälle ohne Fehler stammen also aus den Wegen, die den Planer umgehen (Diagnose §2.7).
2. **Die Last schwankt, sobald Emrah unregelmäßig übt.**
   - Mit freiwilligen Runden steigt der Variationskoeffizient der Tageslast von 0,21 auf 0,41, nach einer Pause auf 0,58. Emrahs echter Wert ist 0,52.
   - Die Pflichtrunde allein schwankt weniger (0,17–0,28). Den Rest der Schwankung macht Emrahs eigener Rhythmus.
   - Die 14-Tage-Vorschau ist ungleich: Der größte Tag ist bis zum 3,3-Fachen des Mittels. Wörter vom selben Lerntag kommen im Block zurück, weil es keinen Lastausgleich gibt und der Deckel viele Wörter auf genau 1, 3, 7 oder 21 Tage setzt.
3. **Lange Lücken treffen in der Simulation nur sichere Wörter** (ab Stufe 3). Das ist gewollter Abstand.
   - Emrahs 44 % Überfällige entstehen im heutigen Planer bei regelmäßiger Pflicht nicht (8–24 am Ende).
   - Sie sind ein Erbe älterer Regeln und des Aufdeckens mit Selbsturteil (Diagnose §2.8).
4. **Passiv ist nicht der Automatik-Modus, sondern das Aufdecken und die frühen Stufen.** Im Modus „Automatisch“ ist Auswahl nur etwa 9 % der Abfragen. Emrahs echte 48 % Erkennen kommen zu einem großen Teil aus 331 Aufdeck-Antworten.
   - **Bilden** (eigener Satz, „Sag es“) wählt der Planer praktisch nie (Emrahs echter Wert: 1 %).
5. **Ertrag als Gegenprobe:** Nach 60 Tagen kann der Lerner 78–142 Lexeme sicher selbst bilden, je nach Fleiß. Davon halten 62–97 auch 30 Tage ohne Üben. Ein neuer Planer darf gleichmäßiger sein, aber **nicht weniger lehren** (Prüfung learning-scientist, Befund 9).

## Zielwerte für den neuen Planer (Abnahme V1)
Gleiche Szenarien, 5 Startwerte, schlechtester Wert zählt. Dazu Szenario D: Start aus einem umgerechneten Bestand mit Rückstand. Der faire Ausgangswert wird in V1 mit allen Nebenwegen neu gemessen.

| Kennzahl | heute (A / B / C, schlechtester Wert) | Ziel |
|---|---|---|
| Lexem mehrfach am Tag **durch den Planer** außerhalb der Lernschritte, mit Abend-Check, Wochen-Check und „Dieses Wort üben“ | 0 / 2 / 1 (ohne Nebenwege) | 0 in allen Szenarien. Mehrfach nur durch Emrahs eigenen Start ohne Planwirkung wird getrennt berichtet. |
| Variationskoeffizient **Pflicht**minuten (Lerntage) | 0,17 / 0,19 / 0,28 | ≤ 0,15 in A und B, ≤ 0,2 in C nach Abbau. Am Tag nach einer Extra-Runde ist die Pflicht nicht länger als im Mittel. |
| 14-Tage-Vorschau größter Tag ÷ Mittel, **in Minuten** | 2,55 / 3,18 / 3,28 (gezählt in Lexemen) | ≤ 1,5 |
| Rückstand nach 7 Tagen Pause | Abbau bis Tag 60 | Abbau in ≤ 7 Lerntagen, kein Lexem > 3-mal verschoben |
| Auswahl außerhalb der Lernschritte | ab Stufe 3: 0 % | 0 %; Auswahl ändert FSRS nie |
| Abrufe ohne Satz ab Stufe 4 (M27) | nicht gemessen | 30–40 % |
| Lerntage mit ≥ 2 neuen Lexemen (Kontingent > 0) | 100 % | 100 % |
| Transfer | ≈ 0 | ≥ 1 je Lerntag, sobald es Lexeme ab Stufe 4 gibt |
| **echte Behaltensrate** (wahre Trefferquote der ersten Tagesabfrage außerhalb der Lernschritte) | 72,5–80,6 % | Zielquote ± 3 Punkte (bei 90 %: 87–93 %) |
| **Ertrag** Tag 60 und **Haltbarkeit** +30 Tage, je Lernstunde | 12,7–16,8 je Stunde | mindestens so hoch wie heute (je Szenario, schlechtester Startwert) |
