import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Neue Stimme robust und schnell (Emrah 10.11.2026: „auf einmal ging es nicht mehr, Handy laggy … immer eine Sekunde“):
// eins nach dem anderen rechnen, Gedächtnis für fertige Sätze, Vorab-Rechnen, kein Neuladen bei bloßer Langsamkeit,
// Neuladen nur bei Grafikchip-Verlust – und dann erst nach dem Freigeben der alten Maschine.
// Stimme 2.0 (Emrah 26.11.2026: „IMMER die gute Stimme, schnell und immer verfügbar“): ein langsamer Satz bringt nie mehr die Gerätestimme
// (der Knopf wartet sichtbar), Gerätestimme nur bei `failed`; Tonvorrat; Vorab-Plan in Ruhe mit Obergrenze; Hintergrund-Rechner mit Rückfall.

type Gen = { text: string; resolve: (v: { audio: Float32Array; rate: number }) => void; reject: (e: Error) => void };

type WorkerMode = 'absent' | 'ok' | 'fail';
type State = { loads: number; disposed: number; lost: boolean; gens: Gen[]; log: string[]; devices: string[]; loadDelay: number; loadFail: boolean; worker: WorkerMode; workerLoads: number };
const state = vi.hoisted((): State => ({
  loads: 0,
  disposed: 0,
  lost: false,
  gens: [] as Gen[],
  log: [] as string[],
  devices: [] as string[],
  loadDelay: 0,
  loadFail: false,
  worker: 'absent',
  workerLoads: 0,
}));

function fakeEngine(device: 'webgpu' | 'wasm', worker: boolean) {
  state.loads += 1;
  state.log.push(`load${state.loads}`);
  const n = state.loads;
  state.devices.push(device);
  return {
    device,
    version: 'v1',
    worker,
    fromCache: true,
    loadMs: 10,
    lost: () => state.lost,
    dispose: () => {
      state.disposed += 1;
      state.log.push(`dispose${n}`);
      return Promise.resolve();
    },
    generate: (text: string) => new Promise((resolve, reject) => state.gens.push({ text, resolve, reject })),
  };
}

vi.mock('../../src/platform/voice/engine', () => ({
  loadEngine: (_p: unknown, opts?: { device?: 'webgpu' | 'wasm' }) => {
    if (state.loadFail) return Promise.reject(new Error('pack missing'));
    const e = fakeEngine(opts?.device ?? 'webgpu', false);
    return state.loadDelay ? new Promise((r) => setTimeout(() => r(e), state.loadDelay)) : Promise.resolve(e);
  },
}));

vi.mock('../../src/platform/voice/workerHost', () => ({
  loadWorkerEngine: (_p: unknown, opts?: { device?: 'webgpu' | 'wasm' }) => {
    state.workerLoads += 1;
    if (state.worker === 'fail') return Promise.reject(new Error('voice worker: startet nicht'));
    return Promise.resolve(fakeEngine(opts?.device ?? 'webgpu', true));
  },
}));

import { type ClipBackend, clipStoreKey, openClipStore, resetClipStore, writeClip } from '../../src/platform/voice/clipStore';
import { loadNeuralVoice, neuralWanted, noteInputActivity, PLAN_SESSION_MAX, planNeural, planState, prefetchNeural, resetNeural, speakNeural, useNeuralVoice, VOICE_DEVICE_KEY, VOICE_WORKER_KEY } from '../../src/platform/voice/neural';

class FakeSource {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect() {}
  start() {
    setTimeout(() => this.onended?.(), 5);
  }
  stop() {
    this.onended?.();
  }
}
class FakeCtx {
  state = 'running';
  destination = {};
  createBuffer() {
    return { copyToChannel() {} };
  }
  createBufferSource() {
    return new FakeSource();
  }
  resume() {
    return Promise.resolve();
  }
  close() {
    return Promise.resolve();
  }
}

const g = globalThis as { window?: unknown; Worker?: unknown };
const clip = () => ({ audio: new Float32Array(100), rate: 24000 });
const flush = async () => {
  for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(0);
};
const waits: boolean[] = [];
const run = (chunks: string[], alive = () => true) => speakNeural({ chunks, from: 0, rate: 1, voice: 'af_heart', alive, onChunk: () => undefined, onWait: (w) => waits.push(w) });

class FakeStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
let store = new FakeStorage();

/** Tonvorrat im Speicher (statt IndexedDB). */
function memStore(): ClipBackend {
  const clips = new Map<string, { pcm: ArrayBuffer; rate: number }>();
  const metas = new Map<string, { b: number; at: number }>();
  return {
    metas: () => Promise.resolve([...metas]),
    get: (k) => Promise.resolve(clips.get(k) ?? null),
    put: (k, r, m) => {
      clips.set(k, r);
      metas.set(k, m);
      return Promise.resolve();
    },
    touch: () => Promise.resolve(),
    del: (keys) => {
      for (const k of keys) {
        clips.delete(k);
        metas.delete(k);
      }
      return Promise.resolve();
    },
  };
}

async function fresh(o: { device?: 'wasm'; worker?: 'absent' | 'ok' | 'fail' } = {}): Promise<void> {
  resetNeural();
  state.worker = o.worker ?? 'absent';
  if (state.worker === 'absent') delete g.Worker;
  else g.Worker = function W() {};
  if (o.device) store.setItem(VOICE_DEVICE_KEY, o.device);
  await loadNeuralVoice();
}

describe('neue Stimme', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    store = new FakeStorage();
    g.window = { indexedDB: {}, DecompressionStream: function D() {}, AudioContext: FakeCtx, localStorage: store };
    Object.assign(state, { loads: 0, disposed: 0, lost: false, gens: [], log: [], devices: [], loadDelay: 0, loadFail: false, worker: 'absent', workerLoads: 0 });
    waits.length = 0;
    PLAN_SESSION_MAX.gpu = 400;
    PLAN_SESSION_MAX.cpu = 150;
    const mem = memStore();
    resetClipStore(() => Promise.resolve(mem));
    resetNeural();
    await loadNeuralVoice();
    expect(useNeuralVoice.getState().status).toBe('ready');
  });
  afterEach(() => {
    resetNeural();
    resetClipStore();
    delete g.window;
    delete g.Worker;
    vi.useRealTimers();
  });

  it('rechnet immer nur einen Satz auf einmal und spielt ein zweites Mal aus dem Gedächtnis', async () => {
    const p = run(['One.', 'Two.']);
    await flush();
    expect(state.gens.map((x) => x.text)).toEqual(['One.']);
    state.gens[0]?.resolve(clip());
    await flush();
    // Das zweite Stück startet erst, wenn das erste fertig ist.
    expect(state.gens.map((x) => x.text)).toEqual(['One.', 'Two.']);
    state.gens[1]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    const again = run(['One.', 'Two.']);
    await vi.advanceTimersByTimeAsync(50);
    await expect(again).resolves.toBe('done');
    expect(state.gens).toHaveLength(2);
  });

  it('vorab gerechneter Satz spielt ohne neues Rechnen', async () => {
    prefetchNeural(['Ready.'], 'af_heart', 1);
    await vi.advanceTimersByTimeAsync(500);
    expect(state.gens.map((x) => x.text)).toEqual(['Ready.']);
    state.gens[0]?.resolve(clip());
    await flush();
    const p = run(['Ready.']);
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    expect(state.gens).toHaveLength(1);
  });

  it('langsamer Satz (12 s): keine Gerätestimme, der Knopf wartet sichtbar, dann spielt die gute Stimme', async () => {
    const p = run(['Slow sentence.']);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(waits).toEqual([true]);
    state.gens[0]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    expect(waits).toEqual([true, false]);
    expect(state.loads).toBe(1);
  });

  it('länger als die Wartezeit (15 s): still statt Gerätestimme, kein Neuladen; der Satz landet im Gedächtnis', async () => {
    const p = run(['Very slow sentence.']);
    await vi.advanceTimersByTimeAsync(15_100);
    await expect(p).resolves.toBe('slow');
    expect(state.loads).toBe(1);
    state.gens[0]?.resolve(clip());
    await flush();
    const again = run(['Very slow sentence.']);
    await vi.advanceTimersByTimeAsync(50);
    await expect(again).resolves.toBe('done');
    expect(state.loads).toBe(1);
  });

  it('veraltete Aufträge (Tipp schon vorbei) werden nicht gerechnet', async () => {
    let alive = true;
    const first = run(['Busy.']);
    const old = run(['Old.'], () => alive);
    await flush();
    alive = false;
    state.gens[0]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(first).resolves.toBe('done');
    await expect(old).resolves.toBe('stopped');
    expect(state.gens.map((x) => x.text)).toEqual(['Busy.']);
  });

  it('Grafikchip verloren: alte Maschine erst freigeben, einmal neu laden – der Tipp wartet darauf und spielt die gute Stimme', async () => {
    state.lost = true;
    const p = run(['Hi there.']);
    await flush();
    state.lost = false;
    await flush();
    expect(state.log).toEqual(['load1', 'dispose1', 'load2']);
    expect(useNeuralVoice.getState().status).toBe('ready');
    state.gens.at(-1)?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
  });

  it('hängt der Grafikchip über 20 s: Tipp nach 15 s still, genau ein Neuladen', async () => {
    const p = run(['Stuck.']);
    await vi.advanceTimersByTimeAsync(15_100);
    await expect(p).resolves.toBe('slow');
    await vi.advanceTimersByTimeAsync(6_000);
    await flush();
    expect(state.log).toEqual(['load1', 'dispose1', 'load2']);
  });

  // Safari am Mac (23.11.2026): WebGPU wird angeboten und lädt, `generate` kommt aber nie zurück → früher endlos neu geladen.
  it('Grafikchip hängt, bevor er je geantwortet hat: Neuaufbau auf dem Prozessor, gemerkt im Browser-Speicher', async () => {
    void run(['Stuck.']);
    await vi.advanceTimersByTimeAsync(20_100);
    await flush();
    expect(state.log).toEqual(['load1', 'dispose1', 'load2']);
    expect(state.devices).toEqual(['webgpu', 'wasm']);
    expect(store.getItem(VOICE_DEVICE_KEY)).toBe('wasm');
    expect(useNeuralVoice.getState()).toMatchObject({ status: 'ready', device: 'wasm' });
  });

  it('gemerkter Prozessor: beim nächsten Start gleich wasm', async () => {
    await fresh({ device: 'wasm' });
    expect(state.devices).toEqual(['webgpu', 'wasm']);
  });

  it('hängt auch der Prozessor: aufhören, Gerätestimme nur jetzt (failed), keine Schleife', async () => {
    void run(['Stuck.']);
    await vi.advanceTimersByTimeAsync(20_100);
    await flush();
    expect(state.devices).toEqual(['webgpu', 'wasm']);
    void run(['Still stuck.']);
    await vi.advanceTimersByTimeAsync(90_100);
    await flush();
    expect(useNeuralVoice.getState().status).toBe('failed');
    expect(neuralWanted()).toBe(false);
    // Viel später, auch nach Rückkehr und erneutem Vorlesen: nichts wird mehr geladen.
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    await expect(loadNeuralVoice()).resolves.toBeNull();
    await expect(run(['Hello.'])).resolves.toBe('unavailable');
    expect(state.loads).toBe(2);
    expect(state.disposed).toBe(2);
  });

  it('Laden scheitert (Status failed): Gerätestimme, und nur dann', async () => {
    resetNeural();
    state.loadFail = true;
    await loadNeuralVoice();
    expect(useNeuralVoice.getState().status).toBe('failed');
    expect(neuralWanted()).toBe(false);
    await expect(run(['Hello.'])).resolves.toBe('unavailable');
  });

  it('allererstes Herunterladen (Paket noch nie geladen): diesmal die Gerätestimme statt einer halben Minute Stille', async () => {
    resetNeural();
    store.m.delete('lx:voice-ver');
    state.loadDelay = 30_000;
    expect(neuralWanted()).toBe(true);
    const p = run(['Hello.']);
    await flush();
    await expect(p).resolves.toBe('unavailable');
  });

  it('Stimme lädt aus dem Speicher: der Tipp wartet auf sie und spielt die gute Stimme', async () => {
    resetNeural();
    state.loadDelay = 3_000;
    const p = run(['Hello there.']);
    await vi.advanceTimersByTimeAsync(3_100);
    await flush();
    state.gens.at(-1)?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    expect(waits[0]).toBe(true);
  });

  it('Tonvorrat: gespeicherter Satz spielt sofort, auch bevor die Stimme geladen ist', async () => {
    await openClipStore();
    await writeClip(clipStoreKey('v1', 'af_heart', 1, 'Stored sentence.'), clip());
    resetNeural();
    state.loadDelay = 60_000;
    const t0 = Date.now();
    const p = run(['Stored sentence.']);
    await vi.advanceTimersByTimeAsync(10);
    await expect(p).resolves.toBe('done');
    expect(Date.now() - t0).toBeLessThan(100);
    expect(state.gens).toHaveLength(0);
    // Kein Lade-Zustand: es musste nichts gerechnet werden.
    expect(waits).toEqual([]);
  });

  it('gerechneter Satz kommt in den Tonvorrat (nach einem Neustart sofort da)', async () => {
    const p = run(['Keep me.']);
    await flush();
    state.gens[0]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    resetNeural();
    state.loadDelay = 60_000;
    const again = run(['Keep me.']);
    await vi.advanceTimersByTimeAsync(10);
    await expect(again).resolves.toBe('done');
    expect(state.gens).toHaveLength(1);
  });

  it('iPhone-Fall: Grafikchip hat schon geantwortet und hängt einmal – wieder Grafikchip, nichts gemerkt', async () => {
    const p = run(['Fine.']);
    await flush();
    state.gens[0]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    void run(['Stuck.']);
    await vi.advanceTimersByTimeAsync(20_100);
    await flush();
    expect(state.devices).toEqual(['webgpu', 'webgpu']);
    expect(store.getItem(VOICE_DEVICE_KEY)).toBeNull();
  });

  it('Prozessor im Hauptfaden: langsamer erster Satz (6 s) spielt die neue Stimme; kein Vorab-Rechnen', async () => {
    await fresh({ device: 'wasm' });
    prefetchNeural(['Card.'], 'af_heart', 1);
    planNeural(['Later.'], 'af_heart', 1, 'later');
    await vi.advanceTimersByTimeAsync(2_000);
    expect(state.gens).toHaveLength(0);
    const p = run(['Slow on the processor.']);
    await vi.advanceTimersByTimeAsync(6_000);
    state.gens[0]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
  });

  // Der Prozessor rechnet im Hauptfaden: währenddessen laufen keine Wecker, danach sind sie überfällig (Uhr ist weiter als geplant).
  const blockClock = () => {
    const base = Date.now.bind(Date);
    let offset = 0;
    const spy = vi.spyOn(Date, 'now').mockImplementation(() => base() + offset);
    return { block: (ms: number) => (offset += ms), restore: () => spy.mockRestore() };
  };

  it('Prozessor: Satz direkt nach blockiertem Rechnen fertig – der überfällige Tipp-Wecker gibt ihm Vorrang', async () => {
    await fresh({ device: 'wasm' });
    const clock = blockClock();
    const p = run(['A very long sentence.']);
    await flush();
    clock.block(40_000);
    await vi.advanceTimersByTimeAsync(30_000);
    state.gens[0]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    clock.restore();
  });

  it('Prozessor: überfälliger Hänger-Wecker nach blockiertem Rechnen zählt nicht als Hänger', async () => {
    await fresh({ device: 'wasm' });
    const clock = blockClock();
    void run(['A very long sentence.']);
    await flush();
    clock.block(100_000);
    await vi.advanceTimersByTimeAsync(90_000);
    state.gens[0]?.resolve(clip());
    await vi.advanceTimersByTimeAsync(5_000);
    // 1 = Start im beforeEach, 2 = Start auf dem Prozessor; kein Neuaufbau.
    expect(state.loads).toBe(2);
    expect(useNeuralVoice.getState()).toMatchObject({ status: 'ready', device: 'wasm' });
    clock.restore();
  });

  describe('Hintergrund-Rechner', () => {
    it('startet die Stimme im Worker, wenn es ihn gibt', async () => {
      await fresh({ worker: 'ok' });
      expect(state.workerLoads).toBe(1);
      expect(useNeuralVoice.getState()).toMatchObject({ status: 'ready', worker: true });
    });

    it('Worker startet nicht: Rückfall auf den Hauptfaden, einen Tag lang gemerkt', async () => {
      await fresh({ worker: 'fail' });
      expect(state.workerLoads).toBe(1);
      expect(useNeuralVoice.getState()).toMatchObject({ status: 'ready', worker: false });
      expect(store.getItem(VOICE_WORKER_KEY)).toMatch(/^off:\d+$/);
      // Nächster Start (gleicher Tag): gleich im Hauptfaden, ohne erneutes Warten auf den Worker.
      await fresh({ worker: 'ok' });
      expect(state.workerLoads).toBe(1);
      expect(useNeuralVoice.getState().worker).toBe(false);
    });

    it('Worker meldet „bereit“, liefert aber nie einen Satz (iPhone 26.11.2026 „no engine“): Rückfall auf den Hauptfaden, gemerkt', async () => {
      await fresh({ worker: 'ok' });
      await flush();
      // Aufwärmen scheitert → Neuladen (wieder im Worker); dann scheitert auch der erste echte Satz → kein dritter Worker, Hauptfaden.
      for (const g of state.gens.splice(0)) g.reject(new Error('no engine'));
      await vi.advanceTimersByTimeAsync(5_000);
      expect(state.workerLoads).toBe(2);
      void run(['Hello there.']);
      await flush();
      for (const g of state.gens.splice(0)) g.reject(new Error('no engine'));
      await vi.advanceTimersByTimeAsync(5_000);
      expect(store.getItem(VOICE_WORKER_KEY)).toMatch(/^off:\d+$/);
      expect(state.workerLoads).toBe(2);
      expect(useNeuralVoice.getState()).toMatchObject({ status: 'ready', worker: false, device: 'webgpu' });
    });

    it('im Worker wärmt die Stimme nach dem Laden still auf (ein Mini-Satz, nicht abgespielt)', async () => {
      await fresh({ worker: 'ok' });
      await flush();
      expect(state.gens.map((x) => x.text)).toEqual(['Hi.']);
    });
  });

  describe('Vorab-Plan', () => {
    const settle = async () => {
      // Aufwärm-Satz (nur im Worker) erledigen.
      await flush();
      for (const g0 of state.gens.splice(0)) g0.resolve(clip());
      await flush();
    };

    it('rechnet nur in Eingabe-Ruhe, eins nach dem anderen, und überspringt Vorhandenes', async () => {
      await fresh({ worker: 'ok' });
      await settle();
      // „Known.“ liegt schon im Gedächtnis.
      const k = run(['Known.']);
      await flush();
      state.gens.splice(0)[0]?.resolve(clip());
      await vi.advanceTimersByTimeAsync(50);
      await expect(k).resolves.toBe('done');
      noteInputActivity();
      planNeural(['Known.', 'Card one.', 'Card two.'], 'af_heart', 1, 'next');
      await vi.advanceTimersByTimeAsync(900);
      // Noch getippt (Ruhezeit 1,2 s): nichts gerechnet.
      expect(state.gens).toHaveLength(0);
      await vi.advanceTimersByTimeAsync(600);
      expect(state.gens.map((x) => x.text)).toEqual(['Card one.']);
      state.gens[0]?.resolve(clip());
      await vi.advanceTimersByTimeAsync(400);
      expect(state.gens.map((x) => x.text)).toEqual(['Card one.', 'Card two.']);
      state.gens[1]?.resolve(clip());
      await vi.advanceTimersByTimeAsync(400);
      expect(planState()).toMatchObject({ queued: 0, done: 2, skipped: 1 });
    });

    it('Obergrenze je Sitzung: danach wird nichts mehr vorab gerechnet', async () => {
      await fresh({ worker: 'ok' });
      await settle();
      PLAN_SESSION_MAX.gpu = 3;
      planNeural(['a.', 'b.', 'c.', 'd.', 'e.'], 'af_heart', 1, 'later');
      for (let i = 0; i < 10; i++) {
        await vi.advanceTimersByTimeAsync(1_000);
        for (const g0 of state.gens.splice(0)) g0.resolve(clip());
      }
      await vi.advanceTimersByTimeAsync(5_000);
      expect(planState().done).toBe(3);
      expect(planState().queued).toBe(0);
    });

    it('nach jeder Portion eine längere Pause (Gerät soll nicht heiß laufen)', async () => {
      await fresh({ worker: 'ok' });
      await settle();
      planNeural(Array.from({ length: 20 }, (_, i) => `Sentence ${i}.`), 'af_heart', 1, 'later');
      let computed = 0;
      for (let i = 0; i < 40; i++) {
        await vi.advanceTimersByTimeAsync(300);
        for (const g0 of state.gens.splice(0)) {
          g0.resolve(clip());
          computed += 1;
        }
      }
      // 15 Sätze, dann 20 s Pause: nach 12 s erst die erste Portion.
      expect(computed).toBe(15);
      await vi.advanceTimersByTimeAsync(20_000);
      for (const g0 of state.gens.splice(0)) g0.resolve(clip());
      await vi.advanceTimersByTimeAsync(300);
      expect(state.gens.length + computed).toBeGreaterThan(15);
    });

    it('Hauptfaden mit Grafikchip: nur die sichtbare Karte, nicht der Rest der Runde', async () => {
      planNeural(['Later card.'], 'af_heart', 1, 'later');
      await vi.advanceTimersByTimeAsync(2_000);
      expect(state.gens).toHaveLength(0);
      prefetchNeural(['Visible card.'], 'af_heart', 1);
      await vi.advanceTimersByTimeAsync(600);
      expect(state.gens.map((x) => x.text)).toEqual(['Visible card.']);
    });

    it('ein Tipp überholt das Vorab-Rechnen', async () => {
      await fresh({ worker: 'ok' });
      await settle();
      planNeural(['Pre one.', 'Pre two.'], 'af_heart', 1, 'later');
      await vi.advanceTimersByTimeAsync(1_000);
      expect(state.gens.map((x) => x.text)).toEqual(['Pre one.']);
      const p = run(['Tapped.']);
      state.gens[0]?.resolve(clip());
      await flush();
      // Als Nächstes rechnet der Tipp, nicht der zweite Vorab-Satz.
      expect(state.gens.map((x) => x.text)).toEqual(['Pre one.', 'Tapped.']);
      state.gens[1]?.resolve(clip());
      await vi.advanceTimersByTimeAsync(50);
      await expect(p).resolves.toBe('done');
    });
  });
});
