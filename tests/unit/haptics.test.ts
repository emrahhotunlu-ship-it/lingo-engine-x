import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normHaptic } from '../../src/domain/progress/settings';
import { canVibrate, haptic, resetHaptics, setHapticsEnabled, verdictHaptic } from '../../src/platform/haptics';

// Kap. 4.3 / A7.4: Vibration nur nach Merkmalserkennung, nie ein kaputter Aufruf; Einstellung
// „Vibration“ (Standard an); zwei Meldungen desselben Prüfens ergeben eine Vibration.

describe('Vibration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetHaptics();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('ohne navigator.vibrate (iPhone): kein Aufruf, kein Fehler', () => {
    vi.stubGlobal('navigator', {});
    expect(canVibrate()).toBe(false);
    expect(verdictHaptic('correct')).toBe(false);
  });

  it('mit navigator.vibrate: Muster je Ergebnis, einmal je Prüfen', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(verdictHaptic('correct')).toBe(true);
    expect(verdictHaptic('correct')).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenLastCalledWith([12, 40, 18]);
    vi.advanceTimersByTime(400);
    expect(verdictHaptic('wrong')).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith([30, 60, 30]);
    vi.advanceTimersByTime(400);
    verdictHaptic('near');
    expect(vibrate).toHaveBeenLastCalledWith(8);
  });

  it('neues Prüfen mit anderem Ergebnis vibriert sofort, auch während der Sperrzeit', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    expect(verdictHaptic('correct')).toBe(true);
    // Zeitgeber noch nicht gelaufen (z. B. ausgelasteter Hauptthread): anderes Ergebnis = neues Prüfen.
    expect(verdictHaptic('wrong')).toBe(true);
    expect(verdictHaptic('wrong')).toBe(false);
    expect(vibrate.mock.calls).toEqual([[[12, 40, 18]], [[30, 60, 30]]]);
  });

  it('Einstellung aus: nie vibrieren', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { vibrate });
    setHapticsEnabled(false);
    expect(haptic('success')).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('wirft vibrate, bleibt es still (false)', () => {
    vi.stubGlobal('navigator', {
      vibrate: () => {
        throw new Error('blocked');
      },
    });
    expect(haptic('tap')).toBe(false);
  });

  it('Standard an, nur false schaltet ab', () => {
    expect(normHaptic(undefined)).toBe(true);
    expect(normHaptic(true)).toBe(true);
    expect(normHaptic('x')).toBe(true);
    expect(normHaptic(false)).toBe(false);
  });
});
