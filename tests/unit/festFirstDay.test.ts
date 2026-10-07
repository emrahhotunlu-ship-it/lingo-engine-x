import { describe, expect, it } from 'vitest';
import { dayKey } from '../../src/domain/date';
import { historyPatch, historySnapshot } from '../../src/domain/progress/history';
import { applyUpdate, reviewWrite } from '../../src/domain/srs/applyReview';
import type { AnswerEvent } from '../../src/domain/srs/types';
import { validateDoc } from '../../src/data/validate';
import { berlin } from './helpers';

// P22: `ff` (erster Fest-Tag) wird einmal im selben Schreibvorgang gesetzt, nie überschrieben; `vu`/`dc` im Tagesbild nur ergänzend.

type Doc = Record<string, unknown>;
const NOW = berlin('2026-10-05', 10);
const DAY = dayKey(NOW);
const D = 86_400_000;
const doc = (over: Doc = {}): Doc => ({ word: 'leverage', de: 'nutzen', def: 'to use', ex: 'We can [leverage] it.', pos: 'verb', state: 'review', S: 30, D: 5, due: NOW - D, last: NOW - 30 * D, stage: 3, reps: 6, lapses: 0, src: 'lookup', added: '2026-06-01', ...over });
const ans = (over: Partial<AnswerEvent> = {}): AnswerEvent => ({ t: NOW, day: DAY, kind: 'v', id: 'leverage', ex: 'type', grade: 3, given: 'leverage', ans: 'leverage', ms: 3000, lang: 'de', ctx: 'rev', ...over });

function write(cur: Doc, a: AnswerEvent, path = 'vocab/leverage'): Doc {
  const w = reviewWrite(path, cur, a, null);
  if (w.kind !== 'update') throw new Error(`kein Update: ${JSON.stringify(w)}`);
  return applyUpdate(cur, w.patch);
}

describe('ff (erster Fest-Tag)', () => {
  it('wird gesetzt, wenn die Karte fest wird, und nie überschrieben', () => {
    const first = write(doc(), ans());
    expect(first.stage).toBeGreaterThanOrEqual(4);
    expect(first.ff).toBe(DAY);
    expect(validateDoc('vocab/leverage', first).ok).toBe(true);
    const later = write(first, ans({ t: NOW + 40 * D, day: dayKey(NOW + 40 * D) }));
    expect(later.ff).toBe(DAY);
  });

  it('wird nicht gesetzt, solange die Karte nicht fest ist', () => {
    const low = write(doc({ stage: 1, S: 2, last: NOW - 2 * D }), ans({ ex: 'mc_en' }));
    expect(low.ff).toBeUndefined();
  });

  it('Wendungen bekommen `ff` ebenso', () => {
    const chunk: Doc = { en: 'push back on', de: 'sich wehren', state: 'review', S: 30, D: 5, due: NOW - D, last: NOW - 30 * D, stage: 3, reps: 5, lapses: 0, src: { kind: 'scene', upgraded: 'Their CFO will push back on the price.' } };
    const w = reviewWrite('chunk/c1', chunk, ans({ kind: 'chunk', id: 'c1', q: 'push back on' }), null);
    expect(w.kind).toBe('update');
    if (w.kind === 'update') expect(w.patch.ff).toBe(DAY);
  });

  it('alle bisherigen Felder bleiben stehen (nichts gelöscht)', () => {
    const cur = doc({ custom: 'bleibt' });
    const merged = write(cur, ans());
    for (const k of Object.keys(cur)) expect(k in merged, k).toBe(true);
  });
});

describe('Tagesbild: vu und dc', () => {
  const base = { day: DAY, nowMs: NOW, profile: {} as Doc, grammar: new Map<string, Doc>(), vocabNow: 100 };
  it('schreibt vu und dc nur, wenn die Werte vorliegen; va bleibt eigenständig', () => {
    const plain = historySnapshot({ ...base, festNow: 40 });
    expect('vu' in plain).toBe(false);
    expect('dc' in plain).toBe(false);
    const snap = historySnapshot({ ...base, festNow: 40, unitsFest: 55, docCount: 1234 });
    expect(snap).toMatchObject({ va: 40, vu: 55, dc: 1234 });
    expect('dc' in historySnapshot({ ...base, docCount: 0 })).toBe(false);
  });
  it('das Tagesbild bleibt ein gültiger Verlaufseintrag (einmal je Tag)', () => {
    const snap = historySnapshot({ ...base, festNow: 40, unitsFest: 55, docCount: 1234 });
    const p = historyPatch({}, snap);
    expect(p).not.toBeNull();
    expect(validateDoc('app/profile', { history: (p as Doc).history, created: DAY }).ok).toBe(true);
    expect(historyPatch({ history: [snap] }, snap)).toBeNull();
  });
});
