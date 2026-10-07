# Inhalts-Pipeline (Lernplattform 3.0 §3.7 als Arbeitsanweisung)

## Speicher (P10)
- Quelle: `src/content/c1x/src/<art>/<charge>.json`, je Datei `{ "v": 1, "items": [...] }`; Bündelliste in `scripts/content/roots.json`.
- Build: `scripts/content/vite-plugin.mjs` packt jedes Bündel (`pack.mjs`: Dateien nach Pfad sortiert, doppelte `id` und Entwicklungs-Marker brechen den Build, deterministisches `JSON.stringify`, deflate-raw Stufe 9, Base64).
- Virtuelle Module: `virtual:content/<name>` (Base64), `virtual:content/manifest` (Zahl, Rohbytes, gepackte Bytes), `virtual:content/loaders` (je Bündel ein `import()`).
- Laufzeit: `loadPacked<T>(name)` aus `src/content/store` (atob → Uint8Array → `Blob.stream()` → `DecompressionStream('deflate-raw')` → `Response.text()` → `JSON.parse`), je Bündel einmal im Speicher. **Nie `fetch('data:…')`.** Fehlt `DecompressionStream` (Safari < 16.4), liefert es `null` und `logWarn`; die Art wird nicht angeboten, Pflichtrunde und `slotPlan` laufen trotzdem.
- Neues Bündel: Eintrag in `scripts/content/roots.json`, sonst nichts.

## Pipeline je Charge (25–40 Aufgaben)
1. **Schreiben** (Sonnet) mit dem Musterblatt: US-Englisch, ⅔ Beruf (Vertrieb, DMS/ECM, Cloud), ⅓ Alltag, eigene Sätze, **keine** Cambridge-Originalaufgaben.
2. **Automatisch:** `tests/unit/c1xContent.test.ts` über alle Inhalte (zod, `checkC1Content`, `scoreC1(item, Lösung) = max` für jede Variante, jede falsche Fassung `< max`, 25–35 % fehlerfreie `err`, Lösungsposition 20–30 % je Stelle, US-Schreibung, keine Dubletten, Begründungen in der richtigen Sprache, `probe`/`pool` nie in `select`, `kwt` 3–6 Wörter).
3. **Löser-Probe:** ein zweiter Agent löst jede Aufgabe ohne Lösung; Abweichungen auf die Prüfliste (zweite mögliche Option → Ablenker tauschen; gültige Variante → `keys`/`accepted` ergänzen).
4. **Gegenlesung `english-teacher`:** 20 % je Charge (mindestens 10), Check-Formen und Kapitelprüfungs-Vorrat 100 %. Zulässig ≤ 2 harte Fehler je 100.
5. **Protokoll** `docs/umbau/inhalte-pruefung-lp3.md` und Größenmessung `docs/umbau/budget.md`.
6. Jede Charge einzeln committen („LP3 Pxx: Inhalt kwt/err K1 Charge 1“). Inhalte nur für Themen, deren Musterdatei existiert.
