import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { useLive } from '../../src/data/live';
import { emptyC1, type C1Check } from '../../src/domain/c1/c1doc';
import { appendCheckFc, checkClash, checkOutcome } from '../../src/domain/c1/check/save';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import type { Db } from '../../src/platform/types';

// C1-Check speichern, Befunde data-guard zu P40: ehrliches Ergebnis statt `unchanged` = gespeichert (Sollte 1), Prognose nie aus Lesefehlern (Sollte 2),
// `fc` am neuen Eintrag (Sollte 3), `saveRepairs` meldet einen nicht geschriebenen Stand (Sollte 4).

const holder = vi.hoisted(() => ({ writer: null as Writer | null, db: null as Db | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));
vi.mock('../../src/domain/c1x/preload', async (orig) => ({ ...(await orig<Record<string, unknown>>()), preloadC1x: () => Promise.resolve() }));

const { saveCheck } = await import('../../src/domain/c1/check/save');
const { saveRepairs } = await import('../../src/features/repair/store');
const { checkFcFor } = await import('../../src/features/c1/check/forecast');
const { flags } = await import('../../src/app/flags');

const entry = (o: Partial<C1Check>): C1Check => ({ d: '2026-10-28', f: 'A', inp: 'desk', p: [8, 8, 8, 12], pts: 36, max: 36, ...o });
const c1Of = (h: MemoryDbHandle) => h.dump()['app/c1'] as { checks?: C1Check[] } | undefined;

let h: MemoryDbHandle;
function setup(seed: Record<string, Record<string, unknown>> = {}) {
  h = createMemoryDb({ seed });
  holder.db = h.db;
  holder.writer = createWriter(h.db);
}

beforeEach(() => {
  setup();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  holder.writer = null;
  holder.db = null;
});

describe('saveCheck: ehrliches Ergebnis', () => {
  it('neu → ok; derselbe Check (zweiter Tab) → ok mit present; Laptop-Form schon benutzt → rejected, nichts geschrieben', async () => {
    expect(await saveCheck(entry({}))).toEqual({ ok: true, r: 'created' });
    expect(await saveCheck(entry({ pts: 20 }))).toEqual({ ok: true, r: 'unchanged', present: true });
    const before = JSON.stringify(c1Of(h));
    expect(await saveCheck(entry({ d: '2026-11-25' }))).toEqual({ ok: false, r: 'unchanged', why: 'rejected' });
    expect(JSON.stringify(c1Of(h))).toBe(before);
    // Handy darf dieselbe Form an einem anderen Tag
    expect((await saveCheck(entry({ d: '2026-11-25', inp: 'touch' }))).ok).toBe(true);
    expect(c1Of(h)?.checks?.length).toBe(2);
  });
  it('unlesbares app/c1 → blocked (nie angefasst)', async () => {
    setup({ 'app/c1': { v: 1, checks: 'kaputt' } });
    expect(await saveCheck(entry({}))).toEqual({ ok: false, r: 'unchanged', why: 'blocked' });
    expect(c1Of(h)?.checks).toBe('kaputt');
  });
  it('Schreibfehler → failed; ohne Datenbank → unavailable', async () => {
    h.setFailWrites('quota_exceeded');
    expect(await saveCheck(entry({}))).toMatchObject({ ok: false, why: 'failed' });
    holder.writer = null;
    expect(await saveCheck(entry({}))).toMatchObject({ ok: false, why: 'unavailable' });
  });
  it('checkClash und checkOutcome (rein)', () => {
    const doc = { ...emptyC1(), checks: [entry({})] };
    expect(checkClash(doc, entry({}))).toBe('present');
    expect(checkClash(doc, entry({ d: '2026-11-25' }))).toBe('rejected');
    expect(checkClash(doc, entry({ inp: 'touch' }))).toBeNull();
    expect(checkOutcome('unchanged', 'appended')).toEqual({ ok: false, r: 'unchanged', why: 'blocked' });
    expect(checkOutcome('unchanged', null)).toEqual({ ok: false, r: 'unchanged', why: 'blocked' });
    expect(checkOutcome('updated', 'appended')).toEqual({ ok: true, r: 'updated' });
  });
});

describe('Prognose am neuen Eintrag', () => {
  it('Handy- und Laptop-Check am selben Tag: fc landet am Laptop-Check (dem neuen), nicht am Handy-Check', () => {
    const fc = { from: '2027-03', to: '2027-06', late: '2027-09' };
    const doc = { ...emptyC1(), checks: [entry({ d: '2026-08-29', f: 'A' }), entry({ d: '2026-09-26', f: 'B' }), entry({ d: '2026-10-31', f: 'B', inp: 'touch' })] };
    const next = appendCheckFc(doc, entry({ d: '2026-10-31', f: 'C' }), () => fc);
    expect(next?.checks[2]?.fc).toBeUndefined();
    expect(next?.checks[3]?.fc).toEqual(fc);
  });
});

describe('checkFcFor: nie aus Lesefehlern', () => {
  const live = () => useLive.setState({ day: null, docs: { 'app/c1': { v: 1, checks: [entry({ d: '2026-08-29' }), entry({ d: '2026-09-26', f: 'B' })], gates: [], prod: [], bad: [] } }, collections: {} });
  it('fehlende Dokumente sind erlaubt, ein geworfener Lesefehler heißt keine Prognose', async () => {
    const wasWay = flags.way;
    flags.way = true;
    try {
      live();
      expect(typeof (await checkFcFor('2026-10-28', Date.parse('2026-10-28T09:00:00+01:00')))).toBe('function');
      const real = h.db;
      holder.db = { ...real, doc: (p: string) => (p === 'app/patterns' ? { ...real.doc(p), get: () => Promise.reject(new Error('Lesefehler')) } : real.doc(p)) };
      expect(await checkFcFor('2026-10-28', Date.parse('2026-10-28T09:00:00+01:00'))).toBeNull();
    } finally {
      flags.way = wasWay;
    }
  });
});

describe('saveRepairs ehrlich', () => {
  it('unerwarteter Aufbau von app/repair → false, nichts geschrieben', async () => {
    setup({ 'app/repair': { items: 'kaputt' } });
    expect(await saveRepairs([{ wrong: 'He go.', right: 'He goes.', why: 'x', src: 'check' }])).toBe(false);
    expect((h.dump()['app/repair'] as { items: unknown }).items).toBe('kaputt');
    setup();
    expect(await saveRepairs([{ wrong: 'He go.', right: 'He goes.', why: 'x', src: 'check' }])).toBe(true);
  });
});
