import { describe, expect, it, vi } from 'vitest';
import type * as Paths from '../../../src/data/paths';

// Rückwärtsverträglichkeit mit der Live-Version v76 (`JLL8…` 1791807258-d7e7, docs/umbau/lesen-plan.md §4.4).
// v76 kennt die Sammlung `read` nicht: Ihr Register `COLLECTIONS` hat keinen Eintrag `read`. Dieser Test bildet das nach, indem
// er `src/data/paths` ohne `read` ersetzt (Stand vor L1) und den UNVERÄNDERTEN Lese-Code (snapshot/reads/validate/live) darüber laufen lässt.
// Ergebnis (auch im Plan-Nachtrag festgehalten):
//  - Voll-Lesen (Sicherung, Umstellung, Diagnose) fragt nur die Namen aus COLLECTION_NAMES ab: `read/` wird nie gelesen, gezählt, gesichert.
//  - Das Live-Abo hängt an den festen Listen LIVE_DOCS/LIVE_COLLECTIONS: `read/` wird nie abonniert.
//  - `validateDoc` kennt für einen unbekannten Pfad kein Schema und lässt den Inhalt unverändert durch (kein Fehler, kein Eintrag in `invalid`).
//  - Geschrieben wird `read/` von v76 nie; die Dokumente bleiben unberührt in der Datenbank.

vi.mock('../../../src/data/paths', async (importOriginal) => {
  const orig = await importOriginal<typeof Paths>();
  const old: Record<string, unknown> = { ...orig.COLLECTIONS };
  delete old.read;
  return {
    ...orig,
    COLLECTIONS: old,
    COLLECTION_NAMES: Object.keys(old),
    // Nachbau von v76: gleiche Logik wie schemaForPath, aber über das Register OHNE `read`.
    schemaForPath: (path: string) => {
      if (Object.hasOwn(orig.APP_DOCS, path)) return orig.APP_DOCS[path as keyof typeof orig.APP_DOCS];
      const segs = path.split('/');
      if (segs.length !== 2) return null;
      return Object.hasOwn(old, segs[0] ?? '') ? old[segs[0] ?? ''] : null;
    },
  };
});

const { createMemoryDb } = await import('../../../src/platform/dev/memoryDb');
const { COLLECTION_NAMES, schemaForPath } = await import('../../../src/data/paths');
const { loadSnapshot, totalDocuments } = await import('../../../src/data/snapshot');
const { countDocuments, readDoc } = await import('../../../src/data/reads');
const { validateDoc } = await import('../../../src/data/validate');
const { LIVE_COLLECTIONS, LIVE_DOCS } = await import('../../../src/data/live');
const { createWriter } = await import('../../../src/data/writer');

const READ_DOCS = {
  'read/d-2026-10-13': { v: 1, day: '2026-10-13', items: [{ id: 'a-2026-10-13-1-abc123', title: 'T', paras: [[{ e: 'x', d: 'y' }]] }] },
  'read/m-2026-10': { v: 1, items: [{ id: 'a-2026-10-13-1-abc123', st: { sec: 5 } }] },
  'read/p': { v: 1, view: 'b' },
};

function recording(seed: Record<string, Record<string, unknown>>) {
  const h = createMemoryDb({ seed });
  const asked = { collections: [] as string[], docs: [] as string[] };
  const db = {
    ...h.db,
    collection: (name: string) => {
      asked.collections.push(name);
      return h.db.collection(name);
    },
    doc: (path: string) => {
      asked.docs.push(path);
      return h.db.doc(path);
    },
  };
  return { h, db, asked };
}

describe('v76 (Register ohne `read`): `read/` ist unsichtbar und harmlos', () => {
  it('Voraussetzung des Nachbaus: `read` fehlt im Register, kein Schema für den Pfad', () => {
    expect(COLLECTION_NAMES).not.toContain('read');
    expect(schemaForPath('read/d-2026-10-13')).toBeNull();
    expect(schemaForPath('read/p')).toBeNull();
  });

  it('Voll-Lesen (Sicherung/Umstellung): `read` wird nie abgefragt, gezählt oder als ungültig gemeldet', async () => {
    const { db, asked } = recording({ ...READ_DOCS, 'app/profile': { lang: 'de' }, 'vocab/w1': { word: 'ok' } });
    const snap = await loadSnapshot(db);
    expect(asked.collections).not.toContain('read');
    expect(asked.collections.length).toBe(COLLECTION_NAMES.length);
    expect([...snap.raw.keys()].some((p) => p.startsWith('read/'))).toBe(false);
    expect(snap.counts.read).toBeUndefined();
    expect(snap.invalid).toEqual([]);
    expect(totalDocuments(snap)).toBe(2); // app/profile + vocab/w1: der Gesamtzähler zählt `read/` nicht mit
  });

  it('Diagnose-Zählung: `read` taucht nicht auf', async () => {
    const { db, asked } = recording({ ...READ_DOCS });
    const counts = await countDocuments(db);
    expect(counts.byCollection.read).toBeUndefined();
    expect(asked.collections).not.toContain('read');
  });

  it('Live-Abos: feste Listen ohne `read`', () => {
    expect(LIVE_COLLECTIONS as readonly string[]).not.toContain('read');
    expect(LIVE_DOCS.some((d) => d.startsWith('read/'))).toBe(false);
  });

  it('ein einzeln gelesener `read/`-Pfad (falls je einer gelesen würde) geht ohne Fehler und unverändert durch validateDoc/readDoc', async () => {
    const kaputt = { items: 'ganz anders' };
    const r = validateDoc('read/d-2026-10-13', kaputt);
    expect(r).toEqual({ ok: true, path: 'read/d-2026-10-13', value: kaputt });
    const { db } = recording({ ...READ_DOCS });
    const d = await readDoc(db, 'read/p');
    expect(d).toEqual({ status: 'valid', doc: READ_DOCS['read/p'] });
  });

  it('v76 schreibt `read/` nie: die Dokumente bleiben nach einem Voll-Lesen und Schreiben anderer Pfade unverändert', async () => {
    const { h, db } = recording({ ...READ_DOCS, 'app/profile': { lang: 'de' } });
    await loadSnapshot(db);
    const w = createWriter(h.db);
    await w.patch('app/profile', { lang: 'en' });
    expect(h.dump()['read/d-2026-10-13']).toEqual(READ_DOCS['read/d-2026-10-13']);
    expect(h.dump()['read/m-2026-10']).toEqual(READ_DOCS['read/m-2026-10']);
    expect(h.dump()['read/p']).toEqual(READ_DOCS['read/p']);
    expect(h.writes().every((x) => !x.path.startsWith('read/'))).toBe(true);
  });
});
