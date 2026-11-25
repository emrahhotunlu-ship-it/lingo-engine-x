import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARE_LOCK, catchUpWork } from '../../../src/features/vocab/autoSwitch';
import { noteInputActivity, quietPause, resetInputQuiet } from '../../../src/platform/inputQuiet';
import { tryTabLock } from '../../../src/platform/tabLock';

// Test-Link v113 (25.11.2026): Die Wörter-Runde wartet auf `catchUpDone`. Lief die Pflege (236 Aufträge, jeder mit Datenbank-Aufrufen)
// innerhalb dieses Wartens, blieb die Übungsseite weiß. Die Pflege darf das Nachholen nie aufhalten und Fehler nie nach außen geben.
// Test-Link v114: Pflege in Portionen; höchstens eine Ausführung zugleich (Sperre im Browser-Speicher), Budget-Fehler = Rest der Sitzung Ruhe.

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}
const storage = new MemStorage();

type W = Parameters<typeof catchUpWork>[1];
const writer = {} as W;
const snap = { raw: new Map(), valid: new Map(), invalid: [], counts: {}, possiblyTruncated: [] };
const tick = () => new Promise((r) => setTimeout(r, 5));

beforeAll(() => {
  vi.stubGlobal('window', { localStorage: storage, sessionStorage: new MemStorage() });
});
afterAll(() => {
  vi.unstubAllGlobals();
});
beforeEach(() => storage.clear());

describe('catchUpWork', () => {
  it('liefert das Nachholen, ohne auf die Pflege zu warten', async () => {
    const startCare = vi.fn(() => new Promise<null>(() => undefined));
    const out = await catchUpWork({ startCatchUp: () => Promise.resolve({ n: 3 }), startCare } as never, writer, () => Promise.resolve(snap), 1);
    expect(out).toEqual({ n: 3 });
    await tick();
    expect(startCare).toHaveBeenCalledTimes(1);
    // Pause und Sperre gehen an die Pflege.
    const args = startCare.mock.calls[0] as unknown[];
    expect(args.slice(0, 2)).toEqual([writer, snap]);
    const opts = args[3] as { pause?: unknown; keep?: unknown };
    expect([typeof opts.pause, typeof opts.keep]).toEqual(['function', 'function']);
  });

  it('ein Fehler der Pflege bricht weder Nachholen noch Runde ab; Sperre wieder frei', async () => {
    const startCare = vi.fn(() => Promise.reject(new Error('boom')));
    const out = await catchUpWork({ startCatchUp: () => Promise.resolve('ok'), startCare } as never, writer, () => Promise.resolve(snap), 1);
    expect(out).toBe('ok');
    await tick();
    expect(startCare).toHaveBeenCalled();
    expect(storage.getItem(`lx:${CARE_LOCK}`)).toBeNull();
  });

  it('zweiter Tab: Pflege läuft nicht, solange ein anderer die Sperre hält', async () => {
    const other = tryTabLock(CARE_LOCK, 60_000);
    expect(other).not.toBeNull();
    const startCare = vi.fn(() => Promise.resolve(null));
    await catchUpWork({ startCatchUp: () => Promise.resolve(null), startCare }, writer, () => Promise.resolve(snap), 1);
    await tick();
    expect(startCare).not.toHaveBeenCalled();
    other!.release();
  });

  it('Budget-Fehler (halted): in dieser Sitzung kein zweiter Versuch', async () => {
    const startCare = vi.fn(() => Promise.resolve({ done: 3, skip: 0, err: 0, halted: 'resource_exhausted', left: 10 }));
    const sw = { startCatchUp: () => Promise.resolve(null), startCare } as never;
    await catchUpWork(sw, writer, () => Promise.resolve(snap), 1);
    await tick();
    await catchUpWork(sw, writer, () => Promise.resolve(snap), 2);
    await tick();
    expect(startCare).toHaveBeenCalledTimes(1);
  });
});

describe('tryTabLock', () => {
  it('eine Sperre je Name; abgelaufen = frei; renew meldet Verlust; release nur durch den Halter', () => {
    let now = 1_000;
    const clock = () => now;
    const a = tryTabLock('x', 100, clock);
    expect(a).not.toBeNull();
    expect(tryTabLock('x', 100, clock)).toBeNull();
    expect(a!.renew()).toBe(true);
    now += 150;
    const b = tryTabLock('x', 100, clock);
    expect(b).not.toBeNull();
    expect(a!.renew()).toBe(false);
    a!.release();
    expect(storage.getItem('lx:x')).not.toBeNull();
    b!.release();
    expect(storage.getItem('lx:x')).toBeNull();
  });
});

describe('quietPause', () => {
  it('wartet die Pause und danach die Eingabe-Ruhe', async () => {
    vi.useFakeTimers();
    try {
      resetInputQuiet();
      let done = false;
      void quietPause(600).then(() => (done = true));
      await vi.advanceTimersByTimeAsync(500);
      noteInputActivity();
      await vi.advanceTimersByTimeAsync(200);
      expect(done).toBe(false);
      await vi.advanceTimersByTimeAsync(1_300);
      expect(done).toBe(true);
    } finally {
      vi.useRealTimers();
      resetInputQuiet();
    }
  });
});
