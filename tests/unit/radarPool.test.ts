import { describe, expect, it } from 'vitest';
import { legacyTaskKey } from '../../src/domain/grammar/key';
import { POOL_MAX, poolIntake, poolTasks } from '../../src/domain/grammar/pool';
import { mergeRadar, normCat, radarEvent, RADAR_MAX, RADAR_MAX_BYTES, topicCat } from '../../src/domain/grammar/radar';
import { applyUpdate } from '../../src/domain/srs/applyReview';
import { berlin } from './helpers';

const now = berlin('2026-09-27', 10);

describe('Radar', () => {
  it('höchstens 400, doppelte (t|c|q) nur einmal, nach Zeit', () => {
    const cur = Array.from({ length: 399 }, (_, i) => ({ c: 'tense', s: 'g', t: i, q: `q${i}`, g: '', a: '' }));
    const out = mergeRadar(cur, [radarEvent('tense', 'g', 5, { q: 'q5' }), radarEvent('prep', 's', 1000, { q: 'x' }), radarEvent('cond', 'g', 1001, { q: 'y' })]);
    expect(out).toHaveLength(RADAR_MAX);
    expect((out[out.length - 1] as { t: number }).t).toBe(1001);
    expect((out[0] as { t: number }).t).toBe(1);
  });

  it('≤ 240 KiB', () => {
    const big = Array.from({ length: 400 }, (_, i) => ({ c: 'tense', s: 'g', t: i, q: 'x'.repeat(700), g: '', a: '' }));
    const out = mergeRadar(big, []);
    expect(new TextEncoder().encode(JSON.stringify(out)).length).toBeLessThanOrEqual(RADAR_MAX_BYTES);
  });

  it('Kategorien wie in der alten App', () => {
    expect(topicCat('mixed-cond')).toBe('cond');
    expect(topicCat('past-perfect')).toBe('tense');
    expect(normCat('Spelling ')).toBe('spelling');
    expect(normCat('grammar')).toBe('wordchoice');
    expect(radarEvent('x', 'v', 1, { q: 'q'.repeat(300), g: 'g'.repeat(300) }).q.length).toBe(160);
  });
});

const item = (i: number, topic = 'passive') => ({ topic, type: 'gap', prompt: `Item ${'abcdefghijklmnopqrstuvwxyz'[i % 26]} ${'abcdefghijklmnopqrstuvwxyz'[Math.floor(i / 26) % 26]} ___ (make) here.`, answer: 'is made' });

describe('Pool', () => {
  it('voller Pool (90): nichts wird verdrängt, open stimmt', () => {
    const items = Array.from({ length: 90 }, (_, i) => item(i));
    const r = poolIntake({ items, t: 1 }, [{ day: '2026-09-26', src: 'daily', items: [item(100), item(101)], hash: 7, words: 2 }], new Map(), now);
    expect(r.added).toBe(0);
    expect(r.open).toBe(2);
    expect(r.op && 'update' in r.op && r.op.update.items).toBeUndefined();
    expect(r.marks['2026-09-26']).toEqual({ h: 7, t: now, w: 2, g: 2, open: 2, bad: 0 });
  });

  it('verdichten: nur gesehene Aufgaben entfernen; ergänzen bis 90', () => {
    const items = Array.from({ length: 90 }, (_, i) => item(i));
    const seen = new Map([['passive', new Set([legacyTaskKey(item(0).prompt), legacyTaskKey(item(1).prompt)])]]);
    const r = poolIntake({ items, t: 1, extra: 'bleibt' }, [{ day: '2026-09-26', src: 'daily', items: [item(100), item(101), item(102)] }], seen, now);
    expect(r.removed).toBe(2);
    expect(r.added).toBe(2);
    expect(r.open).toBe(1);
    const next = applyUpdate({ items, t: 1, extra: 'bleibt' }, (r.op as { update: Record<string, unknown> }).update);
    expect((next.items as unknown[]).length).toBe(POOL_MAX);
    expect(next.extra).toBe('bleibt');
    expect((next.items as Array<Record<string, unknown>>).at(-1)).toMatchObject({ src: 'daily', ref: 'daily/2026-09-26' });
  });

  it('keine Doppelten (schon im Pool oder gesehen); ungültige gezählt', () => {
    const seen = new Map([['passive', new Set([legacyTaskKey(item(3).prompt)])]]);
    const r = poolIntake({ items: [item(1)] }, [{ day: '2026-09-25', src: 'daily', items: [item(1), item(3), { topic: 'x' }, item(4)] }], seen, now);
    expect(r.added).toBe(1);
    expect(r.bad).toBe(1);
  });

  it('fehlt → set; ungültig → nichts', () => {
    const r = poolIntake(undefined, [{ day: '2026-09-25', src: 'daily', items: [item(1)], hash: 1 }], new Map(), now);
    expect(r.op && 'set' in r.op && r.op.set).toMatchObject({ t: now, lxDaily: { '2026-09-25': { h: 1 } } });
    const bad = poolIntake({ items: 'kaputt' }, [{ day: '2026-09-25', src: 'daily', items: [item(1)] }], new Map(), now);
    expect(bad).toMatchObject({ invalid: true, op: null });
    expect(poolIntake(undefined, [], new Map(), now).op).toBeNull();
  });

  it('Pool als Aufgaben lesen', () => {
    expect(poolTasks({ items: [item(1), { topic: 'passive' }] })).toHaveLength(1);
    expect(poolTasks(undefined)).toEqual([]);
  });
});
