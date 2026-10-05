import { describe, expect, it } from 'vitest';
import { normalizeTask } from '../../src/domain/grammar/tasks';

// Emrah 05.10.2026: Eine Lückenaufgabe mit zwei Lücken war nicht lösbar (ein Eingabefeld). Solche Aufgaben werden nie gestellt.
describe('Aufgaben mit mehreren Lücken', () => {
  const base = { topic: 'passive', answer: 'was', accepted: [] as string[] };
  it('gap mit zwei Lücken wird verworfen, mit einer bleibt', () => {
    expect(normalizeTask({ ...base, type: 'gap', prompt: "Markus didn't sign last year, so he ___ sign it ___." }, 'pool')).toBeNull();
    expect(normalizeTask({ ...base, type: 'gap', prompt: 'The contract ___ signed yesterday.' }, 'pool')).not.toBeNull();
  });
  it('transform: nur die Lücken des Zielsatzes zählen', () => {
    expect(normalizeTask({ ...base, type: 'transform', prompt: 'He signed it. → It ___ signed by ___.' }, 'pool')).toBeNull();
    expect(normalizeTask({ ...base, type: 'transform', prompt: 'He signed it. → It ___ signed.' }, 'pool')).not.toBeNull();
  });
});
