import { describe, expect, it } from 'vitest';
import { saveTargets } from '../../src/domain/companion/saveTargets';

// N93: Übersetzen → „+ Wortschatz“ je Wendung und am ganzen Ergebnis, immer mit Ursprungssatz.

describe('saveTargets', () => {
  it('Satz: das ganze Ergebnis und jede Wendung, die im Satz oder einer Alternative steht', () => {
    const out = saveTargets({
      from: 'de',
      text: 'Wir müssen das Budget freigeben',
      translation: 'We need to approve the budget.',
      alternatives: [{ text: 'The budget needs to be signed off.' }, { text: 'We have to okay the budget.' }],
      terms: [
        { en: 'approve', de: 'freigeben' },
        { en: 'zzz never there', de: 'x' },
      ],
    });
    expect(out.map((o) => o.kind)).toEqual(['result', 'term']);
    expect(out[0]).toMatchObject({ word: 'We need to approve the budget.', de: 'Wir müssen das Budget freigeben' });
    expect(out[1]).toMatchObject({ word: 'approve', ex: 'We need to approve the budget.' });
  });

  it('kurze Wendung: klein geschrieben, Beispielsatz als Ursprung', () => {
    const out = saveTargets({ from: 'en', text: 'Keep up', translation: 'mithalten', example: 'It is hard to keep up with all the new emails.', alternatives: [], terms: [] });
    expect(out).toEqual([{ key: 'result|keep up', word: 'keep up', de: 'mithalten', ex: 'It is hard to keep up with all the new emails.', kind: 'result' }]);
  });

  it('ohne passenden Satz kein Knopf (keine Karte ohne Ursprungssatz)', () => {
    expect(saveTargets({ from: 'de', text: 'freigeben', translation: 'sign off', alternatives: [], terms: [] })).toEqual([]);
  });
});
