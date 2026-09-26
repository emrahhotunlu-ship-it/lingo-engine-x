import { describe, expect, it } from 'vitest';
import { validateDoc } from '../../src/data/validate';
import { loadSeed } from './helpers';

// Schema-Ergänzungen von Phase 2 (phase2-plan §4.11): nur additiv, nichts verschärft.

describe('Schema-Ergänzungen Phase 2', () => {
  it('neue Felder werden gelesen', () => {
    expect(validateDoc('app/pool', { items: [{ topic: 'passive', type: 'gap', prompt: 'x', answer: 'y', src: 'daily', ref: 'daily/2026-09-27' }], t: 1, lxDaily: { '2026-09-27': { h: 1, t: 2, w: 0, g: 1, open: 0, bad: 0 } } }).ok).toBe(true);
    expect(validateDoc('grammar/passive', { errors: [{ q: 'q', given: 'g', ans: 'a', t: 1, box: 1, due: 2, done: false, last: 2, src: 'seed', fsrs: { v: 1 } }] }).ok).toBe(true);
    expect(validateDoc('lesson/l07', { words: [], questions: [{ q: 'q', answer: 'a', options: ['a', 'b'], lang: 'de', q_alt: 'Q', answer_alt: 'A', options_alt: ['A', 'B'] }], output: null, lx: { pv: 'lesson-content@1' } }).ok).toBe(true);
    expect(validateDoc('app/course', { done: { l07: { d: 'x', t: 1, last: { d: 'y', t: 2, n: 3, ok: 2 } } } }).ok).toBe(true);
    expect(validateDoc('app/profile', { lxSeq: { tab1: 5, alt: null }, sprints: [{ t: 1, score: 2, ok: 1, n: 1, avgMs: 900, combo: 1 }], pflicht: { '2026-09-27': 1 } }).ok).toBe(true);
    expect(validateDoc('log/2026-09-27', { entries: [{ t: 1, ok: true, k: 'g', topic: 'passive', type: 'gap', src: 'lesson', lesson: 'l07', ctx: 'duty' }] }).ok).toBe(true);
    expect(validateDoc('writing/lesson-l07-1', { res: { cefr: 'B2', cando: 'met', pv: 'lesson-production@1' } }).ok).toBe(true);
    expect(validateDoc('app/profile', { plan: { d: '2026-09-28', v: 1, ids: ['order'], duty: ['review', 'lesson', 'ch:order'], goal: { review: 22, due: 17, new: 5, ahead: 0, ch: 6 }, lesson: 'l07' } }).ok).toBe(true);
  });

  it('nichts verschärft: alle Seed-Dokumente und fremde Sprint-Einträge bleiben gültig', () => {
    const seed = loadSeed();
    for (const [path, doc] of Object.entries(seed)) expect(validateDoc(path, doc).ok, path).toBe(true);
    expect(validateDoc('app/profile', { sprints: [{ t: '2026', score: 'viel' }] }).ok).toBe(true);
  });
});
