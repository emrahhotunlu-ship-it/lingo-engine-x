import { describe, expect, it } from 'vitest';
import { lexicalUnitWith, singular, unitKey, type UnitDeps } from '../../src/domain/lexicon/unit';
import { lexicalUnit } from '../../src/domain/lexicon/unitKnown';

// Prüffunktion „feste Einheit?“ (card-quality.md). Emrahs Meldung: „adaptive attempts“ aus einem Tagesartikel ist keine Wendung.

describe('lexicalUnit mit den eingebauten Daten', () => {
  it('„adaptive attempts“ = prüfen, mit der üblichen Fassung als Vorschlag', () => {
    const v = lexicalUnit('adaptive attempts');
    expect(v.verdict).toBe('check');
    expect(v.reason).toBe('free_combo');
    expect(v.better).toBe('adaptive attacks');
  });

  it('„adaptive attacks“ und „come to terms with“ = ok', () => {
    expect(lexicalUnit('adaptive attacks').verdict).toBe('ok');
    expect(lexicalUnit('come to terms with').verdict).toBe('ok');
    expect(lexicalUnit('to come to terms with').verdict).toBe('ok');
  });

  it('belegte Kollokationen, Phrasal Verbs und Rahmen bleiben ok', () => {
    for (const p of ['weak link', 'first draft', 'billable hours', 'close a deal', 'carry out', 'look forward to', 'a viable option', 'on the other hand', 'until further notice', 'it seems to me that', 'concerted effort', 'take the guesswork out of', 'digitalization', 'to keep up with']) {
      expect(lexicalUnit(p).verdict, p).toBe('ok');
    }
  });

  it('freie Gruppen und Satzausschnitte = prüfen', () => {
    for (const p of ['new ways', 'cheap hardware', 'recent attempts', 'various approaches', 'adapt to unfamiliar hardware', 'across 15 adaptive attempts']) {
      expect(lexicalUnit(p).verdict, p).toBe('check');
    }
  });

  it('Grundform eines gebeugten Verbs am Anfang', () => {
    expect(lexicalUnit('adds up')).toMatchObject({ verdict: 'ok', base: 'add up' });
    expect(lexicalUnit('addresses the tension').base).toBe('address the tension');
  });

  it('ist rein: gleiche Eingabe, gleiches Urteil', () => {
    expect(lexicalUnit('adaptive attempts')).toEqual(lexicalUnit('Adaptive attempts'));
  });
});

describe('lexicalUnitWith (eingereichtes Wissen)', () => {
  const deps = (known: string[]): UnitDeps => ({
    known: (k) => known.includes(k),
    startingWith: (f) => known.filter((k) => k.startsWith(`${f} `)),
    pos: (w) => (w === 'attempt' || w === 'attempts' ? ['noun', 'verb'] : []),
    dictPhrase: () => false,
  });

  it('ohne Beleg ist die Verbindung frei, mit Beleg ok', () => {
    expect(lexicalUnitWith('failed attempt', deps([])).verdict).toBe('check');
    expect(lexicalUnitWith('failed attempt', deps(['failed attempt'])).verdict).toBe('ok');
  });

  it('`better` nur bei ähnlichem zweiten Wort', () => {
    expect(lexicalUnitWith('adaptive attempts', deps(['adaptive attack'])).better).toBe('adaptive attacks');
    expect(lexicalUnitWith('adaptive attempt', deps(['adaptive attack'])).better).toBe('adaptive attack');
    expect(lexicalUnitWith('adaptive attempts', deps(['adaptive model'])).better).toBeUndefined();
  });

  it('Schlüssel: ohne „to“, Artikel und Mehrzahl, Possessiva vereinheitlicht', () => {
    expect(unitKey('to close the deals')).toBe('close deal');
    expect(unitKey('spread on their own')).toBe("spread on one's own");
    expect(singular('companies')).toBe('company');
    expect(singular('business')).toBe('business');
  });
});
