import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARM_MS, armShared, FLIGHT_S, flipFrom, resetShared, sharedId, takeShared } from '../../src/engine/shared';

// Kap. 4.4: gemeinsame Elemente – einmal je Tippen, nur kurz gültig, 150–300 ms.

const el = (r: { left: number; top: number; width: number; height: number }) => ({ getBoundingClientRect: () => r }) as unknown as Element;

describe('Flug zwischen Bildschirmen', () => {
  afterEach(() => {
    resetShared();
    vi.unstubAllGlobals();
  });

  it('Quelle in Dokument-Koordinaten, genau einmal und nur vom passenden Ziel abgeholt', () => {
    vi.stubGlobal('window', { scrollX: 0, scrollY: 500 });
    armShared('lesson-l07', el({ left: 20, top: 300, width: 200, height: 24 }));
    // Ein anderes Ziel bekommt nichts; das passende danach schon.
    expect(takeShared('lx-hero')).toBeNull();
    expect(takeShared('lesson-l07')).toEqual({ x: 20, y: 800, w: 200, h: 24 });
    expect(takeShared('lesson-l07')).toBeNull();
  });

  it('abgelaufen oder ohne Größe: kein Flug', () => {
    vi.stubGlobal('window', { scrollX: 0, scrollY: 0 });
    armShared('lx-hero', el({ left: 0, top: 0, width: 300, height: 200 }));
    // Zeit NACH dem Scharfmachen nehmen: sonst kann ein Millisekunden-Sprung unter Last den Ablauf knapp verfehlen.
    const t0 = Date.now();
    expect(takeShared('lx-hero', t0 + ARM_MS + 1)).toBeNull();
    armShared('lx-hero', el({ left: 0, top: 0, width: 0, height: 0 }));
    expect(takeShared('lx-hero')).toBeNull();
    armShared('lx-hero', null);
    expect(takeShared('lx-hero')).toBeNull();
  });

  it('FLIP: Ziel liegt am Start genau auf der Quelle', () => {
    expect(flipFrom({ x: 20, y: 800, w: 200, h: 24 }, { x: 60, y: 100, w: 100, h: 16 })).toEqual({ x: -40, y: 700, scaleX: 2, scaleY: 1.5 });
    expect(flipFrom({ x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 0, h: 10 })).toBeNull();
  });

  it('Dauer im Rahmen 150–300 ms; Kennungen je Epoche verschieden', () => {
    expect(FLIGHT_S).toBeGreaterThanOrEqual(0.15);
    expect(FLIGHT_S).toBeLessThanOrEqual(0.3);
    expect(sharedId('word-avoid', 1)).not.toBe(sharedId('word-avoid', 2));
  });
});
