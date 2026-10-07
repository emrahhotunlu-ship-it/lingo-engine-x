import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';

// Textwächter Motivation (docs/umbau/motivation.md §2.1): in allen Texten der Motivations-Bereiche kein Verlust-Framing, kein Personenlob,
// kein Ausrufezeichen. Geprüft werden alle Schlüssel mit den Präfixen `nbHeute`, `nbShEnd`, `wk`, `weekly` und `mo` (gefolgt von Großbuchstabe oder Ziffer).

const PREFIX = /^(nbHeute|nbShEnd|wk|weekly|mo)[A-Z0-9]/;
const BAD_DE = /verlier|verloren|gerissen|schade|nicht vergessen|beeil|nur noch|super|genial|klasse|perfekt|wow|profi|!/i;
const BAD_EN = /\blos(e|t)\b|broken|hurry|don't forget|awesome|amazing|perfect|genius|wow|!/i;

const scan = (texts: Record<string, string>, bad: RegExp): string[] =>
  Object.entries(texts)
    .filter(([k]) => PREFIX.test(k))
    .filter(([, v]) => bad.test(v))
    .map(([k, v]) => `${k}: ${v}`);

describe('Motivationstexte', () => {
  it('es gibt Schlüssel, die geprüft werden', () => {
    expect(Object.keys(de).filter((k) => PREFIX.test(k)).length).toBeGreaterThan(10);
    expect(Object.keys(en).filter((k) => PREFIX.test(k)).length).toBeGreaterThan(10);
  });
  it('Deutsch: keine Verlust-Wörter, kein Personenlob, kein Ausrufezeichen', () => {
    expect(scan(de as unknown as Record<string, string>, BAD_DE)).toEqual([]);
  });
  it('Englisch: keine Verlust-Wörter, kein Personenlob, kein Ausrufezeichen', () => {
    expect(scan(en as unknown as Record<string, string>, BAD_EN)).toEqual([]);
  });
  it('das Verbot greift (Gegenprobe)', () => {
    expect(BAD_DE.test('Super gemacht!')).toBe(true);
    expect(BAD_DE.test('Deine Serie ist gerissen')).toBe(true);
    expect(BAD_EN.test('You lost your streak')).toBe(true);
    expect(BAD_EN.test('Week complete')).toBe(false);
  });
});
