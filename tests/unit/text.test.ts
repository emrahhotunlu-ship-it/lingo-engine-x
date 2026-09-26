import { describe, expect, it } from 'vitest';
import { stripGapMarks, tokenize } from '../../src/domain/text/tokenize';
import { lemmaCandidates, usSpelling } from '../../src/domain/text/lemma';
import { findPhrase } from '../../src/domain/text/phrases';
import { isDictPhrase } from '../../src/domain/lexicon/dict';

const words = (s: string) => tokenize(s).filter((t) => t.kind === 'word').map((t) => t.text);

describe('tokenize', () => {
  it('hält Apostroph- und Bindestrich-Wörter zusammen', () => {
    expect(words("I don't think the company's e-invoicing works.")).toEqual([
      'I', "don't", 'think', 'the', "company's", 'e-invoicing', 'works',
    ]);
    expect(words('We don’t know.')).toEqual(['We', 'don’t', 'know']);
    expect(words('a well-known, long-term plan')).toEqual(['a', 'well-known', 'long-term', 'plan']);
  });

  it('macht Leerraum, Satzzeichen und Zahlen zu eigenen Tokens mit stimmigen Offsets', () => {
    const text = 'Hi, B2 learners — it’s 2026! “Quote” (yes)…';
    const tokens = tokenize(text);
    expect(tokens.map((t) => t.text).join('')).toBe(text);
    for (const t of tokens) expect(text.slice(t.start, t.end)).toBe(t.text);
    expect(tokens.find((t) => t.text === 'B2')?.kind).toBe('num');
    expect(tokens.find((t) => t.text === '2026')?.kind).toBe('num');
    expect(tokens.find((t) => t.text === ', ')).toBeUndefined();
    expect(tokens.filter((t) => t.kind === 'punct').map((t) => t.text)).toEqual([',', '—', '!', '“', '”', '(', ')…']);
    expect(words(text)).toEqual(['Hi', 'learners', 'it’s', 'Quote', 'yes']);
  });

  it('trennt Apostrophe am Wortrand ab', () => {
    expect(words("the managers' office, 'quoted'")).toEqual(['the', 'managers', 'office', 'quoted']);
  });

  it('liefert für leeren Text keine Tokens', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('stripGapMarks', () => {
  it('entfernt Klammern und liefert die Spanne im bereinigten Text', () => {
    const r = stripGapMarks('Our old car is still very [reliable].');
    expect(r.text).toBe('Our old car is still very reliable.');
    expect(r.spans).toEqual([{ start: 26, end: 34, text: 'reliable' }]);
    expect(r.text.slice(26, 34)).toBe('reliable');
  });

  it('kann mehrere Lücken und gebeugte Wendungen', () => {
    const r = stripGapMarks('We [relied on] them and [took a different approach].');
    expect(r.text).toBe('We relied on them and took a different approach.');
    expect(r.spans.map((s) => r.text.slice(s.start, s.end))).toEqual(['relied on', 'took a different approach']);
  });

  it('lässt Text ohne Klammern unverändert, leere Paare fallen weg, einzelne Klammern bleiben', () => {
    expect(stripGapMarks('No gap here.')).toEqual({ text: 'No gap here.', spans: [] });
    expect(stripGapMarks('Empty [] pair')).toEqual({ text: 'Empty  pair', spans: [] });
    expect(stripGapMarks('Stray [bracket')).toEqual({ text: 'Stray [bracket', spans: [] });
  });
});

describe('lemmaCandidates', () => {
  const second = (w: string) => lemmaCandidates(w)[1];

  it('baut regelmäßige Endungen zurück (Form selbst zuerst)', () => {
    expect(lemmaCandidates('relied')[0]).toBe('relied');
    expect(second('relied')).toBe('rely');
    expect(second('companies')).toBe('company');
    expect(lemmaCandidates('hoping')).toContain('hope');
    expect(lemmaCandidates('hoping').indexOf('hope')).toBeLessThan(lemmaCandidates('hoping').indexOf('hop'));
    expect(lemmaCandidates('planning')).toContain('plan');
    expect(lemmaCandidates('stopped')).toContain('stop');
    expect(second('used')).toBe('use');
    expect(second('uses')).toBe('use');
    expect(lemmaCandidates('boxes')).toContain('box');
    expect(second('easier')).toBe('easy');
    expect(second('easily')).toBe('easy');
    expect(lemmaCandidates('larger')).toContain('large');
    expect(lemmaCandidates('biggest')).toContain('big');
    expect(lemmaCandidates('simply')).toContain('simple');
    expect(lemmaCandidates('basically')).toContain('basic');
    expect(lemmaCandidates('quickly')).toContain('quick');
    expect(lemmaCandidates('lying')).toContain('lie');
    expect(lemmaCandidates('organised')).toContain('organise');
  });

  it('kennt unregelmäßige Formen aus irregular.json', () => {
    expect(second('went')).toBe('go');
    expect(second('better')).toBe('good');
    expect(lemmaCandidates('better')).toContain('well');
    expect(second('took')).toBe('take');
    expect(second('children')).toBe('child');
    expect(second('people')).toBe('person');
    expect(lemmaCandidates('was')).toContain('be');
    expect(lemmaCandidates('learnt')).toContain('learn');
  });

  it('behandelt Genitiv und Kurzformen', () => {
    expect(second("company's")).toBe('company');
    expect(second('company’s')).toBe('company');
    expect(second("don't")).toBe('do');
    expect(lemmaCandidates("isn't")).toContain('be');
    expect(second("can't")).toBe('can');
    expect(second("won't")).toBe('will');
    expect(lemmaCandidates("I'm")).toEqual(["i'm", 'i', 'be']);
    expect(second("companies'")).toBe('company');
  });

  it('beugt bei Bindestrich-Wörtern nur den letzten Teil', () => {
    expect(lemmaCandidates('e-invoicing')).toContain('e-invoice');
    expect(lemmaCandidates('E-Invoicing')[0]).toBe('e-invoicing');
  });

  it('liefert keine Dubletten und nichts für leere Eingaben', () => {
    for (const w of ['relied', 'went', 'better', 'planning', "don't"]) {
      const c = lemmaCandidates(w);
      expect(new Set(c).size).toBe(c.length);
    }
    expect(lemmaCandidates('')).toEqual([]);
    expect(lemmaCandidates('carry out')).toEqual(['carry out']);
  });
});

describe('usSpelling (Suchschlüssel britisch → amerikanisch)', () => {
  it('schreibt britische Formen amerikanisch', () => {
    const pairs: Array<[string, string]> = [
      ['colour', 'color'], ['colours', 'colors'], ['favourite', 'favorite'], ['behaviour', 'behavior'],
      ['organise', 'organize'], ['organised', 'organized'], ['organisation', 'organization'], ['realising', 'realizing'],
      ['analyse', 'analyze'], ['analysed', 'analyzed'], ['travelled', 'traveled'], ['cancelling', 'canceling'],
      ['marvellous', 'marvelous'], ['centre', 'center'], ['centred', 'centered'], ['theatres', 'theaters'],
      ['kilometre', 'kilometer'], ['licence', 'license'], ['defence', 'defense'], ['programme', 'program'],
      ['catalogue', 'catalog'], ['dialogue', 'dialog'], ['jewellery', 'jewelry'], ['practise', 'practice'],
      ['grey', 'gray'], ['unfavourable', 'unfavorable'],
    ];
    for (const [uk, us] of pairs) expect(usSpelling(uk), uk).toBe(us);
  });

  it('lässt amerikanische Formen und Ausnahmen unverändert', () => {
    for (const w of [
      'color', 'organize', 'center', 'hour', 'four', 'tour', 'your', 'flour', 'advertise', 'exercise', 'surprise',
      'otherwise', 'rise', 'raise', 'noise', 'promise', 'premises', 'expertise', 'genre', 'acre', 'miser', 'crises',
      'cancellation', 'controlled', 'glamour',
    ]) {
      expect(usSpelling(w), w).toBe(w);
    }
  });

  it('wirkt auf jeden Teil einer Wendung', () => {
    expect(usSpelling('Colour Scheme')).toBe('color scheme');
    expect(usSpelling('well-organised')).toBe('well-organized');
  });
});

describe('findPhrase', () => {
  const at = (text: string, word: string) => {
    const tokens = tokenize(text);
    return { tokens, i: tokens.findIndex((t) => t.text === word) };
  };

  it('erkennt „carried out the audit" als „carry out"', () => {
    const { tokens, i } = at('We carried out the audit last week.', 'carried');
    const m = findPhrase(tokens, i, isDictPhrase);
    expect(m).toMatchObject({ phrase: 'carry out', surface: 'carried out' });
    expect('We carried out the audit last week.'.slice(m?.start, m?.end)).toBe('carried out');
    expect(findPhrase(tokens, tokens.findIndex((t) => t.text === 'out'), isDictPhrase)?.phrase).toBe('carry out');
    expect(findPhrase(tokens, tokens.findIndex((t) => t.text === 'audit'), isDictPhrase)).toBeNull();
  });

  it('bevorzugt die längere Wendung und beugt das erste Wort zurück', () => {
    const { tokens, i } = at('She is looking forward to the trip.', 'forward');
    expect(findPhrase(tokens, i, isDictPhrase)?.phrase).toBe('look forward to');
    const b = at('They kept up with the news.', 'up');
    expect(findPhrase(b.tokens, b.i, isDictPhrase)?.phrase).toBe('keep up with');
    const c = at('He came up with a plan.', 'came');
    expect(findPhrase(c.tokens, c.i, isDictPhrase)?.phrase).toBe('come up with');
  });

  it('beugt auch das letzte Wort zurück (Plural)', () => {
    const { tokens, i } = at('Both living rooms are small.', 'rooms');
    expect(findPhrase(tokens, i, isDictPhrase)?.phrase).toBe('living room');
  });

  it('geht nicht über Satzzeichen hinweg und ignoriert Nicht-Wörter', () => {
    const { tokens, i } = at('We carried, out of time.', 'carried');
    expect(findPhrase(tokens, i, isDictPhrase)).toBeNull();
    expect(findPhrase(tokens, 1, isDictPhrase)).toBeNull(); // Leerraum-Token
    expect(findPhrase(tokens, 999, isDictPhrase)).toBeNull();
  });

  it('nutzt die übergebene Prüfung (z. B. eigene Karten und Chunks)', () => {
    const { tokens, i } = at('I took your point about the budget.', 'point');
    const own = new Set(['take your point']);
    expect(findPhrase(tokens, i, (p) => own.has(p))).toMatchObject({ phrase: 'take your point', surface: 'took your point' });
  });
});
