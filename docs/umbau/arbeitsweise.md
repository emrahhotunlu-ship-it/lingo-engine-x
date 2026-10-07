# Arbeitsweise: Modelle, Orchestrierung, Prüftore

Gilt ab 07.10.2026 für jede Sitzung. Bei Widerspruch gehen A2 (begrenzte Prüfrunden) und Emrahs Vorgaben in A7 und `docs/umbau/stand.md` vor.

## 1. Grundsatz
- **Starke Modelle bekommen die Arbeit, bei der ein Fehler unsichtbar und teuer ist:** Konzept, Lerninhalt, Urteil, Daten. **Günstige Modelle bekommen die Arbeit, bei der ein Fehler sofort messbar ist:** Testlauf, Zahl, Screenshot.
- **Ersteller und Prüfer sind nie dasselbe Modell im selben Kontext.** Wer Inhalt oder Design prüft, ist mindestens so stark wie der Ersteller.
- **Der größte Hebel sind weniger Korrekturrunden, nicht billigere Modelle.** Deshalb wird alles vor dem Test-Link geprüft, nie danach.

## 2. Rollen
| Rolle | Modell | Aufwand | Wann |
|---|---|---|---|
| Masterchat | Opus | high | immer: plant, verteilt, führt zusammen, berichtet Emrah |
| Basiskonzept, Release-Plan, Schemas | Opus | max | einmal je Release (R1–R7) |
| architect (Prüfung des Plans) | Opus | high | einmal je Release-Plan |
| Design, neue Bildschirme | Opus | high | je Design-Paket |
| ux-reviewer | Opus | high | vor jedem Test-Link mit sichtbarer Änderung |
| C1-Inhalte, Begründungen, KI-Prompts | Sonnet | high | in Chargen mit höchstens 40 Aufgaben |
| english-teacher, learning-scientist | Opus | high | jede Charge, jede neue Übung und jeder neue Prompt |
| Code für Funktionen | Sonnet | high (medium bei höchstens 3 Dateien) | im eigenen Worktree |
| Fehlerbehebung | Sonnet | medium | zuerst ein Test, der rot ist |
| Texte der Oberfläche (DE/EN) | Sonnet | medium | zusammen mit dem Code-Paket |
| data-guard | Sonnet | high | jede Änderung an `/src/data`, Schemas, Umstellung |
| platform-guard | Haiku führt `check:platform` aus, Sonnet medium urteilt | low / medium | vor jedem Test-Link; Sonnet nur bei Befund oder bei neuem `claude.use`-Aufruf |
| Mechanik: Tests ausführen, Screenshots erzeugen, Zähler, Scan auf US/UK-Schreibweise, Prüfung von Diff und Commit, Inhalts-Validatoren | Haiku | low/medium | immer, Ausgabe nur als Schema |
| Bericht und Test-Anleitung an Emrah | Masterchat | – | schreibt er selbst (Pflichtpunkte aus A2) |

## 3. Orchestrierung
- **Der Masterchat orchestriert selbst.** Es gibt keinen eigenen Orchestrator-Agenten: Er wäre ein zweiter Kontext, der Emrahs Vorgaben nur aus zweiter Hand kennt. Neue Cloud-Fenster gibt es nicht, weil sie nicht steuerbar sind.
- Der Masterchat baut und prüft nicht selbst. Er liest nur Schema-Ergebnisse (`ok`, `befunde[]`, `zahlen`, `nicht_gelaufen[]`, `commit`), nie Rohlogs.
- **Höchstens 2–3 Agenten gleichzeitig** (Emrahs Vorgabe vom 07.10.: keine Wellen von 5–6). Das gilt auch innerhalb von Workflows, außer bei reinen Haiku-Mechanik-Schritten.
- **Einzelner Agent:** Fehlerbehebung, höchstens 3 Dateien, ein Bildschirm, Texttausch.
- **Workflow:** ab 3 Teilpaketen, bei jeder Inhaltscharge, jedem Design-Paket und jedem Release-Abschluss. Schema-Ausgabe ist Pflicht, Code läuft mit `isolation: 'worktree'`.
- **Ultracode** (Ersteller, dann Gegenprüfer, dann Vollständigkeits-Kritiker) nur für Inhaltschargen und den Release-Abschluss.
- **„Loop until dry“** nur für maschinelle Prüfer: Typprüfung, Lint, Unit-Tests, Validatoren, Schema. Urteilende Prüfer machen eine Prüfung und eine gezielte Nachprüfung, danach entscheidet Emrah. Ein roter Test bekommt höchstens 2 Behebungsversuche je Ursache.

## 4. Prüftore vor jedem Test-Link (in dieser Reihenfolge)
1. **G0 maschinell (Haiku führt aus):** Typprüfung, Lint, Unit-Tests, betroffene E2E-Specs, Inhalts-Validatoren. Die Validatoren prüfen: jede gültige Lösung steht im Schlüssel, der Schlüssel existiert, keine britische Schreibweise (laut Liste), alle Pflichtfelder vorhanden, die Sprache stimmt.
2. **G1 Inhalt:** english-teacher prüft 100 % jeder Charge vor dem Merge. learning-scientist prüft jede neue Übung und jeden neuen Prompt.
3. **G2 Aussehen:** Haiku erzeugt Screenshots (390 px und 1440 px, Dunkel/Gedämpft/Hell). Der ux-reviewer vergleicht sie mit dem freigegebenen Vergleichsbild. Er prüft auch die Einheitlichkeit: eine einzige Rückmeldekarte, keine Textfehler, keine Widersprüche (Kap. 2).
4. **G3 Daten und Plattform:** data-guard (bei Änderung an Daten), dann `check:platform` und platform-guard.
5. **G4:** volle E2E-Runde (ca. 20 Min.) einmal je Test-Link auf dem Endstand, nicht je Paket.

Ein Tor, das nicht gelaufen ist, gilt als offen und wird nie als grün gemeldet. Safari ist immer offen und wird von Emrah am Gerät geprüft. Live geht nur nach „Ja live nehmen“.

## 5. Token-Regeln
1. **Kein Lauf ohne Änderung.** Jeder Bericht nennt den Commit. Bei gleichem Commit gibt es keinen neuen Lauf.
2. **Schlanke Aufträge.** Ein Agent bekommt die Auftragsdatei, die betroffenen Dateien und die Regelliste. Er bekommt weder das ganze CLAUDE.md noch den Chatverlauf.
3. **Fester Vorspann vorn** (Rolle, Regeln, Schema), die Aufgabe hinten. Das hilft dem Zwischenspeicher; der Effekt ist aber nicht belegt, darauf wird nichts aufgebaut.
4. **Günstige Vorfilter (G0) vor teuren Prüfern.**
5. **Chargen mit höchstens 40 Aufgaben**, damit eine Korrektur nur eine Charge kostet.
6. **Das Konzept wird einmal je Release erdacht und gespeichert.** Agenten lesen es, statt neu zu planen.
7. **Aus `stand.md` nur die letzten Einträge lesen.** Opus max nur für das Konzept.

## 6. Regeln aus Erfahrungen
- **Inhalt hatte bisher in jeder Runde echte Fehler.** Deshalb kommt kein Inhalt ohne G0 und G1 in den Build. Der Autor liefert eine Selbstprüf-Liste mit, die G1 nicht ersetzt.
- **„Unruhig“ fand erst der Prüfer, nicht der Design-Agent.** Jeder Design-Auftrag nennt das Vergleichsbild und die verbotenen Muster. Abgenommen wird nur per Screenshot, nie per Selbstaussage.
- **Das Feld `nicht_gelaufen` ist Pflicht.** Fehlt es, gilt der Bericht als unvollständig. Der Masterchat übernimmt es wörtlich in den Bericht an Emrah.
- **Commits:** Agenten nutzen nur `git add <genannte Pfade>`. Vor jedem Merge prüft Haiku `git diff --stat` auf `node_modules`, `dist/` und fremde Dateien. Nur der Masterchat führt in `claude/umbau-fokus` zusammen.
- **Push-Fehler 500:** ein Wiederholungsversuch nach einer Pause, dann offen melden.
- **Zahlen** stammen nur aus der Ausgabe eines Befehls, nie aus dem Gedächtnis.

## 7. Absicherung unbelegter Annahmen (kein eigener Probelauf)
- **Haiku 5.5 für C1-Inhalte:** Inhalte bleiben bei Sonnet. Soll Haiku sie übernehmen, schreiben in der nächsten echten Charge Haiku und Sonnet je die Hälfte, und der english-teacher prüft beide blind. Haiku übernimmt nur, wenn seine Fehlerquote höchstens so hoch ist wie die von Sonnet. G1 bleibt dabei bei 100 %.
- **Haiku für Mechanik:** Beim ersten Einsatz gleicht Sonnet im selben Workflow die Zahlen von Haiku einmal mit Exit-Code und Ausgabe ab. Stimmen sie, entfällt der Abgleich danach.
- **Opus als Master und Opus max für das Konzept:** Je Release steht eine Zeile in `stand.md` mit der Zahl der Korrekturrunden und den Befunden nach dem Test-Link. Nach R2 wird ausgewertet. Gab es keine Fehler, die beim Master entstanden sind, laufen R3 testweise mit dem Master auf Sonnet high und das Konzept auf Opus high. Danach werden die Werte verglichen.

## 8. Kurzfassung für Emrah
1. Die stärkste Claude-Version plant und prüft, die mittlere baut und schreibt, die schnellste erledigt Routinearbeit wie Testläufe.
2. Jede neue Aufgabe und jedes neue Aussehen prüft ein zweiter, unabhängiger Prüfer, bevor du einen Test-Link bekommst.
3. Dieses Fenster verteilt die Arbeit, sammelt die Ergebnisse und berichtet dir, und es arbeiten höchstens zwei bis drei Helfer gleichzeitig.
4. Was nicht geprüft werden konnte, zum Beispiel Safari auf dem iPhone, steht immer offen im Bericht.
5. So musst du seltener nachbessern, und dein Kontingent geht nicht für doppelte Runden drauf.
