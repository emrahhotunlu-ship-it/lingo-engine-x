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

  // B1 (Prüfung mit echten Modellantworten): deutsche Hinweise nennen englische Wendungen oft
  // ohne typografische Anführungszeichen – sie sind Deutsch und dürfen nicht abgelehnt werden.
  it.each([
    'Typisch: follow up on something, follow up with someone.',
    'Statt make a decision nie do a decision sagen.',
    'Mit on: to follow up on an email.',
    'Neutral; locker wäre: Can you get back to me by Friday?',
    'Kollokation: to meet a deadline, to miss a deadline.',
    'In den USA sagt man eher on the weekend statt at the weekend.',
    "Nicht 'give me bescheid' – im Englischen sagt man 'let me know' oder 'keep me posted'.",
    "Bottleneck = 'bottle neck': the neck of a bottle is narrow, so everything gets stuck there – ein Engpass.",
    'formeller; get back to me is common in emails',
    'Klingt fair: the customer hears a yes to something.',
  ])('deutscher Hinweis mit englischer Wendung bleibt erlaubt: %s', (text) => {
    expect(isWrongLang(text, 'de')).toBe(false);
  });

  it.each([
    'Vorstand ist hier the executive board, nicht die Aufsichtsrat-Ebene.',
    'Ähnlich wie Frist, but used for the final date.',
  ])('englischer Hinweis mit deutschen Wörtern bleibt erlaubt: %s', (text) => {
    expect(isWrongLang(text, 'en')).toBe(false);
  });

  it('ganze Texte in falscher Sprache werden weiter abgelehnt (Kap. 10)', () => {
    expect(isWrongLang("'Reliable' means here that you can count on the system to work.", 'de')).toBe(true);
    expect(isWrongLang('Sounds more confident: "push back" is what US speakers say.', 'de')).toBe(true);
    expect(isWrongLang('Inflation is uncountable, also: inflation is high, not the inflation are.', 'de')).toBe(true);
    expect(isWrongLang('Hier bedeutet das Wort, dass man sich auf das System verlassen kann.', 'en')).toBe(true);
  });

  it("einfache gerade Anführungszeichen gelten als Zitat, Apostrophe nicht", () => {
    expect(stripQuoted("Sag 'let me know' oder 'keep me posted'.")).not.toMatch(/let|keep/);
    expect(stripQuoted("Don't say it; let's go.")).toContain("Don't");
    expect(stripQuoted("Don't say it; let's go.")).toContain("let's");
    expect(stripQuoted("Nicht 'don't do it' sagen.")).not.toMatch(/do it/);
  });
});
