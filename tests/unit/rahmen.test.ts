import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Route } from '../../src/app/router/types';

// Neubau WP0b (plan.md §0 „Fortsetzen“, N04; §8 00:35 useWeek): Fortsetz-Laufzeit mit einem
// nachgebildeten Resumable (Momentaufnahme → Herstellen → gleiche Position), Frische-/Lerntags-/
// Versionsregeln, ✕ behält, reguläres Ende löscht; `app/week` genau ein Abo.

// ---- Browser-Speicher im Node-Test nachbilden (platform/storage liest window.localStorage)
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
beforeAll(() => {
  vi.stubGlobal('window', { localStorage: storage, sessionStorage: new MemStorage(), addEventListener: () => undefined, removeEventListener: () => undefined });
});

const snapCount = { n: 0 };
vi.mock('../../src/platform/capabilities', () => ({
  getDb: () => ({
    doc: () => ({
      onSnapshot: (cb: (s: { exists: boolean; data: () => unknown }) => void) => {
        snapCount.n++;
        cb({ exists: false, data: () => undefined });
        return () => {
          snapCount.n--;
        };
      },
    }),
  }),
  useCapabilities: () => true,
}));

type S = { pos: number; ids: string[] };

function fakeSession() {
  let state: S | null = null;
  const subs = new Set<() => void>();
  const set = (s: S | null) => {
    state = s;
    subs.forEach((f) => f());
  };
  const restored: S[] = [];
  return {
    get state() {
      return state;
    },
    set,
    restored,
    resumable: {
      id: 'fake',
      version: 2,
      origin: 'vocab' as const,
      snapshot: () => state,
      subscribe: (cb: () => void) => {
        subs.add(cb);
        return () => subs.delete(cb);
      },
      restore: (s: S) => {
        restored.push(s);
        state = s;
        return s.ids.length > 0;
      },
      route: () => ({ name: 'trainer', round: 'extra' }) as unknown as Route,
      label: (s: S) => `Karte ${s.pos + 1} von ${s.ids.length}`,
    },
  };
}

describe('Fortsetzen (resume.ts)', () => {
  let now = Date.parse('2026-09-20T21:00:00+02:00');
  let day = '2026-09-20';
  let uninstall: (() => void) | null = null;
  beforeEach(() => {
    storage.clear();
    now = Date.parse('2026-09-20T21:00:00+02:00');
    day = '2026-09-20';
  });
  afterEach(async () => {
    uninstall?.();
    uninstall = null;
    const r = await import('../../src/app/resume');
    r.resetResumeRuntime();
  });

  async function setup() {
    const r = await import('../../src/app/resume');
    const s = fakeSession();
    uninstall = r.installResume({ list: () => [s.resumable], now: () => now, day: () => day, tabId: () => 'tab1' });
    return { r, s };
  }

  it('speichert entprellt, stellt dieselbe Position her, nie mehr als die IDs', async () => {
    vi.useFakeTimers();
    const { r, s } = await setup();
    s.set({ pos: 6, ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
    expect(r.loadResume('fake')).toBeNull();
    vi.advanceTimersByTime(r.RESUME_DEBOUNCE_MS + 1);
    vi.useRealTimers();
    const env = r.loadResume('fake');
    expect(env).toMatchObject({ v: 2, id: 'fake', day, tabId: 'tab1', data: { pos: 6 } });
    const p = r.pendingResume();
    expect(p?.resumable.label(p.env.data as S, (k: string) => k)).toBe('Karte 7 von 8');
    const nav: Route[] = [];
    expect(r.restorePending(p!, (route) => nav.push(route))).toBe(true);
    expect(s.restored.at(-1)).toEqual({ pos: 6, ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] });
    expect(nav).toHaveLength(1);
  });

  it('reguläres Ende (null) löscht; ✕ (holdResume) behält trotz geleertem Store', async () => {
    const { r, s } = await setup();
    s.set({ pos: 1, ids: ['a', 'b'] });
    r.flushResume();
    expect(r.loadResume('fake')).not.toBeNull();
    s.set(null);
    r.flushResume();
    expect(r.loadResume('fake')).toBeNull();
    expect(r.pendingResume()).toBeNull();

    s.set({ pos: 1, ids: ['a', 'b'] });
    expect(r.holdResume()).toBe(true);
    s.set(null);
    r.flushResume();
    expect(r.loadResume('fake')).not.toBeNull();
    expect(r.pendingResume()?.env.data).toEqual({ pos: 1, ids: ['a', 'b'] });
  });

  it('verwirft fremden Lerntag, andere Version, zu alt; restore() === false verwirft', async () => {
    const { r, s } = await setup();
    s.set({ pos: 0, ids: ['a'] });
    r.flushResume();
    day = '2026-09-21';
    expect(r.pendingResume()).toBeNull();
    expect(r.loadResume('fake')).toBeNull();

    day = '2026-09-20';
    s.set({ pos: 0, ids: ['a'] });
    r.flushResume();
    now += r.RESUME_ROW_MS + 1;
    expect(r.pendingResume()).toBeNull();

    now = Date.parse('2026-09-20T21:00:00+02:00');
    s.set({ pos: 0, ids: ['a'] });
    r.flushResume();
    const env = r.loadResume('fake')!;
    storage.setItem('lx:resume:fake', JSON.stringify({ ...env, v: 1 }));
    expect(r.pendingResume()).toBeNull();

    s.set({ pos: 0, ids: [] });
    r.flushResume();
    const p = r.pendingResume();
    expect(p).not.toBeNull();
    expect(r.restorePending(p!, () => undefined)).toBe(false);
    expect(r.loadResume('fake')).toBeNull();
  });

  it('Frische: < 2 Min. automatisch, danach nur die Zeile; anderer Tab nie automatisch', async () => {
    const { r, s } = await setup();
    s.set({ pos: 3, ids: ['a', 'b', 'c', 'd'] });
    r.flushResume();
    expect(r.pendingResume()!.age).toBeLessThan(r.RESUME_AUTO_MS);
    now += r.RESUME_AUTO_MS + 1;
    const p = r.pendingResume()!;
    expect(p.age).toBeGreaterThan(r.RESUME_AUTO_MS);
    expect(p.otherTab).toBe(false);
    const env = r.loadResume('fake')!;
    storage.setItem('lx:resume:fake', JSON.stringify({ ...env, tabId: 'tab2' }));
    expect(r.pendingResume()!.otherTab).toBe(true);
  });

  it('zu große Momentaufnahme wird nicht geschrieben', async () => {
    const { r, s } = await setup();
    s.set({ pos: 0, ids: Array.from({ length: 20_000 }, (_, i) => `id-${i}`) });
    r.flushResume();
    expect(r.loadResume('fake')).toBeNull();
  });
});

describe('useWeek: genau ein Abo auf app/week (Referenzzählung)', () => {
  it('mehrere Nutzer teilen ein onSnapshot; das letzte Abmelden beendet es nach der Nachfrist', async () => {
    vi.useFakeTimers();
    const { watchWeek, resetWeekWatch } = await import('../../src/app/useWeek');
    resetWeekWatch();
    snapCount.n = 0;
    const a = watchWeek();
    const b = watchWeek();
    const c = watchWeek();
    expect(snapCount.n).toBe(1);
    a();
    b();
    c();
    expect(snapCount.n).toBe(1);
    const d = watchWeek();
    vi.advanceTimersByTime(1000);
    expect(snapCount.n).toBe(1);
    d();
    vi.advanceTimersByTime(1000);
    expect(snapCount.n).toBe(0);
    vi.useRealTimers();
  });
});
