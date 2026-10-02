import { describe, expect, it } from 'vitest';
import { isTilePrefix, pickTile } from '../../src/domain/srs/exercise';

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

describe('Mehrwort-Bausteine (Satzbau, Emrah 02.10.2026)', () => {
  const t2 = ['your offer', 'could', 'be', 'a bit of a stretch', 'for', 'our budget'].map((text, id) => ({ id, text, distractor: false }));
  it('pickTile findet ganze Mehrwort-Bausteine', () => {
    expect(pickTile(t2, [], 'a bit of a stretch', 'words')).toBe(3);
    expect(pickTile(t2, [], 'A bit of a stretch,', 'words')).toBe(3);
    expect(pickTile(t2, [], 'a bit', 'words')).toBeNull();
  });
  it('isTilePrefix: Anfang ganzer Wörter eines freien Mehrwort-Bausteins', () => {
    expect(isTilePrefix(t2, [], 'a')).toBe(true);
    expect(isTilePrefix(t2, [], 'a bit of')).toBe(true);
    expect(isTilePrefix(t2, [], 'a bit of a stretch')).toBe(false); // vollständig: kein Anfang mehr
    expect(isTilePrefix(t2, [], 'bit')).toBe(false);
    expect(isTilePrefix(t2, [3], 'a bit')).toBe(false); // schon gelegt
    expect(isTilePrefix(t2, [], 'our')).toBe(true);
    expect(isTilePrefix(t2, [], '')).toBe(false);
  });
});
