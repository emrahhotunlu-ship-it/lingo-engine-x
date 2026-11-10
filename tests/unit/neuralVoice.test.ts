import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Neue Stimme robust und schnell (Emrah 10.11.2026: „auf einmal ging es nicht mehr, Handy laggy … immer eine Sekunde“):
// eins nach dem anderen rechnen, Gedächtnis für fertige Sätze, Vorab-Rechnen, kein Neuladen bei bloßer Langsamkeit,
// Neuladen nur bei Grafikchip-Verlust – und dann erst nach dem Freigeben der alten Maschine.

type Gen = { text: string; resolve: (v: { audio: Float32Array; rate: number }) => void; reject: (e: Error) => void };

const state = vi.hoisted(() => ({ loads: 0, disposed: 0, lost: false, gens: [] as Gen[], log: [] as string[] }));

vi.mock('../../src/platform/voice/engine', () => ({
  loadEngine: () => {
    state.loads += 1;
    state.log.push(`load${state.loads}`);
    const n = state.loads;
    return Promise.resolve({
      device: 'webgpu',
      fromCache: true,
      loadMs: 10,
      lost: () => state.lost,
      dispose: () => {
        state.disposed += 1;
        state.log.push(`dispose${n}`);
        return Promise.resolve();
      },
      generate: (text: string) => new Promise((resolve, reject) => state.gens.push({ text, resolve, reject })),
    });
  },
}));

import { loadNeuralVoice, prefetchNeural, resetNeural, speakNeural, useNeuralVoice } from '../../src/platform/voice/neural';

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

const g = globalThis as { window?: unknown };
const clip = () => ({ audio: new Float32Array(100), rate: 24000 });
const flush = async () => {
  for (let i = 0; i < 5; i++) await vi.advanceTimersByTimeAsync(0);
};
const run = (chunks: string[], alive = () => true) => speakNeural({ chunks, from: 0, rate: 1, voice: 'af_heart', alive, onChunk: () => undefined });

describe('neue Stimme', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    g.window = { indexedDB: {}, DecompressionStream: function D() {}, AudioContext: FakeCtx };
    state.loads = 0;
    state.disposed = 0;
    state.lost = false;
    state.gens = [];
    state.log = [];
    resetNeural();
    await loadNeuralVoice();
    expect(useNeuralVoice.getState().status).toBe('ready');
  });
  afterEach(() => {
    resetNeural();
    delete g.window;
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
    await vi.advanceTimersByTimeAsync(400);
    expect(state.gens.map((x) => x.text)).toEqual(['Ready.']);
    state.gens[0]?.resolve(clip());
    await flush();
    const p = run(['Ready.']);
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).resolves.toBe('done');
    expect(state.gens).toHaveLength(1);
  });

  it('zu langsam: diesmal Gerätestimme, aber kein Neuladen; das Ergebnis landet im Gedächtnis', async () => {
    const p = run(['Slow sentence.']);
    await vi.advanceTimersByTimeAsync(4_100);
    await expect(p).resolves.toBe('unavailable');
    expect(state.loads).toBe(1);
    state.gens[0]?.resolve(clip());
    await flush();
    const again = run(['Slow sentence.']);
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

  it('Grafikchip verloren: alte Maschine erst freigeben, dann einmal neu laden', async () => {
    state.lost = true;
    await expect(run(['Hi.'])).resolves.toBe('unavailable');
    await expect(run(['Hi.'])).resolves.toBe('unavailable');
    await flush();
    expect(state.log).toEqual(['load1', 'dispose1', 'load2']);
    expect(useNeuralVoice.getState().status).toBe('ready');
  });

  it('hängt der Grafikchip über 20 s: genau ein Neuladen', async () => {
    const p = run(['Stuck.']);
    await vi.advanceTimersByTimeAsync(4_100);
    await expect(p).resolves.toBe('unavailable');
    await vi.advanceTimersByTimeAsync(17_000);
    await flush();
    expect(state.log).toEqual(['load1', 'dispose1', 'load2']);
  });
});
