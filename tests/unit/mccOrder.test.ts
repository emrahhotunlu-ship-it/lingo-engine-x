import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mccOrder } from '../../src/domain/c1x/kinds/mcc';
import { c1File } from '../../src/domain/c1x/schema';
import type { Mcc } from '../../src/domain/c1x/types';

// Die Optionen aller mcc-Aufgaben (auch K2 und Einstufung) werden beim Anzeigen fest gemischt: nie im festen Kreis A, B, C, D (Lehrer-Befund P35/P36).

const ROOT = join(process.cwd(), 'src/content/c1x/src');
const files = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(d, e.name)) : e.name.endsWith('.json') ? [join(d, e.name)] : []));
const mccs = files(ROOT).flatMap((p) => c1File.parse(JSON.parse(readFileSync(p, 'utf8'))).items).filter((i): i is Mcc => i.kind === 'mcc');

describe('mcc: Anzeigereihenfolge', () => {
  it('ist eine Umordnung der vier Plätze, stabil je Aufgabe und Tag', () => {
    expect(mccs.length).toBeGreaterThan(100);
    for (const m of mccs) {
      const o = mccOrder(m, '2026-10-07');
      expect([...o].sort()).toEqual([0, 1, 2, 3]);
      expect(mccOrder(m, '2026-10-07')).toEqual(o);
    }
  });

  it('die richtige Antwort steht im Mittel auf jedem Platz gleich oft und nicht im festen Kreis', () => {
    for (const day of ['2026-10-07', '2026-10-08']) {
      const count = [0, 0, 0, 0];
      let same = 0;
      for (const m of mccs) {
        const shown = mccOrder(m, day).indexOf(m.answer);
        count[shown] = (count[shown] ?? 0) + 1;
        if (shown === m.answer) same++;
      }
      for (const c of count) {
        expect(c / mccs.length).toBeGreaterThan(0.17);
        expect(c / mccs.length).toBeLessThan(0.33);
      }
      // Bleibt ein Platz gleich, dann zufällig (etwa ein Viertel), nicht für alle.
      expect(same / mccs.length).toBeLessThan(0.35);
    }
  });

  it('am nächsten Tag ändert sich die Reihenfolge bei den meisten Aufgaben', () => {
    const changed = mccs.filter((m) => mccOrder(m, '2026-10-07').join() !== mccOrder(m, '2026-10-08').join()).length;
    expect(changed / mccs.length).toBeGreaterThan(0.8);
  });

  it('die Wertung folgt dem Index im Inhalt: Anzeigeplatz → order → pick ist die Lösung', () => {
    for (const m of mccs.slice(0, 50)) {
      const order = mccOrder(m, '2026-10-07');
      const displayOfAnswer = order.indexOf(m.answer);
      expect(order[displayOfAnswer]).toBe(m.answer);
    }
  });
});
