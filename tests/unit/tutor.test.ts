import { beforeEach, describe, expect, it, vi } from 'vitest';
import { takeTutorCall, tutorLeft, TUTOR_PER_DAY } from '../../src/ai/tutorBudget';

describe('Tutor-Tagesbremse', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    const mem = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    vi.stubGlobal('window', { localStorage: mem });
  });
  const at = (h: number, d = 7): number => new Date(2026, 9, d, h, 0, 0).getTime();

  it('erlaubt genau 20 Aufrufe je Tag', () => {
    for (let i = 0; i < TUTOR_PER_DAY; i++) expect(takeTutorCall(at(10))).toBe(true);
    expect(takeTutorCall(at(11))).toBe(false);
    expect(tutorLeft(at(11))).toBe(0);
  });
  it('setzt um 04:00 zurück, nicht um Mitternacht', () => {
    for (let i = 0; i < TUTOR_PER_DAY; i++) takeTutorCall(at(22));
    expect(takeTutorCall(at(2, 8))).toBe(false);
    expect(takeTutorCall(at(5, 8))).toBe(true);
  });
  it('liest kaputten Speicher als leer', () => {
    store.set('lx:tutor-day', '{"d":1,"n":"x"}');
    expect(tutorLeft(at(10))).toBe(TUTOR_PER_DAY);
  });
});
