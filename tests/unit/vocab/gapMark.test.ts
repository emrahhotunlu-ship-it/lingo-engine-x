import { describe, expect, it } from 'vitest';
import { gapFromMark, headShown, headWords, locateGap, sentencesOf, usableSentences } from '../../../src/modules/vocab/domain/card';

// Inhalts-Audit 04.11.2026: Wendungen mit Platzhalter („meet sb halfway“) fanden ihre Lücke im markierten Satz nicht („[meet you halfway]“)
// und kamen ohne Satz; „to“ wurde auch bei festen Wendungen („to a certain extent“) abgeschnitten.
describe('Lücke aus der markierten Stelle', () => {
  it('meet sb halfway ↔ „We can [meet you halfway] on the price.“: Lücke = die markierte Stelle', () => {
    const [s] = sentencesOf({ ex: 'We can [meet you halfway] on the price.' }, 0, null);
    expect(s?.mark).toBeTruthy();
    expect(locateGap(s!.en, 'meet sb halfway')).toBeNull();
    const { ok } = usableSentences([s!], 'meet sb halfway', false);
    expect(ok).toHaveLength(1);
    expect(ok[0]!.gap.answer).toBe('meet you halfway');
  });
  it('Sicherung: passt kein Wort des Stichworts in die Markierung, gibt es keine Lücke', () => {
    expect(gapFromMark('We need a [quick decision] today.', [10, 24], 'meet sb halfway')).toBeNull();
  });
  it('„to“ bleibt bei festen Wendungen, fällt bei Verben weg', () => {
    expect(headWords('to a certain extent')).toEqual(['to', 'a', 'certain', 'extent']);
    expect(headWords('to the best of my knowledge')[0]).toBe('to');
    expect(headWords('to adjust')).toEqual(['adjust']);
    expect(headShown('to adjust')).toBe('adjust');
    expect(headShown('to a certain extent')).toBe('to a certain extent');
  });
});

describe('Wendungen aus Rollenspiel und Mail', () => {
  it('ohne ex: src.upgraded ist der Ankersatz, die Lücke wird gefunden', () => {
    const sents = sentencesOf({ en: 'behind schedule', src: { kind: 'mail', upgraded: 'The scanners are running two weeks behind schedule.' } }, 0, null);
    expect(sents[0]).toMatchObject({ key: 'a', en: 'The scanners are running two weeks behind schedule.' });
    expect(usableSentences(sents, 'behind schedule', false).ok).toHaveLength(1);
  });
});
