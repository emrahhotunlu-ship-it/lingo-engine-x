import { describe, expect, it } from 'vitest';
import { createMemoryDb } from '../../src/platform/dev/memoryDb';
import { createWriter } from '../../src/data/writer';
import { loadSnapshot, snapshotFromRecord } from '../../src/data/snapshot';
import { applyMigrationV1, planMigrationV1, SCHEMA_VERSION } from '../../src/domain/migration/v1';
import { addDays } from '../../src/domain/date';
import { legacyStreak } from '../../src/domain/streak';
import { berlin, loadSeed, SEED_ANCHOR, type Doc } from './helpers';

const NO_LOCAL = { dirty: {}, docs: {} };
const count = (all: Record<string, Doc>, prefix: string) => Object.keys(all).filter((k) => k.startsWith(prefix)).length;

async function migrate(seed: Record<string, Doc>, nowMs: number, local = NO_LOCAL) {
  const h = createMemoryDb({ seed });
  const snapshot = await loadSnapshot(h.db);
  const plan = planMigrationV1({ snapshot, local, nowMs });
  const writesAfterDryRun = h.writes().length;
  const res = await applyMigrationV1(plan, { db: h.db, writer: createWriter(h.db), holder: 't1', nowMs: () => nowMs });
  return { h, plan, res, writesAfterDryRun, after: h.dump() };
}

describe('Umstellung auf Datenversion 1 (Kap. 9)', () => {
  // Nicht nur „heute": mehrere Zeitpunkte relativ zum Stichtag der Testdaten (Kap. 15).
  const moments: Array<[string, number]> = [
    [SEED_ANCHOR, 21],
    [addDays(SEED_ANCHOR, 1), 8],
    [addDays(SEED_ANCHOR, 1), 22],
    [addDays(SEED_ANCHOR, 3), 12],
  ];

  it.each(moments)('am %s um %i Uhr: nichts verloren, gleiche Anzahlen, gleiche Serie', async (day, hour) => {
    const seed = loadSeed();
    const now = berlin(day, hour);
    const { plan, res, writesAfterDryRun, after } = await migrate(seed, now);

    expect(writesAfterDryRun).toBe(0); // Trockenlauf schreibt nichts
    expect(res.status).toBe('done');

    // Nichts gelöscht: jedes Dokument ist noch da, dazu genau app/schema.
    for (const path of Object.keys(seed)) expect(after[path], path).toBeDefined();
    expect(Object.keys(after).length).toBe(Object.keys(seed).length + 1);
    for (const prefix of ['vocab/', 'grammar/', 'lesson/', 'log/', 'daily/', 'feed/', 'chunk/']) {
      expect(count(after, prefix), prefix).toBe(count(seed, prefix));
    }

    // Gleiche Serie wie in der alten App.
    const p = seed['app/profile'] as { days: Record<string, number>; xpDays: Record<string, number> };
    expect(plan.streak.before).toBe(legacyStreak(p.days, p.xpDays, now));
    expect(plan.streak.after).toBe(plan.streak.before);
    const schema = after['app/schema'] as { version: number; cutover: string; counts: Record<string, number> };
    expect(schema.version).toBe(SCHEMA_VERSION);
    expect(schema.counts.streak).toBe(plan.streak.before);
  });

  it('ergänzt FSRS nur zusätzlich – alte Felder bleiben unverändert', async () => {
    const seed = loadSeed();
    const { after } = await migrate(seed, berlin(SEED_ANCHOR, 21));
    for (const [path, doc] of Object.entries(seed)) {
      const now = after[path] as Doc;
      if (path.startsWith('vocab/') || path.startsWith('chunk/')) {
        const { fsrs, ...rest } = now;
        expect(fsrs, path).toBeTypeOf('object');
        expect(rest, path).toEqual(doc);
      } else {
        expect(now, path).toEqual(doc); // alles andere bytegleich, auch daily/* und feed/*
      }
    }
  });

  it('zählt Vokabeln, Themen, Lektionen und Logs wie die alte App (mit Voreinstellungen)', async () => {
    const seed = loadSeed();
    const { plan } = await migrate(seed, berlin(SEED_ANCHOR, 21));
    expect(plan.totals.vocab).toBe(count(seed, 'vocab/') + plan.defaults.seedVocabNotInDb);
    expect(plan.defaults.seedVocabNotInDb).toBe(10);
    expect(plan.totals.grammar).toBe(16);
    expect(plan.totals.lessonsDone).toBe(6);
    expect(plan.totals.logs).toBe(count(seed, 'log/'));
    expect(plan.untouched).toEqual({ daily: 3, feed: 2 });
  });

  it('ist wiederholbar: ein zweiter Lauf erkennt die Version und ändert nichts', async () => {
    const seed = loadSeed();
    const now = berlin(SEED_ANCHOR, 21);
    const first = await migrate(seed, now);
    const writes = first.h.writes().length;
    const snapshot = await loadSnapshot(first.h.db);
    const again = planMigrationV1({ snapshot, local: NO_LOCAL, nowMs: now + 60_000 });
    expect(again.already?.version).toBe(1);
    expect(again.fsrs).toEqual([]);
    const res = await applyMigrationV1(again, { db: first.h.db, writer: createWriter(first.h.db), holder: 't2', nowMs: () => now });
    expect(res.status).toBe('already');
    expect(first.h.writes().length).toBe(writes);
  });

  it('übernimmt noch nicht übertragene lokale Änderungen der alten App nach Bestätigung', async () => {
    const seed = loadSeed();
    const profile = seed['app/profile'] as Doc & { days: Record<string, number> };
    const newer = { ...profile, days: { ...profile.days, [addDays(SEED_ANCHOR, 1)]: 12 } };
    const local = {
      dirty: { 'app/profile': 1, 'daily/2026-09-20': 1, 'vocab/nur-lokal': 1, 'app/course': 1 },
      docs: {
        'app/profile': newer,
        'daily/2026-09-20': { newWords: [] },
        'vocab/nur-lokal': { word: 'only local', de: 'nur lokal', state: 'new', S: 0 },
        'app/course': seed['app/course'] as Doc,
      },
    };
    const now = berlin(addDays(SEED_ANCHOR, 1), 21);
    const { plan, after } = await migrate(seed, now, local);
    expect(plan.rescue.map((r) => r.path)).toEqual(['app/profile', 'vocab/nur-lokal']);
    expect(plan.rescueSkipped).toEqual([
      { path: 'app/course', reason: 'unchanged' },
      { path: 'daily/2026-09-20', reason: 'read_only' },
    ]);
    expect((after['app/profile'] as { days: Record<string, number> }).days[addDays(SEED_ANCHOR, 1)]).toBe(12);
    expect(after['vocab/nur-lokal']).toMatchObject({ word: 'only local', fsrs: { state: 0 } });
    expect(after['daily/2026-09-20']).toEqual(seed['daily/2026-09-20']);
    expect(plan.streak.after).toBe(13); // der lokal nachgereichte Tag verlängert die Serie
  });

  it('meldet ungültige Dokumente und lässt sie unangetastet', async () => {
    const seed = { ...loadSeed(), 'vocab/kaputt': { de: 'ohne Wort' }, 'grammar/passive': { p: 'hoch' } };
    const { plan, after } = await migrate(seed, berlin(SEED_ANCHOR, 21));
    expect(plan.invalid.map((i) => i.path).sort()).toEqual(['grammar/passive', 'vocab/kaputt']);
    expect(after['vocab/kaputt']).toEqual({ de: 'ohne Wort' });
    expect(after['grammar/passive']).toEqual({ p: 'hoch' });
  });

  it('läuft nicht doppelt, wenn ein anderes Fenster die Umstellung hält', async () => {
    const h = createMemoryDb({ seed: loadSeed() });
    await h.db.doc('app/schema').acquire({ holder: 'anderes-fenster', ttlMs: 60_000 });
    const plan = planMigrationV1({ snapshot: await loadSnapshot(h.db), local: NO_LOCAL, nowMs: berlin(SEED_ANCHOR, 21) });
    const res = await applyMigrationV1(plan, { db: h.db, writer: createWriter(h.db), holder: 'dieses-fenster', nowMs: () => 0 });
    expect(res.status).toBe('busy');
    expect(h.writes()).toEqual([]);
  });

  it('bricht sauber ab und lässt sich danach fortsetzen', async () => {
    const h = createMemoryDb({ seed: loadSeed() });
    const now = berlin(SEED_ANCHOR, 21);
    const plan = planMigrationV1({ snapshot: await loadSnapshot(h.db), local: NO_LOCAL, nowMs: now });
    h.setFailWrites('invalid_argument');
    const failed = await applyMigrationV1(plan, { db: h.db, writer: createWriter(h.db), holder: 't', nowMs: () => now });
    expect(failed).toMatchObject({ status: 'failed', written: 0, code: 'invalid_argument' });
    h.setFailWrites(undefined);
    const plan2 = planMigrationV1({ snapshot: await loadSnapshot(h.db), local: NO_LOCAL, nowMs: now });
    expect((await applyMigrationV1(plan2, { db: h.db, writer: createWriter(h.db), holder: 't', nowMs: () => now })).status).toBe('done');
  });

  it('funktioniert auch mit leerer Datenbank und mit flacher Einschätzung (Anhang B)', async () => {
    const empty = await migrate({}, berlin(SEED_ANCHOR, 12));
    expect(empty.res.status).toBe('done');
    expect(empty.plan.totals.vocab).toBe(40);
    const flat = snapshotFromRecord({ 'app/assess': { level: 'B2', cefr: 'B2', blockers: [] } });
    expect(flat.invalid).toEqual([]);
  });
});
