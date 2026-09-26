import { create } from 'zustand';
import { logWarn } from './diagnostics';

// Sprachausgabe (A7.4, Kap. 15 „Sprachausgabe am Handy abgehackt", Architektur-Entwurf §10.3).
// iPhone/Safari zuerst:
// - Stimmen kommen verzögert: getVoices() sofort und nach 250/500/1000/2000 ms, dazu `voiceschanged`.
// - Stücke ≤ 150 Zeichen, an Satzgrenzen getrennt, nacheinander gesprochen.
// - Nach cancel() 60 ms warten, sonst verschluckt Safari die nächste Äußerung.
// - Wecker: alle 5 s resume(), solange gesprochen wird (gegen stilles Pausieren).
// - unlockSpeech() synchron im ersten Klick, damit später automatisch gesprochen werden darf.

/** Das, was die App von einer Stimme braucht (Teil von `SpeechSynthesisVoice`). */
export type SpeechVoiceLike = {
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
  readonly default: boolean;
  readonly voiceURI: string;
};

/** `loading` = Stimmen noch unbekannt, `novoice` = keine englische Stimme, `unsupported` = keine Sprachausgabe. */
export type SpeechStatus = 'loading' | 'ready' | 'novoice' | 'unsupported';

export type SpeakOutcome = 'done' | 'stopped' | 'unavailable' | 'error';

export type SpeechPrefs = {
  /** Name der Stimme aus `app/profile.voice`. */
  voice?: string | null;
  /** Sprechtempo aus `app/profile.rate` (0,8–1,1). */
  rate?: number | null;
};

type UtteranceLike = {
  text: string;
  lang: string;
  voice: SpeechVoiceLike | null;
  rate: number;
  pitch: number;
  volume: number;
  onend: ((ev: unknown) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
};

type SynthLike = {
  readonly speaking: boolean;
  readonly pending: boolean;
  speak(u: UtteranceLike): void;
  cancel(): void;
  resume(): void;
  getVoices(): SpeechVoiceLike[];
  addEventListener?(type: 'voiceschanged', fn: () => void): void;
  onvoiceschanged?: (() => void) | null;
};

type Env = { synth: SynthLike; Utterance: new (text: string) => UtteranceLike };

export const MAX_CHUNK = 150;
export const CANCEL_GAP_MS = 60;
export const WAKE_MS = 5_000;
export const VOICE_RETRY_MS = [250, 500, 1000, 2000] as const;
export const RATE_MIN = 0.8;
export const RATE_MAX = 1.1;

/** Phase 3 (Plan §7): Stimme für die Auswahl in den Einstellungen. */
export type VoiceInfo = { name: string; lang: string; local: boolean; us: boolean };

type SpeechState = { status: SpeechStatus; voiceName: string | null; speaking: boolean; voices?: VoiceInfo[] };

export const useSpeech = create<SpeechState>(() => ({ status: 'loading', voiceName: null, speaking: false }));

function env(): Env | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { speechSynthesis?: SynthLike; SpeechSynthesisUtterance?: Env['Utterance'] };
  if (!w.speechSynthesis || typeof w.SpeechSynthesisUtterance !== 'function') return null;
  return { synth: w.speechSynthesis, Utterance: w.SpeechSynthesisUtterance };
}

// ---------------------------------------------------------------- reine Hilfen

const normLang = (lang: string): string => lang.replace('_', '-').toLowerCase();
const isEnglish = (v: SpeechVoiceLike): boolean => normLang(v.lang).startsWith('en');
const isUS = (v: SpeechVoiceLike): boolean => normLang(v.lang) === 'en-us';

/**
 * Wählt die Stimme: gespeicherte Stimme (genauer Name, englisch) → en-US „Premium"/„Enhanced"
 * → en-US lokal → en-US → irgendein en-*. Liefert den Index oder −1.
 */
export function pickVoice(voices: readonly SpeechVoiceLike[], preferred?: string | null): number {
  const find = (fn: (v: SpeechVoiceLike) => boolean) => voices.findIndex(fn);
  const steps: Array<(v: SpeechVoiceLike) => boolean> = [
    (v) => !!preferred && v.name === preferred && isEnglish(v),
    (v) => isUS(v) && /premium|enhanced/i.test(v.name),
    (v) => isUS(v) && v.localService,
    isUS,
    isEnglish,
  ];
  for (const step of steps) {
    const i = find(step);
    if (i >= 0) return i;
  }
  return -1;
}

export function clampRate(rate: number | null | undefined): number {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) return 1;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, rate));
}

/** Fasst benachbarte Teile gierig zusammen, solange sie zusammen ≤ `max` Zeichen lang sind. */
function pack(parts: string[], max: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const p of parts) {
    if (!cur) cur = p;
    else if (cur.length + 1 + p.length <= max) cur = `${cur} ${p}`;
    else {
      out.push(cur);
      cur = p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function splitWords(piece: string, max: number): string[] {
  const words: string[] = [];
  for (const w of piece.split(' ')) {
    if (!w) continue;
    if (w.length <= max) words.push(w);
    else for (let i = 0; i < w.length; i += max) words.push(w.slice(i, i + max));
  }
  return pack(words, max);
}

// Ohne Lookbehind: Safari vor 16.4 kann ihn nicht parsen, das ganze Skript fiele aus.
const pieces = (text: string, re: RegExp): string[] => (text.match(re) ?? [text]).map((s) => s.trim()).filter(Boolean);
// Getrennt wird nur, wo nach dem Zeichen Leerraum folgt: „3.5", „U.S." und „1,000" bleiben ganz.
const SENTENCE_RE = /.*?[.!?;:]+["'’”)\]]*(?=\s|$)|.+$/g;
const CLAUSE_RE = /.*?,+(?=\s|$)|.+$/g;

function splitCommas(sentence: string, max: number): string[] {
  const parts = pieces(sentence, CLAUSE_RE).flatMap((p) => (p.length <= max ? [p] : splitWords(p, max)));
  return pack(parts, max);
}

/**
 * Zerlegt Text in Stücke ≤ `max` Zeichen: zuerst an `. ! ? ; :`, dann an Kommas, dann an
 * Leerzeichen; benachbarte Teile werden wieder zusammengefasst, solange sie passen.
 */
export function chunkText(text: string, max: number = MAX_CHUNK): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (!flat) return [];
  if (flat.length <= max) return [flat];
  const sentences = pieces(flat, SENTENCE_RE);
  const parts = sentences.flatMap((s) => (s.length <= max ? [s] : splitCommas(s, max)));
  return pack(parts, max);
}

// ---------------------------------------------------------------- Zustand

let voices: SpeechVoiceLike[] = [];
let prefs: SpeechPrefs = {};
let initialized = false;
let unlocked = false;
let session = 0;
let lastCancelAt = -Infinity;
let current: { id: number; utterance: UtteranceLike | null; finish: (o: SpeakOutcome) => void } | null = null;
let wakeTimer: ReturnType<typeof setInterval> | null = null;
let startTimer: ReturnType<typeof setTimeout> | null = null;
const voiceTimers: Array<ReturnType<typeof setTimeout>> = [];

/** Englische Stimmen, en-US zuerst, dann nach Region und Name (Plan §7). */
export function listVoices(list: readonly SpeechVoiceLike[] = voices): VoiceInfo[] {
  const seen = new Set<string>();
  return list
    .filter(isEnglish)
    .filter((v) => (seen.has(v.name) ? false : (seen.add(v.name), true)))
    .map((v) => ({ name: v.name, lang: v.lang.replace('_', '-'), local: v.localService, us: isUS(v) }))
    .sort((a, b) => Number(b.us) - Number(a.us) || a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

/** Überschreibt die Stimme für eine einzelne Ausgabe (Probehören), ohne `prefs` zu ändern. */
let voiceOverride: string | null = null;

function chosenVoice(): SpeechVoiceLike | null {
  if (voiceOverride) {
    const o = voices.find((v) => v.name === voiceOverride && isEnglish(v));
    if (o) return o;
  }
  const i = pickVoice(voices, prefs.voice);
  return i >= 0 ? (voices[i] ?? null) : null;
}

function applyVoice(): void {
  const list = listVoices();
  if (list.length || useSpeech.getState().voices) useSpeech.setState({ voices: list });
  const v = chosenVoice();
  if (v) useSpeech.setState({ status: 'ready', voiceName: v.name });
  else if (voices.length > 0) useSpeech.setState({ status: 'novoice', voiceName: null });
}

function readVoices(e: Env): SpeechVoiceLike[] {
  try {
    return [...e.synth.getVoices()];
  } catch (err) {
    logWarn('speech:voices', err);
    return [];
  }
}

function refreshVoices(final = false): void {
  const e = env();
  if (!e) return;
  const list = readVoices(e);
  if (list.length > 0) {
    voices = list;
    applyVoice();
  } else if (final && voices.length === 0) {
    useSpeech.setState({ status: 'novoice', voiceName: null });
  }
}

/**
 * Einmal beim Start (und erneut, wenn sich `voice`/`rate` im Profil ändern). Rendert nie
 * blockierend: Der Zustand steht in `useSpeech`.
 */
export function initSpeech(p?: SpeechPrefs): void {
  if (p) prefs = { ...prefs, ...p };
  if (initialized) {
    applyVoice();
    return;
  }
  initialized = true;
  const e = env();
  if (!e) {
    useSpeech.setState({ status: 'unsupported', voiceName: null });
    return;
  }
  const onChange = () => refreshVoices();
  if (typeof e.synth.addEventListener === 'function') e.synth.addEventListener('voiceschanged', onChange);
  else e.synth.onvoiceschanged = onChange;
  refreshVoices();
  VOICE_RETRY_MS.forEach((ms, i) => {
    voiceTimers.push(
      setTimeout(() => {
        if (voices.length === 0) refreshVoices(i === VOICE_RETRY_MS.length - 1);
      }, ms),
    );
  });
}

export function setSpeechPrefs(p: SpeechPrefs): void {
  prefs = { ...prefs, ...p };
  applyVoice();
}

function stopWake(): void {
  if (wakeTimer !== null) clearInterval(wakeTimer);
  wakeTimer = null;
}

function startWake(e: Env): void {
  if (wakeTimer !== null) return;
  wakeTimer = setInterval(() => {
    if (e.synth.speaking) e.synth.resume();
  }, WAKE_MS);
}

function finishCurrent(outcome: SpeakOutcome): void {
  const c = current;
  current = null;
  voiceOverride = null;
  if (startTimer !== null) clearTimeout(startTimer);
  startTimer = null;
  stopWake();
  if (c) {
    useSpeech.setState({ speaking: false });
    c.finish(outcome);
  }
}

function speakChunk(e: Env, chunks: readonly string[], i: number, id: number, rate: number): void {
  if (id !== session || !current) return;
  const text = chunks[i];
  if (text === undefined) {
    finishCurrent('done');
    return;
  }
  const u = new e.Utterance(text);
  const v = chosenVoice();
  u.lang = v ? v.lang : 'en-US';
  if (v) u.voice = v;
  u.rate = rate;
  u.pitch = 1;
  u.volume = 1;
  u.onend = () => {
    if (id !== session) return;
    speakChunk(e, chunks, i + 1, id, rate);
  };
  u.onerror = (ev) => {
    if (id !== session) return;
    const code = ev?.error;
    if (code === 'interrupted' || code === 'canceled') finishCurrent('stopped');
    else {
      logWarn('speech:utterance', { code: code ?? 'unknown', message: 'utterance failed' });
      finishCurrent('error');
    }
  };
  // Referenz halten: Chrome sammelt sonst die Äußerung ein, bevor `end` kommt.
  current.utterance = u;
  try {
    e.synth.speak(u);
  } catch (err) {
    logWarn('speech:speak', err);
    finishCurrent('error');
    return;
  }
  startWake(e);
}

/**
 * Spricht englischen Text. Eine laufende Ausgabe wird ersetzt (ihr Promise meldet `stopped`).
 * Löst mit `done` auf, wenn alles gesprochen ist.
 */
export function speak(text: string, opts: { rate?: number; voice?: string } = {}): Promise<SpeakOutcome> {
  const e = env();
  const status = useSpeech.getState().status;
  if (!e || status === 'unsupported' || status === 'novoice') return Promise.resolve('unavailable');
  const chunks = chunkText(text);
  if (chunks.length === 0) return Promise.resolve('done');

  const busy = current !== null || e.synth.speaking || e.synth.pending;
  finishCurrent('stopped');
  voiceOverride = opts.voice ?? null;
  const id = ++session;
  const rate = clampRate(opts.rate ?? prefs.rate);
  return new Promise<SpeakOutcome>((resolve) => {
    let settled = false;
    current = {
      id,
      utterance: null,
      finish: (o) => {
        if (settled) return;
        settled = true;
        resolve(o);
      },
    };
    useSpeech.setState({ speaking: true });
    const now = Date.now();
    if (busy) {
      e.synth.cancel();
      lastCancelAt = now;
    }
    const wait = Math.max(0, lastCancelAt + CANCEL_GAP_MS - now);
    const start = () => {
      startTimer = null;
      speakChunk(e, chunks, 0, id, rate);
    };
    if (wait > 0) startTimer = setTimeout(start, wait);
    else start();
  });
}

export const PREVIEW_TEXT = 'This is how I sound.';

/** Spricht den Probesatz mit genau dieser Stimme; die gespeicherte Wahl bleibt unverändert. */
export function previewVoice(name: string): Promise<SpeakOutcome> {
  return speak(PREVIEW_TEXT, { voice: name });
}

/** Aktuelle Einstellungen (nur lesen, für Tests und die Stimmenwahl). */
export function speechPrefs(): Readonly<SpeechPrefs> {
  return prefs;
}

/** Hält die Ausgabe sofort an (Bildschirmwechsel, Stopp-Knopf). */
export function stopSpeech(): void {
  session += 1;
  const hadWork = current !== null;
  finishCurrent('stopped');
  const e = env();
  if (!e) return;
  if (hadWork || e.synth.speaking || e.synth.pending) {
    try {
      e.synth.cancel();
    } catch (err) {
      logWarn('speech:cancel', err);
    }
    lastCancelAt = Date.now();
  }
}

/**
 * Synchron im ersten Klick aufrufen (z. B. „Starten"): eine stumme Äußerung schaltet die
 * Sprachausgabe am iPhone frei. Danach darf die App ohne weiteren Klick sprechen.
 */
export function unlockSpeech(): void {
  const e = env();
  if (!e || unlocked) return;
  unlocked = true;
  try {
    const u = new e.Utterance('');
    u.volume = 0;
    u.lang = 'en-US';
    e.synth.speak(u);
  } catch (err) {
    logWarn('speech:unlock', err);
  }
  // Manche Geräte liefern die Stimmen erst nach der ersten Berührung.
  if (voices.length === 0) refreshVoices();
}

/** Nur für Tests: Modulzustand verwerfen. */
export function resetSpeech(): void {
  stopWake();
  if (startTimer !== null) clearTimeout(startTimer);
  voiceTimers.splice(0).forEach((t) => clearTimeout(t));
  voices = [];
  prefs = {};
  initialized = false;
  unlocked = false;
  session = 0;
  lastCancelAt = -Infinity;
  current = null;
  startTimer = null;
  voiceOverride = null;
  useSpeech.setState({ status: 'loading', voiceName: null, speaking: false, voices: [] });
}
