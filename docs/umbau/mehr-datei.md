# Mehr-Datei-Build (Lockerung der Regel „eine einzige HTML-Datei“)

Stand 07.10.2026. Emrah hat die Regel „genau eine `dist/index.html`“ (CLAUDE.md Kap. 3.1 / A1) bewusst gelockert. Belegt am iPhone (Safari, claude.ai-Artefakt): ES-Module-Skript, WebGL, Web Worker (Blob) und das Laden einer eigenen Zusatzdatei per `fetch` (3 MB) funktionieren; **externe Anfragen bleiben blockiert** (CSP). Der Einzeldatei-Build bleibt der **Standard und der Rückfall**, bis Emrah anders entscheidet.

## Zwei Bauweisen

| | Einzeldatei (Standard) | Mehr-Datei |
|---|---|---|
| Befehl | `npm run build` oder `npm run build:single` | `npm run build:multi` (= `LX_BUILD=multi vite build`) |
| Ergebnis | genau `dist/index.html` | `dist/index.html` (klein) + flache Zusatzdateien |
| Skript | inline | `index-<hash>.js` (`type="module"`), weitere Chunks bei dynamischem `import()` |
| CSS / Schrift | inline | `style-<hash>.css`, `inter-…-<hash>.woff2` (Dateien > 4 KB) |
| Inhalts-Bündel (`scripts/content`) | Base64 im Skript | `content-<name>-<hash>.bin` (rohes deflate), Laden per `fetch` nur bei Bedarf |
| Prüfung | `npm run check:platform` (erkennt den Modus an `dist/`) | dieselbe |

Alle Pfade sind **flach** (kein Unterordner) und **relativ** (`./…`, `base: './'`). Der Schalter ist nur die Umgebungsvariable `LX_BUILD` (`multi`); jeder andere Wert oder keiner = Einzeldatei. Die App-Logik ist in beiden Modi dieselbe.

## Was der Mehr-Datei-Modus technisch ändert

- `vite.config.ts`: `viteSingleFile` entfällt, flache Dateinamen, `assetsInlineLimit` 4096, `base: './'`. Kleine, kommentierte Weiche `MULTI`.
- `scripts/content/vite-plugin.mjs`: mit `contentStore({ multi: true })` liefert `virtual:content/loaders` keine Base64-Importe mehr, sondern `remote` (Dateiname je Bündel); `generateBundle` legt die `.bin`-Dateien ab (Dateiname enthält einen Hash des Inhalts).
- `src/content/store/loadPacked.ts`: ist `remote` gesetzt, wird `new URL(datei, import.meta.url)` per `fetch` geholt und der Strom direkt mit `DecompressionStream('deflate-raw')` gelesen. Fehlerbehandlung: ein einziger zweiter Versuch nach 400 ms, danach `null` plus Protokolleintrag (`content:packed`); der Zwischenspeicher-Eintrag wird verworfen, der **nächste Aufruf lädt frisch** (so wirkt auch das Sicherheitsnetz `ensureC1xLoaded`). Ein Start wird nie durch einen Ladefehler blockiert.
- `eslint.config.js` verbietet `fetch` weiter überall; nur der Block um `fetchBundleText` hat eine begründete Ausnahme.
- `scripts/check-platform.mjs`: neuer Zweig `checkMulti` (siehe unten).

## Plattform-Prüfung (Mehr-Datei) – Freigabe nur wenn

- `index.html` vorhanden; jede Datei < 16 MB; Gesamtgröße ≤ 64 MB (Hinweis ab 12 MiB);
- nur Dateitypen `html js css json woff2 png jpg webp svg mp4 webm bin`;
- keine Unterordner;
- `index.html` verweist nur flach-relativ und nur auf vorhandene Dateien (kein Host, kein führender `/`);
- in **allen** Text-Dateien: keine Ladeziele (XHR, WebSocket, EventSource, sendBeacon, importScripts, Worker, WebAssembly, `@import`, `url(http…)`), kein Entwicklungs-Adapter, keine Kennungen entfernter Vorlagen;
- `fetch(` ist nur in der Datei erlaubt, die die Zeichenkette `lx:content-fetch` trägt (das ist die Inhalts-Ladestelle, relativ neben dem Skript).

Hinweis: `new Worker(` und `WebAssembly` bleiben im Prüfer **gesperrt**. Wer einen Blob-Worker (belegt) oder Effekt-Code braucht, muss das dort bewusst und eng freigeben (kleine Änderung in `loaders` in `scripts/check-platform.mjs`, mit Test in `tests/unit/multiFile.test.ts`).

## Neue Skripte bzw. Chunks (für den Design-Lead)

Ein dynamischer `import('./effekt')` erzeugt im Mehr-Datei-Modus automatisch eine flache Datei `effekt-<hash>.js`, die erst bei Bedarf geladen wird. Im Einzeldatei-Modus wird sie wie bisher in die HTML eingebettet (gleicher Code, kein Sondercode). Große statische Dateien (Bilder, Medien) gehören in den Mehr-Datei-Modus nur dann als Datei, wenn sie per `import url from './x.webp?url'` eingebunden werden (Vite macht daraus `x-<hash>.webp`); über 4 KB wird nie eingebettet.

## Veröffentlichen (Schritt für Schritt für die Koordination)

1. Stand holen, `npm ci` falls nötig, `npm run build:multi`.
2. `npm run check:platform` muss „PLATTFORM-PRÜFUNG (Mehr-Datei): FREIGABE“ melden.
3. `node scripts/publish-manifest.mjs --out /tmp/manifest.json` (optional `--previous <altes-manifest.json>`, dann steht in `removeMap` jede alte Datei mit `null`).
4. Artifact-Tool aufrufen: `file_path` = `page` aus dem Manifest (`dist/index.html`), `files` = die Map `files` aus dem Manifest (veröffentlichter Pfad → Quelldatei). Fähigkeiten wie bisher (`db`, `sample`, `downloads`). Zuerst auf den **Test-Link** (`AXHkh6…`), Live (`JLL8…`) nur nach Emrahs „Ja live nehmen“.
5. Erste Veröffentlichung dieser Bauweise: Version vorher notieren (Rückweg).
6. Am Handy prüfen: App startet, Heute zeigt den Plan, eine Übung aus Anwenden (z. B. Satz-Umformung) lädt ihre Aufgaben. Diagnose (Einstellungen) darf keinen Eintrag `content:packed` enthalten.

**Hinweis Altlasten:** Die Hash-Namen ändern sich mit jedem Build. Dateien, die die neue `index.html` nicht mehr referenziert, **bleiben im Artefakt stehen** (Artifact-Tool: „files left out are kept“). Sie sind harmlos, zählen aber zur Grenze von 511 Dateien / 256 MB je Version. Aufräumen: `--previous` mit dem Manifest der vorigen Veröffentlichung, dann `removeMap` in die `files`-Angabe des nächsten Aufrufs mischen (`null` löscht).

## Rückweg

- **Auf Einzeldatei zurück:** `npm run build:single`, nur `dist/index.html` mit dem Artifact-Tool veröffentlichen (ohne `files`). Die Zusatzdateien bleiben liegen, werden aber nicht mehr geladen. Oder die vorige Artefakt-Version wiederherstellen (Versionsverlauf).
- Reihenfolge ist egal: beide Bauweisen verwenden dieselbe Datenbank und dieselben Schlüssel.

## Tests

- E2E laufen in beiden Modi. Einzeldatei (Standard): `npm run test:e2e`. Mehr-Datei: `LX_BUILD=multi npm run test:e2e` (baut mit derselben Variable). Kein eigener Server: `tests/e2e/dist.ts` liefert die Dateien aus `dist/` über Playwrights `route.fulfill` unter `https://lingo.artifact.test/` aus; alles andere bleibt „extern“ und wird abgebrochen (die Prüfung „keine fremden Anfragen“ gilt weiter).
- Unit: `tests/unit/multiFile.test.ts` (Prüfer + Manifest).

## Messwerte (Cloud-Umgebung, Chromium, Playwright `perf.spec`, Großdatensatz, je 3 Läufe, einzeln `--workers=1`)

Statuszeile „Heute“ (`lx:status`), nachgebildete Auslieferung ohne echtes Netz:

| | Einzeldatei | Mehr-Datei |
|---|---|---|
| `dist/index.html` | 4,60 MB | 0,5 KB |
| Gesamtgröße `dist/` | 4,60 MB | 4,55 MB (Skript 4,30 MB, CSS 80 KB, Schrift 73 KB, Bündel zusammen ≈ 95 KB) |
| Plan vorhanden, CPU 1× | 1,8 / 1,8 / 2,7 s | 1,1 / 1,0 / 1,3 s |
| Plan vorhanden, CPU 4× | 4,5 / 3,8 / 4,1 s | 3,8 / 3,4 / 3,2 s |
| Erster Start, CPU 4× | 5,7 / 5,0 / 5,0 s | 4,5 / 3,9 / 4,4 s |

Die Zahlen schwanken stark (geteilte Cloud-Maschine, auch im Lauf mit vier parallelen Arbeitern kippen die 4×-Grenzwerte von `perf.spec`). Die Richtung (Mehr-Datei etwa 15–30 % schneller bis zur Statuszeile) ist plausibel, weil Browser eine getrennte Skriptdatei streamend kompilieren; das echte Netz am iPhone ist **nicht gemessen** (Emrah misst am Gerät). Platz schafft der Modus noch kaum: Die großen Inhalte (Grammatik 2,4 MB, Atlas 1,4 MB, `c1` 0,8 MB, `legacy` 0,6 MB) werden bisher **statisch** importiert und stehen deshalb im Hauptskript. Sie in den Inhaltsspeicher bzw. in dynamische Chunks zu verlagern ändert den Zugriff von synchron zu asynchron und ist eine eigene, funktionsnahe Aufgabe (siehe Offen).

## Offen

- Große statische Inhalte (Grammatik, Atlas, c1, legacy) als nachladbare Bündel/Chunks: braucht asynchrone Zugriffe in den Verbrauchern (bewusst nicht angefasst, „Funktion unverändert“).
- Kein „Erneut laden“-Knopf in der Oberfläche bei Bündel-Ladefehler (würde Text und Design berühren): bisher ein automatischer zweiter Versuch, Protokolleintrag und frischer Versuch beim nächsten Bedarf.
- `Worker`/`WebAssembly` im Prüfer weiter gesperrt (s. o.).
- Safari-Verhalten (Module + Zusatzdateien im Artefakt) ist von Emrah belegt, mit dieser konkreten Datei-Anordnung aber noch nicht am Gerät getestet.
