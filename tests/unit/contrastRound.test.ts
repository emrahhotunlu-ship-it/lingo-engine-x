// Kontrast-Runde (Lernplattform 3.0 P49): A und B im Wechsel, ungesehene zuerst, stabil, nie eine Runde mit zu wenigen Aufgaben.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flags } from '../../src/app/flags';
import examples from '../fixtures/c1x/examples.json';
import { registerC1Items, resetC1Store } from '../../src/domain/c1x/preload';
import { c1Key } from '../../src/domain/c1x/runtime';
import { c1Item } from '../../src/domain/c1x/schema';
import type { C1Item } from '../../src/domain/c1x/types';
import { contrastSideCounts, contrastTasks, CONTRAST_SIDE, mixOrder, MIN_SIDE } from '../../src/domain/tutor/contrast';

const fx = (id: string): Record<string, unknown> => JSON.parse(JSON.stringify((examples.items as Array<Record<string, unknown>>).find((i) => i.id === id))) as Record<string, unknown>;
const make = (id: string, pat: string, text: string, accept: string[]): C1Item => c1Item.parse({ ...fx('ocl-0001'), id, pat, topic: 'articles', text, accept, chips: ['the', 'a', 'an'] });

const A = 'art.definite';
const B = 'art.indefinite';
const itemsA = [1, 2, 3, 4, 5].map((n) => make(`ocl-09${n}0`, A, `We sent ___ report number ${n} yesterday afternoon.`, ['the']));
const itemsB = [1, 2, 3, 4, 5].map((n) => make(`ocl-09${n}5`, B, `She asked for ___ answer to question ${n} before Friday.`, ['an']));
const docs = new Map<string, Record<string, unknown>>();

beforeEach(() => {
  resetC1Store();
  flags.c1xKinds.ocl = true;
});
afterEach(() => {
  flags.c1xKinds.ocl = false;
});

describe('contrastTasks', () => {
  it('A und B gemischt mit gleich vielen Aufgaben je Seite, höchstens 8; nie mehr als zwei gleiche hintereinander', () => {
    registerC1Items([...itemsA, ...itemsB]);
    const tasks = contrastTasks({ a: A, b: B }, { grammarDocs: docs, seed: 's1' });
    expect(tasks.length).toBeGreaterThanOrEqual(2 * MIN_SIDE);
    expect(tasks.length).toBeLessThanOrEqual(2 * CONTRAST_SIDE);
    expect(tasks.length % 2).toBe(0);
    expect(tasks.filter((t) => t.pat === A)).toHaveLength(tasks.length / 2);
    expect(tasks.filter((t) => t.pat === B)).toHaveLength(tasks.length / 2);
    for (let k = 2; k < tasks.length; k++) expect(!(tasks[k]?.pat === tasks[k - 1]?.pat && tasks[k]?.pat === tasks[k - 2]?.pat), `Lauf bei ${k}`).toBe(true);
    expect(new Set(tasks.map((t) => t.key)).size).toBe(tasks.length);
  });

  it('ungesehene Aufgaben zuerst, gesehene erst danach', () => {
    registerC1Items([...itemsA, ...itemsB]);
    const seenKeys = [...itemsA.slice(0, 2), ...itemsB.slice(0, 2)].map((i) => c1Key(i.id));
    const withSeen = new Map<string, Record<string, unknown>>([['articles', { seen: seenKeys }]]);
    const tasks = contrastTasks({ a: A, b: B }, { grammarDocs: withSeen, seed: 's1' });
    // Es gibt auf beiden Seiten mindestens drei ungesehene c1x-Aufgaben: die Runde besteht nur aus ungesehenen c1x-Aufgaben dieser Items.
    const fromItems = tasks.filter((t) => t.key.startsWith('c1:'));
    expect(fromItems.length).toBeGreaterThan(0);
    for (const t of fromItems) expect(seenKeys).not.toContain(t.key);
  });

  it('stabil für denselben Startwert, anders für einen anderen', () => {
    registerC1Items([...itemsA, ...itemsB]);
    const keys = (seed: string) => contrastTasks({ a: A, b: B }, { grammarDocs: docs, seed }).map((t) => t.key);
    expect(keys('x')).toEqual(keys('x'));
    expect([keys('y'), keys('z'), keys('w')].some((k) => JSON.stringify(k) !== JSON.stringify(keys('x')))).toBe(true);
  });

  it('weniger als drei Aufgaben auf einer Seite: keine Runde; gleiches Muster zweimal: keine Runde', () => {
    // Muster ohne Aufgaben in den Inhalten (nur ein Platz in der Kontrastfamilie).
    registerC1Items(itemsA);
    const counts = contrastSideCounts(A, 'dip.wondering', docs);
    expect(counts[0]).toBeGreaterThanOrEqual(5);
    if (counts[1] < MIN_SIDE) expect(contrastTasks({ a: A, b: 'dip.wondering' }, { grammarDocs: docs, seed: 's' })).toEqual([]);
    expect(contrastTasks({ a: A, b: A }, { grammarDocs: docs, seed: 's' })).toEqual([]);
  });

  it('gemeldete Aufgaben (bad) bleiben draußen', () => {
    registerC1Items([...itemsA, ...itemsB]);
    const bad = new Set(itemsA.map((i) => i.id));
    const [a] = contrastSideCounts(A, B, docs, bad);
    const [all] = contrastSideCounts(A, B, docs);
    expect(a).toBeLessThan(all);
  });

  it('mixOrder: ausgewogen, höchstens zwei gleiche in Folge, für jeden Startwert; nicht immer dieselbe Reihenfolge', () => {
    const seen = new Set<string>();
    for (let k = 0; k < 60; k++) {
      const o = mixOrder(4, `s${k}`);
      expect(o.filter((x) => x === 'A')).toHaveLength(4);
      for (let j = 2; j < o.length; j++) expect(o[j] === o[j - 1] && o[j] === o[j - 2]).toBe(false);
      seen.add(o.join(''));
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
