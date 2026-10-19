import { describe, expect, it } from 'vitest';
import { colChargeFor } from '../../src/content/col';
import { dayKey } from '../../src/domain/date';
import { applyUpdate, cardPatch, cardPatchSchema, partnerMissPatchSchema, reviewWrite } from '../../src/domain/srs/applyReview';
import { chargeCollocsFor, needsCollocs } from '../../src/domain/srs/collocs';
import { buildExercise } from '../../src/domain/srs/exercise';
import { toTrainCard } from '../../src/domain/srs/cards';
import { availableExercises, supports } from '../../src/domain/srs/modes';
import type { AnswerEvent, TrainCard } from '../../src/domain/srs/types';
import { validateDoc } from '../../src/data/validate';

// Engine-Verdrahtung 19.10.2026: Die Wortpartner-Charge `col` erscheint auf passenden Karten als Wortpartner-Übung (Auswahl, Lücke), höchstens eine je Karte
// und Lerntag; die Ablenker stammen nur aus der Charge; gebucht wird über den normalen Antwort-Schreibweg, der die Charge im selben Schritt ergänzt.

const NOW = new Date(2026, 9, 19, 10, 0).getTime();
const DAY = 86_400_000;
const WORD = 'concern';

const reviewDoc = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  word: WORD,
  de: 'Bedenken',
  def: 'a feeling of worry',
  ex: 'Her main [concern] was the budget.',
  stage: 3,
  state: 'review',
  S: 6,
  D: 5,
  due: NOW - DAY,
  last: NOW - 7 * DAY,
  reps: 4,
  lapses: 0,
  hist: [{ t: NOW - 7 * DAY, m: 'recog', g: 3, x: 'mc_de' }],
  ...extra,
});

const card = (doc: Record<string, unknown>, now = NOW): TrainCard => {
  const c = toTrainCard('concern', doc, true, now);
  if (!c) throw new Error('keine Karte');
  return c;
};

const answer = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: dayKey(NOW), kind: 'v', id: 'concern', ex: 'colloc_gap', grade: 3, given: '', ans: '', ms: 4000, lang: 'de', ctx: 'rev', colIndex: 0, ...over });

describe('Charge col: Anzeige auf der Karte', () => {
  it('Karte ohne eigene Wortpartner bekommt die geprüften der Charge (ohne Marke ai)', () => {
    const raw = colChargeFor(WORD);
    expect(raw?.length).toBeGreaterThan(0);
    const c = card(reviewDoc());
    expect(c.col.length).toBe(raw?.length);
    expect(c.col.every((x) => !x.ai && !!x.ctx)).toBe(true);
    expect(supports(c, 'colloc_gap', 'de', 10)).toBe(true);
  });

  it('eigene Wortpartner gehen vor, ausgeblendete Karten bekommen nichts', () => {
    const own = [{ p: 'raise a concern', de: 'Bedenken äußern', gap: 'raise', opts: ['lift', 'make'], ex: 'She [raised a concern] about the plan.' }];
    expect(card(reviewDoc({ col: own })).col.map((x) => x.p)).toEqual(['raise a concern']);
    expect(chargeCollocsFor(reviewDoc({ hidden: true }))).toBeNull();
    expect(chargeCollocsFor({ word: 'no such charge word' })).toBeNull();
  });

  it('Claude wird nicht nach Wortpartnern gefragt, wenn die Charge welche hat', () => {
    const doc = reviewDoc();
    expect(needsCollocs({ kind: 'vocab', inDb: true, doc }, NOW)).toBe(false);
    expect(needsCollocs({ kind: 'vocab', inDb: true, doc: { ...doc, word: 'no such charge word' } }, NOW)).toBe(true);
  });

  it('Ablenker kommen nur aus der Charge', () => {
    const c = card(reviewDoc());
    const allowed = new Set(c.col.flatMap((x) => [x.gap, x.ctx?.gap ?? '', ...x.opts]).map((s) => s.toLowerCase()));
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const e = buildExercise(c, 'colloc_gap', 'de', [], seed);
      expect(e.options?.length).toBeGreaterThanOrEqual(3);
      for (const o of e.options ?? []) expect(allowed.has(o.label.toLowerCase())).toBe(true);
    }
  });
});

describe('Charge col: höchstens eine Wortpartner-Aufgabe je Karte und Lerntag', () => {
  it('nach einer Wortpartner-Antwort heute keine weitere, morgen wieder', () => {
    const doc = reviewDoc({ hist: [{ t: NOW - 60_000, m: 'colloc', g: 3, x: 'colloc_gap', ci: 0 }] });
    const today = card(doc);
    expect(today.partnerToday).toBe(true);
    expect(supports(today, 'colloc_gap', 'de', 10)).toBe(false);
    expect(supports(today, 'colloc', 'de', 10)).toBe(false);
    expect(availableExercises(today, 'de', 10).length).toBeGreaterThanOrEqual(2);
    const tomorrow = card(doc, NOW + DAY);
    expect(tomorrow.partnerToday).toBeUndefined();
    expect(supports(tomorrow, 'colloc_gap', 'de', 10)).toBe(true);
  });

  it('Tageswechsel um 04:00: eine Antwort um 02:00 zählt zum Vortag', () => {
    const at2 = new Date(2026, 9, 19, 2, 0).getTime();
    const doc = reviewDoc({ hist: [{ t: at2, m: 'colloc', g: 3, x: 'colloc', ci: 0 }] });
    expect(card(doc, new Date(2026, 9, 19, 3, 30).getTime()).partnerToday).toBe(true);
    expect(card(doc, new Date(2026, 9, 19, 5, 0).getTime()).partnerToday).toBeUndefined();
  });
});

describe('Charge col: Buchung über den normalen Schreibweg', () => {
  it('erste Wortpartner-Antwort ergänzt col im selben Schritt, colN passt dazu', () => {
    const doc = reviewDoc();
    const w = reviewWrite('vocab/concern', doc, answer({ colIndex: 0 }), null);
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    expect(cardPatchSchema.safeParse(w.patch).success).toBe(true);
    const col = w.patch.col as Array<Record<string, unknown>>;
    expect(col).toHaveLength(colChargeFor(WORD)?.length ?? -1);
    expect(col.every((c) => !('ai' in c))).toBe(true);
    expect(w.patch.colN).toEqual(col.map((_, i) => (i === 0 ? 1 : 0)));
    // Ein Index außerhalb der Charge ergänzt nichts (die Übung kann ihn nicht gezeigt haben).
    expect(cardPatch(doc, answer({ colIndex: 5 }))).not.toHaveProperty('col');
    const merged = applyUpdate(doc, w.patch);
    expect(validateDoc('vocab/concern', merged).ok).toBe(true);
    // Die gespeicherte Liste ist dieselbe, die die Übung gezeigt hat (gleiche Reihenfolge, gleicher Index).
    expect(card(merged, NOW + DAY).col.map((x) => x.p)).toEqual(card(doc).col.map((x) => x.p));
  });

  it('Fehler am Partnerwort: nur Verlauf und Zähler, col wird trotzdem ergänzt', () => {
    const doc = reviewDoc();
    const w = reviewWrite('vocab/concern', doc, answer({ grade: 1 }), null);
    expect(w.kind).toBe('update');
    if (w.kind !== 'update') return;
    expect(partnerMissPatchSchema.safeParse(w.patch).success).toBe(true);
    expect(w.patch).not.toHaveProperty('due');
    expect(Array.isArray(w.patch.col)).toBe(true);
  });

  it('keine Ergänzung bei anderen Arten, bei vorhandenen Wortpartnern oder ohne Index', () => {
    expect(cardPatch(reviewDoc(), answer({ ex: 'mc_de', colIndex: undefined }))).not.toHaveProperty('col');
    expect(cardPatch(reviewDoc(), answer({ colIndex: -1 }))).not.toHaveProperty('col');
    const own = [{ p: 'raise a concern', de: 'Bedenken äußern', gap: 'raise', opts: ['lift', 'make'], ex: 'She [raised a concern] about the plan.' }];
    expect(cardPatch(reviewDoc({ col: own }), answer())).not.toHaveProperty('col');
  });
});
