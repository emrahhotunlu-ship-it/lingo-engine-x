import { create } from 'zustand';
import { logInfo, logWarn } from '../diagnostics';
import { local } from '../storage';

// Tonvorrat der neuen Stimme (Stimme 2.0, Emrah 26.11.2026: „auf Handy und Mac IMMER die gute Stimme, schnell und immer verfügbar“).
// Jeder gerechnete Satz bleibt dauerhaft im Browser (IndexedDB `lx-voice-clips`, nur Bequemlichkeit wie das Stimmen-Paket, nie `db`):
// nochmal anhören – auch morgen, nach Standby oder bevor die Stimme fertig geladen ist – spielt sofort, ohne neu zu rechnen.
// - Schlüssel: Paket-Stand + Sprecher + Tempo + Text (Leerraum vereinheitlicht; Groß-/Kleinschreibung und Satzzeichen bleiben, sie ändern die Betonung).
// - Ton als 16-Bit-Werte (halb so groß wie die Rechen-Ausgabe, hörbar gleich), Deckel 150 MB, zuletzt benutzte bleiben (LRU).
// - Jeder Fehler (privates Fenster, Speicher voll, Safari hängt beim Öffnen) → ohne Vorrat weiter, nie ein Hindernis fürs Vorlesen.

export type Clip = { audio: Float32Array; rate: number };
type Meta = { b: number; at: number };
type Rec = { pcm: ArrayBuffer; rate: number };

/** Speicherweg (IndexedDB oder für Tests im Speicher). Jede Methode darf werfen. */
export type ClipBackend = {
  metas(): Promise<Array<[string, Meta]>>;
  get(k: string): Promise<Rec | null>;
  put(k: string, rec: Rec, meta: Meta): Promise<void>;
  touch(entries: Array<[string, Meta]>): Promise<void>;
  del(keys: string[]): Promise<void>;
};

/** Obergrenze des Vorrats (Byte Tondaten). */
export const CLIP_STORE_MAX_BYTES = 150 * 1024 * 1024;
/** Beim Räumen bis hierhin (etwas Luft, damit nicht bei jedem Satz geräumt wird). */
const EVICT_TO = 0.9;
/** Öffnen dauert länger (Safari hängt hier manchmal): ohne Vorrat weiter. */
const OPEN_MS = 3_000;
/** „Zuletzt benutzt“ gesammelt schreiben (ein Schreibvorgang statt einer je Abspielen). */
const TOUCH_MS = 2_000;
/** Gemerkter Paket-Stand: so findet der Vorrat Sätze schon, bevor die Stimme fertig geladen ist. */
export const VOICE_VER_KEY = 'lx:voice-ver';
const HITS_KEY = 'lx:voice-hits';

type StoreState = { ready: boolean; on: boolean; count: number; bytes: number; hits: number; misses: number };
export const useClipStore = create<StoreState>(() => ({ ready: false, on: false, count: 0, bytes: 0, hits: 0, misses: 0 }));

export const normText = (text: string): string => text.replace(/\s+/g, ' ').trim();
export const clipStoreKey = (ver: string, voice: string, speed: number, text: string): string => `${ver}|${voice}|${speed.toFixed(2)}|${normText(text)}`;

export function toPcm16(f: Float32Array): Int16Array {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const v = Math.max(-1, Math.min(1, f[i] as number));
    out[i] = v < 0 ? Math.round(v * 0x8000) : Math.round(v * 0x7fff);
  }
  return out;
}

export function fromPcm16(p: Int16Array): Float32Array {
  const out = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) {
    const v = p[i] as number;
    out[i] = v < 0 ? v / 0x8000 : v / 0x7fff;
  }
  return out;
}

// ---------------------------------------------------------------- IndexedDB

const DB = 'lx-voice-clips';
const CLIPS = 'clip';
const METAS = 'meta';

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error ?? new Error('idb request'));
  });
}

function done(t: IDBTransaction): Promise<void> {
  return new Promise((res, rej) => {
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error ?? new Error('idb write'));
    t.onabort = () => rej(t.error ?? new Error('idb abort (Speicherplatz?)'));
  });
}

export function idbBackend(): Promise<ClipBackend> {
  return new Promise<ClipBackend>((resolve, reject) => {
    const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    if (!idb) {
      reject(new Error('kein IndexedDB'));
      return;
    }
    const r = idb.open(DB, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore(CLIPS);
      r.result.createObjectStore(METAS);
    };
    r.onerror = () => reject(r.error ?? new Error('idb open'));
    r.onblocked = () => reject(new Error('idb open blocked'));
    r.onsuccess = () => {
      const db = r.result;
      resolve({
        async metas() {
          const s = db.transaction(METAS).objectStore(METAS);
          const [keys, vals] = await Promise.all([req(s.getAllKeys()), req(s.getAll())]);
          return keys.map((k, i) => [typeof k === 'string' ? k : JSON.stringify(k), vals[i] as Meta]);
        },
        async get(k) {
          const v = (await req(db.transaction(CLIPS).objectStore(CLIPS).get(k))) as Rec | undefined;
          return v && v.pcm instanceof ArrayBuffer && typeof v.rate === 'number' ? v : null;
        },
        async put(k, rec, meta) {
          const t = db.transaction([CLIPS, METAS], 'readwrite');
          t.objectStore(CLIPS).put(rec, k);
          t.objectStore(METAS).put(meta, k);
          await done(t);
        },
        async touch(entries) {
          const t = db.transaction(METAS, 'readwrite');
          const s = t.objectStore(METAS);
          for (const [k, m] of entries) s.put(m, k);
          await done(t);
        },
        async del(keys) {
          const t = db.transaction([CLIPS, METAS], 'readwrite');
          for (const k of keys) {
            t.objectStore(CLIPS).delete(k);
            t.objectStore(METAS).delete(k);
          }
          await done(t);
        },
      });
    };
  });
}

// ---------------------------------------------------------------- Vorrat

let backend: ClipBackend | null = null;
let opening: Promise<boolean> | null = null;
let index = new Map<string, Meta>();
let bytes = 0;
/** Schreiben in dieser Sitzung abgeschaltet (Speicher voll auch nach dem Räumen). */
let readOnly = false;
let touched = new Map<string, Meta>();
let touchTimer: ReturnType<typeof setTimeout> | null = null;
let makeBackend: () => Promise<ClipBackend> = idbBackend;
let maxBytes = CLIP_STORE_MAX_BYTES;

/** Nur für Tests: Speicherweg und Deckel austauschen, Zustand verwerfen. */
export function resetClipStore(fn: () => Promise<ClipBackend> = idbBackend, max = CLIP_STORE_MAX_BYTES): void {
  backend = null;
  opening = null;
  index = new Map();
  bytes = 0;
  readOnly = false;
  touched = new Map();
  if (touchTimer) clearTimeout(touchTimer);
  touchTimer = null;
  hitsDay = null;
  makeBackend = fn;
  maxBytes = max;
  useClipStore.setState({ ready: false, on: false, count: 0, bytes: 0, hits: 0, misses: 0 });
}

const publish = (): void => useClipStore.setState({ count: index.size, bytes });

function within<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((res, rej) => {
    const t = setTimeout(() => rej(new Error(`${what}: keine Antwort nach ${ms} ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        res(v);
      },
      (err: unknown) => {
        clearTimeout(t);
        rej(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/** Öffnet den Vorrat (einmal). `false` = ohne Vorrat (kein Speicher, privat, gesperrt). */
export function openClipStore(): Promise<boolean> {
  if (opening) return opening;
  opening = (async () => {
    try {
      const b = await within(makeBackend(), OPEN_MS, 'voice:clips open');
      const all = await within(b.metas(), OPEN_MS, 'voice:clips index');
      index = new Map(all.filter(([, m]) => m && typeof m.b === 'number' && typeof m.at === 'number'));
      bytes = [...index.values()].reduce((a, m) => a + m.b, 0);
      backend = b;
      loadHits();
      useClipStore.setState({ ready: true, on: true });
      publish();
      return true;
    } catch (err) {
      logWarn('voice:clips', err, 'ohne Tonvorrat weiter');
      backend = null;
      useClipStore.setState({ ready: true, on: false });
      return false;
    }
  })();
  return opening;
}

/** Steht der Satz im Vorrat? (sofort, ohne Speicherzugriff; vor dem Öffnen immer `false`) */
export const clipStored = (k: string): boolean => index.has(k);

function touch(k: string): void {
  const m = index.get(k);
  if (!m || !backend) return;
  const n = { b: m.b, at: Date.now() };
  index.set(k, n);
  touched.set(k, n);
  if (touchTimer || readOnly) return;
  touchTimer = setTimeout(() => {
    touchTimer = null;
    const b = backend;
    const batch = [...touched];
    touched = new Map();
    if (b && batch.length) void b.touch(batch).catch((err: unknown) => logWarn('voice:clips-touch', err));
  }, TOUCH_MS);
}

/** Satz aus dem Vorrat (`null` = nicht da oder nicht lesbar). */
export async function readClip(k: string): Promise<Clip | null> {
  if (!index.has(k)) return null;
  const b = backend;
  if (!b) return null;
  try {
    const rec = await within(b.get(k), OPEN_MS, 'voice:clips get');
    if (!rec) {
      // Eintrag ohne Ton (z. B. vom Browser geräumt): aus dem Verzeichnis nehmen.
      const m = index.get(k);
      index.delete(k);
      if (m) bytes -= m.b;
      publish();
      return null;
    }
    touch(k);
    return { audio: fromPcm16(new Int16Array(rec.pcm)), rate: rec.rate };
  } catch (err) {
    logWarn('voice:clips-get', err);
    return null;
  }
}

/** Älteste Einträge entfernen, bis höchstens `target` Byte übrig sind. */
async function evict(target: number, keep?: string): Promise<void> {
  const b = backend;
  if (!b || bytes <= target) return;
  const old = [...index].filter(([k]) => k !== keep).sort((a, z) => a[1].at - z[1].at);
  const gone: string[] = [];
  let left = bytes;
  for (const [k, m] of old) {
    if (left <= target) break;
    gone.push(k);
    left -= m.b;
  }
  if (!gone.length) return;
  await b.del(gone);
  for (const k of gone) {
    const m = index.get(k);
    index.delete(k);
    touched.delete(k);
    if (m) bytes -= m.b;
  }
  publish();
}

const isQuota = (err: unknown): boolean => err instanceof Error && /quota|space|abort/i.test(`${err.name} ${err.message}`);

/** Gerechneten Satz ablegen (still; Fehler nur ins Protokoll). */
export async function writeClip(k: string, clip: Clip): Promise<void> {
  if (!backend || readOnly || index.has(k)) return;
  const pcm = toPcm16(clip.audio);
  const meta: Meta = { b: pcm.byteLength, at: Date.now() };
  if (meta.b > maxBytes / 4) return;
  const rec: Rec = { pcm: pcm.buffer as ArrayBuffer, rate: clip.rate };
  const tryPut = async (): Promise<void> => {
    const b = backend;
    if (!b) return;
    await b.put(k, rec, meta);
    index.set(k, meta);
    bytes += meta.b;
  };
  try {
    if (bytes + meta.b > maxBytes) await evict(maxBytes * EVICT_TO - meta.b);
    await tryPut();
  } catch (err) {
    if (!isQuota(err)) {
      logWarn('voice:clips-put', err);
      return;
    }
    // Speicher voll: ein Fünftel räumen und einmal neu versuchen; sonst in dieser Sitzung nicht mehr schreiben (Lesen geht weiter).
    try {
      await evict(bytes * 0.8);
      await tryPut();
    } catch (again) {
      readOnly = true;
      logWarn('voice:clips-full', again, 'Tonvorrat voll – in dieser Sitzung ohne neue Einträge');
    }
  }
  publish();
}

/** Einträge anderer Paket-Stände entfernen (neues Stimmen-Paket → alte Töne passen nicht mehr). */
export async function dropOtherVersions(ver: string): Promise<void> {
  local.set(VOICE_VER_KEY, ver);
  const b = backend;
  if (!b) return;
  const gone = [...index.keys()].filter((k) => !k.startsWith(`${ver}|`));
  if (!gone.length) return;
  try {
    await b.del(gone);
    for (const k of gone) {
      const m = index.get(k);
      index.delete(k);
      if (m) bytes -= m.b;
    }
    publish();
    logInfo('voice:clips', `${gone.length} Töne eines älteren Stimmen-Pakets entfernt`);
  } catch (err) {
    logWarn('voice:clips-drop', err);
  }
}

/** Zuletzt bekannter Paket-Stand (vor dem Laden der Stimme). */
export const knownVoiceVersion = (): string | null => local.get(VOICE_VER_KEY);

// ---------------------------------------------------------------- Treffer heute (Diagnose)

const today = (): string => {
  const d = new Date(Date.now() - 4 * 3_600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

let hitsDay: string | null = null;

function loadHits(): void {
  if (hitsDay) return;
  hitsDay = today();
  const h = local.getJson<{ d?: string; h?: number; m?: number }>(HITS_KEY);
  if (h && h.d === hitsDay) useClipStore.setState({ hits: Number(h.h) || 0, misses: Number(h.m) || 0 });
}

/** Ein Satz wurde vorgelesen: sofort aus Gedächtnis/Vorrat (`hit`) oder erst gerechnet. */
export function noteClipUse(hit: boolean): void {
  loadHits();
  const d = today();
  const s = useClipStore.getState();
  const fresh = hitsDay !== d;
  hitsDay = d;
  const hits = (fresh ? 0 : s.hits) + (hit ? 1 : 0);
  const misses = (fresh ? 0 : s.misses) + (hit ? 0 : 1);
  useClipStore.setState({ hits, misses });
  local.set(HITS_KEY, JSON.stringify({ d, h: hits, m: misses }));
}
