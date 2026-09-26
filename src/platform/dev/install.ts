import seedRaw from '../../../seed/sample-data.json?raw';
import { createFakeClaude, type FakeControl, type FakeOptions } from './fakeRuntime';
import { FAKE_VOICES, installFakeSpeech } from './fakeSpeech';
import type { SpeechVoiceLike } from '../speech';

import { installFakeStt, type FakeSttMode } from './fakeStt';

const FAKE_DE_VOICE: SpeechVoiceLike = Object.freeze({ name: 'Anna', lang: 'de-DE', localService: true, default: false, voiceURI: 'com.apple.voice.compact.de-DE.Anna' });

// Spielt die nachgebildete Laufzeit ein – aber nur, wenn es keine echte gibt.

export type InstallOptions = Omit<FakeOptions, 'seed'> & {
  seed?: 'sample' | 'empty' | FakeOptions['seed'];
  /** Einzelne Dokumente des Anfangsbestands ersetzen (Objekt) oder entfernen (null) – für Tests. */
  patch?: Record<string, Record<string, unknown> | null>;
  /** Sprachausgabe nachbilden (Headless-Chromium hat keine Stimmen); Standard: ja. */
  speech?: boolean;
  /** Phase 3: Spracheingabe nachbilden; Standard 'absent' (kein Mikrofon-Knopf). */
  stt?: FakeSttMode;
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
  const { seed, patch, speech, stt, ...rest } = opts;
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
  // Phase 3 (Plan §9.5): zusätzlich eine deutsche Stimme – die Stimmenwahl zeigt nur englische.
  if (speech !== false) installFakeSpeech(window, { spoken: fake.control.spoken, voices: [...FAKE_VOICES, FAKE_DE_VOICE] });
  const sttHandle = installFakeStt(window, stt ?? 'absent');
  fake.control.sttSay = (text: string) => sttHandle.say(text);
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
