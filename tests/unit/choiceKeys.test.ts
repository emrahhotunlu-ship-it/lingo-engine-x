import { describe, expect, it } from 'vitest';
import { choiceKeyRange, keyToIndex } from '../../src/engine/choiceKeys';

describe('keyToIndex', () => {
  it('ordnet A–D und 1–4 derselben Option zu', () => {
    ['a', 'b', 'c', 'd'].forEach((k, i) => {
      expect(keyToIndex(k, 4)).toBe(i);
      expect(keyToIndex(k.toUpperCase(), 4)).toBe(i);
      expect(keyToIndex(String(i + 1), 4)).toBe(i);
    });
  });
  it('kennt nur so viele Optionen, wie es gibt', () => {
    expect(keyToIndex('c', 2)).toBeNull();
    expect(keyToIndex('3', 2)).toBeNull();
    expect(keyToIndex('b', 2)).toBe(1);
    expect(keyToIndex('a', 0)).toBeNull();
  });
  it('ignoriert andere Tasten und alles über vier', () => {
    for (const k of ['e', 'E', '0', '5', 'Enter', 'ArrowDown', ' ', '', 'ab', 't']) expect(keyToIndex(k, 6)).toBeNull();
  });
});

describe('choiceKeyRange', () => {
  it('nennt so viele Tasten, wie es Optionen gibt (höchstens vier)', () => {
    expect(choiceKeyRange(2)).toEqual({ letters: 'A–B', nums: '1–2' });
    expect(choiceKeyRange(3)).toEqual({ letters: 'A–C', nums: '1–3' });
    expect(choiceKeyRange(4)).toEqual({ letters: 'A–D', nums: '1–4' });
    expect(choiceKeyRange(6)).toEqual({ letters: 'A–D', nums: '1–4' });
    expect(choiceKeyRange(1)).toEqual({ letters: 'A', nums: '1' });
    expect(choiceKeyRange(0)).toBeNull();
  });
});
