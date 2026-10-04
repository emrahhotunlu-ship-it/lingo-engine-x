import { describe, expect, it } from 'vitest';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { editOp, tomorrowOp } from '../../src/domain/srs/cardOps';
import { learningDayEnd } from '../../src/domain/date';
import { readFsrs } from '../../src/domain/srs/scheduler';
import { berlin } from './helpers';

// Wortblatt: „Morgen wieder“ (N25) und „Karte bearbeiten“ (N31) – Schreibwege nach A6.14.
type Doc = Record<string, unknown>;
const NOW = berlin('2026-09-28', 10);
const doc = (over: Doc = {}): Doc => ({ word: 'leverage', de: 'nutzen', ex: 'We can [leverage] it.', pos: 'verb', state: 'review', stage: 3, S: 5, D: 5, due: NOW + 9 * 86_400_000, last: NOW - 86_400_000, reps: 4, lapses: 0, hist: [{ t: NOW - 86_400_000, g: 3 }], ...over });

describe('Morgen wieder', () => {
  it('fällig am nächsten Lerntag, fsrs und due gespiegelt, sonst nichts verändert', () => {
    const cur = doc();
    const op = tomorrowOp(cur, 'vocab/leverage', NOW);
    expect(op).not.toBeNull();
    const next = applyUpdate(cur, op?.update ?? {});
    expect(next.due).toBe(learningDayEnd(NOW) + 60_000);
    expect((next.fsrs as Doc).due).toBe(next.due);
    expect(readFsrs(next, NOW).due).toBe(next.due);
    for (const k of ['stage', 'S', 'D', 'last', 'reps', 'hist', 'word', 'ex']) expect(next[k]).toEqual(cur[k]);
    expect(tomorrowOp(doc({ state: 'new' }), 'vocab/leverage', NOW)).toBeNull();
    expect(tomorrowOp(doc({ hidden: true }), 'vocab/leverage', NOW)).toBeNull();
  });
});

describe('Karte bearbeiten', () => {
  it('Bedeutung und Satz; Satz ohne Wort wird abgelehnt', () => {
    expect(editOp(doc(), 'vocab/leverage', 'de', { meaning: 'ausnutzen', sentence: 'Teams leverage data every day.' }).op).toEqual({ update: { de: 'ausnutzen', ex: 'Teams [leverage] data every day.' } });
    expect(editOp(doc(), 'vocab/leverage', 'en', { meaning: 'use to advantage', sentence: 'We can leverage it.' }).op).toEqual({ update: { def: 'use to advantage' } });
    expect(editOp(doc(), 'vocab/leverage', 'de', { meaning: 'nutzen', sentence: 'No word here.' })).toEqual({ op: null, error: 'sentence' });
    expect(editOp(doc(), 'vocab/leverage', 'de', { meaning: '  ', sentence: 'We can leverage it.' }).error).toBe('meaning');
  });
});
