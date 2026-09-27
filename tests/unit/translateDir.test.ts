import { describe, expect, it } from 'vitest';
import { fromOf } from '../../src/features/companion/translate/store';

// Übersetzungsrichtung: kurze englische Wendungen ohne Funktionswörter (Emrahs Befund „Keep up“)
// dürfen nicht als Deutsch gelten.
describe('Übersetzer: Ausgangssprache', () => {
  const dir = (text: string) => fromOf({ text, dirOverride: null });

  it('kurze englische Wendungen → Englisch', () => {
    expect(dir('Keep up')).toBe('en');
    expect(dir('get out')).toBe('en');
    expect(dir('run')).toBe('en');
  });

  it('kurze deutsche Texte → Deutsch', () => {
    expect(dir('Guten Morgen')).toBe('de');
    expect(dir('schnell')).toBe('de');
    expect(dir('Grüße')).toBe('de');
  });

  it('klare Sätze und die eigene Wahl bleiben maßgeblich', () => {
    expect(dir('This is the budget for the project.')).toBe('en');
    expect(dir('Das ist nicht das Budget.')).toBe('de');
    expect(fromOf({ text: 'Keep up', dirOverride: 'de' })).toBe('de');
  });
});
