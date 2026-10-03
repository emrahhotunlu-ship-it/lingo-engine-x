# Leistung, Fortsetzen, Fehlergrenzen – Messung vor dem Neubau

Stand 27.09.2026, gemessen am Build von `8bdb031` (Code-Stand der Live-Version 54). Nur gemessen und gelesen, `src/` unverändert.
Die Messskripte liegen im Scratchpad der Sitzung unter `perf/`: `measure.spec.ts`, `measure-profile.spec.ts`, `common.ts`, `attribute.mjs` und `profile.mjs`.

## 1. Messaufbau

- **Build:** Produktions-Build `dist/index.html` mit der Test-Laufzeit `tests/.runtime/fake-claude.js`, von außen eingespielt wie in `tests/e2e/fixtures.ts`.
- **Gerät:** Chromium 1194 mit 390×844, DPR 3, Touch und `isMobile`.
- **Drossel:** CPU 4× per CDP `Emulation.setCPUThrottlingRate`, sofern nicht anders angegeben.
- **Laufzeit-Verzögerung:** `use()` 30 ms, jede Datenbank-Antwort 80 ms (`latencyMs`). Der echte Viewer ist eher langsamer.
- **Daten:** `seed/sample-data.json` (≈150 Vokabeln), ohne Testuhr. Heute ist also der 27.09., der „erste Start des Tages“ mit vielen fälligen Karten. Zusätzlich lief der Großdatensatz mit 1.500 Vokabeln, 400 Radar-Ereignissen und 2 Jahren Profil.
- **Instrumentierung vor dem ersten Skript:**
  - Long Tasks und Long Animation Frames,
  - Event Timing (Eingaben ≥ 16 ms),
  - Zähler für `onSnapshot`, `get` und Schreibvorgänge (Hülle um `claude.use("db")`),
  - React-Commits (DevTools-Hook).
- **CPU-Profil:** mit einem Analyse-Build (gleicher Code, mit Sourcemap). Die Stellen wurden über die Sourcemap auf `Datei:Zeile` zurückgeführt.
- **Grenze:** Das ist Chromium, kein WebKit. 4× Drossel entspricht grob einem Mittelklasse-Handy. Ein aktuelles iPhone liegt für JS eher zwischen 1× und 2×. Safari-JIT, Speicherdruck und Tab-Verwerfen lassen sich hier nicht nachbilden.

## 2. Messwerte

### 2.1 Start bis „Heute lesbar“ (Median aus 3 Läufen)

„Heute lesbar“ heißt: Statuszeile sichtbar und Bildschirm voll eingeblendet.

| Messpunkt | CPU 1× | CPU 4× Seed | CPU 4× Großdatensatz |
|---|---:|---:|---:|
| First Contentful Paint (Ladeskelett) | 444 ms | 1.652 ms | 2.360 ms |
| `lx:boot` (Bundle ausgewertet) | 407 ms | 1.485 ms | 2.231 ms |
| `lx:live` (9 Abos geliefert + zod-geprüft) | 593 ms | 1.948 ms | 2.791 ms |
| **`lx:status` = Heute lesbar** | **1.346 ms** | **3.111 ms** | **4.256 ms** |
| Long Tasks bis Heute (Anzahl / Summe / größter) | 2 / 187 / 127 ms | 4 / 1.014 / **536 ms** | 7 / 1.546 / 601 ms |
| React-Commits bis Heute | – | 12 | 12 |
| `onSnapshot`-Abos beim Start | 10 | 10 | 10 |
| Schreibvorgänge beim Start | – | 4 | 4 |

- **Long Tasks bei 4× (Seed):**
  - 536 ms bei ≈1,0 s: Parsen, Kompilieren und Auswerten des Bundles,
  - 62 ms beim ersten Render,
  - 148 ms bei `lx:live`: zod-Prüfung aller Dokumente,
  - 268 ms: Tagesplan-Aufbau.
- **Abos (alle innerhalb von 3 ms, genau einmal):**
  - Dokumente: `app/profile`, `app/course`, `app/assess`, `app/schema`, `app/repair`,
  - Sammlungen: `vocab`, `grammar`, `archive`, `chunk`,
  - Tagesprotokoll: `log/<heute>`.
  - Abmeldungen: 0. Das Abo-Muster ist sauber.
- **Schreibvorgänge vor bzw. um `lx:status`:**
  - `update app/pool` (Tagesauftrag-Abgleich),
  - 2× `update app/profile` (Plan, Selbstheilung),
  - `update app/schema`.
- **CPU-Profil 4× (Seed), Fenster `lx:live` → `lx:status` (1,25 s):**
  - Leerlauf 423 ms (Warten auf Datenbank-Runden und Zeitgeber), Rest CPU.
  - Inklusive Zeiten:
    - `ensureDay` 292 ms,
    - `validateDoc`/`validateCached` 145 ms,
    - `dueErrors` → `isDictWord` → `dict.load` 103–121 ms (Parsen des 290-KB-Wörterbuchs),
    - `buildTrainCards` 94 ms, davon `context.locate` 85 ms,
    - `TodayScreen`-Render 74 ms.

### 2.2 Vokabeltrainer (CPU 4×, 10 Karten: mc_en, spot, intro, listen_mc …)

| Messpunkt | Wert |
|---|---:|
| Tipp „Start“ → Trainer steht | 429 ms. Das erste `click` dauerte laut Event Timing 200 ms, davon 148 ms Verarbeitung (`startSession`, `buildExercise`). |
| Tipp „Prüfen“/Antwort → Ergebnis sichtbar | Median 34 ms (25–57 ms) |
| **Tipp „Weiter“ → neue Karte im DOM** | **Median 265 ms** (254–329 ms) |
| **Tipp „Weiter“ → neue Karte ruhig und bedienbar** | **Median 515 ms** (486–535 ms, einmal 1.684 ms) |
| Long Tasks im Trainer | 2 (62 ms, 70 ms) |

Die Wartezeit ist fast reine Animationszeit, keine Rechenzeit. Der Trainer läuft mit `AnimatePresence mode="wait"`: erst 220 ms Ausblenden, dann 220 ms Einblenden (`DURATION.base = 0.22`). Die CPU-Arbeit je Karte liegt bei ≈50 ms. Das CPU-Profil des Trainers zeigt 70 % Leerlauf.

### 2.3 Tippen in die Lücke

Gemessen mit Übung `type`, 20 Anschlägen im Abstand von 80 ms, bei CPU 4×.

| Messpunkt | Wert |
|---|---:|
| Bildabstand p50 / p95 / max | 16 / 16 / 16 ms, 0 Bilder > 33 ms |
| Long Tasks | 0 |
| Event Timing je Taste (Eingabe bis Bild) p50 / p95 / max | 24 / 40 / 40 ms |
| React-Commits je Anschlag | **11** |

Das Tippen ist flüssig, aber mit wenig Reserve: 11 Commits je Taste kommen von der kinetischen Lücke mit fliegenden Buchstaben.

### 2.4 Speicher (CPU 1×)

- **Nach dem Start:**
  - JS-Heap 15,5–18,8 MB (Seed), 23,9 MB (Großdatensatz),
  - 130 DOM-Knoten,
  - 236 Listener.
- **Nach 10 Trainer-Karten:** Heap 20,2 MB, 456 Knoten, 302 Listener.
- **Leck-Prüfung:** 4 Runden über alle 5 Reiter, jeweils mit GC danach. Heap 17,5 → 17,5 → 17,7 → 17,8 MB, Knoten 542 → 532, Listener 247 → 244. **Kein Leck.**
- Der Speicher ist klein. Dass Safari die App selbst wegen Speichers verwirft, ist unwahrscheinlich. Wahrscheinlicher verwirft Safari den ganzen claude.ai-Tab, oder der Viewer lädt nach einer neuen Veröffentlichung neu.

### 2.5 Bundle

- **Größen:**
  - `dist/index.html`: **3,04 MB**,
  - JS: **2,65 MB** minifiziert, als ein einziges Skript, das beim Start vollständig ausgewertet wird,
  - CSS: 339 KB, davon **275 KB** Inter-Schrift als data-URI (2× woff2).
- **Anteile vor dem Minifizieren**, gerechnet als `renderedLength` je Modul, zusammen 4,15 MB:

| Anteil | KB | % |
|---|---:|---:|
| `src/features` (alle ~30 Bildschirme, eager) | 1.081 | 26,0 |
| **`src/content` (Daten)** | **1.036** | **25,0** |
| react-dom | 524 | 12,6 |
| `src/domain` | 350 | 8,4 |
| motion-dom + framer-motion + motion-utils | 304 | 7,3 |
| `src/prompts` | 173 | 4,2 |
| zod | 170 | 4,1 |
| `src/i18n` | 158 | 3,8 |
| xstate + @xstate/react | 86 | 2,1 |
| `src/engine` | 50 | 1,2 |
| ts-fsrs | 38 | 0,9 |

- **Größte Daten:**
  - `content/pron/us-ipa.json?raw` 348 KB,
  - `content/legacy/dict.json?raw` 318 KB,
  - `passages.json` 80 KB,
  - `c1/toolkit.json` 52 KB,
  - `rules.json` 46 KB,
  - `grammar.json` 35 KB,
  - `playbooks.json` 32 KB.
  - Alle JSON-Dateien ohne `?raw` werden als JS-Objektliteral bei jedem Start geparst und ausgewertet.
- **Minifiziert nach Sourcemap:**
  - react-dom 203 KB,
  - motion 135 KB,
  - prompts 129 KB,
  - i18n 144 KB,
  - zod 91 KB,
  - xstate 39 KB,
  - ts-fsrs 21 KB.
  - Die `?raw`-Zeichenketten haben keine Zuordnung und landen fälschlich bei Nachbardateien wie `cloze.ts` oder `Skeleton.tsx`.

## 3. Ursachen (Datei:Zeile)

### 3.1 „Stürzt ab, ich muss von vorne anfangen“

1. **Keine einzige Fehlergrenze:** `grep` findet weder `componentDidCatch` noch `getDerivedStateFromError`.
   - Ein Wurf in irgendeinem Render hängt den ganzen React-Baum aus (React 19). Emrah sieht dann eine leere Seite und muss neu laden.
   - Stellen:
     - `src/main.tsx:21-26` (`createRoot(...).render(<StrictMode><App/>)` ohne Grenze),
     - `src/app/App.tsx:271-300` (Bildschirmwechsel ohne Grenze je Bildschirm).
2. **Globale Fehler werden nur protokolliert:** `src/platform/diagnostics.ts:97-102` (`error`, `unhandledrejection` → `logError`).
   - Das Protokoll liegt in `lx:diag`, also im Browser. Nach dem Neuladen bleibt nur, was vorher geschrieben wurde.
   - Das passt zu Emrahs Protokoll mit nur einem `patterns:run upstream_error`: Ein Render-Absturz vor dem Schreiben oder ein Neuladen durch Safari hinterlässt keine Spur.
3. **Nach dem Neuladen landet man immer auf „Heute“:**
   - `src/app/nav.ts:104-118`: Route und Herkunft liegen „nur im Speicher“. Gemerkt wird nur der Reiter.
   - Die Sitzungen liegen nur im Speicher:
     - Vokabeltrainer `src/features/vocab/session.ts:71` (Warteschlange, Position, Rundenzähler),
     - Grammatik `src/features/grammar/session.ts:39`,
     - Satzbau, Lückenjagd, Sprint und „Sag es“ genauso.
   - Die Antworten selbst sind sicher, denn jede Antwort geht sofort nach `db` (`commitAnswer` → `reviewWrite`). Verloren gehen nur Position und Runde.
   - **Teilweise vorhanden:**
     - Lektionsschritt `src/features/course/lessonRun.ts:54-63` (`lx:lesson:<id>:step`),
     - Rollenspiel-Kopie `src/features/speak/resume.ts:11-45` (`lx:roleplay:<szene>`).
     - Beides greift aber nur, wenn Emrah selbst wieder dorthin navigiert. Er wird nicht dorthin zurückgebracht.
4. **Häufige Neulade-Auslöser am iPhone:** jede neue Veröffentlichung (der Viewer lädt neu), Safari verwirft den Hintergrund-Tab, und Fehler im Viewer. Beheben lässt sich das nicht, nur auffangen (Abschnitt 5).

### 3.2 „Super laggy“

1. **Heute wartet auf Schreib-Rundreisen**, am ersten Start des Tages: `src/features/today/store.ts:160-252` (`ensureDay`).
   - Die Kette läuft seriell:
     1. `await intake()` (Schreiben `app/pool`, `store.ts:177`),
     2. `await loadLearnInputs()`,
     3. an „Sag es“-Tagen `await sampleUsableWithin(SAY_WAIT_MS = 1500)` (`store.ts:59`, `:194`),
     4. Plan-Aufbau,
     5. `await writer.transform('app/profile')` (`store.ts:227-244`).
   - Erst danach setzt der Store `ready`. Die Statuszeile wartet zusätzlich auf `log/<heute>` (`TodayScreen.tsx:127-136`, `dayLoaded`).
   - In der echten Laufzeit ist jede Datenbank-Runde deutlich teurer als die 80 ms hier.
2. **Das Bundle wird vollständig ausgewertet:** 2,65 MB JS in einem Stück, ≈540 ms Long Task bei 4×.
   - Alle ~30 Bildschirme, alle Prompts und alle JSON-Inhalte werden beim Start ausgewertet, obwohl Heute nur einen Bruchteil braucht.
   - `vite.config.ts` bettet über `viteSingleFile` auch dynamische Importe ein.
3. **Rechenarbeit auf dem Startpfad**, bei 4×:
   - zod-Prüfung aller Sammlungen: `src/data/validate.ts:10/33`, `src/data/live.ts:85`, 145 ms.
   - Wörterbuch parsen: `src/domain/lexicon/dict.ts:39` (`load`), 103 ms.
     - Ausgelöst von `src/domain/grammar/errors.ts:176` (`dueErrors`) → `dict.ts:91` (`isDictWord`), nur um fällige Grammatikfehler zu zählen.
   - Kontextsuche je Karte: `src/domain/srs/cards.ts:74` → `src/domain/srs/context.ts:64` (`locate`), 85 ms.
   - Lautschrift beim ersten Wort: `src/domain/lexicon/pron.ts:12` (348-KB-Tabelle), ≈50 ms beim ersten `IntroCard`.
4. **Karte zu Karte ≈ 0,5 s**, gewollt, aber zu lang: `src/features/vocab/TrainerScreen.tsx:84-91` (`AnimatePresence mode="wait"`, Aus- und Einblenden je 220 ms, `src/ui/motion.ts:4`).
   - Dasselbe Muster haben:
     - `grammar/SessionScreen.tsx:52`,
     - `repair/RepairStep.tsx:81`,
     - `patterns/PatternDrill.tsx:49`,
     - `business/PlaybookScreen.tsx:116`.
5. **Store ohne Selektor:** `src/features/today/state.ts:96` (`usePending()`).
   - Jede Änderung der ausstehenden Schreibvorgänge zeichnet Heute und alle Nutzer von `useToday()` neu:
     - `App.tsx:172`,
     - `learn/ui.tsx:77`, `learn/ui.tsx:359`,
     - `say/SayScreen.tsx:78`.
6. **Layout-Animationen in Listen:**
   - `src/features/vocab/list/VocabScreen.tsx:159,197`: ein `layoutId` je Wortzeile, bis zu 120 je Seite (`PAGE`, `:27`),
   - `src/features/speak/SceneCard.tsx:19` (`layout` je Szenenkarte),
   - `src/engine/Tiles.tsx:96` (`layout` je Baustein),
   - `src/features/business/TilePicker.tsx:49-67`.
   - Framer misst bei jeder Layoutänderung alle beteiligten Elemente (`getBoundingClientRect` steht im Trainer-Profil unter den Top-Posten).
7. **Bildschirmwechsel:** `src/app/App.tsx:271-280`. Jeder Wechsel blendet ein und ruft in `onAnimationStart` `window.scrollTo` auf, das im Startprofil 21 ms braucht.
8. **Kinetische Lücke:** 11 React-Commits je Anschlag. Das ist heute noch flüssig, aber auf älteren iPhones der erste Kandidat für Ruckeln.

## 4. Maßnahmen für den Neubau (priorisiert)

**Leistungsbudget (verbindlich, mit E2E-Test bei CPU 4× und Messung am iPhone):**
- Heute lesbar < 1 s am iPhone, das sind < 1,5 s bei 4× hier.
- Nächste Karte < 50 ms bis zum Bild.
- Animationen ≤ 200 ms.
- Keine Layout-Animationen in Listen.
- Kein Long Task > 100 ms nach `lx:status`.

| # | Maßnahme | Wirkung (gemessen/geschätzt) |
|---|---|---|
| 1 | **Fehlergrenzen je Bildschirm und je Übungsschritt** plus eine Wurzelgrenze (Abschnitt 6). | Aus der leeren Seite wird ein Hinweis auf der Karte. Die Übung läuft weiter. |
| 2 | **Fortsetzen nach Neuladen** (Abschnitt 5): Route und Sitzungsposition lokal merken und beim Start dorthin zurückkehren. | „Von vorne anfangen“ entfällt. |
| 3 | **Heute sofort aus lokalem Plan und Live-Daten zeichnen, Schreiben danach.** Der Plan von heute wird lokal zwischengespeichert (`lx:plan:<tag>`) und steht nach dem ersten Abo-Ereignis. `intake`, `transform('app/profile')`, `sampleUsableWithin` und `log/<heute>` laufen **nach** dem ersten Bild und dürfen die Statuszeile nie blockieren. „Sag es“ wird ohne Warten eingeplant und bei `not_granted` später getauscht. | Aus dem Zeitverlauf abgeleitet, nicht gegengemessen: −0,4 bis −1,2 s am ersten Start des Tages (seriell: `intake`, dann Plan-`transform`, dazu die Wartezeit von „Sag es“). |
| 4 | **Karte zu Karte ohne `mode="wait"`:** Die nächste Übung wird vorberechnet (`buildExercise` für n+1 im Leerlauf nach dem Prüfen). Beim „Weiter“ wird sofort getauscht und nur eingeblendet (≤ 150 ms, Opacity/Transform). Das Ausblenden läuft parallel oder entfällt. | 515 ms → < 50 ms bis zum Bild |
| 5 | **Startpfad entschlacken:** Ein schlanker Kern (Heute, Trainer, Daten) wird sofort ausgewertet. Alle übrigen Bildschirme, Prompts und Inhalte bleiben als Zeichenketten und werden erst beim Öffnen ausgewertet. JSON kommt immer als `?raw` + `JSON.parse` bei Bedarf statt als JS-Objektliteral. Das Wörterbuch (`dict.ts`) kommt aus dem Startpfad: `dueErrors` braucht keine Wortprüfung für einen Zähler. Die Schrift wird auf einen woff2-Schnitt (latin) reduziert. | −300 bis −500 ms Long Task beim Start (4×). ⚠ Nachladen per `import()` aus Blob-URL erst gegen die CSP des Viewers prüfen, sonst lazy auswerten innerhalb des einen Skripts (Fabrikfunktionen je Bildschirm). |
| 6 | **zod-Prüfung nicht im Startpfad blockierend.** Zuerst werden die Dokumente geprüft, die Heute braucht (`app/profile`, `app/schema`, `log/<heute>`, fällige Karten). Der Rest der Sammlungen folgt in Stücken ≤ 16 ms im Leerlauf (`scheduler.yield`/`setTimeout(0)`). Der vorhandene Validierungs-Cache (H6) bleibt. | −100 bis −150 ms (4×) |
| 7 | **Store-Regel:** jeder `use…()`-Aufruf nur mit Selektor und `useShallow`, per ESLint-Regel. Abgeleitete Heute-Daten werden einmal im Store berechnet, nicht in fünf Komponenten. | weniger Neuzeichnen bei jedem Schreibvorgang |
| 8 | **Keine Layout-Animationen in Listen** (Wortschatz, Szenen, Bausteine). Nur Opacity/Transform, nur beim Einhängen. Gemeinsame Elemente (`layoutId`) nur für das eine angetippte Element. Lange Listen werden fensterweise gerendert (ab ~60 Zeilen). | kein Messen aller Zeilen bei jeder Änderung |
| 9 | **Kinetische Lücke:** Die Buchstabenflüge laufen per Motion-Value/WAAPI ohne React-State je Bild. Ein Commit je Anschlag. | Reserve für ältere Geräte |
| 10 | **Messpunkte bleiben und werden mit gemeldet:** `lx:boot`, `lx:live`, `lx:status` und neu `lx:card` (Weiter → Bild) stehen in der Diagnose. Emrah sieht so am iPhone echte Werte, und ein Kommentar kann sie mitschicken. | Messung am echten Gerät |

## 5. Konzept „Fortsetzen nach Neuladen“

**Grundsatz (Kap. 3.1):** Lernfortschritt liegt immer in `db`. Das gilt schon heute: Jede Antwort wird sofort geschrieben. Lokal liegt nur die **Sitzungsposition**, also Bequemlichkeit. Sie darf verloren gehen, ohne dass etwas fehlt.

**Was lokal gemerkt wird** (`localStorage`, Präfix `lx:`, jeder Zugriff über `platform/storage` in try/catch):

| Schlüssel | Inhalt | Geschrieben |
|---|---|---|
| `lx:resume` | `{v:1, day, at, route, kind, id?, pos}`: die eine offene Tätigkeit | bei jedem Übungsschritt (nach dem db-Schreiben) und bei `pagehide`/`visibilitychange=hidden` |
| `lx:session:trainer` | Warteschlange als **Karten-IDs** plus Übungsart je Eintrag, Index, Rundenzähler (Pflicht/Extra, Nochmal-Stapel), Ergebnisse der Runde (für die Zusammenfassung) | nach jedem „Weiter“ |
| `lx:session:grammar` / `:drill` / `:say` / `:patterns` | IDs der Aufgaben, Index, bisherige Ergebnisse der Runde | nach jedem Schritt |
| `lx:lesson:<id>:step` | Lektionsschritt (gibt es schon) | unverändert |
| `lx:roleplay:<szene>` | Gesprächskopie (gibt es schon, ≤ 40 KB) | unverändert |
| `lx:draft:*` | Eingabeentwürfe (gibt es schon) | unverändert |

**Was nicht lokal liegt:**
- Karteninhalte, FSRS-Werte, Noten und Serie.
- Beim Fortsetzen wird alles aus den Live-Daten neu aufgebaut. Die lokale Kopie enthält nur IDs und Positionen.

**Ablauf beim Start:**
1. Heute wird wie immer sofort gezeichnet. Die Route wird nie blind wiederhergestellt, ein kaputter Zustand darf den Start nie blockieren.
2. Liegt `lx:resume` vor, gehört es zum aktuellen Lerntag (04:00-Regel, gleiche `dayKey`-Funktion) und ist jünger als 6 Stunden, zeigt Heute oben **eine** Zeile: „Weitermachen: Wiederholung, Karte 7 von 20“. Ein Tipp stellt die Sitzung her.
3. **Automatisch zurück** geht es nur, wenn das Neuladen weniger als 2 Minuten nach dem letzten Schritt geschah (typisch für Safari-Verwerfen oder eine neue Version). Dann öffnet die App direkt die Sitzung an derselben Stelle.
4. **Beim Herstellen:**
   - IDs, die es nicht mehr gibt oder die inzwischen beantwortet sind (`last` ≥ `at`), werden übersprungen.
   - Ein offener Prüf-Zustand wird nicht nachgebaut. Die Karte erscheint unbeantwortet, denn ihr Ergebnis liegt schon in `db`, wenn geprüft war. Sonst zählt sie als neu.
5. **Löschen:**
   - beim Rundenende (Zusammenfassung),
   - beim ausdrücklichen „Runde beenden“,
   - bei Tageswechsel,
   - bei unbekannter Version (`v`).
6. Zwei Tabs: Es gilt die jüngste Position (`at`). Das Schreiben in `db` bleibt wie bisher über `writer.transform`.

**Test:** E2E „mitten in der Runde `page.reload()`“ für Trainer, Grammatik, Lektion und Rollenspiel. Erwartet werden gleiche Position, kein doppelter Schreibvorgang und die Serie unverändert.

## 6. Konzept „Fehlergrenzen“

**Drei Ebenen**, eine kleine eigene Klasse `ErrorBoundary` in `src/ui` (React 19 hat keinen Hook dafür):

1. **Wurzel** (um `<App/>` in `main.tsx`):
   - ruhiger Vollbild-Hinweis „Etwas ist schiefgelaufen“,
   - Knöpfe „Neu laden“ und „Diagnose zeigen“.
   - Die Sitzungsposition bleibt erhalten, siehe Abschnitt 5. Nach dem Neuladen geht es also an derselben Stelle weiter.
2. **Bildschirm** (um den Inhalt von `motion.div[data-screen]` in `App.tsx`, `key={screen}`):
   - Reiterleiste und Kopf bleiben stehen.
   - Der Bildschirm zeigt „Dieser Bereich hat einen Fehler“ mit „Erneut versuchen“ (setzt die Grenze zurück) und „Zu Heute“.
3. **Übungsschritt** (um jede Karte bzw. Aufgabe im Trainer, in Grammatik, Lektion, Drills und „Sag es“, `key` = Schritt):
   - Eine kaputte Karte zeigt „Diese Karte konnte nicht angezeigt werden“ mit „Überspringen“.
   - Die Sitzung geht mit der nächsten Karte weiter. Die kaputte Karte wird nicht bewertet und mit ID protokolliert.
   - Das ist die wichtigste Ebene gegen „mitten in der Übung abgestürzt“.

**Für alle Ebenen:**
- `componentDidCatch` → `logError('render:<ebene>', err, <route/karten-id>)` mit Komponenten-Stapel.
- Das Diagnoseprotokoll wird **sofort** geschrieben (`lx:diag`), nicht erst gebündelt. So überlebt der Eintrag ein anschließendes Neuladen.

**Außerhalb des Renderns:**
- `unhandledrejection` und `error` bleiben in `diagnostics.ts` und bekommen zusätzlich die aktuelle Route und Sitzungsposition ins Protokoll.
- Jede asynchrone Aktion aus einem Klick (Prüfen, Weiter, KI) läuft über einen gemeinsamen Wrapper `runAction(name, fn)`. Der fängt, protokolliert und zeigt einen Toast, statt still zu scheitern.

**Test:**
- Unit-Test je Ebene: eine Testkomponente wirft, die Grenze zeigt den Hinweis, und „Erneut versuchen“ erholt sich.
- E2E: eine Karte mit absichtlich kaputtem Dokument (`patch`) wird im Trainer übersprungen, die Runde läuft zu Ende.
