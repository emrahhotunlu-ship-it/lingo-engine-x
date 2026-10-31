# Vokabeln: Ausgangsmessung (V0)

Stand 31.10.2026 · Paket V0 · Skript `scripts/vocab/simulate.mjs` · Rohwerte `ausgangsmessung.json`, volle Tagestabelle `ausgangsmessung.tabelle.md`.

## Wie gemessen wird
- **Planer:** der heutige, mit seiner echten Logik, importiert über Vite. Dazu gehören:
  - der Umfang der Pflichtrunde wie im Tagesplan (`unitDraft` → `unitReviewGoal`, Ziel 25 Min.),
  - die Warteschlange (`buildQueue` mit Gestern-Check, Kontingent 5 und Leech-Deckel),
  - die Wahl der Abfrageart (`pickMode`, `recallStep`, `chooseExercise`),
  - die Note (`autoGrade`),
  - das Schreiben je Antwort (`cardPatch`: FSRS mit Fuzz und Lernschritten, Dämpfung, Tag-0-Regel, Abstands-Deckel, Stufen).

  Nachgebildet ist nur die Verdrahtung der Runde aus `session.ts`, mit Zeilenangaben in `scripts/vocab/adapter-current.ts:1-12`.
- **Lerner:** erfunden und deterministisch (Startwert 20261031).
  - Er hat 400 Kunstwörter. Jedes hat eine eigene Schwierigkeit und ein „wahres“ Gedächtnis, das nach einer Potenzkurve vergisst.
  - Tippen stärkt mehr als Auswahl. Ein Abruf bei hoher Erinnerung stärkt wenig.
  - Das Gedächtnis ist **unabhängig** vom Planer, damit die Messung nicht zirkulär ist (Synthese M1).
  - Zeiten: Auswahl ≈ 3–7 s, Tippen ≈ 6–12 s, je 5 s Rückmeldung.
- **Szenarien:** A jeden Tag nur die Pflicht · B Pflicht und an etwa jedem zweiten Tag „Alle fälligen“ (20 Karten) · C wie B mit 7 Tagen Pause (Tag 31–37).
- **„Lernschritt“** heißt wie in Emrahs Auftrag: Abfrage am Einführungstag oder nach einem Fehler am selben Tag. „Mehrfach außerhalb der Lernschritte“ ist Abnahmekriterium 1.
- **Nicht simuliert:** Wort-Werkstatt, Fahrplan, Kontrast, Aufdecken (Anki), Abend-Check, Wochen-Check, „Dieses Wort üben“, Wendungen. Die echten Mehrfach-Abfragen liegen deshalb höher (Diagnose §2.7).
- **Wiederholbar:** `node scripts/vocab/simulate.mjs` (etwa 10 s). Mit `--adapter v1` läuft dieselbe Messung später gegen den neuen Planer (`scripts/vocab/adapter-v1.ts`, Paket V1). Zweimal derselbe Startwert ergibt dieselbe Ausgabe (geprüft). Startwert 7 ergibt dieselben Größenordnungen.

## Ergebnis

| Kennzahl | A: nur Pflicht | B: Pflicht + Extra | C: wie B, 7 Tage Pause | **Emrah echt** (`kennzahlen-echt.md`) |
|---|---|---|---|---|
| Abfragen je Tag (Mittel) | 24,3 | 36,9 | 32,5 | 41 |
| **Variationskoeffizient Tageslast** (alle Tage) | **0,19** | **0,38** | **0,54** | **0,52** |
| Variationskoeffizient Tagesminuten (nur Lerntage) | 0,17 | 0,34 | 0,34 | – |
| Wort-Tage mit mehreren Abfragen | 27,9 % | 27,2 % | 26,4 % | 33 % |
| davon **außerhalb der Lernschritte** | **0** | **0** | **0** | 63 (ohne vorherigen Fehler) |
| Anteil Auswahl an allen Abfragen | 7,0 % | 8,8 % | 8,4 % | Auswahl 16 % (252), Aufdecken 20 % (331) |
| Anteil aktiv ab Stufe 3 | 100 % | 100 % | 100 % | – |
| Lerntage mit < 2 neuen Wörtern | 0 | 0 | 0 | – |
| Lücke zwischen Abfragetagen: Median / 90 % / längste | 3 / 12 / 22 Tage | 3 / 8 / 22 Tage | 3 / 11 / 23 Tage | 3 / 13 / 28 Tage |
| Lücken über 14 Tage (davon bei Wörtern bis Stufe 2) | 85 (0) | 110 (0) | 93 (0) | 61 (Stufe unbekannt) |
| überfällig am Ende | 15 | 7 | 2 | 112 von 253 |
| fällig an den nächsten 14 Tagen | 13·6·9·5·8·3·4·4·2·2·2·4·5·1 | 20·8·14·18·17·3·3·4·2·4·8·1·4·3 | 14·6·9·14·14·9·3·4·3·6·7·1·10·6 | 44·16·6·6·6·2·7·2·0·1·4·1·1·0 |
| 14-Tage-Vorschau: größter Tag ÷ Mittel | 2,68 | 2,57 | 1,85 | 6,4 (aus der Vorschau-Zeile gerechnet) |
| simulierte Trefferquote (erste Abfrage des Tages) | 87,2 % | 86,0 % | 87,1 % | – |

## Was die Messung zeigt
1. **Der Planer selbst klumpt nicht über den Tag.** Außerhalb der Lernschritte kommt kein Wort zweimal am selben Tag (0 in allen Szenarien).
   - Die 26–28 % Mehrfach-Tage sind Tag 0 (Einführung → Abruf 1 → Abruf 2) und Wiedervorlagen nach Fehlern.
   - Emrahs zusätzliche 63 Fälle ohne Fehler stammen also aus den Wegen, die den Planer umgehen (Diagnose §2.7). Abnahmekriterium 1 muss deshalb **mit** diesen Wegen gemessen werden: V1 simuliert Abend-Check, Wochen-Check und „Dieses Wort üben“ mit.
2. **Die Last schwankt, sobald Emrah unregelmäßig übt.**
   - Mit freiwilligen Runden steigt der Variationskoeffizient von 0,19 auf 0,38, nach einer Pause auf 0,54. Das ist fast genau Emrahs echter Wert (0,52).
   - Die 14-Tage-Vorschau ist ungleichmäßig, etwa „20 · 8 · 14 · 18 · 17 · 3 · 3 …“. Wörter vom selben Lerntag kommen im Block zurück: Es gibt keinen Lastausgleich, und der Deckel setzt viele Wörter auf genau 1, 3, 7 oder 21 Tage.
3. **Lange Lücken treffen in der Simulation nur sichere Wörter.** Alle Lücken über 14 Tage betreffen Wörter ab Stufe 3. Das ist gewollter Abstand.
   - Emrahs 44 % Überfällige entstehen im heutigen Planer bei regelmäßiger Pflicht nicht (2–15 am Ende).
   - Sie sind ein Erbe älterer Regeln und des Aufdeckens mit Selbsturteil (Diagnose §2.8).
4. **Passiv ist nicht der Automatik-Modus, sondern das Aufdecken und die frühen Stufen.** Im Modus „Automatisch“ ist Auswahl nur 7–9 % der Abfragen. Emrahs echte 48 % Erkennen kommen zu einem großen Teil aus 331 Aufdeck-Antworten.
   - **Bilden** (eigener Satz, „Sag es“) kommt im Planer praktisch nicht vor. Er wählt es nur über den Fahrplan (in der Simulation abgeschaltet), und Emrahs echter Wert ist 1 %.

## Zielwerte für den neuen Planer (Abnahme V1, gleiche Szenarien und gleicher Startwert)
| Kennzahl | heute (A / B / C) | Ziel |
|---|---|---|
| Lexem mehrfach am Tag außerhalb der Lernschritte, **mit** Abend-Check, Wochen-Check und „Dieses Wort üben“ simuliert | 0 / 0 / 0 (ohne diese Wege) | 0 in allen Szenarien |
| Variationskoeffizient Tages**minuten**, nur Lerntage | 0,17 / 0,34 / 0,34 | ≤ 0,15 in A und B; in C nach Abbau des Rückstands ≤ 0,2 |
| 14-Tage-Vorschau: größter Tag ÷ Mittel | 2,68 / 2,57 / 1,85 | ≤ 1,5 |
| überfällig nach Pause 7 Tage | Abbau in C bis Tag 60 | Abbau in ≤ 7 Lerntagen, kein Lexem > 3× verschoben |
| Auswahl außerhalb der Lernschritte | ab Stufe 3: 0 % | 0 %; Auswahl ändert FSRS nie |
| aktive Abfragen ab Stufe 3 | 100 % | ≥ 50 % (Abnahme 8.2), Ziel ≥ 90 % |
| Lerntage mit ≥ 2 neuen Lexemen (Kontingent > 0) | 100 % | 100 % |
| Bilden (eigener Satz, Transfer) je Woche | ≈ 0 | ≥ 1 Transfer je Lerntag mit Lexemen ab Stufe 4 |
