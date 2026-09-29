import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FAKE_VOICES, installFakeSpeech, type FakeSpeechHandle } from '../../src/platform/dev/fakeSpeech';
import { canVibrate, haptic } from '../../src/platform/haptics';
import {
  CANCEL_GAP_MS,
  chunkText,
  clampRate,
  initSpeech,
  pickVoice,
  resetSpeech,
  setSpeechPrefs,
  speak,
  stopSpeech,
  unlockSpeech,
  useSpeech,
  WAKE_MS,
  type SpeechVoiceLike,
} from '../../src/platform/speech';

const voice = (name: string, lang: string, localService = true): SpeechVoiceLike => ({
  name,
  lang,
  localService,
  default: false,
  voiceURI: name,
});

describe('chunkText', () => {
  it('kurzer Text bleibt ein Stück, Leerraum wird geglättet, leerer Text ergibt nichts', () => {
    expect(chunkText('  Hello   there.\n')).toEqual(['Hello there.']);
    expect(chunkText('   ')).toEqual([]);
  });

  it('trennt an Satzgrenzen und fasst zusammen, solange ≤ 150 Zeichen', () => {
    const s1 = 'The quarterly report is due on Friday.';
    const s2 = 'Could you send me the latest figures by Wednesday?';
    const s3 = 'I would like to double-check the numbers with the finance team before we share them; they asked for a short summary first.';
    const chunks = chunkText(`${s1} ${s2} ${s3}`);
    expect(chunks).toEqual([`${s1} ${s2}`, s3]);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(150);
  });

  it('lange Sätze: erst an Kommas, dann an Leerzeichen; überlange Wörter werden hart geteilt', () => {
    const clause = 'we reviewed the contract terms with the legal department in detail';
    const sentence = `${clause}, ${clause}, ${clause}.`;
    const chunks = chunkText(sentence);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(150);
    expect(chunks[0]!.endsWith(',')).toBe(true);
    expect(chunks.join(' ')).toBe(sentence);

    const noPunct = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
    const byWords = chunkText(noPunct);
    for (const c of byWords) expect(c.length).toBeLessThanOrEqual(150);
    expect(byWords.join(' ')).toBe(noPunct);

    const giant = 'x'.repeat(320);
    expect(chunkText(giant)).toEqual(['x'.repeat(150), 'x'.repeat(150), 'x'.repeat(20)]);
  });

  it('verliert kein Zeichen, auch mit Zitaten, Zahlen und Abkürzungen', () => {
    const text =
      'He said, "It costs 3.5 million." Mr. Smith agreed! Did the U.S. team confirm? Yes: the deadline is final; no extensions. ' +
      'We will meet again next week to review the rollout plan in more detail and assign owners to each open item on the list.';
    const chunks = chunkText(text);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(150);
    expect(chunks.join(' ')).toBe(text);
  });
});

describe('pickVoice', () => {
  const list = [
    voice('Anna', 'de-DE'),
    voice('Daniel', 'en-GB'),
    voice('Google US English', 'en-US', false),
    voice('Samantha', 'en-US', true),
    voice('Ava (Premium)', 'en-US', false),
  ];

  it('gespeicherte Stimme gewinnt, wenn sie englisch ist', () => {
    expect(pickVoice(list, 'Daniel')).toBe(1);
    expect(pickVoice(list, 'Anna')).toBe(4);
    expect(pickVoice(list, 'Unbekannt')).toBe(4);
  });

  it('Reihenfolge: Premium/Enhanced → en-US lokal → en-US → en-* → −1', () => {
    expect(pickVoice(list)).toBe(4);
    expect(pickVoice(list.slice(0, 4))).toBe(3);
    expect(pickVoice(list.slice(0, 3))).toBe(2);
    expect(pickVoice([voice('Anna', 'de-DE'), voice('Karen', 'en_AU')])).toBe(1);
    expect(pickVoice([voice('Anna', 'de-DE')])).toBe(-1);
    expect(pickVoice([])).toBe(-1);
  });

  it('Sprechtempo wird auf 0,8–1,1 begrenzt', () => {
    expect(clampRate(undefined)).toBe(1);
    expect(clampRate(Number.NaN)).toBe(1);
    expect(clampRate(0.5)).toBe(0.8);
    expect(clampRate(1.5)).toBe(1.1);
    expect(clampRate(0.9)).toBe(0.9);
  });
});

describe('Sprachausgabe mit nachgebildetem speechSynthesis', () => {
  let fake: FakeSpeechHandle;
  const win = globalThis as { window?: unknown };

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

  it('ohne speechSynthesis: unsupported, speak liefert unavailable', async () => {
    initSpeech();
    expect(useSpeech.getState().status).toBe('unsupported');
    await expect(speak('Hello.')).resolves.toBe('unavailable');
  });

  it('Stimmen kommen verzögert: erst loading, dann nach voiceschanged ready mit Samantha', () => {
    fake = installFakeSpeech(win.window as object, { voicesDelayMs: 700 });
    initSpeech();
    expect(useSpeech.getState().status).toBe('loading');
    vi.advanceTimersByTime(700);
    expect(useSpeech.getState()).toMatchObject({ status: 'ready', voiceName: 'Samantha' });
    setSpeechPrefs({ voice: 'Daniel' });
    expect(useSpeech.getState().voiceName).toBe('Daniel');
  });

  it('nur nicht-englische Stimmen: novoice; gar keine Stimmen nach 2 s: novoice', () => {
    installFakeSpeech(win.window as object, { voices: [voice('Anna', 'de-DE')] });
    initSpeech();
    expect(useSpeech.getState().status).toBe('novoice');
    resetSpeech();
    installFakeSpeech(win.window as object, { voices: [] });
    initSpeech();
    vi.advanceTimersByTime(1999);
    expect(useSpeech.getState().status).toBe('loading');
    vi.advanceTimersByTime(1);
    expect(useSpeech.getState().status).toBe('novoice');
  });

  it('spricht Stücke nacheinander mit en-US-Stimme und begrenztem Tempo', async () => {
    fake = installFakeSpeech(win.window as object);
    initSpeech({ rate: 2 });
    const text = `${'The supplier confirmed the delivery date for the new parts. '.repeat(3)}Please update the plan.`;
    const done = speak(text);
    await vi.runAllTimersAsync();
    await expect(done).resolves.toBe('done');
    expect(fake.spoken).toEqual(chunkText(text));
    expect(fake.spoken.length).toBeGreaterThan(1);
    for (const u of fake.utterances) expect(u).toMatchObject({ voice: 'Samantha', lang: 'en-US', rate: 1.1, volume: 1 });
    expect(useSpeech.getState().speaking).toBe(false);
  });

  it('neue Ausgabe ersetzt die laufende: alte meldet stopped, neue startet erst 60 ms nach cancel()', async () => {
    fake = installFakeSpeech(win.window as object);
    initSpeech();
    const first = speak('This is a long sentence that keeps the voice busy for a while.');
    await vi.advanceTimersByTimeAsync(10);
    expect(fake.synth.speaking).toBe(true);
    const second = speak('Second.');
    await expect(first).resolves.toBe('stopped');
    const cancelAt = fake.events.find((e) => e.type === 'cancel')!.t;
    await vi.advanceTimersByTimeAsync(CANCEL_GAP_MS - 1);
    expect(fake.events.filter((e) => e.type === 'speak').map((e) => e.text)).not.toContain('Second.');
    await vi.advanceTimersByTimeAsync(1);
    const speakSecond = fake.events.find((e) => e.type === 'speak' && e.text === 'Second.')!;
    expect(speakSecond.t - cancelAt).toBeGreaterThanOrEqual(CANCEL_GAP_MS);
    await vi.runAllTimersAsync();
    await expect(second).resolves.toBe('done');
    expect(fake.spoken).toEqual(['This is a long sentence that keeps the voice busy for a while.', 'Second.']);
  });

  it('stopSpeech hält sofort an; direkt danach wartet speak die 60 ms ab', async () => {
    fake = installFakeSpeech(win.window as object);
    initSpeech();
    const p = speak('Hello there, this is a test of the stop button.');
    await vi.advanceTimersByTimeAsync(5);
    stopSpeech();
    await expect(p).resolves.toBe('stopped');
    expect(fake.synth.speaking).toBe(false);
    const next = speak('Again.');
    await vi.advanceTimersByTimeAsync(CANCEL_GAP_MS - 1);
    expect(fake.events.some((e) => e.type === 'speak' && e.text === 'Again.')).toBe(false);
    await vi.runAllTimersAsync();
    await expect(next).resolves.toBe('done');
  });

  it('Wecker: alle 5 s resume(), solange gesprochen wird; danach nicht mehr', async () => {
    fake = installFakeSpeech(win.window as object, { msPerChar: 200 });
    initSpeech();
    const p = speak('A slow voice reads this sentence.');
    await vi.advanceTimersByTimeAsync(WAKE_MS * 1 + 1);
    expect(fake.events.filter((e) => e.type === 'resume')).toHaveLength(1);
    await vi.runAllTimersAsync();
    await p;
    const resumes = fake.events.filter((e) => e.type === 'resume').length;
    await vi.advanceTimersByTimeAsync(WAKE_MS * 3);
    expect(fake.events.filter((e) => e.type === 'resume')).toHaveLength(resumes);
  });

  it('kein Wecker auf iPhone/iPad: resume() während echtem Sprechen stottert dort selbst (Befund 29.09.)', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15' });
    fake = installFakeSpeech(win.window as object, { msPerChar: 200 });
    initSpeech();
    const p = speak('A slow voice reads this long sentence well past the five second wake timer mark.');
    await vi.advanceTimersByTimeAsync(WAKE_MS * 3);
    expect(fake.events.filter((e) => e.type === 'resume')).toHaveLength(0);
    await vi.runAllTimersAsync();
    await p;
    vi.unstubAllGlobals();
  });

  it('iPadOS meldet sich als MacIntel mit Touch: auch dort kein Wecker', async () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)', platform: 'MacIntel', maxTouchPoints: 5 });
    fake = installFakeSpeech(win.window as object, { msPerChar: 200 });
    initSpeech();
    const p = speak('A slow voice reads this long sentence well past the five second wake timer mark.');
    await vi.advanceTimersByTimeAsync(WAKE_MS * 3);
    expect(fake.events.filter((e) => e.type === 'resume')).toHaveLength(0);
    await vi.runAllTimersAsync();
    await p;
    vi.unstubAllGlobals();
  });

  it('unlockSpeech: eine stumme, leere Äußerung, nur einmal', () => {
    fake = installFakeSpeech(win.window as object);
    initSpeech();
    unlockSpeech();
    unlockSpeech();
    const speaks = fake.events.filter((e) => e.type === 'speak');
    expect(speaks).toEqual([expect.objectContaining({ text: '' })]);
    expect(fake.spoken).toEqual([]);
  });

  it('die Nachbildung liefert Samantha (en-US) und Daniel (en-GB)', () => {
    expect(FAKE_VOICES.map((v) => `${v.name}:${v.lang}`)).toEqual(['Samantha:en-US', 'Daniel:en-GB']);
  });
});

describe('haptic', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('iPhone ohne navigator.vibrate: kein Aufruf, kein Fehler', () => {
    vi.stubGlobal('navigator', { userAgent: 'iPhone' });
    expect(canVibrate()).toBe(false);
    expect(haptic('success')).toBe(false);
  });

  it('mit vibrate: Muster je Art', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(canVibrate()).toBe(true);
    expect(haptic('tap')).toBe(true);
    expect(haptic('error')).toBe(true);
    expect(vibrate).toHaveBeenNthCalledWith(1, 8);
    expect(vibrate).toHaveBeenNthCalledWith(2, [30, 60, 30]);
  });

  it('wirft vibrate, bleibt es still', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(haptic('tap')).toBe(false);
  });
});
