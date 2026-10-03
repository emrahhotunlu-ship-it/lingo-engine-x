import { describe, expect, it } from 'vitest';
import { isPhone } from '../../src/platform/device';

// Geräteart für den Handy-Modus (Emrah 01.10.2026): Touch UND kurze Bildschirmseite < 500 px.

describe('isPhone', () => {
  it('iPhone und Android-Handys (Touch, kurze Seite 320–440)', () => {
    expect(isPhone({ coarse: true, width: 390, height: 844 })).toBe(true);
    expect(isPhone({ coarse: true, width: 320, height: 568 })).toBe(true);
    expect(isPhone({ coarse: true, width: 430, height: 932 })).toBe(true);
    expect(isPhone({ coarse: true, width: 360, height: 800 })).toBe(true);
  });
  it('Drehen ändert nichts: die kurze Seite zählt, nicht die Breite', () => {
    expect(isPhone({ coarse: true, width: 844, height: 390 })).toBe(true);
    expect(isPhone({ coarse: true, width: 932, height: 430 })).toBe(true);
  });
  it('iPad und Tablets sind keine Handys', () => {
    expect(isPhone({ coarse: true, width: 744, height: 1133 })).toBe(false);
    expect(isPhone({ coarse: true, width: 820, height: 1180 })).toBe(false);
    expect(isPhone({ coarse: true, width: 1024, height: 1366 })).toBe(false);
  });
  it('Laptop und Desktop (feiner Zeiger) sind keine Handys, auch mit schmalem Fenster', () => {
    expect(isPhone({ coarse: false, width: 390, height: 844 })).toBe(false);
    expect(isPhone({ coarse: false, width: 1440, height: 900 })).toBe(false);
  });
  it('unbekannte Bildschirmgröße (0) gilt nicht als Handy', () => {
    expect(isPhone({ coarse: true, width: 0, height: 0 })).toBe(false);
  });
});
