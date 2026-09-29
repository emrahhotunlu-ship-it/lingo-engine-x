import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeSpeech, FAKE_VOICES } from '../../src/platform/dev/fakeSpeech';
import { installFakeStt } from '../../src/platform/dev/fakeStt';
import { initSpeech, listVoices, previewVoice, PREVIEW_TEXT, resetSpeech, speechPrefs, useSpeech, type SpeechVoiceLike } from '../../src/platform/speech';
import { initStt, listen, resetStt, STT_BLOCKED_KEY, useStt } from '../../src/platform/stt';

// Stimme und Spracheingabe (Plan §7, §9.1): Stimmenliste, Probehören ohne Änderung der Wahl,
// Erkennung der Spracheingabe, Sperre nach not-allowed, localStorage wirft → kein Absturz.

const win = globalThis as { window?: unknown; document?: unknown };

function memoryStorage(throwing = false): Storage {
  const m = new Map<string, string>();
  const fail = () => {
    throw new Error('SecurityError');
  };
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (throwing ? fail() : (m.get(k) ?? null)),
    setItem: (k: string, v: string) => (throwing ? fail() : void m.set(k, v)),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
  };
}

describe('Stimmen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetSpeech();
    win.window = {};
  });
  afterEach(() => {
    resetSpeech();
    delete win.window;
    vi.useRealTimers();
  });

  it('listVoices: nur englisch, en-US zuerst', () => {
    const de: SpeechVoiceLike = { name: 'Anna', lang: 'de-DE', localService: true, default: false, voiceURI: 'a' };
    const alex: SpeechVoiceLike = { name: 'Alex', lang: 'en_US', localService: false, default: false, voiceURI: 'b' };
    const list = listVoices([...FAKE_VOICES, de, alex].reverse());
    expect(list.map((v) => v.name)).toEqual(['Alex', 'Samantha', 'Daniel']);
    expect(list[0]).toEqual({ name: 'Alex', lang: 'en-US', local: false, us: true });
  });

  it('listVoices: iOS-Spaß-Stimmen (Zarvox, Bad News, …) tauchen nicht auf (Befund 29.09.)', () => {
    const zarvox: SpeechVoiceLike = { name: 'Zarvox', lang: 'en-US', localService: true, default: false, voiceURI: 'z' };
    const badNews: SpeechVoiceLike = { name: 'Bad News', lang: 'en-US', localService: true, default: false, voiceURI: 'bn' };
    const list = listVoices([...FAKE_VOICES, zarvox, badNews]);
    expect(list.map((v) => v.name)).toEqual(['Samantha', 'Daniel']);
  });

  it('useSpeech.voices wird befüllt; Probehören spricht mit genau dieser Stimme, ohne die Wahl zu ändern', async () => {
    const fake = installFakeSpeech(win.window as object);
    initSpeech({ voice: 'Samantha' });
    expect(useSpeech.getState().voices?.map((v) => v.name)).toEqual(['Samantha', 'Daniel']);
    const p = previewVoice('Daniel');
    await vi.runAllTimersAsync();
    await p;
    expect(fake.utterances.at(-1)).toMatchObject({ text: PREVIEW_TEXT, voice: 'Daniel' });
    expect(speechPrefs().voice).toBe('Samantha');
    expect(useSpeech.getState().voiceName).toBe('Samantha');
  });
});

describe('Spracheingabe', () => {
  beforeEach(() => {
    resetStt();
    win.window = { localStorage: memoryStorage() };
    win.document = {};
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    delete win.window;
    delete win.document;
  });

  it('keine Schnittstelle → unsupported', () => {
    installFakeStt(win.window as Window, 'absent');
    expect(initStt()).toBe('unsupported');
  });

  it('Permissions-Policy sperrt das Mikrofon → blocked', () => {
    installFakeStt(win.window as Window, 'ok');
    win.document = { permissionsPolicy: { allowsFeature: (f: string) => f !== 'microphone' } };
    expect(initStt()).toBe('blocked');
  });

  it('verfügbar: Zwischenstand, dann Text – nie automatisch gesendet', async () => {
    const h = installFakeStt(win.window as Window, 'ok');
    expect(initStt()).toBe('available');
    const interim: string[] = [];
    const p = listen({ lang: 'en-US', signal: new AbortController().signal, onInterim: (t) => interim.push(t) });
    expect(useStt.getState().listening).toBe(true);
    h.say('The exposure here is real');
    await expect(p).resolves.toEqual({ text: 'The exposure here is real' });
    expect(interim[0]).toBe('The exposure');
    expect(useStt.getState().listening).toBe(false);
  });

  it('not-allowed beim Start → blocked und gemerkt; nach Neuladen weiterhin blocked', async () => {
    installFakeStt(win.window as Window, 'blocked');
    expect(initStt()).toBe('available');
    await expect(listen({ lang: 'en-US', signal: new AbortController().signal })).resolves.toEqual({ error: 'blocked' });
    expect(useStt.getState().status).toBe('blocked');
    expect((win.window as { localStorage: Storage }).localStorage.getItem(STT_BLOCKED_KEY)).toBeTruthy();
    resetStt();
    expect(initStt()).toBe('blocked');
  });

  it('localStorage wirft → kein Absturz', () => {
    win.window = { localStorage: memoryStorage(true) };
    installFakeStt(win.window as Window, 'ok');
    expect(() => initStt()).not.toThrow();
    expect(useStt.getState().status).toBe('available');
  });

  it('Abbruch per Signal → aborted', async () => {
    const h = installFakeStt(win.window as Window, 'ok');
    initStt();
    const ctl = new AbortController();
    const p = listen({ lang: 'en-US', signal: ctl.signal });
    ctl.abort();
    await expect(p).resolves.toEqual({ error: 'aborted' });
    h.say('too late');
  });
});
