// Neue Stimme (docs/umbau/stimme.md): legt den Rechenkern-Lader von onnxruntime-web als flache Datei `voice-ort.js` neben die App.
// Die Bibliothek lädt ihn zur Laufzeit selbst (import() über `wasmPaths.mjs`, gesetzt in src/platform/voice/engine.ts);
// ohne diese Datei käme er vom CDN – die App lädt aber nichts von außen (A6 Nr. 8). Die Kennung `lx:voice-engine`
// erlaubt in scripts/check-platform.mjs genau hier WebAssembly, fetch() und Worker.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const VOICE_ORT_FILE = 'voice-ort.js';

export function voiceOrt({ multi }) {
  return {
    name: 'lx-voice-ort',
    apply: 'build',
    // Der Rechenkern (21,6 MB) kommt aus dem Stimmen-Paket (Weiche in engine.ts), nicht als eigene Datei:
    // ohne diese Umschreibung legte Vite ihn als Datei über der 15-MB-Grenze je Datei neben die App.
    transform(code, id) {
      if (!multi || !id.includes('onnxruntime-web')) return null;
      const out = code.replaceAll(/new URL\((["'`])ort-wasm-simd-threaded\.jsep\.wasm\1,\s*import\.meta\.url\)/g, 'new URL("ort-wasm-simd-threaded.jsep.wasm",self.location.href)');
      return out === code ? null : { code: out, map: null };
    },
    generateBundle() {
      if (!multi) return;
      const src = readFileSync(fileURLToPath(new URL('../node_modules/@huggingface/transformers/dist/ort-wasm-simd-threaded.jsep.mjs', import.meta.url)), 'utf8');
      this.emitFile({ type: 'asset', fileName: VOICE_ORT_FILE, source: `/* lx:voice-engine onnxruntime-web 1.22 (MIT) */\n${src}` });
    },
  };
}
