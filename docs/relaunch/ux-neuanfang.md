# UX-Neuanfang (02.11.2026)

Anlass: Emrah zur live gegangenen Wörter-App (v88): „nicht zumutbar … die neue UI UX ist einfach deutlich schlimmer … sieht billig aus … unklar, was zu tun ist … Pfad schlimm … Platzhalter: zweiten Buchstaben ändern geht nicht … neue Aufgabe: tippen geht erst nach Reinklicken … Claude-Erklärung immer versteckt … mehrere Spezialisten sollten sich das anschauen … Synthese und Vorschlag … ich will nicht wieder mehrere Tage warten“. Vorgabe bis dahin: „Neue Logik behalten“, erst klickbare Vorschau, dann einbauen.

Grundlage: Fotoserie der echten App (Handy 390 Touch, Laptop 1440, Dunkel; ~110 Bilder, nur Arbeitsordner), sechs Spezialisten parallel (Team `docs/relaunch/team.md`): Nora (Design), Interaktion (Tastatur/Maus/Touch, selbst gemessen mit Playwright), Mara (Marktvergleich mit Quellen), Lena (Lernpfad), James (Aufgabenfehler, Stichprobe 78), Kai (Noten aus Emrahs Sicht).

## 1. Befunde (verdichtet)

### Bedienung (Interaktion, gemessen)
1. Cursor in jeder Lücke ans Wortende gefesselt: `src/engine/HiddenInput.tsx:160,162–164` setzt die Auswahl bei jeder Eingabe ans Ende. „trade“ + 3× ← + „X“ = „tradeX“; Strg+A, Doppelklick, Klick auf Buchstabe wirkungslos. Gilt für 15 Übungsarten (alle nutzen HiddenInput/KineticGap).
2. Kein sichtbarer Cursor (`src/styles/index.css:472–483`, opacity 0, caret transparent).
3. Handy: erste Wörter-Karte ohne Fokus (`LearnCard.tsx:207–212` fokussiert nur bei Maus; `LearnScreen.tsx:190` ruft focusNow nicht). Getipptes geht verloren.
4. Kein Claude-Erklär-Knopf in der Wörter-Runde (vor/nach Prüfen 0 Knöpfe); Grammatik nur nach dem Prüfen (`JudgeFoot.tsx:67`).
5. Tab-Reihenfolge kaputt (verstecktes Feld am Dokumentende, `HiddenInput.tsx:135–136`).
6. „Satz anhören“ und Wort-Fenster klauen den Fokus; ganze Sätze (`SentenceInput.tsx`) nie automatisch fokussiert; Esc ohne Wirkung; kaum Kürzel; antippbare Wörter 14–19 px breit.

### Design (Nora)
- Kein Typo-System: ~40 Schriftgrößen, 6 Gewichte, 9 Radien, 13 Überschreib-Dateien in `src/styles/parts` (~4.200 Zeilen). Je Bild 5–6 Größen nebeneinander.
- Übungskarte: vier Textzeilen über dem Satz, darunter 60 % Leere; Laptop: Satz 24 px auf 700 px Breite.
- Laptop: rechte Spalte tot („Hier erscheinen Claude …“) oder doppelt (Heute-Liste in der Übung); Seitenleiste endet bei 900 px.
- „Lösung gezeigt“ zeigt keine Lösung (Lücke bleibt leer). Knopf-Hierarchie flach (drei gleich große Knöpfe, zweiter Vollbreitenknopf über „Weiter“). Toast über der Reiterleiste. Fortschrittsanzeigen ohne Aussage. Listen-Wüste in Praxis/Wörter-Reiter. Dasselbe mehrfach (Fortschritt kopiert Wörter-Reiter, Kapitelstand dreimal).

### Lernpfad (Lena)
- Vier verschiedene Minutenangaben für denselben Tag (Ring 27, Rundenstart 9, Zielzeit 15, Schnitt 3); „Wörter“ vs. „Wiederholen · 53 Karten“ vs. 24 Karten.
- Wörter-Runde ohne sichtbares Ende (24 geplant → >35 mit Lernschritten/Wiederkehr; `session.ts:68–80,152–159`); „Karte x von y“ wird berechnet, aber nicht gezeigt.
- Wiederkehrer im selben Satz (handy 04 = 64).
- Grammatik aus dem Grammatik-Reiter läuft als „Extra“ (`chapterRun.ts:72–95`, `learn/ui.tsx:144`), obwohl sie in der Tagesliste offen steht.
- Satzbau ist Pflicht, obwohl seit 27.09. Angebot (`channels.ts:41–43` vs. `planFor.ts:139`). Fehlersätze an zwei Stellen. Grammatik-Reiter mit sechs Einstiegen; neues Thema startet mit „Test starten“.
- Interne Begriffe in der Oberfläche („Selbst abrufen statt wiedererkennen“, „ändert den Plan nicht“, „vorgezogen“).

### Aufgabenfehler (James, Stichprobe 78)
- 11/78 (14 %) mit Befund, 4/78 (5 %) hart (richtige Antwort abgelehnt oder Erklärung sachlich falsch) → bei ~20 Aufgaben/Tag etwa eine fehlerhafte pro Tag.
- Klassen: A richtige Antwort abgelehnt (z. B. `legacy/grammar.json:381` „studied“), B Erklärung passt nicht (ocl-0003 `c1x/src/ocl/k2-1.json:123–139`), C unnatürlich/britisch, D Stichwort irreführend (`legacy/grammar.json:328` Stichwort = Lösung), E Ergebnis-Ansicht ohne Lösung, F Zeitverlust (A2-Fehler im C1-Pfad), G Melde-Knopf ohne Wirkung (`useC1Item.ts:598`).
- Ursache: Antwortlisten aus dem Kopf, niemand löst blind; Claude-Zweitmeinung nur bei Muster-Lücken (`check.ts:291`); Prüfer prüft nur Form.

### Noten (Kai, Sperre unter 9)
Lernmethodik 5 · Abruf 6 · Grammatik als Kurs 4 · Hören 2 · Sprechen 2 · Anpassung 5 · Vielfalt 4 · Roter Faden 3 · Optik 4 · Handy 5 · Laptop 3 · Motivation 4 · Zuverlässigkeit 3 · Tempo 5.

## 2. Vorbilder (Mara, mit Quellen im Bericht)
Pfad mit markierter nächster Station (Speak, Duolingo) · Überschrift = nächste Tätigkeit · eine Zeile Anweisung · Satz groß im Mittelpunkt (Lingvist, Speak) · Hinweis unter dem Satz · Lücke als hinterlegtes Feld · ein gefüllter Knopf · klar grünes/rotes Band mit Lösung · „Explain my answer“ zur eigenen Antwort (Duolingo) · „Claude erklärt“ als zweiter Knopf (Clozemaster EXPLAIN) · bei falsch sofort richtig nachtippen (Lingvist) · alles per Tastatur (Anki, Lingvist) · Lernmodus ohne Seitenleiste (Things) · neutrale Farben, Akzent nur für Handlung (Linear) · Abschluss mit Haken und einem Satz (Lingvist) · Statistik auf Unterseite (Memrise).

## 3. Vorschlag (Synthese)

**A Bedienung (zentral, betrifft alle Übungen):** echtes sichtbares Eingabefeld in der Lücke mit freiem Cursor (Pfeile, Markieren, Einfügen, Buchstabe antippen); jede neue Aufgabe sofort tippbereit (Handy und Laptop); Tippen ohne Fokus wird in die Lücke geleitet; Hilfsknöpfe ohne Fokusraub; Enter prüfen/weiter, Esc, Kürzel mit sichtbarer Hinweiszeile am Laptop; Claude-Knopf in jeder Übung immer sichtbar, ein Tap, mit der Aufgabe als Kontext; kein Zwischenbildschirm vor der ersten Karte; Trefferflächen ≥44 px. Ort: `src/engine` (HiddenInput, KineticGap), `src/ui/exercise` (ExerciseShell, SentenceInput).

**B Design-System neu:** 7 Schriftrollen (Kennzahl 48/64, Titel 28/32, Übungssatz 26/34, Abschnitt 17/18, Text 16, Meta 13, Etikett 11), 3 Gewichte, 4/8-Raster, 4 Radien, 3 Flächen-Ebenen, genau ein Hauptknopf je Bildschirm, Grün nur für richtig, Toast oben. Laptop: Leiste 240 px, Mitte max. 720 px, rechte Spalte nur mit Inhalt; Übung im Vollbild. Ersetzt die 13 Überschreib-Dateien.

**C Lernpfad:** drei Blöcke, ~22–25 Min.: Wörter (höchstens 10 Min., nach Zeit geschnitten, Rest morgen bzw. „Noch 5“), Grammatik (Kapitel-Schritt = Pflicht, egal von wo gestartet; Fehlersätze zum Thema eingemischt), Anwenden (2–3 eigene Sätze mit heutigen Wörtern in der heutigen Zeitform). Feste Kopfzeile „Schritt 2 von 3 · … · Aufgabe 4 von 8 · noch ca. 5 Min. · danach …“. Eine Quelle für Namen und Minuten. Satzbau, Sprechen, alle Themen freiwillig; Einstufung/Lehrkraft-Import ins Menü. Wörter-Lernlogik (FSRS, Abruf, Abstände) bleibt; Wiederkehrer in neuem Satz.

**D Rückmeldung und Aufgabenqualität:** nach Prüfen immer: Urteil, eigene Antwort durchgestrichen + Lösung in der Lücke, Warum mit echter Regel und Signalwort (auch bei richtig), Merke. Blind-Lösen aller Aufgaben vor Freigabe; Erklärung-gegen-Satz-Prüfung; Liste britischer Formen; Claude-Zweitmeinung für alle getippten Arten („Auch richtig“ zählt nicht als Fehler); Melde-Knopf sichtbar mit sofortiger Wirkung und Sammeldokument für die Lehrer-Routine.

**Ablauf:** (1) klickbare Vorschau mit erfundenen Daten (Heute, Wörter-Karte vor/nach, Grammatik-Karte vor/nach, Wörter-Reiter, Grammatik-Reiter, Fortschritt; Handy und Laptop; echte Bedienung der Lücke) → Emrahs OK. (2) Nach Emrahs Entscheidung A sofort und parallel (ändert das Aussehen nicht). (3) B + C + D einbauen, ein Test-Link am Ende. Abnahmeliste: Kais 15 Punkte (siehe unten).

### Abnahmeliste für Vorschau und Test-Link (Kai)
1. Neue Aufgabe: sofort tippen ohne Klick (Handy und Laptop). 2. Jeden Buchstaben antippen und ändern; Rücktaste, Pfeile. 3. Heute: genau ein Satz, Knopf und Text stimmen überein. 4. Nach Prüfen eigene Antwort neben der richtigen, Unterschied markiert. 5. Erklärung immer offen (auch bei richtig), Claude-Knopf sichtbar. 6. Höchstens eine Zeile über dem Satz, Satz die größte Schrift. 7. Laptop: eigener Aufbau, kein leerer Platzhalter. 8. „Karte 5 von 18“, Abschluss-Karte. 9. Dasselbe Wort höchstens zweimal je Runde, frühestens nach 5 anderen Karten. 10. Grammatik als Kurs, „Test“ erst nach dem Lernen, keine zweite Themenliste. 11. Mindestens vier Aufgabenarten je Runde, darunter Hören und Sprechen. 12. Sprechen von Heute mit einem Tipp. 13. Fortschritt mit Weg zu C1. 14. Nichts liegt über dem Inhalt, keine abgeschnittene Spalte. 15. Grün/Rot und „Kommt wieder“ überall gleich formuliert.
