# Abnahme (P7-4): Kap. 14 und Kap. 15 → Test oder iPhone-Prüfpunkt

Stand 27.09.2026, Branch `claude/affectionate-cerf-pe6ej2`. „E2E" = Playwright gegen `dist/index.html` (390/1440/2560 px, drei Modi, DE/EN), „Unit" = Vitest. „iPhone" = Prüfpunkt für Emrah am Gerät (Safari/WebKit gibt es in der Cloud-Umgebung nicht, A7.4).

## Kap. 14 – Definition of Done

| Kriterium | Beleg |
|---|---|
| Alle Module aus Kap. 6 vorhanden und bedienbar | `acceptance.spec` (alle Reiter, Dein Stand mit vier Reitern, Wortschatztest, Einstellungen); je Modul die Specs `today`, `trainer`, `course`, `grammar`, `drills`, `speak`, `business`, `read`, `listen`, `write`, `discover`, `companion`, `preply`, `progress`, `vtest`, `settings` |
| Alle bisherigen Daten sichtbar und weitergeführt | `acceptance.spec` (Serie 12, Kurs 6, Karten 146 wie im Seed), `migration.spec`, Unit `migration`/`rescue` |
| Serie läuft weiter | Unit `streak` (Zeitmatrix), `capacity` (Serie vor/nach dem Auslagern an drei Zeitpunkten gleich), `migration` (`legacyStreak` = neue Serie) |
| Tagesauftrag funktioniert unverändert | `acceptance.spec` (`daily/*`, `feed/*` bytegleich, `newWords` werden Karten), Unit `dailyIntake`, Writer verweigert `daily/*`/`feed/*` (Unit `writer`) |
| Beim Öffnen in < 2 s klar, was heute dran ist | `perf.spec`: < 2 s ohne Drossel (Großdatensatz). **Befund:** mit 4-facher CPU-Drossel ≈ 3 s (Parsen des 2,5-MB-Bundles ≈ 1,1 s, Planaufbau über 1.500 Karten). Geprüft wird dort eine Regressionsgrenze von 4 s. **iPhone:** Emrah misst gefühlt beim Öffnen. |
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
| H6 Validierungs-Cache | offen – nicht Teil von Phase 6/7 umgesetzt (kein Befund in den Tests) |
| Testuhr nur für `Date` | bekannt: `page.clock` ersetzt auch `performance`; `perf.spec` misst deshalb ohne Testuhr |
| W1 Folgenummer beim Wiederholen | erledigt (persist D6, Unit `persist`) |
| W2 zwei Tabs | erledigt (Tab-Kennung D7, Unit `persist`); Einschätzung zusätzlich mit `acquire` (Unit `assess`) |
| W3 Puffer beim Schließen | erledigt (`installFlushOnHide`) |
| W5 Nachtragen-Hinweis auch auf Heute | offen – der Hinweis steht nur auf „Dein Stand" |
| W6 „nachts zählt der Vortag" erklären | Prozess: im Bericht an Emrah |
| W7 | nicht belegt, offen |
| W8 alle angesammelten `daily/*` | erledigt (`runDailyIntake`, Unit `dailyIntake`) |
| W9 `pflichtSince` nie rückwirkend | erledigt (Unit `pflicht`) |
