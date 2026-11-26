/// <reference lib="webworker" />
// lx:voice-engine – Hintergrund-Rechner der neuen Stimme (Stimme 2.0, Emrah 26.11.2026: „auf Handy und Mac IMMER die gute Stimme, schnell und
// immer verfügbar“). Läuft als Modul-Worker aus einer eigenen Datei neben der App (gleiche Herkunft, nichts von außen, A6 Nr. 8). Lautschrift
// und Rechnen laufen hier statt im Hauptfaden: Tippen ruckelt nicht, und Pausen des Hauptfadens verzögern keinen Satz.
// Nachrichten: { t: 'probe', id } → { t: 'probed', id, gpu }
//              { t: 'load', id, device?, base } → { t: 'ready', id, device, version, fromCache, loadMs } | { t: 'fail', id, error }
//              { t: 'gen', id, text, voice, speed } → { t: 'audio', id, audio, rate } | { t: 'fail', id, error }
//              { t: 'dispose', id } → { t: 'disposed', id }; von selbst: { t: 'progress', phase, pct }, { t: 'lost' }, { t: 'log', level?, scope, msg }
import { ensureStreamAsyncIterator } from '../compat';
import { getLog, subscribeLog } from '../diagnostics';
import type { Engine, EngineDevice } from './engine';

type In =
  | { t: 'probe'; id: number }
  | { t: 'load'; id: number; device?: EngineDevice; base: string }
  | { t: 'gen'; id: number; text: string; voice: string; speed: number }
  | { t: 'dispose'; id: number };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const post = (m: Record<string, unknown>, transfer: Transferable[] = []): void => scope.postMessage(m, transfer);
const errText = (err: unknown): string => (err instanceof Error ? `${err.name}: ${err.message}` : String(err));

// Protokoll des Hintergrund-Rechners in das der App weiterreichen (Einstellungen › Diagnose); das Sichern im Browser-Speicher gibt es hier nicht.
let sentLog = 0;
subscribeLog(() => {
  for (const e of getLog()) {
    if (e.id <= sentLog) continue;
    sentLog = e.id;
    if (e.scope === 'diagnostics:persist') continue;
    post({ t: 'log', level: e.level, scope: e.scope, msg: e.message });
  }
});

// Safari: die Lautschrift braucht `for await` über einen ReadableStream – auch hier im Hintergrund-Rechner nachrüsten, bevor die Bibliothek lädt.
if (ensureStreamAsyncIterator()) post({ t: 'log', scope: 'voice:compat', msg: 'ReadableStream-Durchlauf im Hintergrund-Rechner nachgerüstet (Safari)' });

let engine: Engine | null = null;
let lostSent = false;

scope.onmessage = (ev: MessageEvent<In>) => {
  const m = ev.data;
  if (m.t === 'probe') {
    // Gibt es hier im Hintergrund einen Grafikchip? (Safari bietet WebGPU nicht überall auch im Worker an.)
    const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    void (gpu ? gpu.requestAdapter().then((a) => a != null, () => false) : Promise.resolve(false)).then((ok) => post({ t: 'probed', id: m.id, gpu: ok }));
    return;
  }
  if (m.t === 'load') {
    void (async () => {
      try {
        const mod = await import('./engine');
        engine = await mod.loadEngine((p) => post({ t: 'progress', phase: p.phase, pct: p.pct }), { base: m.base, ...(m.device ? { device: m.device } : {}) });
        post({ t: 'ready', id: m.id, device: engine.device, version: engine.version, fromCache: engine.fromCache, loadMs: engine.loadMs });
      } catch (err) {
        post({ t: 'fail', id: m.id, error: errText(err) });
      }
    })();
    return;
  }
  if (m.t === 'gen') {
    const e = engine;
    if (!e) {
      post({ t: 'fail', id: m.id, error: 'no engine' });
      return;
    }
    e.generate(m.text, m.voice, m.speed).then(
      (out) => {
        if (e.lost() && !lostSent) {
          lostSent = true;
          post({ t: 'lost' });
        }
        // Übergeben statt kopieren (kein doppelter Speicher).
        post({ t: 'audio', id: m.id, audio: out.audio, rate: out.rate }, [out.audio.buffer]);
      },
      (err: unknown) => {
        if (e.lost() && !lostSent) {
          lostSent = true;
          post({ t: 'lost' });
        }
        post({ t: 'fail', id: m.id, error: errText(err) });
      },
    );
    return;
  }
  const e = engine;
  engine = null;
  void (e ? e.dispose() : Promise.resolve()).finally(() => post({ t: 'disposed', id: m.id }));
};
