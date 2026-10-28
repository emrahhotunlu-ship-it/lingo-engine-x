# Teil 1c „Aussehen wie die Vorschau“: Bauplan

Stand 28.10.2026 · Verfasserin: Nora (Design-Leitung, Veto über Optik und Bedienung, `docs/relaunch/team.md`)
Grundlage: Entscheidung „Aussehen zuerst (Teil 1c vor 1b)“ (`docs/entscheidungen.md`, letzter Eintrag) und **Emrahs Vorgabe vom 28.10.2026: „Halte dich 1:1 am Plan! Das angenommene UI/UX-Design war integraler Bestandteil!“**
Maßstab: Vorschau `WBft3EEx7jYYv4QHdepuNm` v2, Quelle `docs/relaunch/vorschau/src/*`. Gemessen wird an dieser Quelle, „ähnlich“ reicht nicht.
Rahmen: `docs/relaunch/stufe1-plan.md` (§3.2 Besitz, §6 Design, §9 Prüftore) gilt weiter. Wo dieser Plan strenger ist, gilt dieser Plan. §6.5 („nichts wird inhaltlich neu gebaut“) und §6.7 (H7–H11, H17–H37 sind „kein Befund“) **gelten nicht mehr**. Sie sind durch die Vorgabe vom 28.10. abgelöst.

---

## 0. Kurzfassung

- Am Handy und am Laptop sieht die App heute **anders aus als die Vorschau**: anderer Aufbau, andere Karten und andere Anordnung. Farben, Schrift und Rahmen aus 1a stimmen schon. Der Abstand ist am größten bei Heute, im Reiter Wörter, auf Praxis, auf Fortschritt und beim Fenster „Fragen“ (§1).
- Der Bau läuft in drei Schichten, und es baut immer nur ein Helfer:
  1. **D-Pakete (D1–D6b):** Die sechs Hauptbildschirme plus Fragen und Ausfälle bekommen 1:1 das Aussehen der Vorschau, mit den Funktionen, die es heute gibt. Das sind ~10.000 Zeilen. Danach kommt Test-Link 7.
  2. **E-Pakete (E1–E7):** Alle übrigen Vorschau-Bildschirme, deren Funktion es schon gibt, bekommen 1:1 das Aussehen der Vorschau. Das sind ~8.500 Zeilen.
  3. **F-Pakete (F1–F5):** Fehlende Funktionen werden als eigene Pakete gebaut, in der Reihenfolge der Konzept-Stufen 2–6. Das sind ~25.000 Zeilen, als Schätzung. Dazu kommen Inhalte mit Gegenlesung durch english-teacher.
- **Zahlen:** Wo die Vorschau eine Beispielzahl zeigt, steht in der App an derselben Stelle und in derselben Gestaltung der echte Wert. Gibt es noch keinen echten Wert, zeigt die App die Vorschau-Variante für „wenig Belege“ (H14 `thin`, `screens.js:962–967`), also „–“ und „noch zu wenig Belege“. Erfundene Werte gibt es nie (§2).
- **1b:** P9a bleibt angehalten bis nach D5. Danach kommen P9a (neu aufgesetzt), P9b und P10 und erst dann die E-Pakete (§7).

---

## 1. Ist-Vergleich (Schritt 1)

**Aufnahme:** 28.10.2026, Modus Dunkel, Bewegung aus, 390×844 und 1440×900. Die App lief aus `dist/` mit Testdaten (`SEED_EVENING`, 20.09.2026 21:00). Die Vorschau lief aus `docs/relaunch/vorschau/build.mjs` mit `demo: 'wrong'`. Die Bilder liegen außerhalb des Repos, links steht die Vorschau, rechts die App:

`/tmp/claude-0/-home-user-lingo-engine-x/6af5333d-eebb-5460-9a49-5f84302bde29/scratchpad/1c/vergleich-<name>.png`. Zu `<name>` gehören: heute-390, heute-1440, wort-390, wort-1440, gram-390, gram-1440, erkl-390, greiter-390, greiter-1440, woerter-390, woerter-1440, praxis-390, fortschritt-390, fortschritt-1440 und fragen-390. Die Einzelbilder liegen in `…/1c/raw/`.

**Was nicht geklappt hat (offen gesagt):**
- H5 gibt es in der App so nicht. Verglichen wurde mit der Einführung `IntroFlow` (Kap. 1, Thema `time-clauses`, Schritt Formel), dem nächsten Gegenstück.
- Für Praxis und Fragen gibt es kein Laptop-Gegenstück in der Vorschau. L7 ist Claude in der Kontextspalte einer Übung, kein eigener Reiter.
- Nur Modus Dunkel und DE wurden aufgenommen. Gedämpft, Hell und EN prüft D1 mit dem Vergleichsgerüst (§3, D1).

### 1.1 Heute: H1 (`screens.js:179–254`) / L1 (`desk.js:136–164`) gegen `TodayScreen.tsx`

| # | Vorschau | App heute | Fundstelle App |
|---|---|---|---|
| 1 | Kopf „Heute“ 30/36 px fett mit Fragen-Knopf (`style.css:150–151`) | Datum „Sonntag, 20. September“ als Titel | `TodayScreen.tsx:384–386` (`today-date`) |
| 2 | **Großer Segmentring mittig** (188 px, Strich 11, ein Segment je Block, `style.css:175–179`), in der Mitte „28 / Min. heute“. Antippen zeigt die Blockliste ohne Knöpfe (`statelist`, `style.css:205`) | Kleiner Ring links neben „Als Nächstes“, darunter eine **Schrittliste mit Radios und Minuten in der Karte** | `TodayScreen.tsx:177–213`, `DayCard.tsx:59–77` |
| 3 | Thema groß (22/28), Unterzeile, „Als Nächstes: Gestern-Check · 6 Wörter“ mit Kanalpunkt | Titel der Einheit, Status „x von y“ | `TodayScreen.tsx:193–196` |
| 4 | Ein voller Knopf „Los geht’s“/„Weiter“ (52 px, `style.css:161–163`), darunter leise „Heute wenig Zeit?“ (`style-woerter.css:4`) | „Starten →“, darunter „Serie 12 · 6 von 6 Lerntagen“ | `TodayScreen.tsx:213` |
| 5 | **Wochenstreifen**: 7 Tageskreise und „14 Tage Serie“ | fehlt (Serie nur als Textzeile) | – |
| 6 | „Wenn du mehr willst“: höchstens 3 Zeilen, dann „Alles anzeigen“ → H33 | nur der Link „Extra“, ein Blatt erst nach der Pflicht | `ExtraRow.tsx:33`, `TodayScreen.tsx:440` |
| 7 | L1: Tageskarte quer (Ring links, Thema, Knopf), darunter zwei Karten **Kapitelstand · Dein nächster Termin**. Kontextspalte: **Diese Woche** (Mo–So mit Tagesart) und **Wenn du mehr willst** | Kontextspalte leer („Hier erscheinen Claude …“), Karten **Wörter fest · Kapitelstand** | `StandSide.tsx:39–59`, `ContextHost.tsx:123` |
| 8 | Hinweisbänder stehen nicht auf Heute. Wiedereinstieg und Pause sind eigene Varianten der Tageskarte (`pause`, `resume`) | Bänder „comeback“/„weekly“ unter der Karte | `TodayScreen.tsx:421–433`, `262` |

**Die drei größten Unterschiede:** (1) Schrittliste statt großem Segmentring mit Blockliste nur auf Antippen. (2) Datum statt „Heute“ als Kopf, Knopf „Starten“ statt „Los geht’s“ mit „Heute wenig Zeit?“. (3) Wochenstreifen und „Wenn du mehr willst“ fehlen, am Laptop ist die Kontextspalte leer.

### 1.2 Wörter-Übung: H2 `band` (`screens.js:255–280`) / L2 `checked` (`desk.js:165–228`) gegen `ExerciseView.tsx` und `Band.tsx`

| # | Vorschau | App heute |
|---|---|---|
| 1 | Kopf: Kanalpunkt und „Wörter · Thema“. **Balken nach Blöcken geteilt** (`style.css:224–228`, ein Abschnitt je Block des Tages) | „1 von 1 · Pflicht“, Balken ungeteilt, dazu Stufen-Punkte und „Lernt · Lücke frei“ |
| 2 | Aufgabe mit Knopf „Wozu?“. Die Lücke ist **unterstrichen** und nach dem Prüfen rot unterstrichen. Darunter „Gesucht: …“ | ⓘ statt „Wozu?“. Die Lücke ist ein **Kasten** mit Durchstreichung |
| 3 | Band (`style.css:275–278`, sanft getönt): „Noch nicht“, „Du: ~~x~~ → richtig“, **ein** Warum-Satz, Knöpfe „Mehr“ und „War das auch richtig?“, dann „Weiter“ | Band mit Beschriftung „Warum“, „Wieder in 1 Min.“, mehr Text |
| 4 | L2: Die Rückmeldung steht als Karte **unter der Aufgabe auf der Bühne**, unten eine Knopfzeile (⌨, „Weiter ⏎“). Kontextspalte: **Wozu?**, **Heute** (Blockliste), „Claude zu dieser Aufgabe fragen“ | Die Rückmeldung steht **in der Kontextspalte** (Wortkopf, Warum, Merke, „Erklär mir meine Antwort“). „Weiter“ geht über die volle Breite der Bühne |

**Die drei größten Unterschiede:** Balken nach Blöcken · Lücke als Unterstrich statt als Kasten · am Laptop steht die Rückmeldung auf der Bühne und in der Spalte stehen „Wozu?“ und „Heute“.

### 1.3 Grammatik-Übung: H4 `task` (`screens.js:341–409`) / L3 `band` (`desk.js:229–237`) gegen `GrammarItem.tsx`

| # | Vorschau | App heute |
|---|---|---|
| 1 | Kopf „Grammatik · Thema · Schritt 3 von 7“, Musterchips | Stufen-Punkte, Abzeichen „dein Fehler“ |
| 2 | Lücke im Satz mit Stichwort „(send)“ in Klammern. Die Knopfzeile **Tipp · Weiß ich nicht · Prüfen** steht über der Tastatur | Stichwort als eigene Zeile, „Tipp“ und „Weiß ich nicht“ als Pillen, „Prüfen“ im Fuß |
| 3 | L3: Kontextspalte **Regel** (Kurzregel mit ✓/✗, Signalwörter, „Ganze Erklärung“) und **Heute** | rechte Ergebniskarte |

**Die drei größten Unterschiede:** Knopfzeile über der Tastatur · Stichwort in der Lücke · Kontextspalte „Regel“ statt Ergebniskarte.

### 1.4 Grammatik-Erklärung: H5 `explain` (`screens.js:410–467`) gegen `IntroFlow.tsx`

Die Vorschau führt so: Kopf „Grammatik · Erklärung · ca. 70 Sekunden“, die **Frage als große Überschrift**, ein Absatz, eine Karte **Deutsch → Englisch mit ✓/✗**, die **Mustertabelle** (Form · Wann · Signal), „Mehr“, Punkte, „Weiter“. Die App zeigt „Neues Thema“ mit Formelkarte, Punkten und „Weiter“ (`intro-flow`, `intro-formula`).
**Die drei größten Unterschiede:** Problem-zuerst-Aufbau fehlt · Kontrastkarte Deutsch→Englisch fehlt · Mustertabelle fehlt. Die Inhalte dazu (Kontrastpaar, Tabelle je Thema) gibt es nur für wenige Themen. Deshalb gehört der volle Aufbau zu **F2**, D3 baut die Gestaltung mit den vorhandenen Feldern (§3).

### 1.5 Reiter Grammatik: H6 `path` (`screens.js:468–553`) / L4 (`desk.js:238–286`) gegen `LearnHub.tsx`

| # | Vorschau | App heute | Fundstelle |
|---|---|---|---|
| 1 | Karte „Du bist hier“: Thema, „Schritt x von 7“, ein Knopf | „Dein Weg zu C1 · Sieben Kapitel“ mit Sternbild-Karte | `LearnHub.tsx:146–190`, `ProgramMap.tsx` |
| 2 | Liste „Dein Weg zu C1 · **8 Kapitel**“, Nummernkacheln, gesperrte Kapitel mit Schloss | **7** Kapitel (`CHAPTERS_TOTAL = 7`, `src/domain/metrics/c1.ts:24`) | `PathList.tsx:49–80` |
| 3 | L4: Liste links, **Kapitel-Detail in der Kontextspalte** (Themen, Deine Fehler, Lehrerin, Kapitelaufgaben, „Abgeschlossen heißt“) | waagerechte Kapitelkarte und Themenchips. Das Detail ist ein Blatt | `ChapterSheet.tsx:65–172` |

**Die drei größten Unterschiede:** „Du bist hier“ statt Sternbild · Liste mit Kacheln und Schlössern · Detail in der Spalte. Dazu der **Lehrplan-Unterschied 8 zu 7 Kapitel** (Frage 1 in §9).

### 1.6 Reiter Wörter: H12 `list` (`screens.js:891–919`) / L5 (`desk.js:287–311`) gegen `VocabHub.tsx`

| # | Vorschau | App heute | Fundstelle |
|---|---|---|---|
| 1 | Karte „Wörter üben · 14 fällig · zählt als Extra · Üben“ (nach der Pflicht), Suche und Filterchips **Alle · Bildest du selbst · Auf dem Weg · Erkennst du** | Karte „Wiederholen“ mit Moduswahl Aufdecken/Tippen/Automatisch, „Pflicht: 30 Karten · 8 Min.“ | `VocabHub.tsx:168–214` |
| 2 | **Wortliste direkt auf der Wurzel**, Stufen-Abzeichen S1–S5, ruhende Wörter mit Schloss | Karte „Wortschatzziel C1 6.415 von 8.000“, „Neue Wörter“, Stapel. Die Liste ist eine eigene Seite | `VocabHub.tsx:216–286`, `VocabScreen.tsx:108–251` |
| 3 | L5: Knöpfe „Hinzufügen“ und „Üben ⏎“. Liste auf der Bühne, **Wort-Detail in der Kontextspalte** (Stand-Balken, Ursprungssatz, Wortpartner, letzte Versuche, „Dieses Wort üben“, Anhören, Sag es, Pausieren, Claude fragen, Verwalten) | Wort-Detail als Blatt | `WordSheet.tsx` |

**Die drei größten Unterschiede:** Liste mit Filterchips statt Kartenstapel · Moduswahl und Zielkarte stehen nicht auf der Wurzel · Wort-Detail in der Spalte.

### 1.7 Reiter Praxis: H13 `main` (`screens.js:920–983`) gegen `ApplyHub.tsx:181–232`

Die Vorschau zeigt die Karte **„Mission der Woche“** mit Abhakliste, dann **Sprechen** (Mein nächster Termin, Freie Mission, Hot Seat, „Alle“), **Hören** (Sprachnachrichten, Shadowing), **Lesen** (Tagesartikel, Kurse) und **Lehrerin**. Die App zeigt Überschrift und Erklärsatz, „Jetzt empfohlen · Weitere Fehlersätze 6“, „Sätze bauen“ (Wortpartner, Satzbau) und Kopfhörer- und Laptop-Fächer.
**Die drei größten Unterschiede:** Mission und Termin fehlen (F4) · Gliederung nach Sprechen/Hören/Lesen/Lehrerin statt nach Gerät · Fehlersätze und Satzbau gehören in der Vorschau zu Grammatik bzw. H33.

### 1.8 Fortschritt: H14 `main` (`screens.js:984–1011`) / L8 (`desk.js:368–393`) gegen `ProgressScreen.tsx`

| # | Vorschau | App heute | Fundstelle |
|---|---|---|---|
| 1 | Kopf „Fortschritt“ mit **nur dem Zahnrad**. **C1-Schätzung** als Satz mit Zeitachse und „vorläufig: aus x Messungen …“ | Avatar „A“ und Zahnrad. Karte „Auf dem Weg“ mit Wörter B2+ und Grammatik B2 als zwei Schieber | `TopBar.tsx:37–43`, `ProgressScreen.tsx:117–134` |
| 2 | **2×2-Kacheln** (176 px, Zahl 32 px, `style.css:403–414`): Bildest du selbst (auf dem Weg, Balken) · Grammatik x von 8 · Hören % · Sprechen Wörter/Min. | Umschalter Wörter/Grammatik/Rückblick | `WordsSegment.tsx`, `GrammarSegment.tsx` |
| 3 | Zeilen **Deine Fehler · Verlauf · So funktioniert’s**. L8-Spalte: Diese Woche, Kann-Beschreibungen x von 12, Lehrerin | Reiter-Inhalte untereinander | `PathTab.tsx:125–156` |

**Die drei größten Unterschiede:** C1-Satz mit Zeitachse fehlt · Kacheln statt Schieber und Umschalter · Avatar zu viel, Zeilen-Navigation fehlt.

### 1.9 Fragen: H15 `claude` (`screens.js:1012–1040`) gegen `CompanionOverlay.tsx`

Die Vorschau zeigt ein **Blatt von unten über der Übung** mit Reitern Claude · Übersetzen · Prüfen, dem Hinweis „Aufgabe + deine Antwort sind dabei“, dem Verlauf und der Eingabe „Frag Claude …“ mit rundem Senden-Knopf. Die App zeigt ein **schwebendes, verschiebbares Fenster** mit Schaltern Übersetzen/Fragen, Minimieren/Vollbild/Schließen, „sieht gerade: Heute“, Schnell/Gründlich und Vorschlagschips. Das Fenster **verdeckt die Tageskarte** (`CompanionOverlay.tsx:350–455`).
**Die drei größten Unterschiede:** Fenster statt Blatt · kein Reiter „Prüfen“ · zu viele Bedienelemente (Griff, Größe, Modus).

---

## 2. Datenquelle je sichtbarer Zahl und je Text (Hauptbildschirme)

Regeln: Jede Zahl kommt aus `src/domain/metrics/*` oder einem bestehenden Store. Kein Bildschirm rechnet selbst (Stufe-1-Plan §5.2). Fehlt ein echter Wert, steht die Vorschau-Gestaltung für „wenig Belege“ („–“ plus Satz). Weglassen ist nicht erlaubt, erfinden auch nicht (Kap. 2 Nr. 2, Kap. 15 „Zähler, der freiwillige Schritte als Pflicht mitzählt“).

| Stelle (Vorschau) | Beispiel dort | Quelle in der App | Bis F-Paket da ist |
|---|---|---|---|
| H1 Ring: Segmente | 6 Blöcke | Schritte der Tageseinheit `unit.u.b` in `todaySummary().fills` (`src/domain/metrics/today.ts:128`, `ring.ts:12` `ringFills`, Deckel `RING_OPEN_MAX` `ring.ts:9`) | So viele Segmente, wie der Plan heute Schritte hat (heute 3–5). Sechs Blöcke erst mit F3 |
| H1 Ring Mitte | „28 Min. heute“ / „12 Min. übrig“ | `todaySummary().rest` | echt |
| H1 Thema, Unterzeile | „Lieferverzug erklären“ | Titel und Grund der Tageseinheit (`today-title`, `reason`/`whyKey`, `DayCard.tsx:77`) | Tagesthema mit Wochenszenario erst mit F3 |
| H1 „Als Nächstes: … · 6 Wörter“ | Kanal und Anzahl | erster offener Pflichtschritt `now` und seine Menge (`reviewFigures` `today.ts:60`, `newToday` `:71`, `fehlersaetzeDue` `:144`) | echt |
| H1 Wochenstreifen | 7 Kreise, „14 Tage Serie“ | `streakWeek()` (`streak.ts:42`), `WEEK_GOAL` (`streak.ts:50`), `restInfo` (`:85`) | echt |
| L1 „Diese Woche“: Tagesart | „Schreibtag“, „Mission“ | Tagestypen gibt es nicht | Statt der Tagesart steht der echte Tageszustand (erledigt · Ruhetag · offen · heute). Die Tagesart kommt mit F3 |
| H1/L1 „Wenn du mehr willst“ | 3 Zeilen | Zeilen von `ExtraRow` (`ExtraRow.tsx:119`, `extra-line`) | echt, nach der Pflicht mit „zählt als Extra“ |
| L1 Kapitelstand | „Kapitel 1 · Thema 2 von 4“ | `chapterState` (`src/domain/c1/state.ts:75`), `CHAPTERS_TOTAL` (`c1.ts:24`) | echt, **„von 7“** (Frage 1) |
| L1 Dein nächster Termin | „Di · Call mit Einkauf“ | gibt es nicht (F4) | Bis F4 steht an diesem Platz in der L1-Kartengestaltung die echte Karte „Wörter fest“ (`festCount`, heute `StandSide.tsx:40`). Kein toter Knopf und keine Platzhalter-Zahl. Die Abweichung ist als offener Punkt von F4 vermerkt |
| H2/H4 Balken | Abschnitte je Block | Schritte der Einheit plus Stelle in der Runde (`Player.tsx`, Fortschritt aus der Runde) | echt |
| H4 „Schritt 3 von 7“ | Ablauf 0–7 | gibt es nicht (Ablauf 0–7 = F2) | „Thema · Stufe“ aus `topicStage` (`grammar.ts:40`) in derselben Zeile, ohne „von 7“ |
| H12 Filterchips | Alle 491 · Bildest du selbst 38 · Auf dem Weg 41 · Erkennst du 412 | `counts().total` (`definitions.ts:44`), `festCount` (`vocab.ts:43`), `onTheWay` (`vocab.ts:50`). „Erkennst du“ = total − fest − auf dem Weg, als eine Funktion **in `vocab.ts`** (neu, Test), nicht im Bildschirm | echt nach heutiger Fest-Regel (`FEST_DAYS = 21`, `cardStatus.ts:28`). Mit F1 wird daraus S5 |
| H12 Stufen-Abzeichen | S1–S5 | `unitState` (`definitions.ts:29`): new/learning/wobbly/safe/firm | Abzeichen in derselben Form mit den heutigen fünf Zuständen und ihren heutigen Namen. S-Stufen kommen mit F1 |
| H12 „Wörter üben · 14 fällig“ | Anzahl | `counts().due` | echt |
| H14 C1-Satz und Zeitachse | „zwischen Okt 2027 und Jan 2028“ | eine C1-Schätzung gibt es nicht. `festForecast` (`vocab.ts:163`) gilt nur für Wörter | Variante `thin`: „C1-Schätzung: noch zu wenig Belege“ und Achse ohne Band. Kommt mit F5 |
| H14 Kachel Wörter | 38 · auf dem Weg 41 · Balken | `festCount`, `onTheWay`, `counts().total` | echt |
| H14 Kachel Grammatik | „1 von 8 · Thema 1 von 4“ | `chapterState`, `CHAPTERS_TOTAL` | echt, „von 7“ |
| H14 Kachel Hören | 71 % | Hörquote gibt es nicht | „–“ und „noch zu wenig Belege“ (thin) bis F3/F5 |
| H14 Kachel Sprechen | 92 Wörter/Min. | Sprechtempo gibt es nicht | „–“ und „ab 3 Sprechaufgaben“ (thin) bis F4/F5 |
| H14 Deine Fehler | „3 offen“ | `errorSentenceStats` (`grammar.ts:93`) | echt |
| L8 Kann-Beschreibungen | „2 von 12“ | `CANDO_ITEMS` und Status (`src/domain/progress/cando.ts:12–18`) | echt, Anzahl wie im Datensatz. Gibt es dort nicht genau 12, steht die echte Zahl |
| L8/H13 Lehrerin | „Korrekturen vom 14.10.“ | `teacherFeedback`-Daten (`src/features/teacher/actions.ts`) | echt oder Leerzustand |
| H13 Mission der Woche | Abhakliste | gibt es nicht | Die Karte steht erst mit F4. Bis dahin steht oben „Sprechen“ |
| H15 „Aufgabe + deine Antwort sind dabei“ | Hinweis | `contextColumn.ts`/`playerContext.ts` (was Claude sieht) | echt |

**Texte:** Alle neuen Oberflächentexte kommen in neue Teildateien `src/i18n/parts/v*.de.ts`/`.en.ts`, je Paket eine. Der Wortlaut wird **wörtlich aus der Vorschau** übernommen (`L('de','en')`). Steht dort eine Beispielzahl, wird sie zum Platzhalter. Kein Prompt-Text in Oberflächen-Dateien (Kap. 3.4).

---

## 3. Pakete

### 3.0 Für alle Pakete

- **Arbeitsweise:** ein Helfer gleichzeitig, eigener Zweig `claude/umbau-1c-<paket>`, Zusammenführen durch die Hauptsitzung, G0 vor jedem Zusammenführen (`stufe1-plan.md` §9).
- **Messung gegen die Vorschau:** D1 baut das Vergleichsgerüst `tests/e2e/vorschau.spec.ts`. Jedes Paket hängt seine Paare an. Je Paar entsteht ein Bild bei **390×844, 1440×900 und 2560×1440**, in **Dunkel, Gedämpft und Hell**, in **DE und EN**. Dazu kommen axe ohne Befund, Kontrast ≥ 4,5:1 bei Text und ≥ 3:1 bei Rändern und Zeichen sowie Maßprüfungen per `getBoundingClientRect` gegen die Vorschau: Kopfhöhe, Ringgröße, Knopfhöhe, Kartenradius, Abstände ±2 px, Schriftgröße exakt. Jede Abweichung ist ein **Befund**, nicht „ähnlich genug“.
- **Bestehende `data-testid` bleiben.** Wo ein Element wegfällt (z. B. die Schrittliste `duties`), wird der Test in **demselben** Paket auf das neue Element umgestellt, mit Begründung im Commit. Vorher gibt es einen Abgleich mit qa-runner.
- **Budget** (`scripts/budget.json`): Jedes Paket trägt beim Zusammenführen genau seinen Betrag unter `zuwachs` ein (Sperrklinke). Entfernte alte CSS wird gegengerechnet. Die Beträge unten sind Obergrenzen in Byte gzip.
- **Prüfer je Paket:** Nora (Veto) mit dem ux-reviewer (Vergleichsbilder). Bei Übungen kommt der learning-scientist dazu, er prüft die vier Fragen an fester Stelle, `grade`, `srs/queue` und `plan` unverändert. data-guard nur bei Datenänderungen, english-teacher bei neuen englischen Texten.

### 3.1 D-Pakete: Hauptbildschirme 1:1, mit den Funktionen von heute

| Paket | Inhalt (Vorschau → App) | Dateien und Besitz | Größe | Tests | Budget (entry / css) |
|---|---|---|---|---|---|
| **D1 V-BAU** | Bausteine 1:1 aus `style.css` und `app.js`: `phead`, `card`, `row`, `chip`, `tile`, `btn` (pri/sec/ghost/sm), `iconbtn`, `ring` (Segmente, Zeichnen `style.css:539`), Wochenstreifen, `statelist`, `sheet` (`style.css:299–304`), `notice`. **Vergleichsgerüst** (Vorschau als Testseite über `page.route`, Messhelfer). Leere alte part-Dateien entfernen (`fxo`, `fxr`, `gx`, `hx`, `mo`, `px`, `tt`, `wx`, Importe `index.css:3–18`) | neu: `src/ui/v/*.tsx`, `src/styles/parts/v.css`, `tests/e2e/vorschau.spec.ts`, `tests/e2e/vorschauHelpers.ts`. Besitz D1, danach eingefroren (Änderung nur über die Hauptsitzung) | **M** ~1.000 Zeilen | Unit je Baustein (Rollen, 44 pt, reduced-motion). Vorschau-Gerüst grün mit einem Probe-Paar | +6.000 / +3.000 |
| **D2 V-HEUTE** | H1: `start`, `mid`, `ring`, `done`, `skeleton`, `resume`; `pause` mit dem heutigen Neustart-Inhalt (`RestartCard`). L1: `main`, `start`, `done`. Kontextspalte Heute (Diese Woche, Wenn du mehr willst). Zahlen nach §2. Bänder `comeback`/`weekly` werden zu Varianten der Tageskarte bzw. zur Zeile in „Diese Woche“ | `src/features/today/*` (Besitz D2), `StandSide.tsx` raus, `ContextHost.tsx` (nur der Heute-Eintrag), `TopBar.tsx` (Kopf „Heute“). Alte CSS-Regeln: Heute-Regeln aus `dz.css`, `DayRing` aus `r6a.css` **entfernen** | **L** ~1.700 | `today.spec`, `heute*.spec` an die neuen Elemente (Ring `today-ring`, Blockliste nur auf Antippen). Kap.-15-Fälle bleiben grün (Plan würfelt nicht, Erledigtes ist kein Knopf, Extra zählt nicht zur Pflicht). Vorschau-Paare H1×6, L1×3 | +8.000 / +1.500 (netto nach Abzug) |
| **D3 V-UEBUNG** | H2 `intro`/`type`/`gap`/`band`/`also`/`more`/`menu`/`word`, H3 (Blockzeile, ohne Lichtimpuls-Zeit), H4 `task`/`hint`/`band`/`more`, H5 `explain` mit den Feldern, die es heute gibt (Frage, Absatz, Formel). Kontrast und Tabelle nur, wo Inhalte vorhanden sind, sonst bleibt der Platz zu (F2). L2 `task`/`checked`/`help`, L3 `hint`/`band`: Rückmeldung auf der Bühne, Spalte Wozu?/Regel/Heute. Lücke als Unterstrich. Knopfzeile über der Tastatur | `src/ui/exercise/*` (Besitz D3, P3 ist fertig), `Player.tsx`, `ExerciseView.tsx` (nur Darstellung), `GrammarItem.tsx` (nur Darstellung), `IntroFlow.tsx`, `src/engine/KineticGap.tsx` (nur Aussehen). Alte CSS: Übungsregeln aus `dz2.css`, `ee.css`, `fxl.css`, `u3.css` **entfernen** | **L** ~2.000 | `band.spec`, `lernen.spec`, `trainer*.spec` und die kinetische Lücke bleiben grün (Tippgefühl, Kap. 14). Vorschau-Paare H2×8, H3×2, H4×4, H5×1, L2×3, L3×2. learning-scientist: vier Fragen | +6.000 / +1.000 |
| **D4 V-WOERTER** | H12 `list`, `list-before`, `list-nothing-due`, `detail`, `resting-sheet`, `filter`. L5 `main`, `resting`, `manage` (Spalte). Wortliste mit Filterchips auf der Wurzel. Moduswahl und „Wortschatzziel“ wandern (Moduswahl → Trainer-Start H17 in E1, bis dahin als „…“ an „Üben“; Zielkarte → Fortschritt-Kachel) | `src/features/vocab/hub/*`, `src/features/vocab/list/*` (Besitz D4). Neue Funktion `recognizeCount` in `src/domain/metrics/vocab.ts` (Besitz D4, nur additiv). Alte CSS: Wörter-Regeln aus `dz.css`, `r6b.css` (`lx-sky-*` bleibt für den Atlas) | **L** ~1.600 | `vocab*.spec`, `wortschatz*.spec` umstellen, `ws-*`-testids bleiben am neuen Ort. Golden-Test der Zahlen (P5) unverändert. Paare H12×6, L5×3 | +5.000 / +1.000 |
| **D5 V-GRAMMATIK** | H6 `path`, `chapter`. L4 `main` mit Kapitel-Detail in der Spalte. „Du bist hier“, Kapitelliste mit Kacheln und Schlössern. Sternbild und `ProgramMap` fallen auf der Wurzel weg (Film und C1-Reise bleiben erreichbar über das Kapitel-Detail) | `src/features/learn/*`, `src/features/grammar/PathList.tsx`, `src/features/c1/ChapterSheet.tsx` (Besitz D5). Alte CSS: `lx-jr-*` aus `r6b.css`, Lernen-Regeln aus `dz.css` **entfernen** | **M** ~1.100 | `lernen.spec`, `c1*.spec` (`chapter-*`-testids bleiben). Paare H6×2, L4×1 | +3.000 / +500 |
| **D6a V-PRAXIS-FORTSCHRITT** | H13 `main` (Sprechen, Hören, Lesen, Lehrerin; Mission-Karte erst in F4), H13 `reader` (Leser im Kopf und Abständen der Vorschau). H14 `main` mit echten Werten und `thin` für fehlende Werte. L8 `main`. Kopf Fortschritt nur mit Zahnrad (Avatar entfällt) | `src/features/apply/*`, `src/features/progress/ProgressScreen.tsx`, `StandHeader.tsx`, `WordsSegment.tsx`, `GrammarSegment.tsx`, `TopBar.tsx` (nur der Fortschritt-Zweig) (Besitz D6a) | **L** ~1.400 | `anwenden*.spec`, `fortschritt*.spec`, `read*.spec`. Paare H13×2, H14×2 (main, thin), L8×1 | +4.000 / +800 |
| **D6b V-FRAGEN** | H15 `claude`, `translate`, `saved` als **Blatt** (Handy). L7 `claude`, `translate` in der Kontextspalte. H16 `noai`, `tts`, `empty`, `nosave` für alle D-Bildschirme. L10 Breitenproben 1024/1280/1920/2560 | `src/features/companion/*` (Besitz D6b; Fenster, Griff und Größe entfallen), `src/app/shell/SheetHost.tsx`. Ausfälle in den D-Bildschirmen | **M** ~1.200 | `companion*.spec` (`companion`, `open-companion` bleiben). Ausfälle per `?fake=nodb,nosample`. Paare H15×3, H16×4, L7×2, L10×4 | +2.000 / +500 |

**Summe D:** ~10.000 Zeilen (davon ~35 % Tests). entry +34 KB, css +8,3 KB netto. **Test-Link 7 nach D6b** mit G1–G4 (`stufe1-plan.md` §9).

### 3.2 E-Pakete: übrige Bildschirme mit vorhandener Funktion, 1:1 im Aussehen

Diese Pakete bauen erst nach 1b (§7). Ihre Bildschirme sind dann eigene nachgeladene Stücke.

| Paket | Vorschau (Varianten) | Ziel in der App | Größe |
|---|---|---|---|
| **E1 Trainer-Strecke** | H17 (alle 7), H18 `recognize`, `listen`, `speak`, `gap`, `band-early`, `word`, H19 (alle 6), H20 `normal`, `all-early`, `stopped`, H22 (beide), L11 (alle 3), L12 `task`, `checked`, `checked-early`, L13 (beide), L14 | `trainer` (`src/features/vocab/TrainerScreen.tsx`), `FlipCard.tsx`, `UndoBar.tsx`, `Summary.tsx`, `tempoRound`. Moduswahl aus D4 wird zum Trainer-Start | **L** ~1.800 |
| **E2 Wörter sammeln/verwalten** | H21 (alle 6), H23 (alle 4) | `AddWordSheet.tsx`, `FromText.tsx`, `WordSheet.tsx`, `VocabScreen.tsx` (Ausblenden, Stapel) | **M** ~900 |
| **E3 Einstellungen** | H24 (alle 5), L15 (beide) | `SettingsSheet.tsx` als Seite hinter dem Zahnrad, Abschnitte aus `src/features/settings/*` | **M** ~1.000 |
| **E4 Fehler und Thema frei** | H26 (alle 3), H27 (alle 4), L16 (beide) | `repairRound`, `FkItem`, `ErrorsTab.tsx`, `grammarSession` `topic`, `wissen` | **M** ~1.100 |
| **E5 Lehrer und Sprechen** | H28 `paste`, `confirm`, `note`; H29 (alle 3) | `TeacherFeedbackScreen.tsx`, `SpeakHub.tsx`, `pressure` (objection), `roleplay` | **M** ~1.100 |
| **E6 Mehr üben, Lesen, Prüfen, Details** | H33 (alle 3), H34 `words`, `grammar`, `history`, H35 (alle 3), H36 (beide) | Extra-Liste, Wort-Werkstatt, `HistoryTab.tsx`/`StatsTab.tsx`, `readCourse`/`readLesson`/Archiv, `SentenceClinic.tsx`, `WritingStudio.tsx` | **L** ~1.700 |
| **E7 Abschluss und Wochenteile** | H10 `day`, H30 `report`, `focus`, H31 `chapter`, H25 `placement-*`, H32 `task`, `writing`, `feedback`, `rewrite`, L17 | `DoneCard3.tsx`, `WeeklyReview3.tsx`, `FocusPick.tsx`, `GateResult.tsx`, `PlacementScreen.tsx`, `mail`/`MailResult.tsx` | **M** ~900 |

**Summe E:** ~8.500 Zeilen. Prüfer: Nora und ux-reviewer. Bei E1, E4, E7 zusätzlich der learning-scientist. Budget je Paket als eigenes Lazy-Stück (Grenze `lazyNeu` bzw. P10-Endwerte). Jedes E-Paket entfernt die alten CSS-Regeln seiner Bildschirme (`cx.css` nur Tokens, `r6a.css` CardStack/Odometer in E1, `u3.css` Rest in E7). Nach E7 dürfen **keine** der 17 alten part-Dateien mehr Regeln für umgebaute Bildschirme enthalten (§5).

### 3.3 F-Pakete: fehlende Funktionen (eigene Pakete, Reihenfolge der Konzept-Stufen)

Jedes F-Paket ändert einen Lernkern-Teil und läuft deshalb nach Konzept 14.1 mit **eigenem Test-Link**. Vor dem Bau gibt es je F-Paket genau einen Planungsdurchgang (architect und die Fachrollen, CLAUDE.md A2 „einmal planen“). Die Größen sind **Schätzungen** aus Konzept und Vorschau-Umfang, noch nicht belegt.

| Paket | Konzept-Stufe | Was fehlt (Vorschau) | Größe (Schätzung) | Prüfer |
|---|---|---|---|---|
| **F1 Wörter neu** | 2 | Stufen S0–S5 und zwei Spuren, ehrliche Zahl mit „auf dem Weg“ überall, Gestern-Check. H18 `free`, `partner`, `situation`, `return`, `contrast`. H20 `with-step`, H12 S-Abzeichen, H25 `welcome`, `honest`, H37 `stages`. Vorher: Speichermodell `vs`, Rückweg-Test, Bestandsfehler (Konzept §18 „vor Stufe 2“) | **XL** ~6.000 + Umrechnung mit Trockenlauf | Lena (learning-scientist), Tarek, data-guard |
| **F2 Grammatik-Kurs** | 3 | 8 Kapitel und 27 Kernthemen, Ablauf 0–7 („Schritt x von 7“), H5 vollständig (Problem, Kontrast Deutsch→Englisch, Mustertabelle) für alle Themen, H31 `passed`/`failed` (Themen-Test), Kapitel-Gate, Einstufungs-Itembank | **XL** ~5.000 + Inhalte Kap. 1–2 (Chargen mit english-teacher) | Lena, James, english-teacher |
| **F3 Der Tag** | 4 | Sechs Blöcke mit Tagestypen und Tagesthema. H1 `catchup`, `short`, `vacation`, `first`, `day1`, `writing`, `test`, `review`. H3 Lichtimpuls. **H7 Hören** (alle 6). **H8 Sag es** (alle 7). **H9 Flüssigkeit** (alle 4). H10 `adapt`. **L9 Schreibtag** und H32 als Tagestyp. Einstufung vor Woche 1 (H25 `placement-*` als Pflicht). Mini-Vorher-Nachher. Geschnitten in F3a Tag-Gerüst und Tagestypen (~2.000), F3b Hören (~1.500), F3c Sag es und Flüssigkeit (~1.800), F3d Schreibtag (~900), F3e Einstufung und Vorher-Nachher (~800) | **XL** ~7.000 | Lena, James, Kai, ux-reviewer |
| **F4 Missionen** | 5 | H11 (alle 4), L6 (beide), **Termin-Seite T** (`ask`, `filled`), H1 `mission`/`termin`, H13 „Mission der Woche“, L1 Karte „Dein nächster Termin“, Sprechkurve (H14 `speech`), H29 Szenen in der Mission | **L–XL** ~3.500 | Lena, Kai, data-guard (Termin nur in Emrahs Datenbank, ohne Namen) |
| **F5 Fortschritt** | 6 | C1-Schätzung mit Zeitachse (H14 `main`), Hören-% und Sprechen-Kachel mit echten Werten, Kann-Beschreibungen in L8, H31 `milestone`, **H30 `all`** und Wochenabschluss vollständig (L17), **Wochenfrage W** (`ask`), H28 `monthly` (Preply-Formular), H34 `listening`, Vorher-Nachher nach 4 Wochen | **L–XL** ~3.500 | Lena, Kai |

**Summe F:** ~25.000 Zeilen, Schätzung. Inhalte kommen dazu: Grammatik-Kapitel, Hörtexte, Missionen, nach Konzept 8.7 je Test-Link höchstens ein neuer Inhaltsstrang.

---

## 4. Statusliste aller Vorschau-Bildschirme

Die Spalte „Funktion heute“ ist eine Einschätzung aus Code und Konzept. „Teilweise“ heißt: Ein Teil der Varianten hat eine echte Funktion, der Rest fehlt.

| Code | Name (Varianten) | Ziel in der App | Funktion heute | Paket |
|---|---|---|---|---|
| H1 | Heute (17: start, mid, ring, done, catchup, mission, termin, skeleton, resume, pause, vacation, short, first, day1, writing, test, review) | `today` | teilweise (start/mid/ring/done/skeleton/resume/pause da) | D2, F3, F4 |
| H2 | Wörter-Block (8) | `trainer`/Plan-Schritt | gibt es | D3 |
| H3 | Blockwechsel (2) | `Player` | teilweise (Schrittwechsel ja, Blöcke nein) | D3, F3 |
| H4 | Grammatik-Block (4) | `grammarSession` | gibt es | D3 |
| H5 | Grammatik-Erklärung (3) | `IntroFlow` | teilweise | D3, F2 |
| H6 | Reiter Grammatik (2) | `learn` | gibt es (7 Kapitel) | D5, F2 |
| H7 | Hören (6) | neu (`listenQ`/`listenLoop` als Ansatz) | teilweise | F3b |
| H8 | Sag es, Diktat (7) | neu (Werkstatt „Sag es“ als Ansatz) | teilweise | F3c |
| H9 | Flüssigkeit (4) | neu (`pressure`/`tempoRound` als Ansatz) | teilweise | F3c |
| H10 | Abschlusskarte (2) | `DoneCard3` | teilweise (`adapt` fehlt) | E7, F3 |
| H11 | Mission im Rahmen (4) | neu | fehlt ganz | F4 |
| H12 | Reiter Wörter (6) | `vocab` | gibt es (ohne S-Stufen) | D4, F1 |
| H13 | Reiter Praxis (2) | `apply` | teilweise (Mission fehlt) | D6a, F4 |
| H14 | Reiter Fortschritt (3) | `overview` | teilweise (C1-Schätzung, Hören, Sprechen fehlen) | D6a, F5 |
| H15 | Blatt Fragen (3) | `companion` | gibt es | D6b |
| H16 | Ausfälle (4) | alle | gibt es | D6b |
| H17 | Trainer-Start (7) | Moduswahl `VocabHub` | teilweise | E1 |
| H18 | Trainer-Aufgabe (11) | `trainer` | teilweise (frei, partner, situation, return, contrast fehlen) | E1, F1 |
| H19 | Anki-Karte (6) | `FlipCard`, `UndoBar` | gibt es | E1 |
| H20 | Trainer-Ergebnis (4) | `Summary` | teilweise (`with-step` fehlt) | E1, F1 |
| H21 | Wörter sammeln (6) | `AddWordSheet`, `FromText` | gibt es | E2 |
| H22 | Tempo (2) | `tempoRound` | gibt es | E1 |
| H23 | Wort verwalten (4) | `WordSheet`, `VocabScreen` | gibt es | E2 |
| H24 | Einstellungen (5) | `SettingsSheet` | gibt es | E3 |
| H25 | Erster Start, Einstufung (5) | `PlacementScreen` | teilweise (welcome/honest fehlen) | E7, F1, F3e |
| H26 | Deine Fehler (3) | `repairRound`, `ErrorsTab` | gibt es | E4 |
| H27 | Grammatik-Thema frei (4) | `grammarSession topic`, `wissen` | gibt es | E4 |
| H28 | Lehrer, Preply (4) | `teacherFeedback` | teilweise (`monthly` fehlt) | E5, F5 |
| H29 | Sprechen, alle Einträge (3) | `SpeakHub`, `pressure` | gibt es | E5 |
| H30 | Wochenabschluss (3) | `WeeklyReview3`, `FocusPick` | teilweise (`all` fehlt) | E7, F5 |
| H31 | Test-Ergebnis (4) | `GateResult` | teilweise (nur `chapter`) | E7, F2, F5 |
| H32 | Wochen-Mail (4) | `mail`, `MailResult` | teilweise (kein Schreibtag) | E7, F3d |
| H33 | Mehr üben (3) | Extra-Blatt, Werkstatt | gibt es | E6 |
| H34 | Fortschritt-Details (4) | Reiter-Tabs `overview` | teilweise (`listening` fehlt) | E6, F5 |
| H35 | Lesen, Kurse, Archiv (3) | `read*` | gibt es | E6 |
| H36 | Prüfen (2) | `SentenceClinic`, `WritingStudio` | gibt es | E6 |
| H37 | So funktioniert’s (2) | neu (Textseite) | fehlt ganz | E6 (overview), F1 (stages) |
| T | Termin-Seite (2) | neu | fehlt ganz | F4 |
| W | Wochenfrage (1) | neu | fehlt ganz | F5 |
| L1 | Heute (5) | `today` ≥ 1024 | teilweise (Termin, Tagesart fehlen) | D2, F3, F4 |
| L2 | Wörter-Übung (3) | Übung ≥ 1024 | gibt es | D3 |
| L3 | Grammatik-Übung (2) | Übung ≥ 1024 | gibt es | D3 |
| L4 | Reiter Grammatik (1) | `learn` ≥ 1024 | gibt es | D5 |
| L5 | Reiter Wörter (3) | `vocab` ≥ 1024 | gibt es | D4 |
| L6 | Mission (2) | neu | fehlt ganz | F4 |
| L7 | Claude in der Kontextspalte (2) | `companion` in der Spalte | gibt es | D6b |
| L8 | Fortschritt (1) | `overview` ≥ 1024 | teilweise | D6a, F5 |
| L9 | Schreibtag (2) | neu (`WritingStudio` als Ansatz) | teilweise | F3d |
| L10 | Breitenproben (1) | Rahmen | gibt es (1a P2) | D6b |
| L11 | Trainer-Start (3) | Moduswahl | teilweise | E1 |
| L12 | Trainer-Aufgabe (4) | `trainer` | teilweise (`contrast` fehlt) | E1, F1 |
| L13 | Anki (2) | `FlipCard` | gibt es | E1 |
| L14 | Trainer-Ergebnis (1) | `Summary` | gibt es | E1 |
| L15 | Einstellungen (2) | `SettingsSheet` | gibt es | E3 |
| L16 | Fehler, Grammatik-Thema (2) | `repairRound`, `grammarSession` | gibt es | E4 |
| L17 | Wochenabschluss (1) | `WeeklyReview3` | teilweise | E7, F5 |

Zählung: 56 Bildschirme (39 Handy einschließlich T und W, 17 Laptop). **27 gibt es als Funktion, 24 nur teilweise, 5 fehlen ganz** (H11, H37, T, W, L6).

---

## 5. Was sich nicht ändert

Für die **D- und E-Pakete**:
- **Lernlogik:** `src/domain/grade`, `srs/queue`, `plan`, Quoten und Notentabelle bleiben unverändert. Der learning-scientist bestätigt das je Übungspaket (G1).
- **Tagesplan:** Schritte, Reihenfolge, Minuten und `u.rv` bleiben gleich. Der Ring zeigt den Plan, er ändert ihn nicht. Kap. 15 „Plan würfelt neu“ bleibt durch die bestehenden Tests abgedeckt.
- **Daten:** keine neuen Pfade und Felder. Die einzige neue Funktion ist `recognizeCount` (reine Rechnung). Daten nur additiv, data-guard wird nicht gebraucht.
- **Inhalte:** keine neuen Aufgaben, Erklärungen oder Wörter.
- **Erreichbarkeit (A5):** Jede Funktion, die heute erreichbar ist, bleibt höchstens zwei Tipps tiefer erreichbar. Was von einer Wurzel wegfällt (Moduswahl, Wortschatzziel, Sternbild, Fächer in Praxis), bekommt im selben Paket den Ort, den die Vorschau dafür vorsieht. Das sichert ein Erreichbarkeitstest je Paket.
- **Rückweg v86** (`JLL8…` `1793087421-695a`) funktioniert weiter, weil sich an den Daten nichts ändert.

Für die **F-Pakete** gilt das nicht. Jedes ändert genau einen Lernkern-Teil, nur additiv in den Daten (Konzept §18). Jedes hat eigene Tore (Lena, Tarek, data-guard) und einen eigenen Test-Link.

---

## 6. Verbotene Muster

Es gilt `stufe1-plan.md` §6.6 vollständig: kein `backdrop-filter`, ein Schatten und ein Radius je Ebene, Farben nur aus Tokens, Zustand nie nur über Farbe, kein Rot für Hinweis oder „Lösung gezeigt“, ein Hauptknopf je Bildschirm, keine Leiste in Übungen, Zahnrad nur auf Fortschritt, kein Querscrollen, Ziele ≥ 44 pt und für jede Bewegung ein Rückfall bei reduced-motion. Dazu kommt:

- **Alte part-CSS umgebauter Bildschirme wird entfernt, nicht überstimmt.** Jedes D- und E-Paket löscht die Regeln seiner Bildschirme aus den alten Dateien (Zuordnung in §3). Leere Dateien werden samt Import gelöscht. Ein Prüfskript `scripts/check-css-legacy.mjs` (D1) meldet jede Klasse aus einer alten part-Datei, die in einer umgebauten Bildschirmdatei noch benutzt wird.
- Keine Kopie einer Vorschau-Datei in die App. Übernommen werden Maße, Tokens und Aufbau, gebaut wird in React mit den Bausteinen aus D1.
- Keine Beispielzahl aus der Vorschau im Code. Eine Lint-Regel sucht in `src/features` und `src/ui/v` nach Zahlenliteralen in i18n-Texten.
- Kein zweiter Weg zu Claude: Am Handy gibt es nur das Blatt, am Laptop nur die Kontextspalte.
- **Kein schwebendes Fenster.**

---

## 7. Einordnung von 1b

| Paket | Stand | Konflikt mit 1c |
|---|---|---|
| **P9a** (Grammatik-Inhalte nachladen) | angehalten im Worktree `claude/umbau-s1-inhalt-a` | ändert `src/domain/grammar/*` und `repair/fk.ts` sowie die Aufrufer mit den Zuständen „lädt/Fehler“. D3 (`GrammarItem`, `IntroFlow`) und D5 (`learn`, `PathList`) ändern dieselben Bildschirme |
| **P9b** (übrige Inhalte) | nicht begonnen | Lexikon, Atlas und `content.ts` werden von D4 gelesen (Wortliste, Wort-Detail). Das ist nur ein Konflikt in den Ladezuständen |
| **P10** (Bereiche, Slots, Rail/Desk-Hülle und Texte getrennt laden) | nicht begonnen | `src/areas`, `registerAll`, `src/app/shell` und `src/i18n/index`: 1c ändert die Hülle (`TopBar`, `ContextHost`, `SheetHost`) und legt neue i18n-Teildateien an. Das Start-Wörterbuch aus P10 Nr. 4 muss die Heute-Texte aus D2 enthalten |

**Empfohlene Reihenfolge:** D1 → D2 → D3 → D4 → D5 → D6a → D6b → **Test-Link 7** → P9a (neu aufgesetzt auf D5, Ladezustände mit den Bausteinen „Skelett“ und „Erneut laden“ aus D1/H16) → P9b → P10 (mit Abschlussschritt Nr. 7) → **Test-Link 1b** → E1 … E7 → F1 → F2 → F3a–e → F4 → F5.

Begründung:
1. Emrahs Entscheidung „Aussehen zuerst“.
2. P9a nach D5 heißt: Ladezustände werden einmal gebaut, gleich im neuen Aussehen, statt alte Bildschirme umzubauen, die D3 und D5 danach ersetzen.
3. P10 nach allen D-Paketen heißt: Es wird die fertige Hülle geteilt, nicht eine, die sich danach ändert.
4. Die E-Pakete nach P10 entstehen gleich als nachgeladene Stücke. So sind die Budget-Endwerte (A9) erreichbar, bevor die Bildschirme wachsen.

Risiko: Der Start-Knopf in ≤ 2 s (Kap. 14) wartet bis nach 1b. D2 darf den Einstieg nur um die genannten 8 KB vergrößern.

---

## 8. Abnahme durch Emrah am Handy (Test-Link 7, nach D6b)

1. In der Claude-App den Test-Link öffnen (den Link schickt die Hauptsitzung).
2. **Heute:** Oben steht groß „Heute“, darunter ein großer Ring. Den Ring antippen: Die Liste der heutigen Schritte klappt auf, ohne Knöpfe. Nochmal antippen klappt sie zu. Darunter stehen das Thema, „Als Nächstes …“ und **ein** Knopf „Los geht’s“. Unter dem Knopf: sieben Tageskreise mit deiner Serie und „Wenn du mehr willst“ mit höchstens drei Zeilen.
3. „Los geht’s“ tippen. **In der Übung:** Oben ein Balken, der in Abschnitte geteilt ist. Die Lücke ist eine Linie, kein Kasten. Absichtlich ein falsches Wort tippen und „Prüfen“: Von unten kommt ein Band mit „Noch nicht“, deiner Antwort, der richtigen Antwort und einem Satz „warum“. „Weiter“ tippen.
4. Oben rechts auf das Fragezeichen tippen. Von unten kommt ein Blatt mit den Reitern Claude, Übersetzen und Prüfen. Es darf **kein Fenster** sein, das man verschieben kann. Mit Wischen nach unten schließen.
5. **Reiter Wörter** (unten): Die Wortliste steht direkt da, darüber die Suche und Knöpfe wie „Bildest du selbst 38“. Die Zahlen sind deine echten. Ein Wort antippen: Die Wortkarte geht auf.
6. **Reiter Grammatik:** oben die Karte „Du bist hier“, darunter die Kapitel mit Nummern und Schlössern.
7. **Reiter Praxis:** Abschnitte Sprechen, Hören, Lesen, Lehrerin.
8. **Reiter Fortschritt:** Oben ist nur das Zahnrad. Darunter ein Satz zur C1-Schätzung (am Anfang ehrlich „noch zu wenig Belege“) und vier Kacheln. Wo es noch keine Messung gibt, steht „–“, **nie eine ausgedachte Zahl**.
9. In den Einstellungen (Zahnrad) einmal auf „Hell“ stellen und Heute ansehen, dann zurück auf „Dunkel“.

**Es stimmt, wenn** jeder Bildschirm so aussieht wie in der Vorschau, die du am 27.10. abgenommen hast, und alle Zahlen zu deinem Stand passen. **Wenn nicht:** Schick ein Bildschirmfoto mit einem Satz, was anders ist („Ring fehlt“, „Zahl falsch“).

---

## 9. Offene Fragen an Emrah (höchstens drei)

1. **Acht oder sieben Grammatik-Kapitel?** Die Vorschau und das Konzept (§8.2) zeigen 8 Kapitel, die App hat heute 7. Bis F2 zeigt die App „von 7“, weil das die echte Zahl ist. Soll F2 den Kurs auf die 8 Kapitel des Konzepts umbauen (Empfehlung: ja, wie abgenommen)?
2. **Namen der Wortstufen bis F1:** Bis die Stufen S1–S5 gebaut sind, stehen an den Wörtern die heutigen fünf Zustände (neu, lernt, wackelt, sicher, fest) in der Form der Vorschau-Abzeichen. Ist das in Ordnung, oder soll das Abzeichen bis F1 leer bleiben?
3. **Reihenfolge nach Test-Link 7:** Erst 1b (schnellerer Start, ~2–3 Pakete) und dann die übrigen Bildschirme, wie empfohlen? Oder erst die übrigen Bildschirme und 1b danach? Dann wächst die erste Datei weiter und der 2-Sekunden-Start rückt nach hinten.
