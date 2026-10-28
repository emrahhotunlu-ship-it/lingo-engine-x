import { afterEach, describe, expect, it, vi } from 'vitest';
import { setFxPref } from '../../src/engine/fx/level';
import { getCombo, playMoment, resetMoments } from '../../src/engine/fx/moments';

// Relaunch Stufe 1 P3, Korrekturrunde Punkt 9/10: mit Hilfe geschafft zählt nicht zur Combo, „Lösung gezeigt“ beendet sie.
// Die Lücke meldet zuerst (ohne Wissen um Hilfe), die Urteilszeile im selben Prüfen gleich danach mit `help`.

let now = 1000;
afterEach(() => {
  vi.restoreAllMocks();
  resetMoments();
});
const at = (ms: number) => {
  now = ms;
};

describe('Combo', () => {
  it('richtig ohne Hilfe zählt einmal je Prüfen; mit Hilfe zählt nicht, auch wenn die Lücke zuerst meldet', () => {
    setFxPref('off');
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    resetMoments();
    at(1000);
    playMoment({ k: 'verdict', v: 'ok' });
    at(1050);
    playMoment({ k: 'verdict', v: 'ok' });
    expect(getCombo()).toBe(1);
    at(2000);
    playMoment({ k: 'verdict', v: 'ok' });
    at(2050);
    playMoment({ k: 'verdict', v: 'ok', help: true });
    expect(getCombo()).toBe(1);
    at(3000);
    playMoment({ k: 'verdict', v: 'ok', help: true });
    expect(getCombo()).toBe(1);
  });

  it('„Lösung gezeigt“ beendet die Combo', () => {
    setFxPref('off');
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    resetMoments();
    at(1000);
    playMoment({ k: 'verdict', v: 'ok' });
    at(2000);
    playMoment({ k: 'verdict', v: 'ok' });
    expect(getCombo()).toBe(2);
    at(3000);
    playMoment({ k: 'verdict', v: 'dontKnow' });
    expect(getCombo()).toBe(0);
  });
});
