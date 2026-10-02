import { describe, expect, it } from 'vitest';
import { pickTile } from '../../src/domain/srs/exercise';

// Bausteine per Tastatur (Emrah 02.10.2026): Wort tippen legt den passenden freien Baustein.

const tiles = ['We', 'need', 'to', 'postpone', 'the', 'meeting', 'meeting'].map((text, id) => ({ id, text, distractor: false }));

describe('pickTile', () => {
  it('Wörter: Groß-/Kleinschreibung und Satzzeichen am Rand sind egal', () => {
    expect(pickTile(tiles, [], 'we', 'words')).toBe(0);
    expect(pickTile(tiles, [], 'Postpone,', 'words')).toBe(3);
    expect(pickTile(tiles, [], '“need”', 'words')).toBe(1);
  });
  it('gleiche Bausteine werden der Reihe nach vergeben, danach ist keiner mehr frei', () => {
    expect(pickTile(tiles, [], 'meeting', 'words')).toBe(5);
    expect(pickTile(tiles, [5], 'meeting', 'words')).toBe(6);
    expect(pickTile(tiles, [5, 6], 'meeting', 'words')).toBeNull();
  });
  it('unbekannte und leere Eingaben geben null', () => {
    expect(pickTile(tiles, [], 'banana', 'words')).toBeNull();
    expect(pickTile(tiles, [], '  ', 'words')).toBeNull();
    expect(pickTile(tiles, [0], 'we', 'words')).toBeNull();
  });
  it('Buchstaben: ein Zeichen', () => {
    const l = ['c', 'a', 't'].map((text, id) => ({ id, text, distractor: false }));
    expect(pickTile(l, [], 'A', 'letters')).toBe(1);
    expect(pickTile(l, [1], 'a', 'letters')).toBeNull();
  });
});
