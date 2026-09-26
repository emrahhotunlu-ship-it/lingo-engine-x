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

/** Kann dieses Gerät vibrieren? (iPhone/Safari: nein) */
export function canVibrate(): boolean {
  return vibrator() !== null;
}

/** Kurze Vibration, wo möglich. Liefert, ob das Gerät sie angenommen hat. */
export function haptic(kind: HapticKind): boolean {
  const nav = vibrator();
  if (!nav) return false;
  try {
    return nav.vibrate(PATTERNS[kind]);
  } catch (err) {
    // Nur einmal melden: Rückmeldung ist Zugabe, kein Fehlerfall für den Nutzer.
    if (!reported) logWarn('haptics:vibrate', err);
    reported = true;
    return false;
  }
}
