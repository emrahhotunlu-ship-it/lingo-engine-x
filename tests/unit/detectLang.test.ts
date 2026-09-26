import { describe, expect, it } from 'vitest';
import { detectLang, isWrongLang, stripQuoted, wordCount } from '../../src/domain/lang/detect';

describe('detectLang', () => {
  it.each([
    ['Hier bedeutet das Wort, dass man sich auf etwas verlassen kann.', 'de'],
    ['Nach „rely“ steht immer „on“, nicht „to“.', 'de'],
    ['Das Zielwort fehlt in deinem Satz.', 'de'],
    ['Zuverlässig und pünktlich geliefert.', 'de'],
    ['Here it means that you can trust someone to do what they promised.', 'en'],
    ['You used the target word correctly, and the sentence is grammatical.', 'en'],
    ['It is often followed by "on": „rely on someone“.', 'en'],
  ])('%s → %s', (text, lang) => {
    expect(detectLang(text)).toBe(lang);
  });

  it('ohne Anhaltspunkte oder gemischt: unknown', () => {
    expect(detectLang('')).toBe('unknown');
    expect(detectLang('123 456')).toBe('unknown');
    expect(detectLang('Onboarding Workshop Q3')).toBe('unknown');
    expect(detectLang('Nach rely steht on, nicht to.')).toBe('unknown');
  });

  it('Zitate zählen nicht mit', () => {
    expect(stripQuoted('Sag „the and of“ oder "with the" [to be]')).not.toMatch(/the|with|to be/);
    expect(wordCount('Das heißt „on the other hand“.')).toBe(2);
  });

  it('isWrongLang: erst ab 4 Wörtern, nur bei eindeutigem Ergebnis', () => {
    expect(isWrongLang('Das ist falsch.', 'en')).toBe(false);
    expect(isWrongLang('Das ist leider nicht ganz richtig.', 'en')).toBe(true);
    expect(isWrongLang('Das ist leider nicht ganz richtig.', 'de')).toBe(false);
    expect(isWrongLang('This is not quite right, sorry.', 'de')).toBe(true);
    expect(isWrongLang('Onboarding Workshop Q3 Kickoff Meeting', 'de')).toBe(false);
  });
});
