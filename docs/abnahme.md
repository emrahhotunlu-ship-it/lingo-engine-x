# Abnahme (P7-4): Kap. 14 und Kap. 15 → Test oder iPhone-Prüfpunkt

Stand 27.09.2026, Branch `claude/affectionate-cerf-pe6ej2`. „E2E" = Playwright gegen `dist/index.html` (390/1440/2560 px, drei Modi, DE/EN), „Unit" = Vitest. „iPhone" = Prüfpunkt für Emrah am Gerät (Safari/WebKit gibt es in der Cloud-Umgebung nicht, A7.4).

## Kap. 14 – Definition of Done

| Kriterium | Beleg |
|---|---|
| Alle Module aus Kap. 6 vorhanden und bedienbar | `acceptance.spec` (alle Reiter, Dein Stand mit vier Reitern, Wortschatztest, Einstellungen); je Modul die Specs `today`, `trainer`, `course`, `grammar`, `drills`, `speak`, `business`, `read`, `listen`, `write`, `discover`, `companion`, `preply`, `progress`, `vtest`, `settings` |
| Alle bisherigen Daten sichtbar und weitergeführt | `acceptance.spec` (Serie 12, Kurs 6, Karten 146 wie im Seed), `migration.spec`, Unit `migration`/`rescue`; Wendungen `chunk/*` in Wortschatzliste und täglicher Wiederholung (Unit `chunkTrainer`, `trainerModes.spec`); alte Wochen-Checks (`profile.checks[]`) und „Letzte Fortschritte“ (`profile.feed[]`) im Verlauf (`stand-gaps.spec`, Unit `standGaps`) |
| Serie läuft weiter | Unit `streak` (Zeitmatrix), `capacity` (Serie vor/nach dem Auslagern an drei Zeitpunkten gleich), `migration` (`legacyStreak` = neue Serie) |
| Tagesauftrag funktioniert unverändert | `acceptance.spec` (`daily/*`, `feed/*` bytegleich, `newWords` werden Karten), Unit `dailyIntake`, Writer verweigert `daily/*`/`feed/*` (Unit `writer`) |
| Beim Öffnen in < 2 s klar, was heute dran ist | `perf.spec`: < 2 s ohne Drossel (Großdatensatz). **Befund:** mit 4-facher CPU-Drossel ≈ 3 s (Parsen des 2,5-MB-Bundles ≈ 1,1 s, Planaufbau über 1.500 Karten). Geprüft wird dort eine Regressionsgrenze von 4 s. **iPhone:** Emrah misst gefühlt beim Öffnen. |
| Tippen in die Lücke wie nativ | `perf.spec` (keine Blockade > 100 ms bei 20 Anschlägen unter 4×, p95 Bildabstand < 20 ms), `trainer.spec` (Buchstaben landen in der Lücke); Lücke und Prüfen-Knopf rollen über die Tastatur (`visualViewport`, für jede Lücke im `HiddenInput`): Unit `standGaps`, `stand-gaps.spec` mit nachgebildetem `visualViewport`. **iPhone:** Tastatur öffnet zuverlässig, Satz und Prüfen-Knopf bleiben sichtbar (Chromium hat keine echte Bildschirmtastatur). |
| Beim Öffnen in < 2 s klar, was heute dran ist | `perf.spec`: < 2 s ohne Drossel (Großdatensatz, 1.500 Karten); Messpunkte `lx:boot` → `lx:live` → `lx:status`. **Stand 27.09. (Startpfad-Paket):** Satzstelle je Karte nur einmal gesucht (Zwischenspeicher am Dokument), Regex-Vorfilter, Sprint-Ablenker linear statt quadratisch, Validierungs-Cache (H6). A/B-Messung gegen den Stand davor, 4-fache CPU-Drossel, je 6 Läufe, Median (unter Parallellast anderer Helfer): erster Start des Tages 3,15 s → 2,71 s, Plan von heute vorhanden 3,01 s → 2,72 s. **Befund (ehrlich):** mit 4-facher Drossel weiter ≈ 2,7 s. Den größten Rest stellt das Laden und Auswerten des 2,3-MB-Skripts (≈ 1,1–1,5 s bis `lx:boot`, eine Datei – keine Code-Aufteilung möglich) und das Prüfen aller Karten beim ersten Laden (≈ 0,4 s bis `lx:live`). Ohne Drossel ≈ 0,9–1,5 s. Die Regressionsgrenze mit Drossel bleibt 4 s (unter Last der Cloud-Umgebung streuen die Werte bis ≈ 4 s; eine engere Zeitgrenze wäre wackelig). Verschärft wurde stattdessen, was sich ohne Streuung prüfen lässt: Reihenfolge der Messpunkte und H6 (siehe unten). **iPhone:** Emrah misst gefühlt beim Öffnen. |
| Tippen in die Lücke wie nativ | `perf.spec` (keine Blockade > 100 ms bei 20 Anschlägen unter 4×, p95 Bildabstand < 20 ms), `trainer.spec` (Buchstaben landen in der Lücke). **iPhone:** Tastatur öffnet zuverlässig, Satz bleibt sichtbar. |
| Alle Tests grün auf Handy und Desktop, alle Modi, beide Sprachen | `screens.spec` (Matrix inkl. `stand6-*`), `a11y.spec`, `npm run verify` |
| Keine laufenden Kosten | `platform.spec`, `check:platform` (nichts wird extern geladen, kein Adapter im Build) |

## Kap. 15 – Fehler des Vorgängers

| Fehler | Beleg |
|---|---|
| Tagesplan würfelt sich neu | Unit `planPhase2` (50× gleich), `phase6Plan` (gleiche Eingabe = gleiches Ergebnis, Plan von heute bleibt trotz neuer Einschätzung), `weighting.spec` (Neuzeichnen und gespeicherter Plan) |
| Erledigte Aufgaben anklickbar | `today-duties.spec`, `acceptance.spec` |
| Zähler zählt Freiwilliges als Pflicht | `today-duties.spec`, Unit `phase6Plan` (Zähler 0→3 nur mit Pflichtpunkten), `acceptance.spec` |
| Dasselbe dreimal auf einem Bildschirm | `acceptance.spec` (Duplikat-Wächter je Hauptbildschirm und Reiter; Ausnahmen: Tabellen, Optionen, Can-Do-Liste) |
| Neue Wörter fehlen an Tagen mit Wiederholungen | Unit `review`/`trainer` (Mischung neu + fällig); Wendungen laufen durch dieselbe Budget-Regel (Unit `chunkTrainer` › Planung) |
| Jede Lernstufe nur eine Abfrageart | Katalog mit 14 Arten (phase1-plan §4.2 + „Aus der Situation“): Unit `chunkTrainer` (je Stufe 1–5 mindestens zwei eigene Arten; Stufe 0–5 mindestens zwei auch ohne Sprachausgabe und ohne KI, für Vokabeln und Wendungen, DE und EN; Stufe 5 mit `produce`, ohne KI Rückfall), `trainerModes.spec` (spot, listen_mc, match, tiles, dictation, speed, produce je einmal am Handy 390 mit Touch; Tempo-Ablauf; `produce` mit KI-Fehler → „Ohne Claude prüfen“; nosample), `trainer.spec`, Unit `trainer` |
| Eingabe unter statt in der Lücke | `trainer.spec`, `drills.spec`, `vtest.spec` (Teil 3 tippt in die Lücke) |
| Gemischte Sprache in gespeicherten KI-Texten | Unit `langSweep` (alle Datensätze inkl. `app/assess`, `app/weekly`, `app/lookup`, `xEx`), Schemas prüfen Sprache (`langOf`), `progress.spec` (EN-Oberfläche + DE-Einschätzung → genau ein neuer Lauf) |
| Dunkelmodus nie gestaltet | Unit `contrast`, `screens.spec` (Hintergrund je Modus), `a11y.spec` in allen Modi |
| Chat als schmale Seitenleiste, springt beim Lesen | `companion.spec` |
| Wörter in neuen Übungen nicht antippbar | Specs je Modul; Phase 6: Blocker-„So geht es richtig" und Radar-Beispiele über `EnglishText`; neue Abfragearten: `trainerModes.spec` (antippbare Wörter im Ergebnis je Art) |
| Karten ohne Ursprungssatz | Unit `lookupStore`, `speak.spec`/`read.spec` (Karte mit Satz); Wendungen: Kontext = Stelle in der aufgewerteten Fassung (Unit `chunkTrainer`, alle Seed-Wendungen) |
| Tests nur mit heutigem Datensatz | Zeitmatrix in Unit `date`, `streak`, `progress6` (04:00, Sommerzeit-Ende, 2026-W53), `capacity` |
| Stille Fehler durch leere `catch` | ESLint `no-empty` (in `npm run verify`) |
| Sprachausgabe am Handy abgehackt | Unit `speechChunks` (≤ 150 Zeichen, 60 ms nach `cancel`). **iPhone:** Vorlesen im Rollenspiel |
| Über die laufende App veröffentlichen | Prozess: CLAUDE.md A3/A7 – nur Test-Artefakt, Produktivadresse erst nach Emrahs OK (P7-5, Hauptprozess) |

## Offene Hinweise aus A7 („MVP produktiv")

| Hinweis | Stand |
|---|---|
| H3 Fehlerzustand `log/<heute>` | erledigt: `startDayLive` meldet, Heute läuft mit leerer Bilanz weiter (`data/live.ts`) |
| H5 `visualViewport` | umgesetzt für Chat und Eingabefelder (`ui/chat/keyboard.ts`, `DraftArea`) und seit dem Lücken-Paket für jede Lücke (`useKeepGapVisible` im `HiddenInput`: Lücke und Prüfen-Knopf über der Tastatur; Unit `standGaps`, `stand-gaps.spec`); **iPhone-Prüfpunkt** am Gerät |
| H6 Validierungs-Cache | offen – nicht Teil von Phase 6/7 umgesetzt (kein Befund in den Tests) |
| H5 `visualViewport` | umgesetzt für Chat und Eingabefelder (`ui/chat/keyboard.ts`, `DraftArea`); **iPhone-Prüfpunkt** für die Lücke |
| H6 Validierungs-Cache | erledigt: `data/validate.ts` `validateCached` (je Dokument-Objekt und Pfad nur einmal mit zod geprüft; die Laufzeit liefert unveränderte Dokumente als dasselbe Objekt), genutzt von Live-Abos, Beobachtern und Lesen. Messbar: `validationStats()` und die Marke `lx:validated:<Sammlung>`. Unit `validateCache` (1.500 Karten: eine geänderte Karte → 1 echte Prüfung, Rest Treffer, gleiche Referenzen), E2E `perf.spec` „H6“ (Großdatensatz: nach einer Änderung genau 1 Prüfung) |
| Testuhr nur für `Date` | bekannt: `page.clock` ersetzt auch `performance`; `perf.spec` misst deshalb ohne Testuhr |
| W1 Folgenummer beim Wiederholen | erledigt (persist D6, Unit `persist`) |
| W2 zwei Tabs | erledigt (Tab-Kennung D7, Unit `persist`); Einschätzung zusätzlich mit `acquire` (Unit `assess`) |
| W3 Puffer beim Schließen | erledigt (`installFlushOnHide`) |
| W5 Nachtragen-Hinweis auch auf Heute | erledigt: leise Textzeile unten auf Heute (keine Karte, kein Primärknopf), führt zu „Dein Stand" (`LateRescueHint`, `stand-gaps.spec`, `screens.spec` `neu-*`) |
| W6 „nachts zählt der Vortag" erklären | Prozess: im Bericht an Emrah |
| W7 | nicht belegt, offen |
| W8 alle angesammelten `daily/*` | erledigt (`runDailyIntake`, Unit `dailyIntake`) |
| W9 `pflichtSince` nie rückwirkend | erledigt (Unit `pflicht`) |

## Wendungs-Wiederholung und Abfragearten (27.09.2026)

| Punkt | Stand |
|---|---|
| `chunk/*` mit FSRS wie Vokabeln | umgesetzt: `domain/srs/chunkCards.ts` liest S/D/due/last/state/stage der alten App, `fsrs` kommt beim ersten Schreiben zusätzlich (`chunkPatch`, strenges `chunkPatchSchema`, nie angelegt, keine `pa`/`ac`/`co`); Protokoll im Format der alten App (`type:'chunk'`, `q`), zählt zu „Wiederholen“ (`entryCardKey`) |
| Pflicht- und Extra-Runde, Tagesplan | Wendungen stehen in `planRound`/`buildQueue` (Heute-Plan und Trainer); Stapel „Wendungen“ der freien Runde nimmt `chunk/*` mit |
| Aus der Situation (M15) | als Abfrageart `situation` (Stufe 4, nur Wendungen mit Szene) im Trainer, mit „Damals hattest du gesagt“; die Übungsrunde in Sprechen bleibt |
| Wendungen aus Mail/Pitch/Baukasten | Karten wie Szenen-Wendungen (Ursprung „E-Mail“, „Präsentation“, „Baukasten“), ohne Situationsübung |
| **iPhone-Prüfpunkt** | Hören (`listen_mc`, `dictation`) spielt beim Einblenden automatisch; blockiert Safari das ohne Tippen, hilft „Nochmal hören“. Bitte am Gerät prüfen. |
| offen (Plan §4.5 „neu“) | Blutegel-Grenze (≤ 3 Karten mit `lapses ≥ 4` je Pflichtrunde) und Verschachtelung nach `topicKey` sind nicht umgesetzt; Heute gewichtet die Kanäle weiter nur mit Vokabeln (`dueCards` im Ranking) |
| offen | „Eigener Satz“ ohne Claude erkennt unregelmäßige Formen von Wendungen nicht immer (z. B. „met … halfway“); mit Claude kein Problem |

## Lücken aus dem Abgleich (Funktionsabgleich, 27.09.2026)

| Punkt | Stand und Beleg |
|---|---|
| M7 Wochenstreifen + Niveau-Leiste | Kopfzeile von „Dein Stand": 7 Tagesringe Mo–So (Pflicht erledigt · Ruhetag · offen · kommt noch) mit derselben Regel wie die Serie (`weekStrip` in `domain/streak.ts`), Form + Zeichen + Vorlesetext statt nur Farbe; Skala B1 … C1+ mit Punkt und Band der Belastbarkeit (`domain/assessment/levelBar.ts`). Unit `standGaps`, `stand-gaps.spec`, `screens.spec`/`a11y.spec` (Tour „Dein Stand") |
| M10 Wochen-Check | 12 gemischte Aufgaben ohne Tipps (5 Wörter, 2 Wendungen/Kollokationen, 5 Grammatik) aus den vorhandenen Bausteinen (`ExerciseView`/`GrammarItem` mit `noHelp`), Extra, höchstens einmal je Kalenderwoche, Antworten `ctx:'xtra'`, Rundenende `act:'check'` – zählt nie als Pflicht; heute fällige Karten werden nach hinten gestellt. Ergebnis im Format der alten App in `profile.checks[]` (angehängt, bestehende Einträge unverändert; über 20 fällt wie in der alten App der älteste heraus), Vergleich mit dem letzten Check, Beleg `v:check` für die Einschätzung. Angebot im Verlauf und nach der Pflicht auf Heute (ab 40 Antworten). Unit `standGaps`, `stand-gaps.spec`, `screens.spec` `neu-*`, `a11y.spec`. **Offen:** Wendungen aus `chunk/*` kommen erst mit der Wendungs-Wiederholung dazu (paralleles Paket) |
| M13 Ladepunkt am Reiter | ruhiger Punkt mit Vorlesetext am Reiter der laufenden KI-Korrektur (`runningTabs`); Unit `standGaps`, `stand-gaps.spec` |
| M18 „Als Preply-Stunde" | eingesetzt bei Lesen (Text), Entdecken (Beitrag), Regelblatt, Szene (Einweisung und Auswertung) und Wochenbericht; `stand-gaps.spec` (Regelblatt und Wochenbericht bis zum Anlass „Zu: …") |
| M20 „Was ist neu" | schmale, schließbare Zeile oben (kein Blatt, kein Fokusraub), Merker `lx:whats-new` nur im Browser; `stand-gaps.spec`, `screens.spec` `neu-*` |
| M21 Farbthemen | Salbei (Standard) · Ozean · Pflaume · Graphit über `profile.theme.p` (altes Format, `theme.m` bleibt), Akzent-Tokens je Modus in `styles/index.css`; Unit `contrast` (jeder Satz in jedem Modus), `stand-gaps.spec`, `a11y.spec` |
| M22 Beruflicher Kontext | Feld in den Einstellungen (≤ 400 Zeichen, `profile.ctx`, gelesen von `prompts/work.ts`); Unit `standGaps`, `stand-gaps.spec` |
## Ergänzungen 27.09. (Engine-Paket: Kap. 4.3–4.5, 6.2, 6.5)

| Anforderung | Beleg |
|---|---|
| 6.5 Szenen „Preisverhandlung“ und „Partner-Pitch“ | feste Szenen `sc-price`, `sc-pitch` in `content/speak/scenes.json` (Format wie `scene/<id>`, zweisprachig, Cloud-DMS/E-Rechnung), überlagert von `scene/<id>`; Unit `fixedScenes`, E2E `speak.spec` (acht Karten, Einweisung, Gespräch, `scene/sc-price` aus dem Inhalt angelegt) |
| 6.2 Kurs erweiterbar | Vorlage `course-extend@1` (zod, tolerant: Themenname → ID, Wortpaare, Stufe B1+/C2 eingeordnet, eine kaputte Lektion fällt weg), Eingaben aus Einschätzung und Fehlerradar (`domain/course/extendInput.ts`); vier Lektionen ab l25 als neue Einheit, gespeichert nur neu (`createIfMissing`) in `lesson/<lid>` mit Lehrplan `plan`, Inhalt wie bisher per „Lektion vorbereiten“, Abschluss in `app/course.done`. Angebot deutlich, wenn alles erledigt ist, sonst ruhig „auf Wunsch“; nie, solange eine erweiterte Lektion offen ist. Unit `courseExtend`, E2E `courseExtend.spec` (alle 24 erledigt → l25–l28 als Einheit 7, l25 ist die nächste und vorbereitbar, alte Lektionen unverändert; KI-Fehler → „Erneut versuchen“, nichts gespeichert) |
| 4.5 Wischgesten | nach der Rückmeldung nach links wischen = „Weiter“ (`engine/swipe.ts`, nur Touch, nie aus Lücke/Eingabefeld/Dialog/Bildschirmrand, senkrecht = Bildlauf); Blätter am Handy am Griff nach unten wischen = schließen (`ui/sheetDrag.tsx`, `touch-action: none` nur am Griff, Inhalt scrollt weiter). Unit `swipe`, E2E `gestures.spec`. **iPhone:** Wischen fühlt sich natürlich an und kollidiert nicht mit dem Scrollen |
| 4.3 Vibration | `verdictHaptic` in Lücke, Auswahl und Ergebniszeile, eine Vibration je Prüfen; Einstellung „Vibration“ (`app/profile.haptic`, Standard an); ohne `navigator.vibrate` (iPhone) Hinweis statt Schalter, rein sichtbar. Unit `haptics`, E2E `haptics.spec` |
| 4.4 Übergänge mit gemeinsamen Elementen | Heldenkarte → erste Übung (Trainer, Grammatik, Übungen), Kurszeile → Kopf der Lektion: Flug per framer `animate` (FLIP), Wortzeile → Titel des Wortblatts: framer `layoutId` (`engine/shared.tsx`, ≈ 250 ms, `prefers-reduced-motion` → keine Bewegung). Befund: framer `layoutId` über den Bildschirmwechsel (`AnimatePresence mode="wait"`) flog in etwa jedem zehnten Lauf nicht – deshalb dort die eigene Messung beim Tippen. Unit `shared`, E2E `transitions.spec` (je 8 Wiederholungen unter Last grün). **iPhone:** Flüssigkeit (60 fps) am Gerät |

