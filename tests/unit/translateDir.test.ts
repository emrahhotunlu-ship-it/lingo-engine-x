import { describe, expect, it } from 'vitest';
import { fromOf, requestFrom } from '../../src/features/companion/translate/store';
import { TRANSLATE_EXAMPLE, translateSchema } from '../../src/prompts/translate';

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

  it('unsichere Texte gehen als „auto“ an Claude; Claude muss dann die Ausgangssprache nennen', () => {
    expect(requestFrom({ text: 'Keep up', dirOverride: null })).toBe('auto');
    expect(requestFrom({ text: 'Keep up', dirOverride: 'en' })).toBe('en');
    expect(requestFrom({ text: 'This is the budget.', dirOverride: null })).toBe('en');
    const base = JSON.parse(TRANSLATE_EXAMPLE) as Record<string, unknown>;
    const auto = translateSchema({ from: 'auto', uiLang: 'de' });
    expect(auto.safeParse(base).success).toBe(true);
    const noSource = { ...base };
    delete noSource.source;
    expect(auto.safeParse(noSource).success).toBe(false);
    // W1: Weicht Claudes Ausgangssprache von der gewählten ab, gilt Claudes Angabe (nicht ablehnen).
    const other = translateSchema({ from: 'en', uiLang: 'de' }).safeParse(base);
    expect(other.success).toBe(true);
    expect(other.data?.source).toBe('de');
    // Die Übersetzung muss dann in der anderen Sprache als `source` stehen.
    expect(translateSchema({ from: 'en', uiLang: 'de' }).safeParse({ ...base, translation: 'Wir müssen das Budget noch heute freigeben, sonst wird es knapp.' }).success).toBe(false);
  });
});
