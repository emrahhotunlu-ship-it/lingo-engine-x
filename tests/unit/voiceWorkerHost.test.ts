import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadWorkerEngine, setWorkerFactory, WORKER_BOOT_MS, type WorkerLike } from '../../src/platform/voice/workerHost';

// Stimme 2.0: Hauptfaden-Seite des Hintergrund-Rechners. Startet der Worker nicht (im Artefakt gesperrt, Skriptfehler), lehnt
// `loadWorkerEngine` ab – `neural.ts` rechnet dann im Hauptfaden. Hat der Worker keinen Grafikchip, der Hauptfaden aber schon, bleibt es beim
// Grafikchip im Hauptfaden (iPhone wie bisher).

type Msg = Record<string, unknown> & { t: string; id: number };

class FakeWorker implements WorkerLike {
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: ErrorEvent | Event) => void) | null = null;
  sent: Msg[] = [];
  terminated = false;
  constructor(private readonly reply: (m: Msg, w: FakeWorker) => void) {}
  postMessage(m: unknown): void {
    this.sent.push(m as Msg);
    setTimeout(() => this.reply(m as Msg, this), 1);
  }
  terminate(): void {
    this.terminated = true;
  }
  emit(data: unknown): void {
    this.onmessage?.({ data } as MessageEvent);
  }
}

const happy = (gpu: boolean) => (m: Msg, w: FakeWorker) => {
  if (m.t === 'probe') w.emit({ t: 'probed', id: m.id, gpu });
  if (m.t === 'load') w.emit({ t: 'ready', id: m.id, device: gpu && m.device !== 'wasm' ? 'webgpu' : 'wasm', version: 'v1', fromCache: true, loadMs: 5 });
  if (m.t === 'gen') w.emit({ t: 'audio', id: m.id, audio: new Float32Array([0.1, 0.2]), rate: 24000 });
  if (m.t === 'dispose') w.emit({ t: 'disposed', id: m.id });
};

describe('Hintergrund-Rechner (workerHost)', () => {
  let last: FakeWorker | null = null;
  const use = (reply: (m: Msg, w: FakeWorker) => void) =>
    setWorkerFactory(() => {
      last = new FakeWorker(reply);
      return last;
    });
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    last = null;
  });

  it('lädt im Worker und rechnet dort', async () => {
    use(happy(true));
    const p = loadWorkerEngine(() => undefined, { base: 'https://x.invalid/' });
    await vi.advanceTimersByTimeAsync(10);
    const e = await p;
    expect(e).toMatchObject({ device: 'webgpu', worker: true, version: 'v1' });
    const out = e.generate('Hi.', 'af_heart', 1);
    await vi.advanceTimersByTimeAsync(10);
    await expect(out).resolves.toMatchObject({ rate: 24000 });
    const d = e.dispose();
    await vi.advanceTimersByTimeAsync(10);
    await d;
    expect(last?.terminated).toBe(true);
  });

  it('Worker meldet sich nicht (gesperrt): Ablehnung nach der Startfrist, Worker beendet', async () => {
    use(() => undefined);
    const p = loadWorkerEngine(() => undefined, { base: 'https://x.invalid/' });
    const check = expect(p).rejects.toThrow(/voice worker/);
    await vi.advanceTimersByTimeAsync(WORKER_BOOT_MS + 10);
    await check;
    expect(last?.terminated).toBe(true);
  });

  it('Skriptfehler im Worker: sofortige Ablehnung', async () => {
    use((_m, w) => w.onerror?.({ message: 'Failed to load module script' } as ErrorEvent));
    const p = loadWorkerEngine(() => undefined, { base: 'https://x.invalid/' });
    const check = expect(p).rejects.toThrow(/Failed to load module script/);
    await vi.advanceTimersByTimeAsync(10);
    await check;
  });

  it('kein Grafikchip im Worker, aber im Hauptfaden: Ablehnung mit WorkerNoGpuError (dann Hauptfaden-Grafikchip)', async () => {
    use(happy(false));
    const p = loadWorkerEngine(() => undefined, { base: 'https://x.invalid/', mainGpu: () => Promise.resolve(true) });
    const check = expect(p).rejects.toMatchObject({ name: 'WorkerNoGpuError' });
    await vi.advanceTimersByTimeAsync(10);
    await check;
  });

  it('weder im Worker noch im Hauptfaden ein Grafikchip: Prozessor im Worker', async () => {
    use(happy(false));
    const p = loadWorkerEngine(() => undefined, { base: 'https://x.invalid/', mainGpu: () => Promise.resolve(false) });
    await vi.advanceTimersByTimeAsync(10);
    await expect(p).resolves.toMatchObject({ device: 'wasm', worker: true });
  });

  it('Absturz während des Rechnens: wartende Sätze enden mit Fehler, die Maschine gilt als verloren', async () => {
    use((m, w) => {
      if (m.t === 'gen') w.onerror?.({ message: 'crash' } as ErrorEvent);
      else happy(true)(m, w);
    });
    const p = loadWorkerEngine(() => undefined, { base: 'https://x.invalid/' });
    await vi.advanceTimersByTimeAsync(10);
    const e = await p;
    const out = e.generate('Hi.', 'af_heart', 1);
    const check = expect(out).rejects.toThrow(/crash/);
    await vi.advanceTimersByTimeAsync(10);
    await check;
    expect(e.lost()).toBe(true);
  });
});
