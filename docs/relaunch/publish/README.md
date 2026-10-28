# Veröffentlichungs-Manifeste je Link

Stufe 1, Paket P0 S1-TOR Nr. 8 (`docs/relaunch/stufe1-plan.md` §9, „Veröffentlichungsweg“).

Hier liegt für jeden Link das Manifest der **zuletzt veröffentlichten** Fassung:

| Datei | Link | Zweck |
|---|---|---|
| `AXHkh6.json` | Test-Link `AXHkh6…` | Test mit Emrahs Datenkopie |
| `JLL8.json` | Live `JLL8…` | laufende App, nur nach Emrahs „Ja live nehmen“ |

**Stand 28.10.2026: Es gibt noch keine der beiden Dateien.** Ein Manifest der bisherigen Fassungen wurde nie geschrieben,
und eines im Nachhinein zu erfinden wäre falsch. Das erste echte Manifest entsteht bei der nächsten Veröffentlichung
(Schritt „Erstes Mal“).

**Achtung (platform-guard S1, 28.10.2026):** Ob auf einem Link noch Zusatzdateien liegen, ist nicht belegt. Auf den Test-Link
`AXHkh6…` wurde am 07.10.2026 schon einmal ein Mehr-Datei-Bau veröffentlicht (Test 6, Version `1791393276-ae06`, CLAUDE.md A4).
Deshalb vor der **ersten** Veröffentlichung auf einen Link, die nach diesem Weg läuft, immer zuerst die tatsächlich
veröffentlichten Dateien auflisten (Artifact `list` mit `scope: "files"` und der Link-Adresse). Jede dort gefundene Datei,
die der neue Bau nicht mehr hat, kommt mit `null` in die `removeMap`. Erst danach gilt das Manifest hier als Vorgänger.

## Ablauf je Veröffentlichung

1. Bauen und prüfen: `npm run build`, danach `npm run check:platform` und `npm run check:budget`.
2. Manifest erzeugen (Ausgabe in den Scratchpad, nicht hierher):

   ```
   npm run publish:manifest -- --previous docs/relaunch/publish/<link>.json --out <scratchpad>/manifest.json
   ```

   Das Skript prüft die Grenzen aus `scripts/limits.mjs` (höchstens 255 Dateien und 64 MB je Veröffentlichung, jede Datei
   unter 15 MB, flache Pfade, erlaubte Dateitypen) und bricht sonst ab. Es liefert:
   - `page`: die Seite (`file_path` im Artifact-Aufruf),
   - `files`: alle übrigen Dateien (`files`-Map),
   - `removeMap`: Dateien der vorigen Fassung, die die neue nicht mehr hat, jeweils mit `null`,
   - `commit`: der Stand, aus dem gebaut wurde.
3. Vor dem Veröffentlichen die aktuelle Version des Links lesen und als Rückweg notieren (`docs/umbau/stand.md`).
4. **Ein** Artifact-Aufruf mit `url` des Links, `file_path` = `page` und `files` = `files` **zusammen mit** `removeMap`
   (beide Maps in derselben `files`-Map), damit alte Stücke im selben Schritt verschwinden. Fähigkeiten `db`, `sample` und
   `downloads` bleiben, wie sie sind.
5. Das erzeugte Manifest als `docs/relaunch/publish/<link>.json` ablegen. Die Hauptsitzung committet es. **Ohne dieses Manifest
   wird nicht veröffentlicht**, sonst bleiben beim nächsten Mal alte Stücke liegen.

## Erstes Mal (es gibt noch kein `<link>.json`)

Auf dem Link liegt bisher nur die Einzeldatei. Weitere Dateien gibt es dort nicht, also auch nichts zu entfernen:

```
npm run publish:manifest -- --out <scratchpad>/manifest.json
```

(ohne `--previous`). Danach weiter mit Schritt 3–5. Will man vorher sichergehen, listet `Artifact` mit `action: "list"`,
`scope: "files"` und der `url` des Links die veröffentlichten Dateien. Steht dort mehr als die Seite, kommen diese Pfade
zusätzlich mit `null` in den Aufruf.

## Rückweg auf v86 (Einzeldatei)

1. `npm run v86:checkout` holt den Live-Stand v86 (Commit `3377252`, Nachricht „Live v86 …“) nach `.cache/v86/`.
2. Manifest gegen die vorige Mehr-Datei-Fassung:

   ```
   npm run publish:manifest -- --dist .cache/v86/dist --previous docs/relaunch/publish/<link>.json --out <scratchpad>/manifest-v86.json
   ```

   `files` ist dann leer, `removeMap` nennt **alle** Mehr-Datei-Stücke mit `null`.
3. Ein Artifact-Aufruf mit `file_path` = `page` (die v86-Einzeldatei) und `files` = `removeMap`.
4. Das neue Manifest wieder als `<link>.json` ablegen.

Die Rückweg-Probe auf dem Test-Link (einmal nach G4 von 1a) läuft genau so.
