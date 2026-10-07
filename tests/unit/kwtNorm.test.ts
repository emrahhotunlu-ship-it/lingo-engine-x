// KWT-Normalisierung (Lernplattform 3.0 P12): 'd, 's, can't, Wortzählung nach Cambridge.
import { describe, expect, it } from 'vitest';
import { kwtCount, kwtText, kwtWords } from '../../src/domain/c1x/kwtNorm';

describe('kwtNorm', () => {
  it("'d + 3. Form = had, 'd + Grundform = would, 'd better = had better", () => {
    expect(kwtText("wish I'd checked")).toBe('wish i had checked');
    expect(kwtText("I'd taken it")).toBe('i had taken it');
    expect(kwtText("I'd check it")).toBe('i would check it');
    expect(kwtText("you'd better go")).toBe('you had better go');
    expect(kwtText("I'd need it")).toBe('i would need it');
    expect(kwtText("wish I 'd checked")).toBe('wish i had checked');
  });

  it("'s + been/got = has; nach Pronomen = is; nach Nomen = Besitz (1 Wort)", () => {
    expect(kwtText("he's been late")).toBe('he has been late');
    expect(kwtText("she's got a plan")).toBe('she has got a plan');
    expect(kwtText("it's late")).toBe('it is late');
    expect(kwtText("let's go")).toBe('let us go');
    expect(kwtWords("the supplier's failure")).toEqual(['the', "supplier's", 'failure']);
    expect(kwtText("the supplier's been late")).toBe('the supplier has been late');
  });

  it("Kurzformen zählen wie ausgeschrieben, can't = ein Wort", () => {
    expect(kwtCount("I'd checked")).toBe(3);
    expect(kwtCount("didn't")).toBe(2);
    expect(kwtCount("they won't")).toBe(3);
    expect(kwtCount("we'll")).toBe(2);
    expect(kwtCount("you've")).toBe(2);
    expect(kwtCount("can't")).toBe(1);
    expect(kwtText("can't")).toBe(kwtText('cannot'));
  });

  it('Groß-/Kleinschreibung, Satzzeichen und typografische Apostrophe', () => {
    expect(kwtText('Is Said, to be.')).toBe('is said to be');
    expect(kwtText('wish I’d checked')).toBe('wish i had checked');
    expect(kwtText('  due   to… ')).toBe('due to');
    expect(kwtWords('')).toEqual([]);
  });
});
