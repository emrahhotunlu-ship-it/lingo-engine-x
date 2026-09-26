# CLAUDE.md – Lingo-Engine X

Dauerhafte Arbeitsgrundlage für **jede** Claude-Code-Sitzung in diesem Repository.
Teil A fasst Auftrag, Arbeitsweise und Stand zusammen. Teil B enthält die Kapitel 2, 3, 14 und 15 des Auftrags **wörtlich**. Sie sind nicht verhandelbar.

---

# TEIL A – ARBEITSGRUNDLAGE

## A1. Auftrag in Kürze
- **Was:** Neubau von null (Greenfield) einer persönlichen High-End-Englisch-App (B2 → C1) für Emrah. Sie läuft als **veröffentlichtes Claude-Artefakt**: eine einzige HTML-Datei, Datenbank und KI ausschließlich über `claude.use("db")` / `claude.use("sample")`.
- **Vorgänger-App:** Von ihr werden nur **die Daten und die Funktionsideen** übernommen, **kein Code**.
- **Vollständiger Auftrag:** `docs/auftrag.md` (Kapitel 0–15). Vor jeder Phase die betroffenen Kapitel dort vollständig lesen, besonders Kap. 4 (Interaktions-Engine), 5 (Lernwissenschaft), 6 (Funktionsumfang), 7 (Motivation), 8 (Design-System), 9 (Daten), 10 (KI-Schicht), 12 (Tests), 13 (Phasenplan).
- **Maßgebliche Laufzeit-Verträge:** `contract/*.d.ts` (Version 0.2.49). **Vor jedem Daten- oder KI-Code** `contract/claude.d.ts`, `contract/db.d.ts` und `contract/sample.d.ts` vollständig lesen, nichts aus dem Gedächtnis raten. Widerspricht der Auftragstext einem Vertrag, gilt der Vertrag (Kap. 3.1: „maßgeblich").
- **Bestehende Datenstruktur:** `docs/datenstruktur.json` (Anhang B). Sie ist die Referenz für jeden Dokumentpfad und jedes Feld der alten Datenbank.

## A2. Zusammenarbeit mit Emrah
- Emrah hat **keine Entwicklererfahrung** und arbeitet **ausschließlich am Handy**. Er installiert nichts und führt nichts aus. Ist doch etwas von ihm nötig: einfache Worte und genaue Klicks am Handy.
- Kommunikation auf **Deutsch**, klar, ohne Fachjargon.
- Die Entscheidungsfragen wurden in Phase 0 gebündelt gestellt (höchstens fünf). Danach arbeitest du selbstständig und fragst nur noch bei echten Blockern.
- **Nie still überspringen:** Was sich in der Cloud-Umgebung nicht installieren oder ausführen lässt, offen sagen und den nächstbesten Weg vorschlagen.
- Keine Geheimnisse und **keine echten persönlichen Daten** im Repository. Testdaten sind erfunden (`seed/sample-data.json`).

## A3. Auslieferung am Ende jeder Phase
1. Alle Tests grün (Subagent `qa-runner`). `platform-guard` und `data-guard` ohne Befund. **Keine Auslieferung, solange ein Test rot ist.**
2. Genau **eine** Datei `dist/index.html` im Repository. `dist/` steht **nicht** in `.gitignore`.
3. **Ein Commit je Phase** mit klarer Nachricht, z. B. „Phase 1: Kern-Erlebnis", damit jeder Stand zurückholbar ist.
4. Entwickelt wird auf dem Arbeits-Branch der Sitzung. Nach grünen Tests wird er **in `main` zusammengeführt und `main` gepusht** (Kap. 0.4). `dist/index.html` muss auf `main` liegen.
5. **Bericht an Emrah in genau drei Sätzen:** was neu ist · was Emrah testen soll · was als Nächstes kommt.
6. Veröffentlicht wird **in claude.ai**, nicht aus diesem Repository. Emrah gibt dort Bescheid, die Datei wird aus dem Repository geholt und zunächst als **separates Test-Artefakt** mit einer Kopie seiner Daten veröffentlicht. Beim Veröffentlichen die Fähigkeiten `db`, `sample` und `downloads` deklarieren. **Die alte App bleibt unberührt**, bis Emrah in Phase 7 ausdrücklich OK sagt. Nie über die laufende App veröffentlichen, um etwas zu zeigen.

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
- [ ] Phase 2 – Lernen: Kurs, Grammatik, Diktat, Lückenjagd, Satzbau, Sprint
- [ ] Phase 3 – Sprechen: Rollenspiel mit Analysepanel, Sprachausgabe, Chunks mitnehmen, Business-Suite
- [ ] Phase 4 – Input und Output: Lesen, Hören, Schreiben, Entdecken
- [ ] Phase 5 – Begleiter und Brücke: Claude-Chat, Übersetzer, Preply-Brücke
- [ ] Phase 6 – Urteil: KI-Einschätzung, Fortschritt, Wochenbericht, Tagesplan-Gewichtung
- [ ] Phase 7 – Politur und Umzug (Veröffentlichung auf die alte Adresse nur nach Emrahs ausdrücklichem OK)

## A5. Subagents (`.claude/agents/`)
| Subagent | Wann einsetzen | Rechte |
|---|---|---|
| `architect` | Zu Beginn jeder Phase: Plan erstellen, gegen Kap. 3 prüfen (besonders die Artefakt-Regeln) | nur Lesen |
| `platform-guard` | Vor **jeder** Auslieferung: eine Datei, < 16 MB, keine externen Anfragen außer den erlaubten Hosts, kein Entwicklungs-Adapter im Build, jeder `claude.use`-Aufruf entspricht `contract/` | Lesen + Befehle |
| `ux-reviewer` | Nach jedem neuen oder geänderten Bildschirm: Playwright-Screenshots (Handy + Desktop, alle drei Modi) gegen Kap. 2, 4, 8 | Lesen + Befehle |
| `learning-scientist` | Bei jeder neuen Übung und jedem Prompt: gegen Kap. 5 und die vier Pflichtfragen | nur Lesen |
| `qa-runner` | Vor jedem Commit auf `main`: alle Tests, meldet nur Ergebnis und Fehler | Lesen + Befehle |
| `data-guard` | Bei jeder Änderung an `/src/data`, Schemas, Umstellung, Seed: gegen Kap. 9 | Lesen + Befehle |
| `debugger` | Bei roten Tests: findet die Ursache und behebt sie minimal | Lesen + Schreiben + Befehle |

## A6. Verbindliche Auslegung von Unklarheiten im Auftrag
1. **`seed/export.json` (Kap. 13, Phase 0) gibt es nicht.** Gemeint ist `seed/sample-data.json` (Kap. 3.3): erfunden, realistisch, exakt in der Struktur von Anhang B. Echte Daten kommen nie ins Repository.
2. **„Timeout" (Kap. 10) gegen `sample.d.ts`:** Der Vertrag verbietet einen eigenen Timeout-Timer. Der Timer würde auch die Zeit im Zustimmungsdialog mitzählen, und die Plattform beendet zu lange Aufrufe selbst. Deshalb gibt es **keinen automatischen Abbruch**. Stattdessen: „Denkt nach …" bis zum ersten `onText`. Nach einer Wartezeit je `modelTier` folgt ein ruhiger Hinweis „dauert länger als üblich" mit Stopp-Knopf. Abbruch nur per `AbortController`: Stopp durch den Nutzer oder Bildschirmwechsel.
3. **„Ungültige Antworten werden einmal neu angefragt" (Kap. 10) gegen `sample.d.ts` („do not retry from code", „NEVER retry from a loop"):** Ein automatischer zweiter Versuch passiert nur, wenn die Antwort zwar als JSON lesbar war, aber das zod-Schema verletzt. Er passiert genau **einmal** und mit angehängter Fehlerbeschreibung. Dadurch ist die Eingabe eine andere und trifft nicht den Zwischenspeicher. `invalid_json`, `rate_limited` und alle anderen Codes werden **nie** automatisch wiederholt. Stattdessen: sauberer Fehlerzustand und Knopf „Erneut versuchen" für den Nutzer.
4. **Pfade ohne Struktur in Anhang B** (in Kap. 9 genannt: `preply/`, `chunks/`, `articles/`, `reading/`): Die alte App nutzt tatsächlich `chunk/` (Einzahl), `scene/`, `preply/`, `articles/`, `reading/`, `lpool/`, `wprompt/` und zwei Formen von `writing/`. Ihre Strukturen stehen in `docs/altapp-analyse.md`, Abschnitt 5. Gelesen wird mit zod und `passthrough`, gelöscht wird nie.
5. **Keine `data/users/`-Pfade.** Die Fähigkeit `user` ist nicht Teil von `contract/`. Emrah ist der einzige Nutzer. Alle Dokumente liegen wie bisher auf gemeinsamen Pfaden.
6. **Kapazitätsgrenzen aus `db.d.ts` sind Architektur-Vorgaben:** höchstens 5.000 Dokumente je Artefakt, 256 KiB je Dokument, 64 Abonnements je Ansicht, 64 KiB je `sample`-Eingabe. Neue, wachsende Datenströme werden zusammengefasst statt ein Dokument je Eintrag. Die Diagnose-Ansicht zeigt die Dokumentenzahl. `data-guard` überwacht das.
7. **„Stack lokal auf Emrahs Rechner" (Kap. 3.2):** Build und Tests laufen in der Claude-Code-Cloud-Umgebung. Emrah führt nichts aus.
8. **Externe Hosts (Kap. 3.1):** Es wird **gar nichts** extern geladen, auch keine Google Fonts und kein CDN. Alles ist per Build eingebettet.
9. **Vorgänger-App = die per Link geteilte „Sprachwerkstatt"** (Vertrag 0.2.49, ID beginnt mit `JLL8`). Die Feldbedeutungen stehen in `docs/altapp-analyse.md`. Vor jeder Arbeit an `/src/data`, `/src/domain` oder der Umstellung dieses Dokument lesen. Die anderen Artefakte (Test-Kopie, früherer Neubau-Versuch, Prototypen) werden nie angefasst.
10. **Anhang B zeigt `app/assess` flach, die alte App schreibt es mit Hülle** (`{d, t, lang, answers, writings, data: {…}}`). Das Schema liest beide Formen, geschrieben wird in der Hüllen-Form.
11. **Voreinstellungen der alten App sind Daten, kein Code:** der Lehrplan (24 Lektionen in 6 Einheiten), 16 Grammatikthemen mit p0 und 40 Startvokabeln. Sie werden als Daten übernommen und wie bisher mit der Datenbank überlagert (Datenbank gewinnt). Sonst sinken Anzahlen und Kursstand.
12. **Die alte App spiegelt jeden Pfad in `localStorage` (`sw2:<pfad>`, `sw2:__dirty` = `{pfad: ms}`).** Beim Umzug auf dieselbe Adresse kann dort Neueres liegen als in der Datenbank, aber auch Älteres. Die Umstellung **ergänzt nur** (`src/domain/migration/rescue.ts`). Sie legt fehlende Dokumente an, nimmt Tageswerte mit dem Maximum, vereinigt Logs und übernimmt Karten nur, wenn sie nachweislich neuer sind. Beim Ausführen gleicht sie frisch gegen die Datenbank ab. Sie überschreibt nie Neueres und zeigt alles im Trockenlauf, auch was nicht übernommen wird.
13. **Serie:** Die alte Regel (`days[k] > 0` oder `xpDays[k] > 0`) gilt, bis die App die Pflicht tatsächlich erfasst. Ab `app/schema.pflichtSince` gilt die neue Regel aus A7. Phase 1 setzt `pflichtSince` mit dem ersten gespeicherten Tagesplan und schreibt `app/profile.pflicht[datum]` sowie weiterhin `days`, `minutes` und `act`. Die Umstellung selbst ändert an der Serienregel nichts, deshalb reißt die Serie nie an einer Lücke zwischen den Phasen. Zwischen 0 und 4 Uhr zählt auch der Kalendertag der alten App. Der Datumsschlüssel wird immer aktuell berechnet, nie nur einmal beim Laden.
14. **Alte Vokabelwerte sind FSRS-ähnlich** (`S` in Tagen, `D` von 1 bis 10, `due` in ms). Die FSRS-Startwerte werden daraus dokumentiert abgeleitet und **zusätzlich** gespeichert. `S`, `D`, `due` und `stage` bleiben stehen (Kap. 9, Regel 2 und 5).
15. **Sperren statt raten:** Ist `app/profile` ungültig oder wurde eine Abfrage vielleicht gekappt, ist die Umstellung gesperrt. Dann gibt es nur die Sicherung und den Hinweis, in claude.ai Bescheid zu geben.
16. **zod 4:** `z.unknown()` allein macht ein Feld zur Pflicht. Tolerante Felder werden als `z.unknown().optional()` geschrieben (`loose` in `schemas.ts`). Felder, deren Typ nicht belegt ist, werden tolerant gelesen.

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

**26.09.2026 – eigene Festlegungen**
- **Tageswechsel um 04:00 Uhr Ortszeit** des Geräts. Eine Einheit nach Mitternacht zählt noch zum Vortag. Der Datumsschlüssel `JJJJ-MM-TT` wird überall mit derselben Funktion berechnet.
- **E2E-Tests laufen gegen den echten Produktions-Build** `dist/index.html`. Der Entwicklungs-Adapter wird dabei **von außen** als nachgebildete `window.claude`-Laufzeit eingespielt (Playwright `addInitScript`). So wird der Produktionspfad mitgetestet, und der Adapter ist nie Teil des Builds.

## A8. Befehle und Projektstruktur
Alles läuft in der Cloud-Umgebung. Chromium liegt unter `/opt/pw-browsers`, **nie `playwright install`** ausführen. `@playwright/test` und `playwright-core` sind auf 1.56.1 festgelegt, passend zum vorinstallierten Browser.

| Befehl | Zweck |
|---|---|
| `npm run dev` | Dev-Server mit Entwicklungs-Adapter; `?fake=nodb,nosample,empty,persist` steuert ihn |
| `npm run build` | Produktions-Build → genau eine `dist/index.html` |
| `npm run typecheck` · `npm run lint` | TypeScript strict (App ohne Node-Typen und gesamt) · ESLint mit Typinformationen |
| `npm test` | Unit-Tests (Vitest, `TZ=Europe/Berlin`) |
| `npm run test:e2e` | baut App und Test-Laufzeit, dann Playwright gegen `dist/index.html` |
| `npm run check:platform` | eine Datei, < 16 MB, keine Ladeziele, kein Entwicklungs-Adapter |
| `npm run verify` | alles zusammen: vor jeder Auslieferung |
| `npm run seed` | erzeugt `seed/sample-data.json` neu (deterministisch, Stichtag 20.09.2026) |

**Struktur:**
- `src/platform`: einziger Zugang zu `claude.use`, Browser-Speicher (`storage.ts`) und Diagnose-Protokoll (`diagnostics.ts`).
- `src/platform/dev`: Entwicklungs-Adapter. E2E-Tests spielen ihn als `tests/.runtime/fake-claude.js` von außen ein.
- `src/data`: Schemas, Pfade, der eine Schreibpfad (`writer.ts`), Voll-Lesen (`snapshot.ts`) und Live-Abos (`live.ts`, je Abfrage genau ein `onSnapshot`).
- `src/domain`: reine Logik, nämlich Datum, Serie, FSRS-Umrechnung, Umstellung und Übersicht.
- `src/content/legacy`: übernommene Inhalte der alten App.
- `src/ui`: Bausteine.
- `src/features`: Bildschirme.
- `src/i18n`: Texte DE und EN.

**Konventionen:**
- ESLint verbietet `claude.use` und `localStorage` außerhalb von `src/platform`, leere `catch`-Blöcke und `any`.
- Jeder Fehler geht über `logError`/`logWarn`.
- Jeder Text steht in `src/i18n`, auf Englisch in amerikanischer Schreibweise.
- Übernommene Inhalte gibt es zweisprachig (`name`/`name_en`, `de`/`en`). Angezeigt wird immer die Variante der Oberflächensprache (Kap. 10, Sprachtreue).
- Vorhandene Subagents unter `.claude/agents/` lädt Claude Code beim Sitzungsstart. Sind sie in einer Sitzung nicht als Agententyp verfügbar, einen allgemeinen Agenten mit der jeweiligen Datei als Anweisung starten.

---

# TEIL B – WÖRTLICH AUS DEM AUFTRAG

## KAPITEL 2: PRODUKTPRINZIPIEN (nicht verhandelbar)

1. **Eine rote Linie.** Beim Öffnen ist sofort klar, was heute dran ist. Ein großer Knopf, keine konkurrierenden Karten.
2. **Keine Widersprüche.** Häkchen, Zähler, Untertitel und Klickziel sagen immer dasselbe. **Erledigt heißt erledigt:** eine erledigte Aufgabe ist Zustand, kein Knopf mehr.
3. **Urteil statt Punktestand.** Das Niveau beurteilt die KI anhand echter Belege in Worten, nicht eine starre Formel (Kapitel 5).
4. **Erklären, warum.** Jede Übung beantwortet vier Fragen an fester Stelle: *Was soll ich tun? Wozu dient das? Was hatte ich, was ist richtig? Warum ist das so?* Die Begründung kommt auch bei richtiger Antwort.
5. **Kombinierte Aufgaben.** Wörter, Grammatik, Hören, Schreiben und Sprechen hängen am selben Thema.
6. **Pflicht und Freiwillig sind sichtbar getrennt.** Pflicht zählt zum Tagesziel, Angebot zählt als Extra, nie als Vorwurf.
7. **Premium-Anmutung.** Wirkt wie ein hochwertiges kommerzielles Produkt (Referenz: Linear, Arc, Things, Speak), nicht wie eine Webseite und nicht wie ein Kinderspiel.
8. **Getestet.** Automatische Tests finden Fehler, bevor Emrah sie findet.

---

## KAPITEL 3: PLATTFORM, TECHNIK-STACK UND ARCHITEKTUR

**„Gaming-Engine" bedeutet die technische Qualität:** die App reagiert wie eine native App, flüssig mit 60 fps, zustandsgetrieben, animiert, ohne Neuladen. Keine starren HTML-Seiten.

### 3.1 Zielplattform: Claude-Artefakt (verbindlich)
Die App läuft als **veröffentlichtes Artefakt in claude.ai**. Dadurch sind Datenbank und KI im Claude-Abo enthalten. Daraus folgen harte Regeln:

- **Eine einzige, selbstständige HTML-Datei**, maximal 16 MB, alles eingebettet (JS, CSS, Schriften, Bilder als data-URI).
- Die Content-Security-Policy erlaubt externe Skripte nur von `cdnjs.cloudflare.com`, `cdn.jsdelivr.net/npm/`, `cdn.tailwindcss.com`, `code.jquery.com` und Stylesheets nur von `fonts.googleapis.com`. **Alles andere wird still blockiert** (keine fremden APIs, keine Bilder von außen, kein fetch zu anderen Seiten). Am sichersten: alles per Build einbetten, gar nichts extern laden.
- **Kein Server, keine API-Schlüssel, kein Backend.** Datenbank und KI kommen ausschließlich über die Laufzeit-Fähigkeiten:
  - `const db = await claude.use("db")` — Echtzeit-JSON-Dokumentenspeicher (`db.doc(pfad)`, `db.collection(pfad)`, `get`/`set`/`update`/`delete`, `where`/`orderBy`/`limit`, `onSnapshot`)
  - `const sample = await claude.use("sample")` — Claude fragen: `await sample(input, {onText, signal, modelTier, tools, cache})` → `{text, truncated}`, oder `sample.json(...)` → geparstes JSON. `modelTier`: `quick` | `default` | `complex`.
  - optional `downloads` (Datenexport als Datei).
- **Die Typdefinitionen im Ordner `contract/` (Version 0.2.49) sind maßgeblich.** Lies `claude.d.ts`, `db.d.ts` und `sample.d.ts` vollständig, bevor du Daten- oder KI-Code schreibst. Nichts davon aus dem Gedächtnis raten.
- `claude.use(...)` kann `null` liefern. Die App rendert sofort und schaltet Funktionen zu, sobald die Fähigkeit bereitsteht. Die erste KI-Nutzung fragt einmal nach Zustimmung.
- `sample` hat kein Gedächtnis: jede Anfrage bringt Anweisung, Daten und Ausgabeformat selbst mit. Fehlercodes behandeln (`rate_limited` → zurückhalten, nie in Schleife wiederholen; `not_granted` → Funktion ausblenden).
- `localStorage`/`IndexedDB` funktionieren, aber nur für Bequemlichkeit (Entwurf im Eingabefeld, zuletzt offener Reiter). **Lernfortschritt immer in `db`.**
- Keine echten Push-Nachrichten und keine Installation als PWA (die tägliche Erinnerung kommt vom bestehenden Claude-Tagesauftrag, Kapitel 6.9).

### 3.2 Stack (lokal auf Emrahs Rechner, alles kostenlos)
- **Vite + React + TypeScript strict**
- **Tailwind CSS** (per Build, nicht per CDN) mit eigenem Design-Token-System (Kapitel 8)
- **Framer Motion** für Layout-Animationen, Gesten, Übergänge; **Zustand** für App-Zustand; **XState** für Übungsabläufe und das Rollenspiel
- **ts-fsrs** für die Wiederholungsplanung (Kapitel 5)
- **zod** für die Prüfung aller KI-Antworten und aller gelesenen Datenbank-Dokumente
- **vite-plugin-singlefile**: der Build erzeugt genau eine `dist/index.html` mit allem eingebettet
- Schriften (z. B. Inter oder Geist) als woff2 eingebettet, mit sauberem Fallback-Stapel

### 3.3 Plattform-Adapter (wichtig für Entwicklung und Tests)
Außerhalb von claude.ai gibt es `claude.use` nicht. Deshalb:
- Eine Schicht `/src/platform` kapselt **jeden** Zugriff auf `db` und `sample`. Kein anderes Modul ruft `claude.use` direkt.
- Für Entwicklung und Tests gibt es einen **Entwicklungs-Adapter**: `db` im Speicher, befüllt aus `seed/sample-data.json`, und `sample` mit festen, realistischen Antworten je Prompt-Vorlage. `seed/sample-data.json` erzeugst du selbst: **erfundene, aber realistische Daten** exakt in der Struktur aus Anhang B (mehrere Wochen Aktivität, ~150 Vokabeln in allen Lernstufen, Grammatikthemen mit Fehlersätzen, abgeschlossene Lektionen l01–l06, eine Einschätzung, Feed- und Daily-Einträge). Echte persönliche Daten kommen nicht ins Repository.
- Der Entwicklungs-Adapter darf **nie** im Produktions-Build landen (per Build-Flag ausgeschlossen, durch einen Test abgesichert).

### 3.4 Ordnerstruktur
```
/src
  /platform          Adapter: claude.use (Produktion) und Entwicklungs-Adapter
  /engine            Animations- und Interaktionskern (Lücke, fliegende Buchstaben, Bausteine, Übergänge)
  /ui                Design-System-Bausteine (Button, Sheet, Popover, Skeleton …)
  /features          today course vocab grammar speak business drills read listen write discover preply progress companion settings
  /domain            reine, testbare Logik: srs, mastery, plan, assessment, chunks
  /ai                KI-Tor über sample: Timeout, Abbruch, Fehlerklassen, Drosselung
  /prompts           versionierte Prompt-Vorlagen, je Vorlage ein zod-Schema
  /data              Datenbank-Zugriff, ein einziger kontrollierter Schreibpfad, Schema-Versionen
/seed                sample-data.json (erfunden, Struktur aus Anhang B, nur für Entwicklung/Tests)
/docs                datenstruktur.json (Anhang B)
/contract            Typdefinitionen der Artefakt-Laufzeit (maßgeblich)
/tests               Unit (Vitest), E2E (Playwright), Barrierefreiheit (axe)
```

**Architekturregeln:** keine leeren `catch`-Blöcke; jeder Fehler wird protokolliert und in einer Diagnose-Ansicht in den Einstellungen lesbar. Kein Prompt-Text in Oberflächen-Dateien. Optimistische Updates mit Rückrollen. Lade-Skelette statt Spinner. `onSnapshot` einmal je Abfrage abonnieren, nie im Render. Ein Dokument nur schreiben, wenn es sich geändert hat.

---

## KAPITEL 14: ABNAHMEKRITERIEN (Definition of Done)
- Alle Module aus Kapitel 6 sind vorhanden und bedienbar.
- Alle bisherigen Daten sind sichtbar und werden weitergeführt, die Serie läuft weiter, der Tagesauftrag funktioniert unverändert.
- Beim Öffnen ist in unter 2 Sekunden klar, was heute zu tun ist.
- Tippen in die Lücke fühlt sich an wie in einer nativen App.
- Alle Tests grün auf Handy und Desktop, in allen Modi und beiden Sprachen.
- Keine laufenden Kosten über das Claude-Abo hinaus.

---

## KAPITEL 15: FEHLER DES VORGÄNGERS, DIE NICHT WIEDERKOMMEN DÜRFEN
- Tagesplan, der sich bei jedem Neuzeichnen neu würfelt (Zähler bleibt ewig bei „2 von 3")
- erledigte Aufgaben, die noch anklickbar sind
- Zähler, der freiwillige Schritte als Pflicht mitzählt
- dasselbe dreimal auf einem Bildschirm
- neue Wörter, die an Tagen mit Wiederholungen nie auftauchen
- jede Lernstufe mit nur einer Abfrageart
- Eingabefeld unter dem Satz statt in der Lücke
- gemischte Sprache in gespeicherten KI-Texten
- Dunkelmodus, der nie richtig gestaltet wurde (CSS-Spezifität prüfen!)
- Chat als schmale Seitenleiste ohne Kontext, Chat springt beim Lesen nach unten
- Wörter in neuen Übungen nicht antippbar
- Karten ohne Ursprungssatz
- Tests, die nur den heutigen Datensatz prüfen
- stille Fehler durch leere `catch`-Blöcke
- Sprachausgabe am Handy abgehackt
- über die laufende App veröffentlichen, um etwas zu zeigen
