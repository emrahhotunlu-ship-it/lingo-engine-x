// Ton v2 (Lernplattform 3.0 P56, Erlebnis-Engine §6): Hüllkurven-Klänge, Lautstärke, nie vor der ersten Geste, nie während der Sprachausgabe,
// `tick` höchstens 12 je Sekunde; der Verdict-Cue bleibt in Tönen unverändert.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FX_VOICES, TICK_MAX_PER_S, VOL_GAIN, playCue, playFx, resetSoundForTests, setSoundEnabled, setSoundVolume, soundVolume, unlockSound } from '../../src/platform/sound';

type Param = { value: number; setValueAtTime: () => void; exponentialRampToValueAtTime: () => void };
const param = (): Param => ({ value: 0, setValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined });
const node = () => {
  const n: Record<string, unknown> = { gain: param(), frequency: param(), threshold: param(), ratio: param(), type: '', buffer: null };
  n.connect = (x: unknown) => x;
  n.start = () => undefined;
  n.stop = () => undefined;
  return n;
};

let oscs: Array<{ frequency: Param }> = [];
let sources = 0;
let gains: Array<{ gain: Param }> = [];

class FakeCtx {
  state = 'running';
  currentTime = 0;
  sampleRate = 8000;
  destination = node();
  resume = () => Promise.resolve();
  createOscillator() {
    const o = node() as unknown as { frequency: Param };
    oscs.push(o);
    return o;
  }
  createGain() {
    const g = node() as unknown as { gain: Param };
    gains.push(g);
    return g;
  }
  createBiquadFilter = node;
  createDynamicsCompressor = node;
  createBufferSource() {
    sources += 1;
    return node();
  }
  createBuffer(_c: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
}

const store = new Map<string, string>();
let speaking = false;

beforeEach(() => {
  oscs = [];
  gains = [];
  sources = 0;
  speaking = false;
  store.clear();
  vi.stubGlobal('window', {
    AudioContext: FakeCtx,
    addEventListener: () => undefined,
    localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  });
  vi.stubGlobal('speechSynthesis', {
    get speaking() {
      return speaking;
    },
  });
  resetSoundForTests();
});

afterEach(() => {
  resetSoundForTests();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Ton v2', () => {
  it('aus = still; vor der ersten Geste = still', () => {
    expect(playFx('up')).toBe(false);
    setSoundEnabled(true);
    expect(playFx('up')).toBe(false);
    expect(oscs.length).toBe(0);
    unlockSound();
    expect(playFx('up')).toBe(true);
    // drei Töne, je Grundton + Oktave
    expect(oscs.length).toBe(FX_VOICES.up.length * 2);
    expect(sources).toBe(1);
  });

  it('nie während die Sprachausgabe spricht', () => {
    setSoundEnabled(true);
    unlockSound();
    speaking = true;
    for (const n of ['up', 'tick', 'day', 'level', 'card'] as const) expect(playFx(n)).toBe(false);
    expect(oscs.length + sources).toBe(0);
    speaking = false;
    expect(playFx('day')).toBe(true);
  });

  it('Tick höchstens 12 je Sekunde', () => {
    vi.useFakeTimers();
    setSoundEnabled(true);
    unlockSound();
    let played = 0;
    for (let i = 0; i < 30; i++) if (playFx('tick')) played += 1;
    expect(played).toBe(TICK_MAX_PER_S);
    vi.advanceTimersByTime(1100);
    expect(playFx('tick')).toBe(true);
  });

  it('Kartenwechsel ist nur Rauschen, kein Ton', () => {
    setSoundEnabled(true);
    unlockSound();
    expect(playFx('card')).toBe(true);
    expect(oscs.length).toBe(0);
    expect(sources).toBe(1);
  });

  it('der Verdict-Cue bleibt: zwei Töne 660/990 Hz für „richtig“', () => {
    setSoundEnabled(true);
    expect(playCue('correct')).toBe(true);
    expect(oscs.map((o) => o.frequency.value)).toEqual([660, 990]);
  });

  it('Lautstärke je Gerät: Normal ist der Standard, Leise = −12 dB', () => {
    expect(soundVolume()).toBe('normal');
    setSoundVolume('low');
    expect(soundVolume()).toBe('low');
    expect(store.get('lx:sound-vol')).toBe('low');
    expect(VOL_GAIN.low).toBeCloseTo(Math.pow(10, -12 / 20), 1);
    expect(VOL_GAIN.normal).toBe(1);
  });

  it('die Klangfolgen entsprechen der Tabelle (Aufstieg: 392 · 523 · 659 · 784, dann Akkord)', () => {
    expect(FX_VOICES.level.slice(0, 4).map((v) => [v.f, v.at])).toEqual([
      [392, 0],
      [523, 90],
      [659, 180],
      [784, 270],
    ]);
    expect(FX_VOICES.tick).toHaveLength(1);
    const peaks = Object.values(FX_VOICES).flat().map((v) => v.gain);
    expect(Math.max(...peaks)).toBeLessThan(0.1);
  });
});
