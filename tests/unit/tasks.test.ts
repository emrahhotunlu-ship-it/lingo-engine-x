import { describe, expect, it } from 'vitest';
import { TOPICS } from '../../src/domain/content';
import { normalizeTask, rankTopics, seedTasks, selectRound, toPoolItem, wantTypes } from '../../src/domain/grammar/tasks';
import type { GrammarTask } from '../../src/domain/learn/types';
import { berlin } from './helpers';

const now = berlin('2026-09-27', 10);

describe('normalizeTask (validG)', () => {
  it('liest Seed-, daily-, Pool- und Lektionsformen', () => {
    const seed = normalizeTask({ topic: 'passive', type: 'gap', prompt: 'The road ___ (repair) every year.', answer: 'is repaired', expl: 'x', expl_en: 'y', hint: '(repair)' }, 'seed');
    expect(seed).toMatchObject({ topic: 'passive', hint: '(repair)', expl: { de: 'x', en: 'y' }, src: 'seed', errorT: null });
    const daily = normalizeTask({ topic: 'passive', type: 'mc', prompt: 'It ___ built in 1990.', options: ['was', 'has'], answer: 'was', hint_de: '', explanation_de: 'a', explanation_en: 'b' }, 'daily', 'daily/2026-09-26');
    expect(daily).toMatchObject({ options: ['was', 'has'], hint: null, expl: { de: 'a', en: 'b' }, ref: 'daily/2026-09-26' });
    const pool = normalizeTask({ topic: 'passive', type: 'transform', prompt: 'They built it. → It ___.', answer: 'was built', ref: 'daily/2026-09-20' }, 'pool');
    expect(pool?.ref).toBe('daily/2026-09-20');
  });

  it('lehnt Ungültiges ab (Thema, Typ, leer, mc ohne Lösung unter den Optionen)', () => {
    expect(normalizeTask({ topic: 'x', type: 'gap', prompt: 'a', answer: 'b' }, 'ai')).toBeNull();
    expect(normalizeTask({ topic: 'passive', type: 'essay', prompt: 'a', answer: 'b' }, 'ai')).toBeNull();
    expect(normalizeTask({ topic: 'passive', type: 'gap', prompt: ' ', answer: 'b' }, 'ai')).toBeNull();
    expect(normalizeTask({ topic: 'passive', type: 'mc', prompt: 'a ___', answer: 'b', options: ['c', 'd'] }, 'ai')).toBeNull();
    expect(normalizeTask(null, 'ai')).toBeNull();
  });

  it('Pool-Form ist wieder lesbar (Rundreise)', () => {
    const t = normalizeTask({ topic: 'passive', type: 'gap', prompt: 'It ___ (make) here.', answer: 'is made', accepted: ["'s made"] }, 'daily', 'daily/2026-09-26')!;
    expect(normalizeTask(toPoolItem(t), 'pool')).toMatchObject({ key: t.key, answer: 'is made', accepted: ["'s made"], ref: 'daily/2026-09-26' });
  });

  it('Startaufgaben: jedes Thema hat mindestens vier Aufgaben', () => {
    const seed = seedTasks();
    for (const tp of TOPICS) expect(seed.filter((t) => t.topic === tp.id).length, tp.id).toBeGreaterThanOrEqual(4);
    expect(new Set(seed.map((t) => t.key)).size).toBe(seed.length);
  });
});

describe('selectRound', () => {
  const docs = new Map<string, Record<string, unknown>>([
    ['conditionals', { p: 0.2, n: 6, last: now - 86_400_000, due: now - 1 }],
    ['passive', { p: 0.8, n: 10, last: now - 86_400_000 }],
  ]);
  const input = { mode: 'xtra' as const, grammarDocs: docs, dailyOpen: [], pool: [], lessonTasks: [], nowMs: now, size: 8, seed: '2026-09-27|xtra' };

  it('deterministisch: gleiche Eingabe → gleiche Runde', () => {
    const a = selectRound(input).map((t) => t.key);
    for (let i = 0; i < 20; i++) expect(selectRound(input).map((t) => t.key)).toEqual(a);
    expect(a).toHaveLength(8);
  });

  it('verschachtelt: ≥ 3 Themen, höchstens 2 gleiche hintereinander', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const r = selectRound({ ...input, seed });
      expect(new Set(r.map((t) => t.topic)).size).toBeGreaterThanOrEqual(3);
      for (let i = 2; i < r.length; i++) expect(r[i]!.topic === r[i - 1]!.topic && r[i]!.topic === r[i - 2]!.topic).toBe(false);
    }
  });

  it('Pflichtrunde ohne das Thema der heutigen Lektion; nächstes Lektionsthema eingemischt', () => {
    const r = selectRound({ ...input, mode: 'duty', size: 6, lessonTopicToday: 'conditionals', nextLessonTopic: 'relative' });
    expect(r.some((t) => t.topic === 'conditionals')).toBe(false);
    expect(r.some((t) => t.topic === 'relative')).toBe(true);
    expect(r).toHaveLength(6);
  });

  it('Quellen: offene daily-Aufgaben vor dem Pool, gesehene nie (außer als Notnagel)', () => {
    const d: GrammarTask = normalizeTask({ topic: 'conditionals', type: 'gap', prompt: 'If it ___ (rain), we stay in.', answer: 'rains' }, 'daily', 'daily/2026-09-27')!;
    const p: GrammarTask = normalizeTask({ topic: 'conditionals', type: 'gap', prompt: 'If I ___ (be) you, I would wait.', answer: 'were' }, 'pool')!;
    const r = selectRound({ ...input, mode: 'topic', topic: 'conditionals', dailyOpen: [d], pool: [p], size: 3 });
    expect(r.map((t) => t.src)).toEqual(['daily', 'pool', 'seed']);
    expect(r[0]!.key).toBe(d.key);
    const seenDocs = new Map([['conditionals', { p: 0.2, n: 6, seen: [d.key] }]]);
    const r2 = selectRound({ ...input, grammarDocs: seenDocs, mode: 'topic', topic: 'conditionals', dailyOpen: [d], pool: [], size: 3 });
    expect(r2.some((t) => t.key === d.key)).toBe(false);
  });

  it('die Runde wird immer voll – notfalls mit gesehenen Startaufgaben', () => {
    const all = seedTasks().filter((t) => t.topic === 'articles').map((t) => t.key);
    const r = selectRound({ ...input, grammarDocs: new Map([['articles', { seen: all }]]), mode: 'topic', topic: 'articles', size: 4 });
    expect(r).toHaveLength(4);
  });

  it('Formen nach Beherrschung', () => {
    expect(wantTypes(0.2)).toEqual(['mc', 'gap']);
    expect(wantTypes(0.5)).toEqual(['gap', 'transform']);
    expect(wantTypes(0.9)).toEqual(['correct', 'transform']);
  });

  it('rankTopics: schwaches und fälliges Thema zuerst', () => {
    expect(rankTopics({ grammarDocs: docs, nowMs: now, seed: 's' })[0]!.topic).toBe('conditionals');
  });
});
