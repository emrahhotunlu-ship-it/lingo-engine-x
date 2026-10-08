import { logWarn } from './diagnostics';
import { local } from './storage';

// Töne (Kap. 4.7, Plan E12): optional, Standard aus. Erzeugt per WebAudio-Oszillator – keine
// Dateien, nichts wird geladen. Am iPhone braucht WebAudio eine Nutzergeste (`resume()` beim
// ersten Tippen); bei stummgeschaltetem Gerät ist nichts zu hören, das ist bekannt und in Ordnung.
// Ohne `AudioContext` passiert still nichts – nie ein kaputter Aufruf.

export type Cue = 'correct' | 'near' | 'wrong' | 'done';

type Tone = { f: number; ms: number; gain: number; at: number };
const CUES: Readonly<Record<Cue, readonly Tone[]>> = {
  correct: [
    { f: 660, ms: 90, gain: 0.05, at: 0 },
    { f: 990, ms: 120, gain: 0.05, at: 80 },
  ],
  near: [{ f: 560, ms: 140, gain: 0.04, at: 0 }],
  wrong: [{ f: 220, ms: 180, gain: 0.05, at: 0 }],
  done: [
    { f: 523, ms: 110, gain: 0.04, at: 0 },
    { f: 659, ms: 110, gain: 0.04, at: 100 },
    { f: 784, ms: 180, gain: 0.04, at: 200 },
  ],
};

type AudioCtor = new () => AudioContext;
let ctx: AudioContext | null = null;
let enabled = false;
let reported = false;
let unlockInstalled = false;
/** Gab es schon eine Nutzergeste? Die neuen Klänge (v2) spielen nie davor (iOS, und kein Ton beim bloßen Öffnen). */
let gestured = false;

function ctorOf(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Gibt es WebAudio auf diesem Gerät? */
export const soundSupported = (): boolean => ctorOf() !== null;

function report(err: unknown): void {
  if (!reported) logWarn('sound', err);
  reported = true;
}

function context(): AudioContext | null {
  if (ctx) return ctx;
  const C = ctorOf();
  if (!C) return null;
  try {
    ctx = new C();
  } catch (err) {
    report(err);
    return null;
  }
  return ctx;
}

/** In einer Nutzergeste aufrufen (iOS): weckt den Audio-Kontext. */
export function unlockSound(): void {
  gestured = true;
  if (!enabled) return;
  const c = context();
  if (c && c.state === 'suspended') c.resume().catch(report);
}

/** Einstellung aus `app/profile.sound` übernehmen. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (!on || unlockInstalled || typeof window === 'undefined') return;
  unlockInstalled = true;
  window.addEventListener('pointerdown', unlockSound, { passive: true });
  window.addEventListener('keydown', unlockSound);
}

export const soundEnabled = (): boolean => enabled;

/** Kurzer Ton, nur wenn eingeschaltet und möglich. Liefert, ob er gespielt wurde. */
export function playCue(cue: Cue): boolean {
  if (!enabled) return false;
  const c = context();
  if (!c) return false;
  try {
    if (c.state === 'suspended') c.resume().catch(report);
    const t0 = c.currentTime;
    for (const tone of CUES[cue]) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.f;
      const start = t0 + tone.at / 1000;
      const end = start + tone.ms / 1000;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(volumeNode(c));
      osc.start(start);
      osc.stop(end + 0.02);
    }
    return true;
  } catch (err) {
    report(err);
    return false;
  }
}

// ------------------------------------------------------------------ Ton v2 (Lernplattform 3.0 P56, Erlebnis-Engine §6)
// Lautstärke je Gerät (`lx:sound-vol`: leise · normal); An/Aus bleibt `app/profile.sound`. Der Verdict-Cue oben bleibt in Tönen und Pegel unverändert
// (bei „Normal“ ist die Lautstärke-Stufe 1,0). Die neuen Klänge `up`, `tick`, `day`, `level`, `card` haben Hüllkurven (Anstieg 6 ms, exponentieller
// Ausklang), zwei Teiltöne (Grundton + Oktave −14 dB) und laufen über Tiefpass 6 kHz → Kompressor → Lautstärke. Kein Ton vor der ersten Geste,
// keiner während der Sprachausgabe, `tick` höchstens 12 je Sekunde.

export type SoundVol = 'low' | 'normal';
export const SOUND_VOL_KEY = 'lx:sound-vol';
/** Leise = −12 dB. */
export const VOL_GAIN: Readonly<Record<SoundVol, number>> = { low: 0.25, normal: 1 };

export function soundVolume(): SoundVol {
  return local.get(SOUND_VOL_KEY) === 'low' ? 'low' : 'normal';
}

export function setSoundVolume(v: SoundVol): void {
  local.set(SOUND_VOL_KEY, v);
  if (vol && ctx) vol.gain.value = VOL_GAIN[v];
}

let vol: GainNode | null = null;
let master: AudioNode | null = null;

function volumeNode(c: AudioContext): AudioNode {
  if (vol) return vol;
  vol = c.createGain();
  vol.gain.value = VOL_GAIN[soundVolume()];
  vol.connect(c.destination);
  return vol;
}

/** Tiefpass 6 kHz → Kompressor (−18 dB, 4:1) → Lautstärke. Nur für die v2-Klänge. */
function masterNode(c: AudioContext): AudioNode {
  if (master) return master;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6000;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  lp.connect(comp).connect(volumeNode(c));
  master = lp;
  return lp;
}

export type FxSound = 'up' | 'tick' | 'day' | 'level' | 'card';

/** Ein Ton: Frequenz (Hz), Beginn (ms), Ausklang (ms), Pegel (linear). */
type Voice = { f: number; at: number; ms: number; gain: number };
const db = (x: number): number => Math.pow(10, x / 20);

/** Die Folgen je Klang (Erlebnis-Engine §6, Tabelle). Rein, damit Tests sie lesen können. */
export const FX_VOICES: Readonly<Record<Exclude<FxSound, 'card'>, readonly Voice[]>> = {
  up: [
    { f: 880, at: 0, ms: 160, gain: db(-24) },
    { f: 1109, at: 50, ms: 160, gain: db(-24) },
    { f: 1319, at: 100, ms: 220, gain: db(-24) },
  ],
  tick: [{ f: 2400, at: 0, ms: 4, gain: db(-34) }],
  day: [
    { f: 523, at: 0, ms: 900, gain: db(-22) / 2 },
    { f: 659, at: 0, ms: 900, gain: db(-22) / 2 },
    { f: 784, at: 0, ms: 900, gain: db(-22) / 2 },
    { f: 1047, at: 120, ms: 900, gain: db(-22) / 2 },
  ],
  level: [
    { f: 392, at: 0, ms: 160, gain: db(-22) },
    { f: 523, at: 90, ms: 160, gain: db(-22) },
    { f: 659, at: 180, ms: 160, gain: db(-22) },
    { f: 784, at: 270, ms: 160, gain: db(-22) },
    { f: 523, at: 360, ms: 740, gain: db(-22) / 2 },
    { f: 659, at: 360, ms: 740, gain: db(-22) / 2 },
    { f: 784, at: 360, ms: 740, gain: db(-22) / 2 },
  ],
};

/** Oktave −14 dB über jedem Ton (nicht beim `tick`). */
const OCTAVE = db(-14);
export const TICK_MAX_PER_S = 12;
const tickTimes: number[] = [];

/** Spricht gerade die Sprachausgabe? Dann bleibt jeder Effektton still. */
export function speakingNow(): boolean {
  try {
    const s = (globalThis as { speechSynthesis?: { speaking?: boolean } }).speechSynthesis;
    return !!s?.speaking;
  } catch {
    // Ohne Sprachausgabe: nicht sprechend.
    return false;
  }
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Effektklang v2. Liefert, ob er gespielt wurde (aus, keine Geste, Sprachausgabe, Takt-Grenze oder kein WebAudio → `false`). */
export function playFx(name: FxSound): boolean {
  if (!enabled || !gestured || speakingNow()) return false;
  if (name === 'tick') {
    const t = nowMs();
    while (tickTimes.length && t - (tickTimes[0] as number) > 1000) tickTimes.shift();
    if (tickTimes.length >= TICK_MAX_PER_S) return false;
    tickTimes.push(t);
  }
  const c = context();
  if (!c) return false;
  try {
    if (c.state === 'suspended') c.resume().catch(report);
    const out = masterNode(c);
    const t0 = c.currentTime;
    if (name === 'card') {
      noise(c, out, t0, 0.12, db(-36), [1200, 600]);
      return true;
    }
    for (const v of FX_VOICES[name]) {
      tone(c, out, t0 + v.at / 1000, v.f, v.ms / 1000, v.gain);
      if (name !== 'tick') tone(c, out, t0 + v.at / 1000, v.f * 2, v.ms / 1000, v.gain * OCTAVE);
    }
    // Gläserner Anschlag: 6 ms Rauschen über 2 kHz (nicht beim Tick).
    if (name !== 'tick') noise(c, out, t0, 0.006, db(-30), null);
    return true;
  } catch (err) {
    report(err);
    return false;
  }
}

function tone(c: AudioContext, out: AudioNode, start: number, f: number, dur: number, peak: number): void {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = f;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.01, dur));
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Rauschen: Hochpass 2 kHz (Anschlag) oder Bandpass, der von `band[0]` nach `band[1]` gleitet (Kartenwechsel). */
function noise(c: AudioContext, out: AudioNode, start: number, dur: number, peak: number, band: readonly [number, number] | null): void {
  const len = Math.max(1, Math.round(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  if (band) {
    f.type = 'bandpass';
    f.frequency.setValueAtTime(band[0], start);
    f.frequency.exponentialRampToValueAtTime(band[1], start + dur);
  } else {
    f.type = 'highpass';
    f.frequency.value = 2000;
  }
  const g = c.createGain();
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f).connect(g).connect(out);
  src.start(start);
  src.stop(start + dur + 0.01);
}

/** Nur für Tests. */
export function resetSoundForTests(): void {
  ctx = null;
  enabled = false;
  reported = false;
  gestured = false;
  vol = null;
  master = null;
  tickTimes.length = 0;
}
