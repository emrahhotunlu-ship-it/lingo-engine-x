import { describe, expect, it } from 'vitest';
import { FALSE_FRIENDS } from '../../src/content/falseFriends';
import { sameClass } from '../../src/domain/tutor/diagnose';

// Gegenlesung Englischlehrer (Teil 4): Plausibilität bei Funktionswörtern und zwei falsche Freunde, die richtiges Englisch trafen.

const t = (answer: string, accepted: string[] = []) => ({ answer, accepted });

describe('sameClass: gleiche Wortklasse → unsicher statt falsch', () => {
  it('Präposition, Begleiter, Modalverb, Relativpronomen, Konjunktion', () => {
    expect(sameClass(t('by'), 'no later than')).toBe(true);
    expect(sameClass(t('for'), 'for almost')).toBe(true);
    expect(sameClass(t('a'), 'our')).toBe(true);
    expect(sameClass(t('should'), "'d better")).toBe(true);
    expect(sameClass(t("shouldn't"), "mustn't")).toBe(true);
    expect(sameClass(t('that'), 'which')).toBe(true);
    expect(sameClass(t('despite'), 'notwithstanding')).toBe(true);
    expect(sameClass(t('although'), 'even though')).toBe(true);
  });

  it('andere Klasse, Inhaltswörter, zu lang oder which ↔ who: nicht plausibel', () => {
    expect(sameClass(t('by'), 'should')).toBe(false);
    expect(sameClass(t('for'), 'banana')).toBe(false);
    expect(sameClass(t('will have sent'), 'will have been emailing')).toBe(false);
    expect(sameClass(t('who'), 'which')).toBe(false);
    expect(sameClass(t('which'), 'who')).toBe(false);
    expect(sameClass(t('by'), 'for the of in at')).toBe(false);
  });
});

describe('falsche Freunde: richtiges Englisch bleibt unberührt', () => {
  const bad = (w: string): RegExp => {
    const f = FALSE_FRIENDS.find((x) => x.word === w);
    if (!f?.bad) throw new Error(`fehlt: ${w}`);
    return f.bad;
  };
  it('absolve … of/from ist Vertragssprache; „absolved the course“ bleibt der Fehler', () => {
    expect(bad('absolve').test('This does not absolve the vendor of liability.')).toBe(false);
    expect(bad('absolve').test('It absolves us from all claims.')).toBe(false);
    expect(bad('absolve').test('I absolved the course last year.')).toBe(true);
  });
  it('consequent als Adjektiv vor dem Nomen ist richtig; „be consequent“ bleibt der Fehler', () => {
    expect(bad('consequent').test('We expect the consequent delays to be short.')).toBe(false);
    expect(bad('consequent').test('He is very consequent.')).toBe(true);
    expect(bad('consequent').test('We act consequently.')).toBe(true);
  });
});
