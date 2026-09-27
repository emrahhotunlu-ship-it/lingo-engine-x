import { describe, expect, it } from 'vitest';
import { closeVariant } from '../../src/domain/grammar/check';

// Emrahs Wunsch 27.09.: sofortige Bewertung ohne Claude – ähnliche Varianten „nicht sicher“, der Rest falsch.
describe('closeVariant', () => {
  const task = { answer: 'The report was sent to the client yesterday.', accepted: [] };
  it('fast gleiche Umformung → mögliche Variante', () => {
    expect(closeVariant(task, 'The report was sent to our client yesterday.')).toBe(true);
    expect(closeVariant(task, 'Yesterday the report was sent to the client.')).toBe(true);
  });
  it('deutlich andere Antwort → falsch', () => {
    expect(closeVariant(task, 'We send it.')).toBe(false);
    expect(closeVariant(task, 'The client sent the report.')).toBe(false);
  });
});
