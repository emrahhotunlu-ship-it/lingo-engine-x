import { describe, expect, it } from 'vitest';
import { splitPath } from '../../src/features/learn/TopicPath';

const ch = { de: 'Zeiten', en: 'Tenses' };
const row = (id: string, state: 'new' | 'learning' | 'safe' | 'firm') => ({ id, state, patSafe: 0, patTotal: 0, due: 0, chapter: ch });

describe('Großpaket G5: Themen-Weg (Als Nächstes / Sitzt schon)', () => {
  const rows = [row('a', 'firm'), row('b', 'learning'), row('c', 'safe'), row('d', 'new'), row('e', 'learning'), row('f', 'new'), row('g', 'new')];

  it('sitzt = sicher oder fest; als Nächstes = höchstens 3 offene Themen nach dem aktuellen, ohne das aktuelle', () => {
    const r = splitPath(rows, 'b');
    expect(r.safe.map((x) => x.id)).toEqual(['a', 'c']);
    expect(r.next.map((x) => x.id)).toEqual(['d', 'e', 'f']);
    expect(r.current).toBe('b');
  });

  it('ohne aktuelles Thema gilt das erste offene', () => {
    const r = splitPath(rows, null);
    expect(r.current).toBe('b');
    expect(r.next.map((x) => x.id)).toEqual(['d', 'e', 'f']);
  });

  it('unbekanntes aktuelles Thema: wie ohne; am Ende des Wegs ist „Als Nächstes“ leer', () => {
    expect(splitPath(rows, 'zz').current).toBe('b');
    expect(splitPath(rows, 'g').next).toEqual([]);
  });
});
