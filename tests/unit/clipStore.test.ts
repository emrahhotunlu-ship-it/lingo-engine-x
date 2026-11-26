import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ClipBackend,
  clipStoreKey,
  clipStored,
  dropOtherVersions,
  fromPcm16,
  noteClipUse,
  openClipStore,
  readClip,
  resetClipStore,
  toPcm16,
  useClipStore,
  writeClip,
} from '../../src/platform/voice/clipStore';

// Stimme 2.0 (Emrah 26.11.2026: „IMMER die gute Stimme, schnell und immer verfügbar“): Tonvorrat – jeder gerechnete Satz bleibt im Browser,
// zuletzt benutzte bleiben bei vollem Deckel, jeder Speicherfehler führt still zu „ohne Vorrat weiter“.

type Rec = { pcm: ArrayBuffer; rate: number };
type Meta = { b: number; at: number };

function memBackend(opts: { quotaBytes?: number; failOpen?: boolean; hangOpen?: boolean } = {}) {
  const clips = new Map<string, Rec>();
  const metaMap = new Map<string, Meta>();
  let used = 0;
  const b: ClipBackend & { clips: Map<string, Rec> } = {
    clips,
    metas() {
      return Promise.resolve([...metaMap]);
    },
    get(k) {
      return Promise.resolve(clips.get(k) ?? null);
    },
    put(k, rec, meta) {
      if (opts.quotaBytes !== undefined && used + rec.pcm.byteLength > opts.quotaBytes) {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        return Promise.reject(e);
      }
      clips.set(k, rec);
      metaMap.set(k, meta);
      used += rec.pcm.byteLength;
      return Promise.resolve();
    },
    touch(entries) {
      for (const [k, m] of entries) metaMap.set(k, m);
      return Promise.resolve();
    },
    del(keys) {
      for (const k of keys) {
        const r = clips.get(k);
        if (r) used -= r.pcm.byteLength;
        clips.delete(k);
        metaMap.delete(k);
      }
      return Promise.resolve();
    },
  };
  const factory = (): Promise<ClipBackend> => (opts.failOpen ? Promise.reject(new Error('SecurityError: private')) : opts.hangOpen ? new Promise<ClipBackend>(() => undefined) : Promise.resolve(b));
  return { b, factory };
}

const clip = (n: number, v = 0.5) => ({ audio: new Float32Array(n).fill(v), rate: 24000 });
const g = globalThis as { window?: unknown };
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

describe('Tonvorrat', () => {
  beforeEach(() => {
    g.window = { localStorage: new FakeStorage() };
  });
  afterEach(() => {
    resetClipStore();
    delete g.window;
    vi.useRealTimers();
  });

  it('Schlüssel: Leerraum vereinheitlicht, Stimme, Tempo und Paket-Stand zählen', () => {
    expect(clipStoreKey('v1', 'af_heart', 1, '  Hello   there. ')).toBe('v1|af_heart|1.00|Hello there.');
    expect(clipStoreKey('v1', 'af_heart', 0.8, 'Hello')).not.toBe(clipStoreKey('v1', 'af_heart', 1, 'Hello'));
    expect(clipStoreKey('v2', 'af_heart', 1, 'Hello')).not.toBe(clipStoreKey('v1', 'af_heart', 1, 'Hello'));
    expect(clipStoreKey('v1', 'am_michael', 1, 'Hello')).not.toBe(clipStoreKey('v1', 'af_heart', 1, 'Hello'));
  });

  it('16-Bit-Ton: halb so groß, hin und zurück fast gleich', () => {
    const f = new Float32Array([0, 0.5, -0.5, 1, -1, 1.7, -3]);
    const p = toPcm16(f);
    expect(p.byteLength).toBe(f.byteLength / 2);
    const back = fromPcm16(p);
    for (let i = 0; i < 5; i++) expect(Math.abs((back[i] as number) - (f[i] as number))).toBeLessThan(1e-4);
    expect(back[5]).toBeCloseTo(1, 4);
    expect(back[6]).toBeCloseTo(-1, 4);
  });

  it('speichert und findet einen Satz, auch nach einem neuen Öffnen (dauerhaft)', async () => {
    const { b, factory } = memBackend();
    resetClipStore(factory);
    expect(await openClipStore()).toBe(true);
    const k = clipStoreKey('v1', 'af_heart', 1, 'Hello.');
    expect(clipStored(k)).toBe(false);
    await writeClip(k, clip(2400));
    expect(clipStored(k)).toBe(true);
    expect(useClipStore.getState()).toMatchObject({ on: true, count: 1, bytes: 4800 });
    // „Neue Sitzung“: derselbe Speicher, frischer Zustand.
    resetClipStore(() => Promise.resolve(b));
    await openClipStore();
    expect(clipStored(k)).toBe(true);
    const got = await readClip(k);
    expect(got?.rate).toBe(24000);
    expect(got?.audio.length).toBe(2400);
    expect(got?.audio[0]).toBeCloseTo(0.5, 3);
  });

  it('LRU: über dem Deckel fallen die am längsten nicht benutzten Sätze weg', async () => {
    vi.useFakeTimers();
    const { factory } = memBackend();
    // Deckel 10.000 Byte; je Satz 2.000 Byte.
    resetClipStore(factory, 10_000);
    await openClipStore();
    const keys = ['a', 'b', 'c', 'd', 'e'].map((x) => clipStoreKey('v1', 'af_heart', 1, x));
    for (const [i, k] of keys.entries()) {
      vi.setSystemTime(1_000 + i * 1_000);
      await writeClip(k, clip(1000));
    }
    // „a“ wird wieder benutzt → zuletzt benutzt.
    vi.setSystemTime(10_000);
    await readClip(keys[0] as string);
    vi.setSystemTime(11_000);
    await writeClip(clipStoreKey('v1', 'af_heart', 1, 'f'), clip(1000));
    expect(useClipStore.getState().bytes).toBeLessThanOrEqual(10_000);
    expect(clipStored(keys[0] as string)).toBe(true);
    expect(clipStored(keys[1] as string)).toBe(false);
    expect(clipStored(clipStoreKey('v1', 'af_heart', 1, 'f'))).toBe(true);
  });

  it('kein Speicher (privates Fenster): ohne Vorrat weiter, nichts wirft', async () => {
    const { factory } = memBackend({ failOpen: true });
    resetClipStore(factory);
    expect(await openClipStore()).toBe(false);
    const k = clipStoreKey('v1', 'af_heart', 1, 'Hello.');
    await expect(writeClip(k, clip(100))).resolves.toBeUndefined();
    await expect(readClip(k)).resolves.toBeNull();
    expect(clipStored(k)).toBe(false);
    expect(useClipStore.getState()).toMatchObject({ ready: true, on: false });
  });

  it('Safari hängt beim Öffnen: nach 3 s ohne Vorrat weiter', async () => {
    vi.useFakeTimers();
    const { factory } = memBackend({ hangOpen: true });
    resetClipStore(factory);
    const p = openClipStore();
    await vi.advanceTimersByTimeAsync(3_100);
    await expect(p).resolves.toBe(false);
  });

  it('Speicher voll: räumt und versucht einmal; geht es nicht, liest er weiter, schreibt aber nicht mehr', async () => {
    const { b, factory } = memBackend({ quotaBytes: 5_000 });
    resetClipStore(factory);
    await openClipStore();
    const k1 = clipStoreKey('v1', 'af_heart', 1, 'one');
    const k2 = clipStoreKey('v1', 'af_heart', 1, 'two');
    await writeClip(k1, clip(2000));
    // Zweiter Satz passt nicht: k1 wird geräumt, dann passt er.
    await writeClip(k2, clip(2000));
    expect(clipStored(k2)).toBe(true);
    // Ein Satz größer als der ganze Speicher: auch nach dem Räumen kein Platz → nur noch lesen.
    await writeClip(clipStoreKey('v1', 'af_heart', 1, 'huge'), clip(4000));
    await writeClip(clipStoreKey('v1', 'af_heart', 1, 'small'), clip(10));
    expect(b.clips.has(clipStoreKey('v1', 'af_heart', 1, 'small'))).toBe(false);
  });

  it('neues Stimmen-Paket: Töne des alten Stands werden entfernt, der Stand gemerkt', async () => {
    const { factory } = memBackend();
    resetClipStore(factory);
    await openClipStore();
    const old = clipStoreKey('v1', 'af_heart', 1, 'Hello.');
    await writeClip(old, clip(100));
    await dropOtherVersions('v2');
    expect(clipStored(old)).toBe(false);
    expect((g.window as { localStorage: FakeStorage }).localStorage.getItem('lx:voice-ver')).toBe('v2');
  });

  it('Treffer-Quote heute für die Diagnose', () => {
    resetClipStore(memBackend().factory);
    noteClipUse(true);
    noteClipUse(true);
    noteClipUse(false);
    expect(useClipStore.getState()).toMatchObject({ hits: 2, misses: 1 });
  });
});
