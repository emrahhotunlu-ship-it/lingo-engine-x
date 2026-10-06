import { describe, expect, it } from 'vitest';
import { TRAPS } from '../../src/content/nb/traps';
import { TRAP_INDEX } from '../../src/content/nb/trapIndex';
import { matchTrapInAnswer, trapForCard, trapForWord, trapsWithoutIndex } from '../../src/domain/srs/traps';
import type { TrainCard } from '../../src/domain/srs/types';
import { toTrainCard } from '../../src/domain/srs/cards';
import { berlin } from './helpers';

describe('Fallen-Index', () => {
  it('jede Falle aus traps.ts hat mindestens ein englisches Wort, und es gibt keine fremden Kennungen', () => {
    expect(trapsWithoutIndex()).toEqual([]);
    const ids = new Set(TRAPS.map((t) => t.id));
    for (const id of Object.keys(TRAP_INDEX)) expect(ids.has(id), id).toBe(true);
    for (const t of TRAPS) expect(TRAP_INDEX[t.id]?.de.length, t.id).toBeGreaterThan(0);
  });
  it('trapForWord: ganze Wörter und Wendungen, Groß/klein egal', () => {
    expect(trapForWord('actual')?.id).toBe('f01');
    expect(trapForWord('Prospect')?.id).toBe('f05');
    expect(trapForWord('prospects')).toBeNull();
    expect(trapForWord('give a discount')?.id).toBe('f19');
    expect(trapForWord('actualize')).toBeNull();
    expect(trapForWord('account for')).toBeNull();
  });
  it('trapForCard: über Paket-Kennung und über das Kartenwort', () => {
    const NOW = berlin('2026-10-05', 9);
    const mk = (word: string) => (toTrainCard(word, { word, de: 'x', ex: `The ${word} matters.`, state: 'new', added: '2026-10-05', order: 1 }, true, NOW) as TrainCard);
    expect(trapForCard(mk('meet a deadline'))?.id).toBe('f10');
    expect(trapForCard(mk('hold a meeting'))?.id).toBe('f21');
    expect(trapForCard(mk('eventually'))?.id).toBe('f02');
    expect(trapForCard(mk('constraint'))).toBeNull();
  });
  it('matchTrapInAnswer erkennt „the actual version“ und schweigt bei richtigem Englisch', () => {
    expect(matchTrapInAnswer('Please send me the actual version of the contract.')?.trap.id).toBe('f01');
    expect(matchTrapInAnswer('Please send me the current version.')).toBeNull();
    expect(matchTrapInAnswer('')).toBeNull();
  });
});
