import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as NeuralNs from '../../src/platform/voice/neural';

// Stimme 2.0: Aufwärmen nach dem Zurückkehren (visibilitychange / pageshow) – ein Mini-Satz wird still gerechnet, damit Grafikchip bzw.
// Rechner wach sind, bevor Emrah tippt (Mac-Protokoll 26.11.2026: nach dem Zurückkehren war der erste Satz zu langsam → Gerätestimme).
// Dazu der Hintergrund-Rechner selbst (`workerHost.ts`): Start, Rückfall bei Sperre, Grafikchip nur im Hauptfaden.

type Gen = { text: string; resolve: (v: { audio: Float32Array; rate: number }) => void };
type State = { gens: Gen[]; worker: boolean; device: 'webgpu' | 'wasm' };
const state = vi.hoisted((): State => ({ gens: [], worker: true, device: 'webgpu' }));

vi.mock('../../src/platform/voice/engine', () => ({
  loadEngine: () =>
    Promise.resolve({
      device: state.device,
      version: 'v1',
      worker: false,
      fromCache: true,
      loadMs: 1,
      lost: () => false,
      dispose: () => Promise.resolve(),
      generate: (text: string) => new Promise((resolve) => state.gens.push({ text, resolve })),
    }),
}));
vi.mock('../../src/platform/voice/workerHost', () => ({
  loadWorkerEngine: () =>
    state.worker
      ? Promise.resolve({
          device: state.device,
          version: 'v1',
          worker: true,
          fromCache: true,
          loadMs: 1,
          lost: () => false,
          dispose: () => Promise.resolve(),
          generate: (text: string) => new Promise((resolve) => state.gens.push({ text, resolve })),
        })
      : Promise.reject(new Error('blocked')),
}));

class FakeDoc extends EventTarget {
  visibilityState: 'visible' | 'hidden' = 'visible';
  baseURI = 'https://example.invalid/';
}
const doc = new FakeDoc();
const win = new EventTarget() as EventTarget & Record<string, unknown>;
const g = globalThis as Record<string, unknown>;

type NeuralMod = typeof NeuralNs;
let m: NeuralMod;

const flush = async () => {
  for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(0);
};
const hide = () => {
  doc.visibilityState = 'hidden';
  doc.dispatchEvent(new Event('visibilitychange'));
};
const show = () => {
  doc.visibilityState = 'visible';
  doc.dispatchEvent(new Event('visibilitychange'));
};

describe('Aufwärmen nach dem Zurückkehren', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    g.document = doc;
    Object.assign(win, { indexedDB: {}, DecompressionStream: function D() {}, AudioContext: function A() {} });
    g.window = win;
    g.Worker = function W() {};
    state.gens = [];
    state.worker = true;
    state.device = 'webgpu';
    m = await import('../../src/platform/voice/neural');
    m.resetNeural();
  });
  afterEach(() => {
    m.resetNeural();
    delete g.document;
    delete g.window;
    delete g.Worker;
    vi.useRealTimers();
  });

  const ready = async () => {
    await m.loadNeuralVoice();
    await flush();
    // Aufwärmen gleich nach dem Laden (im Worker).
    for (const x of state.gens.splice(0)) x.resolve({ audio: new Float32Array(10), rate: 24000 });
    await flush();
  };

  it('Worker: nach 5 s Abwesenheit wird sofort still ein Mini-Satz gerechnet', async () => {
    await ready();
    hide();
    await vi.advanceTimersByTimeAsync(6_000);
    show();
    await flush();
    expect(state.gens.map((x) => x.text)).toEqual(['Hi.']);
  });

  it('kurz weg (unter 5 s): kein Aufwärmen', async () => {
    await ready();
    hide();
    await vi.advanceTimersByTimeAsync(2_000);
    show();
    await flush();
    expect(state.gens).toHaveLength(0);
  });

  it('Rückkehr aus dem Verlauf-Speicher (pageshow, Safari) wärmt ebenfalls auf', async () => {
    await ready();
    hide();
    await vi.advanceTimersByTimeAsync(6_000);
    const ev = new Event('pageshow') as Event & { persisted: boolean };
    ev.persisted = true;
    win.dispatchEvent(ev);
    await flush();
    expect(state.gens.map((x) => x.text)).toEqual(['Hi.']);
  });

  it('Hauptfaden auf dem Prozessor: kein Aufwärmen (es hielte die App an)', async () => {
    state.worker = false;
    state.device = 'wasm';
    await ready();
    hide();
    await vi.advanceTimersByTimeAsync(60_000);
    show();
    await flush();
    expect(state.gens).toHaveLength(0);
  });
});
