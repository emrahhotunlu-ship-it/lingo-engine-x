import { describe, expect, it } from 'vitest';
import { cardFromResult, partialTranslation } from '../../src/features/companion/translate/store';
import { newVocabDoc } from '../../src/domain/srs/newCard';
import { translateSchema, TRANSLATE_EXAMPLE } from '../../src/prompts/translate';
import { clipMnemo, mnemonic, MNEMO_TEXT_MAX } from '../../src/prompts/mnemonic';
import { parseJsonText } from '../../src/ai/gate';

// Emrahs Wunsch 27.09.: Wort aus dem Übersetzer direkt in den Vokabeltrainer (wie in der alten App);
// Teilübersetzung beim Streamen; Merkhilfe robuster.
describe('Übersetzer → Vokabeltrainer', () => {
  it('EN → DE „Keep up“: englisches Wort klein, deutsche Bedeutung, Beispielsatz mit Klammer', () => {
    const c = cardFromResult({ from: 'en', text: 'Keep up', translation: 'mithalten', example: 'It is hard to keep up with all the new emails.' });
    expect(c).toEqual({ word: 'keep up', de: 'mithalten', ex: 'It is hard to keep up with all the new emails.' });
    const made = newVocabDoc({ ...c!, surface: null, src: 'translate', origin: { v: 1, kind: 'translate', t: 1 }, today: '2026-09-27' });
    expect(made?.doc.ex).toBe('It is hard to [keep up] with all the new emails.');
  });

  it('DE → EN „durchhalten“: englische Seite ist die Übersetzung', () => {
    const c = cardFromResult({ from: 'de', text: 'durchhalten', translation: 'to hang in there', example: 'Just hang in there, it gets easier.' });
    expect(c).toMatchObject({ word: 'to hang in there', de: 'durchhalten' });
    expect(newVocabDoc({ ...c!, surface: null, src: 'translate', origin: { v: 1, kind: 'translate', t: 1 }, today: '2026-09-27' })).not.toBeNull();
  });

  it('kein Knopf bei ganzen Sätzen oder ohne Beispielsatz', () => {
    expect(cardFromResult({ from: 'de', text: 'Wir müssen das Budget heute freigeben', translation: 'We need to approve the budget today.', example: 'x' })).toBeNull();
    expect(cardFromResult({ from: 'en', text: 'Keep up', translation: 'mithalten' })).toBeNull();
  });

  it('Eigennamen bleiben großgeschrieben', () => {
    expect(cardFromResult({ from: 'en', text: 'Thanksgiving', translation: 'Erntedankfest', example: 'We fly home for Thanksgiving.' })?.word).toBe('Thanksgiving');
  });

  it('Schema: Beispielsatz optional, deutscher Beispielsatz wird verworfen statt die Übersetzung', () => {
    const base = JSON.parse(TRANSLATE_EXAMPLE) as Record<string, unknown>;
    const vars = { from: 'de' as const, uiLang: 'de' as const };
    expect(translateSchema(vars).safeParse(base).success).toBe(true);
    const r = translateSchema(vars).safeParse({ ...base, example: 'Das ist ein deutscher Satz und nicht englisch, oder doch nicht?' });
    expect(r.success && r.data.example).toBe(undefined);
  });
});

describe('Teilübersetzung beim Streamen', () => {
  it('liest den Wert von translation aus unfertigem JSON', () => {
    expect(partialTranslation('{"source":"de","transl')).toBe('');
    expect(partialTranslation('{"source":"de","translation":"We need to appr')).toBe('We need to appr');
    expect(partialTranslation('{"translation":"Line 1\\nLine \\"2\\"","register"')).toBe('Line 1\nLine "2"');
  });
});

describe('Merkhilfe robuster', () => {
  const vars = { word: 'eventually', meaning: 'schließlich', uiLang: 'de' as const, sentence: 'We eventually found the hotel.' };
  it('Emrahs echte Antwort wird angenommen', () => {
    const raw = '```json\n{"text":"eventually klingt wie „eventuell" – aber eventually bedeutet nicht „möglicherweise", sondern „am Ende" oder „schließlich". Denk an: „Eventually we arrived" = „Endlich/Schließlich sind wir angekommen"."}\n```';
    expect(mnemonic.schema(vars).safeParse(parseJsonText(raw)).success).toBe(true);
  });
  it('zu lang → am Satzende gekürzt statt verworfen', () => {
    const long = `Eventually klingt wie eventuell, bedeutet aber schließlich. ${'Stell dir einen langen Weg vor, an dessen Ende du ankommst. '.repeat(8)}`;
    const out = clipMnemo(long) as string;
    expect(out.length).toBeLessThanOrEqual(MNEMO_TEXT_MAX);
    expect(out.endsWith('.')).toBe(true);
    expect(mnemonic.schema(vars).safeParse({ text: long }).success).toBe(true);
  });
  it('gebeugte Form zählt als Nennung', () => {
    expect(mnemonic.schema({ ...vars, word: 'to postpone' }).safeParse({ text: 'Postponed klingt wie „Post, pausiert“ – die Post kommt später: verschieben.' }).success).toBe(true);
  });
});
