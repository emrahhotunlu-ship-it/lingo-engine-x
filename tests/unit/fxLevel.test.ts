// Effekte-Fundament (Lernplattform 3.0 P30): Qualitätsstufe, Low-Power-Heuristik, Dirigent, Feder-Tokens.
import { spring } from 'motion-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/platform/sound', () => ({ playCue: vi.fn(() => true) }));
vi.mock('../../src/platform/haptics', () => ({ verdictHaptic: vi.fn(() => true) }));

import { VERDICT_GAP_MS, playVerdict, resetDirector } from '../../src/engine/fx/director';
import { emit, subscribe } from '../../src/engine/fx/events';
import { FRAME_SAMPLES, LOW_POWER_MS, frameStats, lowPowerFromDeltas, medianOf, readPref, resolveLevel } from '../../src/engine/fx/level';
import { playCue } from '../../src/platform/sound';
import { verdictHaptic } from '../../src/platform/haptics';
import { OPERATING_SPRINGS, SPRINGS, type SpringName } from '../../src/ui/motion';

describe('resolveLevel', () => {
  const lv = (pref: 'full' | 'calm' | 'off' | null, reduced = false, lowPower = false) => resolveLevel({ pref, reduced, lowPower });
  // Angepasst 07.10.2026 (Design-Lead): Standard ist jetzt „Voll“ (Emrahs ausdrücklicher Wunsch); langsames Gerät → „Ruhig“ bleibt.
  it('ohne Wahl gilt „Voll“', () => {
    expect(lv(null)).toBe('full');
  });
  it('die Wahl gilt, wenn nichts dagegen spricht', () => {
    expect(lv('full')).toBe('full');
    expect(lv('calm')).toBe('calm');
    expect(lv('off')).toBe('off');
  });
  it('reduzierte Bewegung erzwingt „Aus“, egal was gewählt ist', () => {
    for (const p of ['full', 'calm', 'off', null] as const) expect(lv(p, true)).toBe('off');
    expect(lv('full', true, true)).toBe('off');
  });
  it('ein langsames Gerät macht aus „Voll“ „Ruhig“, sonst nichts', () => {
    expect(lv('full', false, true)).toBe('calm');
    expect(lv('calm', false, true)).toBe('calm');
    expect(lv('off', false, true)).toBe('off');
    expect(lv(null, false, true)).toBe('calm');
  });
});

describe('readPref', () => {
  it('nur gültige Werte', () => {
    expect(readPref('full')).toBe('full');
    expect(readPref('calm')).toBe('calm');
    expect(readPref('off')).toBe('off');
    expect(readPref('FULL')).toBeNull();
    expect(readPref('')).toBeNull();
    expect(readPref(null)).toBeNull();
  });
});

describe('Low-Power-Heuristik (Median der Bildabstände > 25 ms → ruhig)', () => {
  const rep = (ms: number, n = FRAME_SAMPLES): number[] => Array.from({ length: n }, () => ms);
  it('60 fps ist nicht langsam, 30 fps schon', () => {
    expect(lowPowerFromDeltas(rep(16.7))).toBe(false);
    expect(lowPowerFromDeltas(rep(33.3))).toBe(true);
  });
  it('die Grenze liegt bei 25 ms', () => {
    expect(LOW_POWER_MS).toBe(25);
    expect(lowPowerFromDeltas(rep(25))).toBe(false);
    expect(lowPowerFromDeltas(rep(25.1))).toBe(true);
  });
  it('einzelne Ausreißer ändern nichts, der Median entscheidet', () => {
    const d = [...rep(16.7, 27), 120, 130, 140];
    expect(lowPowerFromDeltas(d)).toBe(false);
    const slow = [...rep(33, 27), 10, 10, 10];
    expect(lowPowerFromDeltas(slow)).toBe(true);
  });
  it('zu wenige Abstände zählen nicht', () => {
    expect(lowPowerFromDeltas([])).toBe(false);
    expect(lowPowerFromDeltas(rep(50, 9))).toBe(false);
    expect(lowPowerFromDeltas(rep(50, 10))).toBe(true);
  });
  it('medianOf und frameStats', () => {
    expect(medianOf([])).toBeNull();
    expect(medianOf([3, 1, 2])).toBe(2);
    expect(medianOf([1, 2, 3, 4])).toBe(2.5);
    expect(frameStats([])).toBeNull();
    expect(frameStats(rep(16.7))).toEqual({ n: 30, medianMs: 16.7, maxMs: 17, fps: 60 });
  });
});

describe('Dirigent: ein Urteil je 300 ms, „Weiß ich nicht“ bleibt still', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(playCue).mockClear();
    vi.mocked(verdictHaptic).mockClear();
    resetDirector();
  });
  afterEach(() => {
    resetDirector();
    vi.useRealTimers();
  });

  it('richtig, fast, falsch: je ein Ton und eine Vibration, nach der Sperrzeit', () => {
    playVerdict({ k: 'verdict', v: 'ok' });
    expect(playCue).toHaveBeenLastCalledWith('correct');
    expect(verdictHaptic).toHaveBeenLastCalledWith('correct');
    vi.advanceTimersByTime(VERDICT_GAP_MS);
    playVerdict({ k: 'verdict', v: 'near' });
    expect(playCue).toHaveBeenLastCalledWith('near');
    vi.advanceTimersByTime(VERDICT_GAP_MS);
    playVerdict({ k: 'verdict', v: 'wrong' });
    expect(playCue).toHaveBeenLastCalledWith('wrong');
    expect(playCue).toHaveBeenCalledTimes(3);
    expect(verdictHaptic).toHaveBeenCalledTimes(3);
  });

  it('Lücke und Ergebniszeile melden dasselbe Prüfen: ein Ton, eine Vibration', () => {
    playVerdict({ k: 'verdict', v: 'ok' });
    playVerdict({ k: 'verdict', v: 'ok' });
    vi.advanceTimersByTime(VERDICT_GAP_MS - 1);
    playVerdict({ k: 'verdict', v: 'ok' });
    expect(playCue).toHaveBeenCalledTimes(1);
    expect(verdictHaptic).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    playVerdict({ k: 'verdict', v: 'ok' });
    expect(playCue).toHaveBeenCalledTimes(2);
  });

  it('„Weiß ich nicht“ spielt nichts und sperrt nichts', () => {
    playVerdict({ k: 'verdict', v: 'dontKnow' });
    expect(playCue).not.toHaveBeenCalled();
    playVerdict({ k: 'verdict', v: 'wrong' });
    expect(playCue).toHaveBeenCalledTimes(1);
  });

  it('emit erreicht angemeldete Handler und die Abmeldung wirkt', () => {
    const seen: string[] = [];
    const off = subscribe((e) => { if (e.k === 'verdict') seen.push(e.v); });
    emit({ k: 'verdict', v: 'ok' });
    off();
    emit({ k: 'verdict', v: 'wrong' });
    expect(seen).toEqual(['ok']);
  });
});

describe('Feder-Tokens (Erlebnis-Engine §3.1)', () => {
  const t95 = (name: SpringName): number => {
    const t = SPRINGS[name];
    const g = spring({ keyframes: [0, 1], visualDuration: t.visualDuration, bounce: t.bounce });
    for (let ms = 0; ms < 3000; ms++) if (Math.abs(1 - (g.next(ms).value)) <= 0.05) return ms;
    return Infinity;
  };
  it('Bedienbewegung: wahrgenommen höchstens 300 ms, Federung höchstens 0,3', () => {
    for (const n of OPERATING_SPRINGS) {
      expect(t95(n), n).toBeLessThanOrEqual(300);
      expect(SPRINGS[n].bounce, n).toBeLessThanOrEqual(0.3);
    }
  });
  it('Werte wie im Dokument', () => {
    const want: Record<SpringName, number> = { snap: 164, glide: 254, settle: 208, pop: 134, sheet: 286, ring: 462, morph: 318 };
    for (const n of Object.keys(want) as SpringName[]) expect(Math.abs(t95(n) - want[n]), n).toBeLessThanOrEqual(2);
  });
  it('nichts federt über 0,4 („zu übertrieben für die Oberfläche“)', () => {
    for (const n of Object.keys(SPRINGS) as SpringName[]) expect(SPRINGS[n].bounce, n).toBeLessThanOrEqual(0.4);
  });
});
