import { useSyncExternalStore } from 'react';
import { local } from '../../platform/storage';

// Qualitätsstufe der Effekte (Lernplattform 3.0 P30, Erlebnis-Engine §9.3): `full · calm · off`, je Gerät (`localStorage` `lx:fx`).
//   off  = jeder Effekt zeigt sofort seinen Endzustand (keine Bewegung)
//   calm = Standard: die ruhigen Antwort-Momente der Stufe 1 (Farbe, gezeichnetes ✓/✕, Füllung der Lücke)
//   full = wie calm; die Stufen 2 bis 4 (Punkte, Runde, Tag, Aufstieg) kommen mit späteren Paketen
// Reduzierte Bewegung am Gerät erzwingt `off`. Läuft die Bildrate nach der ersten Geste knapp (Stromsparmodus, 30 fps), gilt `full` als `calm`.
// Das Ergebnis steht als `data-fx` am Wurzelelement; die Stile (`styles/parts/ee.css`) und die Tests lesen nur dieses Attribut.

export type FxLevel = 'full' | 'calm' | 'off';
export const FX_KEY = 'lx:fx';
export const FX_LEVELS: readonly FxLevel[] = ['full', 'calm', 'off'];
/** Median-Abstand zweier Bilder, ab dem das Gerät als langsam gilt (30-fps-Deckel im Stromsparmodus ≈ 33 ms, 60 fps ≈ 17 ms). */
export const LOW_POWER_MS = 25;
/** So viele Bildabstände misst der Dirigent nach der ersten Geste. */
export const FRAME_SAMPLES = 30;
/** Mindestzahl an Abständen, damit die Messung zählt. */
const MIN_FRAMES = 10;

export const isFxLevel = (v: unknown): v is FxLevel => v === 'full' || v === 'calm' || v === 'off';

/** Gespeicherte Wahl dieses Geräts; `null`, wenn keine (oder eine ungültige) steht. */
export function readPref(raw: string | null = local.get(FX_KEY)): FxLevel | null {
  return isFxLevel(raw) ? raw : null;
}

/** Die wirksame Stufe aus Wahl, reduzierter Bewegung und Messung: reduziert → off · keine Wahl → calm · full bei langsamem Gerät → calm. */
export function resolveLevel(i: { pref: FxLevel | null; reduced: boolean; lowPower: boolean }): FxLevel {
  if (i.reduced) return 'off';
  const pref = i.pref ?? 'calm';
  return pref === 'full' && i.lowPower ? 'calm' : pref;
}

export function medianOf(xs: readonly number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/** Low-Power-Heuristik: Median der Bildabstände über 25 ms. Zu wenige Abstände zählen nicht. */
export function lowPowerFromDeltas(deltas: readonly number[]): boolean {
  if (deltas.length < MIN_FRAMES) return false;
  const m = medianOf(deltas);
  return m !== null && m > LOW_POWER_MS;
}

export type FrameStats = { n: number; medianMs: number; maxMs: number; fps: number };

export function frameStats(deltas: readonly number[]): FrameStats | null {
  const m = medianOf(deltas);
  if (m === null || m <= 0) return null;
  return { n: deltas.length, medianMs: Math.round(m * 10) / 10, maxMs: Math.round(Math.max(...deltas)), fps: Math.round(1000 / m) };
}

// ------------------------------------------------------------------ Zustand (ein kleiner Speicher ohne Bibliothek)

export type FxState = { pref: FxLevel | null; reduced: boolean; lowPower: boolean; frames: FrameStats | null };

const reducedNow = (): boolean => {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    // Ohne Medienabfrage gilt: nicht reduziert.
    return false;
  }
};

let state: FxState = { pref: readPref(), reduced: reducedNow(), lowPower: false, frames: null };
const listeners = new Set<() => void>();

export const effectiveLevel = (s: FxState = state): FxLevel => resolveLevel(s);
export const getFxState = (): FxState => state;

/** `data-fx` am Wurzelelement setzen (nur dort lesen die Stile und Tests). */
export function applyFxToDocument(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.fx = effectiveLevel();
}

function set(next: Partial<FxState>): void {
  state = { ...state, ...next };
  applyFxToDocument();
  listeners.forEach((l) => l());
}

/** Wahl dieses Geräts speichern (`null` = zurück auf den Standard). */
export function setFxPref(pref: FxLevel | null): void {
  if (pref === null) local.remove(FX_KEY);
  else local.set(FX_KEY, pref);
  set({ pref });
}

/** Messung der Bildabstände übernehmen (aus dem Dirigenten). */
export function setFrameMeasure(deltas: readonly number[]): void {
  set({ lowPower: lowPowerFromDeltas(deltas), frames: frameStats(deltas) });
}

export function subscribeFx(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export const useFxLevel = (): FxLevel =>
  useSyncExternalStore(
    subscribeFx,
    () => effectiveLevel(),
    () => 'calm',
  );
export const useFxState = (): FxState => useSyncExternalStore(subscribeFx, getFxState, getFxState);

/** Nur für Tests: Zustand neu lesen. */
export function resetFx(over: Partial<FxState> = {}): void {
  state = { pref: readPref(), reduced: reducedNow(), lowPower: false, frames: null, ...over };
  applyFxToDocument();
  listeners.forEach((l) => l());
}

// Beim Laden einmal setzen und auf Änderungen der Geräte-Einstellung „Bewegung reduzieren“ hören.
applyFxToDocument();
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  try {
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => set({ reduced: e.matches }));
  } catch {
    // Alte Safari-Fassungen kennen `addEventListener` an MediaQueryList nicht: dann bleibt es beim Wert vom Start.
  }
}
