import { describe, expect, it } from 'vitest';
import { decideDrag } from '../../src/engine/tileDrag';

describe('decideDrag (Finger)', () => {
  it('wartet bei kleiner Bewegung ohne Halten', () => {
    expect(decideDrag({ dx: 0, dy: 0, heldMs: 0 })).toBe('pending');
    expect(decideDrag({ dx: 5, dy: 0, heldMs: 100 })).toBe('pending');
    expect(decideDrag({ dx: 5.9, dy: 5.9, heldMs: 149 })).toBe('pending');
  });
  it('zieht ab 6 px waagrecht', () => {
    expect(decideDrag({ dx: 6, dy: 0, heldMs: 10 })).toBe('drag');
    expect(decideDrag({ dx: -8, dy: 3, heldMs: 10 })).toBe('drag');
  });
  it('senkrecht gewinnt, auch bei Gleichstand', () => {
    expect(decideDrag({ dx: 2, dy: 7, heldMs: 10 })).toBe('scroll');
    expect(decideDrag({ dx: 6, dy: 6, heldMs: 10 })).toBe('scroll');
    expect(decideDrag({ dx: 7, dy: -6, heldMs: 10 })).toBe('drag');
    expect(decideDrag({ dx: 0, dy: -6, heldMs: 10 })).toBe('scroll');
  });
  it('150 ms Halten genügt: dann zieht jede echte Bewegung, auch senkrecht', () => {
    expect(decideDrag({ dx: 0, dy: 0, heldMs: 150 })).toBe('pending');
    expect(decideDrag({ dx: 1, dy: 0, heldMs: 400 })).toBe('pending');
    expect(decideDrag({ dx: 0, dy: 3, heldMs: 150 })).toBe('drag');
    expect(decideDrag({ dx: 0, dy: 20, heldMs: 149 })).toBe('scroll');
    expect(decideDrag({ dx: 0, dy: 20, heldMs: 150 })).toBe('drag');
  });
});

describe('decideDrag (Maus)', () => {
  it('zieht in jede Richtung ab 6 px', () => {
    expect(decideDrag({ dx: 0, dy: -5, heldMs: 0, pointer: 'mouse' })).toBe('pending');
    expect(decideDrag({ dx: 0, dy: -6, heldMs: 0, pointer: 'mouse' })).toBe('drag');
    expect(decideDrag({ dx: 4, dy: 4.5, heldMs: 0, pointer: 'mouse' })).toBe('drag');
  });
});
