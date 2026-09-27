import { describe, expect, it } from 'vitest';
import { checkTyped } from '../../src/domain/answer/check';
import { retryHint, startOf } from '../../src/domain/answer/retryHint';
import { grammarRetryHint } from '../../src/domain/grammar/retryHint';
import { learnGrade } from '../../src/domain/learn/grade';
import { autoGrade } from '../../src/domain/srs/grade';
import { translate, translatePlural } from '../../src/i18n';

// „Erst ein Hinweis, dann die Lösung" (Lernberatung Vorschlag 4): Hinweis lokal, Note nach dem
// zweiten Versuch höchstens „Schwer".

const hintFor = (given: string, accepted: string[], lemma = accepted[0] ?? '') => retryHint(given, accepted, lemma, checkTyped(given, accepted, { lemma }));

describe('retryHint – Vokabeln', () => {
  it('gibt keinen Hinweis bei richtig oder „fast richtig" (Tippfehler im Budget, andere Form)', () => {
    expect(hintFor('negotiate', ['negotiate'])).toBeNull();
    expect(hintFor('negotiat', ['negotiate'])).toBeNull(); // Tippfehler im Budget → near
    expect(hintFor('persuade', ['persuaded'], 'persuade')).toBeNull(); // andere Form → near
  });

  it('nah dran (Abstand ≤ 2 außerhalb des Budgets) → „prüf die Schreibweise"', () => {
    // 8 Buchstaben: Budget 1, Abstand 2 → falsch, aber nah dran.
    expect(checkTyped('porsuad', ['persuade'], { lemma: 'persuade' }).verdict).toBe('wrong');
    expect(hintFor('porsuad', ['persuade'])).toEqual({ kind: 'spelling' });
    // Kurzes Wort ohne Budget: „bait" für „bail".
    expect(hintFor('bait', ['bail'])).toEqual({ kind: 'spelling' });
  });

  it('gleiche Wörter in anderer Form (Wendung) → „Richtiges Wort, andere Form"', () => {
    const accepted = ['took into account'];
    const r = checkTyped('take into account', accepted, { lemma: 'take into account' });
    // Die Wendung ist selbst die Grundform → gilt heute schon als „fast richtig": kein Hinweis.
    expect(retryHint('take into account', accepted, 'take into account', r)).toBeNull();
    // Mit anderer Grundform im Karteneintrag bleibt es falsch → Form-Hinweis.
    const r2 = checkTyped('taking into accounts', accepted, { lemma: 'bear in mind' });
    expect(r2.verdict).toBe('wrong');
    expect(retryHint('taking into accounts', accepted, 'bear in mind', r2)).toEqual({ kind: 'form' });
  });

  it('anderes Wort → Anfang (1–2 Buchstaben) und Länge', () => {
    expect(hintFor('agree', ['negotiate'])).toEqual({ kind: 'start', start: 'ne', letters: 9, words: 1 });
    expect(hintFor('', ['negotiate'])).toEqual({ kind: 'start', start: 'ne', letters: 9, words: 1 });
    expect(hintFor('car', ['bail'])).toEqual({ kind: 'start', start: 'b', letters: 4, words: 1 });
  });

  it('Wendungen zählen Wörter, „to" bleibt im Anfang', () => {
    expect(hintFor('make sense', ['touch base'])).toEqual({ kind: 'start', start: 'to', letters: 9, words: 2 });
    expect(hintFor('agree', ['to persuade'], 'persuade')).toEqual({ kind: 'start', start: 'to pe', letters: 8, words: 1 });
  });

  it('startOf: nur Buchstaben des ersten Worts', () => {
    expect(startOf('e-invoice')).toBe('ei');
    expect(startOf('go')).toBe('g');
    expect(startOf('to leverage')).toBe('le');
  });
});

describe('grammarRetryHint', () => {
  it('Hinweis der Aufgabe, wenn er noch nicht zu sehen ist', () => {
    expect(grammarRetryHint({ hint: 'since/for' }, 'Present Perfect', false)).toEqual({ kind: 'hint', text: 'since/for' });
  });
  it('sonst das Thema, sonst die Verbform', () => {
    expect(grammarRetryHint({ hint: '(work)' }, 'Present Perfect', true)).toEqual({ kind: 'topic', name: 'Present Perfect' });
    expect(grammarRetryHint({ hint: null }, 'Present Perfect', false)).toEqual({ kind: 'topic', name: 'Present Perfect' });
    expect(grammarRetryHint({ hint: '  ' }, null, false)).toEqual({ kind: 'verb' });
  });
});

describe('Note nach dem zweiten Versuch', () => {
  it('Vokabeln: richtig mit Hinweis → höchstens „Schwer" (wie „Tipp" Stufe 2), auch wenn schnell', () => {
    expect(autoGrade('cloze', { verdict: 'correct' }, { submitMs: 1500, firstKeyMs: 500, chars: 8, hintLevel: 0 })).toBe(4);
    expect(autoGrade('cloze', { verdict: 'correct' }, { submitMs: 1500, firstKeyMs: 500, chars: 8, hintLevel: 2 })).toBe(2);
    expect(autoGrade('type', { verdict: 'near' }, { submitMs: 20000, hintLevel: 2 })).toBe(2);
    expect(autoGrade('type', { verdict: 'wrong' }, { submitMs: 20000, hintLevel: 2 })).toBe(1);
  });
  it('Grammatik: Hilfe 2 deckelt auf „Schwer", falsch bleibt „Nochmal"', () => {
    expect(learnGrade('gap', 'correct', { submitMs: 2000, firstKeyMs: 500 }, { level: 2 })).toBe(2);
    expect(learnGrade('correct', 'correct', { submitMs: 30000 }, { level: 2 })).toBe(2);
    expect(learnGrade('gap', 'wrong', { submitMs: 2000 }, { level: 2 })).toBe(1);
  });
});

describe('Texte', () => {
  it('beide Sprachen, Mehrzahl und Platzhalter', () => {
    expect(translatePlural('de', 'rhStartWord', 8, { start: 'ne' })).toBe('Gesucht ist ein anderes Wort – es beginnt mit „ne…“ (8 Buchstaben)');
    expect(translatePlural('en', 'rhStartWord', 8, { start: 'ne' })).toBe('It’s a different word – it starts with “ne…” (8 letters)');
    expect(translate('de', 'rhGrammarTopic', { topic: 'Present Perfect' })).toBe('Achte auf: Present Perfect');
    expect(translate('en', 'rhSpelling')).toBe('Almost – check the spelling');
  });
});
