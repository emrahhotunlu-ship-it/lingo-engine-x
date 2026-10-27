import { describe, expect, it } from 'vitest';
import { buildTrainCards } from '../../src/domain/metrics';
import { quizzable } from '../../src/domain/srs/queue';
import { availableExercises } from '../../src/domain/srs/modes';
import type { Stage } from '../../src/domain/srs/types';
import { berlin, loadSeed } from './helpers';

// U2 (Start-Tempo): `quizzable` kürzt mit der Bedeutung ab, statt für jede Karte die Satzsuche der Lückenaufgaben zu rechnen.
// Das Ergebnis muss genau dem vollen Weg (`availableExercises(...).length > 0`) entsprechen – für alle Stufen, beide Sprachen,
// mit und ohne Bedeutung, mit kleinem und großem Pool.

const NOW = berlin('2026-09-23', 9);
const seed = loadSeed();
const vocab = new Map<string, Record<string, unknown>>(Object.entries(seed).filter(([k]) => k.startsWith('vocab/')).map(([k, v]) => [k.slice(6), { ...v }]));
[...vocab.values()].forEach((d, i) => {
  if (i % 5 === 0) delete d.def;
  if (i % 7 === 0) delete d.de;
  if (i % 3 === 0) delete d.ctx;
});

describe('quizzable: Abkürzung gleich dem vollen Weg', () => {
  const cards = buildTrainCards(vocab, NOW);
  it('alle Karten, Stufen 0–5, beide Sprachen, Pool 0 und groß', () => {
    let checked = 0;
    for (const base of cards)
      for (const stage of [0, 1, 2, 3, 4, 5] as Stage[])
        for (const lang of ['de', 'en'] as const)
          for (const pool of [0, 2, 200]) {
            const c = { ...base, stage };
            const full = availableExercises(c, lang, pool).length > 0;
            expect(quizzable(c, lang, pool), `${c.key} s${stage} ${lang} p${pool}`).toBe(full);
            checked++;
          }
    expect(checked).toBeGreaterThan(1000);
  });
});
