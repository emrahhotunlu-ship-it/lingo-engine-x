import { describe, expect, it } from 'vitest';
import { LEGACY_ARTICLES } from '../../src/domain/input/items';
import { keypointQuestions } from '../../src/domain/input/keypointQuiz';
import { sourceFromRef } from '../../src/features/input/block/source';

// Antwortoptionen im Input-Block der Tageseinheit (Emrah 02.10.2026): Die richtige Antwort stand immer an erster
// Stelle. Jetzt fest gemischt: nicht immer vorn, aber stabil und die Lösung wandert mit.

describe('sourceFromRef mischt die Optionen', () => {
  const refs = LEGACY_ARTICLES.slice(0, 40).map((a) => `legacy:${a.id}`);
  const sources = refs.map((r) => sourceFromRef(r, 'de')).filter((s): s is NonNullable<typeof s> => s !== null);
  const qs = sources.flatMap((s) => s.questions);

  it('die Lösung steht nicht immer an Position 0 und erscheint an mehreren Stellen', () => {
    expect(qs.length).toBeGreaterThan(10);
    const pos = new Set(qs.map((q) => q.answer));
    expect(pos.size).toBeGreaterThanOrEqual(3);
    const first = qs.filter((q) => q.answer === 0).length;
    expect(first / qs.length).toBeLessThan(0.5);
  });

  it('die Lösung wandert mit: gleiche Kernaussage wie vor dem Mischen', () => {
    for (const s of sources.slice(0, 10)) {
      const art = LEGACY_ARTICLES.find((a) => `legacy:${a.id}` === `legacy:${s.item.id}`);
      if (!art) continue;
      const raw = keypointQuestions(art, LEGACY_ARTICLES, 3);
      for (const q of s.questions.filter((x) => x.type === 'keypoint')) {
        const orig = raw.find((r) => r.key === q.key);
        if (orig) expect(q.options[q.answer]).toBe(orig.options[orig.answer]);
      }
    }
  });

  it('stabil: dieselbe Quelle ergibt dieselbe Reihenfolge', () => {
    const a = sourceFromRef(refs[0] ?? '', 'de');
    const b = sourceFromRef(refs[0] ?? '', 'de');
    expect(a?.questions.map((q) => q.options.join('|'))).toEqual(b?.questions.map((q) => q.options.join('|')));
  });
});
