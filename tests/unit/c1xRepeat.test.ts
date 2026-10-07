// Die Fehlerschleife der c1x-Aufgaben (Lernplattform 3.0 §3.4, P13): derselbe Baustein, ungesehene Aufgabe gleicher Art, andere Art, produktive Art.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { flags } from '../../src/app/flags';
import examples from '../fixtures/c1x/examples.json';
import { dueErrors } from '../../src/domain/grammar/errors';
import { c1Item } from '../../src/domain/c1x/schema';
import { registerC1Items, resetC1Store } from '../../src/domain/c1x/preload';
import { repeatPick, SAME_AGAIN_DAYS, type RepeatCtx } from '../../src/domain/c1x/repeat';
import { toTask } from '../../src/domain/c1x/runtime';
import type { C1Item } from '../../src/domain/c1x/types';
import { berlin } from './helpers';

const fx = (id: string): Record<string, unknown> => JSON.parse(JSON.stringify((examples.items as Array<Record<string, unknown>>).find((i) => i.id === id))) as Record<string, unknown>;
const make = (id: string, base: string, over: Record<string, unknown>): C1Item => c1Item.parse({ ...fx(base), id, ...over });

const PAT = { pat: 'em.neg-inversion', topic: 'c1-emphasis' };
const ocl1 = make('ocl-0801', 'ocl-0001', {});
const ocl2 = make('ocl-0802', 'ocl-0001', { text: 'Rarely ___ we see such a quick turnaround in this market.', accept: ['do'], chips: ['did', 'have', 'are'] });
const ocl3 = make('ocl-0803', 'ocl-0001', { text: 'Never ___ I seen a contract that was so one-sided before.', accept: ['have'], chips: ['had', 'did', 'was'] });
const kwtA = make('kwt-0801', 'kwt-0001', { ...PAT, id: 'kwt-0801' });
const NOW = berlin('2026-10-10', 12);
const ctx = (over: Partial<RepeatCtx> = {}): RepeatCtx => ({ seen: new Set(), seed: 'r', nowMs: NOW, inp: 'desk', p: 0.55, ...over });
const entry = (cid: string, over: Record<string, unknown> = {}) => ({ cid, box: 0, t: berlin('2026-10-09', 10), pat: 'em.neg-inversion', ...over });

beforeEach(() => {
  resetC1Store();
  registerC1Items([ocl1, ocl2, ocl3, kwtA]);
  flags.c1xKinds.ocl = true;
  flags.c1xKinds.kwt = true;
});
afterEach(() => {
  flags.c1xKinds.ocl = false;
  flags.c1xKinds.kwt = false;
});

describe('repeatPick', () => {
  it('Box 0: derselbe Baustein, dieselbe Aufgabe', () => {
    expect(repeatPick(entry('ocl-0801'), ctx())).toMatchObject({ how: 'same', item: { id: 'ocl-0801' } });
  });

  it('Box 1: eine ungesehene Aufgabe derselben Art und desselben Musters (nie die eigene)', () => {
    const r = repeatPick(entry('ocl-0801', { box: 1 }), ctx());
    expect(r?.how).toBe('sameKind');
    expect(r?.item.kind).toBe('ocl');
    expect(r?.item.id).not.toBe('ocl-0801');
    expect(r?.item.pat).toBe('em.neg-inversion');
    // gesehene werden übersprungen
    const only = repeatPick(entry('ocl-0801', { box: 1 }), ctx({ seen: new Set(['c1:ocl-0802']) }));
    expect(only?.item.id).toBe('ocl-0803');
  });

  it('keine ungesehene gleicher Art: eine andere Art desselben Musters', () => {
    const r = repeatPick(entry('ocl-0801', { box: 1 }), ctx({ seen: new Set(['c1:ocl-0802', 'c1:ocl-0803']) }));
    expect(r?.how).toBe('otherKind');
    expect(r?.item.kind).toBe('kwt');
    expect(r?.item.pat).toBe('em.neg-inversion');
  });

  it('nichts Neues da: dieselbe Aufgabe frühestens nach 14 Tagen', () => {
    const all = new Set(['c1:ocl-0802', 'c1:ocl-0803', 'c1:kwt-0801']);
    const early = repeatPick(entry('ocl-0801', { box: 1, last: berlin('2026-10-05', 10) }), ctx({ seen: all }));
    expect(early?.how === 'same' || early === null).toBe(true);
    // letzte Antwort vor 5 Tagen: noch nicht
    expect(repeatPick(entry('ocl-0801', { box: 1, last: berlin('2026-10-05', 10) }), ctx({ seen: all, nowMs: berlin('2026-10-10', 12) }))?.how).not.toBe('same');
    // vor mehr als 14 Tagen: ja
    const later = repeatPick(entry('ocl-0801', { box: 1, last: berlin('2026-09-20', 10) }), ctx({ seen: all }));
    expect(later).toMatchObject({ how: 'same', item: { id: 'ocl-0801' } });
    expect(SAME_AGAIN_DAYS).toBe(14);
  });

  it('Box ab 2: die produktive Art (ocl oder kwt, getippt) desselben Musters', () => {
    const r = repeatPick(entry('ocl-0801', { box: 2 }), ctx({ seen: new Set(['c1:ocl-0802']) }));
    expect(['ocl', 'kwt']).toContain(r?.item.kind);
    expect(r?.how).toBe('productive');
  });

  it('nicht aufzulösen (Aufgabe unbekannt oder kein cid) → null (dann gilt der Fehlersatz-Text)', () => {
    expect(repeatPick(entry('ocl-0999'), ctx())).toBeNull();
    expect(repeatPick({ box: 0 }, ctx())).toBeNull();
  });
});

describe('dueErrors mit c1x-Auflösung', () => {
  const docs = new Map<string, Record<string, unknown>>([
    ['c1-emphasis', { errors: [{ q: 'Hardly ___ we signed the contract when the client asked for changes.', ans: 'had', t: berlin('2026-10-08', 10), box: 0, cid: 'ocl-0801', pat: 'em.neg-inversion', pts: [0, 1] }] }],
  ]);

  it('ein Fehler mit cid kommt als c1x-Aufgabe zurück, sonst als alter Fehlersatz', () => {
    const withResolver = dueErrors(docs, NOW, (topic, e) => {
      const r = repeatPick(e, ctx());
      return r ? toTask(r.item, { errorT: e.t as number, ref: `grammar/${topic}` }) : null;
    });
    expect(withResolver).toHaveLength(1);
    expect(withResolver[0]?.task.c1?.id).toBe('ocl-0801');
    expect(withResolver[0]?.task.errorT).toBe(berlin('2026-10-08', 10));
    const without = dueErrors(docs, NOW);
    expect(without[0]?.task.c1).toBeUndefined();
    expect(without[0]?.task.src).toBe('review');
    // Auflösung scheitert → Rückfall auf den Fehlersatz-Text
    const fallback = dueErrors(docs, NOW, () => null);
    expect(fallback[0]?.task.src).toBe('review');
  });
});
