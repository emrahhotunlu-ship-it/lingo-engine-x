import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWriter, type Writer } from '../../src/data/writer';
import { archivesCover, compactPlan, mergeArchives, profileWithout } from '../../src/domain/capacity/compact';
import { docCount, profileSize, PROFILE_COMPACT_BYTES } from '../../src/domain/capacity/profileSize';
import { addDays, dayKey, legacyDayKey } from '../../src/domain/date';
import { computeStreak, pflichtDays } from '../../src/domain/streak';
import { createMemoryDb, type MemoryDbHandle } from '../../src/platform/dev/memoryDb';
import { berlin, loadSeed } from './helpers';

// Profil-Wachstum (Plan §12.3, P7-3): Messung, Auslagern alter Jahre ohne Verlust.

const holder = vi.hoisted((): { writer: Writer | null; db: unknown } => ({ writer: null, db: null }));
vi.mock('../../src/data', () => ({ getWriter: () => holder.writer }));
vi.mock('../../src/platform/capabilities', async (orig) => ({ ...(await orig<Record<string, unknown>>()), getDb: () => holder.db }));

const { runCompact } = await import('../../src/features/settings/compactRun');

const seed = loadSeed();
const today = '2026-09-20';

/** Profil mit drei Jahren Tageskarten (2023 bis heute) und einer lückenlosen Serie von 900 Tagen. */
function bigProfile(): Record<string, unknown> {
  const days: Record<string, number> = {};
  const xpDays: Record<string, number> = {};
  const minutes: Record<string, number> = {};
  const act: Record<string, Record<string, number>> = {};
  for (let k = 0; k < 1100; k++) {
    const d = addDays(today, -k);
    days[d] = 20 + (k % 7);
    xpDays[d] = 100 + k;
    minutes[d] = 15;
    act[d] = { cards: 1, gram: k % 3 };
  }
  return { ...seed['app/profile'], days, xpDays, minutes, act, pflicht: { [today]: 1 } };
}

const MATRIX = [berlin('2026-09-20', 21), berlin('2026-09-21', 0, 30), berlin('2026-09-21', 4, 30)];
const streakAt = (p: Record<string, unknown>, now: number) =>
  computeStreak({ days: p.days as Record<string, number>, xpDays: p.xpDays as Record<string, number>, pflichtSince: null, pflichtDone: pflichtDays(p.pflicht), today: dayKey(now), legacyToday: legacyDayKey(now) }).count;

describe('Messung', () => {
  it('Bytes, Zuwachs der letzten 90 Tage, Prognose; Dokumentzahl', () => {
    const s = profileSize(bigProfile(), today);
    expect(s.bytes).toBeGreaterThan(50_000);
    expect(s.grow90).toBeGreaterThan(0);
    expect(s.yearsLeft).not.toBeNull();
    expect(profileSize({}, today).yearsLeft).toBeNull();
    expect(docCount({ app: 8, vocab: 3990, grammar: 16 })).toMatchObject({ total: 4014, warn: true });
  });
});

describe('Auslagerungsplan (rein)', () => {
  it('nur Jahre ≤ laufendes Jahr − 2; Profil ⊕ Archive = Original; Serie vorher = nachher', () => {
    const p = bigProfile();
    const plan = compactPlan(p, today, 1);
    expect(plan.years).toEqual([2023, 2024]);
    const slim = profileWithout(p, plan);
    expect(Object.keys(slim.days as object).every((d) => d >= '2025-01-01')).toBe(true);
    const merged = mergeArchives(slim, Object.values(plan.archives));
    for (const k of ['days', 'xpDays', 'minutes', 'act'] as const) expect(merged[k]).toEqual(p[k]);
    expect(archivesCover(p, plan, plan.archives)).toBe(true);
    for (const now of MATRIX) expect(streakAt(merged, now)).toBe(streakAt(p, now));
    expect(streakAt(p, MATRIX[0]!)).toBeGreaterThan(700);
  });
});

describe('Ablauf mit der Speicher-Datenbank', () => {
  let h: MemoryDbHandle;
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });
  const setup = (docs: Record<string, Record<string, unknown>>) => {
    h = createMemoryDb({ seed: docs });
    holder.db = h.db;
    holder.writer = createWriter(h.db);
  };

  it('archiviert, prüft, ersetzt das Profil; nichts geht verloren', async () => {
    const p = bigProfile();
    setup({ 'app/profile': p });
    const r = await runCompact(today, 1, 0);
    expect(r.status).toBe('done');
    const all = h.dump();
    expect(Object.keys(all).filter((k) => k.startsWith('archive/')).sort()).toEqual(['archive/profile-2023', 'archive/profile-2024']);
    const merged = mergeArchives(all['app/profile'], [all['archive/profile-2023']!, all['archive/profile-2024']!]);
    for (const k of ['days', 'xpDays', 'minutes', 'act'] as const) expect(merged[k]).toEqual(p[k]);
    expect(merged.plan).toEqual(p.plan);
    expect(JSON.stringify(all['app/profile']).length).toBeLessThan(JSON.stringify(p).length);
    for (const now of MATRIX) expect(streakAt(merged, now)).toBe(streakAt(p, now));
    // Zweiter Lauf: nichts mehr zu tun.
    expect((await runCompact(today, 2, 0)).status).toBe('nothing');
  });

  it('weicht ein vorhandenes Archiv ab, bricht es ab – das Profil bleibt unverändert', async () => {
    const p = bigProfile();
    setup({ 'app/profile': p, 'archive/profile-2023': { v: 1, year: 2023, days: { '2023-12-31': 999 } } });
    const r = await runCompact(today, 1, 0);
    expect(r).toMatchObject({ status: 'failed', reason: 'archive_differs' });
    expect(h.dump()['app/profile']).toEqual(p);
  });

  it('unter der Schwelle geschieht nichts; ein ungültiges Profil wird nie angefasst', async () => {
    const p = bigProfile();
    setup({ 'app/profile': p });
    expect(JSON.stringify(p).length).toBeLessThan(PROFILE_COMPACT_BYTES);
    expect((await runCompact(today, 1)).status).toBe('nothing');
    const bad = { ...p, days: 'kaputt' };
    setup({ 'app/profile': bad });
    expect((await runCompact(today, 1, 0)).status).toBe('failed');
    expect(h.dump()['app/profile']).toEqual(bad);
    expect(Object.keys(h.dump()).some((k) => k.startsWith('archive/'))).toBe(false);
  });

  it('writer.compact ist nur für app/profile erlaubt', async () => {
    setup({ 'app/course': { done: {} } });
    await expect(holder.writer!.compact('app/course', () => ({}))).rejects.toMatchObject({ code: 'invalid_argument' });
  });
});
