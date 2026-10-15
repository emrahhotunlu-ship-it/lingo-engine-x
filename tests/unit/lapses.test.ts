import { describe, expect, it } from 'vitest';
import { cardPatch, cardPatchSchema, reviewWrite } from '../../src/domain/srs/applyReview';
import { lapsesOf } from '../../src/domain/srs/lapses';
import { legacyToFsrs } from '../../src/domain/srs/legacyFsrs';
import type { AnswerEvent } from '../../src/domain/srs/types';

// Auswertung 15.10.2026, Punkt 3: Fehler am Partnerwort zählen nicht als Rückfall der Hauptkarte; EINE Lesefunktion für die Rückfälle.

const NOW = Date.UTC(2026, 9, 14, 10, 0, 0);
const DAY = 86_400_000;
const base: Record<string, unknown> = {
  word: 'eventually',
  pos: 'adverb',
  de: 'schließlich',
  def: 'in the end',
  ex: 'We will [eventually] ship it.',
  col: [{ p: 'eventually decide', de: 'schließlich entscheiden', gap: 'decide', opts: ['say', 'think'], ex: 'We will [eventually decide] soon.' }],
  state: 'review',
  S: 10,
  D: 5,
  last: NOW - 3 * DAY,
  due: NOW - 1000,
  reps: 4,
  lapses: 2,
  modes: {},
  stage: 4,
  hist: [],
  intro: '2026-08-01',
  order: 900,
  added: '2026-08-01',
  src: 'ai',
};
const seeded = { ...base, fsrs: { ...legacyToFsrs(base, NOW), lapses: 2 } };
const ans = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: '2026-10-14', kind: 'v', id: 'eventually', ex: 'colloc', grade: 1, given: 'say', ans: 'decide', ms: 4000, lang: 'de', ctx: 'rev', colIndex: 0, ...over });

describe('lapsesOf: eine Lesefunktion', () => {
  it('nimmt das Maximum aus lapses und fsrs.lapses (be-handled: 11 gegen 7)', () => {
    expect(lapsesOf({ lapses: 11, fsrs: { lapses: 7 } })).toBe(11);
    expect(lapsesOf({ lapses: 3, fsrs: { lapses: 5 } })).toBe(5);
    expect(lapsesOf({ lapses: 4 })).toBe(4);
    expect(lapsesOf({ fsrs: { lapses: 2 } })).toBe(2);
  });
  it('unlesbar oder leer zählt 0, nichts wird umgeschrieben', () => {
    expect(lapsesOf(undefined)).toBe(0);
    expect(lapsesOf({ lapses: 'x', fsrs: 5 })).toBe(0);
    const doc = { lapses: 11, fsrs: { lapses: 7 } };
    lapsesOf(doc);
    expect(doc).toEqual({ lapses: 11, fsrs: { lapses: 7 } });
  });
});

describe('Partnerwort-Fehler (colloc, Index ≥ 0) ist kein Rückfall der Hauptkarte', () => {
  it('lapses und fsrs.lapses bleiben, Fälligkeit und Stabilität auch; der Fehler steht in modes/xs/hist', () => {
    const p = cardPatch(seeded, ans()) as Record<string, any>;
    expect(p.lapses).toBe(2);
    expect(p.fsrs.lapses).toBe(2);
    expect(p.due).toBe(base.due);
    expect(p.S).toBe(10);
    expect(p.modes.colloc).toEqual({ c: 0, w: 1 });
    expect(p.xs.colloc).toEqual({ c: 0, w: 1 });
    expect(p.hist.at(-1)).toMatchObject({ x: 'colloc', g: 1 });
    expect(p.colN).toBeUndefined();
    expect(cardPatchSchema.safeParse(p).success).toBe(true);
  });

  it('colloc_gap (Auswahl) genauso', () => {
    const p = cardPatch(seeded, ans({ ex: 'colloc_gap' })) as Record<string, any>;
    expect(p.lapses).toBe(2);
    expect(p.fsrs.lapses).toBe(2);
  });

  it('ein Fehler bei einer anderen Abfrageart zählt weiter als Rückfall', () => {
    const p = cardPatch(seeded, ans({ ex: 'cloze', colIndex: undefined })) as Record<string, any>;
    expect(p.lapses).toBe(3);
    expect(p.fsrs.lapses).toBe(3);
  });

  it('colloc ohne Partner-Index (die Wendung ist die Karte selbst, Index −1) zählt weiter', () => {
    const p = cardPatch(seeded, ans({ colIndex: undefined })) as Record<string, any>;
    expect(p.lapses).toBe(3);
  });

  it('richtige Antwort am Partnerwort läuft wie bisher', () => {
    const p = cardPatch(seeded, ans({ grade: 3, given: 'decide' })) as Record<string, any>;
    expect(p.lapses).toBe(2);
    expect(p.colN).toEqual([1]);
    expect(p.S).toBeGreaterThan(10);
  });

  it('der Zähler wächst aus dem größeren der beiden alten Werte (11 gegen 7), ohne etwas Altes umzuschreiben', () => {
    const doc = { ...base, lapses: 11, fsrs: { ...legacyToFsrs(base, NOW), lapses: 7 } };
    const p = cardPatch(doc, ans({ ex: 'cloze', colIndex: undefined })) as Record<string, any>;
    expect(p.lapses).toBe(12);
    expect(doc.lapses).toBe(11);
  });

  it('reviewWrite nimmt den Patch an', () => {
    const w = reviewWrite('vocab/eventually', seeded, ans(), null);
    expect(w.kind).toBe('update');
  });
});
