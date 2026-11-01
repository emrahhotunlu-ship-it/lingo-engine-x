import { describe, expect, it } from 'vitest';
import { attempted, nearCopy, usedIn } from '../../../src/modules/vocab/domain/used';

// Großpaket A Schritt 5 (english-teacher Befund 2, learning-scientist Befund 1): Vorkommen eines Zielworts in frei geschriebenem Text.

describe('usedIn', () => {
  it('Platzhalter lassen Platz, Beugung zählt', () => {
    expect(usedIn('Could you remind him of the meeting?', 'remind sb of sth', 'pv')).toBe(true);
    expect(usedIn('I finally made up my mind.', "make up one's mind", 'ch')).toBe(true);
  });

  it('Kollokation mit Einschüben, im Passiv und gebeugt', () => {
    expect(usedIn('We need to make a quick decision today.', 'make a decision', 'col')).toBe(true);
    expect(usedIn('The decision was made yesterday.', 'make a decision', 'col')).toBe(true);
    expect(usedIn('Last year we met all our deadlines.', 'meet a deadline', 'col')).toBe(true);
  });

  it('Phrasal Verb getrennt, britische Schreibung', () => {
    expect(usedIn('Can you sign it off by Friday?', 'sign off', 'pv')).toBe(true);
    expect(usedIn('We must prioritise the client.', 'prioritize', 'w')).toBe(true);
  });

  it('fehlt oder nur ein Teil: nicht benutzt; Einzelwort ohne Einschübe', () => {
    expect(usedIn('We need to delay the review.', 'postpone', 'w')).toBe(false);
    expect(usedIn('The decision is hard.', 'make a decision', 'col')).toBe(false);
    expect(usedIn('We hold a presentation.', 'give a presentation', 'col')).toBe(false);
  });
});

describe('attempted', () => {
  it('Versuch am Wort: Inhaltswort gebeugt oder mit Tippfehlern', () => {
    expect(attempted('hold a presentation', 'give a presentation')).toBe(true);
    expect(attempted('effect', 'affect')).toBe(true);
    expect(attempted('postponed', 'postpone')).toBe(true);
  });
  it('Ausweichwort ist kein Versuch', () => {
    expect(attempted('delay', 'postpone')).toBe(false);
    expect(attempted('', 'postpone')).toBe(false);
  });
});

describe('nearCopy', () => {
  it('Beispielsatz mit 1–2 geänderten Wörtern ist abgeschrieben, ein eigener Satz nicht', () => {
    const ex = 'We had to postpone the launch by a week.';
    expect(nearCopy('We had to postpone the release by a week.', ex)).toBe(true);
    expect(nearCopy('Sadly we had to postpone the release by a month.', ex)).toBe(true);
    expect(nearCopy('We had to postpone the release by two weeks.', ex)).toBe(false);
    expect(nearCopy('Can we postpone our call to Monday?', ex)).toBe(false);
    expect(nearCopy('Postpone it.', 'Postpone it now.')).toBe(false);
    expect(nearCopy('Hi Tom, we had a great call. Sadly we now have to postpone the launch, the release slipped by a full week.', ex)).toBe(false);
  });
});
