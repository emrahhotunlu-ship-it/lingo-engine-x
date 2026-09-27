# Abnahme (P7-4): Kap. 14 und Kap. 15 → Test oder iPhone-Prüfpunkt

Stand 27.09.2026, Branch `claude/affectionate-cerf-pe6ej2`. „E2E" = Playwright gegen `dist/index.html` (390/1440/2560 px, drei Modi, DE/EN), „Unit" = Vitest. „iPhone" = Prüfpunkt für Emrah am Gerät (Safari/WebKit gibt es in der Cloud-Umgebung nicht, A7.4).

## Kap. 14 – Definition of Done

| Kriterium | Beleg |
|---|---|
| Alle Module aus Kap. 6 vorhanden und bedienbar | `acceptance.spec` (alle Reiter, Dein Stand mit vier Reitern, Wortschatztest, Einstellungen); je Modul die Specs `today`, `trainer`, `course`, `grammar`, `drills`, `speak`, `business`, `read`, `listen`, `write`, `discover`, `companion`, `preply`, `progress`, `vtest`, `settings` |
| Alle bisherigen Daten sichtbar und weitergeführt | `acceptance.spec` (Serie 12, Kurs 6, Karten 146 wie im Seed), `migration.spec`, Unit `migration`/`rescue` |
| Serie läuft weiter | Unit `streak` (Zeitmatrix), `capacity` (Serie vor/nach dem Auslagern an drei Zeitpunkten gleich), `migration` (`legacyStreak` = neue Serie) |
| Tagesauftrag funktioniert unverändert | `acceptance.spec` (`daily/*`, `feed/*` bytegleich, `newWords` werden Karten), Unit `dailyIntake`, Writer verweigert `daily/*`/`feed/*` (Unit `writer`) |
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
| Neue Wörter fehlen an Tagen mit Wiederholungen | Unit `review`/`trainer` (Mischung neu + fällig) |
| Jede Lernstufe nur eine Abfrageart | `trainer.spec` (alle Abfragearten), Unit `trainer` |
| Eingabe unter statt in der Lücke | `trainer.spec`, `drills.spec`, `vtest.spec` (Teil 3 tippt in die Lücke) |
| Gemischte Sprache in gespeicherten KI-Texten | Unit `langSweep` (alle Datensätze inkl. `app/assess`, `app/weekly`, `app/lookup`, `xEx`), Schemas prüfen Sprache (`langOf`), `progress.spec` (EN-Oberfläche + DE-Einschätzung → genau ein neuer Lauf) |
| Dunkelmodus nie gestaltet | Unit `contrast`, `screens.spec` (Hintergrund je Modus), `a11y.spec` in allen Modi |
| Chat als schmale Seitenleiste, springt beim Lesen | `companion.spec` |
| Wörter in neuen Übungen nicht antippbar | Specs je Modul; Phase 6: Blocker-„So geht es richtig" und Radar-Beispiele über `EnglishText` |
| Karten ohne Ursprungssatz | Unit `lookupStore`, `speak.spec`/`read.spec` (Karte mit Satz) |
| Tests nur mit heutigem Datensatz | Zeitmatrix in Unit `date`, `streak`, `progress6` (04:00, Sommerzeit-Ende, 2026-W53), `capacity` |
| Stille Fehler durch leere `catch` | ESLint `no-empty` (in `npm run verify`) |
| Sprachausgabe am Handy abgehackt | Unit `speechChunks` (≤ 150 Zeichen, 60 ms nach `cancel`). **iPhone:** Vorlesen im Rollenspiel |
| Über die laufende App veröffentlichen | Prozess: CLAUDE.md A3/A7 – nur Test-Artefakt, Produktivadresse erst nach Emrahs OK (P7-5, Hauptprozess) |

## Offene Hinweise aus A7 („MVP produktiv")

| Hinweis | Stand |
|---|---|
| H3 Fehlerzustand `log/<heute>` | erledigt: `startDayLive` meldet, Heute läuft mit leerer Bilanz weiter (`data/live.ts`) |
| H5 `visualViewport` | umgesetzt für Chat und Eingabefelder (`ui/chat/keyboard.ts`, `DraftArea`); **iPhone-Prüfpunkt** für die Lücke |
| H6 Validierungs-Cache | erledigt: `data/validate.ts` `validateCached` (je Dokument-Objekt und Pfad nur einmal mit zod geprüft; die Laufzeit liefert unveränderte Dokumente als dasselbe Objekt), genutzt von Live-Abos, Beobachtern und Lesen. Messbar: `validationStats()` und die Marke `lx:validated:<Sammlung>`. Unit `validateCache` (1.500 Karten: eine geänderte Karte → 1 echte Prüfung, Rest Treffer, gleiche Referenzen), E2E `perf.spec` „H6“ (Großdatensatz: nach einer Änderung genau 1 Prüfung) |
| Testuhr nur für `Date` | bekannt: `page.clock` ersetzt auch `performance`; `perf.spec` misst deshalb ohne Testuhr |
| W1 Folgenummer beim Wiederholen | erledigt (persist D6, Unit `persist`) |
| W2 zwei Tabs | erledigt (Tab-Kennung D7, Unit `persist`); Einschätzung zusätzlich mit `acquire` (Unit `assess`) |
| W3 Puffer beim Schließen | erledigt (`installFlushOnHide`) |
| W5 Nachtragen-Hinweis auch auf Heute | offen – der Hinweis steht nur auf „Dein Stand" |
| W6 „nachts zählt der Vortag" erklären | Prozess: im Bericht an Emrah |
| W7 | nicht belegt, offen |
| W8 alle angesammelten `daily/*` | erledigt (`runDailyIntake`, Unit `dailyIntake`) |
| W9 `pflichtSince` nie rückwirkend | erledigt (Unit `pflicht`) |

## Ergänzungen 27.09. (Engine-Paket: Kap. 4.3–4.5, 6.2, 6.5)

| Anforderung | Beleg |
|---|---|
| 6.5 Szenen „Preisverhandlung“ und „Partner-Pitch“ | feste Szenen `sc-price`, `sc-pitch` in `content/speak/scenes.json` (Format wie `scene/<id>`, zweisprachig, Cloud-DMS/E-Rechnung), überlagert von `scene/<id>`; Unit `fixedScenes`, E2E `speak.spec` (acht Karten, Einweisung, Gespräch, `scene/sc-price` aus dem Inhalt angelegt) |
| 6.2 Kurs erweiterbar | Vorlage `course-extend@1` (zod, tolerant: Themenname → ID, Wortpaare, Stufe B1+/C2 eingeordnet, eine kaputte Lektion fällt weg), Eingaben aus Einschätzung und Fehlerradar (`domain/course/extendInput.ts`); vier Lektionen ab l25 als neue Einheit, gespeichert nur neu (`createIfMissing`) in `lesson/<lid>` mit Lehrplan `plan`, Inhalt wie bisher per „Lektion vorbereiten“, Abschluss in `app/course.done`. Angebot deutlich, wenn alles erledigt ist, sonst ruhig „auf Wunsch“; nie, solange eine erweiterte Lektion offen ist. Unit `courseExtend`, E2E `courseExtend.spec` (alle 24 erledigt → l25–l28 als Einheit 7, l25 ist die nächste und vorbereitbar, alte Lektionen unverändert; KI-Fehler → „Erneut versuchen“, nichts gespeichert) |
| 4.5 Wischgesten | nach der Rückmeldung nach links wischen = „Weiter“ (`engine/swipe.ts`, nur Touch, nie aus Lücke/Eingabefeld/Dialog/Bildschirmrand, senkrecht = Bildlauf); Blätter am Handy am Griff nach unten wischen = schließen (`ui/sheetDrag.tsx`, `touch-action: none` nur am Griff, Inhalt scrollt weiter). Unit `swipe`, E2E `gestures.spec`. **iPhone:** Wischen fühlt sich natürlich an und kollidiert nicht mit dem Scrollen |
| 4.3 Vibration | `verdictHaptic` in Lücke, Auswahl und Ergebniszeile, eine Vibration je Prüfen; Einstellung „Vibration“ (`app/profile.haptic`, Standard an); ohne `navigator.vibrate` (iPhone) Hinweis statt Schalter, rein sichtbar. Unit `haptics`, E2E `haptics.spec` |
| 4.4 Übergänge mit gemeinsamen Elementen | Heldenkarte → erste Übung (Trainer, Grammatik, Übungen), Kurszeile → Kopf der Lektion: Flug per framer `animate` (FLIP), Wortzeile → Titel des Wortblatts: framer `layoutId` (`engine/shared.tsx`, ≈ 250 ms, `prefers-reduced-motion` → keine Bewegung). Befund: framer `layoutId` über den Bildschirmwechsel (`AnimatePresence mode="wait"`) flog in etwa jedem zehnten Lauf nicht – deshalb dort die eigene Messung beim Tippen. Unit `shared`, E2E `transitions.spec` (je 8 Wiederholungen unter Last grün). **iPhone:** Flüssigkeit (60 fps) am Gerät |

