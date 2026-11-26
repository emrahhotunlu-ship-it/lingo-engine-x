// lx:voice-engine – Hauptfaden-Seite des Hintergrund-Rechners (Stimme 2.0). Nachgeladen wie `engine.ts`; nur Stücke mit dieser Kennung
// dürfen einen Worker starten (scripts/check-platform.mjs). Der Worker kommt aus einer eigenen Datei neben der App (gleiche Herkunft).
// Schlägt der Start fehl (Worker im Artefakt gesperrt, Modul-Worker nicht unterstützt, Fehler beim Laden), meldet `loadWorkerEngine` das
// mit einer Ablehnung – `neural.ts` rechnet dann wie bisher im Hauptfaden.
import { logInfo, logWarn, log } from '../diagnostics';
import type { Engine, EngineDevice, EngineProgress } from './engine';

type Out =
  | { t: 'probed'; id: number; gpu: boolean }
  | { t: 'ready'; id: number; device: EngineDevice; version: string; fromCache: boolean; loadMs: number }
  | { t: 'audio'; id: number; audio: Float32Array; rate: number }
  | { t: 'fail'; id: number; error: string }
  | { t: 'disposed'; id: number }
  | { t: 'progress'; phase: 'download' | 'cache' | 'start'; pct: number }
  | { t: 'lost' }
  | { t: 'log'; level?: 'error' | 'warn' | 'info'; scope: string; msg: string };

/** So lange darf der Hintergrund-Rechner höchstens bis zur ersten Antwort brauchen (Skript laden), sonst gilt er als nicht startbar. */
export const WORKER_BOOT_MS = 8_000;
/** Ganzes Laden (Paket aus dem Speicher, Modell starten); beim ersten Mal mit Herunterladen deutlich länger. */
export const WORKER_LOAD_MS = 10 * 60_000;

export type WorkerLike = {
  postMessage(m: unknown): void;
  terminate(): void;
  onmessage: ((ev: MessageEvent) => void) | null;
  onerror: ((ev: ErrorEvent | Event) => void) | null;
};

/** Name des Workers; trägt zugleich die Kennung ins gebaute Stück (scripts/check-platform.mjs erkennt das Stimmen-Stück daran). */
export const VOICE_WORKER_NAME = 'lx:voice-engine worker';

/** Startet den Worker (eigene Datei; Vite legt sie flach neben die App). Austauschbar für Tests. */
let makeWorker = (): WorkerLike => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: VOICE_WORKER_NAME }) as unknown as WorkerLike;

/** Nur für Tests. */
export function setWorkerFactory(fn: () => WorkerLike): void {
  makeWorker = fn;
}

type Waiter = { resolve: (m: Out) => void; reject: (e: Error) => void };

/** Der Hintergrund-Rechner hat keinen Grafikchip, der Hauptfaden aber schon: dann lieber dort auf dem Grafikchip (iPhone wie bisher). */
export class WorkerNoGpuError extends Error {
  constructor() {
    super('voice worker: kein Grafikchip im Hintergrund-Rechner');
    this.name = 'WorkerNoGpuError';
  }
}

export type WorkerEngineOptions = {
  device?: EngineDevice;
  base: string;
  /** Hat der Hauptfaden einen Grafikchip? Nur gefragt, wenn der Worker keinen hat und nicht ohnehin auf dem Prozessor gerechnet wird. */
  mainGpu?: () => Promise<boolean>;
};

export async function loadWorkerEngine(onProgress: EngineProgress, opts: WorkerEngineOptions): Promise<Engine> {
  const w = makeWorker();
  const waits = new Map<number, Waiter>();
  let seq = 0;
  let lost = false;
  let dead: Error | null = null;
  let heard = false;
  const failAll = (err: Error): void => {
    dead = err;
    for (const x of waits.values()) x.reject(err);
    waits.clear();
  };
  w.onmessage = (ev: MessageEvent) => {
    heard = true;
    const m = ev.data as Out;
    if (m.t === 'progress') return onProgress({ phase: m.phase, pct: m.pct });
    if (m.t === 'lost') {
      lost = true;
      logWarn('voice:gpu-lost', new Error('Grafikchip im Hintergrund-Rechner verloren'));
      return;
    }
    if (m.t === 'log') {
      log(m.level ?? 'info', m.scope, { message: m.msg }, 'worker');
      return;
    }
    const x = waits.get(m.id);
    if (!x) return;
    waits.delete(m.id);
    if (m.t === 'fail') x.reject(new Error(m.error));
    else x.resolve(m);
  };
  w.onerror = (ev: ErrorEvent | Event) => {
    const msg = (ev as ErrorEvent).message || 'worker error';
    // Ein Skriptfehler vor dem Start (z. B. Worker im Artefakt gesperrt) oder ein Absturz: alle Wartenden enden.
    failAll(new Error(`voice worker: ${msg}`));
  };
  const ask = (m: Record<string, unknown>, ms?: number): Promise<Out> =>
    new Promise<Out>((resolve, reject) => {
      if (dead) {
        reject(dead);
        return;
      }
      const id = ++seq;
      const t = ms === undefined ? undefined : setTimeout(() => {
        if (!waits.has(id)) return;
        waits.delete(id);
        reject(new Error(`voice worker: keine Antwort nach ${ms} ms`));
      }, ms);
      waits.set(id, {
        resolve: (o) => {
          clearTimeout(t);
          resolve(o);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      w.postMessage({ ...m, id });
    });
  // Startet der Worker gar nicht (gesperrt, Skript nicht ladbar), kommt weder eine Nachricht noch ein Fehler: dann nach WORKER_BOOT_MS aufgeben.
  const boot = setTimeout(() => {
    if (!heard) failAll(new Error(`voice worker: startet nicht (${WORKER_BOOT_MS} ms ohne Lebenszeichen)`));
  }, WORKER_BOOT_MS);
  let ready: Extract<Out, { t: 'ready' }>;
  try {
    const probe = (await ask({ t: 'probe' }, WORKER_BOOT_MS)) as Extract<Out, { t: 'probed' }>;
    clearTimeout(boot);
    if (!probe.gpu && opts.device !== 'wasm' && opts.mainGpu && (await opts.mainGpu())) throw new WorkerNoGpuError();
    ready = (await ask({ t: 'load', base: opts.base, ...(opts.device ? { device: opts.device } : {}) }, WORKER_LOAD_MS)) as Extract<Out, { t: 'ready' }>;
  } catch (err) {
    clearTimeout(boot);
    w.terminate();
    throw err;
  }
  clearTimeout(boot);
  logInfo('voice:worker', `Hintergrund-Rechner läuft (${ready.device})`);
  return {
    device: ready.device,
    version: ready.version,
    worker: true,
    fromCache: ready.fromCache,
    loadMs: ready.loadMs,
    lost: () => lost || dead !== null,
    async generate(text, voice, speed) {
      const m = (await ask({ t: 'gen', text, voice, speed })) as Extract<Out, { t: 'audio' }>;
      return { audio: m.audio, rate: m.rate };
    },
    async dispose() {
      try {
        if (!dead) await ask({ t: 'dispose' }, 3_000);
      } catch (err) {
        logWarn('voice:dispose', err);
      } finally {
        failAll(new Error('voice worker: beendet'));
        w.terminate();
      }
    },
  };
}
