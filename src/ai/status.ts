import { create } from 'zustand';

// Drosselung des KI-Tors:
// - nach `rate_limited` 60 s Pause, in der kein Aufruf `sample` erreicht (Kap. 3.1: zurückhalten),
// - lokale Sicherung gegen Schleifen: höchstens 20 Aufrufe in 60 s.
// Die Oberfläche liest `pausedUntil`, um „Erneut versuchen" erst danach anzubieten.

export const RATE_PAUSE_MS = 60_000;
export const LOCAL_WINDOW_MS = 60_000;
export const LOCAL_MAX_CALLS = 20;

type AiStatusState = {
  /** Zeitpunkt (ms), bis zu dem nach `rate_limited` nichts angefragt wird. */
  pausedUntil: number;
  /** Zeitpunkte der Aufrufe im laufenden Fenster. */
  calls: readonly number[];
};

export const useAiStatus = create<AiStatusState>(() => ({ pausedUntil: 0, calls: [] }));

export function pauseAi(now: number = Date.now()): void {
  useAiStatus.setState({ pausedUntil: now + RATE_PAUSE_MS });
}

export function callsInWindow(now: number = Date.now()): number {
  return useAiStatus.getState().calls.filter((t) => now - t < LOCAL_WINDOW_MS).length;
}

/** Warum gerade kein Aufruf erlaubt ist, oder `null`. */
export function throttleReason(now: number = Date.now()): 'paused' | 'local_limit' | null {
  if (now < useAiStatus.getState().pausedUntil) return 'paused';
  if (callsInWindow(now) >= LOCAL_MAX_CALLS) return 'local_limit';
  return null;
}

export function recordCall(now: number = Date.now()): void {
  const calls = useAiStatus.getState().calls.filter((t) => now - t < LOCAL_WINDOW_MS);
  useAiStatus.setState({ calls: [...calls, now] });
}

/** Nur für Tests. */
export function resetAiStatus(): void {
  useAiStatus.setState({ pausedUntil: 0, calls: [] });
}
