import { logWarn } from './diagnostics';

// Fühlbare Rückmeldung (A7.4): `navigator.vibrate` gibt es auf dem iPhone nicht. Deshalb nur
// nach Merkmalserkennung und nie als kaputter Aufruf; die Rückmeldung ist dort rein visuell.

export type HapticKind = 'tap' | 'success' | 'error';

const PATTERNS: Readonly<Record<HapticKind, number | number[]>> = {
  tap: 8,
  success: [12, 40, 18],
  error: [30, 60, 30],
};

type VibrateNavigator = { vibrate: (pattern: number | number[]) => boolean };

function vibrator(): VibrateNavigator | null {
  if (typeof navigator === 'undefined') return null;
  const nav = navigator as unknown as Partial<VibrateNavigator>;
  return typeof nav.vibrate === 'function' ? (nav as VibrateNavigator) : null;
}

let reported = false;
let enabled = true;
let blocked = false;
let unblock: ReturnType<typeof setTimeout> | null = null;
/**
 * Zwei Meldungen desselben Prüfens (Lücke + Ergebniszeile) ergeben nur eine Vibration. Gesperrt
 * wird per Zeitgeber statt per Uhrzeit (eine feste Testuhr hält `performance.now` an).
 */
const DEDUPE_MS = 300;

/** Einstellung „Vibration“ aus `app/profile.haptic` übernehmen (Standard an). */
export function setHapticsEnabled(on: boolean): void {
  enabled = on;
}

export const hapticsEnabled = (): boolean => enabled;

/** Kann dieses Gerät vibrieren? (iPhone/Safari: nein) */
export function canVibrate(): boolean {
  return vibrator() !== null;
}

/** Kurze Vibration, wo möglich. Liefert, ob das Gerät sie angenommen hat. */
export function haptic(kind: HapticKind): boolean {
  if (!enabled) return false;
  const nav = vibrator();
  if (!nav) return false;
  if (blocked) return false;
  blocked = true;
  unblock = setTimeout(() => {
    blocked = false;
    unblock = null;
  }, DEDUPE_MS);
  try {
    return nav.vibrate(PATTERNS[kind]);
  } catch (err) {
    // Nur einmal melden: Rückmeldung ist Zugabe, kein Fehlerfall für den Nutzer.
    if (!reported) logWarn('haptics:vibrate', err);
    reported = true;
    return false;
  }
}

/** Rückmeldung beim Prüfen (Kap. 4.3): richtig = leicht, fast richtig = kurz, falsch = deutlicher. */
export function verdictHaptic(verdict: 'correct' | 'near' | 'wrong'): boolean {
  return haptic(verdict === 'correct' ? 'success' : verdict === 'near' ? 'tap' : 'error');
}

/** Nur für Tests: Sperrzeit zurücksetzen. */
export function resetHaptics(): void {
  if (unblock) clearTimeout(unblock);
  unblock = null;
  blocked = false;
  enabled = true;
}
