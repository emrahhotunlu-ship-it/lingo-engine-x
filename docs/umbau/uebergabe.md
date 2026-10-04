# Übergabe an das Programmier-Fenster · Umbau „Fokus Wörter und Grammatik“

Stand 04.10.2026. Auftraggeber ist Emrah (keine Entwicklererfahrung, arbeitet nur am iPhone). Das Planungs-Fenster bleibt reiner Chat. **Gebaut wird nur hier.** Dieses Dokument ist dein Auftrag; `docs/umbau/gesamtkonzept.md` sagt, *was* gebaut wird; hier steht, *wie* du arbeitest.

## 1 Auftrag in drei Sätzen
Baue den Umbau nach `docs/umbau/gesamtkonzept.md`, Welle für Welle (W0 bis W6, Kap. 5). Jede Welle endet mit grünen Tests, einem Commit, einem Push und (ab W2) einem Test-Link samt Bericht an Emrah. **Live (`JLL8…`) geht nichts**, solange Emrah nicht ausdrücklich „Ja live nehmen“ schreibt.

## 2 Zuerst lesen (in dieser Reihenfolge)
1. `CLAUDE.md` vollständig: A2 (Zusammenarbeit, keine Schleifen), A3 (Auslieferung), A6 (Auslegungen), A7 (Entscheidungen, oberste Einträge), A8 (Befehle), Teil B (Kap. 2, 3, 14, 15 sind nicht verhandelbar).
2. `docs/umbau/gesamtkonzept.md`. Es entscheidet; wo Berichte sich widersprechen, gilt dort Kap. 11.
3. Die Berichte je Welle:

| Welle | Lesen |
|---|---|
| W0, W1 | `00` Code-Statistik · `01` Ist-Inventar (Routen: BEHALTEN / VEREINFACHEN / ZUSAMMENLEGEN / AUSBLENDEN / STREICHEN) · `04` Technik · `07` Datenleitplanken |
| W2 | `01` · `04` (Entfernungs-Audit, Kopplungen) · `07` |
| W3 | `03` Lernmodell (20 Invarianten, Zahlen-Definitionen) · `05` UX (Regeln R1–R12, Übungsrahmen) · `04` (`domain/metrics`) |
| W4 | `02` Lehrplan (Atlas, Karten, Prüfkette) · `06` Marktvergleich · `07` (Atlas-Speicher) · `08` Fertigbau-Sichtung |
| W5 | `02` §4 (39 Grammatikthemen) · `03` · `05` |
| W6 | `04` (Leistung) · `05` (Politur, Abnahme) |

4. **Visuelles Ziel:** Design-Fläche „Lingo-Engine X Gesamtkonzept“ (20 klickbare Handy-Bildschirme im Look der App): https://claude.ai/artifact/HDdxuD2T2LRJSbHmnDsd1c . Sie wird mit `Artifact` (Aktion `read`) gelesen; jede Datei liegt unter `project/*.dc.html`. Der `ux-reviewer` vergleicht gebaute Bildschirme mit diesen Entwürfen. Wo Entwurf und Konzept abweichen, gilt das Konzept.
5. Nach jeder Welle `docs/umbau/stand.md` fortschreiben (Stand, nächste drei Schritte, offene Fragen), damit ein neues Fenster nahtlos weitermachen kann.

## 3 Feste Regeln (nicht verhandelbar)
- **Branch:** arbeite auf `claude/umbau-fokus` (Basis: `claude/affectionate-cerf-pe6ej2`, enthält den gesamten Stand). Ein Commit je Welle (kleinere Zwischen-Commits sind erlaubt), nach jedem Commit pushen (der Stop-Hook verlangt es). **Nicht nach `main` zusammenführen** (`main` steht 289 Commits zurück und wird für diesen Umbau nicht gebraucht) und nie auf einen anderen Branch pushen, außer Emrah sagt es ausdrücklich.
- **Live-Adresse `JLL8mcoL9JZSmXiEPz9teM`:** nur nach Emrahs ausdrücklichem „Ja live nehmen“. Davor die aktuelle Live-Version lesen (Artifact `read`), nach dem Veröffentlichen A7-Eintrag, Commit, Push, Rückweg-Version notieren. Zuletzt live: Version `1790969044-1fb7` (Artefakt-Version 65).
- **Test-Link `AXHkh6xneA4xfjpHkmy1wE`** (Kopie von Emrahs Daten, Fähigkeiten `db`, `sample`, `downloads`; beim erneuten Veröffentlichen `capabilities` weglassen, sie bleiben erhalten). Zuletzt dort: Version `1791120645-8c83` (Artefakt-Version 31, Stand „Vokabeln+Grammatik-Fokus“). **Eine andere Bau-Linie („Fertigbau“, Branch `claude/zen-albattani-51wnxf`) hat dort schon einmal veröffentlicht.** Vor jedem Veröffentlichen die aktuelle Version lesen. Wird die Veröffentlichung abgelehnt, weil dort etwas Neueres liegt: **nicht** mit `force` überschreiben, sondern Emrah per `AskUserQuestion` fragen („Meine Version drauf“ oder „Erst ansehen“).
- **Plattform (Kap. 3):** genau eine `dist/index.html` ≤ 16 MB, nichts extern laden, `claude.use` nur in `src/platform`, alle `claude.use`-Aufrufe nach `contract/*.d.ts` (Version 0.2.49).
- **Daten (Kap. 9, `docs/umbau/07-datenleitplanken.md`):** nichts löschen, nichts ersetzen, Register `src/data/paths.ts` bleibt vollständig, Neues nur zusätzlich und tolerant gelesen, Schreiben nur über `writer.ts`, Datumsschlüssel nur aus `domain/date.ts` (Tageswechsel 04:00; Zeitumstellung am 25.10.2026 testen). `daily/*` und `feed/*` werden nie geschrieben.
- **Routine „Tagesauftrag“:** nie ändern ohne Emrahs ausdrückliches „Ja, Auftrag ändern“.
- **Keine Schleifen (A2):** je Phase **ein** Entwurfsdurchgang; je Prüfer eine Prüfung plus **eine** Nachprüfung; roter Test: höchstens zwei Behebungsversuche je Ursache, dann Befund und Ursache offen melden; kein Lauf ohne Änderung wiederholen. Danach entscheidet Emrah.
- **Nicht über den Auftrag hinaus bauen.** Nur was im Gesamtkonzept steht. Alles andere als Vorschlag an Emrah, nicht als Code.
- **Kontingent ist begrenzt (A7 27./28.09.):** keine überflüssigen Parallel- und Prüfrunden. Je Welle **ein** voller `npm run verify` (dauert ca. 21 bis 25 Min.; im Hintergrund starten, Ausgabe in eine Logdatei, nie mit `sleep` warten).
- **Safari/iPhone** (Blur, Tastatur, Haptik, Sprachausgabe) ist in der Cloud nicht prüfbar (nur Chromium). Das sagst du offen und lässt Emrah am iPhone testen.
- **Nie still überspringen.** Was sich hier nicht ausführen lässt, offen sagen und den nächstbesten Weg vorschlagen.

## 4 Zusammenarbeit mit Emrah
- **Immer Deutsch, einfache Worte, kein Fachjargon** (Emrahs Vorgabe vom 02.10.2026). Fachwörter (Commit, Build, Test …) nur mit einem Satz Erklärung; lieber sagen, was er als Nutzer davon merkt.
- **Jeder Bericht zu Test-Link und Live-Schaltung besteht aus drei Teilen:** (1) was genau geändert wurde, aus Sicht von Emrah, (2) wie er es am Handy testet, Schritt für Schritt mit genauen Klicks, (3) woran er erkennt, dass es richtig ist, und was er dir schicken soll, wenn nicht.
- **Berichte nur an Meilensteinen** (Test-Links T1 bis T5, Blocker, Abschluss), kurz. Zwischendurch genügt eine Zeile, was gerade läuft.
- **Fragen nur bei echten Blockern**, mit einer Empfehlung als erster Option. Für E1 bis E7 (Gesamtkonzept, Teil A) gilt der Standard, bis Emrah „anders“ sagt.
- **Bevorzugter Testweg:** Kommentare direkt in der App. Sie kommen als `[Artifact comment sent to Claude]`; beantworten und nach dem Beheben im Thread auflösen.
- Emrah sieht die Sitzung in der Claude-App. Dateien, die er lesen soll, liegen im Arbeitsordner (`docs/umbau/…`) oder als Artifact; nie nur in `/tmp`.

## 5 Wellen (Einzelheiten: Gesamtkonzept Kap. 9)
Jede Welle: kleiner Plan (eine Seite in `docs/umbau/stand.md`) → Bau → Prüfer → **ein** voller `verify` → Commit → Test-Link mit Bericht → A7-Eintrag. „Was nicht grün ist, wandert in die nächste Welle“ (A7 27.09.).

| Welle | Erste Schritte | Fertig, wenn |
|---|---|---|
| **W0** Vorbereitung | Tag `pre-fokus` auf den heutigen Stand setzen und pushen. Messbasis in `docs/umbau/09-messbasis.md`: Bundle-Größe je Ordner, Dauer der E2E-Specs, echte Dokumentzahl der Datenbank (Emrah liest sie ab: **Einstellungen → Diagnose** auf dem Test-Link), und ob das Live-Abo von `vocab`/`chunk` ab 1.000 Dokumenten **vollständig oder gekappt** liefert (`contract/db.d.ts`: `limit` 1–1000; `src/data/live.ts` prüft es nicht). Emrah bitten, in den Einstellungen die **Sicherung** zu speichern. A7-Eintrag „Gesamtkonzept“ prüfen; CLAUDE.md A1/A4 an den neuen Fokus anpassen (Kap. 2, 6, 14 des Auftrags gelten nur noch für Wörter und Grammatik). | Messwerte stehen im Dokument; ist das Abo gekappt, ist das **vor** W4 behoben oder sichtbar gemeldet |
| **W1** Entkoppeln | Gemeinsam genutzte Teile aus den abzuschaltenden Ordnern herausziehen, **bevor** gelöscht wird: `monthDoc`, `AiRunPanel` → `ui/`, `aiTasks`/`AiTaskNotice` → `app/shell/`, `textStats/chunkMatch/types/items` → `domain/text` bzw. `domain/radar`, `week/traps` und `week/text` → `domain/patterns` bzw. `domain/text`, `useChannelState`, `speak/autoplay`, `useSceneLibrary`, `domain/input/cardSrc`, `domain/say/sayDoc`, `domain/discover/steps`, `nbdrill/unitBlocks`; `domain/plan/retire.ts` (rein) und das Gerüst von `domain/metrics`. | alle Tests grün; Oberfläche und Bundle ±1 % |
| **W2** Aufräumen | Erst abklemmen (A), dann in drei Commits löschen (B). Dabei gilt das **Entfernungs-Audit** aus Kap. 6 des Konzepts als Testgerüst (zuerst schreiben, es soll anfangs rot sein). Fortschritt auf `grammar`/`vocabulary` filtern, `assess@2`. Sprechen-Extra bleibt mit **Rollenspiel und Einwand-Training**, isoliert. | Audit grün; Textscan der 4 Reiter sauber → **Test-Link T1 „Aufgeräumt“** |
| **W3** Vertrauen und Heute | `domain/metrics` als einzige Quelle für „fällig/überfällig/Fest/Serie“; Glossar in `i18n`; Invarianten-Tests; Aktionsleiste, fester Nenner, Rückmeldungs-Reihenfolge, eine Notentabelle; Fehlerschleife schließen (auch „Weiß ich nicht“); neue Heute-Karte (4 Schritte, Wiedereinstieg, Erststart). | R1–R12 für Heute und Übungsrahmen; `metricsInvariants` grün → **T2 „Heute neu“** |
| **W4** Wörter und Atlas | Hub (Zielkarte, 3 Stapel), Atlas (`?raw`-Bänder, `app/atlas`, `promote`, Einstufung, Suche), Bausteine-Fix, Kapazitätswächter. **Parallel** Inhalte-Spur I1 bis I3. | `atlasContent/Search/Promote` grün, höchstens 5 neue Dokumente je Tag → **T3 „Wörter“** |
| **W5** Grammatik und Fortschritt | Pfad mit 39 Themen, Mini-Lektion, Thema-Blatt, Aufgabenzeilen mit Thema; Fortschritt in 3 Segmenten; Satzbau → „Anwenden“. **Parallel** Inhalte-Spur I4. | Invarianten und R1–R12 für Grammatik und Fortschritt → **T4 „Grammatik“** |
| **W6** Politur und Abnahme | Übergänge, Abschluss-Moment, Haptik-Experiment (nur am Gerät prüfbar), Start unter 2,5 s bei 4× Drosselung, `verify` unter 12 Min. | Definition of Done (Kap. 8 des Konzepts) → **T5 „Feinschliff“** → Emrahs Rundgang → erst dann „Ja live nehmen“ |

**Inhalte-Spur (parallel zu W2 bis W5, getrennt von der Oberfläche):** Atlas-Index (8.000 Einträge aus NGSL, NAWL, BSL und Octanove; Lizenz CC BY-SA 4.0: Namensnennung und gleiche Lizenz, Quellenseite in der App), Karten Release 1 (ca. 600 Wendungen und C1-Business), 240 Grammatik-Aufgaben aus der Fertigbau-Linie (nur Inhalte ernten, **kein** Code), danach Erzeugung in Chargen. **Jede Charge durchläuft die Prüfkette** (Gesamtkonzept Kap. 5: automatisch → Löser-Probe → Kritiker → Lehrer-Stichprobe 100). Erzeugt wird **zur Bauzeit**, nicht in der App. Britische Schreibweisen gelten nie als Fehler, die App zeigt US-Englisch.

## 6 Werkzeuge: Agenten, Skills, Connectoren
**Agenten** (`.claude/agents/`, laden beim Sitzungsstart; fehlen sie als Typ, einen allgemeinen Agenten mit der Datei als Anweisung starten):

| Agent | Wann |
|---|---|
| `architect` | Zu Beginn jeder Welle: kleiner Plan, gegen Kap. 3 prüfen. Nur Lesen. |
| `english-teacher` | Atlas-Auswahl, Karten, Grammatik-Aufgaben, Mini-Lektionen, Prompts **vor** dem Bauen und als Stichprobe je Charge. |
| `learning-scientist` | Glossar, Fehlerschleife, Notentabelle, Atlas-Reihenfolge, jede neue Übung und jeder neue Prompt (Kap. 5, vier Pflichtfragen). |
| `ux-reviewer` | Nach jedem neuen oder geänderten Bildschirm: Playwright-Bilder 390 × 844 und Desktop, drei Modi, DE und EN, gegen Kap. 2, 4, 8 und gegen die Design-Fläche. |
| `data-guard` | Bei jeder Änderung an `src/data`, Schemas, Umstellung, Seed, Atlas-Speicher (Prüfkatalog D1 bis D23 in `07`). |
| `platform-guard` | Vor jedem Test-Link und jeder Live-Schaltung. |
| `qa-runner` | Ein voller Lauf je Welle, meldet nur Ergebnis und Fehler. |
| `debugger` | Bei roten Tests, mit der Zwei-Versuche-Regel. |

Parallel bauen ist erlaubt und erwünscht (Emrah: „nutze verschiedene Agents“), mit **je einem Worktree je Helfer** (`isolation: worktree`). Gemeinsame Dateien nur additiv ändern, Texte in `src/i18n/parts/*`. Helfer lassen nur ihre Unit-Tests und eigenen E2E-Specs laufen; die volle Suite und die Prüfer laufen gebündelt beim Zusammenführen (A7 26.09.).

**Skills:** Es ist kein zusätzlicher Skill nötig. `artifact-design` gilt nur, wenn du ein eigenes Artifact baust (nicht für `dist/index.html`). Die Design-Fläche änderst du nur, wenn Emrah es verlangt (Skill `artifact-design`, Typ „Design“).
**Connectoren:** verbunden sind Gmail, Google Calendar, Miro und Notion; **keiner wird für den Umbau gebraucht**. Miro wäre nur sinnvoll, wenn Emrah ein Ablaufdiagramm als Board wünscht. Nichts von Emrahs Daten gehört in einen Connector.

## 7 Test-Link veröffentlichen (Ablauf)
1. `npm run verify` (ein Lauf je Welle) und `platform-guard` ohne Befund.
2. `dist/index.html` bauen (`npm run build`), in einen Ordner im Scratchpad kopieren.
3. Aktuelle Version des Test-Links lesen (siehe Kap. 3, Konfliktregel).
4. Veröffentlichen mit `url` = Test-Link, `file_path` = die Datei, **ohne** `capabilities` und ohne `force`.
5. A7-Eintrag (Datum, Welle, Version, Rückweg-Version, Prüfergebnis), Commit, Push, Bericht an Emrah im Dreiteiler.

## 8 Definition of Done (Gesamtprojekt, aus Kap. 8 des Konzepts)
1. Kein Wort, Bild oder Knopf zu Lesen, Hören, Schreiben, Entdecken, Preply oder Business auf den 4 Reitern, in Blättern, Einstellungen und Fortschritt (Textscan DE und EN, Routen-Audit).
2. Jede angezeigte Zahl hat genau eine Quelle; die 20 Invarianten sind grün.
3. UX-Regeln R1 bis R12 grün (`tests/e2e/uxRules.spec.ts`), axe 0 Verstöße in Dunkel, Gedämpft, Hell, Bilder 390 × 844 neu aufgenommen.
4. Start unter 2,5 s bei 4× Drosselung (Ziel unter 2 s), keine Long Task über 100 ms, Bundle höchstens 4,5 MB (Warnung) bzw. 6 MB (Fehler).
5. Daten: Superset-Test, Sicherung vollständig, Serie alt/neu, `data-guard` ohne Befund.
6. Inhalte: Atlas Release 1 (ca. 600) und mindestens 12 Aufgaben je Thema für 16 Themen durch die Prüfkette; Quellenseite vorhanden.
7. `npm run verify` grün unter 12 Min.; `platform-guard` Freigabe; Emrahs Rundgang am iPhone ohne Beanstandung.

## 9 Bekannte Stolpersteine
- Repo-Stil: einfache Anführungszeichen, Zeilenbreite 200. **Kein** `prettier --write` auf ganze Dateien (verändert die Formatierung); gezielt editieren.
- Fünf E2E-Specs (u. a. `grammar.spec`) fallen unter Last gelegentlich durch und laufen einzeln grün. Das gilt als Lastausreißer, nicht als Fehler; in W6 stabilisieren (`retries: 1` nur im Gesamtlauf, `test.slow()`).
- Chromium liegt unter `/opt/pw-browsers`; **nie `playwright install`**.
- Temporäre Dateien gehören in den Scratchpad, nicht ins Repository (der Stop-Hook meldet sie sonst).
- Lokale Branches `worktree-agent-*` und `p3-work` sind Altlasten früherer Helfer; ignorieren, nicht aufräumen.
- `writer.compact` bleibt aus. Serie und Pflicht: A6.13, `pflichtSince` nie ändern.

## 10 Was du nicht tust
Nichts auf `main` zusammenführen · nichts live nehmen ohne „Ja live nehmen“ · keinen Test-Link per `force` überschreiben · keine Daten löschen oder umschreiben · keinen Code der Fertigbau-Linie übernehmen (nur Inhalte) · die Routine nicht anfassen · keine neuen Funktionen außerhalb des Konzepts · keine Fertigkeiten außer Wörtern und Grammatik im Fortschritt anzeigen.
