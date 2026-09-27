import { logWarn } from './diagnostics';

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
      osc.connect(gain).connect(c.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    }
    return true;
  } catch (err) {
    report(err);
    return false;
  }
}

/** Nur für Tests. */
export function resetSoundForTests(): void {
  ctx = null;
  enabled = false;
  reported = false;
}
