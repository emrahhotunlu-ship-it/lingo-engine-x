# Funktionsinventar Lingo-Engine X (Stand Branch `claude/umbau-fokus`, 02.11.2026)

Nur gelesen, nichts geändert. Die Wege gelten am Handy und beginnen beim Öffnen der App auf dem Reiter **Heute**. Ein Reiterwechsel zählt als 1 Tap.

**Spalten**
- **Status:** DA, TEILWEISE oder FEHLT.
- **Versteckt:** ja, wenn mindestens eines davon zutrifft: drei oder mehr Taps, nur in den Einstellungen, nur über das Menü „…“, nur über das Fragen-Blatt, nur bei einem bestimmten Datenstand oder ohne sichtbaren Hinweis.

**Wichtig vorab: wie man an Einstellungen, Übersetzer und Fragen kommt**
- **Einstellungen:** Das Zahnrad steht am Handy nur auf dem Reiter **Fortschritt** (`src/app/shell/TopBar.tsx:47`). In Übungen sind die Einstellungen am Handy nur über das Menü „…“ erreichbar (`src/features/system/Chrome.tsx:119`).
- **Übersetzer:** Er hat am Handy keinen eigenen Knopf. Man erreicht ihn nur über „Fragen“ und dann den Reiter „Übersetzen“, oder in Übungen über das Menü „…“.
- **Ohne KI:** Ist die KI nicht freigegeben, verschwinden „Fragen“ und der Übersetzer ganz.

Quellen-Kürzel: A = `docs/auftrag.md` (Kap.), LÜ = `docs/relaunch/vorschau/luecken.md` (Nr.), BL = `docs/relaunch/vorschau/bauliste.md` (H/L), GA = `docs/umbau/vokabeln/grosspaket-a.md` (V), GK = `docs/umbau/gesamtkonzept.md`, ALT = `docs/altapp-analyse.md`.

---

## 1. Heute

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| Tageskarte mit Ring und EINEM Start-Knopf | A 2 Nr.1, 6.1 | DA | „Start“ (1) | nein | src/features/today/TodayScreen.tsx |
| Fester Tagesplan (würfelt nicht neu), erledigt = Zustand | A 2 Nr.2, A 15 | DA | 0 | nein | src/domain/unit/planFor.ts |
| „Wenn du mehr willst“ (Pflicht/Freiwillig getrennt, max. 3 Zeilen) | A 2 Nr.6, BL H1 | DA | 0 (scrollen) | nein | src/features/today/ExtraRow.tsx:171 |
| „Alles anzeigen“ (Blatt mit allen Angeboten) | BL H1 | DA | „Alles anzeigen“ (1) | ja (nur wenn mehr als 3 Angebote) | src/features/today/ExtraRow.tsx:158 |
| Extra „Wörter üben“ | BL H1 | TEILWEISE (startet den ALTEN Trainer, auch wenn die neue Wörter-App an ist) | 1 | ja (nur nach erledigter Pflicht und wenn Wörter fällig sind) | src/features/today/ExtraRow.tsx:50 |
| Extra „Heute falsch – nochmal“ | LP 2.0 | DA | 1 | ja (nur bei falschen Wörtern heute) | src/features/today/ExtraRow.tsx:78 |
| Extra „Am Laptop vertiefen“ | LP 2.0 | DA | 1 (nur Laptop) | ja (nur mit Tastatur-Profil) | src/features/today/ExtraRow.tsx:65 |
| Extra „Sprechen“ | GK | DA | 1 | nein | src/features/today/ExtraRow.tsx:93 |
| Wochen-Check als Angebot | A 6.13, LP 3 | TEILWEISE | montags 1, sonst nur über das Profil-Blatt (3) | ja (nur montags und erst ab 40 Antworten) | src/features/today/ExtraRow.tsx:103 |
| Wochenbericht-Band | A 6.13 | DA | montags 1 | ja (nur montags) | src/features/today/TodayScreen.tsx (weekly-band) |
| Neustart-Woche / Willkommen zurück nach Pause | BL H1 | DA | 0 | ja (erst nach 14 Tagen Pause) | src/features/today/TodayScreen.tsx:243 |
| Abschlusskarte (Bilanz, Meilenstein, Ziel, Morgen) | LP 3 R2 | DA | 0 nach der Runde | nein | src/features/today/DoneCard3.tsx |
| Wochenstreifen und Serie | A 7 | DA | 0 | nein | src/features/today/TodayWeek.tsx |
| Zusatzkarten (C1-Tor, C1-Check, Satz-Klinik, Wochen-Mail) | LP 3 | DA | 1 | ja (nur bei passendem Datenstand) | Slot `today.extra` |
| Urlaub ankündigen | LÜ (Muss) | FEHLT | – | – | nicht gefunden |
| Ruhetag selbst wählen | LÜ | FEHLT (der Ruhetag wird nur automatisch angerechnet) | – | – | nicht gefunden |
| „Kurzer Tag“ (weniger Pflicht) | LÜ | FEHLT | – | – | nicht gefunden |
| „So funktioniert's“ | BL H37, LÜ | FEHLT | – | – | nicht gefunden |

## 2. Wörter (neue Wörter-App und alter Wörter-Reiter)

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| Neue Wörter-App einschalten | GA, Kompass | TEILWEISE (nur auf dem Test-Link, standardmäßig aus) | Fortschritt › Zahnrad › Wortschatz › Schalter „Neue Wörter-App“ (3, plus Scrollen) | ja (nur in den Einstellungen) | src/areas/wortschatz.tsx:281 |
| Pflichtrunde der neuen App (Lernkarte, „Kenne ich schon“, „War das auch richtig?“, Warum heute, Abschluss) | GA V3 | DA, wenn eingeschaltet | Heute › Start (1) | ja (nur mit Schalter) | src/areas/wortschatz.tsx (reviewBlock), src/modules/vocab/ui/LearnScreen.tsx |
| Wörter-Reiter zeigt die neue App | GA | FEHLT: Der Reiter zeigt weiter den alten Bereich mit dem alten Trainer. Der Platz `vocab.hub` ist leer, deshalb wechselt man ständig zwischen alter und neuer Welt. | – | – | src/features/vocab/hub/VocabHub.tsx:248 |
| „Noch 5“ | GA V3 | DA | nur am Ende der Runde | ja (nur in der Runde) | src/modules/vocab/ui/LearnScreen.tsx:198 |
| Freies Üben (vlearn free) | GA V4 | FEHLT (Art vorhanden, kein Knopf) | – | ja (kein Einstieg) | src/areas/wortschatz.tsx:64 |
| Abend-Check der neuen App (vlearn evening) | GA | FEHLT (kein Einstieg) | – | ja | src/areas/wortschatz.tsx:64 |
| Wochen-Check der neuen App (vlearn week) | GA | FEHLT (kein Einstieg) | – | ja | src/areas/wortschatz.tsx:64 |
| Fehlwörter der neuen App (vlearn mistakes) | GA | FEHLT (kein Einstieg) | – | ja | src/areas/wortschatz.tsx:64 |
| Anwenden (Mail/Slack/Call, eigener Satz, Spracheingabe) | GA V4 | TEILWEISE (nur innerhalb der Runde) | nur in der Runde | ja | src/modules/vocab/ui/LearnScreen.tsx:206, src/modules/vocab/ui/UseCard.tsx |
| Wort-Seite (vword, „Dieses Wort üben“, „Claude fragen“) | GA V4 | DA, wenn eingeschaltet | Wort antippen › Wort-Blatt (2) | ja (nur über das Antippen, nur mit Schalter) | src/areas/wortschatz.tsx (WordSheetSwitch) |
| Übersicht (14-Tage-Minuten, Behaltensrate) | GA V4 | DA, wenn eingeschaltet | Fortschritt › Wörter (1–2) | ja (nur mit Schalter, steht unter Fortschritt statt unter Wörter) | src/features/vocab/vmod.slot.tsx:24 |
| Einstufung (vplace) | GA V5 | DA | Fortschritt › Wörter › Einstufung (3) oder über die Einstellungen | ja | src/features/vocab/vmod.slot.tsx, src/areas/wortschatz.tsx |
| Gewichtung neuer Wörter, Wortlisten | GA V5 | DA | Einstellungen › Wortschatz (3+) | ja (nur in den Einstellungen) | src/areas/wortschatz.tsx:281 (WordSettings) |
| Kontingent neue Wörter 0/2/5/10 | A 6.3 | DA | Einstellungen › Wortschatz (3+) | ja | src/areas/wortschatz.tsx:282 |
| Alter Trainer „Wiederholen“ | A 6.3 | DA | Wörter › Wiederholen (2) | nein | src/features/vocab/hub/VocabHub.tsx:173 |
| Abfragearten (Tippen/Anki-Karte/Auto/Hören) | A 6.3, A 15 | DA | Wörter › Modus-Textknopf (2) | nein | src/areas/wortschatz.tsx:51 |
| Wörter-Suche | A 6.3 | DA | Wörter › Lupe (2) | nein | src/features/vocab/hub/VocabHub.tsx:139 |
| Wort hinzufügen | A 6.3 | DA | Wörter › „+“ (2) | nein | src/features/vocab/hub/VocabHub.tsx:140 |
| Ziel „X von 8.000“, C1-Marke | A 6.3 | DA | Wörter (1) | nein | src/features/vocab/hub/VocabHub.tsx |
| Neue Wörter heute | A 6.3 | DA | Wörter (1) | nein | src/features/vocab/hub/VocabHub.tsx |
| Alle Wörter (Liste) | BL H23 | DA | Wörter › Alle (2) | nein | src/features/vocab/hub/VocabHub.tsx |
| Wort bearbeiten | BL H23 | TEILWEISE: Bedeutung und Satz lassen sich ändern. Löschen und Pausieren gibt es nicht. | Wörter › Alle › Wort › Bearbeiten (4) | ja | src/features/vocab/list/actions.ts:45 |
| Stapel „Schwierig“ | A 6.3 | DA | Wörter › Schwierig (2) | nein | src/features/vocab/hub/VocabHub.tsx |
| Alle Stapel, Eingangskorb, Prognose, neuer Stapel | BL H17 | DA | Wörter › „Alle Stapel ›“ › … (3) | ja | src/features/vocab/hub/VocabHub.tsx:288 |
| Atlas | GK | DA | Wörter › Atlas (2, weit unten) | nein | src/features/vocab/hub/VocabHub.tsx:292 |
| Blatt „Mehr üben“ (neu, schwer, Dauerfehler, Fehler, vergessen, morgen) | BL H33 | DA | Wörter › „Mehr üben ›“ › Zeile (3) | ja (kleiner grauer Text-Link) | src/features/vocab/hub/VocabHub.tsx:295, src/features/vocab/hub/Sheets.tsx:163 |
| Abend-Check (alt), „Sag es selbst“ | LP 3 | DA | Wörter › Angebot (2) | ja (nur bei passendem Datenstand) | src/features/vocab/hub/VocabHub.tsx |
| Hörschleife | LP 3 | DA | Praxis › Hörschleife (2) | ja (nur mit Sprachausgabe) | src/features/apply/ApplyHub.tsx:141 |
| Meine Wendungen (eigene Ansicht) | LÜ (Soll) | FEHLT: Wendungen stehen nur als Karten in den Stapeln. | – | – | nicht gefunden |
| „Zu leicht“ (Wort überspringen) | LÜ | TEILWEISE: „Kenne ich schon“ gibt es nur in der neuen App. | in der Runde | ja (nur mit Schalter) | src/modules/vocab/ui/LearnScreen.tsx |

## 3. Grammatik

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| „Du bist hier“ mit Hauptknopf | BL H6 | DA | Grammatik › Start (2) | nein | src/features/learn/HereCard.tsx |
| Kapitelliste „Dein Weg zu C1“ | LP 3 R3 | DA | Grammatik (1) | nein | src/features/learn/LearnHub.tsx:59 |
| Kapitel-Seite (Start, Fehler, Lehrer) | LP 3 | DA | Grammatik › Kapitel (2) | nein | src/features/c1/ChapterSheet.tsx:181 |
| C1-Reise (journey) | LP 3 | DA | Grammatik › Kapitel › „Reise“ (3) | ja (einziger Einstieg, nur auf der Kapitel-Seite) | src/features/c1/ChapterSheet.tsx:182 |
| Kapitel-Film, Notiz für den Lehrer kopieren | LP 3 | DA | Grammatik › Kapitel › Knopf (3) | ja | src/features/c1/ChapterSheet.tsx |
| „Fehler korrigieren“ (fällige Fehlersätze) | LP 3 FK | DA | Grammatik › Zeile (2) | ja (nur wenn etwas fällig ist) | src/features/learn/LearnHub.tsx:64 |
| Regeln (wissen) | GK | DA | Grammatik › „Regeln“ (2) | nein (aber nur kleiner Text-Link) | src/features/learn/LearnHub.tsx:88 |
| Deutsch-Fallen (patterns) | GK | DA | Grammatik › „Fallen“ (2) | nein (kleiner Text-Link) | src/features/learn/LearnHub.tsx:91 |
| Themen-Suche (grammar) | A 6.4 | DA | Grammatik › „Suche“ (2) | nein (kleiner Text-Link) | src/features/learn/LearnHub.tsx:94 |
| Alle 39 Themen mit Themenblatt | GK | DA | Grammatik › „Alle Themen“ aufklappen › Thema (3) | ja (eingeklappt) | src/features/learn/LearnHub.tsx:106 |
| Einstufung Grammatik | LP 3 | DA | Grammatik (scrollen) › Karte (2) | nein | Slot `grammar.foot` (PlacementCard) |
| Grammatik frei üben | BL H27 | DA | Grammatik › „Mehr üben“ › „Frei üben“ (3) | ja (leiser Knopf) | src/features/learn/LearnHub.tsx:121, src/features/vocab/hub/Sheets.tsx |
| Lehrer-Feedback einfügen | GK, ersetzt die Preply-Brücke | DA | Grammatik › Zeile (2) | nein | src/areas/wortschatz.tsx:269 |
| Meine Fehler (Liste) | BL H26 | DA | Fortschritt › Grammatik (2) | nein | src/features/progress/GrammarSegment.tsx |
| Grammatik-Diagnose | LP 3 Tutor | DA | Fortschritt › Grammatik (2) | nein | Slot `progress.grammar` |
| Erklärung „Warum“ auch bei richtiger Antwort | A 2 Nr.4 | DA | in jeder Übung | nein | src/features/exercise (Auswertung) |
| Aufgabenarten Paare, Konnektoren, Register-C1, Paraphrase (pair/cnet/reg/para) | c1-aufgaben.md | FEHLT (Schalter aus) | – | – | src/app/flags.ts |
| Tutor „explain“ / „gen“ | tutor-engine-v3 | FEHLT (Schalter aus) | – | – | src/app/flags.ts |

## 4. Praxis (Sprechen, Rollenspiel, Einwand, Lesen, Hören, Schreiben, Übersetzer)

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| Praxis-Reiter mit „Jetzt“-Kachel | BL | DA | Praxis (1) | nein | src/features/apply/ApplyHub.tsx |
| Wiederholungsrunde Fehlersätze (repairRound) | LP 3 | DA | Praxis › Kachel (2) | ja (nur wenn mehr Fehlersätze fällig sind) | src/features/apply/ApplyHub.tsx |
| Wortpartner, Umformen, Wortform, Register, Phrasal Verbs, Übergänge | LP 3, training | DA | Praxis › Kachel (2) | nein | src/areas/training.tsx:51-56 |
| Satzbau (order) | A 6.7 | DA | Praxis › Satzbau (2) | nein | src/features/apply/ApplyHub.tsx |
| Umformen C1 (kwt), Fehler finden (err) | LP 3 R1 | DA | Praxis › Kachel (2) | nein | src/features/apply/ApplyHub.tsx |
| Tempo-Runde | LP 3 R2 | DA | Praxis › Tempo (2) | nein | Slot `apply.tiles` (TempoTile) |
| Satz-Klinik / Prüfen | BL H36 | DA | Praxis › Satz-Klinik (2) | nein | Slot `apply.tiles` |
| Schreiben / Wochen-Mail | A 6.8, BL H32 | DA | Praxis › Schreiben (2) | nein | Slot `apply.tiles` |
| Hörfragen (listenQ) | A 6.8 | DA | Praxis › Hörfragen (2) | ja (nur mit Sprachausgabe und KI) | src/features/apply/ApplyHub.tsx:140 |
| Diktat | A 6.7 | TEILWEISE (am Handy eingeklappt, Kennzeichen „Laptop“) | Praxis › „Übungen für den Laptop“ › Diktat (3) | ja | src/features/apply/ApplyHub.tsx:142, :211 |
| Eigener Satz (comboSentence) | LP 2.0 | DA | Praxis › „Übungen für den Laptop“ › Eigener Satz (3) | ja (eingeklappt, nur mit KI und Wortpaaren) | src/features/apply/ApplyHub.tsx:139 |
| Lückenjagd (cloze) | A 6.7 | DA | Praxis › „Mehr“ › Lückenjagd (3) | ja (eingeklappt) | src/features/apply/ApplyHub.tsx:144, :232 |
| Sprint | A 6.7, ALT | FEHLT (Route da, kein Knopf; laut LÜ Nr.45 bewusst gestrichen) | – | ja (verwaist) | src/areas/lernen.tsx (drill sprint) |
| Sprechen-Übersicht mit Szenen | A 6.5 | DA | Praxis › Sprechen (2) oder Heute › Sprechen (1) | nein | src/features/speak/SpeakHub.tsx |
| Rollenspiel mit Spracheingabe, Analyse, „Wendung mitnehmen“, Bericht | A 6.5 | DA | Praxis › Sprechen › Szene › Starten (4) | ja (mindestens 3 Taps) | src/features/speak/RoleplayScreen.tsx:179, src/features/speak/Composer.tsx |
| Business- und KI-Szenen | A 6.5, A 6.6 | FEHLT (ausgefiltert) | – | – | src/features/speak/SpeakHub.tsx:43 |
| Einwand-Training | GK | DA | Praxis › Sprechen › Einwand-Training (3) | ja | src/areas/training.tsx:60 |
| „Hot Seat“ und „Zeit gewinnen“ (Druck-Übungen) | LP 3 | FEHLT (Inhalte und Route da, kein Knopf) | – | ja (verwaist) | src/areas/training.tsx:45 |
| Business-Suite (E-Mail-Refiner, Phrasen-Baukasten, Präsentations-Coach) | A 6.6 | TEILWEISE: Satz-Klinik und Wochen-Mail gibt es. Phrasen-Baukasten und Präsentations-Coach fehlen. | Praxis (2) | nein | Slot `apply.tiles` |
| Lesen: Tagesartikel und Leser | A 6.8, LP 3 | DA | Praxis › Lesen › Artikel (3) | ja (Lesen ist kein Reiter mehr) | src/modules/read/index.ts:32 |
| Lesekurse K1–K9 mit Lektionen | lesen-kurse.md | DA | Praxis › Lesen › Kurs › Lektion (4) | ja | src/modules/read/index.ts:34 |
| Lese-Archiv (alte Artikel) | BL H35 | TEILWEISE (als eigene Ansicht nicht gefunden) | – | ja | src/modules/read |
| Hörtexte (alte lpool) | ALT, A 6.8 | FEHLT (nur Hörfragen und Hörschleife) | – | – | nicht gefunden |
| Shadowing (Nachsprechen) | ALT | FEHLT als eigene Übung | – | – | nicht gefunden |
| Übersetzer (mit Register) | A 6.12 | DA | Fragen › Reiter „Übersetzen“ (2) | ja (nur über das Fragen-Blatt; am Handy kein eigener Knopf; ohne KI unsichtbar) | src/features/system/Chrome.tsx, src/features/companion/translate/TranslatePane.tsx |
| Entdecken / Feed | A 6.9, ALT | FEHLT | – | – | nicht gefunden |
| Preply-Brücke / Preply-Zettel teilen | A 6.10, LÜ | TEILWEISE: Lehrer-Feedback einfügen und Lehrer-Notiz kopieren gibt es. Stundenvorbereitung und Zettel fehlen. | Grammatik › Kapitel › Notiz kopieren (3) | ja | src/features/teacher/TeacherFeedbackScreen.tsx |

## 5. Claude / Fragen

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| „Fragen“-Knopf oben (Chat mit Kontext „sieht“ Bildschirm) | A 6.12, GK | DA | Fragen (1) | nein (fehlt aber ganz ohne KI-Freigabe) | src/features/system/Chrome.tsx, src/features/companion/CompanionOverlay.tsx |
| Chat: Anhang, neuer Chat, Größe/Minimieren | A 6.12 | DA | Fragen › … (2) | nein | src/features/companion/CompanionOverlay.tsx |
| Claude-Übung aus dem Chat oder Lehrer-Feedback (claudeDrill) | LP 3 | DA | Fragen › Chat › „Üben“ (3+) | ja (nur nach passendem Chat) | src/features/companion/ChatPane.tsx:87 |
| „Claude fragen“ im Wort-Popup | A 6.11 | DA | Wort antippen › „Fragen“ (2) | nein | src/features/lookup/LookupPopover.tsx (lk-ask) |
| „Claude merkt sich“ (Gedächtnis) | ki-tutor.md | DA | Fortschritt › Zahnrad › Kontext (3+) | ja (nur in den Einstellungen) | src/areas/profil.tsx:64 |
| Fragen/Übersetzer/Einstellungen in Übungen | A 4 | DA | Übung › „…“ › Eintrag (2) | ja (am Handy nur über das Menü „…“) | src/features/system/Chrome.tsx:119 |
| Tastatur „/“ = Übersetzer | A 4 | DA (nur Laptop) | – | ja (keine Anzeige) | src/features/companion/hotkeys |

## 6. Fortschritt

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| Kopf: feste Wörter und Niveau-Skala | A 6.13 | DA | Fortschritt (1) | nein | src/features/progress/ProgressScreen.tsx:121 |
| Weg zu C1 (Kopf) | LP 3 | DA | Fortschritt (1) | nein | Slot `progress.head` |
| Reiter Wörter / Grammatik / Rückblick | GK 3.5 | DA | Fortschritt › Reiter (2) | nein | src/features/progress/ProgressScreen.tsx:140 |
| KI-Einschätzung in Worten (Urteil) | A 2 Nr.3, A 6.13 | DA | Fortschritt › Rückblick (2) | nein | src/features/progress/JudgeTab.tsx |
| Verlauf | LÜ | DA | Fortschritt › Rückblick (2, scrollen) | nein | src/features/progress/HistoryTab.tsx |
| Wochenbericht / Wochenrückblick | A 6.13 | DA | Fortschritt › Rückblick › Eintrag (3), montags über Heute (1) | ja | Slot `progress.review` (WeeklyEntry) |
| Profil-Blatt (Serie, Stand, Tests, Rettung) | – | DA (laut LÜ Nr.85 eigentlich gestrichen) | Fortschritt › Profil-Knopf ohne Beschriftung (2) | ja (Knopf ohne Hinweis) | src/areas/profil.tsx, src/app/shell/TopBar.tsx:18 |
| Wochen-Check (checks) | A 6.13 | DA | Fortschritt › Profil › Wochen-Check (3) | ja | src/features/progress/profile/ProfileSections.tsx:167 |
| Wortschatztest (vtest) | ALT, A 6.13 | DA | Fortschritt › Profil › Wortschatztest (3) | ja | src/features/progress/profile/ProfileSections.tsx:168 |
| Meilensteine | A 7 | DA | nach der Runde (0) | ja (nur bei Erreichen) | src/features/today/DoneCard3.tsx |
| Heatmap / XP-Tagesziel (alt) | ALT | FEHLT (ersetzt durch Ring und Minuten) | – | – | nicht gefunden |
| „Aus diesem Browser nachtragen“ | CLAUDE.md A6 Nr.12 | DA | Fortschritt (1) | ja (nur bei Kopie im Browser) | src/features/progress/ProgressScreen.tsx:131 |

## 7. Einstellungen / Daten

Einstellungen öffnen = Fortschritt › Zahnrad (2 Taps). Jede Zeile hier hat damit mindestens 3 Taps und gilt als **versteckt**.

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| Einstellungen öffnen | A 6.14 | DA | Fortschritt › Zahnrad (2) | ja (Zahnrad nur auf Fortschritt) | src/app/shell/TopBar.tsx:47 |
| Tagesziel in Minuten | A 6.14, LÜ „Ziel ändern“ | DA | … › Lernen › Ziel (3) | ja | src/features/settings/LearningSection.tsx:64 |
| Lernzeit / Erinnerung (Anleitung Tagesauftrag) | A 6.9 | DA | … › Lernen › Lernzeit (3) | ja | src/features/settings/StudyTime.tsx:133 |
| Auto-Weiter | ALT | DA (laut LÜ Nr.79 eigentlich gestrichen) | … (3) | ja | src/features/settings/SettingsSheet.tsx |
| Stimme, Sprechtempo, Ton, Vibration | A 6.14, ALT | DA | … › Stimme (3) | ja | src/features/settings/VoiceSection.tsx, HapticSection.tsx |
| Berufsprofil, Arbeitskontext | wort-fest-plan | DA | … › Kontext (3) | ja | src/features/settings/SettingsSheet.tsx:80 |
| Sprache DE/EN | A 6.14 | DA | … › Aussehen (3) | ja | src/features/settings/SettingsSheet.tsx:160 |
| Modus Dunkel/Gedämpft/Hell | A 8 | DA | … › Aussehen (3) | ja | src/features/settings/SettingsSheet.tsx |
| Akzentfarbe (Iris/Bernstein) | A 8 | TEILWEISE (die alte App hatte 4 Paletten: sage/ocean/plum/graphite) | … › Aussehen (3) | ja | src/features/settings/AccentSection.tsx:13 |
| Schriftgröße | LÜ | FEHLT | – | – | nicht gefunden |
| Effekte | erlebnis-engine | DA | … (3) | ja | src/features/settings/EffectsSection.tsx |
| Eingabeprofil (Handy/Tastatur) | A 4 | DA | … (3) | ja | src/features/settings/InputProfileSection.tsx |
| Sicherung als JSON | A 6.14 | DA | … › Daten › Sicherung (3) | ja | src/features/settings/SettingsSheet.tsx (exportButton) |
| CSV-/Anki-Export | LÜ | DA | … › Daten (3) | ja | src/features/settings/SettingsSheet.tsx:221 |
| Daten verdichten, Quellen, Diagnose | A 3 | DA | … › Daten (3+) | ja | src/features/settings/SettingsSheet.tsx:332 |
| Diktat am Laptop prüfen | Stufe 1 P7 | DA (nur Laptop) | … › Diagnose (4) | ja | src/features/settings/DictationEntry.tsx |
| Import (alte App: Wörterlisten importieren) | ALT | FEHLT als Massen-Import (nur „+“ für einzelne Wörter und Lehrer-Feedback) | – | – | nicht gefunden |

## 8. Übergreifend (Wort antippen, Aussprache, Suche, Serie/Motivation)

| Funktion | Quelle | Status | Weg ab Start (Taps) | Versteckt? | Code-Stelle |
|---|---|---|---|---|---|
| Wort antippen überall (Lautschrift, Anhören, Bedeutung, Wortart, Sinn-Auswahl, Speichern) | A 6.11, A 15 | DA | Wort antippen (1) | nein | src/features/lookup/LookupPopover.tsx |
| Mehrwort-Markierung (Wendung speichern) | LP 3 | DA | Wörter markieren › Wendung (2) | ja (Geste ohne sichtbaren Hinweis) | src/features/lookup/PhraseLookup.tsx |
| Aussprache anhören | A 6.11 | DA | Wort antippen › Lautsprecher (2) | nein | src/features/lookup/LookupPopover.tsx (lk-listen) |
| „Sag es laut“ / Spracheingabe | aktivierung.md | DA | in der Runde (neue App, RetrySay im Rollenspiel) | ja (nur in bestimmten Übungen) | src/engine/MicButton.tsx |
| Suche für alles (Wörter, Grammatik, Artikel) | LÜ (Muss) | FEHLT: nur getrennte Suchen in Wörter und Grammatik | – | – | nicht gefunden |
| Serie mit Ruhetag, Tageswechsel 04:00 | A 7, A7 | DA | Heute (0) | nein | src/domain (Serie), src/features/today/TodayWeek.tsx |
| Ring / Tagesziel | A 7 | DA | Heute (0) | nein | src/features/today/TodayScreen.tsx |
| Effekte Momente, Ringe, Funken, Feld | erlebnis-engine | FEHLT (Schalter aus; nur Himmel und Film sind an) | – | – | src/app/flags.ts |
| Pause in Übungen | A 4 | DA | Übung › „…“ › Pause (2) | ja (am Handy nur über das Menü „…“) | src/features/system/Chrome.tsx |

---

## Verwaiste Bildschirme und Routen (im Code vorhanden, ohne sichtbaren Einstieg)

1. **Druck-Übungen „Hot Seat“ und „Zeit gewinnen“:** Inhalte und Route sind da (`pressure` mit `set: 'hotseat' | 'buytime'`), aber kein Knopf führt dorthin. Ohne `set` startet immer das Einwand-Training. Code: `src/areas/training.tsx:45`, `src/features/pressure/session.ts`.
2. **Sprint:** Die Route `drill` mit `kind: 'sprint'` ist da, ein Knopf fehlt. Laut LÜ Nr.45 bewusst gestrichen.
3. **Neue Wörter-App:** Die Rundenarten free, evening, week und mistakes sind in `VLEARN_KINDS` vorgesehen, aber keine davon wird aufgerufen. Code: `src/areas/wortschatz.tsx:64`.
4. **Platz `vocab.hub` im Wörter-Reiter:** Nichts ist dort eingetragen. Deshalb taucht die neue Wörter-App im Wörter-Reiter gar nicht auf. Code: `src/features/vocab/hub/VocabHub.tsx:248`.
5. **Business- und KI-Szenen im Sprechen:** Sie werden herausgefiltert. Code: `src/features/speak/SpeakHub.tsx:43`.
6. **Abgeschaltete Funktionen:**
   - Aufgabenarten Paare, Konnektoren, Register-C1 und Paraphrase (pair/cnet/reg/para).
   - Tutor-Teile „explain“ und „gen“.
   - Effekte Momente, Ringe, Funken und Feld.
   - Code: `src/app/flags.ts`.
7. **Nur auf einem einzigen, tief liegenden Weg erreichbar:**
   - C1-Reise `journey`: nur über die Kapitel-Seite (`src/features/c1/ChapterSheet.tsx:182`).
   - Wochen-Check `checks` und Wortschatztest `vtest`: nur über das Profil-Blatt (`src/features/progress/profile/ProfileSections.tsx:167-168`).
   - Claude-Übung `claudeDrill`: nur aus dem Chat oder aus dem Lehrer-Feedback.

## Funktionen der alten App, die es nicht mehr oder nur teilweise gibt (Quelle ALT)

| Alte Funktion | Heute | Bemerkung |
|---|---|---|
| Kurs mit 24 Lektionen in 6 Einheiten | FEHLT | ersetzt durch die Grammatik-Kapitel „Weg zu C1“ (bewusst im Umbau) |
| Sprint | FEHLT | bewusst gestrichen (LÜ Nr.45) |
| Shadowing | FEHLT | keine Nachsprech-Übung |
| Hörtexte (`lpool`) | FEHLT | nur Hörfragen und Hörschleife |
| Entdecken (4 Schritte) / Feed | FEHLT | keine Entsprechung |
| Preply-Stundenplan, Stundenvorbereitung | TEILWEISE | ersetzt durch „Lehrer-Feedback einfügen“ und „Notiz kopieren“ |
| Business-Suite | TEILWEISE | Satz-Klinik und Wochen-Mail ja; Phrasen-Baukasten und Präsentations-Coach nein |
| Farbpaletten sage/ocean/plum/graphite | TEILWEISE | nur Iris/Bernstein plus drei Modi |
| Heatmap, XP-Tagesziel | FEHLT | ersetzt durch Ring, Minuten und Wochenstreifen |
| Import von Listen | FEHLT | nur einzelne Wörter über „+“ |
| Schreibaufgaben (`wprompt`/`writing`) | TEILWEISE | Wochen-Mail und Satz-Klinik; keine freie Aufgabenliste |
| canDo-Aussagen | TEILWEISE | Niveau-Skala und KI-Einschätzung in Worten |
| Wortschatztest, Lesen, Schreiben, Sprechen, Diktat, Lückenjagd, Satzbau, Chat, Lookup, Einschätzung | DA | Diktat und Lückenjagd am Handy eingeklappt, der Wortschatztest nur im Profil-Blatt |

---

## Top 15 fehlend oder versteckt (nach Wichtigkeit für einen B2→C1-Lerner im Business-Englisch)

1. **Wörter-Reiter zeigt nicht die neue Wörter-App.** Heute startet die neue Runde, der Wörter-Reiter zeigt den alten Trainer. Die neue App lässt sich nur über Einstellungen › Wortschatz einschalten. (`src/features/vocab/hub/VocabHub.tsx:248`, `src/areas/wortschatz.tsx:281`)
2. **Business- und KI-Szenen im Rollenspiel sind ausgefiltert.** Für Business-Englisch fehlt damit der Kern. (`src/features/speak/SpeakHub.tsx:43`)
3. **„Hot Seat“ und „Zeit gewinnen“ sind fertig, aber ohne Knopf.** Das sind Meeting-Druck-Übungen. (`src/areas/training.tsx:45`)
4. **Übersetzer am Handy nur über das Fragen-Blatt** oder das Menü „…“. Es gibt keinen eigenen Knopf, und ohne KI ist er unsichtbar. (`src/features/system/Chrome.tsx`)
5. **Business-Suite unvollständig:** Phrasen-Baukasten und Präsentations-Coach fehlen. (A 6.6)
6. **Neue Wörter-App: freies Üben, Abend-Check, Wochen-Check und Fehlwörter ohne Einstieg.** (`src/areas/wortschatz.tsx:64`)
7. **Anwenden der Wörter (Mail/Slack/Call) nur innerhalb der Runde**, nicht frei startbar. (`src/modules/vocab/ui/LearnScreen.tsx:206`)
8. **Einstellungen nur über das Zahnrad auf Fortschritt.** Tagesziel, Stimme, Berufsprofil, Sicherung und „Claude merkt sich“ liegen alle mindestens 3 Taps tief. (`src/app/shell/TopBar.tsx:47`)
9. **Suche für alles fehlt.** Wörter, Grammatik und Artikel haben getrennte Suchen. (LÜ)
10. **Wochen-Check und Wortschatztest nur im unbeschrifteten Profil-Blatt** (montags zusätzlich über Heute, ab 40 Antworten). (`src/features/progress/profile/ProfileSections.tsx:167-168`)
11. **Lesen ist kein Reiter mehr.** Tagesartikel 3 Taps, Lesekurse 4 Taps; ein Archiv ist nicht sichtbar. (`src/modules/read/index.ts:32-35`)
12. **Rollenspiel 4 Taps, Einwand-Training 3 Taps tief.** Sprechen steht nur als Extra-Zeile auf Heute. (`src/features/speak/SpeakHub.tsx`, `src/areas/training.tsx:60`)
13. **Diktat, Eigener Satz und Lückenjagd am Handy eingeklappt.** Hören (Hörfragen, Hörschleife) erscheint nur mit Sprachausgabe; Hörtexte und Shadowing der alten App fehlen. (`src/features/apply/ApplyHub.tsx:142-144, 211, 232`)
14. **Urlaub, Ruhetag wählen, kurzer Tag, „So funktioniert's“ fehlen.** (LÜ, BL H37)
15. **„Meine Wendungen“, Wort löschen/pausieren, Massen-Import und C1-Aufgabenarten pair/cnet/reg/para fehlen.** Die C1-Reise ist nur über die Kapitel-Seite erreichbar. (`src/app/flags.ts`, `src/features/c1/ChapterSheet.tsx:182`)

---

## Zählung (alle Tabellenzeilen der Bereiche 1–8)

Gezählt wurden 138 Funktionszeilen:

| Wert | Anzahl |
|---|---|
| DA | 104 (davon 3 nur, wenn die neue Wörter-App eingeschaltet ist) |
| TEILWEISE | 11 |
| FEHLT | 23 |
| Versteckt = ja (überschneidet sich mit den Status-Werten) | 74 |

Von den 104 Funktionen mit DA sind gut die Hälfte versteckt: Sie sind vorhanden, aber nur über 3 oder mehr Taps, nur in den Einstellungen, nur über ein Menü oder nur bei einem bestimmten Datenstand erreichbar.
