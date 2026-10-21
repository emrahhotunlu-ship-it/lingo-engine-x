import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/domain/text/tokenize';
import { inDrag, isPhrase, PHRASE_MAX_WORDS, rangeRequest, wordCount, type WordTapRequest } from '../../src/engine/wordTap';
import { blanked } from '../../src/features/lookup/PhraseLookup';

// Mehrwort-Markierung (21.10.2026): Wortgruppe aus festem ersten Wort und zuletzt angetipptem Wort, höchstens 6 Wörter/60 Zeichen,
// nie über die Lücke hinweg (sonst stünde die Lösung im Fenster).

const TEXT = 'Try to avoid driving in rush hour.';
const tokens = tokenize(TEXT);
const req = (word: string, over: Partial<WordTapRequest> = {}): WordTapRequest => {
  const index = tokens.findIndex((t) => t.text === word);
  const t = tokens[index];
  if (!t) throw new Error(word);
  return { surface: t.text, text: TEXT, start: t.start, end: t.end, tokens, index, area: 'trainer', source: 'vocab/avoid', title: null, anchor: null, ...over };
};

describe('rangeRequest', () => {
  it('vorwärts und rückwärts: Gruppe mit Text, Offsets und Token-Indizes', () => {
    const r = rangeRequest(req('rush'), req('hour'));
    expect(r).toMatchObject({ surface: 'rush hour', start: TEXT.indexOf('rush'), end: TEXT.indexOf('hour') + 4, index: req('rush').index, last: req('hour').index, source: 'vocab/avoid' });
    expect(r && isPhrase(r)).toBe(true);
    const back = rangeRequest(req('hour'), req('driving'));
    expect(back?.surface).toBe('driving in rush hour');
    expect(back?.capped).toBeUndefined();
  });

  it('dasselbe Wort: gewöhnliche Einzelanfrage; anderer Satz: null', () => {
    const one = rangeRequest(req('rush'), req('rush'));
    expect(one?.surface).toBe('rush');
    expect(one && isPhrase(one)).toBe(false);
    expect(rangeRequest(req('rush'), { ...req('hour'), text: 'Another sentence.' })).toBeNull();
  });

  it('nie über die Lücke: endet davor und meldet die Kürzung', () => {
    const gap = [[TEXT.indexOf('avoid'), TEXT.indexOf('avoid') + 5]] as const;
    const r = rangeRequest(req('Try', { gaps: gap }), req('driving', { gaps: gap }));
    expect(r?.surface).toBe('Try to');
    expect(r?.capped).toBe(true);
    expect(r?.surface).not.toContain('avoid');
  });

  it('höchstens 6 Wörter und 60 Zeichen, gezählt vom festen Anfang', () => {
    const long = 'We will need to finalize the quarterly report before the board meeting next week.';
    const tk = tokenize(long);
    const at = (w: string): WordTapRequest => {
      const index = tk.findIndex((t) => t.text === w);
      const t = tk[index];
      if (!t) throw new Error(w);
      return { surface: w, text: long, start: t.start, end: t.end, tokens: tk, index, area: 'read', source: null, anchor: null };
    };
    const r = rangeRequest(at('We'), at('week'));
    expect(r?.surface.split(' ')).toHaveLength(PHRASE_MAX_WORDS);
    expect(r?.surface).toBe('We will need to finalize the');
    expect(r?.capped).toBe(true);
    const back = rangeRequest(at('week'), at('We'));
    expect(back?.surface).toBe('before the board meeting next week');
  });

  it('Umschalt-Klick an einer Gruppe: fester Anfang ist das gegenüberliegende Ende', () => {
    const g = rangeRequest(req('rush'), req('hour'));
    if (!g) throw new Error('range');
    expect(rangeRequest(g, req('driving'))?.surface).toBe('driving in rush hour');
  });

  it('Helfer: Wörter zählen, Ziehen markiert den Bereich in beide Richtungen', () => {
    expect(wordCount(tokens)).toBe(7);
    expect(inDrag({ text: TEXT, from: 8, to: 4 }, TEXT, 6)).toBe(true);
    expect(inDrag({ text: TEXT, from: 8, to: 4 }, TEXT, 10)).toBe(false);
    expect(inDrag(null, TEXT, 6)).toBe(false);
  });
});

describe('blanked', () => {
  it('ersetzt nicht antippbare Stellen durch ___, auch in Teilstücken', () => {
    const gap = [[7, 12]] as const;
    expect(blanked(TEXT, 0, TEXT.length, gap)).toBe('Try to ___ driving in rush hour.');
    expect(blanked(TEXT, 0, 7, gap)).toBe('Try to ');
    expect(blanked(TEXT, 13, TEXT.length, gap)).toBe('driving in rush hour.');
    expect(blanked(TEXT, 0, TEXT.length, undefined)).toBe(TEXT);
  });
});
