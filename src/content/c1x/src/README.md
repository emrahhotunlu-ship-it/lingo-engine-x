# c1x-Inhalte (Quelle)

Ein Ordner je Art: `kwt/ err/ ocl/ mcc/ wf/ pair/ cnet/ reg/ para/`, dazu `pilot/` (die sechs Pilotaufgaben aus P12).
Je **Charge** eine Datei `<art>/<charge>.json` mit `{ "v": 1, "items": [ … ] }`, damit nie zwei Pakete dieselbe Datei ändern
(z. B. `kwt/k1-001.json`). Das Schema der Aufgaben steht in `docs/umbau/c1x-schema.md`.

Der Build (`scripts/content/`) packt je Art ein Bündel (deflate-raw + Base64), prüft doppelte `id` und Entwicklungs-Marker;
geladen wird zur Laufzeit nur mit `loadPacked('c1x-<art>')` aus `src/content/store`. Arbeitsanweisung: `docs/umbau/inhalts-pipeline.md`.
