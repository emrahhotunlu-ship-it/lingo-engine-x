import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { clampRect, defaultRect, fullRect, homeVp, isLow, isPhone, keyboardRect, loadWin, MIN_H, MIN_W, moveRect, movePill, parkedPill, parseSaved, pillRect, PILL_H, resizeRect, saveWin, WIN_KEY, type Vp } from '../../src/features/companion/floatWindow';
import { nextScroll, READ_MARGIN_PX, readingSpacer } from '../../src/ui/chat/scroll';

// Schwebefenster des Begleiters (Klemmen, Standardlage, Verschieben, Größe ändern, Merken je Gerät)
// und die Leseregel des Begleiter-Chats (eigene Frage oben, danach nie automatisch weiter nach unten).

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}
const storage = new MemStorage();
beforeAll(() => {
  vi.stubGlobal('window', { localStorage: storage, sessionStorage: new MemStorage(), addEventListener: () => undefined, removeEventListener: () => undefined });
});
afterEach(() => storage.m.clear());

const phone: Vp = { left: 0, top: 0, width: 390, height: 844 };
const desk: Vp = { left: 0, top: 0, width: 1440, height: 900 };
const inside = (r: { x: number; y: number; w: number; h: number }, v: Vp) => r.x >= v.left && r.y >= v.top && r.x + r.w <= v.left + v.width && r.y + r.h <= v.top + v.height;

describe('Schwebefenster: Standardlage', () => {
  it('Handy: unteres Drittel, ~60 % Höhe, ganze Breite minus Rand; die Aufgabe oben bleibt sichtbar', () => {
    const r = defaultRect(phone);
    expect(r.h).toBe(Math.round(844 * 0.68));
    expect(r.y + r.h).toBeGreaterThan(844 - 20);
    expect(r.y).toBeGreaterThan(844 * 0.3);
    expect(r.w).toBe(390 - 16);
  });
  it('Desktop: unten rechts, nicht mittig', () => {
    const r = defaultRect(desk);
    expect(r.x + r.w).toBeGreaterThan(1440 - 40);
    expect(r.x).toBeGreaterThan(1440 / 2);
    expect(r.y + r.h).toBeGreaterThan(900 - 40);
    expect(inside(r, desk)).toBe(true);
  });
  it('Vollbild: Handy ganze Fläche, Desktop zentriert', () => {
    expect(fullRect(phone)).toEqual({ x: 0, y: 0, w: 390, h: 844 });
    const f = fullRect(desk);
    expect(f.x * 2 + f.w).toBe(1440);
  });
});

describe('Schwebefenster: Klemmen', () => {
  it('Lage außerhalb wird zurück in den sichtbaren Bereich geholt, Größe bleibt', () => {
    expect(clampRect({ x: 2000, y: -50, w: 400, h: 300 }, desk)).toEqual({ x: 1040, y: 0, w: 400, h: 300 });
  });
  it('zu klein → Mindestgröße, zu groß → Bildschirm', () => {
    const small = clampRect({ x: 10, y: 10, w: 50, h: 50 }, desk);
    expect([small.w, small.h]).toEqual([MIN_W, MIN_H]);
    const big = clampRect({ x: 0, y: 0, w: 5000, h: 5000 }, desk);
    expect([big.w, big.h]).toEqual([1440, 900]);
  });
  it('nach dem Drehen (Querformat → Hochformat) liegt alles wieder innen', () => {
    const land: Vp = { left: 0, top: 0, width: 844, height: 390 };
    const r = clampRect({ x: 500, y: 100, w: 600, h: 280 }, phone);
    expect(inside(r, phone)).toBe(true);
    expect(inside(clampRect(r, land), land)).toBe(true);
  });
  it('Tastatur: sichtbarer Bereich verkleinert sich, das Fenster bleibt darin', () => {
    const withKb: Vp = { left: 0, top: 0, width: 390, height: 420 };
    const r = clampRect(defaultRect(phone), withKb);
    expect(inside(r, withKb)).toBe(true);
    expect(r.h).toBeLessThanOrEqual(420);
  });
  it('ungültige Zahlen (NaN) fallen auf Mindestwerte', () => {
    const r = clampRect({ x: NaN, y: NaN, w: NaN, h: NaN }, desk);
    expect(inside(r, desk)).toBe(true);
  });
  it('Bereich kleiner als die Mindestgröße: Bereichsgröße gewinnt', () => {
    const tiny: Vp = { left: 0, top: 0, width: 200, height: 180 };
    expect(clampRect({ x: 0, y: 0, w: 400, h: 400 }, tiny)).toEqual({ x: 0, y: 0, w: 200, h: 180 });
  });
});

describe('Schwebefenster: Verschieben und Größe ändern', () => {
  const start = { x: 100, y: 100, w: 400, h: 300 };
  it('Verschieben klemmt an den Rändern', () => {
    expect(moveRect(start, 50, -500, desk)).toEqual({ x: 150, y: 0, w: 400, h: 300 });
    expect(moveRect(start, 5000, 5000, desk)).toEqual({ x: 1040, y: 600, w: 400, h: 300 });
  });
  it('Ecke unten rechts wächst mit dem Finger, bleibt im Bildschirm', () => {
    expect(resizeRect('se', start, 100, 50, desk)).toEqual({ x: 100, y: 100, w: 500, h: 350 });
    const r = resizeRect('se', start, 9000, 9000, desk);
    expect([r.x + r.w, r.y + r.h]).toEqual([1440, 900]);
  });
  it('Mindestgröße: die bewegte Kante bleibt stehen, die gegenüberliegende bewegt sich nie', () => {
    const r = resizeRect('nw', start, 900, 900, desk);
    expect([r.w, r.h]).toEqual([MIN_W, MIN_H]);
    expect([r.x + r.w, r.y + r.h]).toEqual([500, 400]);
    const e = resizeRect('e', start, -900, 0, desk);
    expect([e.x, e.w]).toEqual([100, MIN_W]);
  });
  it('linke Kante nach außen: Breite wächst nach links bis zum Rand', () => {
    const r = resizeRect('w', start, -900, 0, desk);
    expect([r.x, r.x + r.w]).toEqual([0, 500]);
  });
});

describe('Schwebefenster: Pille', () => {
  it('nur Kopfleiste, sitzt am unteren Rand des Fensters, im Bereich', () => {
    const base = { x: 100, y: 200, w: 400, h: 500 };
    const p = pillRect(base, desk);
    expect(p.h).toBe(PILL_H);
    expect(p.y + p.h).toBe(700);
    expect(p.w).toBeLessThanOrEqual(base.w);
    expect(inside(p, desk)).toBe(true);
  });
});

describe('Schwebefenster: Merken je Gerät (platform/storage)', () => {
  it('speichern und wieder laden', () => {
    saveWin({ rect: { x: 10, y: 20, w: 300, h: 400 }, mode: 'full' });
    expect(storage.getItem(WIN_KEY)).toContain('"mode":"full"');
    expect(loadWin()).toEqual({ rect: { x: 10, y: 20, w: 300, h: 400 }, mode: 'full' });
  });
  it('kaputte oder fremde Daten werden ignoriert', () => {
    storage.setItem(WIN_KEY, '{kaputt');
    expect(loadWin()).toBeNull();
    expect(parseSaved({ rect: { x: 'a' } })).toBeNull();
    expect(parseSaved({ rect: { x: 1, y: 1, w: 0, h: 5 } })).toBeNull();
    expect(parseSaved(null)).toBeNull();
    expect(parseSaved({ rect: { x: 1, y: 1, w: 5, h: 5 }, mode: 'x' })?.mode).toBe('float');
  });
});

describe('Leseregel des Begleiter-Chats (nextScroll, Modus read)', () => {
  const m = { scrollTop: 0, scrollHeight: 2000, clientHeight: 500 };
  it('Senden: die eigene Frage rückt an den oberen Rand (mit kleinem Abstand)', () => {
    const d = nextScroll({ atBottom: true }, m, 'send', { mode: 'read', anchorTop: 600 });
    expect(d.scrollTop).toBe(600 - READ_MARGIN_PX);
    expect(d.jump).toBe(true);
  });
  it('Senden: nie über das Ende hinaus, nie negativ', () => {
    expect(nextScroll({ atBottom: true }, m, 'send', { mode: 'read', anchorTop: 9000 }).scrollTop).toBe(1500);
    expect(nextScroll({ atBottom: true }, m, 'send', { mode: 'read', anchorTop: 2 }).scrollTop).toBe(0);
  });
  it('Einlaufen (grow): scrollt NIE, auch nicht, wenn man gerade unten war; Pille nur bei Inhalt unter dem Bereich', () => {
    expect(nextScroll({ atBottom: true }, m, 'grow', { mode: 'read' })).toEqual({ scrollTop: null, atBottom: false, jump: true });
    expect(nextScroll({ atBottom: true }, { ...m, scrollTop: 1500 }, 'grow', { mode: 'read' })).toEqual({ scrollTop: null, atBottom: true, jump: false });
    expect(nextScroll({ atBottom: true }, { scrollTop: 0, scrollHeight: 400, clientHeight: 500 }, 'grow', { mode: 'read' }).jump).toBe(false);
  });
  it('Standardmodus (Rollenspiel) bleibt unverändert', () => {
    expect(nextScroll({ atBottom: true }, m, 'grow')).toEqual({ scrollTop: 1500, atBottom: true, jump: false });
  });
  it('leerer Platz: genau so groß, dass die Frage oben stehen kann; schrumpft mit der Antwort bis 0', () => {
    // Frage bei 600, Inhalt endet bei 700, Fenster 500 hoch → 500 + 592 − 700 = 392
    expect(readingSpacer(600, 700, 500)).toBe(392);
    expect(readingSpacer(600, 900, 500)).toBe(192);
    expect(readingSpacer(600, 1200, 500)).toBe(0);
  });
});

describe('Schwebefenster: Leisten, Handy-Erkennung, Tastatur', () => {
  it('Mindestbreite 340', () => {
    expect(MIN_W).toBe(340);
    expect(clampRect({ x: 0, y: 0, w: 200, h: 300 }, desk).w).toBe(340);
  });
  it('Handy-Erkennung: schmal, Querformat 844x390, Touch-Tablet; Desktop nicht', () => {
    expect(isPhone(390, 844)).toBe(true);
    expect(isPhone(844, 390)).toBe(true);
    expect(isPhone(700, 600, true)).toBe(true);
    expect(isPhone(1440, 900)).toBe(false);
    expect(isPhone(1024, 768, true)).toBe(false);
  });
  it('Standardlage und Pille liegen über der Aktionsleiste (home-Bereich), Handy wie Desktop', () => {
    const bar = 96;
    for (const [v, mob] of [[phone, true], [desk, false], [{ left: 0, top: 0, width: 2560, height: 1440 }, false]] as const) {
      const h = homeVp(v, bar);
      expect(h.height).toBe(v.height - bar);
      const r = defaultRect(h, mob);
      expect(r.y + r.h).toBeLessThanOrEqual(v.height - bar);
      const p = pillRect(r, h);
      expect(p.y + p.h).toBeLessThanOrEqual(v.height - bar);
    }
  });
  it('Querformat 844x390: Fenster rechts über die Höhe, innen', () => {
    const land: Vp = { left: 0, top: 0, width: 844, height: 390 };
    const r = defaultRect(land, true);
    expect(inside(r, land)).toBe(true);
    expect(r.x).toBeGreaterThan(844 / 2 - 20);
    expect(r.w).toBeGreaterThanOrEqual(MIN_W);
    expect(fullRect(land, true)).toEqual({ x: 0, y: 0, w: 844, h: 390 });
  });
  it('Tastatur: Fenster wächst bis zur vollen Höhe über der Tastatur, niedrige Höhe blendet Zeilen aus', () => {
    const kbVp: Vp = { left: 0, top: 0, width: 390, height: 360 };
    const r = keyboardRect(defaultRect(kbVp, true), kbVp);
    expect(r.h).toBeGreaterThanOrEqual(360 - 8);
    expect(inside(r, kbVp)).toBe(true);
    expect(isLow(900, true)).toBe(true);
    expect(isLow(390, false)).toBe(true);
    expect(isLow(900, false)).toBe(false);
  });
  it('Pille parkt am Handy oben rechts und bleibt beim Ziehen innen', () => {
    const p = parkedPill(phone, 64);
    expect(p.y).toBe(64);
    expect(p.x + p.w).toBeLessThanOrEqual(390);
    expect(p.x).toBeGreaterThan(0);
    const m = movePill(p, 500, 5000, phone);
    expect(m.x + m.w).toBe(390);
    expect(m.y + m.h).toBe(844);
  });
});
