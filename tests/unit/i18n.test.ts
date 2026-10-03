import { describe, expect, it } from 'vitest';
import { de } from '../../src/i18n/de';
import { en } from '../../src/i18n/en';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Oberflächentexte', () => {
  it('beide Sprachen haben dieselben Schlüssel und keine leeren Texte', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
    for (const [k, v] of [...Object.entries(de), ...Object.entries(en)]) expect(v.trim(), k).not.toBe('');
  });

  it('Platzhalter stimmen in beiden Sprachen überein', () => {
    for (const k of Object.keys(de) as Array<keyof typeof de>) expect(placeholders(en[k]), k).toEqual(placeholders(de[k]));
  });

  it('Mehrzahl ist vollständig (_one und _other)', () => {
    for (const k of Object.keys(de)) {
      if (k.endsWith('_one')) expect(de, k).toHaveProperty(k.replace(/_one$/, '_other'));
      if (k.endsWith('_other')) expect(de, k).toHaveProperty(k.replace(/_other$/, '_one'));
    }
  });

  it('keine Mischsprache: englische Texte ohne deutsche Wörter, deutsche ohne englische Floskeln', () => {
    const germanMarks = /[äöüÄÖÜß]|\b(und|der|die|das|nicht|wird|werden|mit|für|noch|Karten?|Tage?)\b/;
    for (const [k, v] of Object.entries(en)) if (k !== 'appName') expect(germanMarks.test(v), `${k}: ${v}`).toBe(false);
    const englishMarks = /\b(the|and|with|your|please|loading|error|settings)\b/i;
    for (const [k, v] of Object.entries(de)) if (k !== 'appName') expect(englishMarks.test(v), `${k}: ${v}`).toBe(false);
  });

  it('englische Texte in amerikanischer Schreibweise', () => {
    const british = /\b(colour|organis|behaviour|cancelled|practis|favourite|centre|analys(e|ing))\w*/i;
    for (const [k, v] of Object.entries(en)) expect(british.test(v), `${k}: ${v}`).toBe(false);
  });
});

describe('Übernommene Inhalte je Sprache', () => {
  it('jedes Grammatikthema hat einen englischen Namen ohne deutsche Wörter', async () => {
    const { GRAMMAR_TOPICS } = await import('../../src/coach/grammar');
    for (const t of GRAMMAR_TOPICS) {
      expect(t.name_en, t.id).toBeTruthy();
      expect(/[äöüß]|\b(Passiv|Rede|Zukunft|Infinitiv|Artikel|Verbindungen)\b/.test(t.name_en), `${t.id}: ${t.name_en}`).toBe(false);
    }
  });
});
