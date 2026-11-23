import { describe, expect, it } from 'vitest';
import { hasTarget } from '../../../src/modules/vocab/prompts/common';

// Live-Kommentar 23.11.2026: „to be aware of“ im eigenen Satz als „I am aware of …“ benutzt.
describe('Schreibaufgabe: Infinitiv-„to“ und Formen von „be“', () => {
  it('erkennt „am/was/being aware of“ als Verwendung von „to be aware of“', () => {
    for (const s of ['I am aware of the risks.', "She wasn't aware of the delay.", 'Being aware of the budget helps.', "We're aware of it."]) {
      expect(hasTarget(s, { word: 'to be aware of', kind: 'w' } as never), s).toBe(true);
    }
  });
});
