import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dictLookup, dictWordsByPos, isDictPhrase, isDictWord, lexDeps } from '../../src/domain/lexicon/dict';
import { lemmaCandidates } from '../../src/domain/text/lemma';

type RawDict = Record<string, Array<[string, string, string]>>;
const DICT = JSON.parse(readFileSync(new URL('../../src/content/legacy/dict.json', import.meta.url), 'utf8')) as RawDict;
const sense = (key: string, i = 0) => {
  const s = DICT[key]?.[i];
  return s ? { pos: s[0], de: s[1], def: s[2] } : undefined;
};

describe('dictLookup (indiziert über die US-Schreibweise)', () => {
  it('findet britische Einträge über die amerikanische Form und umgekehrt', () => {
    expect(dictLookup('color')).toMatchObject({ word: 'color', headword: 'colour' });
    expect(dictLookup('colour')).toMatchObject({ word: 'color', headword: 'colour' });
    expect(dictLookup('Colour')?.senses[0]?.pos).toBe('noun');
    expect(dictLookup('organize')?.headword).toBe('organise');
    expect(dictLookup('center')?.headword).toBe('centre');
    expect(dictLookup('analyze')?.headword).toBe('analyse');
    expect(dictLookup('license')?.headword).toBe('licence');
    // dict.json hat beide Schreibweisen: der genaue Treffer steht vorn, beide teilen den US-Schlüssel
    expect(dictLookup('programme')).toMatchObject({ word: 'program', headword: 'programme' });
    expect(dictLookup('program')).toMatchObject({ word: 'program', headword: 'program' });
  });

  it('führt britische Verbform und US-Nomen zusammen, der genaue Treffer steht vorn', () => {
    const practice = dictLookup('practice');
    const practise = dictLookup('practise');
    expect(practice?.headword).toBe('practice');
    expect(practise?.headword).toBe('practise');
    expect(practice?.word).toBe('practice');
    expect(practice?.senses.length).toBe(practise?.senses.length);
    expect(practice?.senses[0]).toEqual(sense('practice'));
    expect(practise?.senses[0]).toEqual(sense('practise'));
  });

  it('stellt mit posHint die passende Wortart nach vorn', () => {
    const about = dictLookup('about');
    expect(about?.senses.map((s) => s.pos)).toEqual(['adv', 'prep']);
    expect(dictLookup('about', 'prep')?.senses.map((s) => s.pos)).toEqual(['prep', 'adv']);
  });

  it('kennt Wendungen, auch mit führendem „to"', () => {
    expect(dictLookup('carry out')?.senses[0]?.pos).toBe('phrasal');
    expect(dictLookup('to carry out')?.headword).toBe('carry out');
    expect(dictLookup('  Look   Forward to ')?.headword).toBe('look forward to');
  });

  it('liefert null für Unbekanntes und macht keine Grundform-Suche', () => {
    expect(dictLookup('xyzzy')).toBeNull();
    expect(dictLookup('')).toBeNull();
    expect(dictLookup('went')).toBeNull();
    expect(dictLookup('constructor')).toBeNull();
    expect(lemmaCandidates('went').map((c) => dictLookup(c)?.headword).find(Boolean)).toBe('go');
  });
});

describe('isDictWord, isDictPhrase, dictWordsByPos', () => {
  it('unterscheidet Einzelwörter und Wendungen', () => {
    expect(isDictWord('reliable')).toBe(true);
    expect(isDictWord('color')).toBe(true);
    expect(isDictWord('well-known')).toBe(true);
    expect(isDictWord('carry out')).toBe(false);
    expect(isDictWord('on')).toBe(false);
    expect(isDictPhrase('carry out')).toBe(true);
    expect(isDictPhrase('to carry out')).toBe(true);
    expect(isDictPhrase('reliable')).toBe(false);
    expect(isDictPhrase('carried out')).toBe(false);
  });

  it('listet Wörter einer Wortart in US-Schreibweise', () => {
    const nouns = dictWordsByPos('noun');
    expect(nouns).toContain('color');
    expect(nouns).not.toContain('colour');
    expect(dictWordsByPos('adj')).toContain('reliable');
    expect(dictWordsByPos('phrasal')).toContain('carry out');
    expect(dictWordsByPos('unknown-pos')).toEqual([]);
    expect(dictWordsByPos('noun')).toBe(nouns); // zwischengespeichert
    expect(new Set(nouns).size).toBe(nouns.length);
  });
});

describe('lexDeps', () => {
  const lex = lexDeps();

  it('isKnownWord: echte Wörter, auch Funktionswörter und unregelmäßige Formen', () => {
    for (const w of ['effect', 'affect', 'color', 'colour', 'on', 'the', 'a', 'I', 'went', 'occurred', 'companies', 'learnt']) {
      expect(lex.isKnownWord(w), w).toBe(true);
    }
  });

  it('isKnownWord: Tippfehler sind keine echten Wörter', () => {
    for (const w of ['relaible', 'occured', 'recieve', 'xyzzy', '', 'q']) {
      expect(lex.isKnownWord(w), w).toBe(false);
    }
  });

  it('dictMeaning: erste Bedeutung, sonst die der Grundform', () => {
    expect(lex.dictMeaning('reliable')).toEqual(sense('reliable'));
    expect(lex.dictMeaning('reliable')?.pos).toBe('adj');
    expect(lex.dictMeaning('went')?.pos).toBe('verb');
    expect(lex.dictMeaning('went')).toEqual(lex.dictMeaning('go'));
    expect(lex.dictMeaning('organized')).toEqual(lex.dictMeaning('organise'));
    expect(lex.dictMeaning('xyzzy')).toBeNull();
  });

  it('wordsByPos entspricht dictWordsByPos', () => {
    expect(lex.wordsByPos('verb')).toBe(dictWordsByPos('verb'));
  });
});
