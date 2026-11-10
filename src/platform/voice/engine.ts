// lx:voice-engine – Kennung für scripts/check-platform.mjs: nur dieses nachgeladene Stück (und voice-ort.js) darf
// WebAssembly, fetch() und Worker enthalten (Emrahs Auftrag 09.11.2026 „Gerätestimme durch die neue Stimme ersetzen“,
// docs/entscheidungen.md). Alles kommt aus dem eigenen Artefakt, nichts von außen (A6 Nr. 8):
// - Modell, Stimmen und Rechenkern liegen als Stimmen-Paket neben der App (voice-manifest.json + voice-pNN.txt,
//   gebaut von scripts/voice/build-pack.mjs), einmal geladen und danach im Browser-Speicher (IndexedDB) gehalten;
// - die Bibliothek fragt Hugging-Face-Adressen an – die beantwortet eine Weiche hier aus dem Paket, ohne Netz;
// - der Rechenkern-Lader (voice-ort.js) liegt neben der App (scripts/vite-voice.mjs).
import { env as hfEnv } from '@huggingface/transformers';
import { KokoroTTS } from 'kokoro-js';
import { logWarn } from '../diagnostics';

export const VOICE_ENGINE_MARK = 'lx:voice-engine';

const HF = 'https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX/resolve/main/';
const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const WASM_NAME = 'ort-wasm-simd-threaded.jsep.wasm';
const DB_NAME = 'lx-voice';
const STORE = 'pack';
/** Ein IndexedDB-Eintrag darf auf dem iPhone höchstens etwa 130 MB groß sein: das Paket liegt in Stücken. */
const SLICE = 32 * 1024 * 1024;

type PackManifest = { v: string; total: number; parts: string[]; files: { path: string; off: number; len: number }[] };

export type EngineProgress = (p: { phase: 'download' | 'cache' | 'start'; pct: number }) => void;

export type Engine = {
  device: 'webgpu' | 'wasm';
  fromCache: boolean;
  /** Ladezeit in ms (aus dem Speicher bzw. mit Herunterladen). */
  loadMs: number;
  /** Grafikchip verloren (iPhone: nach dem Minimieren möglich) – dann neu laden. */
  lost(): boolean;
  generate(text: string, voice: string, speed: number): Promise<{ audio: Float32Array; rate: number }>;
  dispose(): Promise<void>;
};

// ---------------------------------------------------------------- Browser-Speicher (IndexedDB)

function openDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('idb open'));
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(key);
    q.onsuccess = () => res(q.result ?? null);
    q.onerror = () => rej(q.error ?? new Error('idb get'));
  });
}

function idbWrite(db: IDBDatabase, fn: (s: IDBObjectStore) => void): Promise<void> {
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    fn(t.objectStore(STORE));
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error ?? new Error('idb write'));
    t.onabort = () => rej(t.error ?? new Error('idb abort (Speicherplatz?)'));
  });
}

async function readCache(db: IDBDatabase, man: PackManifest): Promise<Uint8Array | null> {
  const n = Math.ceil(man.total / SLICE);
  const all = new Uint8Array(man.total);
  const parts = await Promise.all(Array.from({ length: n }, (_, i) => idbGet(db, `${man.v}-${i}`)));
  for (let i = 0; i < n; i++) {
    const part = parts[i];
    if (!(part instanceof Uint8Array) || part.length !== Math.min(SLICE, man.total - i * SLICE)) return null;
    all.set(part, i * SLICE);
  }
  return all;
}

async function writeCache(db: IDBDatabase, man: PackManifest, all: Uint8Array): Promise<void> {
  // Älteren Stand vorher räumen (nur dieser Speicher, nur die Stimme).
  await idbWrite(db, (s) => s.clear());
  const n = Math.ceil(man.total / SLICE);
  for (let i = 0; i < n; i++) {
    const part = all.slice(i * SLICE, Math.min(man.total, (i + 1) * SLICE));
    await idbWrite(db, (s) => s.put(part, `${man.v}-${i}`));
  }
}

// ---------------------------------------------------------------- Paket laden

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  const native = (Uint8Array as unknown as { fromBase64?: (s: string) => Uint8Array<ArrayBuffer> }).fromBase64;
  if (typeof native === 'function') return native(text.trim());
  const bin = atob(text.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function download(man: PackManifest, onProgress: EngineProgress): Promise<Uint8Array> {
  const all = new Uint8Array(man.total);
  const ds = new DecompressionStream('gzip');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  let off = 0;
  const pump = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      all.set(value, off);
      off += value.length;
    }
  })();
  for (let i = 0; i < man.parts.length; i++) {
    const name = man.parts[i] as string;
    const r = await fetch(name);
    if (!r.ok) throw new Error(`voice part ${name}: ${r.status}`);
    await writer.write(fromBase64(await r.text()));
    onProgress({ phase: 'download', pct: Math.round(((i + 1) / man.parts.length) * 100) });
  }
  await writer.close();
  await pump;
  if (off !== man.total) throw new Error(`voice pack size ${off} != ${man.total}`);
  return all;
}

// ---------------------------------------------------------------- Weiche für die Anfragen der Bibliothek

let shimmed: Map<string, Uint8Array> | null = null;

function installFetch(files: Map<string, Uint8Array>): void {
  shimmed = files;
  const w = window as unknown as { __lxVoiceFetch?: string };
  if (w.__lxVoiceFetch) return;
  // Trägt die Kennung ins gebaute Stück (scripts/check-platform.mjs erkennt das Stimmen-Stück daran).
  w.__lxVoiceFetch = VOICE_ENGINE_MARK;
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const map = shimmed;
    if (map) {
      const path = url.startsWith(HF) ? url.slice(HF.length).split('?')[0] : url.endsWith(WASM_NAME) ? WASM_NAME : null;
      const bytes = path ? map.get(path) : undefined;
      if (bytes) {
        const type = path?.endsWith('.json') ? 'application/json' : path === WASM_NAME ? 'application/wasm' : 'application/octet-stream';
        return Promise.resolve(new Response(bytes.slice(), { status: 200, headers: { 'Content-Type': type, 'Content-Length': String(bytes.length) } }));
      }
    }
    return real(input, init);
  };
}

async function hasGpu(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch (err) {
    logWarn('voice:gpu', err);
    return false;
  }
}

/** Lädt Paket und Modell; wirft bei jedem Fehler (der Aufrufer bleibt dann bei der Gerätestimme). */
export async function loadEngine(onProgress: EngineProgress): Promise<Engine> {
  const t0 = performance.now();
  // Bitte an den Browser, den Speicher nicht von selbst zu räumen (sonst lädt die Stimme wieder 210 MB herunter).
  const st = (navigator as unknown as { storage?: { persist?: () => Promise<boolean> } }).storage;
  if (st?.persist) void st.persist().catch((err: unknown) => logWarn('voice:persist', err));
  const mr = await fetch('voice-manifest.json');
  if (!mr.ok) throw new Error(`voice manifest: ${mr.status}`);
  const man = (await mr.json()) as PackManifest;
  let db: IDBDatabase | null;
  try {
    db = await openDb();
  } catch (err) {
    logWarn('voice:idb-open', err);
    db = null;
  }
  let all: Uint8Array | null = null;
  if (db) {
    try {
      all = await readCache(db, man);
    } catch (err) {
      logWarn('voice:idb-read', err);
      all = null;
    }
  }
  const fromCache = all !== null;
  if (all) onProgress({ phase: 'cache', pct: 100 });
  else {
    all = await download(man, onProgress);
    if (db) {
      try {
        await writeCache(db, man, all);
      } catch (err) {
        // Kein Platz im Browser-Speicher: die Stimme läuft trotzdem, beim nächsten Öffnen wird neu geladen.
        logWarn('voice:idb-write', err);
      }
    }
  }
  const files = new Map<string, Uint8Array>();
  for (const f of man.files) files.set(f.path, all.subarray(f.off, f.off + f.len));
  installFetch(files);
  hfEnv.useBrowserCache = false;
  hfEnv.allowLocalModels = false;
  const onnx = hfEnv.backends.onnx as { wasm?: { wasmPaths?: unknown; numThreads?: number } };
  if (onnx.wasm) {
    onnx.wasm.wasmPaths = { mjs: new URL('voice-ort.js', document.baseURI).href, wasm: new URL(WASM_NAME, document.baseURI).href };
    onnx.wasm.numThreads = 1;
  }
  onProgress({ phase: 'start', pct: 0 });
  const device = (await hasGpu()) ? 'webgpu' : 'wasm';
  const tts = await KokoroTTS.from_pretrained(MODEL_ID, { dtype: 'fp32', device });
  // Grafikchip beobachten: iOS nimmt ihn beim Minimieren manchmal weg; danach rechnet die Sitzung nicht mehr.
  let lost = false;
  if (device === 'webgpu') {
    try {
      const gpu = (hfEnv.backends.onnx as { webgpu?: { device?: unknown } }).webgpu;
      const d = (await Promise.resolve(gpu?.device)) as { lost?: Promise<unknown> } | undefined;
      void d?.lost?.then((info) => {
        lost = true;
        logWarn('voice:gpu-lost', info);
      });
    } catch (err) {
      logWarn('voice:gpu-watch', err);
    }
  }
  // Großes Modell und Rechenkern sind jetzt geladen: nur die kleinen Dateien (Stimmen, Einstellungen) bleiben in der Weiche.
  const keep = new Map<string, Uint8Array>();
  for (const [p, b] of files) if (!p.startsWith('onnx/') && p !== WASM_NAME) keep.set(p, b.slice());
  shimmed = keep;
  const loadMs = Math.round(performance.now() - t0);
  return {
    device,
    fromCache,
    loadMs,
    lost: () => lost,
    async dispose() {
      try {
        await (tts.model as unknown as { dispose?: () => Promise<unknown> }).dispose?.();
      } catch (err) {
        logWarn('voice:dispose', err);
      }
    },
    async generate(text, voice, speed) {
      const v: 'af_heart' | 'am_michael' = voice === 'am_michael' ? 'am_michael' : 'af_heart';
      const out = await tts.generate(text, { voice: v, speed });
      return { audio: out.audio, rate: out.sampling_rate };
    },
  };
}
