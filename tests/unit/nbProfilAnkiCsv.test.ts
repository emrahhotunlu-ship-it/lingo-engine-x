import { describe, expect, it } from 'vitest';
import { ankiCsv, exampleHtml } from '../../src/domain/progress/ankiCsv';

// N98: CSV-Export für Anki.

describe('ankiCsv', () => {
  it('Kopf im Anki-Format, eine Zeile je sichtbarer Karte, Felder sicher gequotet', () => {
    const { text, rows } = ankiCsv([
      ['b', { word: 'leverage', de: 'Hebel; Druckmittel', ex: 'We have [leverage] "here".', level: 'B2', src: 'lookup' }],
      ['a', { word: 'avoid', de: 'vermeiden', ex: '', hidden: true }],
      ['c', { word: '', de: 'leer' }],
    ]);
    expect(rows).toBe(1);
    const lines = text.trim().split('\n');
    expect(lines.slice(0, 3)).toEqual(['#separator:Semicolon', '#html:true', '#columns:Front;Back;Example;Tags']);
    expect(lines.at(-1)).toBe('"Hebel; Druckmittel";"leverage";"We have <b>leverage</b> ""here"".";"lingo B2 lookup"');
  });

  it('HTML im Satz wird geschützt', () => {
    expect(exampleHtml('a <b> [x]')).toBe('a &lt;b&gt; <b>x</b>');
  });
});
