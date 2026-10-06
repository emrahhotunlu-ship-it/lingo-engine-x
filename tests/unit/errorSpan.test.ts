import { describe, expect, it } from 'vitest';
import { errorSpan, errorSpans } from '../../src/domain/grammar/span';
import { seedTasks } from '../../src/domain/grammar/tasks';

// Fehlerstelle eines falschen Satzes (Lernplattform 2.0 §4.7, §5.7).

describe('errorSpan', () => {
  it('ersetztes Wort, zusätzliches Wort, fehlendes Wort', () => {
    expect(errorSpan('I have seen him yesterday.', 'I saw him yesterday.')).toEqual([1, 2]);
    expect(errorSpan('I will call you when I will arrive.', 'I will call you when I arrive.')).toEqual([6, 6]);
    // Fehlt nur ein Wort, steht die Stelle am folgenden Wort („looking“ wird zu „am looking“).
    expect(errorSpan('I looking forward to it.', 'I am looking forward to it.')).toEqual([1, 1]);
    // Fehlt das letzte Wort, steht die Stelle am vorigen.
    expect(errorSpan('We start at', 'We start at noon')).toEqual([2, 2]);
  });

  it('Satzzeichen und Großschreibung am Rand zählen nicht', () => {
    expect(errorSpan('We met yesterday', 'We met yesterday.')).toBeNull();
    expect(errorSpan('he have a car.', 'He has a car.')).toEqual([1, 1]);
  });

  it('mehr als ein Bereich oder mehr als 4 Wörter → null; gleiche Sätze → null', () => {
    expect(errorSpan('He have a car and she have a bike.', 'He has a car and she has a bike.')).toBeNull();
    expect(errorSpan('a b c d e f g', 'a x y z w v g')).toBeNull();
    expect(errorSpan('Same sentence here.', 'Same sentence here.')).toBeNull();
    expect(errorSpan('', 'x')).toBeNull();
  });

  it('errorSpans: bis zu drei Bereiche, jeder höchstens 4 Wörter', () => {
    expect(errorSpans('He have a car and she have a bike.', 'He has a car and she has a bike.')).toEqual([[1, 1], [6, 6]]);
    expect(errorSpans('a x c y e z g', 'a b c d e f g')).toEqual([[1, 1], [3, 3], [5, 5]]);
    expect(errorSpans('a x c y e z g w i', 'a b c d e f g h i')).toBeNull();
    expect(errorSpans('one two three', 'one two three')).toBeNull();
  });
});

describe('Anteil mit Bereich bei den Satzkorrektur-Aufgaben', () => {
  it('für mindestens 80 der Satzkorrektur-Aufgaben liefert errorSpan einen Bereich ≤ 4 Wörter', () => {
    const corrects = seedTasks().filter((t) => t.type === 'correct');
    expect(corrects.length).toBeGreaterThanOrEqual(90);
    const ok = corrects.filter((t) => errorSpan(t.prompt, t.answer) !== null).length;
    const multi = corrects.filter((t) => errorSpan(t.prompt, t.answer) === null && errorSpans(t.prompt, t.answer) !== null).length;
    expect(ok).toBeGreaterThanOrEqual(80);
    // Die Sätze mit zwei oder drei Stellen sind zusätzlich über errorSpans erfasst (Schritt 4 am Handy).
    expect(ok + multi).toBeGreaterThan(ok - 1);
  });
});
