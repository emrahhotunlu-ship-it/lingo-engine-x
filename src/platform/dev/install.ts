import seedRaw from '../../../seed/sample-data.json?raw';
import { createFakeClaude, type FakeControl, type FakeOptions } from './fakeRuntime';
import { installFakeSpeech } from './fakeSpeech';

// Spielt die nachgebildete Laufzeit ein – aber nur, wenn es keine echte gibt.

export type InstallOptions = Omit<FakeOptions, 'seed'> & {
  seed?: 'sample' | 'empty' | FakeOptions['seed'];
  /** Einzelne Dokumente des Anfangsbestands ersetzen (Objekt) oder entfernen (null) – für Tests. */
  patch?: Record<string, Record<string, unknown> | null>;
  /** Sprachausgabe nachbilden (Headless-Chromium hat keine Stimmen); Standard: ja. */
  speech?: boolean;
};

declare global {
  interface Window {
    __LINGO_FAKE__?: FakeControl;
    __LINGO_FAKE_OPTIONS__?: InstallOptions;
  }
}

export function sampleSeed(): Record<string, Record<string, unknown>> {
  return JSON.parse(seedRaw) as Record<string, Record<string, unknown>>;
}

export function installFakeRuntime(opts: InstallOptions = {}): FakeControl | null {
  if ((window as { claude?: unknown }).claude) return null;
  const { seed, patch, speech, ...rest } = opts;
  const resolved: FakeOptions = { ...rest };
  let base: Record<string, Record<string, unknown>> = {};
  if (seed === 'sample' || seed === undefined) base = sampleSeed();
  else if (seed !== 'empty') base = seed;
  for (const [path, doc] of Object.entries(patch ?? {})) {
    if (doc === null) delete base[path];
    else base[path] = { ...(base[path] ?? {}), ...doc };
  }
  resolved.seed = base;
  const fake = createFakeClaude(resolved);
  Object.defineProperty(window, 'claude', { value: fake.claude, configurable: true, writable: false });
  if (speech !== false) installFakeSpeech(window, { spoken: fake.control.spoken });
  window.__LINGO_FAKE__ = fake.control;
  return fake.control;
}

/** Dev-Server: `?fake=nodb,nosample,empty,persist` steuert den Adapter. */
export function optionsFromUrl(search: string): InstallOptions {
  const flags = new Set((new URLSearchParams(search).get('fake') ?? '').split(',').filter(Boolean));
  return {
    capabilities: { db: !flags.has('nodb'), sample: !flags.has('nosample'), downloads: !flags.has('nodownloads') },
    seed: flags.has('empty') ? 'empty' : 'sample',
    persist: flags.has('persist'),
  };
}
