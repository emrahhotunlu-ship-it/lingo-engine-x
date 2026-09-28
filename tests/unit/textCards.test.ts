import { describe, expect, it } from 'vitest';
import { textCards } from '../../src/prompts/nb/p3/textCards';

// text-cards@1 (N34): Satz muss aus dem Text stammen und das Wort enthalten; Ungültige fallen weg.
const text = 'Most finance leaders do not object to the price itself. A vendor who can lock in costs for three years will win the budget discussion.';

describe('text-cards@1', () => {
  it('Kopfzeile und Text als Daten', () => {
    const p = textCards.build({ text, known: ['price'] });
    expect(p.startsWith('[text-cards@1]')).toBe(true);
    expect(p).toContain('<<<TEXT');
    expect(p).toContain('Do not pick: price');
  });
  it('Schema: Sätze aus dem Text bleiben, erfundene fallen weg', () => {
    const r = textCards.schema({ text, known: [] }).safeParse({
      cards: [
        { word: 'lock in', pos: 'phrasal verb', de: 'festschreiben', def: 'to fix something so it cannot change', ex: 'A vendor who can lock in costs for three years will win the budget discussion.' },
        { word: 'object to', pos: 'phrase', de: 'etwas einwenden gegen', def: 'to disagree with something', ex: 'They object to everything we say.' },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.cards.map((c) => c.word)).toEqual(['lock in']);
  });
});
