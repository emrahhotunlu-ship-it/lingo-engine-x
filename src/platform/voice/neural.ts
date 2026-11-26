import { create } from 'zustand';
import { ensureStreamAsyncIterator } from '../compat';
import { logInfo, logWarn } from '../diagnostics';
import { inputQuietLeft, resetInputQuiet, whenIdle } from '../inputQuiet';
import { local } from '../storage';
import { clipStoreKey, clipStored, dropOtherVersions, knownVoiceVersion, noteClipUse, openClipStore, readClip, writeClip, type Clip } from './clipStore';
import type { Engine, EngineDevice } from './engine';

// Neue Stimme (Kokoro, Emrahs Auftrag 09.11.2026): ersetzt die Gerätestimme beim Vorlesen. Dieses Modul bleibt klein
// und liegt im Haupt-Bündel; Modell und Bibliothek kommen erst mit `engine.ts` (eigenes, nachgeladenes Stück) – seit Stimme 2.0
// bevorzugt im Hintergrund-Rechner (`workerHost.ts` + `worker.ts`), sonst wie bisher im Hauptfaden.
// Stimme 2.0 (Emrah 26.11.2026: „auf Handy und Mac IMMER die gute Stimme, schnell und immer verfügbar“, docs/umbau/stimme.md):
// - Tonvorrat (`clipStore.ts`): jeder gerechnete Satz bleibt im Browser; Abspielen daraus startet sofort, auch bevor die Stimme geladen ist.
// - Vorab-Rechnen (`planNeural`): in Tipp-Pausen die Sätze der nächsten Karten und der ganzen Runde, mit Pausen und Obergrenze.
// - Nie mehr die Gerätestimme, nur weil ein Satz dauert: der Knopf zeigt „lädt“, die gute Stimme spielt, sobald sie fertig ist.
//   Gerätestimme nur, wenn die gute Stimme hier gar nicht lädt (Status `failed`) oder beim allerersten Herunterladen.
// - Aufwärmen nach dem Zurückkehren: ein kurzer Satz wird still gerechnet, damit Grafikchip/Rechner wach sind, bevor Emrah tippt.

export type NeuralStatus = 'off' | 'loading' | 'ready' | 'failed';

type NeuralState = {
  status: NeuralStatus;
  pct: number;
  phase: 'download' | 'cache' | 'start' | null;
  device: 'webgpu' | 'wasm' | null;
  /** Rechnet im Hintergrund-Rechner (Web Worker). */
  worker: boolean;
  fromCache: boolean;
  loadMs: number | null;
};

export const useNeuralVoice = create<NeuralState>(() => ({ status: 'off', pct: 0, phase: null, device: null, worker: false, fromCache: false, loadMs: null }));

/** Sprecher der neuen Stimme; Standard ist „Heart“ (US, Frau). */
export const NEURAL_VOICES = [
  { id: 'af_heart', name: 'Heart' },
  { id: 'am_michael', name: 'Michael' },
] as const;
export const isNeuralVoice = (name: string | null | undefined): boolean => NEURAL_VOICES.some((v) => v.id === name);

let engine: Engine | null = null;
let loading: Promise<Engine | null> | null = null;
let ctx: AudioContext | null = null;

/** Testhilfe des Entwicklungs-Adapters (E2E): eine nachgebildete Maschine statt des Stimmen-Pakets. Im echten Artefakt nie gesetzt. */
type EngineFactory = () => Promise<Engine>;
const testFactory = (): EngineFactory | null => {
  const f = (globalThis as { __lxVoiceEngine?: unknown }).__lxVoiceEngine;
  return typeof f === 'function' ? (f as EngineFactory) : null;
};

/** Läuft die App unter einem Testwerkzeug (Playwright)? Dann wird die neue Stimme nie geladen (außer mit der Testhilfe). */
function automated(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { webdriver?: boolean }).webdriver === true && !testFactory();
}

function supported(): boolean {
  if (typeof window === 'undefined' || automated()) return false;
  const w = window as unknown as Record<string, unknown>;
  return typeof w.indexedDB === 'object' && typeof w.DecompressionStream === 'function' && (typeof w.AudioContext === 'function' || typeof w.webkitAudioContext === 'function');
}

/** Fehlversuche beim Laden; danach neuer Versuch nach 15 s, 1 min, 3 min (Emrah 10.11.2026: die neue Stimme soll von selbst übernehmen). */
let failures = 0;
let lastTry = 0;
const RETRY_MS = [15_000, 60_000, 180_000];

/**
 * Browser-Speicher (nur Bequemlichkeit, nie db): `'wasm'` = hier rechnet die neue Stimme auf dem Prozessor, weil der Grafikchip
 * gehangen hat (Safari am Mac 23.11.2026: WebGPU wird angeboten und lädt, `generate` kommt aber nie zurück). Gilt auch beim nächsten Start.
 */
export const VOICE_DEVICE_KEY = 'lx:voice-device';
/**
 * Browser-Speicher: `off:<ms>` = der Hintergrund-Rechner ließ sich hier nicht starten (z. B. im Artefakt gesperrt); einen Tag lang gleich im
 * Hauptfaden rechnen, statt jedes Mal auf ihn zu warten.
 */
export const VOICE_WORKER_KEY = 'lx:voice-worker';
const WORKER_RETRY_MS = 24 * 3_600_000;
/** In dieser Sitzung auf den Prozessor gewechselt (auch, wenn der Browser-Speicher gesperrt ist). */
let forceWasm = false;
/** In dieser Sitzung ohne Hintergrund-Rechner (Start gescheitert oder er hat keinen Grafikchip, der Hauptfaden aber schon). */
let noWorker = false;
/** Die neue Stimme hängt auch auf dem Prozessor bzw. zu oft: in dieser Sitzung nicht mehr laden, es spricht die Gerätestimme. */
let gaveUp = false;

function wantedDevice(): EngineDevice | undefined {
  return forceWasm || local.get(VOICE_DEVICE_KEY) === 'wasm' ? 'wasm' : undefined;
}

function workerWanted(): boolean {
  if (noWorker || testFactory() || typeof (globalThis as { Worker?: unknown }).Worker !== 'function') return false;
  const m = /^off:(\d+)$/.exec(local.get(VOICE_WORKER_KEY) ?? '');
  return !m || Date.now() - Number(m[1]) > WORKER_RETRY_MS;
}

async function mainHasGpu(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) != null;
  } catch (err) {
    logWarn('voice:gpu', err);
    return false;
  }
}

const baseUrl = (): string => (typeof document !== 'undefined' ? document.baseURI : '');
const progress = (p: { phase: 'download' | 'cache' | 'start'; pct: number }): void => useNeuralVoice.setState({ phase: p.phase, pct: p.pct });

/** Maschine laden: zuerst im Hintergrund-Rechner, sonst (oder wenn der scheitert) im Hauptfaden. */
async function startEngine(device: EngineDevice | undefined): Promise<Engine> {
  const f = testFactory();
  if (f) return f();
  if (workerWanted()) {
    try {
      const host = await import('./workerHost');
      return await host.loadWorkerEngine(progress, { base: baseUrl(), mainGpu: mainHasGpu, ...(device ? { device } : {}) });
    } catch (err) {
      noWorker = true;
      if (err instanceof Error && err.name === 'WorkerNoGpuError') logInfo('voice:worker', 'Grafikchip nur im Hauptfaden – die neue Stimme rechnet dort');
      else {
        logWarn('voice:worker', err, 'Hintergrund-Rechner startet nicht – die neue Stimme rechnet im Hauptfaden');
        local.set(VOICE_WORKER_KEY, `off:${Date.now()}`);
      }
      useNeuralVoice.setState({ pct: 0, phase: null });
    }
  }
  const m = await import('./engine');
  return m.loadEngine(progress, device ? { device } : {});
}

/** Startet das Laden (einmal). Liefert die Maschine oder `null`, wenn die neue Stimme hier (noch) nicht läuft. */
export function loadNeuralVoice(): Promise<Engine | null> {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  if (gaveUp || !supported()) return Promise.resolve(null);
  lastTry = Date.now();
  useNeuralVoice.setState({ status: 'loading', pct: 0, phase: null });
  const device = wantedDevice();
  // Safari: die Lautschrift im Stimmen-Stück braucht `for await` über einen ReadableStream (sonst hängt jedes `generate`).
  if (ensureStreamAsyncIterator()) logInfo('voice:compat', 'ReadableStream-Durchlauf nachgerüstet (Safari)');
  // Bitte an den Browser, Paket und Tonvorrat nicht von selbst zu räumen (nur im Hauptfaden möglich).
  const st = (navigator as unknown as { storage?: { persist?: () => Promise<boolean> } }).storage;
  if (typeof st?.persist === 'function') void st.persist().catch((err: unknown) => logWarn('voice:persist', err));
  void openClipStore();
  const run: Promise<Engine | null> = startEngine(device)
    .then((e) => {
      engine = e;
      engineOk = 0;
      failures = 0;
      if (loading === run) loading = null;
      useNeuralVoice.setState({ status: 'ready', device: e.device, worker: e.worker === true, fromCache: e.fromCache, loadMs: e.loadMs, pct: 100 });
      logInfo('voice:ready', `${e.device}${e.worker ? ' im Hintergrund' : ''}, ${e.fromCache ? 'aus dem Speicher' : 'heruntergeladen'}, ${(e.loadMs / 1000).toFixed(1)} s`);
      void openClipStore().then(() => dropOtherVersions(e.version));
      // Im Hintergrund-Rechner gleich still aufwärmen (Grafikchip-Programme bauen), dann das Vorab-Rechnen anstoßen.
      if (e.worker) void warmUp(e, 'ready');
      kickPlan(0);
      return e;
    })
    .catch((err: unknown) => {
      logWarn('voice:load', err);
      useNeuralVoice.setState({ status: 'failed' });
      // Nicht aufgeben: später von selbst noch einmal (bis dahin spricht die Gerätestimme).
      const wait = RETRY_MS[failures];
      failures += 1;
      if (loading === run) loading = null;
      if (wait !== undefined) setTimeout(() => void loadNeuralVoice(), wait);
      return null;
    });
  loading = run;
  return loading;
}

/** Gleich nach dem Start im Hintergrund laden (kurz warten, damit der erste Bildschirm zuerst steht). */
export function scheduleNeuralVoice(delayMs = 300): void {
  if (!supported() || loading || engine) return;
  // Der Tonvorrat öffnet sofort: gespeicherte Sätze spielen schon, während die Stimme noch lädt.
  void openClipStore();
  setTimeout(() => void loadNeuralVoice(), delayMs);
}

/**
 * Soll `speak` die neue Stimme nehmen? Stimme 2.0: immer, außer sie läuft hier gar nicht (nicht unterstützt, Laden gescheitert, aufgegeben).
 * Ob sie einen Satz schon hat oder erst rechnet bzw. lädt, entscheidet `speakNeural` (dort wartet der Knopf sichtbar).
 */
export function neuralWanted(): boolean {
  if (!supported() || gaveUp) return false;
  const s = useNeuralVoice.getState().status;
  if (s !== 'failed') return true;
  // Alle geplanten Versuche vorbei: höchstens alle 5 Minuten beim Vorlesen einen neuen anstoßen.
  if (!loading && failures > RETRY_MS.length && Date.now() - lastTry > 300_000) void loadNeuralVoice();
  return false;
}

/** Die App war im Hintergrund (iPhone: App minimiert): die Tonausgabe danach im nächsten Tipp frisch aufbauen. */
let wasHidden = false;
let hiddenAt = 0;
/**
 * Ab so langer Abwesenheit wird nach dem Zurückkehren still aufgewärmt: im Hintergrund-Rechner schon nach 5 s (kostet die App nichts), im
 * Hauptfaden wie bisher nach 20 s und nur auf dem Grafikchip (auf dem Prozessor hielte der Mini-Satz die App sekundenlang an).
 */
const WARM_AFTER_MS = { worker: 5_000, main: 20_000 };
function onReturn(): void {
  const e = engine;
  // Zurück in der App und die Stimme fehlt noch: gleich neu versuchen.
  if (!e && !loading && !gaveUp && useNeuralVoice.getState().status === 'failed') void loadNeuralVoice();
  else if (e && (e.worker || e.device !== 'wasm' || e.lost()) && Date.now() - hiddenAt > (e.worker ? WARM_AFTER_MS.worker : WARM_AFTER_MS.main)) void warmUp(e, 'return');
  kickPlan(500);
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      wasHidden = true;
      hiddenAt = Date.now();
      return;
    }
    onReturn();
  });
  // Safari: Rückkehr aus dem Verlauf-Speicher (zurück-Taste, Wechsel zwischen Tabs am iPhone) meldet nur `pageshow`.
  if (typeof window !== 'undefined')
    window.addEventListener('pageshow', (ev) => {
      if (ev.persisted) {
        wasHidden = true;
        onReturn();
      }
    });
}

/** Läuft gerade ein Aufwärmen? (nur eins zur Zeit) */
let warming = false;
const WARM_TEXT = 'Hi.';

/**
 * Still einen Mini-Satz rechnen (nicht abspielen), damit Grafikchip bzw. Rechner wach sind, bevor Emrah tippt: nach dem Laden und nach dem
 * Zurückkehren. Grafikchip verloren → neu laden; Fehler → neu laden. Kein Wechsel zur Gerätestimme. Protokoll nur, wenn es auffällig dauert.
 */
async function warmUp(e: Engine, why: 'ready' | 'return'): Promise<void> {
  if (warming) return;
  warming = true;
  const t0 = Date.now();
  try {
    if (e.lost()) {
      await rebuild(e, 'gpu lost');
      return;
    }
    const voice = 'af_heart';
    // Ein eigener Schlüssel je Aufwärmen, damit wirklich gerechnet wird (nicht aus dem Gedächtnis).
    const out = await synth(WARM_TEXT, voice, 1, true, () => true, `warm|${t0}`);
    const ms = Date.now() - t0;
    if (out && ms > 3_000) logInfo('voice:warm', `${why === 'return' ? 'nach dem Zurückkehren' : 'nach dem Laden'} wach nach ${(ms / 1000).toFixed(1)} s`);
  } catch (err) {
    if (!(err instanceof StaleError)) {
      logWarn('voice:warm', err);
      await rebuild(e, 'check');
    }
  } finally {
    warming = false;
  }
}

function newCtx(): AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const C = w.AudioContext ?? w.webkitAudioContext;
  if (!C) return null;
  try {
    return new C();
  } catch (err) {
    logWarn('voice:audioctx', err);
    return null;
  }
}

/**
 * Tonausgabe, SYNCHRON im Tippen aufrufen (iPhone gibt sie nur in einer Berührung frei). Nach dem Minimieren meldet iOS die alte
 * Ausgabe oft als „unterbrochen“ und lässt sie stumm, auch wenn `resume()` nichts meldet (Emrah 10.11.2026: „nach dem Minimieren geht die
 * Stimme nicht mehr, erst nach Neustart“). Deshalb: nach dem Hintergrund oder wenn sie nicht läuft, eine neue Ausgabe bauen.
 */
function ensureCtx(): AudioContext | null {
  const state = ctx?.state as string | undefined;
  if (ctx && (wasHidden || state === 'interrupted' || state === 'closed')) {
    const old = ctx;
    ctx = null;
    stopNeural();
    void old.close().catch((err: unknown) => logWarn('voice:ctx-close', err));
  }
  wasHidden = false;
  if (!ctx) ctx = newCtx();
  const c = ctx;
  if (!c) return null;
  if (c.state === 'suspended') void c.resume().catch((err: unknown) => logWarn('voice:resume', err));
  try {
    // Stummer, winziger Ton: schaltet die Wiedergabe am iPhone frei.
    const b = c.createBuffer(1, 1, 22050);
    const src = c.createBufferSource();
    src.buffer = b;
    src.connect(c.destination);
    src.start(0);
  } catch (err) {
    logWarn('voice:unlock', err);
  }
  return c;
}

/**
 * Im Tippen aufrufen: schaltet die Wiedergabe am iPhone frei. Spielt auch bei Stummschalter, wie die Gerätestimme
 * (Safari: `navigator.audioSession`).
 */
export function unlockNeural(): void {
  if (!supported()) return;
  const as = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
  if (as) {
    try {
      as.type = 'playback';
    } catch (err) {
      logWarn('voice:audiosession', err);
    }
  }
  ensureCtx();
}

let playing: AudioBufferSourceNode | null = null;

/** Hält die laufende Wiedergabe an. */
export function stopNeural(): void {
  const p = playing;
  playing = null;
  if (p) {
    try {
      // `onended` bleibt: so beendet sich die wartende Ausgabe in `speakNeural` sofort.
      p.stop();
    } catch (err) {
      logWarn('voice:stop', err);
    }
  }
}

export type NeuralRun = {
  chunks: readonly string[];
  from: number;
  rate: number;
  voice: string;
  /** Ist diese Ausgabe noch die aktuelle? (sonst still beenden) */
  alive: () => boolean;
  onChunk: (i: number) => void;
  /** Wartet die Ausgabe gerade auf einen Satz, der erst gerechnet wird? (Knopf zeigt dann „lädt“) */
  onWait?: (waiting: boolean) => void;
};

/** `slow` = die gute Stimme war diesmal nicht rechtzeitig fertig: still bleiben (nicht die Gerätestimme), der Satz landet im Vorrat. */
export type NeuralOutcome = 'done' | 'stopped' | 'unavailable' | 'slow' | 'error';

// ---------------------------------------------------------------- Rechnen: eins nach dem anderen, mit Gedächtnis
// Emrah 10.11.2026 („auf einmal ging es nicht mehr und das Handy wurde laggy … es dauert immer so eine Sekunde“):
// - Der Grafikchip rechnet immer nur EINEN Satz; neue Tipps überholen das Vorab-Rechnen, veraltete Aufträge fallen weg.
// - Fertig gerechnete Sätze bleiben im Gedächtnis (zuletzt benutzte zuerst) und seit Stimme 2.0 dauerhaft im Tonvorrat.
// - Dauert ein Satz, wartet der Tipp sichtbar (bis `wait` je Gerät); die neue Stimme wird dafür NICHT neu geladen, nur bei echtem Hänger.

export type { Clip };

/** Gedächtnis: höchstens so viele Abtastwerte (≈ 16 MB) und Einträge. */
const CACHE_SAMPLES = 4_000_000;
const CACHE_MAX = 60;
const cache = new Map<string, Clip>();
let cacheSamples = 0;
const clipKey = (text: string, voice: string, speed: number) => `${voice}|${speed.toFixed(2)}|${text}`;
/** Schlüssel im Tonvorrat (mit Paket-Stand; ohne bekannten Stand kein Vorrat). */
const storeKeyOf = (text: string, voice: string, speed: number): string | null => {
  const v = engine?.version ?? knownVoiceVersion();
  return v ? clipStoreKey(v, voice, speed, text) : null;
};

function cacheGet(k: string): Clip | undefined {
  const v = cache.get(k);
  if (v) {
    cache.delete(k);
    cache.set(k, v);
  }
  return v;
}

function cachePut(k: string, v: Clip): void {
  if (cache.has(k)) return;
  cache.set(k, v);
  cacheSamples += v.audio.length;
  for (const [old, clip] of cache) {
    if (cache.size <= CACHE_MAX && cacheSamples <= CACHE_SAMPLES) break;
    if (old === k) continue;
    cache.delete(old);
    cacheSamples -= clip.audio.length;
  }
}

type Job = { key: string; text: string; voice: string; speed: number; urgent: boolean; store: boolean; wanted: () => boolean; promise: Promise<Clip>; resolve: (c: Clip) => void; reject: (e: Error) => void };

const queue: Job[] = [];
const pending = new Map<string, Job>();
/** Der Auftrag, den die Maschine gerade rechnet. */
type Running = { job: Job; since: number; engine: Engine; timer: ReturnType<typeof setTimeout> | undefined };
let running: Running | null = null;
/** Sätze, die die aktuelle Maschine fertig gerechnet hat (0 = sie hat hier noch nie geantwortet). */
let engineOk = 0;

type Limits = {
  /** So lange wartet ein Tipp sichtbar auf einen Satz (danach still, der Satz rechnet weiter in den Vorrat). */
  wait: number;
  /** Ab hier gilt ein Satz als hängend (die Maschine antwortet nicht mehr): dann, und nur dann, neu laden. */
  hang: number;
};
/**
 * Grenzwerte je Maschine. Der Prozessor ist deutlich langsamer als der Grafikchip (gemessen 23.11.2026, ein Kern der Cloud-Umgebung: „Hi.“
 * 4–5 s, 35 Zeichen 6,5 s, 117 Zeichen 23 s; ein Mac ist etwa zwei- bis dreimal so schnell). Im Hauptfaden laufen während des Rechnens keine
 * Wecker (ein fertiger, nur langsamer Satz zählt dort nie als Hänger); im Hintergrund-Rechner laufen sie pünktlich.
 */
const LIMITS: Record<'webgpu' | 'wasm' | 'wasmWorker', Limits> = {
  webgpu: { wait: 15_000, hang: 20_000 },
  wasm: { wait: 30_000, hang: 90_000 },
  wasmWorker: { wait: 30_000, hang: 45_000 },
};
const limitsOf = (e: Engine): Limits => (e.device === 'wasm' ? (e.worker ? LIMITS.wasmWorker : LIMITS.wasm) : LIMITS.webgpu);
/** Wartezeit eines Tipps, solange noch keine Maschine da ist (sie lädt gerade aus dem Speicher). */
const WAIT_LOADING_MS = 15_000;
/** Kommt ein Wecker so viel zu spät, war der Hauptfaden vom Rechnen belegt: dann erst kurz nachsehen, ob der Satz fertig ist. */
const LATE_MS = 1_000;
const GRACE_MS = 1_500;
/** Vorab-Aufträge in der Rechen-Schlange höchstens so viele (der Vorab-Plan reicht ohnehin nur einen zur Zeit herein). */
const PREFETCH_MAX = 6;

class StaleError extends Error {
  constructor() {
    super('voice: not needed any more');
  }
}

/** Rechnet einen Satz (oder holt ihn aus dem Gedächtnis). `key` nur fürs Aufwärmen (eigener Schlüssel, nie gespeichert). */
function synth(text: string, voice: string, speed: number, urgent: boolean, wanted: () => boolean, key?: string): Promise<Clip> {
  const k = key ?? clipKey(text, voice, speed);
  const hit = cacheGet(k);
  if (hit) return Promise.resolve(hit);
  const known = pending.get(k);
  if (known) {
    if (urgent && !known.urgent) known.urgent = true;
    const before = known.wanted;
    known.wanted = () => before() || wanted();
    return known.promise;
  }
  let resolve!: (c: Clip) => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<Clip>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  // Nicht abgeholte Ablehnungen (Vorab-Rechnen) sind gewollt still.
  promise.catch(() => undefined);
  const job: Job = { key: k, text, voice, speed, urgent, store: key === undefined, wanted, promise, resolve, reject };
  pending.set(k, job);
  queue.push(job);
  // Zu viel Vorab-Rechnen: die ältesten Vorab-Aufträge fallen weg.
  const pre = queue.filter((j) => !j.urgent);
  for (const j of pre.slice(0, Math.max(0, pre.length - PREFETCH_MAX))) drop(j, new StaleError());
  pump();
  return promise;
}

function drop(job: Job, err: Error): void {
  const i = queue.indexOf(job);
  if (i >= 0) queue.splice(i, 1);
  if (pending.get(job.key) === job) pending.delete(job.key);
  job.reject(err);
}

// ---------------------------------------------------------------- Eingabe-Ruhe für das Vorab-Rechnen
// Emrah 24.11.2026 am iPhone („Eintippen, Tastatur aufklappen, zuklappen … alles echt laggy“): Vorab-Aufträge starten erst nach einer
// Tipp-Pause und nie, während die Tastatur auf- oder zugeht; ein Tipp auf „Anhören“ (dringend) rechnet sofort. Die Ruhe-Regel selbst steht in
// `platform/inputQuiet.ts`; die Wörter-Pflege nutzt dieselbe.
export { INPUT_QUIET_MS, noteInputActivity } from '../inputQuiet';
let quietTimer: ReturnType<typeof setTimeout> | null = null;
const quietLeft = inputQuietLeft;

/** Vorab-Aufträge nach der Ruhezeit erneut versuchen (ein Wecker, kein Warten in einer Schleife). */
function pumpWhenQuiet(ms: number): void {
  if (quietTimer) return;
  quietTimer = setTimeout(() => {
    quietTimer = null;
    whenIdle(pump);
  }, ms + 30);
}

function pump(): void {
  const e = engine;
  if (running || !e) return;
  let job: Job | undefined;
  while (!job && queue.length) {
    const i = queue.findIndex((j) => j.urgent);
    // Nur Vorab-Aufträge übrig und gerade wird getippt bzw. die Tastatur bewegt sich: später, im Leerlauf.
    if (i < 0) {
      const left = quietLeft();
      if (left > 0) {
        pumpWhenQuiet(left);
        return;
      }
    }
    const next = queue.splice(i >= 0 ? i : 0, 1)[0] as Job;
    if (next.wanted()) job = next;
    else drop(next, new StaleError());
  }
  if (!job) return;
  const mine: Running = { job, since: Date.now(), engine: e, timer: undefined };
  running = mine;
  const lim = limitsOf(e);
  const arm = (ms: number): void => {
    const due = Date.now() + ms;
    mine.timer = setTimeout(() => {
      if (running !== mine) return;
      // Zu spät geweckt: der Hauptfaden war vom Rechnen belegt (Prozessor) – das ist Arbeit, kein Hänger.
      if (Date.now() - due > LATE_MS) {
        arm(GRACE_MS);
        return;
      }
      logWarn('voice:hang', new Error(`generate > ${lim.hang} ms (${e.device}${e.worker ? ', Hintergrund' : ''})`));
      void rebuild(e, 'hang');
    }, ms);
  };
  arm(lim.hang);
  const j = job;
  e.generate(j.text, j.voice, j.speed).then(
    (out) => {
      if (running !== mine) return;
      genErrors = 0;
      if (engine === e) engineOk += 1;
      if (j.store) {
        cachePut(j.key, out);
        const sk = clipStoreKey(e.version, j.voice, j.speed, j.text);
        void writeClip(sk, out);
      }
      finish(mine);
      j.resolve(out);
    },
    (err: unknown) => {
      if (running !== mine) return;
      finish(mine);
      j.reject(err instanceof Error ? err : new Error(String(err)));
      onGenError(e, err);
    },
  );
}

function finish(mine: Running): void {
  clearTimeout(mine.timer);
  if (pending.get(mine.job.key) === mine.job) pending.delete(mine.job.key);
  if (running === mine) running = null;
  pump();
}

/** Fehler beim Rechnen: Grafikchip weg → neu laden; sonst erst beim zweiten Fehler in Folge (und höchstens alle 2 Minuten). */
let genErrors = 0;
function onGenError(e: Engine, err: unknown): void {
  logWarn('voice:generate', err);
  genErrors += 1;
  if (e.lost() || genErrors >= 2) void rebuild(e, e.lost() ? 'gpu lost' : 'errors');
}

/** Wartet höchstens `ms` auf ein Ergebnis; danach `null` (der Auftrag rechnet weiter und landet in Gedächtnis und Vorrat). */
function within<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((res, rej) => {
    const due = Date.now() + ms;
    let t = setTimeout(
      () => {
        // Zu spät geweckt (Hauptfaden vom Rechnen belegt): dem gerade fertig gewordenen Satz noch kurz Vorrang geben.
        if (Date.now() - due > LATE_MS) t = setTimeout(() => res(null), GRACE_MS);
        else res(null);
      },
      Math.max(0, ms),
    );
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

/**
 * Wartet auf die Maschine, während sie lädt. `null` = sie kommt nicht (gescheitert, aufgegeben) oder es ist das allererste Herunterladen
 * (dann lieber diesmal die Gerätestimme als eine halbe Minute Stille); `'slow'` = Wartezeit vorbei.
 */
function awaitEngine(deadline: number): Promise<Engine | null | 'slow'> {
  if (engine) return Promise.resolve(engine);
  const p = loadNeuralVoice();
  if (!knownVoiceVersion()) return Promise.resolve(null);
  return new Promise((res) => {
    let settled = false;
    const end = (v: Engine | null | 'slow'): void => {
      if (settled) return;
      settled = true;
      clearTimeout(t);
      unsub();
      res(v);
    };
    // Das Paket liegt doch nicht im Speicher (vom Browser geräumt): es wird heruntergeladen → diesmal die Gerätestimme.
    const unsub = useNeuralVoice.subscribe((s) => {
      if (s.phase === 'download') end(null);
    });
    const t = setTimeout(() => end('slow'), Math.max(0, deadline - Date.now()));
    void p.then((e) => end(e));
  });
}

type Got = Clip | 'unavailable' | 'slow' | 'stopped';

/**
 * Holt einen Satz zum Abspielen: Gedächtnis → Tonvorrat (sofort) → rechnen (sichtbar warten, bis `wait`). Nie die Gerätestimme, nur weil
 * es dauert: `unavailable` nur, wenn die neue Stimme hier gar nicht läuft oder genau dieser Satz wiederholt nicht gerechnet werden kann.
 */
async function obtain(text: string, voice: string, speed: number, alive: () => boolean, onWait?: (w: boolean) => void): Promise<Got> {
  const mk = clipKey(text, voice, speed);
  const hit = cacheGet(mk);
  if (hit) {
    noteClipUse(true);
    return hit;
  }
  let sk = storeKeyOf(text, voice, speed);
  if (sk) {
    await openClipStore();
    sk = storeKeyOf(text, voice, speed);
    if (sk && clipStored(sk)) {
      const c = await readClip(sk);
      if (c) {
        cachePut(mk, c);
        noteClipUse(true);
        return c;
      }
    }
  }
  if (!alive()) return 'stopped';
  const t0 = Date.now();
  let deadline = t0 + (engine ? limitsOf(engine).wait : WAIT_LOADING_MS);
  let errors = 0;
  onWait?.(true);
  try {
    for (;;) {
      if (!alive()) return 'stopped';
      let e = engine;
      if (!e) {
        if (gaveUp || !supported()) return 'unavailable';
        const got = await awaitEngine(deadline);
        if (got === 'slow') return 'slow';
        if (!got) return 'unavailable';
        e = got;
        // Frisch geladen: jetzt gilt die Wartezeit dieser Maschine (ab jetzt).
        deadline = Math.max(deadline, Date.now() + limitsOf(e).wait);
      }
      try {
        const out = await within(synth(text, voice, speed, true, alive), deadline - Date.now());
        if (!out) return 'slow';
        noteClipUse(false);
        return out;
      } catch (err) {
        if (!alive()) return 'stopped';
        if (Date.now() >= deadline) return 'slow';
        // Maschine wurde neu aufgebaut (Hänger, Grafikchip weg): auf die neue warten und denselben Satz noch einmal.
        if (err instanceof StaleError) continue;
        errors += 1;
        if (errors >= 2) return 'unavailable';
      }
    }
  } finally {
    onWait?.(false);
  }
}

/**
 * Spricht die Stücke nacheinander; das nächste Stück wird schon geholt, während das aktuelle läuft.
 * Liefert `done`, `stopped`, `slow` (still: diesmal nicht rechtzeitig fertig) oder `unavailable` (die neue Stimme läuft hier nicht →
 * der Aufrufer nimmt ab dem nächsten Stück die Gerätestimme).
 */
export async function speakNeural(run: NeuralRun): Promise<NeuralOutcome> {
  // Zuerst (noch im Tippen, vor jedem await) die Tonausgabe sichern.
  if (!supported() || gaveUp) return 'unavailable';
  const c = ensureCtx();
  if (!c) return 'unavailable';
  const e = engine;
  // Grafikchip verloren (iPhone nach dem Minimieren): neu laden (aus dem Speicher); der Satz wartet darauf bzw. kommt aus dem Vorrat.
  if (e?.lost()) void rebuild(e, 'gpu lost');
  const get = (i: number) => obtain(run.chunks[i] as string, run.voice, run.rate, run.alive, run.onWait);
  let next = get(run.from);
  if (c.state !== 'running') {
    await Promise.race([c.resume().catch((err: unknown) => logWarn('voice:resume', err)), new Promise((r) => setTimeout(r, 800))]);
    // Tonausgabe springt nicht an (iPhone nach langer Pause): lieber gleich die Gerätestimme als Stille.
    if ((c.state as string) !== 'running') {
      logWarn('voice:ctx-state', new Error(`audio ${c.state}`));
      return 'unavailable';
    }
  }
  try {
    for (let i = run.from; i < run.chunks.length; i++) {
      const out = await next;
      if (!run.alive() || out === 'stopped') return 'stopped';
      if (out === 'unavailable') return 'unavailable';
      if (out === 'slow') {
        logInfo('voice:slow', `Satz ${i + 1} noch nicht fertig – diesmal still, er kommt in den Vorrat`);
        return 'slow';
      }
      if (i + 1 < run.chunks.length) next = get(i + 1);
      run.onChunk(i);
      const buf = c.createBuffer(1, out.audio.length, out.rate);
      buf.copyToChannel(out.audio as Float32Array<ArrayBuffer>, 0);
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      const ended = new Promise<void>((res) => {
        src.onended = () => res();
      });
      stopNeural();
      playing = src;
      src.start(0);
      await ended;
      if (playing === src) playing = null;
      if (!run.alive()) return 'stopped';
    }
    return 'done';
  } catch (err) {
    if (!run.alive()) return 'stopped';
    logWarn('voice:speak', err);
    // Abspielen selbst gescheitert (Tonausgabe): diese Ausgabe spricht sofort die Gerätestimme weiter (nie Stille).
    return 'unavailable';
  }
}

// ---------------------------------------------------------------- Vorab-Plan (Stimme 2.0)
// In Tipp-Pausen rechnet die neue Stimme die Sätze vor, die gleich bzw. heute sicher drankommen: zuerst die sichtbare Karte und die nächsten
// Karten (`now`/`next`), dann der Rest der Runde (`later`). Eins nach dem anderen, mit kurzer Pause dazwischen und einer längeren nach jeder Portion, und
// höchstens so viele je Sitzung – das Gerät soll nicht heiß laufen. Was schon im Gedächtnis oder im Vorrat ist, wird übersprungen.
// Im Hauptfaden auf dem Prozessor gibt es kein Vorab-Rechnen (es hielte die App an); im Hauptfaden auf dem Grafikchip nur `now` (wie bisher).

/** Vorrang im Vorab-Plan: `now` = sichtbare Karte, `next` = die nächsten Karten, `later` = Rest der Runde. */
export type PlanPrio = 'now' | 'next' | 'later';
const PRIO: Record<PlanPrio, number> = { now: 0, next: 1, later: 2 };
type PlanItem = { key: string; text: string; voice: string; speed: number; prio: number };
const plan: PlanItem[] = [];
/** Länge des Plans höchstens (älteste Rest-Einträge fallen weg). */
const PLAN_MAX = 400;
/** Gerechnete Sätze je Sitzung höchstens. */
export const PLAN_SESSION_MAX: Record<'gpu' | 'cpu', number> = { gpu: 400, cpu: 150 };
/** Pause zwischen zwei Vorab-Sätzen und nach jeder Portion. */
const PLAN_GAP_MS: Record<'gpu' | 'cpu', number> = { gpu: 250, cpu: 1_200 };
export const PLAN_PORTION = 15;
export const PLAN_REST_MS = 20_000;
let planTimer: ReturnType<typeof setTimeout> | null = null;
let planBusy = false;
let planDone = 0;
let planSkipped = 0;
let planLogAt = 0;
let planCapLogged = false;

const planKind = (e: Engine): 'gpu' | 'cpu' => (e.device === 'wasm' ? 'cpu' : 'gpu');
/** Darf diese Maschine vorab rechnen, und wenn ja, auch über die sichtbare und die nächste Karte hinaus? */
const planScope = (e: Engine): 'none' | 'near' | 'all' => (e.worker ? 'all' : e.device === 'wasm' ? 'none' : 'near');

const haveClip = (it: { key: string; text: string; voice: string; speed: number }): boolean => {
  if (cache.has(it.key) || pending.has(it.key)) return true;
  const sk = storeKeyOf(it.text, it.voice, it.speed);
  return sk !== null && clipStored(sk);
};

/**
 * Nimmt der Vorab-Plan Sätze dieses Vorrangs an? (Vor dem Laden: ja, solange die neue Stimme hier grundsätzlich läuft.) So rechnen Aufrufer
 * die Texte vieler Karten nur, wenn sie auch gebraucht werden.
 */
export function planAccepts(prio: PlanPrio): boolean {
  if (!supported() || gaveUp) return false;
  const e = engine;
  if (!e) return useNeuralVoice.getState().status !== 'failed';
  const scope = planScope(e);
  return scope === 'all' || (scope === 'near' && PRIO[prio] <= PRIO.now);
}

/**
 * Sätze zum Vorab-Rechnen vormerken. `now` kommt ganz nach vorn (die zuletzt gezeigte Karte zuerst), `next`/`later` reihen sich hinter alles
 * mit gleichem oder höherem Vorrang ein. Wirkt auch, bevor die Stimme bereit ist: der Plan startet, sobald sie es ist.
 */
export function planNeural(chunks: readonly string[], voice: string, speed: number, prio: PlanPrio = 'later'): void {
  if (!planAccepts(prio)) return;
  const p = PRIO[prio];
  const items: PlanItem[] = [];
  for (const raw of chunks) {
    const text = raw.trim();
    if (!text || items.some((x) => x.text === text)) continue;
    const key = clipKey(text, voice, speed);
    const at = plan.findIndex((x) => x.key === key);
    if (at >= 0) {
      if ((plan[at] as PlanItem).prio <= p && p !== 0) continue;
      plan.splice(at, 1);
    }
    items.push({ key, text, voice, speed, prio: p });
  }
  if (!items.length) return;
  const at = p === 0 ? 0 : (() => {
    const i = plan.findIndex((x) => x.prio > p);
    return i < 0 ? plan.length : i;
  })();
  plan.splice(at, 0, ...items);
  if (plan.length > PLAN_MAX) plan.length = PLAN_MAX;
  kickPlan(p === 0 ? 350 : 800);
}

function kickPlan(ms: number): void {
  if (planTimer || planBusy) return;
  planTimer = setTimeout(() => {
    planTimer = null;
    whenIdle(() => void planStep());
  }, ms);
}

async function planStep(): Promise<void> {
  if (planBusy) return;
  const e = engine;
  if (!e || warming) {
    if (e) kickPlan(500);
    return;
  }
  const scope = planScope(e);
  if (scope === 'none') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const left = quietLeft();
  if (left > 0) {
    kickPlan(left + 30);
    return;
  }
  if (running?.job.urgent || queue.some((j) => j.urgent)) {
    kickPlan(300);
    return;
  }
  const kind = planKind(e);
  if (planDone >= PLAN_SESSION_MAX[kind]) {
    if (!planCapLogged) logInfo('voice:prefetch', `Obergrenze dieser Sitzung erreicht (${planDone} Sätze vorab gerechnet)`);
    planCapLogged = true;
    plan.length = 0;
    return;
  }
  let item: PlanItem | undefined;
  while (plan.length) {
    const it = plan.shift() as PlanItem;
    // Hauptfaden (Grafikchip): wie bisher nur die sichtbare Karte und die nächste – mehr kostete beim Tippen Zeit im Hauptfaden.
    if (scope === 'near' && it.prio > PRIO.now) continue;
    if (haveClip(it)) {
      planSkipped += 1;
      continue;
    }
    item = it;
    break;
  }
  if (!item) {
    planLog();
    return;
  }
  planBusy = true;
  try {
    await synth(item.text, item.voice, item.speed, false, () => true);
    planDone += 1;
  } catch (err) {
    if (!(err instanceof StaleError)) logWarn('voice:prefetch', err);
  } finally {
    planBusy = false;
  }
  kickPlan(planDone % PLAN_PORTION === 0 ? PLAN_REST_MS : PLAN_GAP_MS[kind]);
}

/** Knappes Protokoll: höchstens alle 10 Minuten eine Zeile, wenn der Plan leer gelaufen ist. */
function planLog(): void {
  if (!planDone || Date.now() - planLogAt < 600_000) return;
  planLogAt = Date.now();
  logInfo('voice:prefetch', `${planDone} Sätze vorab gerechnet, ${planSkipped} schon im Vorrat`);
}

/**
 * Den Text der sichtbaren Karte schon einmal rechnen (vorn im Vorab-Plan). Nicht auf dem Prozessor im Hauptfaden: der hielte die App
 * sekundenlang an, während Emrah tippt – dort wird erst beim Antippen gerechnet.
 */
export function prefetchNeural(chunks: readonly string[], voice: string, speed: number): void {
  planNeural(chunks.slice(0, 2), voice, speed, 'now');
}

// ---------------------------------------------------------------- Neu laden, aufgeben

let lastRebuild = 0;
const REBUILD_GAP_MS = 120_000;
/** Neuaufbauten wegen Hängern/Fehlern in dieser Sitzung: höchstens so viele in diesem Zeitraum, dann aufhören (keine Endlosschleife). */
let troubleAt: number[] = [];
const TROUBLE_WINDOW_MS = 10 * 60_000;
const TROUBLE_MAX = 3;

/** Maschine abhängen: laufende und wartende Aufträge enden still (wartende Tipps warten auf die neue Maschine). */
function detach(): void {
  engine = null;
  loading = null;
  genErrors = 0;
  engineOk = 0;
  const r = running;
  running = null;
  if (r) {
    clearTimeout(r.timer);
    r.job.reject(new StaleError());
  }
  for (const j of [...queue]) drop(j, new StaleError());
  pending.clear();
}

/**
 * Alte Maschine erst vollständig freigeben, dann neu laden (aus dem Browser-Speicher). Nie zwei auf einmal: sonst liegt das
 * Modell doppelt im Speicher und das Gerät ruckelt. Wegen Fehlern höchstens alle 2 Minuten; bei Grafikchip-Verlust immer.
 * Hängt der Grafikchip (oder scheitert er), bevor er je geantwortet hat, oder zum zweiten Mal: ab dann der Prozessor (gemerkt).
 * Hängt auch der Prozessor oder hängt es zu oft: aufhören, es spricht die Gerätestimme (Safari am Mac 23.11.2026: Endlosschleife).
 * Im Hintergrund-Rechner beendet das Freigeben den Worker – auch einen, der in einem Hänger feststeckt.
 */
async function rebuild(old: Engine, why: 'gpu lost' | 'hang' | 'errors' | 'check'): Promise<Engine | null> {
  if (engine !== old) return loading ?? engine;
  if (why === 'errors' && Date.now() - lastRebuild < REBUILD_GAP_MS) return engine;
  if (why === 'hang' || why === 'errors') {
    const now = Date.now();
    troubleAt = troubleAt.filter((t) => now - t < TROUBLE_WINDOW_MS);
    const repeated = troubleAt.length > 0;
    troubleAt.push(now);
    if ((old.device === 'wasm' && why === 'hang') || troubleAt.length >= TROUBLE_MAX) return giveUp(old, why);
    if (old.device === 'webgpu' && (engineOk === 0 || repeated)) {
      forceWasm = true;
      local.set(VOICE_DEVICE_KEY, 'wasm');
      logInfo('voice:device', `Grafikchip ${why === 'hang' ? 'hängt' : 'scheitert'} – die neue Stimme rechnet ab jetzt auf dem Prozessor`);
    }
  }
  lastRebuild = Date.now();
  detach();
  logInfo('voice:rebuild', `neue Stimme wird neu geladen (${why})`);
  useNeuralVoice.setState({ status: 'loading', pct: 0, phase: null });
  // Während des Freigebens gilt die Stimme schon als „lädt“: kein zweites Laden von anderer Stelle.
  const run: Promise<Engine | null> = withTimeout(old.dispose(), 3_000).then(() => {
    if (loading === run) loading = null;
    return loadNeuralVoice();
  });
  loading = run;
  return run;
}

/** Aufhören: Maschine freigeben, Status „failed“ (Einstellungen zeigen den Hinweis), in dieser Sitzung kein neues Laden mehr. */
function giveUp(old: Engine, why: 'hang' | 'errors'): null {
  gaveUp = true;
  detach();
  plan.length = 0;
  logWarn('voice:give-up', new Error(`${why} on ${old.device} – Gerätestimme für diese Sitzung`));
  useNeuralVoice.setState({ status: 'failed', device: null, worker: false, pct: 0, phase: null });
  void withTimeout(old.dispose(), 3_000);
  return null;
}

/** Wartet höchstens `ms` (Freigeben darf das Neuladen nicht ewig aufhalten). */
function withTimeout(p: Promise<unknown>, ms: number): Promise<void> {
  return new Promise<void>((res) => {
    const t = setTimeout(res, ms);
    p.then(
      () => {
        clearTimeout(t);
        res();
      },
      (err: unknown) => {
        clearTimeout(t);
        logWarn('voice:dispose', err);
        res();
      },
    );
  });
}

/** Nur für Tests: Modulzustand verwerfen. */
export function resetNeural(): void {
  stopNeural();
  engine = null;
  loading = null;
  failures = 0;
  lastTry = 0;
  warming = false;
  cache.clear();
  cacheSamples = 0;
  queue.length = 0;
  pending.clear();
  running = null;
  genErrors = 0;
  engineOk = 0;
  lastRebuild = 0;
  troubleAt = [];
  forceWasm = false;
  noWorker = false;
  gaveUp = false;
  plan.length = 0;
  if (planTimer) clearTimeout(planTimer);
  planTimer = null;
  planBusy = false;
  planDone = 0;
  planSkipped = 0;
  planLogAt = 0;
  planCapLogged = false;
  resetInputQuiet();
  if (quietTimer) clearTimeout(quietTimer);
  quietTimer = null;
  useNeuralVoice.setState({ status: 'off', pct: 0, phase: null, device: null, worker: false, fromCache: false, loadMs: null });
}

/** Nur für Tests: Stand des Vorab-Plans. */
export const planState = (): { queued: number; done: number; skipped: number } => ({ queued: plan.length, done: planDone, skipped: planSkipped });
