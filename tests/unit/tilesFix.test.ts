import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../src/domain/answer/check';
import { acceptedWithAlternatives, chunkAlternatives } from '../../src/domain/chunks/alternatives';
import { toChunkCard } from '../../src/domain/srs/chunkCards';
import { buildExercise, buildTiles, tileMarks, tilesAnswer } from '../../src/domain/srs/exercise';
import { mulberry32 } from '../../src/domain/random';
import type { Tile } from '../../src/domain/srs/types';
import { dupIndex } from '../../src/engine/Tiles';
import { berlin } from './helpers';

// Emrahs Meldung 21.10.2026 (Bausteine „ein Viertelprozentpunkt“): sichtbare Plätze, Markierung je Baustein statt alles rot,
// gleichwertige Fassungen der ganzen Wendung, gleiche Bausteine (zwei „a“) vertauschbar.

const T = berlin('2026-10-21', 9);
const QUARTER = {
  id: 'c-a-quarter-of-a-percentage-point',
  en: 'a quarter of a percentage point',
  de: 'ein Viertelprozentpunkt',
  def: '0.25 percentage points',
  kind: 'phrase',
  register: 'neutral',
  why: '',
  level: 'C1',
  created: T,
  also: [],
  state: 'review',
  S: 6,
  D: 5,
  due: T - 1000,
  last: T - 6 * 86_400_000,
  reps: 3,
  lapses: 0,
  stage: 3,
};

/** Bausteine wie in Emrahs Bild: Lösung plus die Ablenker „clarify“ und „risen“. */
const TILES: Tile[] = [
  { id: 0, text: 'a', distractor: false },
  { id: 1, text: 'quarter', distractor: false },
  { id: 2, text: 'of', distractor: false },
  { id: 3, text: 'a', distractor: false },
  { id: 4, text: 'percentage', distractor: false },
  { id: 5, text: 'point', distractor: false },
  { id: 6, text: 'clarify', distractor: true },
  { id: 7, text: 'risen', distractor: true },
];
const ACC = acceptedWithAlternatives(QUARTER.en, QUARTER.en);

describe('Gleichwertige Fassungen der ganzen Wendung', () => {
  it('„a quarter of a percentage point“ kennt „a quarter percentage point“ und „a quarter point“', () => {
    expect(chunkAlternatives('a quarter of a percentage point')).toEqual(expect.arrayContaining(['a quarter percentage point', 'a quarter point', 'twenty-five basis points', '0.25 percentage points']));
    expect(ACC[0]).toBe('a quarter of a percentage point');
    // Aus den vorhandenen Bausteinen legbar und richtig: ohne „of a“, und „a quarter point“ (= a quarter-point).
    for (const given of ['a quarter percentage point', 'a quarter point', 'a quarter of a percentage point']) expect(checkTyped(given, ACC, { lemma: QUARTER.en }).verdict).toBe('correct');
    expect(checkTyped('a percentage point', ACC, { lemma: QUARTER.en }).verdict).not.toBe('correct');
  });

  it('Lehrer-Liste: Zinserhöhung in mehreren Fassungen (auch ohne „to“), „a quarter-point“ wie „a quarter point“; „to rise interest rates“ und „25 percent“ bleiben falsch', () => {
    const acc = acceptedWithAlternatives('to raise interest rates', 'to raise interest rates');
    for (const given of ['raise interest rates', 'to hike rates', 'hike interest rates', 'put interest rates up', 'to put up interest rates', 'increase rates']) expect(checkTyped(given, acc, { lemma: 'to raise interest rates' }).verdict).toBe('correct');
    expect(checkTyped('to rise interest rates', acc, { lemma: 'to raise interest rates' }).verdict).not.toBe('correct');
    expect(checkTyped('rise interest rates', acc, { lemma: 'to raise interest rates' }).verdict).not.toBe('correct');
    expect(checkTyped('a quarter-point', ACC, { lemma: QUARTER.en }).verdict).toBe('correct');
    for (const given of ['25 percent', 'a quarter percent', 'a quarter of a percent']) expect(checkTyped(given, ACC, { lemma: QUARTER.en }).verdict).not.toBe('correct');
  });

  it('nur für die ganze Wendung: ein einzelnes Wort oder eine andere Form bekommt keine fremde Fassung', () => {
    expect(acceptedWithAlternatives(QUARTER.en, 'quarter')).toEqual(['quarter']);
    expect(acceptedWithAlternatives('meet a deadline', 'meet a deadline')).toEqual(['meet a deadline']);
  });

  it('Bausteine-Aufgabe der Karte trägt die Fassungen; die angezeigte Lösung bleibt die Lernform; jede Lösung ist aus den Bausteinen legbar oder ausdrücklich nicht', () => {
    const card = toChunkCard(QUARTER.id, QUARTER, T);
    expect(card).not.toBeNull();
    const e = buildExercise(card!, 'tiles', 'de', [card!], '2026-10-21|t');
    expect(e.accepted[0]).toBe('a quarter of a percentage point');
    expect(e.accepted).toEqual(expect.arrayContaining(['a quarter percentage point', 'a quarter point']));
    const words = (e.tiles ?? []).filter((x) => !x.distractor).map((x) => x.text);
    expect(words).toHaveLength(6);
    expect(words.filter((w) => w === 'a')).toHaveLength(2);
  });
});

describe('Markierung je Baustein (nicht mehr alles rot)', () => {
  it('Lösung richtig gelegt: alle ✓, auch mit vertauschten gleichen Bausteinen (beide „a“)', () => {
    const swapped = [3, 1, 2, 0, 4, 5];
    expect(tilesAnswer(TILES, swapped, 'words')).toBe('a quarter of a percentage point');
    expect(Object.values(tileMarks(TILES, swapped, ACC, 'words'))).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  });

  it('ein Ablenker zu viel: nur er ist ✕, die richtigen bleiben ✓', () => {
    const m = tileMarks(TILES, [0, 1, 2, 3, 4, 7, 5], ACC, 'words');
    expect(m[7]).toBe('off');
    expect([0, 1, 2, 3, 4, 5].map((id) => m[id])).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
  });

  it('ein Wort an falscher Stelle: ↔ nur dort, der Rest ✓', () => {
    // „quarter a of a percentage point“
    const m = tileMarks(TILES, [1, 0, 2, 3, 4, 5], ACC, 'words');
    expect(Object.values(m).filter((x) => x === 'ok')).toHaveLength(5);
    expect(Object.values(m).filter((x) => x === 'near')).toHaveLength(1);
    expect(Object.values(m)).not.toContain('off');
  });

  it('kürzere gültige Fassung als Maßstab: „a quarter percentage risen“ → nur „risen“ ✕', () => {
    const m = tileMarks(TILES, [0, 1, 4, 7], ACC, 'words');
    expect([m[0], m[1], m[4]]).toEqual(['ok', 'ok', 'ok']);
    expect(m[7]).toBe('off');
  });

  it('Buchstaben-Bausteine: gleiche Buchstaben gleichwertig, nur der falsche ✕', () => {
    const { tiles } = buildTiles('deadline', [], mulberry32(3));
    const want = Array.from('deadlinx');
    const used = new Set<number>();
    const placed = want.map((ch) => {
      const t = tiles.find((x) => x.text === ch && !used.has(x.id)) ?? tiles.find((x) => x.distractor && !used.has(x.id))!;
      used.add(t.id);
      return t.id;
    });
    const m = tileMarks(tiles, placed, ['deadline'], 'letters');
    expect(placed.slice(0, 7).map((id) => m[id])).toEqual(['ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok']);
    expect(m[placed[7]!]).toBe('off');
  });
});

describe('Gleiche Bausteine sind erkennbar gezählt', () => {
  it('dupIndex: beide „a“ als 1/2 und 2/2, einzelne ohne Eintrag', () => {
    const d = dupIndex(TILES);
    expect(d.get(0)).toEqual({ k: 1, n: 2 });
    expect(d.get(3)).toEqual({ k: 2, n: 2 });
    expect(d.has(1)).toBe(false);
  });
});
