import { create } from 'zustand';
import { logWarn } from '../diagnostics';
import type { Engine } from './engine';

// Neue Stimme (Kokoro, Emrahs Auftrag 09.11.2026): ersetzt die Gerätestimme beim Vorlesen. Dieses Modul bleibt klein
// und liegt im Haupt-Bündel; Modell und Bibliothek kommen erst mit `engine.ts` (eigenes, nachgeladenes Stück).
// Ablauf: kurz nach dem Start wird im Hintergrund geladen (beim ersten Mal ~210 MB, danach aus dem Browser-Speicher).
// Solange sie lädt, wartet ein Antippen auf sie; schlägt das Laden fehl, spricht wie bisher die Gerätestimme.

export type NeuralStatus = 'off' | 'loading' | 'ready' | 'failed';

type NeuralState = { status: NeuralStatus; pct: number; phase: 'download' | 'cache' | 'start' | null; device: 'webgpu' | 'wasm' | null; fromCache: boolean };

export const useNeuralVoice = create<NeuralState>(() => ({ status: 'off', pct: 0, phase: null, device: null, fromCache: false }));

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

/** Startet das Laden (einmal). Liefert die Maschine oder `null`, wenn die neue Stimme hier nicht läuft. */
export function loadNeuralVoice(): Promise<Engine | null> {
  if (engine) return Promise.resolve(engine);
  if (loading) return loading;
  if (!supported()) return Promise.resolve(null);
  useNeuralVoice.setState({ status: 'loading', pct: 0, phase: null });
  loading = import('./engine')
    .then((m) => m.loadEngine((p) => useNeuralVoice.setState({ phase: p.phase, pct: p.pct })))
    .then((e) => {
      engine = e;
      useNeuralVoice.setState({ status: 'ready', device: e.device, fromCache: e.fromCache, pct: 100 });
      return e;
    })
    .catch((err: unknown) => {
      logWarn('voice:load', err);
      useNeuralVoice.setState({ status: 'failed' });
      return null;
    });
  return loading;
}

/** Nach dem Start im Hintergrund laden, ohne den ersten Bildschirm aufzuhalten. */
export function scheduleNeuralVoice(delayMs = 1500): void {
  if (!supported() || loading || engine) return;
  setTimeout(() => void loadNeuralVoice(), delayMs);
}

/** Soll `speak` die neue Stimme nehmen (bereit oder gerade beim Laden)? */
export function neuralWanted(): boolean {
  const s = useNeuralVoice.getState().status;
  return s === 'ready' || s === 'loading';
}

function audioCtx(): AudioContext | null {
  if (ctx) return ctx;
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const C = w.AudioContext ?? w.webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch (err) {
    logWarn('voice:audioctx', err);
    ctx = null;
  }
  return ctx;
}

/**
 * Im Tippen aufrufen: schaltet die Wiedergabe am iPhone frei (stummer, winziger Ton). Spielt auch bei
 * Stummschalter, wie die Gerätestimme (Safari: `navigator.audioSession`).
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
  const c = audioCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch((err: unknown) => logWarn('voice:resume', err));
  try {
    const b = c.createBuffer(1, 1, 22050);
    const s = c.createBufferSource();
    s.buffer = b;
    s.connect(c.destination);
    s.start(0);
  } catch (err) {
    logWarn('voice:unlock', err);
  }
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

/**
 * Spricht die Stücke nacheinander; das nächste Stück wird schon erzeugt, während das aktuelle läuft.
 * Liefert `done`, `stopped` oder `unavailable` (Maschine fehlt → der Aufrufer nimmt die Gerätestimme).
 */
export async function speakNeural(run: NeuralRun): Promise<'done' | 'stopped' | 'unavailable' | 'error'> {
  const e = engine ?? (await loadNeuralVoice());
  if (!run.alive()) return 'stopped';
  if (!e) return 'unavailable';
  const c = audioCtx();
  if (!c) return 'unavailable';
  if (c.state === 'suspended') await c.resume().catch((err: unknown) => logWarn('voice:resume', err));
  const gen = (i: number) => e.generate(run.chunks[i] as string, run.voice, run.rate);
  try {
    let next = gen(run.from);
    for (let i = run.from; i < run.chunks.length; i++) {
      const out = await next;
      if (!run.alive()) return 'stopped';
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
    logWarn('voice:speak', err);
    return run.alive() ? 'error' : 'stopped';
  }
}

/** Nur für Tests: Modulzustand verwerfen. */
export function resetNeural(): void {
  stopNeural();
  engine = null;
  loading = null;
  useNeuralVoice.setState({ status: 'off', pct: 0, phase: null, device: null, fromCache: false });
}
