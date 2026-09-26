import type { SpeechVoiceLike } from '../speech';

// Nachgebildete Sprachausgabe (`speechSynthesis`) für Dev-Server, E2E- und Unit-Tests.
// Headless-Chromium hat meist keine Stimmen; die Nachbildung liefert Samantha (en-US, lokal,
// Standard) und Daniel (en-GB), protokolliert jede gesprochene Äußerung und verhält sich
// bei cancel() wie ein Browser (laufende: `interrupted`, wartende: `canceled`).
// Nur Entwicklung und Tests – nie Teil des Produktions-Builds.

export const FAKE_VOICES: readonly SpeechVoiceLike[] = Object.freeze([
  Object.freeze({ name: 'Samantha', lang: 'en-US', localService: true, default: true, voiceURI: 'com.apple.voice.compact.en-US.Samantha' }),
  Object.freeze({ name: 'Daniel', lang: 'en-GB', localService: true, default: false, voiceURI: 'com.apple.voice.compact.en-GB.Daniel' }),
]);

export type FakeSpeechOptions = {
  voices?: readonly SpeechVoiceLike[];
  /** Stimmen erst nach dieser Zeit liefern und dann `voiceschanged` auslösen (wie Safari/Chrome). */
  voicesDelayMs?: number;
  /** Sprechdauer je Zeichen (bei Tempo 1). */
  msPerChar?: number;
  /** Gemeinsames Protokoll, z. B. `control.spoken` des Entwicklungs-Adapters. */
  spoken?: string[];
};

export type FakeSpeechEvent = { type: 'speak' | 'start' | 'end' | 'cancel' | 'resume' | 'pause'; t: number; text?: string };

type Handler = ((ev: { error?: string }) => void) | null;

export class FakeUtterance {
  text: string;
  lang = '';
  voice: SpeechVoiceLike | null = null;
  rate = 1;
  pitch = 1;
  volume = 1;
  onstart: Handler = null;
  onend: Handler = null;
  onerror: Handler = null;
  onboundary: Handler = null;

  constructor(text = '') {
    this.text = text;
  }
}

export type FakeSpeechHandle = {
  synth: FakeSynth;
  Utterance: typeof FakeUtterance;
  /** Gesprochene, nicht leere Texte in Reihenfolge. */
  spoken: string[];
  /** Alle gesprochenen Äußerungen mit Einstellungen. */
  utterances: Array<{ text: string; lang: string; voice: string | null; rate: number; volume: number }>;
  events: FakeSpeechEvent[];
};

export class FakeSynth {
  paused = false;
  onvoiceschanged: (() => void) | null = null;
  private queue: FakeUtterance[] = [];
  private current: FakeUtterance | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private available: readonly SpeechVoiceLike[];
  private listeners = new Set<() => void>();

  constructor(
    private readonly all: readonly SpeechVoiceLike[],
    delayMs: number,
    private readonly msPerChar: number,
    private readonly handle: Pick<FakeSpeechHandle, 'spoken' | 'utterances' | 'events'>,
  ) {
    this.available = delayMs > 0 ? [] : all;
    if (delayMs > 0) setTimeout(() => this.setVoices(this.all), delayMs);
  }

  get speaking(): boolean {
    return this.current !== null;
  }

  get pending(): boolean {
    return this.queue.length > 0;
  }

  getVoices(): SpeechVoiceLike[] {
    return [...this.available];
  }

  /** Stimmen austauschen und `voiceschanged` auslösen. */
  setVoices(list: readonly SpeechVoiceLike[]): void {
    this.available = list;
    this.onvoiceschanged?.();
    this.listeners.forEach((fn) => fn());
  }

  addEventListener(type: string, fn: () => void): void {
    if (type === 'voiceschanged') this.listeners.add(fn);
  }

  removeEventListener(type: string, fn: () => void): void {
    if (type === 'voiceschanged') this.listeners.delete(fn);
  }

  speak(u: FakeUtterance): void {
    this.log('speak', u.text);
    this.queue.push(u);
    if (!this.current && !this.timer) this.timer = setTimeout(() => this.next(), 0);
  }

  cancel(): void {
    this.log('cancel');
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const cur = this.current;
    const waiting = this.queue;
    this.current = null;
    this.queue = [];
    cur?.onerror?.({ error: 'interrupted' });
    waiting.forEach((u) => u.onerror?.({ error: 'canceled' }));
  }

  pause(): void {
    this.log('pause');
    this.paused = true;
  }

  resume(): void {
    this.log('resume');
    this.paused = false;
  }

  private log(type: FakeSpeechEvent['type'], text?: string): void {
    this.handle.events.push(text === undefined ? { type, t: Date.now() } : { type, t: Date.now(), text });
  }

  private next(): void {
    this.timer = null;
    const u = this.queue.shift();
    if (!u) return;
    this.current = u;
    this.log('start', u.text);
    if (u.text.trim()) {
      this.handle.spoken.push(u.text);
      this.handle.utterances.push({ text: u.text, lang: u.lang, voice: u.voice?.name ?? null, rate: u.rate, volume: u.volume });
    }
    u.onstart?.({});
    const ms = Math.max(20, Math.round((u.text.length * this.msPerChar) / (u.rate || 1)));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.current = null;
      this.log('end', u.text);
      u.onend?.({});
      if (!this.current && !this.timer && this.queue.length) this.next();
    }, ms);
  }
}

export function createFakeSpeech(opts: FakeSpeechOptions = {}): FakeSpeechHandle {
  const handle = { spoken: opts.spoken ?? [], utterances: [], events: [] } as Pick<FakeSpeechHandle, 'spoken' | 'utterances' | 'events'>;
  const synth = new FakeSynth(opts.voices ?? FAKE_VOICES, opts.voicesDelayMs ?? 0, opts.msPerChar ?? 5, handle);
  return { ...handle, synth, Utterance: FakeUtterance };
}

/** Ersetzt `speechSynthesis` und `SpeechSynthesisUtterance` auf `target` (im Browser: `window`). */
export function installFakeSpeech(target: object, opts: FakeSpeechOptions = {}): FakeSpeechHandle {
  const fake = createFakeSpeech(opts);
  Object.defineProperty(target, 'speechSynthesis', { value: fake.synth, configurable: true, writable: true });
  Object.defineProperty(target, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true, writable: true });
  return fake;
}
