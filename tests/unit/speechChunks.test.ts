import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeSpeech } from '../../src/platform/dev/fakeSpeech';
import { getLog } from '../../src/platform/diagnostics';
import { initSpeech, resetSpeech, speak, speechChunks } from '../../src/platform/speech';
import { shadowPauseMs } from '../../src/features/listen/TranscriptView';

// Sprachausgabe für Hören (Plan §2.4): onChunk in Reihenfolge, Beginn bei einem Stück,
// Fehler im Rückruf werden protokolliert und stoppen die Ausgabe nicht.

const TEXT = 'First sentence is here. Second sentence follows now. Third sentence ends the text. A fourth one closes it all.';

describe('speak mit onChunk und startAt', () => {
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

  it('meldet jedes Stück vor dem Sprechen, in Reihenfolge', async () => {
    const fake = installFakeSpeech(win.window as object, { msPerChar: 1 });
    initSpeech();
    const seen: Array<[number, number]> = [];
    const chunks = speechChunks(TEXT);
    const p = speak(TEXT, { onChunk: (i, n) => seen.push([i, n]) });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe('done');
    expect(seen).toEqual(chunks.map((_, i) => [i, chunks.length]));
    expect(fake.spoken).toEqual(chunks);
  });

  it('startAt beginnt beim angegebenen Stück (Satz zurück), Grenzen werden geklemmt', async () => {
    const long = Array.from({ length: 12 }, (_, i) => `Sentence number ${i + 1} is long enough to need its own chunk in the output here.`).join(' ');
    const chunks = speechChunks(long);
    expect(chunks.length).toBeGreaterThan(3);
    const fake = installFakeSpeech(win.window as object, { msPerChar: 1 });
    initSpeech();
    const p = speak(long, { startAt: 2 });
    await vi.advanceTimersByTimeAsync(5000);
    await p;
    expect(fake.spoken).toEqual(chunks.slice(2));
    fake.spoken.length = 0;
    const q = speak(long, { startAt: 99 });
    await vi.advanceTimersByTimeAsync(2000);
    await q;
    expect(fake.spoken).toEqual(chunks.slice(-1));
  });

  it('Fehler im Rückruf: protokolliert, die Ausgabe läuft weiter', async () => {
    const fake = installFakeSpeech(win.window as object, { msPerChar: 1 });
    initSpeech();
    const p = speak(TEXT, {
      onChunk: () => {
        throw new Error('boom');
      },
    });
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toBe('done');
    expect(fake.spoken.length).toBe(speechChunks(TEXT).length);
    expect(getLog().some((e) => e.scope === 'speech:onChunk')).toBe(true);
  });

  it('Nachsprech-Pause beim Shadowing: mindestens 1,5 s, länger bei langen Stücken und langsamem Tempo', () => {
    expect(shadowPauseMs('Hi.', 1)).toBe(1500);
    expect(shadowPauseMs('x'.repeat(100), 1)).toBe(7000);
    expect(shadowPauseMs('x'.repeat(100), 0.8)).toBeGreaterThan(7000);
  });
});
