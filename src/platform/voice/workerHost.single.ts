// Einzeldatei-Bau (Rückfall, `npm run build:single`): kein Hintergrund-Rechner (er bräuchte eine eigene Datei). `neural.ts` rechnet dann
// wie bisher im Hauptfaden. Ersetzt `./workerHost` per Alias in vite.config.ts.
import type { Engine, EngineDevice, EngineProgress } from './engine';

export const WORKER_BOOT_MS = 0;

export function loadWorkerEngine(...args: [EngineProgress, { device?: EngineDevice; base: string }]): Promise<Engine> {
  void args;
  return Promise.reject(new Error('voice worker: Einzeldatei-Bau ohne Hintergrund-Rechner'));
}
