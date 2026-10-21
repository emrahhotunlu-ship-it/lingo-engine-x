import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { effectiveGate, gateReviewPatch, gateStatus, QUARANTINE_DAYS, readGate, reviewFault, sbWaiting, type SbGate } from '../../src/domain/tutor/sentenceBank';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';

// Satzbank-Freigabe (Einstellungen › KI-Stichprobe, 21.10.2026): Befund der Lehrer-Stichprobe eintragen. Ein Schreibweg
// (`writer.transform('app/profile')`), nur bei Änderung, nie bei ungültigem Profil oder unbekannter Form des Schalters.

type Doc = Record<string, unknown>;
const holder = vi.hoisted(() => ({ writer: null as Writer | null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));

const store = await import('../../src/features/vocab/sentenceBank');

const DAY = 86_400_000;
const NOW = Date.parse('2026-10-21T10:00:00+02:00');
const T0 = NOW - 30 * DAY;

describe('Stand und Fehlergründe', () => {
  it('gateStatus: ehrlich, was erfüllt ist und was fehlt', () => {
    const early = gateStatus({ start: NOW - 10 * DAY, on: false }, NOW, 12);
    expect(early).toMatchObject({ quarantineOver: false, daysLeft: QUARANTINE_DAYS - 10, sampleN: 12, on: false, review: null, passes: null });
    expect(early.releaseFrom).toBe(NOW - 10 * DAY + QUARANTINE_DAYS * DAY);
    expect(gateStatus({ start: null, on: false }, NOW, 0)).toMatchObject({ start: null, releaseFrom: null, quarantineOver: false });
    const done = gateStatus({ start: T0, on: true, checkedAt: NOW, review: { hard: 1, unclear: 2 } }, NOW, 30);
    expect(done).toMatchObject({ quarantineOver: true, daysLeft: 0, on: true, passes: true });
    expect(gateStatus({ start: T0, on: false, checkedAt: NOW, review: { hard: 2, unclear: 0 } }, NOW, 30).passes).toBe(false);
  });

  it('reviewFault: erst nach Sammelzeit, mit Stichprobe, ganze Zahlen, nicht mehr als die Stichprobe', () => {
    const g: SbGate = { start: T0, on: false };
    expect(reviewFault({ start: null, on: false }, NOW, { hard: 0, unclear: 0 }, 30)).toBe('no_start');
    expect(reviewFault({ start: NOW - 27 * DAY, on: false }, NOW, { hard: 0, unclear: 0 }, 30)).toBe('too_early');
    expect(reviewFault(g, NOW, { hard: 0, unclear: 0 }, 0)).toBe('no_sample');
    expect(reviewFault(g, NOW, { hard: -1, unclear: 0 }, 30)).toBe('bad_count');
    expect(reviewFault(g, NOW, { hard: 1.5, unclear: 0 }, 30)).toBe('bad_count');
    expect(reviewFault(g, NOW, { hard: 3, unclear: 2 }, 4)).toBe('over_sample');
    expect(reviewFault(g, NOW, { hard: 1, unclear: 2 }, 30)).toBeNull();
  });

  it('gateReviewPatch: on nur bei bestandener Schwelle, fremde Felder bleiben, derselbe Befund am selben Tag ist nichts Neues', () => {
    const raw = { start: T0, on: false, extra: 'bleibt' };
    const pass = gateReviewPatch(raw, NOW, { hard: 1, unclear: 2 }, 30);
    expect(pass).toEqual({ start: T0, on: true, checkedAt: NOW, review: { hard: 1, unclear: 2 }, extra: 'bleibt' });
    expect(effectiveGate(readGate(pass)).on).toBe(true);
    expect(gateReviewPatch(raw, NOW, { hard: 2, unclear: 0 }, 30)).toMatchObject({ on: false, review: { hard: 2, unclear: 0 } });
    expect(gateReviewPatch(pass, NOW + 1000, { hard: 1, unclear: 2 }, 30)).toBeNull();
    expect(gateReviewPatch(pass, NOW + DAY, { hard: 1, unclear: 2 }, 30)).toMatchObject({ on: true, checkedAt: NOW + DAY });
    expect(gateReviewPatch({ start: NOW - DAY, on: false }, NOW, { hard: 0, unclear: 0 }, 30)).toBeNull();
  });

  it('sbWaiting: Claude-Sätze, deren eigene 4 Wochen noch laufen (ohne gemeldete und Lesetext-Sätze)', () => {
    const s = (t: number, over: Doc = {}) => ({ en: 'A sentence about the budget for the next quarter.', de: 'Ein Satz.', sit: 'meeting', k: 'work', src: 'ai', t, pv: 'word-bank@1', ...over });
    const vocab = new Map<string, Doc>([['a', { word: 'a', sb: [s(NOW - DAY), s(NOW - 40 * DAY), s(NOW - DAY, { bad: 1 }), s(NOW, { src: 'read', pv: 'read:a' })] }]]);
    expect(sbWaiting(vocab, NOW)).toBe(1);
    expect(sbWaiting(undefined, NOW)).toBe(0);
  });
});

describe('Schreibweg saveGateReview', () => {
  let h: MemoryDbHandle;
  beforeEach(() => {
    h = createMemoryDb({ seed: { 'app/profile': { name: 'Test', days: {}, sbGate: { start: T0 } } } });
    holder.writer = createWriter(h.db);
  });
  const gate = (): Doc => (h.dump()['app/profile'] as Doc).sbGate as Doc;

  it('bestandener Befund gibt frei; derselbe Befund noch einmal schreibt nichts; übrige Profilfelder bleiben', async () => {
    expect(await store.saveGateReview({ hard: 0, unclear: 1 }, 30, NOW)).toEqual({ r: 'released' });
    expect(gate()).toEqual({ start: T0, on: true, checkedAt: NOW, review: { hard: 0, unclear: 1 } });
    expect((h.dump()['app/profile'] as Doc).name).toBe('Test');
    const n = h.writes().length;
    expect(await store.saveGateReview({ hard: 0, unclear: 1 }, 30, NOW + 60_000)).toEqual({ r: 'same' });
    expect(h.writes().length).toBe(n);
    expect(h.writes().every((w) => w.op === 'update')).toBe(true);
  });

  it('Befund über der Schwelle: eingetragen, die Bank bleibt zu', async () => {
    expect(await store.saveGateReview({ hard: 2, unclear: 0 }, 30, NOW)).toEqual({ r: 'closed' });
    expect(gate()).toMatchObject({ on: false, review: { hard: 2, unclear: 0 }, checkedAt: NOW });
  });

  it('zu früh, ohne Stichprobe, ungültig: nichts geschrieben', async () => {
    h.load({ 'app/profile': { name: 'Test', days: {}, sbGate: { start: NOW - 5 * DAY } } });
    expect(await store.saveGateReview({ hard: 0, unclear: 0 }, 30, NOW)).toEqual({ r: 'fault', fault: 'too_early' });
    h.load({ 'app/profile': { name: 'Test', days: {}, sbGate: { start: T0 } } });
    expect(await store.saveGateReview({ hard: 0, unclear: 0 }, 0, NOW)).toEqual({ r: 'fault', fault: 'no_sample' });
    h.load({ 'app/profile': { name: 'Test', days: {}, sbGate: 'kaputt' } });
    expect(await store.saveGateReview({ hard: 0, unclear: 0 }, 30, NOW)).toEqual({ r: 'invalid' });
    h.load({});
    expect(await store.saveGateReview({ hard: 0, unclear: 0 }, 30, NOW)).toEqual({ r: 'invalid' });
    expect(h.dump()['app/profile']).toBeUndefined();
    expect(h.writes()).toEqual([]);
  });
});
