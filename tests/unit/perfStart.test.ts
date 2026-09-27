import { describe, expect, it } from 'vitest';
import { distractors } from '../../src/domain/drills/sprint';
import { mulberry32 } from '../../src/domain/random';
import { buildTrainCards } from '../../src/domain/srs/cards';
import { findContext, formsOf, lemmaOf, locate } from '../../src/domain/srs/context';
import { loadSeed, type Doc } from './helpers';

// P7-1 / Kap. 14 „< 2 s“: Startpfad ohne quadratische oder wiederholte Arbeit – gleiche Ergebnisse.

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Die frühere Suche ohne Vorfilter und ohne Zwischenspeicher (Referenz). */
function locateRef(sentence: string, target: string): { start: number; end: number } | null {
  const words = target.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const parts = words.map((w, i) => (i === 0 || i === words.length - 1 ? `(?:${formsOf(w).map(escape).join('|')})` : escape(w)));
  const m = new RegExp(`(^|[^A-Za-z'])(${parts.join('\\s+')})(?![A-Za-z'])`, 'i').exec(sentence);
  if (!m) return null;
  const start = m.index + (m[1]?.length ?? 0);
  return { start, end: start + (m[2]?.length ?? 0) };
}

describe('Satzstelle finden: Vorfilter und Zwischenspeicher ändern kein Ergebnis', () => {
  it('alle Karten des Seeds und Beugungen (try → tried, make → making, stop → stopped, Groß/klein)', () => {
    const seed = loadSeed();
    let n = 0;
    for (const [k, d] of Object.entries(seed)) {
      if (!k.startsWith('vocab/') || typeof d.ex !== 'string' || typeof d.word !== 'string') continue;
      const sentence = d.ex.replace(/\[|\]/g, '');
      const t = lemmaOf(d.word);
      expect(locate(sentence, t)).toEqual(locateRef(sentence, t));
      n++;
    }
    expect(n).toBeGreaterThan(100);
    const cases: Array<[string, string]> = [
      ['She tried again.', 'try'],
      ['We are making progress.', 'make'],
      ['They stopped the call.', 'stop'],
      ['Carries the load.', 'carry'],
      ['THE BUDGET WAS CUT.', 'cut'],
      ['No match here.', 'deserve'],
      ['He signed off on it.', 'sign off on'],
      ['I', 'I'],
    ];
    for (const [s, t] of cases) expect(locate(s, t)).toEqual(locateRef(s, t));
    expect(locate('She tried again.', 'try')).not.toBeNull();
  });

  it('Kartenaufbau: gleiches Dokument → dieselbe Satzstelle (nur einmal gesucht), anderes Dokument neu', () => {
    const doc: Doc = Object.freeze({ word: 'avoid', de: 'vermeiden', ex: 'We should [avoid] delays.', stage: 2 });
    const a = buildTrainCards(new Map([['avoid', doc]]), 1_790_000_000_000).find((c) => c.id === 'avoid')!;
    const b = buildTrainCards(new Map([['avoid', doc]]), 1_790_000_100_000).find((c) => c.id === 'avoid')!;
    expect(b.context).toBe(a.context);
    expect(b.context).toEqual(findContext(doc.ex, 'avoid'));
    const c = buildTrainCards(new Map([['avoid', { ...doc, ex: 'Try to avoid it.' }]]), 1_790_000_000_000).find((x) => x.id === 'avoid')!;
    expect(c.context).not.toBe(a.context);
    expect(c.context?.gap).toBe('avoid');
  });
});

describe('Sprint-Ablenker linear', () => {
  it('drei verschiedene, nie die eigene Bedeutung, gleich bei gleichem Startwert', () => {
    const pool = Array.from({ length: 1500 }, (_, i) => `Bedeutung ${i}`);
    const a = distractors(pool, 'Bedeutung 7', mulberry32(42));
    const b = distractors(pool, 'Bedeutung 7', mulberry32(42));
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(3);
    expect(a).not.toContain('Bedeutung 7');
    const small = distractors(['x', 'y', 'z', 'own'], 'own', mulberry32(1));
    expect(small.sort()).toEqual(['x', 'y', 'z']);
    expect(distractors(['own', 'x'], 'own', mulberry32(1))).toEqual(['x']);
  });
});
