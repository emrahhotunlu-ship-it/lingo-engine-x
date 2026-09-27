import { describe, expect, it } from 'vitest';
import { exerciseBalance } from '../../src/domain/srs/vocabList';

// Wortblatt „Ergebnisse je Abfrageart": alte Werte (`modes`) und neue (`xs`) zusammen, nie doppelt.

describe('exerciseBalance', () => {
  it('nur alte Werte der alten App ({modus: {c, w}}) werden gezeigt', () => {
    const rows = exerciseBalance({ xs: {}, modes: { recog: { c: 5, w: 1 }, cloze: { c: 2, w: 2 }, listen: { c: 0, w: 0 } } });
    expect(rows).toEqual([
      { ex: 'recog', c: 5, w: 1, legacy: true },
      { ex: 'cloze', c: 2, w: 2, legacy: true },
    ]);
  });

  it('neue Antworten stehen je Übungsart; vom Modus bleibt nur der ältere Rest', () => {
    // mc_en und mc_de gehören zu „recog"; die App zählt sie in `modes.recog` mit.
    const rows = exerciseBalance({ xs: { mc_en: { c: 2, w: 0 }, mc_de: { c: 1, w: 1 } }, modes: { recog: { c: 7, w: 2 }, type: { c: 1, w: 0 } } });
    expect(rows).toContainEqual({ ex: 'mc_en', c: 2, w: 0, legacy: false });
    expect(rows).toContainEqual({ ex: 'mc_de', c: 1, w: 1, legacy: false });
    expect(rows).toContainEqual({ ex: 'recog', c: 4, w: 1, legacy: true });
    expect(rows).toContainEqual({ ex: 'type', c: 1, w: 0, legacy: true });
    const total = rows.reduce((a, r) => a + r.c + r.w, 0);
    expect(total).toBe(7 + 2 + 1);
  });

  it('nur neue Werte (Modus deckt sich mit xs): keine Zusatzzeile', () => {
    const rows = exerciseBalance({ xs: { cloze_hint: { c: 3, w: 1 } }, modes: { cloze: { c: 3, w: 1 } } });
    expect(rows).toEqual([{ ex: 'cloze_hint', c: 3, w: 1, legacy: false }]);
  });
});
