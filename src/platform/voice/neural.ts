import { create } from 'zustand';
import { logInfo, logWarn } from '../diagnostics';
import type { Engine } from './engine';

// Neue Stimme (Kokoro, Emrahs Auftrag 09.11.2026): ersetzt die Gerätestimme beim Vorlesen. Dieses Modul bleibt klein
// und liegt im Haupt-Bündel; Modell und Bibliothek kommen erst mit `engine.ts` (eigenes, nachgeladenes Stück).
// Ablauf: kurz nach dem Start wird im Hintergrund geladen (beim ersten Mal ~210 MB, danach aus dem Browser-Speicher).
// Solange sie lädt, wartet ein Antippen auf sie; schlägt das Laden fehl, spricht wie bisher die Gerätestimme.

export type NeuralStatus = 'off' | 'loading' | 'ready' | 'failed';

type NeuralState = { status: NeuralStatus; pct: number; phase: 'download' | 'cache' | 'start' | null; device: 'webgpu' | 'wasm' | null; fromCache: boolean; loadMs: number | null };

export const useNeuralVoice = create<NeuralState>(() => ({ status: 'off', pct: 0, phase: null, device: null, fromCache: false, loadMs: null }));

/** Sprecher der neuen Stimme; Standard ist „Heart“ (US, Frau). */
export const NEURAL_VOICES = [
  { id: 'af_heart', name: 'Heart' },
  { id: 'am_michael', name: 'Michael' },
] as const;
export const isNeuralVoice = (name: string | null | undefined): boolean => NEURAL_VOICES.some((v) => v.id === name);

let engine: Engine | null = null;
let loading: Promise<Engine | null> | null = null;
let ctx: AudioContext | null = null;

/** Läuft die App unter einem Testwerkzeug (Playwright)? Dann wird die neue Stimme nie geladen. */
function automated(): boolean {
  return typeof navigator !== 'undefined' && (navigator as Navigator & { webdriver?: boolean }).webdriver === true;
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

/** Startet das Laden (einmal). Liefert die Maschine oder `null`, wenn die neue Stimme hier (noch) nicht läuft. */
export function loadNeuralVoice(): Promise<Engine | null> {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  if (!supported()) return Promise.resolve(null);
  lastTry = Date.now();
  useNeuralVoice.setState({ status: 'loading', pct: 0, phase: null });
  const run: Promise<Engine | null> = import('./engine')
    .then((m) => m.loadEngine((p) => useNeuralVoice.setState({ phase: p.phase, pct: p.pct })))
    .then((e) => {
      engine = e;
      failures = 0;
      useNeuralVoice.setState({ status: 'ready', device: e.device, fromCache: e.fromCache, loadMs: e.loadMs, pct: 100 });
      logInfo('voice:ready', `${e.device}, ${e.fromCache ? 'aus dem Speicher' : 'heruntergeladen'}, ${(e.loadMs / 1000).toFixed(1)} s`);
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
  setTimeout(() => void loadNeuralVoice(), delayMs);
}

/**
 * Soll `speak` die neue Stimme nehmen? Nur, wenn sie fertig geladen ist (Emrah 10.11.2026: bis dahin sofort die Gerätestimme,
 * danach automatisch die neue). Eine abgebrochene Ladung wird beim nächsten Vorlesen wieder angestoßen.
 */
export function neuralWanted(): boolean {
  const s = useNeuralVoice.getState().status;
  // Nach dem Hintergrund wird die Stimme erst kurz geprüft (`checkAfterReturn`); so lange spricht die Gerätestimme.
  if (s === 'ready') return !checking && !busyTooLong();
  // Alle geplanten Versuche vorbei: höchstens alle 5 Minuten beim Vorlesen einen neuen anstoßen.
  if (s === 'failed' && !loading && failures > RETRY_MS.length && Date.now() - lastTry > 300_000) void loadNeuralVoice();
  return false;
}

/** Die App war im Hintergrund (iPhone: App minimiert): die Tonausgabe danach im nächsten Tipp frisch aufbauen. */
let wasHidden = false;
let hiddenAt = 0;
/** Läuft gerade die Prüfung nach dem Zurückkehren? Dann spricht die Gerätestimme (Emrah 10.11.2026: „nach einer Zeit gar keine Sprachausgabe“). */
let checking = false;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      wasHidden = true;
      hiddenAt = Date.now();
      return;
    }
    // Zurück in der App und die Stimme fehlt noch: gleich neu versuchen.
    if (!engine && !loading && useNeuralVoice.getState().status === 'failed') void loadNeuralVoice();
    // Länger weg (iPhone räumt dann oft Grafikchip und Speicher): kurz prüfen, ob die Stimme noch rechnet.
    else if (engine && Date.now() - hiddenAt > 20_000) void checkAfterReturn(engine);
  });
}

/** Ein kurzes Wort rechnen (höchstens 8 s); bei Fehler oder Grafikchip-Verlust neu laden. Bis dahin spricht die Gerätestimme. */
async function checkAfterReturn(e: Engine): Promise<void> {
  if (checking) return;
  checking = true;
  try {
    if (e.lost()) {
      await rebuild(e, 'gpu lost');
      return;
    }
    const ok = await within(synth('Hi.', 'af_heart', 1, true, () => true), 8_000);
    // Noch keine Antwort: der Wächter (`HANG_MS`) lädt neu, falls der Grafikchip wirklich hängt.
    logInfo('voice:check', ok ? 'Stimme nach dem Zurückkehren in Ordnung' : 'Stimme antwortet langsam');
  } catch (err) {
    logWarn('voice:check', err);
    if (!(err instanceof StaleError)) await rebuild(e, 'check');
  } finally {
    checking = false;
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
};

// ---------------------------------------------------------------- Rechnen: eins nach dem anderen, mit Gedächtnis
// Emrah 10.11.2026 („auf einmal ging es nicht mehr und das Handy wurde laggy … es dauert immer so eine Sekunde“):
// - Der Grafikchip rechnet immer nur EINEN Satz; neue Tipps überholen das Vorab-Rechnen, veraltete Aufträge fallen weg.
// - Fertig gerechnete Sätze bleiben im Gedächtnis (zuletzt benutzte zuerst): nochmal anhören kommt sofort.
// - Der Satz der sichtbaren Karte wird vorab gerechnet (`prefetchNeural`), der Tipp spielt dann ohne Wartezeit.
// - Dauert ein Satz zu lange, spricht diesmal die Gerätestimme; die neue Stimme wird dafür NICHT neu geladen
//   (früher: jedes Zeitlimit lud ~190 MB nach, während die alte noch im Speicher lag → Ruckeln, dann Stille).

export type Clip = { audio: Float32Array; rate: number };

/** Gedächtnis: höchstens so viele Abtastwerte (≈ 16 MB) und Einträge. */
const CACHE_SAMPLES = 4_000_000;
const CACHE_MAX = 60;
const cache = new Map<string, Clip>();
let cacheSamples = 0;
const clipKey = (text: string, voice: string, speed: number) => `${voice}|${speed.toFixed(2)}|${text}`;

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

type Job = { key: string; text: string; voice: string; speed: number; urgent: boolean; wanted: () => boolean; promise: Promise<Clip>; resolve: (c: Clip) => void; reject: (e: Error) => void };

const queue: Job[] = [];
const pending = new Map<string, Job>();
/** Der Auftrag, den der Grafikchip gerade rechnet. */
let running: { job: Job; since: number; engine: Engine } | null = null;
/** Ab hier gilt ein Satz als hängend (Grafikchip antwortet nicht mehr): dann, und nur dann, neu laden. */
const HANG_MS = 20_000;
/** So lange wartet ein Tipp auf den ersten Satz, sonst spricht diesmal die Gerätestimme. */
const FIRST_WAIT_MS = 4_000;
/** So lange wartet der nächste Satz nach dem Ende des vorigen. */
const NEXT_WAIT_MS = 6_000;
/** Vorab gerechnet wird höchstens so viel. */
const PREFETCH_MAX = 6;

class StaleError extends Error {
  constructor() {
    super('voice: not needed any more');
  }
}

function synth(text: string, voice: string, speed: number, urgent: boolean, wanted: () => boolean): Promise<Clip> {
  const key = clipKey(text, voice, speed);
  const hit = cacheGet(key);
  if (hit) return Promise.resolve(hit);
  const known = pending.get(key);
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
  const job: Job = { key, text, voice, speed, urgent, wanted, promise, resolve, reject };
  pending.set(key, job);
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

function pump(): void {
  const e = engine;
  if (running || !e) return;
  let job: Job | undefined;
  while (!job && queue.length) {
    const i = queue.findIndex((j) => j.urgent);
    const next = queue.splice(i >= 0 ? i : 0, 1)[0] as Job;
    if (next.wanted()) job = next;
    else drop(next, new StaleError());
  }
  if (!job) return;
  const mine = { job, since: Date.now(), engine: e };
  running = mine;
  const hang = setTimeout(() => {
    if (running !== mine) return;
    logWarn('voice:hang', new Error(`generate > ${HANG_MS} ms`));
    void rebuild(e, 'hang');
  }, HANG_MS);
  const j = job;
  e.generate(j.text, j.voice, j.speed).then(
    (out) => {
      if (running !== mine) return;
      genErrors = 0;
      cachePut(j.key, out);
      finish(mine, hang);
      j.resolve(out);
    },
    (err: unknown) => {
      if (running !== mine) return;
      finish(mine, hang);
      j.reject(err instanceof Error ? err : new Error(String(err)));
      onGenError(e, err);
    },
  );
}

function finish(mine: NonNullable<typeof running>, hang: ReturnType<typeof setTimeout>): void {
  clearTimeout(hang);
  if (pending.get(mine.job.key) === mine.job) pending.delete(mine.job.key);
  if (running === mine) running = null;
  pump();
}

/** Rechnet der Grafikchip schon zu lange an einem Satz? Dann spricht sofort die Gerätestimme statt zu warten. */
const busyTooLong = (): boolean => running !== null && !cache.has(running.job.key) && Date.now() - running.since > FIRST_WAIT_MS;

/** Fehler beim Rechnen: Grafikchip weg → neu laden; sonst erst beim zweiten Fehler in Folge (und höchstens alle 2 Minuten). */
let genErrors = 0;
function onGenError(e: Engine, err: unknown): void {
  logWarn('voice:generate', err);
  genErrors += 1;
  if (e.lost() || genErrors >= 2) void rebuild(e, e.lost() ? 'gpu lost' : 'errors');
}

/**
 * Den Satz der sichtbaren Karte schon einmal rechnen (nur, wenn die neue Stimme bereit ist und die App sichtbar).
 * Kurz verzögert, damit der Kartenwechsel zuerst flüssig abläuft.
 */
export function prefetchNeural(chunks: readonly string[], voice: string, speed: number): void {
  if (!engine || checking || chunks.length === 0) return;
  setTimeout(() => {
    if (!engine || checking || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
    for (const c of chunks.slice(0, 2)) void synth(c, voice, speed, false, () => true).catch(() => undefined);
  }, 350);
}

/** Wartet höchstens `ms` auf einen Satz; danach `null` (der Auftrag rechnet weiter und landet im Gedächtnis). */
function within(p: Promise<Clip>, ms: number): Promise<Clip | null> {
  return new Promise<Clip | null>((res, rej) => {
    const t = setTimeout(() => res(null), ms);
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
 * Spricht die Stücke nacheinander; das nächste Stück wird schon erzeugt, während das aktuelle läuft.
 * Liefert `done`, `stopped` oder `unavailable` (diesmal nicht möglich → der Aufrufer nimmt ab dem nächsten Stück die Gerätestimme).
 */
export async function speakNeural(run: NeuralRun): Promise<'done' | 'stopped' | 'unavailable' | 'error'> {
  // Zuerst (noch im Tippen, vor jedem await) die Tonausgabe sichern.
  if (!supported()) return 'unavailable';
  const c = ensureCtx();
  if (!c) return 'unavailable';
  const e = engine;
  if (!e) return 'unavailable';
  // Grafikchip verloren (iPhone nach dem Minimieren): diesmal die Gerätestimme, die neue lädt im Hintergrund neu (aus dem Speicher).
  if (e.lost()) {
    void rebuild(e, 'gpu lost');
    return 'unavailable';
  }
  const gen = (i: number) => synth(run.chunks[i] as string, run.voice, run.rate, true, run.alive);
  let next = gen(run.from);
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
      const out = await within(next, i === run.from ? FIRST_WAIT_MS : NEXT_WAIT_MS);
      if (!run.alive()) return 'stopped';
      if (!out) {
        logInfo('voice:slow', `Satz ${i + 1} dauert zu lange – diesmal die Gerätestimme`);
        return 'unavailable';
      }
      if (i + 1 < run.chunks.length) next = gen(i + 1);
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
    // Diese Ausgabe spricht sofort die Gerätestimme weiter (nie Stille).
    return 'unavailable';
  }
}

let lastRebuild = 0;
const REBUILD_GAP_MS = 120_000;

/**
 * Alte Maschine erst vollständig freigeben, dann neu laden (aus dem Browser-Speicher). Nie zwei auf einmal: sonst liegt das
 * Modell doppelt im Speicher und das Gerät ruckelt. Wegen Fehlern höchstens alle 2 Minuten; bei Grafikchip-Verlust immer.
 */
async function rebuild(old: Engine, why: 'gpu lost' | 'hang' | 'errors' | 'check'): Promise<Engine | null> {
  if (engine !== old) return loading ?? engine;
  if (why === 'errors' && Date.now() - lastRebuild < REBUILD_GAP_MS) return engine;
  lastRebuild = Date.now();
  engine = null;
  loading = null;
  genErrors = 0;
  const r = running;
  running = null;
  if (r) r.job.reject(new StaleError());
  for (const j of [...queue]) drop(j, new StaleError());
  pending.clear();
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
  checking = false;
  cache.clear();
  cacheSamples = 0;
  queue.length = 0;
  pending.clear();
  running = null;
  genErrors = 0;
  lastRebuild = 0;
  useNeuralVoice.setState({ status: 'off', pct: 0, phase: null, device: null, fromCache: false, loadMs: null });
}
