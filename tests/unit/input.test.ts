import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Eingabeprofil (Lernplattform 2.0 §4.1): Einstellung vor Testschalter vor Medienabfrage, nie in der Datenbank.

type Win = { __LINGO_INPUT__?: 'touch' | 'keys'; matchMedia?: (q: string) => { matches: boolean; addEventListener: () => void; removeEventListener: () => void }; addEventListener: () => void; removeEventListener: () => void };
const store = new Map<string, string>();
let win: Win;

function setup(coarse: boolean): void {
  win = { matchMedia: (q) => ({ matches: q.includes('coarse') ? coarse : false, addEventListener: () => undefined, removeEventListener: () => undefined }), addEventListener: () => undefined, removeEventListener: () => undefined };
  Object.defineProperty(win, 'localStorage', {
    value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  });
  vi.stubGlobal('window', win);
}

async function load() {
  vi.resetModules();
  return import('../../src/platform/input');
}

beforeEach(() => store.clear());
afterEach(() => vi.unstubAllGlobals());

describe('inputProfile', () => {
  it('automatisch: Medienabfrage (coarse + hover none → touch)', async () => {
    setup(true);
    expect((await load()).inputProfile()).toBe('touch');
    setup(false);
    expect((await load()).inputProfile()).toBe('keys');
  });

  it('Testschalter schlägt die Medienabfrage', async () => {
    setup(false);
    win.__LINGO_INPUT__ = 'touch';
    expect((await load()).inputProfile()).toBe('touch');
  });

  it('Einstellung schlägt Testschalter und Medienabfrage', async () => {
    setup(true);
    win.__LINGO_INPUT__ = 'touch';
    const m = await load();
    m.setInputPref('keys');
    expect(m.inputProfile()).toBe('keys');
    expect(store.get('lx:input')).toBe('keys');
    m.setInputPref('auto');
    expect(m.inputProfile()).toBe('touch');
    expect(store.has('lx:input')).toBe(false);
  });

  it('ungültige gespeicherte Werte gelten als „automatisch“', async () => {
    setup(false);
    store.set('lx:input', 'tablet');
    const m = await load();
    expect(m.getInputPref()).toBe('auto');
    expect(m.inputProfile()).toBe('keys');
  });
});
