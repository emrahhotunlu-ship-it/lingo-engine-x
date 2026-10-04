import seedRaw from '../../../seed/sample-data.json?raw';
import { createFakeClaude, type FakeControl, type FakeOptions } from './fakeRuntime';
import { FAKE_VOICES, installFakeSpeech } from './fakeSpeech';
import type { SpeechVoiceLike } from '../speech';

import { installFakeStt, type FakeSttMode } from './fakeStt';

const FAKE_DE_VOICE: SpeechVoiceLike = Object.freeze({ name: 'Anna', lang: 'de-DE', localService: true, default: false, voiceURI: 'com.apple.voice.compact.de-DE.Anna' });
// Befund 29.09. (Emrah, „weiterhin komplett nutzlose Stimmen"): die Stimmenwahl zeigt nur noch
// en-US (A7.3). Für die Prüfung des Umschaltens braucht es also eine zweite en-US-Stimme.
const FAKE_US_VOICE2: SpeechVoiceLike = Object.freeze({ name: 'Zoe', lang: 'en-US', localService: true, default: false, voiceURI: 'com.apple.voice.compact.en-US.Zoe' });

// Spielt die nachgebildete Laufzeit ein – aber nur, wenn es keine echte gibt.

export type InstallOptions = Omit<FakeOptions, 'seed'> & {
  /** `large` (P7-1): Großdatensatz, zur Laufzeit aus dem Seed erzeugt (1.500 Vokabeln, 400 Radar-Ereignisse, 2 Jahre Profil). */
  seed?: 'sample' | 'empty' | 'large' | FakeOptions['seed'];
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

const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** Großdatensatz für Leistungsmessungen (P7-1), nicht eingecheckt: aus dem Seed vervielfältigt. */
export function largeSeed(): Record<string, Record<string, unknown>> {
  const base = sampleSeed();
  const vocab = Object.entries(base).filter(([p]) => p.startsWith('vocab/'));
  let n = 0;
  while (Object.keys(base).filter((p) => p.startsWith('vocab/')).length < 1500) {
    const [p, d] = vocab[n % vocab.length] ?? ['', {}];
    const id = `${p.slice(6)}-x${n}`;
    base[`vocab/${id}`] = { ...d, id, word: `${String(d.word)}${n}` };
    n++;
  }
  const radar = base['app/radar'] ?? {};
  const ev = Array.isArray(radar.events) ? (radar.events as Array<Record<string, unknown>>) : [];
  base['app/radar'] = { ...radar, events: Array.from({ length: 400 }, (_, i) => ({ ...(ev[i % Math.max(1, ev.length)] ?? { c: 'tense', s: 'g', q: 'q', g: 'g', a: 'a' }), t: Date.parse('2026-09-20T12:00:00Z') - i * 3_600_000 })) };
  const profile = { ...(base['app/profile'] ?? {}) };
  const days = { ...(profile.days as Record<string, number>) };
  const xpDays = { ...(profile.xpDays as Record<string, number>) };
  const minutes = { ...(profile.minutes as Record<string, number>) };
  const act = { ...(profile.act as Record<string, Record<string, number>>) };
  for (let k = 0; k < 730; k++) {
    const d = keyOf(Date.parse('2026-09-20T12:00:00Z') - k * DAY_MS);
    days[d] ??= 20 + (k % 9);
    xpDays[d] ??= 120;
    minutes[d] ??= 14;
    act[d] ??= { cards: 1, gram: 1 };
  }
  base['app/profile'] = { ...profile, days, xpDays, minutes, act };
  return base;
}

export function installFakeRuntime(opts: InstallOptions = {}): FakeControl | null {
  if ((window as { claude?: unknown }).claude) return null;
  const { seed, patch, speech, stt, ...rest } = opts;
  const resolved: FakeOptions = { ...rest };
  let base: Record<string, Record<string, unknown>> = {};
  if (seed === 'sample' || seed === undefined) base = sampleSeed();
  else if (seed === 'large') base = largeSeed();
  else if (seed !== 'empty') base = seed;
  for (const [path, doc] of Object.entries(patch ?? {})) {
    if (doc === null) delete base[path];
    else base[path] = { ...(base[path] ?? {}), ...doc };
  }
  resolved.seed = base;
  const fake = createFakeClaude(resolved);
  Object.defineProperty(window, 'claude', { value: fake.claude, configurable: true, writable: false });
  // Phase 3 (Plan §9.5): zusätzlich eine deutsche Stimme – die Stimmenwahl zeigt nur englische.
  if (speech !== false) installFakeSpeech(window, { spoken: fake.control.spoken, voices: [...FAKE_VOICES, FAKE_DE_VOICE, FAKE_US_VOICE2] });
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
    seed: flags.has('empty') ? 'empty' : flags.has('large') ? 'large' : 'sample',
    persist: flags.has('persist'),
    // Phase 5: langsames Streaming für den Scroll-Test (`?fake=slowsample`).
    ...(flags.has('slowsample') ? { sampleTickMs: 150 } : {}),
    // Phase 6: erste Einschätzung schemawidrig (`?fake=assessbad`).
    ...(flags.has('assessbad') ? { assessBad: true } : {}),
  };
}
