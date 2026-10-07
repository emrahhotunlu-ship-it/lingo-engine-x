// Auswahl der Art und der Aufgabe (Lernplattform 3.0 §3.3, §2.10, P13).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pilotKwt from '../../src/content/c1x/src/pilot/kwt.json';
import { flags } from '../../src/app/flags';
import { c1Item } from '../../src/domain/c1x/schema';
import { c1Items, preloadC1x, registerC1Items, resetC1Store } from '../../src/domain/c1x/preload';
import { defaultKinds, itemsFor, pickUnseen, trainable, unseenCount, wantKinds } from '../../src/domain/c1x/select';
import type { C1Item, C1Kind } from '../../src/domain/c1x/types';
import { resetPackedCache } from '../../src/content/store';

const ALL = new Set<C1Kind>(['mcc', 'ocl', 'wf', 'kwt', 'err', 'pair', 'cnet', 'reg', 'para']);
const kwt = (over: Record<string, unknown>): C1Item => c1Item.parse({ ...pilotKwt.items[0], ...over });

beforeEach(() => {
  for (const k of Object.keys(flags.c1xKinds) as C1Kind[]) flags.c1xKinds[k] = false;
  resetC1Store();
  resetPackedCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of Object.keys(flags.c1xKinds) as C1Kind[]) flags.c1xKinds[k] = false;
});

describe('wantKinds', () => {
  it('nach Stufe und Gerät (§3.3/§2.10)', () => {
    expect(wantKinds(0.2, 'touch', null, ALL)).toEqual(['mcc', 'pair', 'err', 'cnet']);
    expect(wantKinds(0.55, 'touch', null, ALL)).toEqual(['ocl', 'wf', 'kwt', 'reg']);
    expect(wantKinds(0.9, 'touch', null, ALL)).toEqual(['err', 'para', 'kwt', 'ocl']);
    expect(wantKinds(0.9, 'desk', null, ALL)).toEqual(['kwt', 'reg', 'para', 'err']);
    expect(defaultKinds(0.4, 'desk')).toEqual(['ocl', 'wf', 'kwt', 'reg']);
    expect(defaultKinds(0.7, 'desk')).toEqual(['ocl', 'wf', 'kwt', 'reg']);
    expect(defaultKinds(0.71, 'desk')[0]).toBe('kwt');
  });

  it('nur eingeschaltete Arten (Funktionsschalter), sonst leer', () => {
    expect(wantKinds(0.55, 'desk')).toEqual([]);
    flags.c1xKinds.kwt = true;
    expect(wantKinds(0.55, 'desk')).toEqual(['kwt']);
    flags.c1xKinds.err = true;
    expect(wantKinds(0.9, 'touch')).toEqual(['err', 'kwt']);
  });

  it('das Muster darf die Arten einschränken (Feld kinds); ein Muster ohne Feld erlaubt alle', () => {
    // pp.personal hat (noch) kein Feld `kinds`: alle Arten bleiben.
    expect(wantKinds(0.9, 'desk', 'pp.personal', ALL)).toEqual(['kwt', 'reg', 'para', 'err']);
    expect(wantKinds(0.9, 'desk', 'gibt.es.nicht', ALL)).toEqual(['kwt', 'reg', 'para', 'err']);
  });
});

describe('Speicher und Auswahl', () => {
  it('preloadC1x lädt die gepackten Bündel und die LP2-Aufgaben; je Art einmal', async () => {
    await preloadC1x(['kwt', 'err']);
    const kwtN = c1Items('kwt').length;
    expect(kwtN).toBeGreaterThan(300); // 397 LP2 + Pilot + Inhalte
    expect(c1Items('kwt').some((i) => i.id === 'kwt-9001')).toBe(true);
    expect(c1Items('kwt').some((i) => i.id.startsWith('kwt-v2-'))).toBe(true);
    expect(c1Items('err').some((i) => i.id === 'err-9003')).toBe(true);
    await preloadC1x(['kwt']);
    expect(c1Items('kwt')).toHaveLength(kwtN);
    expect(c1Items('ocl')).toEqual([]);
  });

  it('ohne DecompressionStream laufen nur die LP2-Aufgaben (Meldung, kein Absturz)', async () => {
    vi.stubGlobal('DecompressionStream', undefined);
    await preloadC1x(['kwt', 'err', 'ocl']);
    const k = c1Items('kwt');
    expect(k.length).toBeGreaterThan(300);
    expect(k.every((i) => i.id.startsWith('kwt-v2-'))).toBe(true);
    expect(c1Items('ocl')).toEqual([]);
    expect(wantKinds(0.55, 'desk', null, ALL)).toEqual(['ocl', 'wf', 'kwt', 'reg']);
  });

  it('pickUnseen: Muster und Art, ungesehen, ohne used/bad, stabil je Startwert', async () => {
    await preloadC1x(['kwt']);
    const a = pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen: new Set(), seed: 's1' });
    expect(a?.pat).toBe('pp.personal');
    expect(pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen: new Set(), seed: 's1' })?.id).toBe(a?.id);
    const seen = new Set([`c1:${a?.id}`]);
    const b = pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen, seed: 's1' });
    expect(b?.id).not.toBe(a?.id);
    expect(pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen, seed: 's1', allowSeen: true })).not.toBeNull();
    expect(pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen: new Set(), used: new Set([`c1:${a?.id}`]), seed: 's1' })?.id).not.toBe(a?.id);
    expect(pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen: new Set(), bad: new Set([a?.id as string]), seed: 's1' })?.id).not.toBe(a?.id);
    expect(pickUnseen({ pat: 'xx.keins', kind: 'kwt', seen: new Set(), seed: 's1' })).toBeNull();
  });

  it('Check-, Prüfungs- und Einstufungsaufgaben und gemeldete erscheinen nie (select.ts)', () => {
    const probe = kwt({ id: 'kwt-0901', probe: true });
    const gate = kwt({ id: 'kwt-0902', pool: 'gate' });
    const place = kwt({ id: 'kwt-0903', pool: 'place' });
    const flagged = kwt({ id: 'kwt-0904' });
    const fine = kwt({ id: 'kwt-0905' });
    registerC1Items([probe, gate, place, flagged, fine]);
    expect(trainable(probe) || trainable(gate) || trainable(place)).toBe(false);
    expect(trainable(flagged, new Set(['kwt-0904']))).toBe(false);
    const picked = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const it = pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen: new Set([...picked].map((x) => `c1:${x}`)), bad: new Set(['kwt-0904']), seed: `x${i}` });
      if (it) picked.add(it.id);
    }
    expect([...picked].some((id) => ['kwt-0901', 'kwt-0902', 'kwt-0903', 'kwt-0904'].includes(id))).toBe(false);
    expect(picked.has('kwt-0905')).toBe(true);
    expect(itemsFor('pp.personal').some((i) => i.id === 'kwt-0901')).toBe(false);
    expect(unseenCount('pp.personal', 'kwt', new Set(), new Set(['kwt-0904']))).toBe(c1Items('kwt').filter((i) => i.pat === 'pp.personal' && i.id !== 'kwt-0901' && i.id !== 'kwt-0902' && i.id !== 'kwt-0903' && i.id !== 'kwt-0904').length);
  });

  it('Gleichstand-Brecher: ein Lemma aus wordsToday gewinnt', () => {
    const plain = kwt({ id: 'kwt-0911', pat: 'pp.personal' });
    const withWord = kwt({ id: 'kwt-0912', lex: ['headquarters'] });
    registerC1Items([plain, withWord]);
    for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
      const pick = pickUnseen({ pat: 'pp.personal', kind: 'kwt', seen: new Set(c1Items('kwt').filter((i) => i.id !== 'kwt-0911' && i.id !== 'kwt-0912').map((i) => `c1:${i.id}`)), seed, wordsToday: ['headquarters'] });
      expect(pick?.id).toBe('kwt-0912');
    }
  });
});
