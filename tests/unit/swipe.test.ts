import { describe, expect, it } from 'vitest';
import { classifySwipe, SWIPE_MAX_MS, SWIPE_MIN_PX, swipeExcluded } from '../../src/engine/swipe';
import { DISMISS_PX, shouldDismiss } from '../../src/ui/sheetDrag';

// Kap. 4.5: Wischgesten sparsam und eindeutig – nie mit dem senkrechten Bildlauf verwechselt.

const p = (x: number, y: number, t: number) => ({ x, y, t });

describe('Wischgeste erkennen', () => {
  it('deutlich waagerecht, weit genug, schnell genug', () => {
    expect(classifySwipe(p(300, 400, 0), p(200, 410, 200))).toBe('left');
    expect(classifySwipe(p(100, 400, 0), p(220, 400, 200))).toBe('right');
  });

  it('senkrechter Bildlauf und schräge Bewegungen sind keine Geste', () => {
    expect(classifySwipe(p(200, 600, 0), p(190, 300, 200))).toBe('up');
    expect(classifySwipe(p(300, 400, 0), p(220, 350, 200))).toBeNull();
  });

  it('zu kurz oder zu langsam: nichts', () => {
    expect(classifySwipe(p(300, 400, 0), p(300 - SWIPE_MIN_PX + 1, 400, 100))).toBeNull();
    expect(classifySwipe(p(300, 400, 0), p(100, 400, SWIPE_MAX_MS + 1))).toBeNull();
    expect(classifySwipe(p(300, 400, 10), p(100, 400, 5))).toBeNull();
  });

  it('Beginn am Bildschirmrand (Zurück-Geste von iOS) zählt nie', () => {
    expect(swipeExcluded(null, 10, 390)).toBe(true);
    expect(swipeExcluded(null, 385, 390)).toBe(true);
    expect(swipeExcluded(null, 200, 390)).toBe(false);
  });
});

describe('Blatt nach unten wischen', () => {
  it('schließt ab einem Weg oder mit Schwung, sonst federt es zurück', () => {
    expect(shouldDismiss(DISMISS_PX + 1, 0)).toBe(true);
    expect(shouldDismiss(40, 900)).toBe(true);
    expect(shouldDismiss(10, 900)).toBe(false);
    expect(shouldDismiss(60, 100)).toBe(false);
    expect(shouldDismiss(-200, -900)).toBe(false);
  });
});
