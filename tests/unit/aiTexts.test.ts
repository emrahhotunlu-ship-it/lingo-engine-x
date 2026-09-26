import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { aiDe } from '../../src/i18n/parts/ai.de';
import { aiEn } from '../../src/i18n/parts/ai.en';

// Dieselben Regeln wie tests/unit/i18n.test.ts, bis die Texte in de.ts/en.ts eingebunden sind.

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Texte des KI-Tors', () => {
  it('beide Sprachen haben dieselben Schlüssel, nichts ist leer, alle mit Präfix ai', () => {
    expect(Object.keys(aiEn).sort()).toEqual(Object.keys(aiDe).sort());
    for (const [k, v] of [...Object.entries(aiDe), ...Object.entries(aiEn)]) {
      expect(v.trim(), k).not.toBe('');
      expect(k).toMatch(/^ai[A-Z]/);
    }
  });

  it('kein widersprüchlicher Schlüssel in de.ts (vor und nach dem Einbinden)', () => {
    const all = de as Record<string, string>;
    for (const [k, v] of Object.entries(aiDe)) if (k in all) expect(all[k], k).toBe(v);
  });

  it('Platzhalter stimmen überein', () => {
    for (const k of Object.keys(aiDe) as Array<keyof typeof aiDe>) expect(placeholders(aiEn[k]), k).toEqual(placeholders(aiDe[k]));
  });

  it('keine Mischsprache und amerikanische Schreibweise', () => {
    const germanMarks = /[äöüÄÖÜß]|\b(und|der|die|das|nicht|wird|werden|mit|für|noch|Karten?|Tage?)\b/;
    for (const [k, v] of Object.entries(aiEn)) expect(germanMarks.test(v), `${k}: ${v}`).toBe(false);
    const englishMarks = /\b(the|and|with|your|please|loading|error|settings)\b/i;
    for (const [k, v] of Object.entries(aiDe)) expect(englishMarks.test(v), `${k}: ${v}`).toBe(false);
    const british = /\b(colour|organis|behaviour|cancelled|practis|favourite|centre|analys(e|ing))\w*/i;
    for (const [k, v] of Object.entries(aiEn)) expect(british.test(v), `${k}: ${v}`).toBe(false);
  });
});
