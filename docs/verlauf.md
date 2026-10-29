# Verlauf – Lingo-Engine X

Wörtlich aus der früheren `CLAUDE.md` ausgelagert (29.10.2026), damit sie in jeder Sitzung klein bleibt. Hier wird weiter protokolliert: neue Entscheidungen mit Datum unten anhängen, die geltende Kurzfassung in `CLAUDE.md` A7 nachziehen.

## A4. Phasenplan und Stand
Stand pflegen: nach jedem Arbeitsschritt hier abhaken.

- [x] **Phase 0 – Fundament** (ausgeliefert 26.09.2026)
  - [x] Anhänge zerlegt (`contract/`, `docs/datenstruktur.json`), Auftrag nach `docs/auftrag.md`
  - [x] CLAUDE.md, Subagents in `.claude/agents/`
  - [x] Vorgänger-App analysiert (nur Quelltext gelesen): `docs/altapp-analyse.md`
  - [x] Entscheidungsfragen gestellt, Antworten in A7
  - [x] Projekt (Vite 8 + React 19 + TS strict + Tailwind 4 + Vitest + Playwright/axe), SessionStart-Hook `.claude/hooks/session-start.sh`
  - [x] Plattform-Adapter `/src/platform` (Produktion + Entwicklungs-Adapter `src/platform/dev`), Build ohne Adapter (Test + `check:platform`)
  - [x] Design-System (Tokens Dunkel/Gedämpft/Hell in `src/styles/index.css`, Inter eingebettet, Kontrasttest)
  - [x] Datenmodell (zod-Schemas aller Pfade, `docs/datenmodell.md`), Voreinstellungen als Daten (`src/content/legacy`), `seed/sample-data.json`
  - [x] Umstellung v1 (`app/schema`) mit Trockenlauf-Bericht, FSRS-Startwerten (`docs/fsrs-umrechnung.md`) und Tests
- [ ] Phase 1 – Kern-Erlebnis: Heute, Interaktions-Engine, Vokabel-/Chunk-Trainer mit FSRS, Wort-Antippen
  - [x] Plan `docs/phase1-plan.md` (fünf Fachentwürfe + Synthese)
  - [x] MVP (Heute + Vokabeltrainer mit FSRS und kinetischer Lücke) – produktiv seit 26.09.2026
  - [x] Vorarbeiten fertig, noch nicht gemergt: WP1 KI-Tor/Sprachausgabe (`1651f78`), WP3 Wörterbuch/Lautschrift (`779bdd0`)
  - [x] Trainer-Umbau nach Emrahs Rückmeldung, Wort-Antippen, Lautschrift, Aussprache, KI-Tor – produktiv (c29b3dd)
  - [ ] Pflicht/`pflichtSince` und Wendungen im Trainer kommen mit Phase 2
- [ ] Phase 2 – Lernen: Kurs, Grammatik, Diktat, Lückenjagd, Satzbau, Sprint
- [ ] Phase 3 – Sprechen: Rollenspiel mit Analysepanel, Sprachausgabe, Chunks mitnehmen, Business-Suite
- [ ] Phase 4 – Input und Output: Lesen, Hören, Schreiben, Entdecken
- [ ] Phase 5 – Begleiter und Brücke: Claude-Chat, Übersetzer, Preply-Brücke
  - [x] Phasen 2–5 gebaut und zusammengeführt (Stand `59bbc06`, verify grün: 728 Unit, 245 E2E); kombinierte Prüfung ohne Blocker, Befunde behoben (`690cc64`), Test-Link `AXHkh6…` Version `1790477322-3c8f`
- [x] Phase 6 – Urteil: KI-Einschätzung, Fortschritt, Wochenbericht, Tagesplan-Gewichtung (`4423372`, geprüft, Befunde behoben)
- [x] Phase 7 – Politur und Umzug (Veröffentlichung auf die alte Adresse nur nach Emrahs ausdrücklichem OK)
  - [x] P7-1 bis P7-4; komplette App auf dem Test-Link `AXHkh6…` Version `1790487478-0d6d` (verify grün: 810 Unit, 312 E2E)
  - [x] P7-5 Umzug: komplette App auf `JLL8…` Version `1790493495-85c8` (27.09.2026, Emrahs Freigabe „Ja, veröffentlichen“)

## A7. Entscheidungsprotokoll
Hier werden Emrahs Antworten auf die Phase-0-Fragen und alle weiteren Produktentscheidungen mit Datum eingetragen.

**26.09.2026 – Antworten auf die Phase-0-Fragen**
1. **Datenquelle:** Nur die per Link geteilte „Sprachwerkstatt" (Vertrag 0.2.49) enthält echte Lernstände. Der private Neubau-Versuch vom 26.09. mit eigener Datenbank bleibt unberührt, es wird nichts daraus übernommen.
2. **Serie für neue Tage:** Ein Tag zählt, wenn die **Pflicht erledigt** ist. **Ein Ruhetag pro Kalenderwoche** (Mo–So) bricht die Serie nicht. Er wird nicht angespart. Die Regel gilt ab dem ersten Tag, an dem die App die Pflicht erfasst (`pflichtSince`, Phase 1). Davor gilt die alte Regel (A6.13).
3. **Englisch-Variante:** **Amerikanisch** ist Standard für Schreibweise, Lautschrift, Beispielsätze, KI-Texte und die Standardstimme (en-US). Britische Schreibweisen und Wörter gelten bei Antworten **immer auch als richtig**. Die Rückmeldung nennt dann die US-Form als Hinweis, nie als Fehler.
4. **Hauptgerät:** **iPhone mit Safari** (claude.ai im Browser). Daraus folgt:
   - Safari-Eigenheiten zuerst: `-webkit-backdrop-filter`, `visualViewport` für die Bildschirmtastatur, `env(safe-area-inset-*)`.
   - Sprachausgabe: Stimmen kommen verzögert (`voiceschanged`), Stücke ≤ 150 Zeichen, 60 ms Pause nach `cancel()`, Wecker gegen Pausieren.
   - `navigator.vibrate` gibt es auf dem iPhone nicht. Die Rückmeldung ist dort rein visuell, per Merkmalserkennung und nie als kaputter Aufruf.
   - Spracheingabe nur, wenn sie im eingebetteten Artefakt wirklich startet, sonst wird der Knopf ausgeblendet.
   - **Grenze der Cloud-Umgebung:** Hier gibt es nur Chromium, keine Safari-Engine (WebKit). Automatische Tests laufen mit Chromium in iPhone-Größe mit Touch. Safari-spezifisches Verhalten prüft Emrah am Gerät.

**26.09.2026 – Arbeitsweise (Emrahs Wahl)**
- **So gründlich wie bisher:** Jede Phase wird von mehreren unabhängigen Fachentwürfen geplant (Architektur, Lernwissenschaft, Interaktion, Daten, Tests) und vor der Auslieferung unabhängig geprüft. Das gilt ausdrücklich auch dann, wenn eine Phase dadurch länger dauert. Angeboten waren auch „schneller, Daten streng" und „maximal schnell".
- **Bestätigt nach der Zeitschätzung** (Phase 1 heute Nacht/morgen früh, ganze App in 2–3 Tagen): Phase für Phase in voller Qualität. Abgelehnt wurden „Tageskern in 3–4 Std." und „alle Module einfach in 6–8 Std.". Parallel wird so weit gebaut, wie es die Umgebung erlaubt: 4–6 Helfer gleichzeitig, auch außerhalb der Workflow-Grenze.

**26.09.2026, 17 Uhr – MVP zuerst (Emrahs Vorgabe)**
- **Innerhalb von 2–3 Stunden kommt ein testbares MVP** auf den bestehenden Test-Link: Heute-Bildschirm mit einem Knopf, Vokabel- und Wendungstrainer mit FSRS und kinetischer Lücke. Es arbeitet auf der Datenkopie im Test-Artefakt.
- **MVP-Grenzen:**
  - `pflichtSince` wird noch nicht gesetzt, die Serie läuft nach der alten Regel weiter.
  - Die Schreibwege folgen der Daten-Spezifikation (fsrs zusätzlich, alte Felder gespiegelt, nichts gelöscht).
  - data-guard prüft das vor der Veröffentlichung einmal.
- **Danach im Hintergrund:** Der Rest von Phase 1 (Wort-Antippen mit Lautschrift und KI, alle Abfragearten, Bausteine, Pflicht/`pflichtSince`) und die Phasen 2–7 folgen in voller Qualität. Jeder fertige Stand geht auf denselben Link.

**26.09.2026, ca. 17:15 Uhr – vorgezogener Umzug (Emrahs ausdrückliches OK)**
- **Entscheidung:** Emrah will ab heute produktiv mit dem MVP üben. Er hat ausdrücklich „B: Alte App jetzt ersetzen" gewählt. Das MVP wird auf die Adresse der alten App veröffentlicht (`JLL8…`, dieselbe Datenbank).
  - Er weiß: Grammatik, Lesen, Hören, Schreiben, Chat und Preply fehlen, bis die jeweiligen Phasen fertig sind. Die Daten dazu bleiben erhalten.
  - Die Alternative „neuer Link nur für Vokabeln" hat er abgelehnt.
- **Rückweg:** Die alte App liegt als Artefakt-Version `1790259934-2c07` vor (46 Dateien, Hauptseite zusätzlich im Scratchpad gesichert). Die übrigen Dateien der alten Version bleiben beim Veröffentlichen stehen.
- **Bedingungen vor dem Umzug:**
  - MVP-Tests grün.
  - data-guard und platform-guard je eine Runde ohne Befund.
  - Rauchtest des Builds mit einer lokalen Kopie der echten Datenformen.
  - Fähigkeiten `db`, `sample`, `downloads`, Vertragsversion bleibt.
- **Beim ersten Öffnen** zeigt die App den Trockenlauf der Umstellung. Emrah speichert zuerst die Sicherung und bestätigt dann.
- **Ab jetzt gilt für jede weitere Phase:** Erst Test-Artefakt (Kopie), dann nach grünen Tests und Prüfungen auf die Produktivadresse. Das wird Emrah jeweils gemeldet.

**26.09.2026, ca. 18:10 Uhr – MVP produktiv**
- **Veröffentlicht:** `dist/index.html` aus `aa8003f` auf `JLL8…`, Version `1790438409-b53c` (Artefakt-Version 46).
  - Fähigkeiten: `db`, `sample`, `downloads`; Vertrag bleibt 0.2.49.
  - Zum Zeitpunkt der Veröffentlichung existierte `app/schema` noch nicht. Die Umstellung bestätigt Emrah selbst.
- **Rückweg:** Die alte Version `1790259934-2c07` wiederherstellen.
  - Achtung (data-guard R1): Die alte App schreibt beim Laden vorgemerkte `sw2:`-Kopien per `set` zurück.
  - Vorher also die Datenbank sichern.
- **Bedingung B1:** Offene Tabs der alten App auf allen Geräten schließen bzw. neu laden, bevor geübt wird. Die alte Seite schreibt ganze Dokumente aus ihrer lokalen Kopie.
- **Offene Hinweise für den Ausbau:**
  - platform-guard: H3 (Fehlerzustand `log/<heute>`), H5 (`visualViewport`), H6 (Validierungs-Cache), Testuhr in `fixtures.ts` nur für `Date`, Datum zwischen 0 und 4 Uhr.
  - data-guard W1 (Folgenummer beim Wiederholen), W2 (zwei Tabs), W3 (Puffer beim Schließen), W5 (Nachtragen-Hinweis auch auf Heute), W6 (Emrah erklären: nachts zählt der Vortag), W7, W8 (alle angesammelten `daily/*` verarbeiten), W9 (`pflichtSince` nie rückwirkend).

**26.09.2026, ca. 18:15 Uhr – Emrahs Rückmeldung zum Trainer (geht Kap. 4.1 und Kap. 5 vor)**
- **Keine Selbstbewertung:** Die Note (Nochmal/Schwer/Gut/Leicht) bestimmt die App allein aus Richtigkeit, Antwortzeit und genutzter Hilfe. Es gibt keine Bewertungsknöpfe mehr, nur „Weiter".
- **Status statt Erklärtexten:** Oben stehen je Karte die Sicherheit (aus FSRS/Stufe, z. B. 5 Punkte + Wort) und die Abfrageart. Kein „Wozu"-Absatz, keine Quelle, kein Tastatur-Hinweis, keine Sekunden.
  - Die vier Pflichtfragen bleiben erfüllt: Aufgabe in einer kurzen Zeile, Zweck nur hinter einem Info-Symbol.
- **Nach dem Prüfen echte Hilfe statt „Warum":**
  - Bedeutung und Wortart kompakt, Hinweis auf die Form.
  - 2–3 Beispielsätze (Ursprungssatz, Kollokationen, sonst KI-erzeugt und gespeichert).
  - Jedes englische Wort antippbar (Bedeutung im Kontext, US-Lautschrift, Aussprache, als Karte speichern, „Claude fragen").
- **Lücke zeigt Buchstaben-Platzhalter** (einer je Buchstabe) in den Stufen mit Hilfe. In freien Stufen deckt der Knopf „Tipp" sie auf und zählt als Hilfe. Damit ist Kap. 4.1 „Anfangsbreite verrät die Länge nicht" für diese Fälle aufgehoben.

**26.09.2026, abends – Vollausbau statt MVP (Emrahs Vorgabe)**
- Emrah will die komplette App laut Auftrag, keine abgespeckten Zwischenstände.
- Emrahs Trainer-Rückmeldung gilt für **alle** Übungen und Module: automatische Einstufung, Status statt Erklärtexten, Beispiele statt „Warum", Wort-Antippen mit „Claude fragen", Buchstaben-Platzhalter.
- Die Planung aller verbleibenden Phasen läuft parallel. Gebaut wird Phase für Phase ohne Pause.
- Live geht nur, was vollständig fertig und geprüft ist. Ausnahme: der Trainer-Umbau, weil er Emrahs Kritik am laufenden Trainer behebt.

**26.09.2026, abends – Funktionsgleichheit und Tempo (Emrahs Vorgabe)**
- **Nicht schlechter als die alte App:** Alle guten und wichtigen Funktionen der alten App kommen mit hinein. Grundlage ist der Abgleich in `docs/altapp-funktionsabgleich.md`.
- **Mehr Tempo bei gleicher Qualität:**
  - Die Phasen 2–5 werden gleichzeitig in getrennten Worktrees gebaut.
  - Gemeinsame Dateien werden nur additiv geändert, Texte stehen in `src/i18n/parts/*`.
  - Die Helfer lassen nur Unit-Tests und die eigenen E2E-Specs laufen. Die volle Suite und die Prüfer laufen gebündelt beim Zusammenführen.

**26.09.2026, nachts – Phase 1 produktiv (Emrahs Freigabe „Ja, veröffentlichen")**
- `dist/index.html` aus `c29b3dd` liegt auf `JLL8…` (Version `1790444355-d812`) und auf dem Test-Link (`1790443340-1144`).
- Enthalten sind: automatische Einstufung, Status, Platzhalter, Beispiele, Wort-Antippen mit Lautschrift und Aussprache, „Claude fragen".
- Geprüft von data-guard, platform-guard und ux-reviewer (je eine Runde plus Nachprüfung).
- Der Sicherheitsfilter der Sitzung verlangt vor jeder Veröffentlichung auf `JLL8…` Emrahs ausdrückliche Freigabe.

**27.09.2026 – Preply und Serie:** Eine gehaltene Preply-Stunde zählt nur als Extra, nicht als Pflicht für die Serie (Emrahs Wahl).

**27.09.2026 – Kontingent sparen (Emrahs Vorgabe)**
- Keine zusätzlichen Planungs- oder Parallelrunden.
- Zusammenführen und Prüfen in einem Durchgang, mit einem kombinierten Prüfer (Daten + Plattform + UX).
- Die Phasen 6+7 baut ein Helfer.
- Berichte an Emrah nur an Meilensteinen, kurz.

**26.09.2026, ca. 23 Uhr – neue Zusammenarbeit (Emrahs Vorgabe, gilt ab sofort)**
- **Immer nur ein kleines Problem zur Zeit.** Funktionierender Code wird nicht nebenbei mit angefasst.
- **Vor jeder neuen Funktion oder größeren Änderung** wird der Ansatz in ein bis zwei Sätzen skizziert. Umgesetzt wird erst nach Emrahs „Go".
- **Stand der Arbeitszweige** (lokal, noch nicht zusammengeführt):
  - Phase 2 Domäne `worktree-agent-a1fcb727b01f42d07` (fertig)
  - Phase 2 Bildschirme `worktree-agent-aaed2392f8db972dd` (Zwischenstand `07be1e7`, ungetestet)
  - Phase 3 `worktree-agent-aca0f22367f924b04` (fertig)
  - Phase 4 `worktree-agent-ac729d3fd574a67cf` (Zwischenstand `74a13e6`, ungetestet)
  - Phase 5 `worktree-agent-ae7b0211db2f2df80` (fertig)
- Zusammengeführt wird einzeln nacheinander, jeweils mit vollem Testlauf.

**26.09.2026, ca. 22:30 Uhr – ohne „Go" durchbauen (Emrahs Vorgabe, ersetzt das Vorab-Abstimmen)**
- Kein „Go" mehr vor jedem Schritt. Die restlichen Schritte laufen ohne Rückfrage nacheinander:
  1. Phase 2 grün,
  2. Phase 3 + 5 zusammenführen (Streaming vereinheitlichen),
  3. Phase 4 fertig,
  4. ein kombinierter Prüfer,
  5. Test-Link,
  6. Phasen 6+7.
- Effizient, keine Schleifen, kein endloses Nachbessern (A2 gilt streng).
- Ziel: Ergebnis in etwa 12 Stunden.
- Bis zum Go-Live keine Rückfragen. Nach einer Limit-Pause automatisch weitermachen (stündlicher Check-in per `send_later`).
- Veröffentlichen auf `JLL8…` (Go-Live) weiterhin nur mit Emrahs ausdrücklicher Freigabe.

**27.09.2026 – Go-Live der kompletten App (Emrahs Freigabe „Ja, veröffentlichen“)**
- `dist/index.html` aus `86893f7` liegt auf `JLL8…`, Version `1790493495-85c8` (Artefakt-Version 48).
  - Fähigkeiten `db`, `sample`, `downloads`; Vertrag bleibt 0.2.49.
- Rückweg: Phase-1-Version `1790444355-d812` wiederherstellen.
- Offen für Emrahs Rückmeldung am iPhone:
  - Ladezeit (~3 s unter Drossel),
  - automatische Einschätzung beim Öffnen von „Dein Stand“,
  - lange Can-Do-Liste,
  - „Wiederholen“ dreimal auf Heute.
- `writer.compact` bleibt aus.
- Tagesauftrag (Routine „Englisch – Tagesaufgaben & Entdecken-Beiträge“) zeigte auf ein anderes Artefakt (`CzgW…`). Mit Emrahs „Ja“ zurück auf `JLL8…` gestellt:
  - Datenmodell der alten App,
  - schreibt nur `daily/<morgen>` und `feed/<morgen>` und nur, wenn noch nicht vorhanden,
  - nur die 16 Grammatik-IDs,
  - US-Englisch.

**27.09.2026 – Fehlerbehebungs-Paket produktiv (Emrahs Freigabe „Ja, veröffentlichen“)**
- `dist/index.html` aus `bc6750d` liegt auf `JLL8…`, Version `1790506302-f210` (Artefakt-Version 49).
- Grundlage war eine Prüfrunde mit realistischen Claude-Antworten, echten Datenformen und Logik-Grenzfällen:
  - KI-Vorlagen lesen tolerant.
  - Nach Fehlantworten wird der Zwischenspeicher umgangen.
  - Pflicht über 04:00, zwei Tabs, Vorrang der Wiederholungen.
  - Übersetzer automatisch oder mit fester Richtung.
- Rückweg: Version `1790493495-85c8`.
- Offene Lücken laut Abgleich (Scratchpad `abgleich.md`) werden als Nächstes gebaut:
  - Wendungs-Wiederholung,
  - Abfragearten,
  - alte Daten,
  - Kontext-Feld,
  - Wochen-Check, Wochenstreifen,
  - „Als Preply-Stunde“,
  - Kleinigkeiten.

**27.09.2026, nachmittags – Komplettpaket produktiv (Emrahs Freigabe „Ja veröffentlichen“)**
- `dist/index.html` (Code `835f7f0`, Commit `581740e`) liegt auf `JLL8…`, Version `1790518396-3735` (Artefakt-Version 50).
- Enthalten: alle Lücken aus dem Abgleich:
  - Wendungs-Wiederholung und 8 neue Abfragearten,
  - Wochen-Check, Wochenstreifen, alte Daten, Farbthemen, Kontext, Als Preply-Stunde,
  - feste Szenen, Kurs ab l25, Wischgesten, Vibration, Übergänge, Validierungs-Cache, App-Version in der Diagnose.
- Rückweg: Version `1790506302-f210`.
- Offen:
  - Start ~2,7 s unter Drossel.
  - iPhone-Prüfpunkte (Tastatur, Hören, Wischen, Übersetzer).
- Emrah testet jetzt komplett und schickt gesammeltes Feedback.

**27.09.2026, abends – KI-Antworten lesbar (Emrahs Freigabe „Ja“)**
- `dist/index.html` (Code `e65f839`) auf `JLL8…`, Version `1790521986-3347` (Artefakt-Version 51).
- Ursache „unvollständig“ laut Emrahs Diagnose: Claude schrieb in deutschen Texten „…" mit geradem Schlusszeichen, `sample.json` verwarf die Antwort.
- Jetzt:
  - alle Vorlagen über `sample()` mit reparierendem Lesen (`repairJson` in `src/ai/gate.ts`),
  - Anführungszeichen-Regel `QUOTE_RULE` an jedem Prompt,
  - die Lücke bricht lange Antworten zwischen Wörtern um.
- Rückweg: Version `1790518396-3735`.

**27.09.2026, abends – Lernberatung, neue Struktur, Paket 1 produktiv (Emrahs Freigabe „Ja veröffentlichen“)**
- Emrahs Kritik: „schöner, aber keine neuen Ansätze“, „zu verschachtelt“. Neuer Agent `english-teacher` angelegt; Englischlehrer + Lernwissenschaft (`docs/lernberatung.md`) und UX-Beratung (`docs/ux-beratung.md`) als Berater **vor** dem Bauen.
- Emrah: „Ich will alles fertig haben“, dann feste Grenze in zwei Paketen (Emrahs „Ja“): was nicht grün ist, wandert ins nächste Paket statt die Zeit zu verlängern.
- **Paket 1** (`dist/index.html` aus `aac7728`) auf `JLL8…`, Version `1790536760-1f37` (Artefakt-Version 52):
  - „Sag es“ (Pflicht an 4–5 Tagen, `say/<Monat>`), Reparatur-Sätze (`app/repair`, Boxen 1/3/9, „Nochmal, aber besser“), erst Hinweis dann Lösung, Satzbau/Sprint nur Angebot, Lektion an Sag-es-Tagen Angebot, Wendungen ab Stufe 3.
  - Neue Struktur: 4 Reiter (Heute · Üben · Sprechen · Stand), Rückweg zur Herkunft, gemeinsame Übungsleiste, Stand/Wortschatz/Einstellungen entschlackt.
  - Fixes: Begleiter antwortet auf die aktuelle Frage, Übersetzer → Vokabeltrainer, Merkhilfe robuster.
- Rückweg: Version `1790521986-3347`.
- **Paket 2 produktiv** (Emrahs Freigabe „Ja veröffentlichen“): `dist/index.html` aus `57b3c90` auf `JLL8…`, Version `1790541376-265e` (Artefakt-Version 53).
  - Deutsch-Fallen (`app/patterns`) + Preply-Wochenziele, C1-Werkzeugkasten (7 Themen `c1-*`, die 16 alten IDs unberührt) + drei Tonlagen (`tones/<Monat>`), Flüssigkeit 90/60/45 (`fluency/<Monat>`) + „Mein nächster Termin“ (`meeting/<Monat>`); Einstiege unter Sprechen → Training.
  - Emrahs App-Kommentare: neue Wörter klar gegliedert, Trainer-Zähler zählt Nochmal/Reparatur mit, Übersetzer/Claude/Einstellungen auf jeder Seite und in jeder Übung.
  - Rückweg: Version `1790536760-1f37`.
- **Kommentare in der App** sind Emrahs bevorzugter Testweg: an Claude gesendet, mit Ort; nach dem Beheben im Thread antworten und auflösen.

**26.09.2026 – eigene Festlegungen**
- **Tageswechsel um 04:00 Uhr Ortszeit** des Geräts. Eine Einheit nach Mitternacht zählt noch zum Vortag. Der Datumsschlüssel `JJJJ-MM-TT` wird überall mit derselben Funktion berechnet.
- **E2E-Tests laufen gegen den echten Produktions-Build** `dist/index.html`. Der Entwicklungs-Adapter wird dabei **von außen** als nachgebildete `window.claude`-Laufzeit eingespielt (Playwright `addInitScript`). So wird der Produktionspfad mitgetestet, und der Adapter ist nie Teil des Builds.
