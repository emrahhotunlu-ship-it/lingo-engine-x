import { describe, expect, it } from 'vitest';
import { applyUpdate, cardPatch, partnerMissPatchSchema, reviewWrite } from '../../src/domain/srs/applyReview';
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
type P = { lapses?: number; fsrs?: { lapses: number }; due?: number; S?: number; stage?: number; reps?: number; last?: number; co?: number; modes: Record<string, { c: number; w: number }>; xs: Record<string, { c: number; w: number }>; hist: Array<Record<string, unknown>>; colN?: number[] };
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
  it('es wird NUR der Verlauf geschrieben (hist, modes, xs, co): stage, fsrs, due, reps, last, lapses, S bleiben', () => {
    const p = cardPatch(seeded, ans()) as unknown as P;
    expect(Object.keys(p).sort()).toEqual(['co', 'hist', 'modes', 'xs']);
    expect(p.modes.colloc).toEqual({ c: 0, w: 1 });
    expect(p.xs.colloc).toEqual({ c: 0, w: 1 });
    expect(p.hist.at(-1)).toMatchObject({ x: 'colloc', g: 1, ci: 0 });
    expect(partnerMissPatchSchema.safeParse(p).success).toBe(true);
    // Das Ergebnis auf der Karte: Fälligkeit, Stabilität, Stufe, letzte Wiederholung und fsrs unverändert (die fsrs.last-Gleichheit bleibt erhalten).
    const merged = applyUpdate(seeded, p) as Record<string, unknown> & { fsrs: { last: number; due: number; reps: number } };
    for (const k of ['stage', 'due', 'reps', 'last', 'lapses', 'S', 'D', 'state']) expect(merged[k], k).toEqual((seeded as Record<string, unknown>)[k]);
    expect(merged.fsrs).toEqual(seeded.fsrs);
    expect(merged.fsrs.last).toBe(merged.last);
    expect(merged.fsrs.due).toBe(merged.due);
  });

  it('colloc_gap (Auswahl) genauso, auch auf Stufe 3: die Hauptkarte wird nicht abgestuft', () => {
    const s3 = { ...seeded, stage: 3 };
    const p = cardPatch(s3, ans({ ex: 'colloc_gap' })) as unknown as P;
    expect(Object.keys(p).sort()).toEqual(['co', 'hist', 'modes', 'xs']);
    const merged = applyUpdate(s3, p);
    expect(merged.stage).toBe(3);
    expect(merged.fsrs).toEqual(s3.fsrs);
  });

  it('Stufe 4: ein Partnerwort-Fehler senkt die Stufe nicht; derselbe Fehler bei einer anderen Art schon', () => {
    expect(applyUpdate(seeded, cardPatch(seeded, ans()) as never).stage).toBe(4);
    expect(cardPatch(seeded, ans({ ex: 'cloze', colIndex: undefined })).stage).toBe(3);
  });

  it('derselbe Fehler wird nicht zweimal geschrieben (Zeitstempel im Verlauf)', () => {
    const first = reviewWrite('vocab/eventually', seeded, ans(), null);
    expect(first.kind).toBe('update');
    if (first.kind !== 'update') return;
    const after = applyUpdate(seeded, first.patch);
    expect(reviewWrite('vocab/eventually', after, ans(), null)).toEqual({ kind: 'skip', reason: 'already_applied' });
  });

  it('ein Fehler bei einer anderen Abfrageart zählt weiter als Rückfall', () => {
    const p = cardPatch(seeded, ans({ ex: 'cloze', colIndex: undefined })) as unknown as P;
    expect(p.lapses).toBe(3);
    expect(p.fsrs?.lapses).toBe(3);
  });

  it('colloc ohne Partner-Index (die Wendung ist die Karte selbst, Index −1) zählt weiter', () => {
    const p = cardPatch(seeded, ans({ colIndex: undefined })) as unknown as P;
    expect(p.lapses).toBe(3);
  });

  it('richtige Antwort am Partnerwort läuft wie bisher', () => {
    const p = cardPatch(seeded, ans({ grade: 3, given: 'decide' })) as unknown as P;
    expect(p.lapses).toBe(2);
    expect(p.colN).toEqual([1]);
    expect(p.S).toBeGreaterThan(10);
    expect(p.hist.at(-1)).toMatchObject({ x: 'colloc', g: 3, ci: 0 });
  });

  it('das Feld lapses wächst nur um +1 bei einem echten Rückfall (11 → 12); das Maximum mit fsrs.lapses bildet allein der Leser (Datenwächter W1)', () => {
    const doc = { ...base, lapses: 11, fsrs: { ...legacyToFsrs(base, NOW), lapses: 7 } };
    const p = cardPatch(doc, ans({ ex: 'cloze', colIndex: undefined })) as unknown as P;
    expect(p.lapses).toBe(12);
    expect(p.fsrs?.lapses).toBe(8);
    expect(doc.lapses).toBe(11);
  });

  it('eine richtige Antwort ändert den Altwert lapses nicht, auch wenn fsrs.lapses größer ist (3 gegen 5 bleibt 3)', () => {
    const doc = { ...base, lapses: 3, fsrs: { ...legacyToFsrs(base, NOW), lapses: 5 } };
    const p = cardPatch(doc, ans({ ex: 'cloze', grade: 3, colIndex: undefined })) as unknown as P;
    expect(p.lapses).toBe(3);
    expect(lapsesOf({ lapses: p.lapses, fsrs: { lapses: 5 } })).toBe(5);
  });

  it('reviewWrite nimmt den Patch an', () => {
    const w = reviewWrite('vocab/eventually', seeded, ans(), null);
    expect(w.kind).toBe('update');
    if (w.kind === 'update') expect(Object.keys(w.patch).sort()).toEqual(['co', 'hist', 'modes', 'xs']);
  });
});
