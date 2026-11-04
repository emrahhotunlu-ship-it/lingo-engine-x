# Kompass (Ziel, Roadmap, was Emrah wichtig ist)

**Zuerst lesen** in jeder neuen Sitzung und **nach jeder Komprimierung** des Gesprächs. Diese Datei hält fest, was nie verloren gehen darf. Sie wird vom Hauptchat gepflegt (ersetzen, nicht anhängen). Laufende Einzelheiten stehen in `docs/umbau/stand.md` (nur anhängen), Entscheidungen mit Wortlaut in `docs/entscheidungen.md`.

## 1. Ziel
Emrahs persönliche Business-Englisch-App (B2 → C1), live als Claude-Artefakt `JLL8…`, Test-Link `AXHkh6…`. **Hauptziel jetzt:** eine komplett neue Wörter-App (eigenes Modul, eigene Logik, eigene Bildschirme) und das neue Aussehen aller Bildschirme nach der Vorschau `WBft3EEx7jYYv4QHdepuNm` v2.

## 2. Was Emrah wichtig ist (Wortlaut in `entscheidungen.md`)
- **Wörter-App zuerst** (30.10.). Grundlage: Analyse von 18 Lern-Apps, `vokabeln/synthese.md`, Plan `vokabeln/plan.md`; jede übernommene Methode landet in genau einem Paket.
- **Vorschau ist die Untergrenze**, besser ist erwünscht – Design, Bedienung, Abläufe und Funktionen (30.10.). **Keine Funktion fällt weg**, Funktionen werden ausgebaut, neue sinnvolle kommen dazu.
- **Großpakete statt kleiner Pakete** (Emrah 01.11., ersetzt „Test-Link je Paket“): die Roadmap besteht aus drei Großpaketen A (Wörter-App komplett: V3+V4+V5), B (Design komplett: D6a, D6b, E1–E7, F2–F5), C (schneller Start: 1b). Je Großpaket: **einmal gemeinsam planen** (Refinement als Text, dann Bilder/Fragen im Pop-up) → OK → Schritt für Schritt bauen und selbst prüfen → **ein Test-Link am Ende** → Review. **Kein Test-Link für Kleinigkeiten**; kleine Korrekturen sammeln und mit dem nächsten Großpaket ausliefern. Zwischendurch **nur bei echten Fragen** melden (Pop-up mit Bildern), sonst durcharbeiten.
- **Keine Unterchats mehr** (01.11.): Nach V2, D5, VB arbeitet nur noch der Hauptchat, effizient (wenige Helfer gezielt, Prüfer aus `.claude/agents/`), öfter komprimieren.
- **Fragen im Chat** (Emrah 04.11., ersetzt Pop-up): je Frage Beispiel aus der App, Problem, Möglichkeiten mit dem, was man danach sieht, Empfehlung mit Grund, Antwortform „A/B“.
- **Einfache Sprache** ohne Fachwörter; bei jedem Test-Link: was geändert, wie testen (genaue Klicks am Handy), woran erkennen, was schicken (CLAUDE.md A2).
- **Live nur nach „Ja live nehmen“**; nie über die laufende App veröffentlichen, um etwas zu zeigen. Vor jedem Veröffentlichen aktuelle Version lesen und Rückweg notieren.
- Design-Festlegungen: Erledigt = Indigo; Gedämpft-Hauptknopf weiße Schrift (≥ 4,5:1); Regel-Karte am Laptop erst nach dem Prüfen; „Warum“ im Übungsband sichtbar.
- Wörter-Planer: F1–F5 (31.10.) und Lesart der Zielwerte (01.11.): Vergleich bei gleicher Lernzeit; Ruhe ab Tag 15/Start mit Bestand; 14-Tage-Vorschau mit Bestand, neu in V4.
- Keine Schleifen: je Prüfer eine Prüfung + eine gezielte Nachprüfung; roter Test höchstens zwei Behebungsversuche je Ursache, dann offen melden.
- „Stopp“ heißt sofort anhalten.

- **Schnell-Modus (Emrah 02.11.2026):** beim Bauen nur schnelle Prüfungen; voller Klicktest/`verify` genau einmal am Ende vor dem Test-Link; Prüfer einmal je Großpaket (siehe `entscheidungen.md`).

## 3. Roadmap (Großpakete, Stand 04.11.2026)
**Emrah 02.11.:** erst die fertige neue App haben und damit lernen → Feedback → dann gemeinsam überlegen, was wie neu entwickelt wird (B/C erst danach). Die Gesamtprüfung aller Bildschirme (Note 5/10) ist bis dahin angehalten; Funktionsliste „fehlt/versteckt“ liegt bereit.

| # | Großpaket | Inhalt | Stand |
|---|---|---|---|
| ✓ | V0, Q0, D1, D2, D3, V1, V2, D5, VB + D5-Nachtrag | Plan Wörter-App, Aufgaben-Qualität, Bausteine, Heute, Übungsseite, Wörter-Planer und -Bewertung (unsichtbar), Grammatik-Reiter, Bilder der Wörter-Bildschirme | in `claude/umbau-fokus`; Test-Link v77 `1793534318-5906` (01.11.), wartet auf Emrahs Review; nicht live |
| A | **Wörter-App komplett** | V3 (Lernkarte, Sitzung, Abschluss; freigegeben 01.11. mit VB 1–3) + V4 (Anwenden, Wort-Detail, Übersicht; VB 4–6) + V5 (C1-Wortauswahl, Einstufung; alter Wörter-Bereich raus erst nach Emrahs OK) + gesammelte Kleinkorrekturen | Refinement `vokabeln/grosspaket-a.md` freigegeben (01.11.); gebaut, geprüft, Test-Link v79; **live `JLL8…` v87 `1793608303-a6a8` (02.11., Emrahs Wahl „Test-Link 79 sofort live“; Rückweg v86 `1793087421-695a`)**. **Seit v88 `1793612956-d9f4` (02.11.) schaltet sich die Wörter-App von selbst ein** (Rückweg v87); Reiter Wörter zeigt die neue Startseite. Emrah lernt jetzt damit und gibt Feedback. Offen: #6b, „kommt später“-Liste in `stand.md` |
| ✓ | **UX-Neuanfang A–D** | Tagesweg 3 Schritte, Design Heute, 4 Reiter, Hilfe/Claude sichtbar, Erklärung bei falsch, Aufgabe melden | **live `JLL8…` v89 `1793658052-a404` (02.11., Rückweg v88 `1793612956-d9f4`)** |
| G | **Grammatik + Wiederholen neu, gleich im neuen Design** (Emrah 02.11.: Grammatik-/Wiederholen-Übungen „hatten sehr oft Fehler … sollte überarbeitet werden“) | eigene Logik wie die Wörter-App, geprüfte Aufgaben ohne Fehler, Bildschirme nach Vorschau | **live `JLL8…` v90 `1793692316-d0c1` (03.11., Rückweg v89 `1793658052-a404`)** |
| ✓ | **Kern + Glas** (03./04.11.) | Übungskarte/Heute nach Vorschau 9pdpfT8E, dann Glas/Carbon wie Küchenstudio (Schrift Plus Jakarta Sans, schwebende Schiene/Kopfleiste, Glasblätter) auf allen Reitern und Blättern | in `claude/umbau-fokus`; Test-Link v85 `1793779276-023a` (04.11.), dazu 1B (Hinweis neue Einschätzung) und 2A (kurzer Tag) auf **Test-Link v86 `1793790983-4895`**; nicht live (live = v86-Stand, Artefakt-Version 92) |
| B | **Design komplett** | D6a, D6b (Praxis/Fortschritt, Fragen-Blatt/Ausfälle), E1–E7, F2–F5 (übrige Bildschirme, fehlende Vorschau-Funktionen) | **im Bau**: B1 ✓, B2 weitgehend ✓ (Grammatik-Nachschlagen als eine Seite offen), B3/B4/B5 im Glas-Stil, B10 ✓ inkl. „kurzer Tag“ (2A, 04.11.). Offen: Raster großer Monitor, leere Kontextspalte, Wörter-Reiter-Kopf, Grammatik-Nachschlagen als eine Seite; Ideen der Prüfer (Folgetag-Hinweis, „Doch voller Tag“, „noch 5 Minuten“) nur auf Emrahs Wunsch. Details `stand.md` (Nacht 03./04.11.) |
| C | **Schneller Start** | 1b (P9a, P9b, P10: Inhalte nachladen) | Refinement nach B |
| danach | Grammatik, Praxis, Lesen als eigene Module | gleiches Prinzip wie die Wörter-App | |
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
