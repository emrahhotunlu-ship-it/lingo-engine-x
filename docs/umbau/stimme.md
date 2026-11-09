# Neue Stimme (Kokoro) – Technik

Auftrag Emrah 09.11.2026: Die Gerätestimme (Mac/iPhone klingt „robotermäßig“) wird durch eine natürliche Sprach-KI ersetzt. Antippen → die neue Stimme spricht. Keine vorbereiteten Sätze.

## Bausteine
- `src/platform/voice/neural.ts` (Haupt-Bündel, klein): Zustand `useNeuralVoice`, Laden im Hintergrund 1,5 s nach dem Start (`initSpeech` → `scheduleNeuralVoice`), Wiedergabe über Web Audio (`unlockNeural` im Tippen, `navigator.audioSession.type = 'playback'`), nächstes Stück wird erzeugt, während das aktuelle läuft. Nie unter Testwerkzeugen (`navigator.webdriver`).
- `src/platform/voice/engine.ts` (nachgeladenes Stück, Kennung `lx:voice-engine`): liest `voice-manifest.json` und die Teile `voice-pNN.txt` (gzip → Base64, je < 15 MB), entpackt mit `DecompressionStream`, legt das Ergebnis in Stücken zu 32 MiB in IndexedDB (`lx-voice`), beantwortet die Hugging-Face-Anfragen der Bibliothek aus dem Paket (Weiche über `window.fetch`), lädt `KokoroTTS` mit `dtype: 'fp32'`, `device: 'webgpu'` (sonst `wasm`).
- `speech.ts`: `speak()` nimmt die neue Stimme, wenn sie bereit ist oder lädt (Probehören einer Gerätestimme ausgenommen); fehlt sie, spricht dieselbe Ausgabe die Gerätestimme. `stopSpeech()`/`unlockSpeech()` gelten für beide.
- Einstellungen › Stimme: Sprecher Heart (Standard) und Michael, Status, Tempo (0,8–1,1 = `speed`). Die Liste der Gerätestimmen erscheint nur, wenn die neue Stimme hier nicht läuft.
- Bau: `scripts/vite-voice.mjs` legt `voice-ort.js` (Rechenkern-Lader von onnxruntime-web) neben die App und verhindert, dass Vite den 21,6-MB-Rechenkern als Datei ausgibt (er steckt im Paket).

## Stimmen-Paket neu bauen
1. Rohdateien von `https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/` laden: `config.json`, `tokenizer.json`, `tokenizer_config.json`, `voices/af_heart.bin`, `voices/am_michael.bin`, `onnx/model.onnx`.
2. Mischfassung: `python3 scripts/voice/mk_w16.py onnx/model.onnx onnx/model_w16.onnx` (Paket `onnx`, `numpy`). Reines fp16 rechnet am Grafikchip falsch (Rauschen).
3. `ort-wasm-simd-threaded.jsep.wasm` aus `node_modules/@huggingface/transformers/dist/` in den Rohordner kopieren (muss zur installierten onnxruntime-web passen).
4. `node scripts/voice/build-pack.mjs <rohordner>` → `.voice-pack/`.

## Veröffentlichen
Das Paket wird je Artefakt einmal mit hochgeladen (`files`-Map mit absoluten Pfaden auf `.voice-pack/*`, höchstens 4 Teile je Aufruf wegen 64 MB). `voice-manifest.json` kommt mit dem LETZTEN Aufruf, damit nie ein halbes Paket angesprochen wird. Die Stimmen-Dateien stehen in `docs/relaunch/publish/<link>.json` unter `voice`, nicht unter `files` – so löscht `publish-manifest.mjs --previous` sie nie. Spätere App-Veröffentlichungen lassen sie einfach stehen. Ein Artefakt-Stand darf höchstens 256 MB haben: App ~9 MB + Paket 208 MB.
