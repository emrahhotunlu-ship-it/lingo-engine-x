# Kompass (Ziel, Roadmap, was Emrah wichtig ist)

**Zuerst lesen** in jeder neuen Sitzung und **nach jeder Komprimierung** des Gesprächs. Diese Datei hält fest, was nie verloren gehen darf. Sie wird vom Hauptchat gepflegt (ersetzen, nicht anhängen). Laufende Einzelheiten stehen in `docs/umbau/stand.md` (nur anhängen), Entscheidungen mit Wortlaut in `docs/entscheidungen.md`.

## 1. Ziel
Emrahs persönliche Business-Englisch-App (B2 → C1), live als Claude-Artefakt `JLL8…`, Test-Link `AXHkh6…`. **Hauptziel jetzt:** eine komplett neue Wörter-App (eigenes Modul, eigene Logik, eigene Bildschirme) und das neue Aussehen aller Bildschirme nach der Vorschau `WBft3EEx7jYYv4QHdepuNm` v2.

## 2. Was Emrah wichtig ist (Wortlaut in `entscheidungen.md`)
- **Wörter-App zuerst** (30.10.). Grundlage: Analyse von 18 Lern-Apps, `vokabeln/synthese.md`, Plan `vokabeln/plan.md`; jede übernommene Methode landet in genau einem Paket.
- **Vorschau ist die Untergrenze**, besser ist erwünscht – Design, Bedienung, Abläufe und Funktionen (30.10.). **Keine Funktion fällt weg**, Funktionen werden ausgebaut, neue sinnvolle kommen dazu.
- **Großpakete statt kleiner Pakete** (Emrah 01.11., ersetzt „Test-Link je Paket“): die Roadmap besteht aus drei Großpaketen A (Wörter-App komplett: V3+V4+V5), B (Design komplett: D6a, D6b, E1–E7, F2–F5), C (schneller Start: 1b). Je Großpaket: **einmal gemeinsam planen** (Refinement als Text, dann Bilder/Fragen im Pop-up) → OK → Schritt für Schritt bauen und selbst prüfen → **ein Test-Link am Ende** → Review. **Kein Test-Link für Kleinigkeiten**; kleine Korrekturen sammeln und mit dem nächsten Großpaket ausliefern. Zwischendurch **nur bei echten Fragen** melden (Pop-up mit Bildern), sonst durcharbeiten.
- **Keine Unterchats mehr** (01.11.): Nach V2, D5, VB arbeitet nur noch der Hauptchat, effizient (wenige Helfer gezielt, Prüfer aus `.claude/agents/`), öfter komprimieren.
- **Fragen immer im Auswahlfenster** (Emrah 05.11.: „Bitte Fragen immer hier als Kontextfenster stellen!“, ersetzt „Fragen im Chat“ vom 04.11.): Werkzeug `AskUserQuestion`; je Frage Beispiel aus der App, Problem, Möglichkeiten mit dem, was man danach sieht, Empfehlung zuerst mit „(Empfohlen)“. Bildschirmfotos u. Ä. weiter im Chat erbitten.
- **Einfache Sprache** ohne Fachwörter; bei jedem Test-Link: was geändert, wie testen (genaue Klicks am Handy), woran erkennen, was schicken (CLAUDE.md A2).
- **Live nur nach „Ja live nehmen“**; nie über die laufende App veröffentlichen, um etwas zu zeigen. Vor jedem Veröffentlichen aktuelle Version lesen und Rückweg notieren.
- Design-Festlegungen: Erledigt = Indigo; Gedämpft-Hauptknopf weiße Schrift (≥ 4,5:1); Regel-Karte am Laptop erst nach dem Prüfen; „Warum“ im Übungsband sichtbar.
- Wörter-Planer: F1–F5 (31.10.) und Lesart der Zielwerte (01.11.): Vergleich bei gleicher Lernzeit; Ruhe ab Tag 15/Start mit Bestand; 14-Tage-Vorschau mit Bestand, neu in V4.
- Keine Schleifen: je Prüfer eine Prüfung + eine gezielte Nachprüfung; roter Test höchstens zwei Behebungsversuche je Ursache, dann offen melden.
- „Stopp“ heißt sofort anhalten.

- **Schnell-Modus (Emrah 02.11.2026):** beim Bauen nur schnelle Prüfungen; voller Klicktest/`verify` genau einmal am Ende vor dem Test-Link; Prüfer einmal je Großpaket (siehe `entscheidungen.md`).

## ⏸ PAUSE seit 09.11.2026 (Emrah)
Nichts bauen, nichts veröffentlichen. Emrahs Kommentare in der App nur sammeln (`docs/umbau/kommentare-sammlung.md`), kurz bestätigen, nicht umsetzen. In 1–2 Wochen gemeinsam einen Gesamtplan machen. Live bleibt `JLL8…` v104 `1794207575-38a1`.
- **Stimme (Emrah 09.11., Ausnahme von der Pause):** Kokoro ersetzt die Gerätestimme in der App (`docs/umbau/stimme.md`, Entscheidung in `docs/entscheidungen.md`). Erst Test-Link `AXHkh6…`, live nur nach „Ja live nehmen“. Stimmen-Paket wird je Artefakt einmal hochgeladen und steht in `docs/relaunch/publish/<link>.json` unter `voice`.

## 3. Roadmap (Großpakete, Stand 05.11.2026)
**Emrah 02.11.:** erst die fertige neue App haben und damit lernen → Feedback → dann gemeinsam überlegen, was wie neu entwickelt wird (B/C erst danach). Die Gesamtprüfung aller Bildschirme (Note 5/10) ist bis dahin angehalten; Funktionsliste „fehlt/versteckt“ liegt bereit.

| # | Großpaket | Inhalt | Stand |
|---|---|---|---|
| ✓ | V0, Q0, D1, D2, D3, V1, V2, D5, VB + D5-Nachtrag | Plan Wörter-App, Aufgaben-Qualität, Bausteine, Heute, Übungsseite, Wörter-Planer und -Bewertung (unsichtbar), Grammatik-Reiter, Bilder der Wörter-Bildschirme | in `claude/umbau-fokus`; Test-Link v77 `1793534318-5906` (01.11.), wartet auf Emrahs Review; nicht live |
| A | **Wörter-App komplett** | V3 (Lernkarte, Sitzung, Abschluss; freigegeben 01.11. mit VB 1–3) + V4 (Anwenden, Wort-Detail, Übersicht; VB 4–6) + V5 (C1-Wortauswahl, Einstufung; alter Wörter-Bereich raus erst nach Emrahs OK) + gesammelte Kleinkorrekturen | Refinement `vokabeln/grosspaket-a.md` freigegeben (01.11.); gebaut, geprüft, Test-Link v79; **live `JLL8…` v87 `1793608303-a6a8` (02.11., Emrahs Wahl „Test-Link 79 sofort live“; Rückweg v86 `1793087421-695a`)**. **Seit v88 `1793612956-d9f4` (02.11.) schaltet sich die Wörter-App von selbst ein** (Rückweg v87); Reiter Wörter zeigt die neue Startseite. Emrah lernt jetzt damit und gibt Feedback. Offen: #6b, „kommt später“-Liste in `stand.md` |
| ✓ | **UX-Neuanfang A–D** | Tagesweg 3 Schritte, Design Heute, 4 Reiter, Hilfe/Claude sichtbar, Erklärung bei falsch, Aufgabe melden | **live `JLL8…` v89 `1793658052-a404` (02.11., Rückweg v88 `1793612956-d9f4`)** |
| G | **Grammatik + Wiederholen neu, gleich im neuen Design** (Emrah 02.11.: Grammatik-/Wiederholen-Übungen „hatten sehr oft Fehler … sollte überarbeitet werden“) | eigene Logik wie die Wörter-App, geprüfte Aufgaben ohne Fehler, Bildschirme nach Vorschau | **live `JLL8…` v90 `1793692316-d0c1` (03.11., Rückweg v89 `1793658052-a404`)** |
| ✓ | **Kern + Glas** (03./04.11.) | Übungskarte/Heute nach Vorschau 9pdpfT8E, dann Glas/Carbon wie Küchenstudio (Schrift Plus Jakarta Sans, schwebende Schiene/Kopfleiste, Glasblätter) auf allen Reitern und Blättern | in `claude/umbau-fokus`; Test-Link v85 `1793779276-023a` (04.11.), dazu 1B (Hinweis neue Einschätzung) und 2A (kurzer Tag) auf **Test-Link v86 `1793790983-4895`**; nicht live (live = v86-Stand, Artefakt-Version 92) |
| ✓ | **Design komplett** (B) | D6a, D6b, E1–E7, F2–F5, Glas überall, B2, B10, B-Rest (Raster großer Monitor, leere Kontextspalte, Wörter-Kopf, Grammatik „Nachschlagen“ als eine Seite, EN-Begriffe) | **live** `JLL8…` v93/v94/v95 (04.11.) |
| ✓ | **Schneller Start** (C) | 1b: Inhalte als `raw-*.txt` nachgeladen, Englisch bei Bedarf, Hinweis „Neu laden“ | **live** `JLL8…` v95 `1793821540-69ed` (04.11., Rückweg v94) |
| F | **Fokus 2.0** (Emrah 04.11. spät: nur Wörter, Grammatik, Anwenden, Fehler korrigieren; Rest raus; Sprechen/Hören macht er bei Preply) | F0 Ausblenden, F1 K-Rest, F2 Belege, F3 Anwenden-Modul (Satz, Mail antworten, Mail schreiben, Artikel zusammenfassen), F4 Fehlersätze im Tagesplan | **live `JLL8…` v96 `1793872751-0932` (05.11., Rückweg v95)**; dazu Enter klappt Tastatur ein, Schritt 3 „B“ (Zeit bleibt, Aufgabe kürzer). Kurs-Routine pausiert |
| N | **Nach Fokus 2.0** | offene Live-Kommentare K3–K14 nachprüfen und beheben (ohne Rückfrage, kommen mit dem nächsten Test-Link); danach nächstes Großpaket mit Emrah planen (Vorschlag im Chat) | erledigt (mit W) |
| W | **Wörter-Wissen + Karten-Korrekturen** | W1–W6 (Wortpartner, Beispielsätze, Wortseite, Wendungen, Anwenden-Feinschliff), W7 (12 Live-Kommentare 05.11.), 1A wechselnde geprüfte Sätze | **live `JLL8…` v97 `1793906332-d9d3`** (05.11., Emrahs „prima nehme es live“, Rückweg v96 `1793872751-0932`); Test-Link v91 |
| T | **Touch-Bedienung nach Richtlinien** (Emrah 07.11., 3× „A“) | Tastatur nur auf Tipp, eine Fläche (keine Kästen in Kästen), Rückmeldung kurz + „Mehr zum Wort“, Übungssätze nie als Wort-Satz; Prüfliste `docs/umbau/touch/pruefliste.md` | **live `JLL8…` v101 `1794061208-82dc`** (07.11., Emrahs „Live nehmen“, Rückweg v100 `1793975925-edca`); dazu Tageszeit (echte Zeit + Zeitdeckel) |
| T+ | **Wörter ohne Satz: gleichwertige Übersetzung zählt** (Live-Kommentar „Ist doch eigentlich auch richtig?!“, robuster → more robust) | Wörterbuch-Bedeutung trifft Vorgabe → „passt hier auch“; Claude-„passt auch“ → Knopf; beide Einspruch-Knöpfe sichtbar | **live `JLL8…` v102 `1794083815-25a8`** (07.11., Emrahs „Direkt live“, Rückweg v101 `1794061208-82dc`) |
| G+ | **Grammatik-Erklärungen passen zur Aufgabe** (Live-Kommentare 08.11.) | Karte „Regel“ zeigt das Muster der Aufgabe; „It was the first time“ mit „is → has, was → had“ (Lehrer-geprüft) | **live `JLL8…` v103 `1794164803-2e10`** (08.11., Emrahs „Direkt live“, Rückweg v102 `1794083815-25a8`) |
| B | **Buch + Tempo** (Emrah 08.11.: „Gezielte Grammatik-Übungen wie im Buch … Klausur“, „Pace Vokabel learning“; 4× „A“, Tagesziel 35) | E1 Fehler-Karte, GB1 564 Buch-Aufgaben (Lehrer-geprüft), GB2 10 neue Wörter/Tag + 60 % Wörter-Zeit + „Noch 5 neue“, GB3 Grammatik-Buch mit Lektionstest und Klausur (Note + %), GB4 KWT seltener, GB5 Prüfer + Bildschirm-Korrekturen | **live `JLL8…` v104 `1794207575-38a1`** (09.11., Emrahs „Ja live nehmen“, Rückweg v103 `1794164803-2e10`); Test-Link v94 `1794194147-cc2b`. Rest-Stapel: Fehlerkarte K4/K5, „Weiter“ nennt Ziel (K7), Bedeutungs-Warum ohne „a/b“ (N3), Heute springt 3 s nach dem Öffnen auf „Wörter erledigt“ (prüfen) |
| I | **Intelligente App** (Emrah 09.11.: „super intelligent … Pace Vokabel lernen und Grammar lernen und anwenden“; 4× „A“) | I0 Reste Buch + Tempo; **I1** Messen, Wörter-Tempo nach Behalten (5–15), Fehler-Gedächtnis (+1/+3/+7 mit neuem Satz) → Test-Link; **I2** Wörter in Grammatik-Sätzen, täglich 2 eigene Sätze, Wochenbild in Worten → Test-Link. Plan `docs/umbau/intelligenz/plan.md` | **pausiert** (Emrah 09.11.: erst Kommentare sammeln, in 1–2 Wochen gemeinsam Gesamtplan; Stand bleibt live v104) |
| K | **Dein Können** (Emrah 05.11. „2A“) | eigene Seite: was ich bei Wörtern und Grammatik wie gut beherrsche, wie und warum die App mich einstuft | nach T; zuerst gemeinsam planen |
| L | **Großer Bildschirm + Ladezeiten** | K14 (leere rechte Spalte ab 1440/2560), LIVE-BUG 3 (erstes Laden nach neuer Version ~7 MB) | danach, Reihenfolge nach Emrahs Wahl |
| R | **Rest** | Lehrer-SOLL (unfair → höchstens „Schwer“ auch am Folgetag; Einführung „Gefunden in“ bei langem Ursprungssatz), Inhaltspflege (Wortarten, Bedeutungs-Zwillinge), Lehrer-Routine E8, Satzbank-Freigabe nach 4 Wochen, Test-Wackler, R4 Messen, R6 Premium, R7 Fülle (nur auf Zuruf) | gesammelt |
Reihenfolge darf Emrah jederzeit ändern. Jedes Großpaket durchläuft §2 „Großpakete“ und §4.

## 4. Ablauf je Großpaket (Hauptchat)
1. **Verfeinern:** Plan-Abschnitt, Funktionsliste (Datei:Zeile), offene Punkte; Helfer nur zum Lesen/Prüfen.
2. **Refinement an Emrah (Pflicht, Emrah 01.11.):** was, warum, was es bringt, wie es aussieht (Bild), **wie ich vorgehe, mit welchen Agenten und Skills**, was sich nicht ändert, offene Risiken – ZUERST als Text; erst danach Bilder und Fragen im Pop-up. Erst nach OK bauen.
3. **Bauen** auf `claude/umbau-fokus`, kleine Commits, früh pushen.
4. **Prüfen:** `verify:fast`, betroffene Specs, Prüfer (learning-scientist/english-teacher bei Übungen/Inhalten, ux-reviewer bei Bildschirmen, data-guard bei Daten, platform-guard vor Test-Link). Gesamtlauf `npm run verify` vor dem Test-Link.
5. **Test-Link nur am Ende des Großpakets** (`AXHkh6…`, mit `db`, `sample`, `downloads`), Bericht in drei Teilen (A2), Lerntag-Durchlauf vorher.
6. **Review Emrah** → Korrekturen → Eintrag in `stand.md` und hier §3.

## 5. Technik-Stolpersteine (Cloud-Umgebung)
- Playwright: `PW_CHROMIUM=/opt/pw-browsers/chromium`; nie `playwright install`. Nie `npm run grammar:build`.
- Platte voll (alte Vitest-Reste in /tmp, nicht löschen ohne Emrahs OK): `TMPDIR=/dev/shm/lx` (vorher `mkdir -p`) für Playwright und Vitest, dann startet der Browser wieder.
- Nach jedem Build/E2E: `git checkout -q -- dist && git clean -fdq dist` und `rm -rf test-results` (Platte knapp, ENOSPC → Browser-Abstürze; dann betroffene Specs einzeln wiederholen). `dist/` nur beim Test-Link aktualisieren.
- `verify:fast` nach einem Merge immer mit `-- --base <Stand vor dem Merge>`, sonst prüft er nichts.
- Golden-Kennzahlen: `metrics-kennzahlen.json` (Teil A) nie neu schreiben; `metrics-today*.json` (Teil B) nach Diff-Prüfung mit `vitest -u`.
- Neue Budget-Einträge in `scripts/budget.json` **und** `tests/unit/checkBudget.test.ts`.
- Commits enden mit Co-Authored-By/Claude-Session (siehe System); Push `timeout 100 git push -u origin claude/umbau-fokus`.
