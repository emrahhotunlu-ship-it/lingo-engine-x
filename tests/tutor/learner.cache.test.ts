import { describe, expect, it, vi } from 'vitest';
import type { LearnerModel, LearnerSources } from '../../src/domain/tutor/learner';

// Zwischenspeicher des Lernermodells (Tutor-Engine v3 §6.2 „Leistung“): gleiches Ergebnis wie ohne Zwischenspeicher – mit denselben
// Objekten, mit neuen Objekten gleichen Inhalts und nach einer Änderung an einzelnen Dokumenten (Verlauf, Wendung, Ausblenden, fehlendes `due`).
// „Ohne Zwischenspeicher“ = frisch geladenes Modul (vi.resetModules). Alle Daten sind erfunden.

type Doc = Record<string, unknown>;
const DAY = 86_400_000;
const NOW = new Date(2026, 9, 19, 12).getTime();

function sources(): LearnerSources {
  const vocab = new Map<string, Doc>();
  for (let i = 0; i < 60; i++) {
    const hist = Array.from({ length: 1 + (i % 7) }, (_, k) => ({ t: NOW - (30 - k * 4) * DAY, x: ['type', 'mc_en', 'cloze_hint', 'produce'][k % 4], g: [1, 3, 3, 4, 2][(i + k) % 5], s: `We met at sentence ${(i + k) % 3}.` }));
    vocab.set(`w${i}`, {
      id: `w${i}`,
      word: `word${i}`,
      de: `Wort${i}`,
      stage: i % 6,
      S: 1 + (i % 9) * 3.7,
      D: 1 + (i % 8),
      state: i % 4 ? 'review' : 'learning',
      reps: i % 5,
      ...(i % 11 === 0 ? {} : { due: NOW + ((i % 9) - 4) * DAY }),
      last: NOW - (i % 13) * DAY,
      ex: `The word${i} was here.`,
      col: i % 3 === 0 ? [{ p: `rely on`, de: 'x', gap: 'on', opts: ['on', 'at'], ex: `We [rely on] word${i}.` }] : [],
      ...(i % 17 === 0 ? { hidden: true } : {}),
      ...(i % 5 === 0 ? { na: 1 } : {}),
      hist,
    });
  }
  const act = new Map<string, Doc>([
    ['act/2026-10', { v: 1, month: '2026-10', e: { a1: { id: 'a1', t: NOW - DAY, d: '2026-10-18', c: 'vocab/w3', st: 2, f: 'pr', a: 'x', s: 'We rely on the team.', g: 3, v: 'c', k: 1 } } }],
  ]);
  return { grammarDocs: new Map(), logs: new Map(), vocab, act, profile: null, diag: [] };
}

const plain = (m: LearnerModel): unknown => ({ ...m, patterns: [...m.patterns], uses: [...m.uses], words: [...m.words] });

async function fresh(src: LearnerSources, now: number): Promise<unknown> {
  vi.resetModules();
  const mod = await import('../../src/domain/tutor/learner');
  return plain(mod.buildLearnerModel(structuredClone(src), now));
}

describe('buildLearnerModel: Zwischenspeicher ändert nichts am Ergebnis', () => {
  it('gleiche Objekte, neue Objekte, geänderte Dokumente', async () => {
    vi.resetModules();
    const { buildLearnerModel } = await import('../../src/domain/tutor/learner');
    const src = sources();
    const a = buildLearnerModel(src, NOW);
    expect(plain(a)).toEqual(await fresh(src, NOW));
    // Gleiche Objekte, spätere Uhrzeit (Abrufwahrscheinlichkeit und `due`-lose Karten rechnen neu).
    expect(plain(buildLearnerModel(src, NOW + 3 * DAY))).toEqual(await fresh(src, NOW + 3 * DAY));
    // Neue Objekte gleichen Inhalts.
    expect(plain(buildLearnerModel(structuredClone(src), NOW + 3 * DAY))).toEqual(await fresh(src, NOW + 3 * DAY));
    // Änderungen: Verlauf angehängt, Wendung ergänzt, ausgeblendet, Stufe geändert.
    const vocab = new Map(src.vocab);
    const next: LearnerSources = { ...src, vocab };
    const w1 = src.vocab.get('w1') as Doc;
    vocab.set('w1', { ...w1, hist: [...(w1.hist as Doc[]), { t: NOW - DAY, x: 'type', g: 3, s: 'A new sentence.' }], last: NOW - DAY });
    vocab.set('w2', { ...(src.vocab.get('w2') as Doc), col: [{ p: 'take part in', de: 'x', gap: 'in', opts: ['in', 'on'], ex: 'We [take part in] it.' }] });
    vocab.set('w4', { ...(src.vocab.get('w4') as Doc), hidden: true });
    vocab.set('w7', { ...(src.vocab.get('w7') as Doc), stage: 5 });
    const b = buildLearnerModel(next, NOW + 3 * DAY);
    expect(plain(b)).toEqual(await fresh(next, NOW + 3 * DAY));
    expect(b.words.has('w4')).toBe(false);
    expect(b.uses.has('use:take+in')).toBe(true);
  });
});
