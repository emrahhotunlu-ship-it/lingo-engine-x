import { describe, expect, it } from 'vitest';
import { againChecks, againSource } from '../../src/domain/repair/unit';

// Block 5 „Nochmal, aber besser“ ohne Aufgabe von heute (Handy-Tag, Emrah 02.10.2026): Die ältesten
// fälligen Reparatur-Sätze sind der Stoff. Mit Aufgabe oder Sätzen von heute bleibt alles wie bisher.

const DAY = '2026-10-02';
const NOW = Date.parse('2026-10-02T09:00:00+02:00');
const D = 86_400_000;
const item = (n: number, over: Record<string, unknown> = {}) => ({
  id: `r${n}`,
  wrong: `I am agree with point ${n}.`,
  right: `I agree with point ${n}.`,
  why: 'agree ist ein Verb.',
  src: 'say',
  t: NOW - 5 * D,
  box: 0,
  due: NOW - n * D,
  ...over,
});
const doc = (...items: unknown[]) => ({ items });

describe('againSource ohne Aufgabe', () => {
  it('nimmt die ältesten fälligen Sätze von früher (höchstens 3), älteste zuerst', () => {
    const src = againSource({ day: DAY, task: null, repairDoc: doc(item(1), item(2), item(3), item(4)), now: NOW });
    expect(src.olds?.map((o) => o.id)).toEqual(['r4', 'r3', 'r2']);
    expect(src.fixes).toHaveLength(3);
    expect(src.fixes[0]).toMatchObject({ kind: 'form', mine: 'I am agree with point 4.', right: 'I agree with point 4.' });
    expect(src.before).toContain('point 4');
    expect(src.better).toContain('I agree with point 2.');
  });

  it('erledigte und noch nicht fällige Sätze zählen nicht; ohne Treffer bleibt alles leer', () => {
    const src = againSource({ day: DAY, task: null, repairDoc: doc(item(1, { done: true }), item(2, { due: NOW + D })), now: NOW });
    expect(src.olds).toBeUndefined();
    expect(src.before).toBe('');
    expect(againSource({ day: DAY, task: null, repairDoc: null, now: NOW }).olds).toBeUndefined();
  });

  it('mit Aufgabe von heute (Laptop) bleibt es bei den Korrekturen der Aufgabe', () => {
    const task = { text: 'I am agree.', better: 'I agree.', fixes: [{ kind: 'form' as const, mine: 'I am agree.', right: 'I agree.', why: 'Verb' }] };
    const src = againSource({ day: DAY, task, repairDoc: doc(item(1)), now: NOW });
    expect(src.olds).toBeUndefined();
    expect(src.before).toBe('I am agree.');
  });

  it('Sätze von heute haben Vorrang vor denen von früher', () => {
    const today = item(9, { t: NOW - 60_000, due: NOW + D });
    const src = againSource({ day: DAY, task: null, repairDoc: doc(item(1), today), now: NOW });
    expect(src.olds).toBeUndefined();
    expect(src.before).toContain('point 9');
  });

  it('ohne `now` (alter Aufrufer) greift der Rückfall nicht', () => {
    expect(againSource({ day: DAY, task: null, repairDoc: doc(item(1)) }).olds).toBeUndefined();
  });

  it('Prüfung: „jetzt richtig“ nur mit der richtigen Fassung ohne den alten Fehler', () => {
    const src = againSource({ day: DAY, task: null, repairDoc: doc(item(1)), now: NOW });
    expect(againChecks('I agree with point 1.', src.fixes)[0]?.ok).toBe(true);
    expect(againChecks('I am agree with point 1.', src.fixes)[0]?.ok).toBe(false);
  });
});
