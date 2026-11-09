// Stimmen-Paket für die neue Stimme (Kokoro-82M, Apache-2.0; Emrahs Auftrag 09.11.2026, docs/umbau/stimme.md).
// Legt die Modell-Dateien hintereinander, packt sie mit gzip und schreibt sie als Base64-Text in Teile < 15 MB
// (Textdateien sind ein offizieller Dateityp des Artefakts; .bin wird nicht ausgeliefert).
// Ausgabe: .voice-pack/voice-manifest.json + voice-p00.txt … (nicht im Repository, siehe .gitignore).
// Veröffentlicht wird das Paket einmal je Artefakt neben dem App-Bau (docs/relaunch/publish/README.md, Abschnitt Stimme).
//
// Aufruf: node scripts/voice/build-pack.mjs <rohordner>
//   <rohordner> enthält: config.json, tokenizer.json, tokenizer_config.json, voices/af_heart.bin, voices/am_michael.bin,
//   onnx/model_w16.onnx (aus onnx/model.onnx mit scripts/voice/mk_w16.py: fp16-Gewichte, Rechnen in fp32)
//   und ort-wasm-simd-threaded.jsep.wasm (aus node_modules/@huggingface/transformers/dist/).
// Rohdateien: https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX (resolve/main/…).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

/** Zeichen je Textteil: Vielfaches von 4 (jeder Teil ist für sich Base64-lesbar) und unter 15 MB. */
export const PART_CHARS = 14_999_996;

/** Dateien im Paket: veröffentlichter Pfad (wie die Bibliothek ihn anfragt) → Quelldatei im Rohordner. */
export const PACK_FILES = [
  ['config.json', 'config.json'],
  ['tokenizer.json', 'tokenizer.json'],
  ['tokenizer_config.json', 'tokenizer_config.json'],
  ['voices/af_heart.bin', 'voices/af_heart.bin'],
  ['voices/am_michael.bin', 'voices/am_michael.bin'],
  ['ort-wasm-simd-threaded.jsep.wasm', 'ort-wasm-simd-threaded.jsep.wasm'],
  ['onnx/model.onnx', 'onnx/model_w16.onnx'],
];

function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error('Aufruf: node scripts/voice/build-pack.mjs <rohordner>');
    process.exit(1);
  }
  const out = fileURLToPath(new URL('../../.voice-pack/', import.meta.url));
  const bufs = PACK_FILES.map(([, src]) => readFileSync(resolve(raw, src)));
  const files = [];
  let off = 0;
  PACK_FILES.forEach(([path], i) => {
    files.push({ path, off, len: bufs[i].length });
    off += bufs[i].length;
  });
  const all = Buffer.concat(bufs);
  const gz = gzipSync(all, { level: 9 });
  const b64 = gz.toString('base64');
  const v = createHash('sha256').update(gz).digest('hex').slice(0, 12);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const parts = [];
  for (let i = 0; i * PART_CHARS < b64.length; i++) {
    const name = `voice-p${String(i).padStart(2, '0')}.txt`;
    writeFileSync(resolve(out, name), b64.slice(i * PART_CHARS, (i + 1) * PART_CHARS));
    parts.push(name);
  }
  const manifest = { v, total: all.length, gz: gz.length, enc: 'gzip+base64', parts, files };
  writeFileSync(resolve(out, 'voice-manifest.json'), JSON.stringify(manifest) + '\n');
  console.log(`Stimmen-Paket ${v}: ${(all.length / 1e6).toFixed(1)} MB roh, ${(gz.length / 1e6).toFixed(1)} MB gepackt, ${parts.length} Teile, ${(b64.length / 1e6).toFixed(1)} MB Text`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
