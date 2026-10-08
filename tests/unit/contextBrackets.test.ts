import { describe, expect, it } from 'vitest';
import seed from '../../seed/sample-data.json';
import legacyVocab from '../../src/content/legacy/vocab.json';
import pack from '../../src/content/c1/pack.json';
import { findContext, parseCollocs } from '../../src/domain/srs/context';
import { chunkContext } from '../../src/domain/srs/chunkCards';

const WORD = 'to put something in writing';
const PREFIX = 'The manager asked the team to ';

describe('findContext: nie Klammern im Satz, Maske nur über der Wendung', () => {
  const cases: Array<[string, string, string]> = [
    // Satz, erwartete Lücke
    ['one Klammer um die ganze Wendung', `${PREFIX}[put the agreement in writing] before Friday.`, 'put the agreement in writing'],
    ['zwei Klammern (Emrahs Fehlerbild)', `${PREFIX}[put] the agreement [in writing].`, 'put the agreement in writing'],
    ['verschachtelt', `${PREFIX}[put [the agreement] in writing].`, 'put the agreement in writing'],
    ['nur das Objekt markiert', `${PREFIX}put [the agreement] in writing.`, 'put the agreement in writing'],
    ['drei Klammern', `${PREFIX}[put] [the agreement] [in writing].`, 'put the agreement in writing'],
    ['Platzhalter-Objekt aus mehreren Wörtern ohne Klammer', `${PREFIX}put the new price agreement in writing.`, 'put the new price agreement in writing'],
    ['gebeugt, ohne Klammer', 'She put everything in writing last week.', 'put everything in writing'],
    ['Wendung wörtlich', `${PREFIX}put something in writing before Friday.`, 'put something in writing'],
  ];
  for (const [name, ex, gap] of cases) {
    it(name, () => {
      const c = findContext(ex, WORD);
      expect(c).not.toBeNull();
      expect(c?.sentence).not.toMatch(/[[\]]/);
      expect(c?.gap).not.toMatch(/[[\]]/);
      expect(c?.gap).toBe(gap);
      expect(c?.sentence.slice(c.start, c.end)).toBe(c?.gap);
      expect(c?.sentence.startsWith(PREFIX.trim().slice(0, 3)) || true).toBe(true);
    });
  }

  it('Platzhalter greift nicht über Satzzeichen hinweg und frisst nicht den Satzrest', () => {
    const c = findContext('They will put it in writing, and then send the contract to the client next week.', WORD);
    expect(c?.gap).toBe('put it in writing');
  });

  it('kaputte Klammern: kein Klammerzeichen in Satz oder Lücke', () => {
    for (const ex of [`${PREFIX}put ] the agreement in [writing.`, `${PREFIX}[put the agreement in writing.`, `${PREFIX}put the agreement] in writing.`, `${PREFIX}[] put the agreement in writing.`]) {
      const c = findContext(ex, WORD);
      if (c) {
        expect(c.sentence).not.toMatch(/[[\]]/);
        expect(c.gap).not.toMatch(/[[\]]/);
        expect(c.sentence.slice(c.start, c.end)).toBe(c.gap);
      }
    }
  });

  it('mehrere Klammern ohne auffindbare Wendung: Maske bleibt klein, nie ein Satzrest', () => {
    const c = findContext('We [agreed] on the plan and the [budget] was approved by the board after a long and tiring discussion.', 'to put something in writing');
    expect(c === null || c.gap.split(/\s+/).length <= 3).toBe(true);
  });

  it('Wortpartner (parseCollocs): keine Klammern in Satz und Lücke', () => {
    const [c] = parseCollocs([{ p: 'put in writing', de: 'x', gap: 'writing', opts: ['a', 'b'], ex: 'Please [put it in writing] now and [send] it.' }]);
    expect(c?.ctx?.sentence ?? '').not.toMatch(/[[\]]/);
  });

  it('Wendungskarte (chunkContext): keine Klammern im Satz', () => {
    const c = chunkContext('We should [put it in writing] today.', 'put it in writing');
    if (c) {
      expect(c.sentence).not.toMatch(/[[\]]/);
      expect(c.sentence.slice(c.start, c.end)).toBe(c.gap);
    }
  });
});

describe('alle vorhandenen Karten: Kontext ohne Klammern, Maske nicht größer als die Wendung', () => {
  type Pair = { word: string; ex: string };
  const pairs: Pair[] = [];
  for (const [path, doc] of Object.entries(seed as Record<string, Record<string, unknown>>)) {
    if (path.startsWith('vocab/') && typeof doc.word === 'string' && typeof doc.ex === 'string') pairs.push({ word: doc.word, ex: doc.ex });
  }
  for (const v of (legacyVocab as { seedVocab: Array<{ w: string; ex: string }> }).seedVocab) pairs.push({ word: v.w, ex: v.ex });
  for (const it of (pack as { items: Array<{ en?: string; ex?: string }> }).items) if (it.en && it.ex) pairs.push({ word: it.en, ex: it.ex });

  it('hat Karten zum Prüfen', () => expect(pairs.length).toBeGreaterThan(300));
  it('keine Klammern, Lücke = Satzausschnitt, Maske höchstens Wendungslänge + 6 Wörter', () => {
    const bad: string[] = [];
    for (const { word, ex } of pairs) {
      const c = findContext(ex, word);
      if (!c) continue;
      const wl = word.replace(/^to\s+/i, '').split(/\s+/).length;
      if (/[[\]]/.test(c.sentence) || /[[\]]/.test(c.gap) || c.sentence.slice(c.start, c.end) !== c.gap || c.gap.split(/\s+/).length > wl + 6) bad.push(`${word} | ${ex} | ${c.gap}`);
    }
    expect(bad).toEqual([]);
  });
});
