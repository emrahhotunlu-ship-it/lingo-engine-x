# Inventur: alle Funktionen der heutigen App (Stand 27.09.2026, Commit `e4997fb`)

Zweck: Grundlage für den Neubau der Oberfläche. **Keine Funktion darf verloren gehen** (Emrahs Urteil zum Prototyp v1: „viel zu dünn von den Features“, CLAUDE.md A7 „Neuansatz“).

**Quellen (nur gelesen):** `src/app/*`, alle Ordner `src/features/*`, `src/i18n/parts/*` und `src/i18n/de.ts`, `src/prompts/*`, `src/domain/*`, `src/data/paths.ts`, `docs/altapp-funktionsabgleich.md`, `docs/auftrag.md` Kap. 6–7, `docs/abnahme.md`, `docs/konzept/briefing.md`, CLAUDE.md A7, E2E-Specs unter `tests/e2e/`.

## Legende

- **Pfad-Kürzel:** `f/` = `src/features/`, `d/` = `src/domain/`, `p/` = `src/prompts/` (KI-Vorlage, Kennung `@Version`), `e/` = `src/engine/`, `ui/` = `src/ui/`, `app/` = `src/app/`.
- **Einstieg:** Ort in der App und **Zahl der Tipps ab „Heute“** (Reiterwechsel = 1 Tipp). „Übungsleiste“ = Vollbild ohne Reiterleiste mit Schließen, Übersetzer, Claude, Zahnrad.
- **Daten:** Dokumentpfade in `db`. `<Monat>` = `JJJJ-MM`, `<tag>` = Lerntag `JJJJ-MM-TT` (Wechsel 04:00).
- **Zustand:** *fertig* = gebaut, in einer E2E-Spec abgedeckt (Name in Klammern) · *halb* = gebaut, aber abgeschaltet, unvollständig oder widersprüchlich · *kaputt* = laut Emrah oder Code fehlerhaft · *iPhone* = nur am Gerät prüfbar (Cloud hat nur Chromium).
- **★** = von Emrah ausdrücklich gewünscht (A7, seine App-Kommentare, Funktionsgleichheit „nicht schlechter als die alte App“ = M-Nummern aus `docs/altapp-funktionsabgleich.md`).
- **✗** = von Emrah kritisiert (A7 „Neuansatz“ 27.09. spätabends, `docs/konzept/briefing.md`, A7 18:15 Uhr).

---

## 1. Heutige Navigationsstruktur

### 1.1 Registrierung
| Baustein | Datei | Wie es funktioniert |
|---|---|---|
| Router | `app/nav.ts` | Eigener Zustand (`zustand`) `useNav {route, stack, scroll}`, **kein** Router, keine History-API (iframe teilt den Verlauf mit claude.ai). `Route` ist eine Union aus **29 Routennamen**. `go(route)` legt die aktuelle Route auf den Herkunftsstapel (max. 20); Reiter-Startseiten leeren den Stapel; Übung → Übung ersetzt (eine beendete Übung ist nie Rückweg). `back()` = Herkunft, sonst Reiter-Startseite, sonst Heute. `leaveBack()` verhindert doppeltes Zurück. `SCROLL_KEEP` merkt die Bildlaufposition von 8 Listen. |
| Reiter-Zuordnung | `app/nav.ts` `tabOf`, `TAB_ROOTS`, `EXERCISES` | 4 Reiter `today · learn · speak · overview`. `EXERCISES` (12 Routen: trainer, lesson, grammarSession, drill, say, roleplay, check, vtest, read, listen, write, discoverItem) = Vollbild mit Übungsleiste. `fluency`, `meeting`, `patterns`, `tones` gehören zu keinem Reiter und sind keine Übung (Vollbild ohne Reiterleiste). |
| Bildschirmwahl | `app/App.tsx` `useScreen` + großes `{screen === … && <X/>}` | Vor den Routen: `loading` (Skelett), `nodb`, `offline`, `migration` (solange `app/schema.version < 1`). Danach 28 Einzelzuweisungen plus `InputRoutes` für read/listen/write/discover/discoverItem/history. Wechsel blendet nur ein (kein `AnimatePresence mode="wait"`). **Keine Fehlergrenze (Error Boundary) in der ganzen App.** |
| Reiterleiste | `app/App.tsx` `TabBar` | Handy unten, Desktop oben als Pille. Zahl offener Pflichtpunkte an „Heute“, Ladepunkt an dem Reiter, in dem eine KI-Korrektur im Hintergrund läuft (`f/input/aiTasks.ts` `runningTabs`). |
| Module als Daten | `app/modules.ts` | Nur die 4 Input-Module (Lesen, Hören, Schreiben, Entdecken) mit Route und Verlaufsroute. Von `LearnHub` und `f/progress/actionRoute.ts` gelesen. |
| Blätter | `app/sheets.ts` | Nur das Einstellungsblatt (`useSettingsSheet`). Alle anderen Blätter sind lokaler Zustand ihres Bildschirms. |
| Einstellungen/Profil | `app/settings.ts`, `app/actions.ts` | Sprache, Modus, Farbthema lokal + `app/profile`; optimistische Änderung mit Rückrollen (goalMin, newPerDay, sound, haptic, autoNext, ctx, canDo). |
| Uhr | `app/clock.ts` | `useClock {now, today}`, Tick; Lerntag wechselt um 04:00. |
| Aktions-Sprünge | `f/progress/actionRoute.ts` | Übersetzt Aktionen der Einschätzung (`vocab:review`, `write`, `business:email` …, Grammatikthema, Lektion) in Routen. |
| Start-Kopplung | `f/learn/flow.ts` `startDuty`, sowie Heute/Üben | Übungen werden **vor** `go()` gestartet (`startSession`, `startGrammar`, `startDrill`, `startCheck`), dann wird `HiddenInput` fokussiert (Tastatur am iPhone). |

### 1.2 Reiter und Hubs
| Reiter | Startseite (Datei) | Inhalt von oben nach unten | Unterseiten |
|---|---|---|---|
| **Heute** | `f/today/TodayScreen.tsx` | Titel mit Status („Heute · 1 von 3“ / „Fertig für heute“), Datum · Pflichtminuten · Serie; Pflichtliste (erster offener Punkt als Hero mit „Starten“); erledigte Punkte als Zustand; nach der Pflicht: „Als Nächstes lohnt sich“ (1 Angebot), „Freie Runde Vokabeln“, Wochen-Check-Angebot, „Mehr üben“; Tagesbilanz; Preply-Extra-Zeile; Nachtragen-Hinweis; Speicherfehler | – (alles startet Übungen) |
| **Üben** | `f/learn/LearnHub.tsx` | Kurs-Karte (Fortschritt, nächste Lektion, „Alle Lektionen“); Liste Wortschatz · Freie Runde · Grammatik; Kurzübungen (4 Kacheln); Lesen · Hören · Schreiben · Sag es; Entdecken | `course`, `vocab`, `grammar` → `wissen`, `discover`, `history` |
| **Sprechen** | `f/speak/SpeakHub.tsx` | Status „Heute offen · ein Gespräch mit ≥ 4 Zügen“; Umschalter **Szenen · Business · Preply**. Szenen: Szenenliste, „Neue Szene“, unvollständige Szenen (zugeklappt), „Wendungen aus deinen Szenen“, **Training** (Mein nächster Termin, Flüssigkeit, Drei Tonlagen). Business: 3 Werkzeuge. Preply: Reiter Vorbereiten · Übernehmen · Verlauf | `mail`, `playbook`, `pitch`, `fluency`, `meeting`, `tones` |
| **Stand** | `f/progress/ProgressScreen.tsx` | Kopfkarte (Serie · Kurs · Wörter, Wochenstreifen, Niveau-Skala); Reparatur-Zeile; Deutsch-Fallen-Karte; Nachtragen-Karte; Reiter **Urteil · Fehler · Ziel C1 · Verlauf** (Verlauf: Wochen-Check, Wortschatztest, Wochenbericht, 5 zugeklappte Bereiche) | `patterns`, `vtest`, `check` |

### 1.3 Überall erreichbar (Blätter und Ebenen)
| Ebene | Datei | Öffnen |
|---|---|---|
| Titel-Aktionen Übersetzer · Claude · Zahnrad | `f/system/Chrome.tsx` (`TitleActions`, `ExerciseActions`) | auf jeder Reiter-Titelzeile und in jeder Übungsleiste ★ (Paket 2, Emrahs Kommentar) |
| Claude-Begleiter (Fragen / Übersetzen) | `f/companion/CompanionOverlay.tsx` | Claude-Symbol, Übersetzer-Symbol, Taste `/`, „Claude fragen“ im Wort-Popover |
| Wort-Popover | `f/lookup/LookupPopover.tsx` (`LookupLayer` in `App.tsx`) | Tipp auf jedes englische Wort (`e/EnglishText.tsx`, `e/wordTap.ts`) |
| Einstellungen | `f/settings/SettingsSheet.tsx` | Zahnrad |
| KI-Hinweis „Korrektur fertig · Ansehen“ | `f/input/AiTaskNotice.tsx` | automatisch |
| Toasts | `ui/Toast.tsx` | automatisch |
| Lokale Blätter | `f/grammar/GrammarScreen.tsx` `TopicSheet`, `f/vocab/list/WordSheet.tsx`, `AddWordSheet.tsx`, `f/vocab/FreeRoundSheet.tsx`, `f/speak/SceneBriefing.tsx`, `SceneCreateSheet.tsx`, `f/preply/HeldSheet.tsx` | aus dem jeweiligen Bildschirm |

### 1.4 Rückwege
- Unterseiten: `ScreenHeader` mit Zurück-Pfeil (`f/learn/ui.tsx`) → `useNav.back()` = Herkunft.
- Übungen: Schließen in `ExerciseTop`/`RoundTop` → `leaveBack` zur Herkunft; Pflichtrunden zeigen oben „Pflicht 2 von 3“ (`DutyBar`).
- Zusammenfassungen: Primärknopf „Weiter: {nächster Pflichtschritt}“, sonst „Zurück zu Heute/Üben“ (`SummaryActions`, M11 ★).
- Rollenspiel-Bericht: „Nochmal spielen“ · „Andere Szene“ · „Zu Heute“.
- Deutsch-Fallen, Wortschatztest, Wochen-Check: zurück zu „Dein Stand“; Flüssigkeit/Termin: zu Sprechen; Tonlagen: zu Heute.
- Begleiter: Aktions-Chips „Zurück zur Übung“ / „Weiter üben“.

---

## 2. Inventur nach Bereich

### A. Rahmen, Start und System (14)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| A1 | Sofortstart mit Skelett | öffnet die App | Messpunkte `lx:boot → lx:live → lx:status` | 0 | `app/App.tsx`, `f/system/HomeSkeleton.tsx`, `src/platform/capabilities.ts` | – | fertig (perf) · ✗ „laggy“: ~2,7–3 s unter Drossel, Bundle 3,0 MB |
| A2 | Ohne Datenbank / Verbindung verloren | liest Hinweis, lädt neu | Einstellungen mit Diagnose bleiben erreichbar | 0 | `f/system/NoDbNotice.tsx` | – | fertig (platform) |
| A3 | Einmalige Umstellung mit Trockenlauf | prüft Übersicht, lädt Sicherung, bestätigt | Serie, Zähler, Ergänzungen, nicht Übernommenes, Sperre bei ungültigem Profil | 0 (erzwingt sich) | `f/migration/MigrationScreen.tsx`, `store.ts`, `d/migration/*` | `app/schema`, alle | fertig (migration) |
| A4 | „Aus diesem Browser nachtragen“ | übernimmt alte `sw2:`-Kopien | Karte auf Stand, leise Zeile auf Heute | 1 (Stand) | `f/migration/LateRescueCard.tsx`, `lateRescue.ts`, `d/migration/rescue.ts` | `app/profile`, `app/course`, fehlende Dokumente | fertig (stand-gaps) |
| A5 | Reiterleiste mit Zahl und Ladepunkt | sieht offene Pflicht, laufende Korrektur | – | 0 | `app/App.tsx` `TabBar` | – | fertig |
| A6 | Herkunfts-Navigation und Bildlauf merken | tippt Zurück | Stapel 20, 8 Listen | – | `app/nav.ts` | – | fertig (transitions) |
| A7 | Übersetzer · Claude · Zahnrad überall ★ | tippt Symbol | – | 1 | `f/system/Chrome.tsx` | – | fertig (Paket 2) |
| A8 | Tastaturkürzel | 1–4, Enter, Leertaste, J/N, Esc, `/` | – | – | `e/useHotkeys.ts`, `f/companion/hotkeys.ts` | – | fertig |
| A9 | Wischen „Weiter“ | wischt nach links nach dem Prüfen | – | – | `e/swipe.ts`, `f/learn/ui.tsx` `NextButton` | – | fertig (gestures) |
| A10 | Vibration beim Prüfen | – | abschaltbar, am iPhone nicht vorhanden | – | `src/platform/haptics.ts`, `f/settings/HapticSection.tsx` | `app/profile.haptic` | fertig (haptics) |
| A11 | Töne richtig/falsch | – | Standard aus | – | `src/platform/sound.ts` | `app/profile.sound` | fertig |
| A12 | Sprachausgabe robust | tippt Lautsprecher | Stücke ≤ 150 Zeichen, 60 ms nach `cancel`, beste US-Stimme | überall | `src/platform/speech.ts`, `e/SpeakButton.tsx` | `app/profile.voice/rate` | fertig · iPhone |
| A13 | Spracheingabe | tippt Mikrofon | nur wenn der Browser sie im Artefakt erlaubt, sonst ausgeblendet | Rollenspiel, Flüssigkeit, Pitch | `src/platform/stt.ts`, `e/MicButton.tsx` | – | halb (am iPhone unsicher) |
| A14 | „Was ist neu“-Hinweis | – | – | – | `f/system/WhatsNew.tsx`, `whatsNew.ts` | localStorage | halb: gebaut, seit `8bdb031` nicht mehr eingehängt (✗ „kein Neu-Hinweis“) |

### B. Heute (20)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| B1 | Tagesplan einmal je Lerntag gespeichert | – | nur Kennungen und Begründungsschlüssel | 0 | `f/today/store.ts` `ensureDay`, `d/plan/buildPlan.ts` | `app/profile.plan` | fertig (weighting) |
| B2 | Statuszeile „Heute · x von y“ / „Fertig für heute“ | liest | fehlende Punkte | 0 | `f/today/TodayScreen.tsx`, `state.ts` | `log/<tag>` | fertig (today) |
| B3 | Pflichtliste mit Hero-Knopf | tippt „Starten“ | Wiederholen (Fortschrittsring), Lektion, ein Kanal (Grammatik, Lückenjagd, Satzbau oder Sag es) | 1 | `f/today/TodayScreen.tsx`, `f/learn/flow.ts` `startDuty` | `app/profile.plan` | fertig (today-duties) |
| B4 | Erledigt = Zustand, kein Knopf | – | – | 0 | `TodayScreen.tsx` | `app/profile.pflicht` | fertig (today-duties) |
| B5 | Begründung je Zeile | liest | Fokus, dünne Datenlage, schwächster Bereich, fällig, seit n Tagen, Turnus | 0 | `TodayScreen.tsx` `whyText`, `d/plan/channels.ts` | `app/assess` | fertig (weighting) |
| B6 | Kanalgewichtung | – | liegengeblieben, Claudes Fokus, dünne Daten, schwächster Bereich, Fälliges, Wochenhäufigkeit | – | `d/plan/channels.ts` `rankChannels` | `app/profile.act` | fertig |
| B7 | „Sag es“ als Pflicht an 4–5 Tagen, Lektion dann nur Angebot | – | Sag-es-Tage | 1 | `d/plan/channels.ts` `isSayDay` | – | fertig (say) |
| B8 | Serie (alte Regel bis `pflichtSince`, danach Pflicht + 1 Ruhetag Mo–So) ★ | – | 0–4 Uhr zählt Vortag, Archivjahre zählen mit | 0 | `d/streak.ts`, `f/progress/dayJobs.ts` | `app/profile.days/xpDays/pflicht`, `app/schema.pflichtSince`, `archive/*` | fertig (Unit streak) |
| B9 | Datum · Pflichtminuten · Serie | liest | – | 0 | `TodayScreen.tsx` | – | fertig |
| B10 | „Als Nächstes lohnt sich“ (1 Angebot mit Grund) | tippt | Grammatik, Vokabeln, Drill | 1 (nach Pflicht) | `TodayScreen.tsx` `startOffer` | – | fertig |
| B11 | Freie Runde Vokabeln (Extra) | tippt | 10 Karten, „Alle“ | 1 (nach Pflicht) | `TodayScreen.tsx` `extraRound` | – | fertig |
| B12 | Wochen-Check-Angebot | tippt „Check starten“ | einmal je Kalenderwoche, ab 40 Antworten | 1 (nach Pflicht) | `TodayScreen.tsx`, `f/check/session.ts` | `app/profile.checks` | fertig |
| B13 | „Mehr üben“ → Reiter Üben | tippt | – | 1 | `TodayScreen.tsx` | – | fertig |
| B14 | Tagesbilanz | liest | Antworten, % richtig, Minuten gegen Tagesziel, Extra-Zähler | 0 | `TodayScreen.tsx`, `state.ts` | `log/<tag>` | fertig |
| B15 | Preply-Stunde als Extra-Zeile ★ | liest | zählt nicht zur Pflicht (Emrahs Wahl 27.09.) | 0 | `f/preply/TodayLine.tsx` | `preply/*` | fertig (preply) |
| B16 | Speicherfehler „Erneut speichern“, Plan nur lokal | tippt | – | 0 | `TodayScreen.tsx`, `f/progress/persist.ts` `flush` | – | fertig |
| B17 | Tagesplan-Fehler „Erneut versuchen“ | tippt | – | 0 | `f/today/store.ts` `retryPlan` | – | fertig |
| B18 | Selbstheilung Pflicht, `pflichtSince` nie rückwirkend | – | – | – | `f/today/store.ts` `healToday`, `f/progress/dayJobs.ts` | `app/profile.pflicht` | fertig (Unit pflicht) |
| B19 | Tagesauftrag übernehmen (`daily/*` → neue Wörter, Grammatikaufgaben) ★ | – | alle angesammelten Tage | – | `f/progress/dayJobs.ts` `runDailyIntake`, `d/plan/dailyIntake.ts` | `daily/*` (nur lesen), `vocab/*` | fertig (acceptance) |
| B20 | Auto-Einschätzung beim Übergang „Pflicht erledigt“ | – | einmal je Tab und Lerntag, nur mit Grund | – | `f/progress/assessRun.ts` `maybeAutoAssess` | `app/assess` | fertig (progress) |

### C. Vokabel- und Wendungstrainer (25)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| C1 | Pflichtrunde Wiederholen | übt fällige + neue Karten | Nochmal-Karten kommen nach ≤ 20 Min. wieder (max. 3×) | 1 (Heute › Starten) | `f/vocab/TrainerScreen.tsx`, `session.ts`, `d/srs/queue.ts` | `vocab/*`, `chunk/*`, `log/<tag>` | fertig (trainer) · ✗ „Vokabeltrainer nicht auffindbar“ (kein eigener Einstieg außerhalb Heute) |
| C2 | Freie Runde mit Stapel und Größe ★ M9 | wählt Stapel, startet | Alle · Schwierige · Beruf · Nur Wendungen; 10/20/30 | 3 (Üben › Freie Runde › Start) | `f/vocab/FreeRoundSheet.tsx` | – | fertig |
| C3 | Fünfstufige Leiter mit 14 Abfragearten | antwortet | mc_en, spot, listen_mc · mc_de, match · cloze_hint, tiles · type, cloze, colloc, situation · dictation, speed, produce; ≥ 2 je Stufe, schwächste Art bevorzugt | – | `d/srs/modes.ts`, `exercise.ts`, `ladder.ts`, `f/vocab/ExerciseView.tsx` (923 Z.) | `vocab.fsrs`, `stage`, `S/D/due` | fertig (trainerModes) |
| C4 | Automatische Einstufung (keine Selbstbewertung) ★ | – | aus Richtigkeit, Zeit, Hilfe | – | `d/srs/grade.ts`, `d/learn/grade.ts`, `d/srs/applyReview.ts`, `scheduler.ts` | `vocab.fsrs` | fertig · ✗ Konflikt: jetzt **Anki-Modus gewünscht** (fehlt) |
| C5 | Status statt Erklärtexten ★ | liest | Sicherheit (5 Punkte + Wort) + Abfrageart; Zweck hinter Info | – | `e/CardStatus.tsx`, `f/learn/ui.tsx` `LearnStatus`, `d/srs/confidence.ts` | – | fertig (trainerFeedback) |
| C6 | Kinetische Lücke mit Buchstaben-Platzhaltern ★ | tippt in die Lücke | Platzhalter in Hilfsstufen, „Tipp“ in freien Stufen (zählt als Hilfe) | – | `e/KineticGap.tsx`, `e/HiddenInput.tsx`, `d/answer/mask.ts` | – | fertig (trainer, perf) |
| C7 | Erst Hinweis, dann Lösung | zweiter Versuch | Schreibweise, Form, „beginnt mit …“ | – | `f/learn/RetryHint.tsx`, `d/answer/retryHint.ts` | – | fertig (hint) |
| C8 | Toleranz: Tippfehler, Formen, UK-Schreibung, Synonyme ★ | – | UK = richtig mit US-Hinweis | – | `d/answer/check.ts`, `spelling.ts`, `form.ts`, `normalize.ts` | – | fertig |
| C9 | Beispiele statt „Warum“ ★ | liest nach dem Prüfen | Ursprungssatz, Kollokationen, sonst KI (gespeichert) | – | `f/vocab/examples.ts`, `d/srs/examples.ts`, `p/cardExamples.ts` (card-examples@1) | `vocab.xEx` | fertig |
| C10 | Formhinweis, Bedeutung, Wortart | liest | – | – | `d/srs/explain.ts`, `f/learn/ui.tsx` `FormHint` | – | fertig |
| C11 | „Ich lag richtig“ ★ M4 | Einspruch bei rot | nur getippte Antworten, max. „Gut“ | – | `f/learn/ui.tsx` `OverrideButton` | `log` `override:true` | fertig |
| C12 | „Einmal richtig schreiben“ ★ M5 | schreibt Lösung ab | zählt nicht | – | `f/learn/ui.tsx` `CopyOnce` | – | fertig |
| C13 | Automatisch weiter ★ M6 | – | ~1,2 s mit Ablaufbalken, Tipp hält an | – | `f/learn/ui.tsx` `NextButton`, `useAutoNextPref` | `app/profile.autoNext` | fertig |
| C14 | Neues Wort vorstellen ★ | liest, tippt Weiter | Bedeutung, Wortart, Englisch, Satz, Verbindung, Aussprache, „mehrere Bedeutungen“ | – | `f/vocab/IntroCard.tsx` | – | fertig (Paket 2) |
| C15 | Neue Wörter unter Wiederholungen gemischt | – | Kontingent 0/2/5/10 | – | `d/srs/queue.ts`, `newCard.ts` | `app/profile.newPerDay` | fertig |
| C16 | Chip „hartnäckig“ + Merkhilfe von Claude ★ M3 | tippt „Merkhilfe“ | ab 4× vergessen, einmal gespeichert | – | `f/vocab/mnemonic.tsx`, `p/mnemonic.ts` (mnemonic@1) | `vocab.mnemo` | fertig |
| C17 | Eigener Satz mit KI-Prüfung | schreibt Satz | ohne Claude: lokale Mindestprüfung | – | `d/srs/produce.ts`, `p/produceCheck.ts` (produce-check@1) | `log` | fertig |
| C18 | Wendung „aus der Situation“ ★ M15 | tippt Wendung | Szene + Absicht, „Damals hattest du gesagt“ | – | `d/chunks/situation.ts`, `d/srs/chunkCards.ts` | `chunk/*` | fertig |
| C19 | Wendungen ab Stufe 3 abgefragt | – | – | – | `d/srs/chunkCards.ts` | `chunk/*` | fertig |
| C20 | Reparatur-Sätze im Trainer | sagt Satz richtig | Boxen 1/3/9 | – | `f/repair/RepairItem.tsx`, `session.ts` `answerRepair` | `app/repair` | fertig (repair) |
| C21 | Zähler zählt Nochmal-Karten und Reparatur mit ★ | – | – | – | `session.ts` `roundProgress` | – | fertig (Paket 2) |
| C22 | Zusammenfassung mit „Weiter: nächster Pflichtschritt“ ★ M11 | tippt | Antworten, % richtig, nicht gespeichert | – | `f/vocab/Summary.tsx`, `f/learn/ui.tsx` `SummaryActions` | – | fertig |
| C23 | Jedes Wort antippbar im Ergebnis ★ | tippt Wort | → D-Popover | – | `e/EnglishText.tsx` | – | fertig (trainerModes) |
| C24 | Speichern je Antwort, Puffer beim Schließen, zwei Tabs | – | Folgenummer, Tab-Kennung | – | `f/vocab/persist.ts`, `f/progress/persist.ts` | `vocab/*`, `log/<tag>`, `app/profile` | fertig |
| C25 | Runde fortsetzen nach Neuladen | – | – | – | – (Sitzung nur im Speicher: `useSession`) | – | **kaputt/fehlt** ✗ „stürzt ab, dann von vorn“ |

### D. Wortschatz (Liste, Wortblatt, Hinzufügen, Messung) (17)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| D1 | Liste aller Wörter und Wendungen ★ M1 | scrollt, sucht | Suche Wort/Bedeutung, „Mehr zeigen“ | 2 (Üben › Wortschatz) | `f/vocab/list/VocabScreen.tsx`, `d/srs/vocabList.ts` | `vocab/*`, `chunk/*` | fertig |
| D2 | Filter und Sortierung ★ M1 | wählt | Alle · Fällig · Neu · Unsicher · Mit Hilfe · Sicher · Beruf · Wendungen · Ausgeblendet; Stufe / A–Z | 2 | `VocabScreen.tsx` | – | fertig |
| D3 | Kopfzeile Wortschatz | liest | gesamt, fällig, „neu heute x von y“, Vorrat leer | 2 | `VocabScreen.tsx` | – | fertig |
| D4 | Wortblatt ★ M1 | tippt Wort | Sicherheit, Stufe, nächste Wiederholung, Bilanz je Abfrageart, Wortpartner, Ursprung, Beispiele, Aussprache | 3 | `f/vocab/list/WordSheet.tsx` | `vocab/<id>`, `chunk/<id>` | fertig |
| D5 | Messwerte am Wort | klappt auf | R jetzt, S, D, Wiederholungen, Vergessen | 4 | `WordSheet.tsx` | `vocab.fsrs` | fertig |
| D6 | „Jetzt üben“ | tippt | Einzelkarte als Extra-Runde | 4 | `WordSheet.tsx` | – | fertig |
| D7 | „Kenne ich schon“ mit Probeabfrage ★ M2 | tippt, beantwortet | richtig → Stufe 4, 30 Tage | 4 | `f/vocab/list/actions.ts` `markKnown` | `vocab/<id>` | fertig |
| D8 | Ausblenden / Wieder aufnehmen (nie löschen) | tippt | – | 4 | `actions.ts` `setHidden` | `vocab.hidden` | fertig |
| D9 | Zurücksetzen (nur FSRS-Zusatzfelder) | tippt, bestätigt | – | 4 | `actions.ts` `resetCard` | `vocab.fsrs` | fertig |
| D10 | Merkhilfe am Wortblatt | tippt | – | 4 | `f/vocab/mnemonic.tsx` | `vocab.mnemo` | fertig |
| D11 | Eigenes Wort hinzufügen ★ M2 | tippt EN, DE, Satz | „Mit Claude ergänzen“; ohne Satz keine Karte | 3 (Üben › Wortschatz › Hinzufügen) | `f/vocab/list/AddWordSheet.tsx`, `actions.ts` `addWord` | `vocab/*` | fertig |
| D12 | „Neue Wörter von Claude“ (8) ★ M2 | tippt, übernimmt einzeln/alle | – | 4 | `AddWordSheet.tsx`, `p/wordGen.ts` (word-gen@2) | `vocab/*` `src:'ai'` | fertig |
| D13 | „Fachwörter für meinen Beruf“ (8) ★ M2 | tippt | nutzt beruflichen Kontext | 4 | `AddWordSheet.tsx`, `p/wordGen.ts`, `p/work.ts` | `vocab/*` `src:'job'` | fertig |
| D14 | Wörter aus Texten, Übersetzer, Gespräch speichern | tippt „Als Karte speichern“ | immer mit Ursprungssatz | 1 im jeweiligen Text | `f/lookup/store.ts`, `d/input/cardSrc.ts`, `d/chunks/newChunk.ts` | `vocab/*`, `chunk/*` | fertig · ✗ Übersetzer → Wortschatz „nicht einfach“ |
| D15 | Wortschatzziel 8.000 mit Tempo | liest | Wochen bis C1 | 2 (Stand › Ziel C1) | `d/vocab/goal.ts`, `f/progress/PathTab.tsx` | `app/profile.vtests` | fertig |
| D16 | Wortschatztest (Ja/Nein, Bedeutung, aktiv) | macht Test ~8 Min. | Fantasiewörter, Bänder, passiv/aktiv, J/N | 3 (Stand › Verlauf › Starten) | `f/vtest/VtestScreen.tsx`, `machine.ts`, `d/vtest/*` | `app/profile.vtests` | fertig (vtest) · kein Fortsetzen |
| D17 | Stufen-Zahlen, Kennzahlen „In deinen Karten“ | liest | – | 2 | `d/overview.ts`, `f/progress/ProgressScreen.tsx` | – | fertig |

### E. Grammatik und Nachschlagen (14)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| E1 | Themenliste 16 + 7 C1-Themen, unsicherste oben | scrollt | Punkte-Status, Fehler-Badge | 2 (Üben › Grammatik) | `f/grammar/GrammarScreen.tsx`, `d/grammar/rules.ts`, `bkt.ts` | `grammar/<topic>` | fertig (grammar) |
| E2 | Themenblatt | tippt Thema | Regel, Entscheidungsweg, Formen, Signalwörter, Kontrast Deutsch, typische Fehler, Auch richtig, eigene letzte Fehler, Messwerte | 3 | `GrammarScreen.tsx` `TopicSheet`, `src/content/legacy/rules.json`, `grammar-extra.json` | `grammar/<topic>` | fertig |
| E3 | „Dieses Thema üben · 8 Aufgaben“ | tippt | – | 4 | `f/grammar/SessionScreen.tsx`, `session.ts` | `grammar/*`, `log` | fertig |
| E4 | Neue Aufgaben von Claude | tippt | je Thema | 4 | `f/grammar/generate.ts`, `p/grammarItems.ts` (grammar-items@2) | `app/pool` | fertig |
| E5 | Freie Runde · 8 Aufgaben | tippt | gemischt | 3 | `SessionScreen.tsx` | – | fertig |
| E6 | Fehler-Wiederholung (Boxen 1/3/9) | tippt „Deine Fehler · n fällig“ | – | 3 | `d/grammar/errors.ts` | `grammar/<topic>` Fehlersätze | fertig |
| E7 | Pflichtkanal Grammatik (6 Aufgaben) | Heute › Starten | nächste Lektion, schwächste Themen, `daily/*` | 1 | `f/learn/flow.ts`, `d/grammar/pool.ts`, `tasks.ts` | `daily/<tag>`, `app/pool` | fertig |
| E8 | Vier Aufgabenarten | antwortet | Auswahl · Lücke · Umformen · Verbessern | – | `f/grammar/GrammarItem.tsx`, `d/grammar/check.ts` | – | fertig |
| E9 | KI-Urteil für Umformen/Verbessern | – | „Nicht sicher prüfbar – zählt nicht“ | – | `p/grammarJudge.ts` (grammar-judge@1) | – | fertig |
| E10 | Wort-für-Wort-Vergleich, Auch richtig, Kurzform | liest | – | – | `e/SentenceDiff.tsx`, `d/answer/diff.ts`, `align.ts` | – | fertig |
| E11 | Sofort bewertet (ähnlich = nicht sicher, sonst falsch) | – | – | – | `d/grammar/check.ts` | – | fertig (seit `8bdb031`) · ✗ vorher „immer fast richtig“ |
| E12 | Hinweis, „Weiß ich nicht“, Einspruch, Abschreiben | – | wie Trainer | – | `GrammarItem.tsx`, `d/grammar/retryHint.ts` | – | fertig |
| E13 | Nachschlagen „Wissen“: Suche über alle Regeln ★ M8 | tippt Suchwort | zweisprachig | 3 (Üben › Grammatik › Fallen-Link) | `f/grammar/WissenScreen.tsx` | – | fertig |
| E14 | „Deutsch → Englisch: typische Fallen“ ★ M8 | liest, springt zum Thema | – | 3 | `WissenScreen.tsx` | – | fertig |

### F. Kurs und Lektionen (10)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| F1 | Kursübersicht 24+ Lektionen in Einheiten | scrollt | Erledigt / Als Nächstes | 2 (Üben › Alle Lektionen) | `f/course/CourseScreen.tsx`, `d/course/catalog.ts` | `app/course` | fertig (course) |
| F2 | Meilenstein je Einheit ★ M17 | liest | „Kann jetzt: …“, kein Knopf | 2 | `CourseScreen.tsx` | `app/course` | fertig |
| F3 | Nächste Lektion (nach Einschätzung gewählt) | tippt | – | 1 (Heute) / 2 (Üben) | `d/course/next.ts` `pickLesson` | `app/assess` | fertig |
| F4 | Lektion in 4 Schritten | Wörter → Dialog → Grammatik → Anwenden | ~12 Min. | – | `f/course/LessonScreen.tsx`, `LessonSteps.tsx` (559 Z.), `lessonMachine.ts` | `lesson/<id>` | fertig |
| F5 | Lektion von Claude vorbereiten oder Grundfassung | wählt | ohne KI immer möglich | – | `f/course/lessonRun.ts`, `p/lessonContent.ts` (lesson-content@2), `d/course/baseLesson.ts` | `lesson/<id>` | fertig |
| F6 | Dialog hören, lesen, Übersetzung, Fragen | – | – | – | `LessonSteps.tsx` | – | fertig |
| F7 | Eigener Text mit KI-Urteil oder Selbstprüfung | schreibt | Pflichtwörter, Mindestlänge, Mustertext | – | `p/lessonProduction.ts` (lesson-production@2), `d/course/production.ts` | `app/course`, `app/radar` | fertig |
| F8 | Lektion an Schritt fortsetzen | – | Schritt lokal gemerkt | – | `lessonRun.ts` (localStorage) | localStorage | halb (nur Schritt, nicht Stand im Schritt) |
| F9 | Kurs erweitern (4 neue Lektionen, l25+) | tippt | nach Einschätzung und Fehlern | 2–3 (Üben › Alle Lektionen) | `f/course/CourseExtendCard.tsx`, `extendCourse.ts`, `p/courseExtend.ts` (course-extend@1) | `lesson/*`, `app/course` | fertig (courseExtend) |
| F10 | Als Pflichtpunkt „Lektion“ (2–3× je Woche) | Heute › Starten | – | 1 | `f/learn/flow.ts` | `app/profile.plan` | fertig |

### G. Kurzübungen (6)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| G1 | Diktat | hört, schreibt Satz | Nochmal, Langsam, Wort-für-Wort mit Fehlerarten | 2 (Üben › Kachel) | `f/drills/DrillScreen.tsx`, `DrillItems.tsx`, `d/drills/dictation.ts` | `log` | fertig (drills) |
| G2 | Lückenjagd | ergänzt Wortpartner | „passt zu …“ | 2 / 1 als Pflicht | `d/drills/cloze.ts` | `log` | fertig |
| G3 | Satzbau aus Bausteinen | legt Bausteine | Neu legen, Störbaustein | 2 | `d/drills/order.ts`, `e/Tiles.tsx` | `log` | fertig |
| G4 | Sprint 90 s | tippt schnell | Tempo + Wochenschnitt, „Das übst du nochmal“ | 2 | `f/drills/SprintView.tsx`, `d/drills/sprint.ts` | `app/profile.sprints` | fertig |
| G5 | Nur machbare Übungen werden gezeigt | – | ohne Sprachausgabe kein Diktat | – | `d/plan/channels.ts` `feasible` | – | fertig |
| G6 | Drill-Runde fortsetzen | – | – | – | – (nur Speicher) | – | fehlt ✗ |

### H. Lesen, Hören, Schreiben, Entdecken (27)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| H1 | Lese-Bibliothek auf Niveau, Beruf/Alltag gemischt | wählt Text | „Noch einen Text“ | 2 (Üben › Lesen) | `f/read/ReadScreen.tsx`, `f/input/library.ts`, `d/input/select.ts`, `mix.ts` | `articles/*` | fertig (read) |
| H2 | Neuen Text erzeugen mit Themenwahl ★ M12 | wählt Thema | Überrasch mich · Business · Tech & KI · Fußball · Reisen · Wissenschaft · Film | 3 | `ReadScreen.tsx`, `p/readingText.ts` (reading-text@2) | `articles/*` | fertig |
| H3 | Eigenen Text als Lese-Einheit ★ M16 | fügt Text ein | mit Fragen aufbereiten oder ohne | 3 | `f/input/complete.ts` `saveOwnArticle` | `articles/*` `src:'own'` | fertig |
| H4 | Lesen mit Wendungen vorab (Glossar) | liest, tippt Wörter | – | 3 | `f/read/ReadUnit.tsx`, `ArticleView.tsx` | – | fertig |
| H5 | Verständnisfragen mit Beleg im Text | antwortet | Kernaussage, Detail, Schlussfolgerung | – | `f/input/QuestionCard.tsx`, `d/input/questions.ts` | `reading/*` | fertig |
| H6 | Zusammenfassung mit KI-Prüfung | schreibt 2–4 Sätze | Kernaussagen getroffen, Missverständnisse, Muster | – | `f/read/SummaryStep.tsx`, `p/readingCheck.ts` (reading-check@2) | `reading/<id>` | fertig |
| H7 | „Alle als Karten“ | tippt | nur mit Ursprungssatz | – | `f/input/ChunkList.tsx`, `cards.ts` | `chunk/*` | fertig |
| H8 | Hörtext-Bibliothek | wählt | – | 2 (Üben › Hören) | `f/listen/ListenScreen.tsx` | `lpool/*` | fertig (listen) |
| H9 | Hörtext erzeugen („zu deinem Job“) | tippt | – | 3 | `p/listeningText.ts` (listening-text@2) | `lpool/*` | fertig |
| H10 | Abspielleiste | hört | Play/Pause, Satz zurück, Tempo, Abschnitte, n× gehört | – | `e/AudioBar.tsx`, `f/listen/ListenUnit.tsx` | `app/profile.listen` | fertig · iPhone |
| H11 | Wörter vorab, Fragen nach dem Hören | – | „Ohne Hören weiter“ ohne Ton | – | `ListenUnit.tsx`, `f/listen/machine.ts` | – | fertig |
| H12 | Transkript und Shadowing mit Pause ★ M12 | spricht nach | „Zuhören … – Jetzt du“ | – | `f/listen/TranscriptView.tsx` | – | fertig · iPhone |
| H13 | Schreibaufgabe des Tages | liest Aufgabe | Aufgabe auf Englisch, Fokus, Umfang, Selbstkontrolle | 2 (Üben › Schreiben) | `f/write/WriteScreen.tsx`, `PromptCard.tsx`, `p/writingPrompt.ts` (writing-prompt@2) | `wprompt/<tag>` | fertig (write) |
| H14 | „Andere Aufgabe“, „Eigenes Thema“ ★ M12 | tippt / gibt Thema ein | ≤ 120 Zeichen | 3 | `WriteScreen.tsx` | `wprompt/<tag>` | fertig |
| H15 | Schreiben mit Entwurf und Wortzähler | schreibt | Entwurf bleibt lokal | – | `f/write/WriteUnit.tsx`, `f/input/DraftArea.tsx`, `draft.ts` | localStorage | fertig |
| H16 | Wendungs-Chips einfügen ★ M12 | tippt Chip | haken sich beim Nutzen ab | – | `WriteUnit.tsx`, `d/input/chunkMatch.ts` | – | fertig |
| H17 | KI-Korrektur im Hintergrund ★ M14 | lernt weiter | Ladepunkt am Reiter, „Korrektur fertig · Ansehen“ | – | `f/input/aiTasks.ts`, `AiTaskNotice.tsx`, `AiRunPanel.tsx`, `p/writingReview.ts` (writing-review@2) | `writing/<id>` | fertig |
| H18 | Rückmeldung zum Text | liest | CEFR, 5 Kriterien als Punkte, Stärken, Stellen mit Warum + US-Hinweis, verbesserte Fassung, Zum Mitnehmen, Nächstes Mal | – | `f/write/ReviewView.tsx`, `d/input/review.ts`, `errorSpans.ts` | `writing/<id>`, `app/radar` | fertig |
| H19 | Überarbeiten und erneut prüfen | tippt | Fassungen, vorige Rückmeldung | – | `WriteUnit.tsx`, `complete.ts` `reviseWriting` | `writing/<id>` | fertig |
| H20 | „Nochmal, aber besser“ nach dem Schreiben | – | → Reparatur-Sätze | – | `f/repair/RepairStep.tsx` | `app/repair` | fertig |
| H21 | Verlauf je Kanal | tippt „Verlauf“ | Lesen, Hören, Schreiben, Entdecken | 3 | `f/input/HistoryScreen.tsx`, `HistoryList.tsx` | jeweilige Sammlung | fertig |
| H22 | Entdecken-Liste (Tagesauftrag) ★ | wählt Beitrag | Neu / Erledigt, Artikel · Podcast · Video, eigene alte Beiträge | 2 (Üben › Entdecken) | `f/discover/DiscoverScreen.tsx`, `feedStore.ts`, `d/discover/feedItems.ts` | `feed/*` (nur lesen) | fertig (discover) |
| H23 | Beitrag in 4 Schritten | Vorbereiten → Aufnehmen → Prüfen → Anwenden | Original öffnen (neuer Tab), Hörhilfe bei Podcast/Video | 3 | `f/discover/ItemScreen.tsx`, `steps.tsx`, `machine.ts` | `app/profile.disc` | fertig |
| H24 | Anwenden mit KI-Prüfung | schreibt ≥ 20 Wörter | Wendungen abgehakt, Urteil gut/brauchbar/nochmal | – | `p/applyCheck.ts` (apply-check@1) | `app/profile.disc` | fertig |
| H25 | Status je Einheit, Info-Symbol | liest | Kanal · Niveau · Beruf/Alltag · Minuten | – | `f/input/StatusLine.tsx`, `UnitShell.tsx` | – | fertig |
| H26 | „Heute geübt“-Hinweis in Üben | – | – | 1 | `f/input/InputOffers.tsx` `useChannelState` | `log/<tag>` | fertig |
| H27 | Messwerte je Einheit | klappt auf | – | – | `f/input/UnitShell.tsx` | – | fertig |

### I. Sprechen: Szenen und Rollenspiel (16)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| I1 | Szenenbibliothek (feste + eigene) | wählt Szene | zuletzt gespielt, unvollständige zugeklappt | 1 (Sprechen) | `f/speak/SpeakHub.tsx`, `SceneCard.tsx`, `useSceneLibrary.ts`, `src/content/speak/scenes.json` | `scene/*` | fertig (speak) |
| I2 | Einweisung | liest Lage, Ziel, Gegenüber, Wendungen | Fortsetzen / Neu beginnen, Als Preply-Stunde | 2 | `f/speak/SceneBriefing.tsx` | – | fertig |
| I3 | Neue Szene aus Wunsch | tippt „Neue Szene“ | Wunschthema, Grammatik-Fokus, fällige Wörter | 2 | `f/speak/SceneCreateSheet.tsx`, `p/sceneGen.ts` (scene-gen@2) | `scene/*` | fertig |
| I4 | Rollenspiel, Figur antwortet gestreamt, korrigiert nie | schreibt/spricht | Stopp, Erneut senden, Pause bei Drosselung | 3 | `f/speak/RoleplayScreen.tsx`, `useRoleplay.ts`, `roleplayMachine.ts`, `p/roleplayTurn.ts` (roleplay-turn@1), `src/ai/stream.ts` | `talk/<Monat>` | fertig |
| I5 | Analyse je Zug in 3 Schichten | liest Seitenpanel | Korrektheit · C1-Fassung · „landet besser, weil“; fällt aus → Gespräch läuft | – | `f/speak/AnalysisCard.tsx`, `analysisLane.ts`, `p/turnAnalysis.ts` (turn-analysis@2), `p/threeLayers.ts` | `talk/<Monat>` | fertig |
| I6 | Wendung „Mitnehmen“ | tippt | mit eigenem Satz und C1-Fassung | – | `f/speak/TakeChunkButton.tsx`, `d/chunks/newChunk.ts` | `chunk/*` | fertig |
| I7 | Vorgeschlagene Wendungen per Tipp einfügen | tippt Chip | – | – | `f/speak/Composer.tsx` | – | fertig |
| I8 | Antworten vorlesen / Mikrofon | – | Autoplay abschaltbar | – | `f/speak/autoplay.ts`, `e/MicButton.tsx` | `app/profile` | fertig · iPhone |
| I9 | Gespräch fortsetzen | tippt „Fortsetzen“ | – | 2 | `f/speak/resume.ts` | localStorage | fertig |
| I10 | Abschlussbericht | liest | Ziel erreicht, Stärken, Fokus, Du sagtest → C1, beste Wendungen, Fehlerkategorien, Fokuswörter, Bericht in anderer Sprache | – | `f/speak/ReportScreen.tsx`, `p/roleplayReport.ts` (roleplay-report@3), `d/speak/reportStats.ts` | `talk/<Monat>` | fertig |
| I11 | C1-Werkzeugkasten im Bericht | liest | abgeschwächt, strukturiert, betont: gelungen/fehlte | – | `ReportScreen.tsx`, `src/content/c1/toolkit.json` | – | fertig |
| I12 | „Nochmal, aber besser“ nach dem Gespräch | sagt Sätze richtig | – | – | `f/repair/RepairStep.tsx`, `p/repairCheck.ts` (repair-check@1) | `app/repair` | fertig (repair) |
| I13 | Nochmal spielen / Andere Szene / Zu Heute | tippt | – | – | `ReportScreen.tsx` | – | fertig |
| I14 | Wendungen aus deinen Szenen üben ★ M15 | tippt „Üben“ | aus der Situation abrufen | 2 | `f/speak/SituationDrill.tsx` | `chunk/*` | fertig |
| I15 | Sprech-Status auf Sprechen | liest | „Heute offen · ≥ 4 Züge“ | 1 | `f/speak/useTodayEntries.ts`, `d/speak/duty.ts` | `log/<tag>` | halb: sagt „offen“, obwohl Sprechen **kein** Pflichtpunkt auf Heute ist (Kap. 2.2) |
| I16 | Sprechen fließt in Einschätzung/Radar | – | – | – | `d/assessment/evidence.ts`, `d/radar/events.ts` | `app/radar`, `app/assess` | fertig |

### J. Freies Sprechen und Formulieren (Lernberatung) (15)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| J1 | „Sag es“ – Situation frei beantworten | schreibt 3–6 Sätze mit Zeit | Beruf/Alltag, „Andere Situation“, Entwurf | 1 (als Pflicht) / 2 (Üben › Sag es) | `f/say/SayScreen.tsx`, `src/content/say/situations.ts`, `d/say/*` | `say/<Monat>` | fertig (say) |
| J2 | Sag es: Korrekturen, C1-Aufwertung, bessere Fassung | liest | ohne Claude: ungeprüft speichern | – | `p/sayCheck.ts` (say-check@2) | `say/<Monat>`, `app/repair` | fertig |
| J3 | Sag es: zweiter Durchgang „Nochmal, aber besser“ | schreibt neu aus dem Kopf | Vorher/Nachher | – | `SayScreen.tsx` | `say/<Monat>` | fertig |
| J4 | Flüssigkeit 90 – 60 – 45 | antwortet 3× mit Zeitdruck | tippen oder sprechen, Wörter/Min., ganze Sätze | 3 (Sprechen › Training) | `f/fluency/FluencyScreen.tsx`, `d/fluency/*`, `src/content/fluency/questions.ts` | `fluency/<Monat>` | fertig (fluencyMeeting) |
| J5 | Flüssigkeit: Auswertung und Reparatur | liest | was flüssiger wurde, fehlende Wendungen, Korrekturen | – | `p/fluencyCheck.ts` (fluency-check@1) | `fluency/<Monat>`, `app/repair` | fertig |
| J6 | Mein nächster Termin: anlegen | füllt Wer/Thema/Heikel/Notizen/Wann | „Ohne Vorbereitung speichern“ | 3 (Sprechen › Training) | `f/meeting/MeetingScreen.tsx` (615 Z.), `d/meeting/meetingDoc.ts` | `meeting/<Monat>` | fertig (fluencyMeeting) |
| J7 | Termin: Vorbereitung | liest | Schlüsselwendungen, Einwände, Antwortbausteine (erst selbst antworten) | 4 | `p/meetingPrep.ts` (meeting-prep@1) | `meeting/<Monat>` | fertig |
| J8 | Termin: „Alle als Wendungen merken“ | tippt | – | 4 | `MeetingScreen.tsx` | `chunk/*` | fertig |
| J9 | Termin: Generalprobe als Rollenspiel | tippt | legt Szene an | 4 | `MeetingScreen.tsx` → `roleplay` | `scene/*` | fertig |
| J10 | Termin: Nachbesprechung | schreibt, was fehlte | beste Formulierung → Wiederholung | 4 | `p/meetingDebrief.ts` (meeting-debrief@1) | `meeting/<Monat>`, `chunk/*` | fertig |
| J11 | Drei Tonlagen | schreibt Slack · Mail an CFO · Meeting | „Anderer Sachverhalt“ | 3 (Sprechen › Training) | `f/tones/TonesScreen.tsx`, `src/content/tones/messages.ts`, `d/tones/tones.ts` | `tones/<Monat>` | fertig (c1tones) |
| J12 | Tonlagen: Urteil und Musterfassungen | liest | zu direkt / zu steif / passend, echte Fehler | – | `p/toneCheck.ts` (tone-check@1) | `tones/<Monat>`, `app/repair` | fertig |
| J13 | Reparatur-Sätze sammeln (aus allen Quellen) | – | Gespräch, Text, Preply, Sag es, Lektion, Flüssigkeit, Tonlagen, Fallen | – | `f/repair/store.ts`, `review.ts`, `d/repair/*` | `app/repair` (≤ 200 KiB) | fertig (repair) |
| J14 | „Nochmal, aber besser“-Schritt | sagt Satz richtig | Überspringen, später in der Wiederholung | – | `f/repair/RepairStep.tsx`, `RepairItem.tsx` | `app/repair` | fertig |
| J15 | Reparatur-Stand auf Stand | liest „x offen, y sicher“ | – | 1 | `f/repair/StandLine.tsx` | `app/repair` | fertig |

### K. Business (9)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| K1 | E-Mail-Refiner | fügt Mail ein | Empfänger (Kunde, Vorgesetzte, Partner, Team), Absicht (5) | 3 (Sprechen › Business › E-Mail) | `f/business/MailRefiner.tsx`, `mailMachine.ts`, `p/mailRefine.ts` (mail-refine@2) | `biz/<Monat>` | fertig (business) |
| K2 | Fassung je Satz wählen | tippt Bausteine | Status passt/steif/unklar/Fehler, Original behalten | – | `f/business/TilePicker.tsx`, `d/business/mailCompose.ts` | – | fertig |
| K3 | Fertige Mail kopieren, Statistik | tippt Kopieren | – | – | `MailRefiner.tsx` | `biz/<Monat>` | fertig |
| K4 | Phrasen-Baukasten (Entscheidungsbäume) | wählt Lage/Pfad | auch ohne Claude | 3 | `f/business/PlaybookScreen.tsx`, `src/content/business/playbooks.json`, `d/business/playbook.ts` | – | fertig |
| K5 | „Auf meine Lage anpassen“ | beschreibt Lage | – | 4 | `p/phraseAdapt.ts` (phrase-adapt@1) | – | fertig |
| K6 | Kurzdrill im Baukasten | wählt Antworten | – | 4 | `f/business/PlaybookDrill.tsx` | `biz/<Monat>` | fertig |
| K7 | Präsentations-Coach: Sprechfassung | fügt Folie ein | Publikum (4), Dauer | 3 | `f/business/PitchCoach.tsx`, `pitchMachine.ts`, `p/pitchScript.ts` (pitch-script@2) | `biz/<Monat>` | fertig |
| K8 | Pitch: Nachsprechen, eigene Fassung, Rückmeldung | spricht/tippt | Punkte abgedeckt | – | `p/pitchFeedback.ts` (pitch-feedback@2), `d/business/coverage.ts` | `biz/<Monat>` | fertig |
| K9 | Wendungen mitnehmen aus Business | tippt | Ursprung Mail/Pitch/Baukasten | – | `f/speak/TakeChunkButton.tsx` | `chunk/*` | fertig |

### L. Preply-Brücke (9)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| L1 | Stunde vorbereiten | wählt Anlass, Dauer | Freies Gespräch · aktuelle Lektion · eigenes Thema · nach letzter Stunde · „Zu: …“ | 2 (Sprechen › Preply) | `f/preply/PreplyScreen.tsx`, `PrepForm.tsx`, `p/preplyPrep.ts` (preply-prep@2) | `preply/*` | fertig (preply) |
| L2 | Stundenplan | liest | Aufwärmen, Sprechanlässe, Modellsätze, eigene Fehler, Nachricht an Lehrer + Kopieren | 3 | `f/preply/PlanView.tsx`, `CopyBox.tsx` | `preply/*` | fertig |
| L3 | Wochenfokus Deutsch-Fallen in der Nachricht | – | – | – | `PlanView.tsx`, `f/patterns/store.ts` | `app/patterns` | fertig |
| L4 | Vom Lehrer übernehmen | fügt Chat/Korrekturen ein | bis 2 Min. KI | 3 (Preply › Übernehmen) | `f/preply/ImportPane.tsx`, `importMachine.ts`, `p/preplyImport.ts` (preply-import@2) | `preply/*` | fertig |
| L5 | Vorschau und Übernahme nach Bestätigung | wählt einzeln ab | Korrekturen → Fehler-Wiederholung/Radar, Übungen → Pool, Vokabeln → Karten, Hausaufgaben | 4 | `f/preply/ImportReview.tsx`, `actions.ts`, `d/preply/apply.ts` | `grammar/*`, `app/radar`, `app/pool`, `vocab/*` | fertig |
| L6 | „Stunde gehalten“ | trägt Wann/Dauer ein | mit oder ohne Plan | 3 | `f/preply/HeldSheet.tsx`, `d/preply/held.ts` | `preply/*`, `app/profile.minutes` | fertig |
| L7 | Verlauf der Stunden | öffnet Eintrag | Plan · Übernahme · Gehalten | 3 | `f/preply/HistoryList.tsx` | `preply/*` | fertig |
| L8 | „Als Preply-Stunde“ von überall ★ M18 | tippt | Artikel, Text, Grammatikthema, Szene, Bericht, Wochenbericht, Begleiter | 1 im jeweiligen Bildschirm | `f/preply/AsPreplyLesson.tsx`, `store.ts` `openPreplyEntry` | – | fertig |
| L9 | Preply-Extra-Zeile auf Heute | – | siehe B15 | 0 | `f/preply/TodayLine.tsx` | – | fertig |

### M. Fehler als Lernquelle (5)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| M1 | Deutsch-Fallen erkennen | tippt „Fallen erkennen“ | aus Gesprächen, Texten, Preply, Sag es | 2 (Stand › Karte) | `f/patterns/PatternsScreen.tsx`, `store.ts`, `d/patterns/*`, `p/patterns.ts` (patterns@1) | `app/patterns` | fertig (patterns) |
| M2 | Fallen-Liste mit Wochentrend | liest | seltener/gleich/häufiger, Beispiel | 2 | `f/patterns/WeeklyTrend.tsx`, `parts.tsx` | `app/patterns` | fertig |
| M3 | Wochenfokus (App + Preply) | liest | – | 1 (Stand-Karte) | `f/patterns/StandCard.tsx` | `app/patterns` | fertig |
| M4 | Fallen-Kurzdrill mit freiem Satz | bildet Sätze | KI-Prüfung, → Reparatur | 3 | `f/patterns/PatternDrill.tsx`, `FreeItem.tsx`, `p/patternCheck.ts` (pattern-check@1) | `app/repair` | fertig |
| M5 | Fehler-Radar 30 Tage | liest, tippt „Üben“ | Trend, Quellen, Beispiele je Kategorie (14) | 2 (Stand › Fehler) | `f/progress/ErrorsTab.tsx`, `d/progress/radar.ts`, `d/radar/events.ts` | `app/radar` | fertig (progress) |

### N. Claude-Begleiter, Übersetzer, Wort-Antippen (20)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| N1 | Chat als großes Overlay (Handy Vollbild) | fragt | Streaming, Markdown, Stopp, Neues Gespräch, Früher | 1 | `f/companion/CompanionOverlay.tsx`, `ChatPane.tsx`, `store.ts`, `p/companionChat.ts` (companion-chat@2) | `app/chat` (≤ 40) | fertig (companion) |
| N2 | „Sieht gerade: …“ (Kontext ohne Lösung) | – | 24 Bildschirme melden Kontext | – | `f/companion/seeing.ts`, `d/companion/seeing.ts`, `brief.ts` | – | fertig |
| N3 | Vorschläge je Kontext | tippt Vorschlag | Tipp ohne Lösung, Regel, Warum falsch, Beispiele, Verwechslung, Wortpartner, Register, Abfragen, E-Mail, Lehrer, schwächstes Thema | 1 | `d/companion/suggest.ts` | – | fertig |
| N4 | Antworttiefe Schnell/Gründlich ★ M19 | schaltet | `quick`/`default` | 2 | `store.ts` `setTier` | – | fertig |
| N5 | Aktions-Chips | tippt | Weiter üben, Zurück zur Übung, Als Preply-Stunde | – | `ChatPane.tsx` | – | halb: keine echten Werkzeuge (Karten anlegen, Übung starten), Emrahs Wunsch vom 24.09. ★ |
| N6 | Kein Scroll-Springen, „Neue Antwort ↓“ | – | – | – | `ui/chat/scroll.ts` | – | fertig |
| N7 | Tastatur-Anpassung (`visualViewport`) | – | – | – | `ui/chat/keyboard.ts` | – | fertig · iPhone |
| N8 | Antwort in falscher Sprache neu anfragen | tippt | – | – | `ChatPane.tsx` | – | fertig |
| N9 | Kopieren, Speicherfehler erneut | tippt | – | – | `ChatMessage.tsx`, `persistChat.ts` | `app/chat` | fertig |
| N10 | Übersetzer DE↔EN | tippt Text | automatisch oder feste Richtung, Tausch | 1 (Übersetzer-Symbol) | `f/companion/translate/TranslatePane.tsx`, `store.ts`, `p/translate.ts` (translate@3) | – | fertig (translate) |
| N11 | Register formell/neutral/locker | wählt | – | 2 | `TranslatePane.tsx` | – | fertig |
| N12 | Alternativen, Hinweise, Begriffe, Anhören | liest | – | – | `TranslatePane.tsx` | – | fertig |
| N13 | „In den Vokabeltrainer“ | tippt | mit Satz als Ursprung | 2 | `translate/store.ts` | `vocab/*` `src:'translate'` | fertig · ✗ „nicht einfach in den Wortschatz“ |
| N14 | Zuletzt übersetzt (5) | tippt | – | 1 | `translate/history.ts` | localStorage | fertig |
| N15 | Wort antippen überall ★ | tippt Wort | – | 1 | `e/EnglishText.tsx`, `e/wordTap.ts`, `f/lookup/store.ts` | – | fertig |
| N16 | Popover: Wörterbuch sofort, Grundform, US-Lautschrift | liest | CMU-IPA eingebettet | – | `f/lookup/LookupPopover.tsx`, `d/lexicon/dict.ts`, `pron.ts`, `src/content/pron/us-ipa.json` | – | fertig |
| N17 | „Hier im Satz“ (KI, zwischengespeichert) | – | `quick` | – | `d/lookup/resolve.ts`, `cache.ts`, `p/wordLookup.ts` (word-lookup@2) | `app/lookup` | fertig |
| N18 | Anhören | tippt | – | – | `LookupPopover.tsx` | – | fertig |
| N19 | Als Karte speichern (mit Ursprungssatz), „In deinen Karten · Stufe n“ | tippt | ergänzt Satz an bestehender Karte | – | `f/lookup/store.ts` | `vocab/*` | fertig |
| N20 | „Claude fragen“ zum Wort ★ | tippt | fertige Frage mit Bezug | – | `LookupPopover.tsx` → `openCompanion` | – | fertig |

### O. Dein Stand / Fortschritt (19)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| O1 | Kopfkarte Serie · Kurs · Wörter | liest | – | 1 (Stand) | `f/progress/ProgressScreen.tsx`, `d/overview.ts` | `app/profile`, `app/course`, `vocab/*` | fertig (acceptance) |
| O2 | Wochenstreifen (7 Ringe) ★ M7 | liest | Pflicht erledigt / Ruhetag / offen / verpasst / kommt | 1 | `f/progress/StandHeader.tsx` `WeekStrip` | `app/profile.pflicht` | fertig |
| O3 | Niveau-Skala mit Unsicherheitsband ★ M7 | liest | B1 … C1+ | 1 | `StandHeader.tsx` `LevelScale`, `d/assessment/levelBar.ts` | `app/assess` | fertig |
| O4 | KI-Einschätzung (Urteil) | liest | Gesamtstufe, Trend, Begründung, Vorschlag für heute | 2 (Stand › Urteil) | `f/progress/JudgeTab.tsx`, `assessRun.ts`, `p/assess.ts` (assess@2, `complex`) | `app/assess` | fertig (progress) |
| O5 | Fertigkeiten mit Datenlage | liest | 6 Fertigkeiten, dünn/brauchbar/gut | 2 | `JudgeTab.tsx`, `d/assessment/strength.ts` | `app/assess` | fertig |
| O6 | Stärken, Blocker mit „So geht es richtig“ + Üben | tippt „Üben“ | Sprung per `actionRoute` | 2 | `JudgeTab.tsx`, `f/progress/actionRoute.ts` | `app/assess` | fertig |
| O7 | Fokus der nächsten Tage (fließt in den Plan) | liest | – | 2 | `JudgeTab.tsx`, `d/assessment/planInput.ts` | `app/assess` | fertig |
| O8 | Neu einschätzen / auto (Stand öffnen, Pflicht erledigt) | tippt | Stopp, langsamer Hinweis, anderes Gerät | 2 | `assessRun.ts` | `app/assess` | fertig · A7: Emrahs Rückmeldung zur Auto-Einschätzung beim Öffnen offen |
| O9 | Can-Do-Liste B2 → C1 „Kann ich“ | hakt ab | belegt / selbst / offen / zu wenig Daten | 2 (Stand › Ziel C1) | `f/progress/PathTab.tsx`, `d/progress/cando.ts` | `app/profile.canDo` | fertig · A7: „lange Can-Do-Liste“ zur Rückmeldung offen |
| O10 | Was laut Claude zu C1 fehlt | liest | – | 2 | `PathTab.tsx` | `app/assess` | fertig |
| O11 | Wochen-Check ★ M10 | macht 12 Aufgaben ohne Tipps | Vergleich mit letztem Check, Themen, Wörter | 3 (Stand › Verlauf) / 1 (Heute) | `f/check/CheckScreen.tsx`, `session.ts`, `d/check/*`, `f/progress/ChecksCard.tsx` | `app/profile.checks` | fertig · kein Fortsetzen |
| O12 | Bisherige Checks (Tabelle) | klappt auf | – | 3 | `ChecksCard.tsx` | `app/profile.checks` | fertig |
| O13 | Wochenbericht „was du wirklich dazugelernt hast“ | liest | Fakten + Claude-Text, Nächster Schritt, Als Preply-Stunde | 2 (Stand › Verlauf) | `f/progress/HistoryTab.tsx` `Weekly`, `weeklyRun.ts`, `d/progress/weekly.ts`, `p/weeklyReport.ts` (weekly-report@2) | `app/weekly` | fertig |
| O14 | Verlauf 120 Tage (Liniendiagramm, Tabelle) | klappt auf | Grammatik, Wörter, Hören, Schreiben | 3 | `HistoryTab.tsx`, `ui/charts/LineChart.tsx`, `d/progress/history.ts` | `app/profile.history` | fertig |
| O15 | Aktivitäts-Heatmap 26 Wochen | klappt auf | – | 3 | `ui/charts/Heatmap.tsx` | `app/profile.minutes` | fertig |
| O16 | Einschätzungen und Meilensteine | klappt auf | – | 3 | `HistoryTab.tsx` | `app/assess`, `app/course` | fertig |
| O17 | Letzte Fortschritte der alten App | klappt auf | nur lesen | 3 | `ChecksCard.tsx` `LegacyFeedFold` | `app/profile.feed` | fertig |
| O18 | Messwerte (FSRS, BKT, Trefferquote, Hartnäckige) | klappt auf | – | 3 | `d/progress/measures.ts` | `vocab/*`, `grammar/*` | fertig |
| O19 | Deutsch-Fallen-Wochenzeile im Verlauf | liest | – | 3 | `HistoryTab.tsx` `PatternsWeekly` | `app/patterns` | fertig |

### P. Einstellungen (15)
| # | Funktion | Was Emrah tut | Optionen / Tiefe | Einstieg (Tipps) | Haupt-Dateien | Daten | Zustand |
|---|---|---|---|---|---|---|---|
| P1 | Sprache der Oberfläche | wählt | Deutsch / Englisch | 2 (Zahnrad) | `f/settings/SettingsSheet.tsx`, `app/actions.ts` | `app/profile.lang` | fertig (settings) |
| P2 | Darstellung | wählt | Dunkel · Gedämpft · Hell · Automatisch | 2 | `app/settings.ts` | `app/profile.theme.m` | fertig |
| P3 | Farbthema ★ M21 | wählt | Salbei · Ozean · Pflaume · Graphit | 2 | `SettingsSheet.tsx`, `src/styles/index.css` | `app/profile.theme.p` | fertig |
| P4 | Neue Wörter pro Tag | wählt | 0/2/5/10 | 2 | `f/settings/LearningSection.tsx` | `app/profile.newPerDay` | fertig |
| P5 | Tagesziel in Minuten | wählt | 10/15/20/25/30/40, ab nächstem Plan | 2 | `LearningSection.tsx` | `app/profile.goalMin` | fertig |
| P6 | Automatisch weiter ★ M6 | schaltet | – | 2 | `SettingsSheet.tsx` | `app/profile.autoNext` | fertig |
| P7 | Töne | schaltet | – | 2 | `LearningSection.tsx` | `app/profile.sound` | fertig |
| P8 | Vibration | schaltet | Hinweis „iPhone kann nicht“ | 2 | `f/settings/HapticSection.tsx` | `app/profile.haptic` | fertig |
| P9 | Stimme, Tempo, Probehören, Vorlesen im Rollenspiel | wählt | fehlende Stimme → beste US | 2 | `f/settings/VoiceSection.tsx` | `app/profile.voice/rate` | fertig (voice) |
| P10 | Beruflicher Kontext ★ M22 | schreibt ≤ 400 Zeichen | steuert Fachwörter, Texte, Szenen | 2 | `f/settings/WorkContextSection.tsx`, `p/work.ts` | `app/profile.ctx` | fertig |
| P11 | Datenexport als JSON | tippt | über `downloads` | 2 | `f/settings/exportData.ts` | alle | fertig |
| P12 | Diagnose | liest, kopiert Protokoll | Fähigkeiten, Dokumente von 5.000, App-/Datenversion, Chat-/Preply-/Entdecken-Zahlen, Fehlerprotokoll | 2 | `SettingsSheet.tsx`, `diagText.ts`, `src/platform/diagnostics.ts` | – | fertig |
| P13 | Profilgröße, Jahre auslagern | tippt | Probelauf | 2 | `f/settings/compactRun.ts` | `archive/*` | halb: `COMPACT_ENABLED = false` (A7: „`writer.compact` bleibt aus“) |
| P14 | Quellen und Lizenzen | liest | – | 2 | `SettingsSheet.tsx` | – | fertig |
| P15 | Kommentare in der App als Testweg ★ | kommentiert | – | – | (Artefakt-Plattform, kein App-Code) | – | Prozess |

**Summe: 241 Funktionen** (A 14 · B 20 · C 25 · D 17 · E 14 · F 10 · G 6 · H 27 · I 16 · J 15 · K 9 · L 9 · M 5 · N 20 · O 19 · P 15; ohne die Sonderzeile P15 = 240).

### Was Emrah gewünscht hat und heute fehlt
| Wunsch | Stand | Anknüpfung im Code |
|---|---|---|
| **Anki-Modus** (Aufdecken + Nochmal/Schwer/Gut/Leicht, Optik aus `docs/prototyp/v1.html`) ★ | fehlt; widerspricht A7 18:15 „keine Selbstbewertung“ → Entscheidung im Neubau-Plan festhalten | Noten 1–4 und FSRS gibt es schon: `d/srs/grade.ts`, `scheduler.ts`, `applyReview.ts`; alte Texte `grade1–4`, `trSuggest`, `trRateLabel` stehen noch in `src/i18n/de.ts` |
| **Weiter, wo ich war** nach Absturz/Neuladen ✗ | fehlt für Trainer, Grammatik, Drills, Wochen-Check, Wortschatztest (Sitzungen nur im Speicher) | Antworten sind je Antwort gespeichert (`f/progress/persist.ts`); nur der Rundenstand fehlt |
| **Fehlergrenzen** („stürzt ab“) ✗ | fehlen vollständig (kein `ErrorBoundary`) | `src/platform/diagnostics.ts` protokolliert `window.error` |
| Ein Einstieg zum Vokabeltrainer ✗ | nur über Heute-Pflicht, Blatt „Freie Runde“ oder Wortblatt „Jetzt üben“ | `f/vocab/session.ts` `startSession` |
| Übersetzer → Wortschatz in einem Tipp ✗ | Knopf vorhanden, als umständlich kritisiert | `f/companion/translate/store.ts` |
| Chat kann handeln (Werkzeuge) ★ | nur lokale Aktions-Chips | `f/companion/ChatPane.tsx`, `d/companion/suggest.ts` |

---

## 3. Wiederverwendbar ohne Änderung

Diese Teile sind von der Oberfläche getrennt, getestet und können im neuen Rahmen **direkt** genutzt werden.

| Schicht | Inhalt | Hinweis |
|---|---|---|
| Daten `src/data/*` | `writer.ts` (einziger Schreibpfad), `live.ts` (Live-Abos), `snapshot.ts`, `schemas.ts`, `paths.ts` (11 App-Dokumente, 22 Sammlungen), `validate.ts` (Cache), `reads.ts`, `watch.ts` | unverändert lassen (data-guard) |
| Plattform `src/platform/*` | `capabilities`, `runtime`, `storage`, `diagnostics`, `downloads`, `speech`, `stt`, `sound`, `haptics`, `legacyLocal`, `dev/*` | unverändert |
| KI-Tor `src/ai/*` | `gate` (inkl. `repairJson`), `stream`, `queue`, `abort`, `errors`, `status`, `scope`, `useAsk`, `useStream` | unverändert |
| Vorlagen `src/prompts/*` | 38 Vorlagen: apply-check, assess, card-examples, companion-chat, course-extend, fluency-check, grammar-items, grammar-judge, lesson-content, lesson-production, listening-text, mail-refine, meeting-debrief, meeting-prep, mnemonic, pattern-check, patterns, phrase-adapt, pitch-feedback, pitch-script, preply-import, preply-prep, produce-check, reading-check, reading-text, repair-check, roleplay-report, roleplay-turn, say-check, scene-gen, tone-check, translate, turn-analysis, weekly-report, word-gen, word-lookup, writing-prompt, writing-review (+ `common`, `work`, `tolerant`, `threeLayers`) | unverändert |
| Domäne `src/domain/*` | answer, assessment, business, capacity, check, chunks, companion, course, date, discover, drills, fluency, grammar, input, lang, learn, lexicon, lookup, meeting, migration, overview, patterns, plan, preply, progress, radar, repair, say, speak, srs, streak, text, tones, vocab, vtest | reine Logik mit Unit-Tests |
| Inhalte `src/content/*` | Lehrplan, 16 Regeln + C1-Werkzeugkasten, Startvokabeln, Szenen, Playbooks, Situationen, Flüssigkeitsfragen, Tonlagen-Sachverhalte, Wörterbuch, US-Lautschrift, Wortschatztest | unverändert |
| Interaktions-Kern `src/engine/*` | `KineticGap`, `HiddenInput`, `Tiles`, `Choices`, `EnglishText` + `wordTap`, `AudioBar`, `SpeakButton`, `MicButton`, `SentenceDiff`, `Markdown`, `MarkedText`, `CardStatus`, `Ladder`, `ExerciseFrame`, `swipe`, `useHotkeys` | unverändert |
| UI-Bausteine `src/ui/*` | `Button`, `Sheet` + `sheetDrag`, `Segmented`, `Tabs`, `Fold`, `Disclosure`, `Toast`, `Skeleton`, `ProgressRing`, `Stepper`, `Switch`, `ExternalLink`, `Icon`, `charts/*`, `chat/*` | optisch an v1 anpassen (Tokens), Logik bleibt |
| Stores und Abläufe (ohne Bildschirm) | `f/vocab/session.ts`, `persist.ts`, `examples.ts`, `list/actions.ts`; `f/grammar/session.ts`, `generate.ts`; `f/drills/session.ts`; `f/check/session.ts`; `f/vtest/machine.ts`; `f/course/lessonMachine.ts`, `lessonRun.ts`, `extendCourse.ts`; `f/today/store.ts`, `state.ts`; `f/learn/flow.ts`, `inputs.ts`; `f/speak/roleplayMachine.ts`, `useRoleplay.ts`, `analysisLane.ts`, `persist.ts`, `resume.ts`, `useSceneLibrary.ts`; `f/business/mailMachine.ts`, `pitchMachine.ts`, `persist.ts`; `f/preply/store.ts`, `actions.ts`, `importMachine.ts`; `f/companion/store.ts`, `persistChat.ts`, `seeing.ts`, `translate/store.ts`, `history.ts`; `f/lookup/store.ts`; `f/input/*` (aiTasks, library, complete, draft, derive, cards, activeClock); `f/read|listen|write|discover/machine.ts`; `f/repair/store.ts`, `review.ts`; `f/patterns/store.ts`; `f/say|fluency|meeting|tones/persist.ts`; `f/progress/persist.ts`, `assessRun.ts`, `weeklyRun.ts`, `dayJobs.ts`, `actionRoute.ts`; `f/settings/exportData.ts`, `diagText.ts`; `f/migration/*` | Sitzungen um „speichern und fortsetzen“ **ergänzen** (nicht umbauen) |
| Übungskomponenten zum Einhängen | `f/vocab/ExerciseView.tsx` (alle 14 Arten), `IntroCard`, `f/repair/RepairItem`/`RepairStep`, `f/grammar/GrammarItem`, `f/drills/DrillItems` + `SprintView`, `f/course/LessonSteps`, `f/read/ReadUnit`/`ArticleView`/`SummaryStep`, `f/listen/ListenUnit`/`TranscriptView`, `f/write/WriteUnit`/`ReviewView`/`PromptCard`, `f/discover/steps`, `f/speak/RoleplayScreen` + `ChatLog`/`AnalysisCard`/`Composer`/`TakeChunkButton`/`ReportScreen`, `SituationDrill`, `f/say/SayScreen`, `f/fluency/FluencyScreen`, `f/tones/TonesScreen`, `f/meeting/MeetingScreen`, `f/business/MailRefiner`/`PlaybookDrill`/`PitchCoach`/`TilePicker`, `f/patterns/PatternDrill`/`FreeItem`, `f/vtest/VtestScreen`, `f/check/CheckScreen`, `f/lookup/LookupPopover`, `f/companion/*` (Overlay, ChatPane, TranslatePane), `f/vocab/list/WordSheet`/`AddWordSheet`, `f/grammar/TopicSheet`, `f/settings/*Section`, `f/progress/JudgeTab`/`ErrorsTab`/`PathTab`/`StandHeader`, `f/preply/PrepForm`/`PlanView`/`ImportPane`/`ImportReview`/`HeldSheet` | Inhalt bleibt; **Kopfzeile tauschen**: sie bringen heute eigene `ExerciseTop`/`RoundTop`/`ScreenHeader` aus `f/learn/ui.tsx` mit |

## 4. Muss neu

| Teil | Datei(en) | Warum |
|---|---|---|
| Rahmen und Bildschirmwahl | `app/App.tsx` (28 Einzelzuweisungen, TabBar), `app/nav.ts` (Routenmodell ohne Fortsetzen), `app/modules.ts` (nur 4 Module), `app/sheets.ts` | neue Reiter/Journeys, Fehlergrenzen je Übung, Fortsetzen-Zustand, Anki-Stapel als Route |
| Reiter-Hubs | `f/learn/LearnHub.tsx` (5 Abschnitte, 12 Einstiege), `f/speak/SpeakHub.tsx` (3 Segmente + Training unter der Szenenliste), `f/business/BusinessHub.tsx`, `f/preply/PreplyScreen.tsx` (Reiter im Segment) | ✗ „überladen, keine klare User Journey“, „zu verschachtelt“ |
| Stand | `f/progress/ProgressScreen.tsx` (Kopf + 3 Karten + 4 Reiter), `f/progress/HistoryTab.tsx` (Check, Test, Bericht, 5 Faltbereiche) | Wortschatztest und Wochen-Check 3 Tipps tief, alles in einem Reiter |
| Heute (Ansicht) | `f/today/TodayScreen.tsx` | Logik (`store.ts`, `state.ts`, `flow.ts`) bleibt; Ansicht für neue Tageseinheit/Journey |
| Listen- und Bibliotheksseiten | `f/course/CourseScreen.tsx`, `f/grammar/GrammarScreen.tsx`, `f/grammar/WissenScreen.tsx`, `f/vocab/list/VocabScreen.tsx`, `f/discover/DiscoverScreen.tsx`, `f/read/ReadScreen.tsx`, `f/listen/ListenScreen.tsx`, `f/write/WriteScreen.tsx`, `f/input/HistoryScreen.tsx` | im neuen Rahmen einheitlich (Wortschatz mit Stapeln, Lesen-Bibliothek zusammengelegt) |
| Vokabel-Einstieg und Anki-Sitzung | neuer Bildschirm neben `f/vocab/TrainerScreen.tsx` | ★ Anki-Modus, ✗ „Trainer nicht auffindbar“ |
| Titel-Aktionen und Übungsleiste | `f/system/Chrome.tsx`, `f/learn/ui.tsx` (`ExerciseTop`, `RoundTop`, `DutyBar`, `ScreenHeader`) | ein gemeinsamer Übungs-Player mit Fortsetzen und Fehlergrenze |
| Einstellungen (Gliederung) | `f/settings/SettingsSheet.tsx` | Sektionen bleiben, Anordnung/Ort neu (Profil-Knopf laut Konzept) |
| Aufräumen | `f/system/WhatsNew.tsx` (nicht eingehängt), `COMPACT_ENABLED = false`, veraltete Texte `grade1–4`/`trSuggest`/`purpose*` in `src/i18n/de.ts` | toter oder abgeschalteter Code, bewusst entscheiden |
